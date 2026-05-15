import { NextResponse } from "next/server";
import { apiErrorResponse, badRequest, handleApiError, unauthorized } from "@/lib/requixen/server/api-errors";
import { extractTextFromFile } from "@/lib/requixen/server/documents";
import { serverEnv } from "@/lib/requixen/server/env";
import { bearerToken, getAuthenticatedPocketBaseUser, requireProjectAccess } from "@/lib/requixen/server/pocketbase";
import { indexDocumentText } from "@/lib/requixen/server/qdrant";
import type { AttachedDocument } from "@/lib/requixen/types";

type PocketBaseFileRecord = {
  id: string;
  file?: string;
  name?: string;
  mimeType?: string;
  size?: number;
  projectId?: string;
  sessionId?: string;
};

export async function POST(request: Request) {
  try {
    const token = bearerToken(request);

    if (!token) {
      return apiErrorResponse(unauthorized());
    }

    const incomingForm = await request.formData();
    const files = incomingForm.getAll("files").filter((value): value is File => value instanceof File);

    if (files.length === 0) {
      return apiErrorResponse(badRequest("At least one file is required."));
    }

    const env = serverEnv();
    const projectId = String(incomingForm.get("projectId") ?? "");
    const sessionId = String(incomingForm.get("sessionId") ?? "");
    const origin = String(incomingForm.get("origin") ?? "upload");
    const { user } = projectId ? await requireProjectAccess(projectId, token) : { user: await getAuthenticatedPocketBaseUser(token) };
    const uploadedBy = user.id;
    const documents: AttachedDocument[] = [];

    for (const file of files) {
      const uploadForm = new FormData();
      uploadForm.append("name", file.name);
      uploadForm.append("mimeType", file.type || "application/octet-stream");
      uploadForm.append("size", String(file.size));
      uploadForm.append("projectId", projectId);
      uploadForm.append("sessionId", sessionId);
      uploadForm.append("origin", origin);
      uploadForm.append("uploadedBy", uploadedBy);
      uploadForm.append("file", file);

      const response = await fetch(`${env.pocketBaseUrl}/api/collections/${env.pocketBaseFilesCollection}/records`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: uploadForm,
        cache: "no-store",
      });

      if (!response.ok) {
        const detail = await response.text();
        throw new Error(`PocketBase file upload failed (${response.status}): ${detail}`);
      }

      const record = (await response.json()) as PocketBaseFileRecord;
      const document = mapFileRecord(record, env.pocketBaseUrl, env.pocketBaseFilesCollection, file);
      const extracted = await extractTextFromFile(file);

      if (extracted.status !== "indexed") {
        documents.push({
          ...document,
          indexingStatus: extracted.status,
          indexingDetail: extracted.detail,
          indexedChunks: 0,
        });
        continue;
      }

      try {
        const indexing = await indexDocumentText({
          document,
          text: extracted.text,
          uploadedBy,
        });
        documents.push({
          ...document,
          indexingStatus: indexing.status,
          indexingDetail: indexing.detail,
          indexedChunks: indexing.chunks,
        });
      } catch (indexingError) {
        documents.push({
          ...document,
          indexingStatus: "failed",
          indexingDetail:
            indexingError instanceof Error ? indexingError.message : "No se pudo indexar el documento en Qdrant.",
          indexedChunks: 0,
        });
      }
    }

    return NextResponse.json({ documents });
  } catch (error) {
    return handleApiError(error, "Unable to upload files.");
  }
}

function mapFileRecord(
  record: PocketBaseFileRecord,
  pocketBaseUrl: string,
  filesCollection: string,
  fallbackFile: File,
): AttachedDocument {
  const filename = record.file || fallbackFile.name;

  return {
    id: `pb-file-${record.id}`,
    storageRecordId: record.id,
    name: record.name || fallbackFile.name,
    type: record.mimeType || fallbackFile.type || "unknown",
    size: record.size || fallbackFile.size,
    origin: "upload",
    projectId: record.projectId,
    sessionId: record.sessionId,
    url: `${pocketBaseUrl}/api/files/${filesCollection}/${record.id}/${filename}`,
  };
}
