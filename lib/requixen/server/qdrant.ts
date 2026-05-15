import { randomUUID } from "crypto";
import type { AttachedDocument } from "@/lib/requixen/types";
import { chunkDocumentText } from "./documents";
import { serverEnv } from "./env";
import { createEmbeddings, embeddingDimensionsForModel } from "./openai";

type QdrantPoint = {
  id: string;
  vector: number[];
  payload: DocumentChunkPayload;
};

type DocumentChunkPayload = {
  projectId: string;
  sessionId: string;
  storageRecordId: string;
  documentId: string;
  documentName: string;
  documentType: string;
  sourceUrl: string;
  origin: string;
  uploadedBy: string;
  chunkIndex: number;
  text: string;
};

type QdrantSearchResponse = {
  result?: Array<{
    id: string;
    score?: number;
    payload?: Partial<DocumentChunkPayload>;
  }>;
};

export type KnowledgeHit = {
  id: string;
  score: number;
  documentName: string;
  text: string;
  sourceUrl: string;
};

export async function indexDocumentText({
  document,
  text,
  uploadedBy,
}: {
  document: AttachedDocument;
  text: string;
  uploadedBy: string;
}) {
  const env = serverEnv();

  if (!env.qdrantUrl || !env.qdrantApiKey || !env.openAiApiKey) {
    return {
      status: "skipped" as const,
      detail: "Qdrant u OpenAI embeddings no estan configurados.",
      chunks: 0,
    };
  }

  if (!document.projectId) {
    return {
      status: "skipped" as const,
      detail: "El documento todavia no tiene proyecto asociado para indexacion semantica.",
      chunks: 0,
    };
  }

  const chunks = chunkDocumentText(text);

  if (chunks.length === 0) {
    return {
      status: "skipped" as const,
      detail: "No se encontraron fragmentos de texto para indexar.",
      chunks: 0,
    };
  }

  await ensureQdrantCollection();
  const embeddings = await createEmbeddings(chunks);
  const points: QdrantPoint[] = chunks.map((chunk, index) => ({
    id: randomUUID(),
    vector: embeddings[index] ?? [],
    payload: {
      projectId: document.projectId ?? "",
      sessionId: document.sessionId ?? "",
      storageRecordId: document.storageRecordId ?? "",
      documentId: document.id,
      documentName: document.name,
      documentType: document.type,
      sourceUrl: document.url ?? "",
      origin: document.origin,
      uploadedBy,
      chunkIndex: index,
      text: chunk,
    },
  }));

  await qdrantRequest(`/collections/${encodeURIComponent(env.qdrantCollection)}/points?wait=true`, {
    method: "PUT",
    body: JSON.stringify({ points }),
  });

  return {
    status: "indexed" as const,
    detail: `Documento indexado en ${chunks.length} fragmento(s).`,
    chunks: chunks.length,
  };
}

export async function searchProjectKnowledge({
  projectId,
  query,
  limit = 5,
}: {
  projectId: string;
  query: string;
  limit?: number;
}): Promise<KnowledgeHit[]> {
  const env = serverEnv();

  if (!env.qdrantUrl || !env.qdrantApiKey || !env.openAiApiKey || !projectId || !query.trim()) {
    return [];
  }

  await ensureQdrantCollection();
  const [embedding] = await createEmbeddings([query]);

  if (!embedding?.length) {
    return [];
  }

  const data = await qdrantRequest<QdrantSearchResponse>(
    `/collections/${encodeURIComponent(env.qdrantCollection)}/points/search`,
    {
      method: "POST",
      body: JSON.stringify({
        vector: embedding,
        limit,
        with_payload: true,
        filter: {
          must: [
            {
              key: "projectId",
              match: { value: projectId },
            },
          ],
        },
      }),
    },
  );

  return (data.result ?? []).map((item) => ({
    id: item.id,
    score: item.score ?? 0,
    documentName: item.payload?.documentName ?? "Documento",
    text: item.payload?.text ?? "",
    sourceUrl: item.payload?.sourceUrl ?? "",
  }));
}

export async function deleteDocumentKnowledge({
  projectId,
  storageRecordId,
  documentId,
}: {
  projectId: string;
  storageRecordId?: string;
  documentId?: string;
}) {
  const env = serverEnv();

  if (!env.qdrantUrl || !env.qdrantApiKey || !projectId || (!storageRecordId && !documentId)) {
    return;
  }

  await ensureQdrantCollection();
  const must = [
    {
      key: "projectId",
      match: { value: projectId },
    },
    storageRecordId
      ? {
          key: "storageRecordId",
          match: { value: storageRecordId },
        }
      : {
          key: "documentId",
          match: { value: documentId ?? "" },
        },
  ];

  await qdrantRequest(`/collections/${encodeURIComponent(env.qdrantCollection)}/points/delete?wait=true`, {
    method: "POST",
    body: JSON.stringify({
      filter: { must },
    }),
  });
}

export function formatKnowledgeContext(hits: KnowledgeHit[]) {
  if (hits.length === 0) {
    return "";
  }

  return hits
    .map(
      (hit, index) =>
        `[${index + 1}] ${hit.documentName} (score ${hit.score.toFixed(3)}): ${hit.text}`,
    )
    .join("\n\n");
}

async function ensureQdrantCollection() {
  const env = serverEnv();
  const collection = encodeURIComponent(env.qdrantCollection);
  const existing = await fetch(`${env.qdrantUrl}/collections/${collection}`, {
    headers: qdrantHeaders(),
    cache: "no-store",
  });

  if (existing.ok) {
    return;
  }

  if (existing.status !== 404) {
    throw new Error(`Qdrant collection check failed (${existing.status}): ${await existing.text()}`);
  }

  await qdrantRequest(`/collections/${collection}`, {
    method: "PUT",
    body: JSON.stringify({
      vectors: {
        size: embeddingDimensionsForModel(env.openAiEmbeddingModel),
        distance: "Cosine",
      },
    }),
  });
}

async function qdrantRequest<T = unknown>(path: string, init: RequestInit) {
  const env = serverEnv();
  const response = await fetch(`${env.qdrantUrl}${path}`, {
    ...init,
    headers: qdrantHeaders(init.headers),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Qdrant request failed (${response.status}): ${await response.text()}`);
  }

  if (response.status === 204) {
    return {} as T;
  }

  return response.json() as Promise<T>;
}

function qdrantHeaders(headers?: HeadersInit) {
  const env = serverEnv();
  const nextHeaders = new Headers(headers);
  nextHeaders.set("Content-Type", "application/json");
  nextHeaders.set("api-key", env.qdrantApiKey);
  return nextHeaders;
}
