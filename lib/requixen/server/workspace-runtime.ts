import type { Artifact, AuditEntry, LayerId, RiskFlag, TraceLink } from "@/lib/requixen/types";
import { serverEnv } from "./env";
import { pocketBaseAdminRequest, pocketBaseRequest, requireProjectAccess } from "./pocketbase";

type PocketBaseListResponse<T> = {
  items: T[];
};

type WorkspaceWarning = {
  collection: string;
  message: string;
};

type ArtifactRecord = Omit<Artifact, "id"> & {
  id: string;
  artifactId?: string;
  projectId?: string;
};

type RiskRecord = Omit<RiskFlag, "id"> & {
  id: string;
  riskId?: string;
  projectId?: string;
};

type TraceRecord = Omit<TraceLink, "id"> & {
  id: string;
  traceId?: string;
  projectId?: string;
  layerId?: string;
};

type AuditRecord = Omit<AuditEntry, "id"> & {
  id: string;
  auditId?: string;
  projectId?: string;
};

export type WorkspaceRuntimePayload = {
  artifacts: Artifact[];
  risks: RiskFlag[];
  traces: TraceLink[];
  audit: AuditEntry[];
  warnings: WorkspaceWarning[];
};

export async function loadWorkspaceRuntime(projectId: string, token: string): Promise<WorkspaceRuntimePayload> {
  await requireProjectAccess(projectId, token);
  const env = serverEnv();
  const warnings: WorkspaceWarning[] = [];
  const [artifacts, risks, traces, audit] = await Promise.all([
    listOptionalRecords<ArtifactRecord>(env.pocketBaseArtifactsCollection, projectId, token, warnings),
    listOptionalRecords<RiskRecord>(env.pocketBaseRisksCollection, projectId, token, warnings),
    listOptionalRecords<TraceRecord>(env.pocketBaseTracesCollection, projectId, token, warnings),
    listOptionalRecords<AuditRecord>(env.pocketBaseAuditCollection, projectId, token, warnings),
  ]);

  return {
    artifacts: artifacts.map(mapArtifactRecord),
    risks: risks.map(mapRiskRecord),
    traces: traces.map(mapTraceRecord),
    audit: audit.map(mapAuditRecord),
    warnings,
  };
}

export async function replaceWorkspaceLayerRuntime({
  projectId,
  layerId,
  artifacts,
  risks,
  traces,
  audit,
  token,
}: {
  projectId: string;
  layerId: LayerId;
  artifacts: Artifact[];
  risks: RiskFlag[];
  traces: TraceLink[];
  audit: AuditEntry[];
  token: string;
}) {
  await requireProjectAccess(projectId, token);
  const env = serverEnv();
  const scopedArtifacts = artifacts.filter((artifact) => artifact.layerId === layerId);
  const scopedRisks = risks.filter((risk) => risk.layerId === layerId);
  const scopedAudit = audit.filter((entry) => entry.layerId === layerId);
  const scopedTraces = traces.filter((trace) => scopedArtifacts.some((artifact) => artifact.id === trace.toArtifactId));

  await Promise.all([
    replaceCollectionScope(env.pocketBaseArtifactsCollection, projectId, layerId, token),
    replaceCollectionScope(env.pocketBaseRisksCollection, projectId, layerId, token),
    replaceCollectionScope(env.pocketBaseTracesCollection, projectId, layerId, token),
    replaceCollectionScope(env.pocketBaseAuditCollection, projectId, layerId, token),
  ]);

  await Promise.all([
    ...scopedArtifacts.map((artifact) =>
      pocketBaseRequest(
        `/api/collections/${env.pocketBaseArtifactsCollection}/records`,
        {
          method: "POST",
          body: JSON.stringify({
            projectId,
            artifactId: artifact.id,
            layerId: artifact.layerId,
            title: artifact.title,
            type: artifact.type,
            body: artifact.body,
            status: artifact.status,
            confidence: artifact.confidence,
            source: artifact.source,
            generatedBy: artifact.generatedBy,
            assumptions: artifact.assumptions ?? "",
          }),
        },
        token,
      ),
    ),
    ...scopedRisks.map((risk) =>
      pocketBaseRequest(
        `/api/collections/${env.pocketBaseRisksCollection}/records`,
        {
          method: "POST",
          body: JSON.stringify({
            projectId,
            riskId: risk.id,
            artifactId: risk.artifactId,
            layerId: risk.layerId,
            kind: risk.kind,
            label: risk.label,
            detail: risk.detail,
            severity: risk.severity,
            confidence: risk.confidence,
          }),
        },
        token,
      ),
    ),
    ...scopedTraces.map((trace) =>
      pocketBaseRequest(
        `/api/collections/${env.pocketBaseTracesCollection}/records`,
        {
          method: "POST",
          body: JSON.stringify({
            projectId,
            layerId,
            traceId: trace.id,
            fromArtifactId: trace.fromArtifactId ?? "",
            fromEvidenceId: trace.fromEvidenceId ?? "",
            fromLabel: trace.fromLabel ?? "",
            toArtifactId: trace.toArtifactId,
            relation: trace.relation,
          }),
        },
        token,
      ),
    ),
    ...scopedAudit.map((entry) =>
      pocketBaseRequest(
        `/api/collections/${env.pocketBaseAuditCollection}/records`,
        {
          method: "POST",
          body: JSON.stringify({
            projectId,
            auditId: entry.id,
            layerId: entry.layerId,
            timestamp: entry.timestamp,
            action: entry.action,
            actor: entry.actor,
          }),
        },
        token,
      ),
    ),
  ]);

  return loadWorkspaceRuntime(projectId, token);
}

export function mergeWorkspaceRuntime(
  runtime: Pick<WorkspaceRuntimePayload, "artifacts" | "risks" | "traces" | "audit">,
  loaded: Pick<WorkspaceRuntimePayload, "artifacts" | "risks" | "traces" | "audit">,
) {
  return {
    artifacts: loaded.artifacts.length > 0 ? loaded.artifacts : runtime.artifacts,
    risks: loaded.risks.length > 0 ? loaded.risks : runtime.risks,
    traces: loaded.traces.length > 0 ? loaded.traces : runtime.traces,
    audit: loaded.audit.length > 0 ? loaded.audit : runtime.audit,
  };
}

async function listOptionalRecords<T>(
  collection: string,
  projectId: string,
  token: string,
  warnings: WorkspaceWarning[],
) {
  const filter = encodeURIComponent(`projectId="${projectId}"`);

  try {
    const result = await pocketBaseRequest<PocketBaseListResponse<T>>(
      `/api/collections/${collection}/records?perPage=500&filter=${filter}`,
      {},
      token,
    );
    return result.items;
  } catch {
    warnings.push({
      collection,
      message: `Optional collection ${collection} is unavailable.`,
    });
    return [];
  }
}

async function replaceCollectionScope(collection: string, projectId: string, layerId: LayerId, token: string) {
  const filter = encodeURIComponent(`projectId="${projectId}" && layerId="${layerId}"`);
  const result = await pocketBaseRequest<PocketBaseListResponse<{ id: string }>>(
    `/api/collections/${collection}/records?perPage=500&filter=${filter}`,
    {},
    token,
  );

  await Promise.all(
    result.items.map((record) =>
      pocketBaseAdminRequest(`/api/collections/${collection}/records/${record.id}`, { method: "DELETE" }),
    ),
  );
}

function mapArtifactRecord(record: ArtifactRecord): Artifact {
  return {
    id: record.artifactId || record.id,
    layerId: normalizeLayerId(record.layerId),
    title: record.title ?? "",
    type: record.type ?? "",
    body: record.body ?? "",
    status: record.status ?? "draft",
    confidence: record.confidence ?? 0,
    source: record.source ?? "",
    generatedBy: record.generatedBy ?? "",
    assumptions: record.assumptions ?? "",
  };
}

function mapRiskRecord(record: RiskRecord): RiskFlag {
  return {
    id: record.riskId || record.id,
    artifactId: record.artifactId ?? "",
    layerId: normalizeLayerId(record.layerId),
    kind: record.kind ?? "traceability",
    label: record.label ?? "",
    detail: record.detail ?? "",
    severity: record.severity ?? "low",
    confidence: record.confidence ?? 0,
  };
}

function mapTraceRecord(record: TraceRecord): TraceLink {
  return {
    id: record.traceId || record.id,
    fromArtifactId: record.fromArtifactId || undefined,
    fromEvidenceId: record.fromEvidenceId || undefined,
    fromLabel: record.fromLabel || undefined,
    toArtifactId: record.toArtifactId ?? "",
    relation: record.relation ?? "",
  };
}

function mapAuditRecord(record: AuditRecord): AuditEntry {
  return {
    id: record.auditId || record.id,
    timestamp: record.timestamp ?? "",
    layerId: normalizeLayerId(record.layerId),
    action: record.action ?? "",
    actor: record.actor ?? "",
  };
}

function normalizeLayerId(value: unknown): LayerId {
  if (value === "mediator" || value === "cocreator" || value === "facilitator" || value === "assistant") {
    return value;
  }

  return "mediator";
}
