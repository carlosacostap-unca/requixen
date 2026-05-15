"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Dispatch, FormEvent, ReactNode, SetStateAction } from "react";
import { apiForm, apiJson } from "@/lib/requixen/api-client";
import {
  defaultInstitutionalInterviewTemplates,
  findInstitutionalInterviewTemplate,
} from "@/lib/requixen/institutional-templates";
import { t } from "@/lib/requixen/i18n";
import { generateLayerArtifacts } from "@/lib/requixen/simulated-ai";
import {
  initialArtifacts,
  initialAudit,
  initialRisks,
  initialTraces,
  layers,
  roleProfiles,
  seedProjects,
} from "@/lib/requixen/seed";
import type {
  Artifact,
  AttachedDocument,
  AuditEntry,
  ChatMessage,
  ClarificationRequest,
  ElicitationChatMessage,
  ElicitationChatSession,
  ElicitationContribution,
  ElicitationRoomState,
  GuidedInterviewBlock,
  InstitutionalInterviewTemplate,
  InstitutionalRequest,
  LayerId,
  Locale,
  MunicipalArea,
  Project,
  ProjectParticipant,
  ProjectRole,
  ProjectStatus,
  RoleProfile,
  RiskFlag,
  TraceLink,
  User,
  UserRole,
} from "@/lib/requixen/types";

type View = "projects" | "create" | "project" | "workspace" | "users" | "areas" | "templates";

type IntegrationMode = "demo" | "pocketbase";

interface IntegrationStatus {
  pocketBase: boolean;
  openAi: boolean;
  openAiModel: string;
}

interface ProjectRuntime {
  artifacts: Artifact[];
  risks: RiskFlag[];
  traces: TraceLink[];
  audit: AuditEntry[];
  activeLayerId: LayerId;
  elicitationRoom: ElicitationRoomState;
}

interface DraftProject {
  name: string;
  areaId: string;
  problem: string;
  institutionalRequest: InstitutionalRequest;
  participants: ProjectParticipant[];
  documents: AttachedDocument[];
  messages: ChatMessage[];
}

interface ElicitationInsight {
  id: string;
  title: string;
  body: string;
  source: string;
  kind: ElicitationContribution["kind"];
  confidence: number;
}

interface PersistedElicitationMessage {
  id: string;
  projectId: string;
  sessionId: string;
  authorName: string;
  authorRole: UserRole | "mediator-ai" | string;
  body: string;
  kind: ElicitationContribution["kind"] | "session-meta" | string;
  timestamp: string;
  created?: string;
  updated?: string;
}

interface PersistedElicitationRuntimeResponse {
  room?: ElicitationRoomState;
  messages?: PersistedElicitationMessage[];
  warnings?: Array<{ collection: string; message: string }>;
}

interface PersistedWorkspaceRuntimeResponse {
  artifacts?: Artifact[];
  risks?: RiskFlag[];
  traces?: TraceLink[];
  audit?: AuditEntry[];
  warnings?: Array<{ collection: string; message: string }>;
}

interface RequirementCandidateDraft {
  title: string;
  type: string;
  body: string;
  source: string;
  assumptions: string;
  confidence: number;
}

type ArtifactEditDraft = Pick<Artifact, "title" | "type" | "body" | "source" | "status" | "confidence"> & {
  assumptions: string;
};

const layerTone: Record<LayerId, string> = {
  mediator: "border-sky-200 bg-sky-50 text-sky-950",
  cocreator: "border-emerald-200 bg-emerald-50 text-emerald-950",
  facilitator: "border-amber-200 bg-amber-50 text-amber-950",
  assistant: "border-rose-200 bg-rose-50 text-rose-950",
};

const statusTone: Record<Artifact["status"], string> = {
  approved: "bg-emerald-100 text-emerald-800",
  draft: "bg-slate-100 text-slate-700",
  proposed: "bg-blue-100 text-blue-800",
  "needs-review": "bg-amber-100 text-amber-800",
};

const statusKeys: Record<Artifact["status"], string> = {
  approved: "approved",
  draft: "draft",
  proposed: "proposed",
  "needs-review": "needsReview",
};

const statusLabelKey: Record<ProjectStatus, string> = {
  intake: "statusIntake",
  elicitation: "statusElicitation",
  analysis: "statusAnalysis",
  negotiation: "statusNegotiation",
  validation: "statusValidation",
};

const roleLabelKey: Record<UserRole, string> = {
  admin: "roleAdmin",
  analyst: "roleAnalyst",
  stakeholder: "roleStakeholder",
  validator: "roleValidator",
};
const projectAssignmentRoles: ProjectRole[] = ["analyst", "stakeholder", "validator"];

function stakeholderNames(project: Pick<Project, "participants">) {
  return project.participants
    .filter((participant) => participant.role === "stakeholder")
    .map((participant) => participant.name)
    .filter(Boolean);
}

const permissionLabels: Array<[keyof RoleProfile["permissions"], string]> = [
  ["createProjects", "canCreateProjects"],
  ["generateArtifacts", "canGenerateArtifacts"],
  ["approveArtifacts", "canApproveArtifacts"],
  ["runValidation", "canRunValidation"],
  ["viewRisk", "canViewRisk"],
  ["manageUsers", "canManageUsers"],
];

const roleHomeCopy: Record<
  UserRole,
  {
    title: string;
    subtitle: string;
    focus: [string, string, string];
    accent: string;
  }
> = {
  admin: {
    title: "adminHomeTitle",
    subtitle: "adminHomeSubtitle",
    focus: ["adminFocusA", "adminFocusB", "adminFocusC"],
    accent: "from-slate-950 to-slate-700",
  },
  analyst: {
    title: "analystHomeTitle",
    subtitle: "analystHomeSubtitle",
    focus: ["analystFocusA", "analystFocusB", "analystFocusC"],
    accent: "from-sky-900 to-emerald-700",
  },
  stakeholder: {
    title: "stakeholderHomeTitle",
    subtitle: "stakeholderHomeSubtitle",
    focus: ["stakeholderFocusA", "stakeholderFocusB", "stakeholderFocusC"],
    accent: "from-amber-800 to-sky-800",
  },
  validator: {
    title: "validatorHomeTitle",
    subtitle: "validatorHomeSubtitle",
    focus: ["validatorFocusA", "validatorFocusB", "validatorFocusC"],
    accent: "from-rose-900 to-slate-700",
  },
};

const elicitationRoleCopy: Record<UserRole, { title: string; prompt: string; kind: ElicitationContribution["kind"] }> = {
  admin: {
    title: "adminElicitationTitle",
    prompt: "adminElicitationPrompt",
    kind: "constraint",
  },
  analyst: {
    title: "analystElicitationTitle",
    prompt: "analystElicitationPrompt",
    kind: "question",
  },
  stakeholder: {
    title: "stakeholderElicitationTitle",
    prompt: "stakeholderElicitationPrompt",
    kind: "need",
  },
  validator: {
    title: "validatorElicitationTitle",
    prompt: "validatorElicitationPrompt",
    kind: "risk-note",
  },
};

const blankInstitutionalRequest = (): InstitutionalRequest => ({
  templateId: "",
  templateName: "",
  requestingArea: "",
  receivingArea: "Direccion de Modernizacion",
  contactPerson: "",
  requestedAction: "",
  targetPopulation: "",
  urgency: "medium",
});

const emptyDraft = (): DraftProject => ({
  name: "",
  areaId: "",
  problem: "",
  institutionalRequest: blankInstitutionalRequest(),
  participants: [],
  documents: [],
  messages: [
    {
      id: "mediator-welcome",
      role: "mediator",
      body:
        "Hola. Soy el Mediador de Requixen. Contame que proyecto queres iniciar, que area municipal participa y que documentos iniciales tenes.",
      timestamp: "09:00",
    },
  ],
});

function initialRuntime(): ProjectRuntime {
  const initialMessage: ElicitationChatMessage = {
    id: "chat-seed-message",
    authorName: "Mediador",
    authorRole: "mediator-ai",
    body:
      "Hola. Esta sala pertenece al proyecto. Podemos conversar sobre el proceso actual, problemas, excepciones, vocabulario local y documentos que ayuden a entender la necesidad.",
    timestamp: "09:00",
  };

  return {
    artifacts: initialArtifacts,
    risks: initialRisks,
    traces: initialTraces,
    audit: initialAudit,
    activeLayerId: "mediator",
    elicitationRoom: {
      activeSessionId: "chat-current-process",
      sessions: [
        {
          id: "chat-current-process",
          title: "Proceso actual",
          createdBy: "Mediador",
          messages: [initialMessage],
          attachments: [],
          createdAt: "09:00",
          updatedAt: "09:00",
        },
      ],
      contributions: [
        {
          id: "elicitation-seed-source",
          authorName: "Interview transcript",
          authorRole: "mediator-ai",
          body:
            "Initial source: citizens file paper complaints, Public Works receives forms later, and status updates are unclear.",
          kind: "synthesis",
          timestamp: "09:00",
        },
      ],
      attachments: [],
      clarifications: [],
    },
  };
}

function emptyPocketBaseRuntime(projectId = "pocketbase-project"): ProjectRuntime {
  const createdAt = nowTime();
  const welcomeMessage: ElicitationChatMessage = {
    id: `message-welcome-${projectId}`,
    authorName: "Mediador",
    authorRole: "mediator-ai",
    body:
      "Hola. Soy el Mediador de Requixen. Esta es la sala de elicitacion del proyecto.\n\nPara empezar, contame una situacion real del proceso: quien participa, que intenta hacer, que informacion usa y donde aparece una demora, duda o excepcion.",
    timestamp: createdAt,
  };

  return {
    artifacts: [],
    risks: [],
    traces: [],
    audit: [],
    activeLayerId: "mediator",
    elicitationRoom: {
      activeSessionId: `room-${projectId}`,
      sessions: [
        {
          id: `room-${projectId}`,
          title: "Primer Chat",
          createdBy: "PocketBase",
          messages: [welcomeMessage],
          attachments: [],
          createdAt,
          updatedAt: createdAt,
        },
      ],
      contributions: [],
      attachments: [],
      clarifications: [],
    },
  };
}

function mergeLoadedRuntime(current: ProjectRuntime | undefined, loaded: ProjectRuntime) {
  if (!current) {
    return loaded;
  }

  const currentHasUserMessages = current.elicitationRoom.sessions.some((session) =>
    session.messages.some((message) => message.authorRole !== "mediator-ai"),
  );

  return currentHasUserMessages ? current : loaded;
}

function runtimeFromPersistedMessages(project: Project, messages: PersistedElicitationMessage[]): ProjectRuntime {
  const clarificationMessages = messages.filter(
    (message) => message.kind === "clarification-request" || message.kind === "clarification-response",
  );
  const visibleMessages = messages.filter(
    (message) =>
      message.kind !== "session-meta" &&
      message.kind !== "clarification-request" &&
      message.kind !== "clarification-response",
  );
  const sessionMeta = sessionMetadataFromMessages(messages);

  if (visibleMessages.length === 0 && sessionMeta.size === 0 && clarificationMessages.length === 0) {
    return emptyPocketBaseRuntime(project.id);
  }

  const messagesBySession = new Map<string, PersistedElicitationMessage[]>();

  for (const message of visibleMessages) {
    const sessionId = message.sessionId || `room-${project.id}`;
    messagesBySession.set(sessionId, [...(messagesBySession.get(sessionId) ?? []), message]);
  }

  for (const [sessionId] of sessionMeta) {
    if (!messagesBySession.has(sessionId)) {
      messagesBySession.set(sessionId, []);
    }
  }

  const sessions = [...messagesBySession.entries()]
    .map(([sessionId, sessionMessages], index): ElicitationChatSession | null => {
      const meta = sessionMeta.get(sessionId);

      if (meta?.deleted) {
        return null;
      }

      const mappedMessages: ElicitationChatMessage[] = sessionMessages.map((message) => ({
        id: message.id,
        authorName: message.authorRole === "mediator-ai" ? "Mediador" : message.authorName,
        authorRole: normalizeMessageAuthorRole(message.authorRole),
        body: message.body,
        timestamp: readablePersistedTimestamp(message.timestamp || message.created || ""),
      }));
      const firstMessage = mappedMessages[0];
      const lastMessage = mappedMessages.at(-1);

      return {
        id: sessionId,
        title: meta?.title || (index === 0 ? "Primer Chat" : `Chat ${index + 1}`),
        createdBy: firstMessage?.authorName || "Mediador",
        messages: mappedMessages,
        attachments: [],
        createdAt: firstMessage?.timestamp || readablePersistedTimestamp(meta?.createdAt ?? "") || nowTime(),
        updatedAt: lastMessage?.timestamp || readablePersistedTimestamp(meta?.updatedAt ?? "") || nowTime(),
      };
    })
    .filter((session): session is ElicitationChatSession => Boolean(session));

  const safeSessions = sessions.length > 0 ? sessions : emptyPocketBaseRuntime(project.id).elicitationRoom.sessions;

  return {
    artifacts: [],
    risks: [],
    traces: [],
    audit: [],
    activeLayerId: "mediator",
    elicitationRoom: {
      activeSessionId: safeSessions[0].id,
      sessions: safeSessions,
      contributions: visibleMessages
        .filter((message) => message.authorRole !== "mediator-ai")
        .map((message) => ({
          id: `elicitation-${message.id}`,
          authorName: message.authorName,
          authorRole: normalizeMessageAuthorRole(message.authorRole),
          body: message.body,
          kind: normalizeContributionKind(message.kind),
          timestamp: readablePersistedTimestamp(message.timestamp || message.created || ""),
          sourceMessageId: message.id,
          confidence: 0.8,
        })),
      attachments: [],
      clarifications: clarificationsFromMessages(project.id, clarificationMessages),
    },
  };
}

function clarificationsFromMessages(projectId: string, messages: PersistedElicitationMessage[]): ClarificationRequest[] {
  const requests = new Map<string, ClarificationRequest>();

  for (const message of messages) {
    const parsed = parseClarificationPayload(message.body);

    if (!parsed) {
      continue;
    }

    if (message.kind === "clarification-request") {
      const id = parsed.id || message.id;
      requests.set(id, {
        id,
        projectId,
        question: parsed.question || message.body,
        targetUserId: parsed.targetUserId || "",
        targetName: parsed.targetName || "Stakeholders",
        requestedBy: parsed.requestedBy || "",
        requestedByName: parsed.requestedByName || message.authorName || "Analista",
        status: parsed.status === "draft" ? "draft" : "sent",
        createdAt: readablePersistedTimestamp(message.timestamp || message.created || "") || nowTime(),
        sentAt: readablePersistedTimestamp(message.timestamp || message.created || "") || nowTime(),
      });
    }

    if (message.kind === "clarification-response") {
      const requestId = parsed.requestId || parsed.id || "";
      const request = requests.get(requestId);

      if (request) {
        requests.set(requestId, {
          ...request,
          status: "answered",
          response: parsed.response || message.body,
          respondedBy: parsed.respondedBy || "",
          respondedByName: parsed.respondedByName || message.authorName,
          respondedAt: readablePersistedTimestamp(message.timestamp || message.created || "") || nowTime(),
        });
      }
    }
  }

  return [...requests.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

function parseClarificationPayload(value: string) {
  try {
    return JSON.parse(value) as {
      id?: string;
      requestId?: string;
      question?: string;
      targetUserId?: string;
      targetName?: string;
      requestedBy?: string;
      requestedByName?: string;
      status?: string;
      response?: string;
      respondedBy?: string;
      respondedByName?: string;
    };
  } catch {
    return null;
  }
}

function sessionMetadataFromMessages(messages: PersistedElicitationMessage[]) {
  const metadata = new Map<string, { title?: string; deleted?: boolean; createdAt?: string; updatedAt?: string }>();

  for (const message of messages.filter((item) => item.kind === "session-meta")) {
    try {
      const parsed = JSON.parse(message.body) as { title?: string; deleted?: boolean };
      const current = metadata.get(message.sessionId) ?? {};
      metadata.set(message.sessionId, {
        ...current,
        ...parsed,
        createdAt: current.createdAt || message.created || message.timestamp,
        updatedAt: message.updated || message.created || message.timestamp,
      });
    } catch {
      // Ignore malformed metadata rows so chat messages remain recoverable.
    }
  }

  return metadata;
}

function normalizeMessageAuthorRole(value: string): UserRole | "mediator-ai" {
  if (value === "mediator-ai") {
    return "mediator-ai";
  }

  if (value === "admin" || value === "analyst" || value === "stakeholder" || value === "validator") {
    return value;
  }

  return "stakeholder";
}

function normalizeContributionKind(value: string): ElicitationContribution["kind"] {
  if (value === "constraint" || value === "question" || value === "synthesis" || value === "risk-note") {
    return value;
  }

  return "need";
}

function readablePersistedTimestamp(value: string) {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function nowTime() {
  return new Intl.DateTimeFormat("en", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date());
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function fileSizeLabel(size: number) {
  if (size < 1024) {
    return `${size} B`;
  }

  if (size < 1024 * 1024) {
    return `${Math.round(size / 1024)} KB`;
  }

  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function detectedElicitationInsights(
  room: ElicitationRoomState,
  project: Project,
  locale: Locale,
): ElicitationInsight[] {
  const contributionInsights: ElicitationInsight[] = room.contributions.slice(0, 6).map((entry, index) => ({
    id: `insight-${entry.id}`,
    title: insightTitle(entry.kind, index, locale),
    body: entry.body,
    source: `${entry.authorName} - ${entry.timestamp}`,
    kind: entry.kind,
    confidence: Math.max(68, 92 - index * 4),
  }));

  return [
    ...contributionInsights,
    {
      id: "insight-project-summary",
      title: t(locale, "projectContextInsight"),
      body: project.summary,
      source: project.municipality,
      kind: "synthesis" as const,
      confidence: 84,
    },
  ].slice(0, 7);
}

function insightTitle(kind: ElicitationContribution["kind"], index: number, locale: Locale) {
  const titleKeys: Record<ElicitationContribution["kind"], string> = {
    need: "detectedNeed",
    constraint: "detectedConstraint",
    question: "openQuestion",
    synthesis: "mediatorSynthesisItem",
    "risk-note": "earlyRisk",
  };

  return `${t(locale, titleKeys[kind])} ${index + 1}`;
}

const contributionKindLabels: Record<ElicitationContribution["kind"], string> = {
  need: "Necesidad",
  constraint: "Restriccion",
  question: "Pregunta",
  synthesis: "Sintesis",
  "risk-note": "Riesgo",
};
const contributionKinds: ElicitationContribution["kind"][] = ["need", "constraint", "question", "synthesis", "risk-note"];

const contributionKindTone: Record<ElicitationContribution["kind"], string> = {
  need: "border-emerald-200 bg-emerald-50 text-emerald-800",
  constraint: "border-amber-200 bg-amber-50 text-amber-800",
  question: "border-sky-200 bg-sky-50 text-sky-800",
  synthesis: "border-violet-200 bg-violet-50 text-violet-800",
  "risk-note": "border-rose-200 bg-rose-50 text-rose-800",
};

function contributionEvidenceStatus(kind: ElicitationContribution["kind"]) {
  if (kind === "question" || kind === "risk-note") {
    return "Requiere aclaracion";
  }

  if (kind === "synthesis") {
    return "Sintesis revisable";
  }

  return "Lista para trazar";
}

function contributionConfidenceLabel(contribution: ElicitationContribution, index: number) {
  const confidence = contribution.confidence ?? Math.max(0.64, 0.9 - index * 0.05);
  return `${Math.round(confidence * 100)}%`;
}

function artifactEvidenceFor(
  artifact: Pick<Artifact, "title" | "body" | "source">,
  contributions: ElicitationContribution[],
  limit = 2,
) {
  const target = `${artifact.title} ${artifact.body} ${artifact.source}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  const scored = contributions
    .filter((contribution) => contribution.authorRole !== "mediator-ai" || contribution.kind === "synthesis")
    .map((contribution, index) => ({
      contribution,
      index,
      score: contributionKeywords(contribution.body).filter((keyword) => target.includes(keyword)).length,
    }))
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .map((item) => item.contribution);

  if (scored.length > 0) {
    return scored.slice(0, limit);
  }

  return contributions
    .filter((contribution) => contribution.authorRole !== "mediator-ai")
    .slice(0, limit);
}

function contributionKeywords(value: string) {
  const stopwords = new Set([
    "para",
    "como",
    "con",
    "por",
    "una",
    "uno",
    "los",
    "las",
    "que",
    "del",
    "the",
    "and",
    "with",
    "shall",
    "system",
  ]);

  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length >= 4 && !stopwords.has(word));
}

function enrichArtifactsWithElicitationEvidence(artifacts: Artifact[], contributions: ElicitationContribution[]) {
  if (contributions.length === 0) {
    return artifacts;
  }

  return artifacts.map((artifact) => {
    const evidence = artifactEvidenceFor(artifact, contributions, 1)[0];

    if (!evidence) {
      return artifact;
    }

    return {
      ...artifact,
      source: `${artifact.source} Evidencia de elicitacion: ${evidence.authorName} (${contributionKindLabels[evidence.kind]}) - ${evidence.body.slice(0, 96)}`,
    };
  });
}

function createElicitationTraceLinks(artifacts: Artifact[], contributions: ElicitationContribution[]): TraceLink[] {
  if (contributions.length === 0) {
    return [];
  }

  return artifacts.flatMap((artifact) =>
    artifactEvidenceFor(artifact, contributions, 2).map((contribution) => ({
      id: `trace-elicitation-${contribution.id}-${artifact.id}`,
      fromEvidenceId: contribution.id,
      fromLabel: `${contributionKindLabels[contribution.kind]} de ${contribution.authorName}`,
      toArtifactId: artifact.id,
      relation: "sustenta",
    })),
  );
}

function sourceSummaryFromContributions(contributions: ElicitationContribution[]) {
  return contributions
    .map((contribution) => `${contribution.authorName} (${contributionKindLabels[contribution.kind]}): ${contribution.body}`)
    .join(" | ");
}

function candidateBodyFromContributions(contributions: ElicitationContribution[]) {
  if (contributions.length === 0) {
    return "";
  }

  if (contributions.length === 1) {
    return contributions[0].body;
  }

  return contributions.map((contribution) => `- ${contribution.body}`).join("\n");
}

function averageContributionConfidence(contributions: ElicitationContribution[]) {
  if (contributions.length === 0) {
    return 0.78;
  }

  const total = contributions.reduce((sum, contribution, index) => {
    return sum + (contribution.confidence ?? Math.max(0.64, 0.9 - index * 0.05));
  }, 0);

  return Math.min(0.95, Math.max(0.35, total / contributions.length));
}

function normalizeInstitutionalRequest(request: InstitutionalRequest): InstitutionalRequest | undefined {
  const hasRequestData = [
    request.templateId,
    request.templateName,
    request.requestingArea,
    request.receivingArea,
    request.contactPerson,
    request.requestedAction,
    request.targetPopulation,
  ].some((value) => value?.trim());

  if (!hasRequestData) {
    return undefined;
  }

  const normalized: InstitutionalRequest = {
    templateId: request.templateId?.trim() ?? "",
    templateName: request.templateName?.trim() ?? "",
    requestingArea: request.requestingArea.trim(),
    receivingArea: request.receivingArea.trim(),
    contactPerson: request.contactPerson.trim(),
    requestedAction: request.requestedAction.trim(),
    targetPopulation: request.targetPopulation.trim(),
    urgency: request.urgency,
  };

  return normalized;
}

function institutionalRequestContext(project: Pick<Project, "institutionalRequest">) {
  const request = project.institutionalRequest;

  if (!request) {
    return "";
  }

  return [
    `- **Area solicitante:** ${request.requestingArea || "Sin definir"}`,
    `- **Area receptora:** ${request.receivingArea || "Modernizacion"}`,
    `- **Referente:** ${request.contactPerson || "Pendiente"}`,
    `- **Accion solicitada:** ${request.requestedAction || "Pendiente"}`,
    `- **Poblacion objetivo:** ${request.targetPopulation || "Pendiente"}`,
    `- **Urgencia:** ${request.urgency}`,
  ].join("\n");
}

function institutionalInterviewTemplateFor(
  project: Pick<Project, "institutionalRequest">,
  templates = defaultInstitutionalInterviewTemplates,
) {
  const templateId = project.institutionalRequest?.templateId;

  return findInstitutionalInterviewTemplate(templates, templateId);
}

function institutionalInterviewBlocksFor(
  project: Pick<Project, "institutionalRequest">,
  templates = defaultInstitutionalInterviewTemplates,
) {
  return institutionalInterviewTemplateFor(project, templates)?.blocks ?? [];
}

function contributionMatchesKeywords(contribution: ElicitationContribution, keywords: string[]) {
  const target = contribution.body
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  return keywords.some((keyword) => target.includes(keyword));
}

function buildInstitutionalRequestSummary(
  project: Project,
  room: ElicitationRoomState,
  templates = defaultInstitutionalInterviewTemplates,
) {
  const template = institutionalInterviewTemplateFor(project, templates);

  if (!template) {
    return "";
  }

  const request = project.institutionalRequest;
  const contributions = room.contributions.filter((contribution) => contribution.authorRole !== "mediator-ai");
  const latestInputs = contributions.slice(0, 6);
  const blockInputs = template.blocks.map((block) => ({
    block,
    inputs: contributions.filter((contribution) => contributionMatchesKeywords(contribution, block.keywords)),
  }));
  const missingBlocks = blockInputs
    .filter((item) => item.inputs.length === 0)
    .map((item) => item.block.title);
  const synthesisLines = blockInputs.map(({ block, inputs }) => {
    return `- ${block.summaryLabel}: ${inputs[0]?.body || block.pendingText}`;
  });
  const completedBlocks = template.blocks.length - missingBlocks.length;
  const completionLabel = `${completedBlocks}/${template.blocks.length} bloques con algun aporte inicial`;
  const evidenceLines = latestInputs.map(
    (contribution) => `- ${contribution.authorName} (${contributionKindLabels[contribution.kind]}): ${contribution.body}`,
  );

  return [
    "**Solicitud relevada**",
    "",
    `- **Area solicitante:** ${request?.requestingArea || "Pendiente"}`,
    `- **Area receptora:** ${request?.receivingArea || "Direccion de Modernizacion"}`,
    `- **Referente:** ${request?.contactPerson || "Pendiente"}`,
    `- **Accion solicitada:** ${request?.requestedAction || project.summary}`,
    `- **Poblacion objetivo:** ${request?.targetPopulation || "Pendiente"}`,
    `- **Urgencia:** ${request?.urgency || "medium"}`,
    "",
    "**Sintesis operativa**",
    `- Estado de completitud: ${completionLabel}.`,
    ...synthesisLines,
    "",
    "**Evidencia conversada**",
    ...(evidenceLines.length > 0 ? evidenceLines : ["- Todavia no hay aportes de stakeholders registrados."]),
    "",
    "**Pendientes para cerrar la entrevista**",
    ...(missingBlocks.length > 0
      ? missingBlocks.map((block) => `- Completar bloque: ${block}.`)
      : [`- Los bloques principales ya tienen algun aporte inicial. Revisar calidad y confirmar con ${template.confirmationArea}.`]),
  ].join("\n");
}

export default function RequixenWorkspace() {
  const locale: Locale = "es";
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [integrationMode, setIntegrationMode] = useState<IntegrationMode>("demo");
  const [integrationStatusState, setIntegrationStatusState] = useState<IntegrationStatus | null>(null);
  const [authError, setAuthError] = useState("");
  const [documentError, setDocumentError] = useState("");
  const [view, setView] = useState<View>("projects");
  const [projects, setProjects] = useState<Project[]>(() => seedProjects);
  const [assignableUsers, setAssignableUsers] = useState<User[]>([]);
  const [municipalAreas, setMunicipalAreas] = useState<MunicipalArea[]>([]);
  const [institutionalTemplates, setInstitutionalTemplates] = useState<InstitutionalInterviewTemplate[]>(
    defaultInstitutionalInterviewTemplates,
  );
  const [selectedProjectId, setSelectedProjectId] = useState(() => seedProjects[0]?.id ?? "");
  const [runtimeByProject, setRuntimeByProject] = useState<Record<string, ProjectRuntime>>(() =>
    Object.fromEntries(seedProjects.map((project) => [project.id, initialRuntime()])),
  );
  const [draft, setDraft] = useState<DraftProject>(() => emptyDraft());
  const [chatInput, setChatInput] = useState("");

  const selectedProject = projects.find((project) => project.id === selectedProjectId) ?? projects[0];
  const runtime = selectedProject
    ? runtimeByProject[selectedProject.id] ??
      (integrationMode === "pocketbase" ? emptyPocketBaseRuntime(selectedProject.id) : initialRuntime())
    : emptyPocketBaseRuntime();
  const currentRoleProfile = currentUser
    ? roleProfiles.find((profile) => profile.role === currentUser.role) ?? roleProfiles[1]
    : null;
  const selectedProjectParticipant =
    selectedProject && currentUser
      ? selectedProject.participants.find((participant) => participant.userId === currentUser.id)
      : undefined;
  const projectScopedUser =
    currentUser && selectedProjectParticipant
      ? {
          ...currentUser,
          role: selectedProjectParticipant.role,
          roles: [selectedProjectParticipant.role],
        }
      : currentUser;
  const projectRoleProfile = projectScopedUser
    ? roleProfiles.find((profile) => profile.role === projectScopedUser.role) ?? currentRoleProfile
    : currentRoleProfile;
  const currentUserIsAdmin = currentUser?.isAdmin ?? false;

  function switchActiveRole(role: UserRole) {
    setCurrentUser((user) => {
      if (!user || !user.roles.includes(role)) {
        return user;
      }

      return { ...user, role };
    });
  }

  useEffect(() => {
    fetch("/api/integrations/status")
      .then((response) => (response.ok ? response.json() : null))
      .then((status: IntegrationStatus | null) => {
        if (status) {
          setIntegrationStatusState(status);
        }
      })
      .catch(() => {
        setIntegrationStatusState(null);
      });
  }, []);

  async function signInWithPocketBase(identity: string, password: string) {
    setAuthError("");

    let data: { token?: string; user?: User };

    try {
      data = await apiJson<{ token?: string; user?: User }>("/api/auth/login", {
        method: "POST",
        body: { identity, password },
      });
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : t(locale, "authFailed"));
      return;
    }

    if (!data.token || !data.user) {
      setAuthError(t(locale, "authFailed"));
      return;
    }

    setAuthToken(data.token);
    setIntegrationMode("pocketbase");
    setProjects([]);
    setSelectedProjectId("");
    setRuntimeByProject({});
    await loadPocketBaseProjects(data.token);
    await loadPocketBaseUsers(data.token);
    await loadPocketBaseAreas(data.token);
    await loadPocketBaseInstitutionalTemplates(data.token);
    setCurrentUser(data.user);
    setView("projects");
  }

  async function loadPocketBaseProjects(token: string) {
    let data: { projects?: Project[] };

    try {
      data = await apiJson<{ projects?: Project[] }>("/api/projects", { token });
    } catch {
      return;
    }

    const pocketBaseProjects = data.projects ?? [];
    setProjects(pocketBaseProjects);
    setSelectedProjectId(pocketBaseProjects[0]?.id ?? "");
    const loadedRooms = await Promise.all(
      pocketBaseProjects.map(async (project) => [
        project.id,
        await loadPocketBaseElicitationRuntime(project, token),
      ] as const),
    );
    setRuntimeByProject((current) =>
      Object.fromEntries(
        pocketBaseProjects.map((project) => {
          const loadedRuntime = loadedRooms.find(([projectId]) => projectId === project.id)?.[1];
          return [project.id, mergeLoadedRuntime(current[project.id], loadedRuntime ?? emptyPocketBaseRuntime(project.id))];
        }),
      ),
    );
  }

  async function loadPocketBaseElicitationRuntime(project: Project, token: string) {
    const workspaceRuntime = await loadPocketBaseWorkspaceRuntime(project.id, token);

    try {
      const data = await apiJson<PersistedElicitationRuntimeResponse>(
        `/api/elicitation/runtime?projectId=${encodeURIComponent(project.id)}`,
        { token },
      );

      if (data.room) {
        return {
          ...emptyPocketBaseRuntime(project.id),
          ...workspaceRuntime,
          elicitationRoom: data.room,
        };
      }
    } catch {
      // Fall back to the legacy message endpoint below.
    }

    let data: { messages?: PersistedElicitationMessage[] };

    try {
      data = await apiJson<{ messages?: PersistedElicitationMessage[] }>(
        `/api/elicitation/messages?projectId=${encodeURIComponent(project.id)}`,
        { token },
      );
    } catch {
      return emptyPocketBaseRuntime(project.id);
    }
    const messages = data.messages ?? [];
    const loadedRuntime = {
      ...runtimeFromPersistedMessages(project, messages),
      ...workspaceRuntime,
    };

    if (messages.length === 0) {
      const firstSession = loadedRuntime.elicitationRoom.sessions[0];
      const welcomeMessage = firstSession?.messages[0];

      if (firstSession && welcomeMessage) {
        void persistElicitationSessionMeta(token, project.id, firstSession.id, {
          title: firstSession.title,
          deleted: false,
        });
        void persistElicitationMessages(token, project.id, firstSession.id, "synthesis", welcomeMessage);
      }
    }

    return loadedRuntime;
  }

  async function loadPocketBaseWorkspaceRuntime(projectId: string, token: string) {
    try {
      const data = await apiJson<PersistedWorkspaceRuntimeResponse>(
        `/api/workspace/runtime?projectId=${encodeURIComponent(projectId)}`,
        { token },
      );

      return {
        artifacts: data.artifacts ?? [],
        risks: data.risks ?? [],
        traces: data.traces ?? [],
        audit: data.audit ?? [],
      };
    } catch {
      return {
        artifacts: [],
        risks: [],
        traces: [],
        audit: [],
      };
    }
  }

  async function loadPocketBaseUsers(token: string) {
    try {
      const data = await apiJson<{ users?: User[] }>("/api/users", { token });
      setAssignableUsers(data.users ?? []);
    } catch {
      setAssignableUsers([]);
    }
  }

  async function loadPocketBaseAreas(token: string) {
    try {
      const data = await apiJson<{ areas?: MunicipalArea[] }>("/api/areas", { token });
      setMunicipalAreas(data.areas ?? []);
    } catch {
      setMunicipalAreas([]);
    }
  }

  async function loadPocketBaseInstitutionalTemplates(token: string) {
    try {
      const data = await apiJson<{ templates?: InstitutionalInterviewTemplate[] }>("/api/institutional-templates", {
        token,
      });
      setInstitutionalTemplates(data.templates?.length ? data.templates : defaultInstitutionalInterviewTemplates);
    } catch {
      setInstitutionalTemplates(defaultInstitutionalInterviewTemplates);
    }
  }

  useEffect(() => {
    if (authToken && currentUserIsAdmin) {
      void loadPocketBaseUsers(authToken);
      void loadPocketBaseAreas(authToken);
      void loadPocketBaseInstitutionalTemplates(authToken);
    }
  }, [authToken, currentUserIsAdmin]);

  async function createApplicationUser(data: { name: string; email: string; password: string; isAdmin: boolean; areaId: string }) {
    if (!authToken || !currentUserIsAdmin) {
      return;
    }

    let result: { user?: User };

    try {
      result = await apiJson<{ user?: User }>("/api/users", {
        method: "POST",
        token: authToken,
        body: data,
      });
    } catch {
      return;
    }

    if (result.user) {
      setAssignableUsers((current) => [...current, result.user!].sort((a, b) => a.name.localeCompare(b.name)));
    }
  }

  async function updateApplicationUser(userId: string, data: { name: string; email: string; isAdmin: boolean; areaId: string }) {
    if (!authToken || !currentUserIsAdmin) {
      return;
    }

    let result: { user?: User };

    try {
      result = await apiJson<{ user?: User }>(`/api/users/${userId}`, {
        method: "PATCH",
        token: authToken,
        body: data,
      });
    } catch {
      return;
    }

    if (result.user) {
      const updatedUser = result.user;
      setAssignableUsers((current) => current.map((user) => (user.id === userId ? updatedUser : user)));
      setCurrentUser((user) => (user?.id === userId ? { ...updatedUser, role: user.role } : user));
      setProjects((current) =>
        current.map((project) => ({
          ...project,
          participants: project.participants.map((participant) =>
            participant.userId === userId
              ? {
                  userId,
                  name: updatedUser.name,
                  email: updatedUser.email,
                  role: participant.role,
                  areaId: updatedUser.areaId,
                  areaName: updatedUser.areaName,
                }
              : participant,
          ),
        })),
      );
    }
  }

  async function deleteApplicationUser(userId: string) {
    if (!authToken || !currentUser || !currentUserIsAdmin || currentUser.id === userId) {
      return;
    }

    let result: { deletedUserId?: string; projects?: Project[] };

    try {
      result = await apiJson<{ deletedUserId?: string; projects?: Project[] }>(`/api/users/${userId}`, {
        method: "DELETE",
        token: authToken,
      });
    } catch {
      return;
    }
    const deletedUserId = result.deletedUserId ?? userId;
    setAssignableUsers((current) => current.filter((user) => user.id !== deletedUserId));
    setProjects((current) =>
      current.map((project) => {
        const updatedProject = result.projects?.find((item) => item.id === project.id);
        return updatedProject ?? { ...project, participants: project.participants.filter((item) => item.userId !== deletedUserId) };
      }),
    );
  }

  async function createMunicipalArea(data: { name: string; code: string; description: string; parentAreaId: string }) {
    if (!authToken || !currentUserIsAdmin) {
      return;
    }

    let result: { area?: MunicipalArea };

    try {
      result = await apiJson<{ area?: MunicipalArea }>("/api/areas", {
        method: "POST",
        token: authToken,
        body: data,
      });
    } catch {
      return;
    }

    if (result.area) {
      setMunicipalAreas((current) => [...current, result.area!].sort((a, b) => a.name.localeCompare(b.name)));
    }
  }

  async function toggleInstitutionalTemplateActive(templateId: string, active: boolean) {
    const applyLocalUpdate = () => {
      setInstitutionalTemplates((current) =>
        current.map((template) => (template.id === templateId ? { ...template, active } : template)),
      );
    };

    if (!authToken || !currentUserIsAdmin) {
      applyLocalUpdate();
      return;
    }

    try {
      const result = await apiJson<{ template?: InstitutionalInterviewTemplate }>("/api/institutional-templates", {
        method: "PATCH",
        token: authToken,
        body: { templateId, active },
      });

      if (result.template) {
        setInstitutionalTemplates((current) =>
          current.map((template) => (template.id === templateId ? result.template! : template)),
        );
        return;
      }
    } catch {
      // Keep the admin screen usable in demo/fallback mode.
    }

    applyLocalUpdate();
  }

  async function duplicateInstitutionalTemplate(templateId: string) {
    const source = institutionalTemplates.find((template) => template.id === templateId);

    if (!source) {
      return;
    }

    const localCopy = () => {
      const copyId = `${source.id}-copy-${Date.now()}`;
      const copy: InstitutionalInterviewTemplate = {
        ...source,
        id: copyId,
        title: `${source.title} copia`,
        institutionalRequest: {
          ...source.institutionalRequest,
          templateId: copyId,
          templateName: `${source.institutionalRequest.templateName || source.title} copia`,
        },
        active: true,
      };
      setInstitutionalTemplates((current) => [...current, copy].sort((a, b) => a.title.localeCompare(b.title)));
    };

    if (!authToken || !currentUserIsAdmin) {
      localCopy();
      return;
    }

    try {
      const result = await apiJson<{ template?: InstitutionalInterviewTemplate }>("/api/institutional-templates", {
        method: "POST",
        token: authToken,
        body: { sourceTemplateId: templateId },
      });

      if (result.template) {
        setInstitutionalTemplates((current) => [...current, result.template!].sort((a, b) => a.title.localeCompare(b.title)));
        return;
      }
    } catch {
      // Keep the admin screen usable in demo/fallback mode.
    }

    localCopy();
  }

  function updateRuntime(projectId: string, updater: (current: ProjectRuntime) => ProjectRuntime) {
    setRuntimeByProject((current) => ({
      ...current,
      [projectId]: updater(
        current[projectId] ?? (integrationMode === "pocketbase" ? emptyPocketBaseRuntime(projectId) : initialRuntime()),
      ),
    }));
  }

  function openProject(projectId: string) {
    setSelectedProjectId(projectId);
    setView("project");
  }

  function openProjectLayer(layerId: LayerId) {
    updateRuntime(selectedProject.id, (current) => ({ ...current, activeLayerId: layerId }));
    setView("workspace");
  }

  function startProjectCreation() {
    if (!currentRoleProfile?.permissions.createProjects) {
      return;
    }

    setDraft({
      ...emptyDraft(),
      participants: currentUser
        ? [
            {
              userId: currentUser.id,
              name: currentUser.name,
              email: currentUser.email,
              role: "stakeholder",
              areaId: currentUser.areaId,
              areaName: currentUser.areaName,
            },
          ]
        : [],
    });
    setChatInput("");
    setView("create");
  }

  function handleDraftChange(
    field: keyof Pick<DraftProject, "name" | "areaId" | "problem">,
    value: string,
  ) {
    setDraft((current) => ({ ...current, [field]: value }));
  }

  function handleDraftInstitutionalRequestChange(field: keyof InstitutionalRequest, value: string) {
    setDraft((current) => ({
      ...current,
      institutionalRequest: {
        ...current.institutionalRequest,
        [field]: field === "urgency" ? (value as InstitutionalRequest["urgency"]) : value,
      },
    }));
  }

  function applyInstitutionalTemplate(templateId: string) {
    const template = findInstitutionalInterviewTemplate(institutionalTemplates, templateId);

    if (!template) {
      return;
    }

    setDraft((current) => ({
      ...current,
      name: current.name || template.projectName,
      problem: current.problem || template.problem,
      institutionalRequest: {
        ...template.institutionalRequest,
        contactPerson: current.institutionalRequest.contactPerson || template.institutionalRequest.contactPerson,
      },
      messages:
        current.messages.length > 1
          ? current.messages
          : [
              ...current.messages,
              {
                id: `mediator-template-${Date.now()}`,
                role: "mediator",
                body: template.mediatorPrompt,
                timestamp: nowTime(),
              },
            ],
    }));
  }

  function handleDraftParticipantsChange(participants: ProjectParticipant[]) {
    setDraft((current) => ({ ...current, participants }));
  }

  async function handleFiles(files: FileList | null) {
    if (!files) {
      return;
    }

    const localDocuments: AttachedDocument[] = Array.from(files).map((file) => ({
      id: `upload-${file.name}-${Date.now()}`,
      name: file.name,
      type: file.type || "unknown",
      size: file.size,
      origin: "upload",
    }));
    const nextDocuments = authToken
      ? await uploadFilesToPocketBaseStorage({
          token: authToken,
          files,
          origin: "project-intake",
          uploadedBy: currentUser?.id,
          fallbackDocuments: localDocuments,
        })
      : localDocuments;

    setDraft((current) => ({
      ...current,
      documents: [...current.documents, ...nextDocuments],
      messages:
        integrationMode === "pocketbase"
          ? current.messages
          : [
              ...current.messages,
              {
                id: `mediator-files-${Date.now()}`,
                role: "mediator",
                body: `Registre ${nextDocuments.length} archivo(s). Los usare como fuentes iniciales para construir el brief y marcar riesgos de trazabilidad cuando algo no este respaldado.`,
                timestamp: nowTime(),
              },
            ],
    }));
  }

  async function addProjectDocuments(files: FileList | null) {
    if (!files || !selectedProject || !currentUser) {
      return;
    }

    setDocumentError("");
    const localDocuments: AttachedDocument[] = Array.from(files).map((file) => ({
      id: `project-upload-${file.name}-${Date.now()}`,
      name: file.name,
      type: file.type || "unknown",
      size: file.size,
      origin: "upload",
      projectId: selectedProject.id,
    }));
    try {
      const uploadedDocuments = authToken
        ? await uploadFilesToPocketBaseStorage({
            token: authToken,
            files,
            projectId: selectedProject.id,
            origin: "project-documents",
            uploadedBy: currentUser.id,
            fallbackDocuments: localDocuments,
            allowFallback: false,
          })
        : localDocuments;

      if (uploadedDocuments.length === 0) {
        setDocumentError(t(locale, "documentUploadFailed"));
        return;
      }

      const nextDocuments = [...selectedProject.documents, ...uploadedDocuments];
      const updatedProject = authToken
        ? await persistProjectDocuments(selectedProject.id, nextDocuments, authToken)
        : { ...selectedProject, documents: nextDocuments };

      updateProjectInState(updatedProject);
    } catch {
      setDocumentError(t(locale, "documentUploadFailed"));
    }
  }

  async function deleteProjectDocument(document: AttachedDocument) {
    if (!selectedProject) {
      return;
    }

    setDocumentError("");
    try {
      const nextDocuments = selectedProject.documents.filter((item) => item.id !== document.id);
      const updatedProject = authToken
        ? await deletePersistedProjectDocument(selectedProject.id, document, nextDocuments, authToken)
        : { ...selectedProject, documents: nextDocuments };

      updateProjectInState(updatedProject);
    } catch {
      setDocumentError(t(locale, "documentDeleteFailed"));
    }
  }

  async function updateSelectedProjectParticipants(participants: ProjectParticipant[]) {
    if (!selectedProject) {
      return;
    }

    if (!authToken) {
      updateProjectInState({ ...selectedProject, participants });
      return;
    }

    let data: { project?: Project };

    try {
      data = await apiJson<{ project?: Project }>(`/api/projects/${selectedProject.id}/participants`, {
        method: "PATCH",
        token: authToken,
        body: { participants },
      });
    } catch {
      return;
    }
    if (data.project) {
      updateProjectInState(data.project);
    }
  }

  function updateProjectInState(project: Project) {
    setProjects((current) => current.map((item) => (item.id === project.id ? project : item)));
  }

  function sendDraftMessage() {
    const trimmed = chatInput.trim();
    if (!trimmed) {
      return;
    }

    setDraft((current) => ({
      ...current,
      messages: [
        ...current.messages,
        {
          id: `analyst-${Date.now()}`,
          role: "analyst",
          body: trimmed,
          timestamp: nowTime(),
        },
        {
          id: `mediator-${Date.now()}`,
          role: "mediator",
          body:
            "Perfecto. Voy a tratar eso como contexto de elicitation inicial. Antes de pasar al workspace, revisa que el nombre, el area, el problema y los actores esten suficientemente claros.",
          timestamp: nowTime(),
        },
      ],
    }));
    setChatInput("");
  }

  async function createProjectFromDraft() {
    if (!currentRoleProfile?.permissions.createProjects || !currentUser) {
      return;
    }

    const name = draft.name.trim() || "Untitled requirements project";
    const selectedArea = municipalAreas.find((area) => area.id === draft.areaId);
    const organization = selectedArea?.parentAreaName
      ? `${selectedArea.parentAreaName} / ${selectedArea.name}`
      : (selectedArea?.name ?? "Unspecified area");
    const problem = draft.problem.trim() || "Initial problem pending analyst refinement.";
    const institutionalRequest = normalizeInstitutionalRequest(draft.institutionalRequest);
    const project: Project = {
      id: `project-${Date.now()}`,
      name,
      domain: "Digital government",
      municipality: organization,
      areaId: selectedArea?.id ?? "",
      summary: problem,
      transcript: draft.messages
        .filter((message) => message.role === "analyst")
        .map((message) => message.body)
        .join(" "),
      status: "elicitation",
      createdAt: today(),
      updatedAt: today(),
      documents: draft.documents,
      participants:
        draft.participants.length > 0
          ? draft.participants
          : [
              {
                userId: currentUser.id,
                name: currentUser.name,
                email: currentUser.email,
                role: "stakeholder",
                areaId: currentUser.areaId,
                areaName: currentUser.areaName,
            },
          ],
      institutionalRequest,
    };

    let persistedProject = project;

    if (integrationMode === "pocketbase" && authToken) {
      try {
        const data = await apiJson<{ project?: Project }>("/api/projects", {
          method: "POST",
          token: authToken,
          body: { project },
        });
        persistedProject = data.project ?? project;
      } catch {
        persistedProject = project;
      }
    }

    const firstSession = createWelcomeElicitationSession(persistedProject, currentUser, "Primer Chat");
    const projectRuntime: ProjectRuntime = {
      ...emptyPocketBaseRuntime(persistedProject.id),
      elicitationRoom: {
        activeSessionId: firstSession.id,
        sessions: [firstSession],
        contributions: [],
        attachments: [],
        clarifications: [],
      },
      audit: [
        {
          id: `audit-project-created-${Date.now()}`,
          timestamp: nowTime(),
          layerId: "mediator",
          action: `Project created from institutional intake with ${draft.documents.length} document(s).`,
          actor: currentUser.name,
        },
      ],
    };

    if (authToken) {
      void persistElicitationSessionMeta(authToken, persistedProject.id, firstSession.id, {
        title: firstSession.title,
        deleted: false,
      });
      void persistElicitationMessages(authToken, persistedProject.id, firstSession.id, "synthesis", firstSession.messages[0]);
    }

    setProjects((current) => [persistedProject, ...current]);
    setRuntimeByProject((current) => ({
      ...current,
      [persistedProject.id]: projectRuntime,
    }));
    setSelectedProjectId(persistedProject.id);
    setView("project");
  }

  if (!currentUser || !currentRoleProfile) {
    return (
      <main className="requixen-app min-h-screen text-slate-950">
        <AuthView
          locale={locale}
          authError={authError}
          onPasswordSignIn={signInWithPocketBase}
        />
      </main>
    );
  }

  return (
    <main className="requixen-app min-h-screen text-slate-950">
      {view === "projects" && (
        <ProjectsView
          locale={locale}
          currentUser={currentUser}
          roleProfile={currentRoleProfile}
          projects={projects}
          users={assignableUsers}
          integrationMode={integrationMode}
          onCreate={startProjectCreation}
          onManageUsers={() => setView("users")}
          onManageAreas={() => setView("areas")}
          onManageTemplates={() => setView("templates")}
          onOpen={openProject}
          onRoleChange={switchActiveRole}
          onSignOut={() => {
            setCurrentUser(null);
            setAuthToken(null);
            setIntegrationMode("demo");
            setView("projects");
          }}
        />
      )}

      {view === "users" && (
        <AdminUsersView
          locale={locale}
          currentUser={currentUser}
          roleProfile={currentRoleProfile}
          users={assignableUsers}
          areas={municipalAreas}
          onBack={() => setView("projects")}
          onCreateUser={createApplicationUser}
          onUpdateUser={updateApplicationUser}
          onDeleteUser={deleteApplicationUser}
          onRoleChange={switchActiveRole}
          onSignOut={() => {
            setCurrentUser(null);
            setAuthToken(null);
            setIntegrationMode("demo");
            setView("projects");
          }}
        />
      )}

      {view === "areas" && (
        <AdminAreasView
          locale={locale}
          currentUser={currentUser}
          roleProfile={currentRoleProfile}
          areas={municipalAreas}
          onBack={() => setView("projects")}
          onCreateArea={createMunicipalArea}
          onRoleChange={switchActiveRole}
          onSignOut={() => {
            setCurrentUser(null);
            setAuthToken(null);
            setIntegrationMode("demo");
            setView("projects");
          }}
        />
      )}

      {view === "templates" && (
        <AdminTemplatesView
          locale={locale}
          currentUser={currentUser}
          roleProfile={currentRoleProfile}
          templates={institutionalTemplates}
          integrationMode={integrationMode}
          onBack={() => setView("projects")}
          onToggleTemplate={toggleInstitutionalTemplateActive}
          onDuplicateTemplate={duplicateInstitutionalTemplate}
          onRoleChange={switchActiveRole}
          onSignOut={() => {
            setCurrentUser(null);
            setAuthToken(null);
            setIntegrationMode("demo");
            setView("projects");
          }}
        />
      )}

      {view === "create" && (
        <CreateProjectView
          locale={locale}
          currentUser={currentUser}
          roleProfile={currentRoleProfile}
          users={assignableUsers.length > 0 ? assignableUsers : [currentUser]}
          areas={municipalAreas}
          templates={institutionalTemplates}
          draft={draft}
          chatInput={chatInput}
          setChatInput={setChatInput}
          onBack={() => setView("projects")}
          onRoleChange={switchActiveRole}
          onChange={handleDraftChange}
          onInstitutionalRequestChange={handleDraftInstitutionalRequestChange}
          onApplyInstitutionalTemplate={applyInstitutionalTemplate}
          onParticipantsChange={handleDraftParticipantsChange}
          onFiles={handleFiles}
          onSend={sendDraftMessage}
          onCreate={createProjectFromDraft}
        />
      )}

      {view === "project" && selectedProject && projectScopedUser && projectRoleProfile && (
        <ProjectPhasesView
          locale={locale}
          currentUser={projectScopedUser}
          roleProfile={projectRoleProfile}
          project={selectedProject}
          runtime={runtime}
          users={assignableUsers}
          onBack={() => setView("projects")}
          onOpenLayer={openProjectLayer}
          onParticipantsChange={updateSelectedProjectParticipants}
          onFiles={addProjectDocuments}
          onDeleteDocument={deleteProjectDocument}
          documentError={documentError}
          onRoleChange={switchActiveRole}
          onSignOut={() => {
            setCurrentUser(null);
            setAuthToken(null);
            setIntegrationMode("demo");
            setView("projects");
          }}
        />
      )}

      {view === "workspace" && selectedProject && projectScopedUser && projectRoleProfile && (
        <WorkspaceView
          locale={locale}
          currentUser={projectScopedUser}
          roleProfile={projectRoleProfile}
          project={selectedProject}
          runtime={runtime}
          templates={institutionalTemplates}
          onBack={() => setView("project")}
          onRoleChange={switchActiveRole}
          onSignOut={() => {
            setCurrentUser(null);
            setAuthToken(null);
            setIntegrationMode("demo");
            setView("projects");
          }}
          updateRuntime={(updater) => updateRuntime(selectedProject.id, updater)}
          integrationStatus={integrationStatusState}
          authToken={authToken}
        />
      )}
    </main>
  );
}

function AuthView({
  locale,
  authError,
  onPasswordSignIn,
}: {
  locale: Locale;
  authError: string;
  onPasswordSignIn: (identity: string, password: string) => Promise<void>;
}) {
  const [identity, setIdentity] = useState("");
  const [password, setPassword] = useState("");
  const [isSigningIn, setIsSigningIn] = useState(false);

  async function handlePasswordSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSigningIn(true);
    await onPasswordSignIn(identity, password);
    setIsSigningIn(false);
  }

  return (
    <div className="mx-auto grid min-h-screen w-full max-w-4xl content-center gap-5 px-4 py-8">
      <form onSubmit={handlePasswordSubmit} className="rx-card mx-auto w-full max-w-md p-6">
        <h1 className="text-center text-4xl font-semibold tracking-normal text-slate-950">Requixen</h1>
        <div className="mt-8 grid gap-3">
          <input
            value={identity}
            onChange={(event) => setIdentity(event.target.value)}
            type="email"
            autoComplete="email"
            placeholder={t(locale, "emailOrUsername")}
            className="h-12 rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-slate-700"
          />
          <input
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            type="password"
            autoComplete="current-password"
            placeholder={t(locale, "password")}
            className="h-12 rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-slate-700"
          />
          {authError && <p className="text-sm text-rose-700">{authError}</p>}
          <button
            type="submit"
            disabled={isSigningIn}
            className="mt-2 h-11 rounded-md bg-slate-950 px-4 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {isSigningIn ? t(locale, "signingIn") : t(locale, "signIn")}
          </button>
        </div>
      </form>
      <section className="rx-card mx-auto w-full max-w-md p-4 text-sm text-slate-600">
        <h2 className="text-sm font-semibold uppercase text-slate-500">
          {locale === "es" ? "Acceso protegido" : "Protected access"}
        </h2>
        <p className="mt-2">
          {locale === "es"
            ? "Ingresá con tu cuenta autorizada. El directorio de usuarios solo está disponible para administradores después del inicio de sesión."
            : "Sign in with your authorized account. The user directory is available only to administrators after sign-in."}
        </p>
      </section>
    </div>
  );
}

function normalizeSearchText(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function ProjectsView({
  locale,
  currentUser,
  roleProfile,
  projects,
  users,
  integrationMode,
  onCreate,
  onManageUsers,
  onManageAreas,
  onManageTemplates,
  onOpen,
  onRoleChange,
  onSignOut,
}: {
  locale: Locale;
  currentUser: User;
  roleProfile: RoleProfile;
  projects: Project[];
  users: User[];
  integrationMode: IntegrationMode;
  onCreate: () => void;
  onManageUsers: () => void;
  onManageAreas: () => void;
  onManageTemplates: () => void;
  onOpen: (projectId: string) => void;
  onRoleChange: (role: UserRole) => void;
  onSignOut: () => void;
}) {
  const canManageUsers = integrationMode === "pocketbase" && currentUser.isAdmin;
  const isAdminExperience = currentUser.isAdmin;
  const showRoleHome = !isAdminExperience && currentUser.role !== "stakeholder";

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 py-5 lg:px-6">
      <TopBar
        locale={locale}
        currentUser={currentUser}
        roleProfile={roleProfile}
        onRoleChange={onRoleChange}
        onSignOut={onSignOut}
      />
      {isAdminExperience ? (
        <section className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-normal text-slate-950">{t(locale, "projects")}</h1>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              {projects.length} {t(locale, "activeProjects").toLowerCase()} · {users.length} {t(locale, "users")}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {roleProfile.permissions.createProjects && (
              <button
                type="button"
                onClick={onCreate}
                className="h-10 rounded-md bg-slate-950 px-4 text-sm font-semibold text-white hover:bg-slate-800"
              >
                {t(locale, "createProject")}
              </button>
            )}
            {canManageUsers && (
              <>
                <button
                  type="button"
                  onClick={onManageUsers}
                  className="h-10 rounded-md border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-800 hover:bg-slate-50"
                >
                  {t(locale, "manageUsers")}
                </button>
                <button
                  type="button"
                  onClick={onManageAreas}
                  className="h-10 rounded-md border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-800 hover:bg-slate-50"
                >
                  {t(locale, "manageAreas")}
                </button>
                <button
                  type="button"
                  onClick={onManageTemplates}
                  className="h-10 rounded-md border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-800 hover:bg-slate-50"
                >
                  Gestionar plantillas
                </button>
              </>
            )}
          </div>
        </section>
      ) : showRoleHome ? (
        <RoleHomePanel
          locale={locale}
          currentUser={currentUser}
          roleProfile={roleProfile}
          projects={projects}
          onCreate={onCreate}
          onManageUsers={canManageUsers ? onManageUsers : undefined}
          onOpen={onOpen}
        />
      ) : (
        <section className="mt-6">
          <h1 className="text-3xl font-semibold tracking-normal text-slate-950">{t(locale, "projects")}</h1>
        </section>
      )}

      <section className={`mt-5 grid gap-3 ${isAdminExperience ? "xl:grid-cols-2" : "lg:grid-cols-2"}`}>
        {projects.length === 0 && (
          <div className="rounded-lg border border-slate-200 bg-white p-5 lg:col-span-2">
            <h2 className="text-lg font-semibold text-slate-950">{t(locale, "noProjectsTitle")}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              {integrationMode === "pocketbase" ? t(locale, "noPocketBaseProjectsHint") : t(locale, "noProjectsHint")}
            </p>
          </div>
        )}
        {projects.map((project) => (
          <button
            key={project.id}
            type="button"
            onClick={() => onOpen(project.id)}
            className="rx-card rx-card-interactive w-full border p-4 text-left"
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">
                    {t(locale, statusLabelKey[project.status])}
                  </span>
                  <span className="text-xs text-slate-500">{project.updatedAt}</span>
                </div>
                <h2 className="mt-3 text-xl font-semibold text-slate-950">{project.name}</h2>
                <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-600">{project.summary}</p>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-600">
              <span className="rounded-md bg-slate-50 px-2 py-1">{project.municipality}</span>
              <span className="rounded-md bg-slate-50 px-2 py-1">
                {project.documents.length} {t(locale, "attachedFiles").toLowerCase()}
              </span>
            </div>
          </button>
        ))}
      </section>
    </div>
  );
}

function AdminUsersView({
  locale,
  currentUser,
  roleProfile,
  users,
  areas,
  onBack,
  onCreateUser,
  onUpdateUser,
  onDeleteUser,
  onRoleChange,
  onSignOut,
}: {
  locale: Locale;
  currentUser: User;
  roleProfile: RoleProfile;
  users: User[];
  areas: MunicipalArea[];
  onBack: () => void;
  onCreateUser: (data: { name: string; email: string; password: string; isAdmin: boolean; areaId: string }) => void | Promise<void>;
  onUpdateUser: (userId: string, data: { name: string; email: string; isAdmin: boolean; areaId: string }) => void | Promise<void>;
  onDeleteUser: (userId: string) => void | Promise<void>;
  onRoleChange: (role: UserRole) => void;
  onSignOut: () => void;
}) {
  const [newUser, setNewUser] = useState({
    name: "",
    email: "",
    password: "",
    isAdmin: false,
    areaId: "",
  });
  const [editingUsers, setEditingUsers] = useState<Record<string, { name: string; email: string; isAdmin: boolean; areaId: string }>>({});

  function editableUser(user: User) {
    return (
      editingUsers[user.id] ?? {
        name: user.name,
        email: user.email,
        isAdmin: user.isAdmin,
        areaId: user.areaId,
      }
    );
  }

  async function createUser() {
    if (!newUser.name.trim() || !newUser.email.trim() || !newUser.password.trim()) {
      return;
    }

    await onCreateUser({
      name: newUser.name.trim(),
      email: newUser.email.trim(),
      password: newUser.password,
      isAdmin: newUser.isAdmin,
      areaId: newUser.areaId,
    });
    setNewUser({ name: "", email: "", password: "", isAdmin: false, areaId: "" });
  }

  async function saveUser(user: User) {
    const nextUser = editableUser(user);
    await onUpdateUser(user.id, {
      name: nextUser.name.trim() || user.name,
      email: nextUser.email.trim() || user.email,
      isAdmin: nextUser.isAdmin,
      areaId: nextUser.areaId,
    });
    setEditingUsers((current) => {
      const copy = { ...current };
      delete copy[user.id];
      return copy;
    });
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 py-5 lg:px-6">
      <TopBar
        locale={locale}
        currentUser={currentUser}
        roleProfile={roleProfile}
        onRoleChange={onRoleChange}
        onSignOut={onSignOut}
      />
      <div className="mt-5 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          className="h-9 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800 hover:bg-slate-50"
        >
          {t(locale, "backToProjects")}
        </button>
      </div>

      <section className="mt-5 rounded-lg border border-slate-200 bg-white p-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase text-slate-500">{t(locale, "userManagement")}</p>
            <h1 className="mt-1 text-3xl font-semibold text-slate-950">{t(locale, "applicationUsers")}</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">{t(locale, "userManagementHint")}</p>
          </div>
          <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">
            {users.length} {t(locale, "users")}
          </span>
        </div>

        <div className="mt-6 grid gap-2 lg:grid-cols-[1fr_1fr_11rem_10rem_12rem_auto]">
          <input
            value={newUser.name}
            onChange={(event) => setNewUser((current) => ({ ...current, name: event.target.value }))}
            placeholder={t(locale, "name")}
            className="h-10 rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-slate-700"
          />
          <input
            value={newUser.email}
            onChange={(event) => setNewUser((current) => ({ ...current, email: event.target.value }))}
            placeholder={t(locale, "email")}
            className="h-10 rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-slate-700"
          />
          <input
            value={newUser.password}
            onChange={(event) => setNewUser((current) => ({ ...current, password: event.target.value }))}
            type="password"
            placeholder={t(locale, "password")}
            className="h-10 rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-slate-700"
          />
          <AdminToggle
            locale={locale}
            checked={newUser.isAdmin}
            onChange={(isAdmin) => setNewUser((current) => ({ ...current, isAdmin }))}
          />
          <AreaSelect
            locale={locale}
            value={newUser.areaId}
            areas={areas}
            onChange={(areaId) => setNewUser((current) => ({ ...current, areaId }))}
          />
          <button
            type="button"
            onClick={createUser}
            className="h-10 rounded-md bg-slate-950 px-4 text-sm font-semibold text-white hover:bg-slate-800"
          >
            {t(locale, "createUser")}
          </button>
        </div>

        <div className="mt-5 grid gap-2">
          {users.map((user) => {
            const draft = editableUser(user);
            return (
              <article key={user.id} className="grid gap-2 rounded-lg border border-slate-200 p-3 lg:grid-cols-[1fr_1fr_10rem_12rem_auto]">
                <input
                  value={draft.name}
                  onChange={(event) =>
                    setEditingUsers((current) => ({
                      ...current,
                      [user.id]: { ...draft, name: event.target.value },
                    }))
                  }
                  className="h-10 rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-slate-700"
                />
                <input
                  value={draft.email}
                  onChange={(event) =>
                    setEditingUsers((current) => ({
                      ...current,
                      [user.id]: { ...draft, email: event.target.value },
                    }))
                  }
                  className="h-10 rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-slate-700"
                />
                <AdminToggle
                  locale={locale}
                  checked={draft.isAdmin}
                  onChange={(isAdmin) =>
                    setEditingUsers((current) => ({
                      ...current,
                      [user.id]: { ...draft, isAdmin },
                    }))
                  }
                />
                <AreaSelect
                  locale={locale}
                  value={draft.areaId}
                  areas={areas}
                  onChange={(areaId) =>
                    setEditingUsers((current) => ({
                      ...current,
                      [user.id]: { ...draft, areaId },
                    }))
                  }
                />
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => saveUser(user)}
                    className="h-10 rounded-md border border-slate-300 px-3 text-sm font-semibold text-slate-800 hover:bg-slate-50"
                  >
                    {t(locale, "save")}
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeleteUser(user.id)}
                    disabled={user.id === currentUser.id}
                    className="h-10 rounded-md border border-rose-200 px-3 text-sm font-semibold text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {t(locale, "delete")}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function AdminToggle({
  locale,
  checked,
  onChange,
}: {
  locale: Locale;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex h-10 items-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="h-4 w-4" />
      {t(locale, "platformAdmin")}
    </label>
  );
}

function AreaSelect({
  locale,
  value,
  areas,
  onChange,
}: {
  locale: Locale;
  value: string;
  areas: MunicipalArea[];
  onChange: (areaId: string) => void;
}) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-slate-700"
    >
      <option value="">{t(locale, "withoutArea")}</option>
      {areas.map((area) => (
        <option key={area.id} value={area.id}>
          {area.parentAreaName ? `${area.parentAreaName} / ${area.name}` : area.name}
        </option>
      ))}
    </select>
  );
}

function AdminAreasView({
  locale,
  currentUser,
  roleProfile,
  areas,
  onBack,
  onCreateArea,
  onRoleChange,
  onSignOut,
}: {
  locale: Locale;
  currentUser: User;
  roleProfile: RoleProfile;
  areas: MunicipalArea[];
  onBack: () => void;
  onCreateArea: (data: { name: string; code: string; description: string; parentAreaId: string }) => void | Promise<void>;
  onRoleChange: (role: UserRole) => void;
  onSignOut: () => void;
}) {
  const [newArea, setNewArea] = useState({ name: "", code: "", description: "", parentAreaId: "" });

  async function createArea() {
    if (!newArea.name.trim()) {
      return;
    }

    await onCreateArea({
      name: newArea.name.trim(),
      code: newArea.code.trim(),
      description: newArea.description.trim(),
      parentAreaId: newArea.parentAreaId,
    });
    setNewArea({ name: "", code: "", description: "", parentAreaId: "" });
  }

  const rootAreas = areas.filter((area) => !area.parentAreaId);

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 py-5 lg:px-6">
      <TopBar
        locale={locale}
        currentUser={currentUser}
        roleProfile={roleProfile}
        onRoleChange={onRoleChange}
        onSignOut={onSignOut}
      />
      <div className="mt-5">
        <button
          type="button"
          onClick={onBack}
          className="h-9 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800 hover:bg-slate-50"
        >
          {t(locale, "backToProjects")}
        </button>
      </div>

      <section className="rx-card mt-5 p-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase text-slate-500">{t(locale, "municipalStructure")}</p>
            <h1 className="mt-1 text-3xl font-semibold text-slate-950">{t(locale, "municipalAreas")}</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">{t(locale, "municipalAreasHint")}</p>
          </div>
          <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">
            {areas.length} {t(locale, "areas")}
          </span>
        </div>

        <div className="mt-6 grid gap-2 lg:grid-cols-[1fr_8rem_1fr_14rem_auto]">
          <input
            value={newArea.name}
            onChange={(event) => setNewArea((current) => ({ ...current, name: event.target.value }))}
            placeholder={t(locale, "areaName")}
            className="h-10 rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-slate-700"
          />
          <input
            value={newArea.code}
            onChange={(event) => setNewArea((current) => ({ ...current, code: event.target.value }))}
            placeholder={t(locale, "areaCode")}
            className="h-10 rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-slate-700"
          />
          <input
            value={newArea.description}
            onChange={(event) => setNewArea((current) => ({ ...current, description: event.target.value }))}
            placeholder={t(locale, "description")}
            className="h-10 rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-slate-700"
          />
          <AreaSelect
            locale={locale}
            value={newArea.parentAreaId}
            areas={areas}
            onChange={(parentAreaId) => setNewArea((current) => ({ ...current, parentAreaId }))}
          />
          <button
            type="button"
            onClick={createArea}
            className="h-10 rounded-md bg-slate-950 px-4 text-sm font-semibold text-white hover:bg-slate-800"
          >
            {t(locale, "createArea")}
          </button>
        </div>

        <div className="mt-6 grid gap-3">
          {areas.length === 0 ? (
            <p className="rounded-lg border border-dashed border-slate-300 p-4 text-sm text-slate-500">
              {t(locale, "noAreas")}
            </p>
          ) : (
            rootAreas.map((area) => <AreaTreeItem key={area.id} area={area} areas={areas} />)
          )}
        </div>
      </section>
    </div>
  );
}

function AreaTreeItem({ area, areas, depth = 0 }: { area: MunicipalArea; areas: MunicipalArea[]; depth?: number }) {
  const children = areas.filter((item) => item.parentAreaId === area.id);

  return (
    <div className="grid gap-2" style={{ marginLeft: depth * 18 }}>
      <div className="rounded-lg border border-slate-200 bg-white p-3">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-semibold text-slate-950">{area.name}</h3>
          {area.code && <span className="rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-600">{area.code}</span>}
        </div>
        {area.description && <p className="mt-2 text-sm leading-5 text-slate-600">{area.description}</p>}
      </div>
      {children.map((child) => (
        <AreaTreeItem key={child.id} area={child} areas={areas} depth={depth + 1} />
      ))}
    </div>
  );
}

function AdminTemplatesView({
  locale,
  currentUser,
  roleProfile,
  templates,
  integrationMode,
  onBack,
  onToggleTemplate,
  onDuplicateTemplate,
  onRoleChange,
  onSignOut,
}: {
  locale: Locale;
  currentUser: User;
  roleProfile: RoleProfile;
  templates: InstitutionalInterviewTemplate[];
  integrationMode: IntegrationMode;
  onBack: () => void;
  onToggleTemplate: (templateId: string, active: boolean) => void | Promise<void>;
  onDuplicateTemplate: (templateId: string) => void | Promise<void>;
  onRoleChange: (role: UserRole) => void;
  onSignOut: () => void;
}) {
  const [selectedTemplateId, setSelectedTemplateId] = useState(templates[0]?.id ?? "");
  const selectedTemplate = templates.find((template) => template.id === selectedTemplateId) ?? templates[0];
  const activeCount = templates.filter((template) => template.active !== false).length;

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 py-5 lg:px-6">
      <TopBar
        locale={locale}
        currentUser={currentUser}
        roleProfile={roleProfile}
        onRoleChange={onRoleChange}
        onSignOut={onSignOut}
      />
      <div className="mt-5">
        <button
          type="button"
          onClick={onBack}
          className="h-9 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800 hover:bg-slate-50"
        >
          {t(locale, "backToProjects")}
        </button>
      </div>

      <section className="rx-card mt-5 p-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase text-slate-500">Plantillas institucionales</p>
            <h1 className="mt-1 text-3xl font-semibold text-slate-950">Gestionar plantillas</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              Revisa las guias que usa el Mediador para adaptar la entrevista al tipo de pedido municipal.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">
              {activeCount}/{templates.length} activas
            </span>
            <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">
              {integrationMode === "pocketbase" ? "PocketBase" : "Fallback local"}
            </span>
          </div>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(18rem,0.8fr)_minmax(0,1.2fr)]">
          <div className="grid content-start gap-2">
            {templates.length === 0 ? (
              <p className="rounded-lg border border-dashed border-slate-300 p-4 text-sm text-slate-500">
                Todavia no hay plantillas disponibles.
              </p>
            ) : (
              templates.map((template) => (
                <button
                  key={template.id}
                  type="button"
                  onClick={() => setSelectedTemplateId(template.id)}
                  className={`rounded-lg border p-3 text-left ${
                    template.id === selectedTemplate?.id
                      ? "border-slate-950 bg-slate-950 text-white"
                      : "border-slate-200 bg-white text-slate-800 hover:border-slate-400"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold">{template.title}</p>
                      <p className={`mt-1 text-xs ${template.id === selectedTemplate?.id ? "text-white/70" : "text-slate-500"}`}>
                        {template.id}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 rounded-md px-2 py-1 text-xs font-semibold ${
                        template.active === false
                          ? "bg-amber-100 text-amber-800"
                          : template.id === selectedTemplate?.id
                            ? "bg-white/15 text-white"
                            : "bg-emerald-100 text-emerald-800"
                      }`}
                    >
                      {template.active === false ? "Inactiva" : "Activa"}
                    </span>
                  </div>
                </button>
              ))
            )}
          </div>

          {selectedTemplate && (
            <article className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase text-slate-500">{selectedTemplate.id}</p>
                  <h2 className="mt-1 text-2xl font-semibold text-slate-950">{selectedTemplate.title}</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{selectedTemplate.description}</p>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => onDuplicateTemplate(selectedTemplate.id)}
                    className="h-9 rounded-md border border-slate-300 px-3 text-sm font-semibold text-slate-800 hover:bg-slate-50"
                  >
                    Duplicar
                  </button>
                  <button
                    type="button"
                    onClick={() => onToggleTemplate(selectedTemplate.id, selectedTemplate.active === false)}
                    className={`h-9 rounded-md px-3 text-sm font-semibold ${
                      selectedTemplate.active === false
                        ? "bg-slate-950 text-white hover:bg-slate-800"
                        : "border border-amber-200 text-amber-800 hover:bg-amber-50"
                    }`}
                  >
                    {selectedTemplate.active === false ? "Activar" : "Desactivar"}
                  </button>
                </div>
              </div>

              <dl className="mt-5 grid gap-3 md:grid-cols-2">
                <TemplateFact label="Proyecto sugerido" value={selectedTemplate.projectName} />
                <TemplateFact label="Area solicitante" value={selectedTemplate.institutionalRequest.requestingArea || "Sin definir"} />
                <TemplateFact label="Area receptora" value={selectedTemplate.institutionalRequest.receivingArea || "Modernizacion"} />
                <TemplateFact label="Confirmacion" value={selectedTemplate.confirmationArea} />
              </dl>

              <section className="mt-5">
                <h3 className="text-sm font-semibold uppercase text-slate-500">Bloques de entrevista</h3>
                <div className="mt-3 grid gap-3">
                  {selectedTemplate.blocks.map((block, index) => (
                    <div key={block.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="flex h-6 w-6 items-center justify-center rounded-md bg-slate-950 text-xs font-semibold text-white">
                          {index + 1}
                        </span>
                        <h4 className="text-sm font-semibold text-slate-950">{block.title}</h4>
                      </div>
                      <p className="mt-2 text-sm leading-6 text-slate-600">{block.goal}</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {block.keywords.map((keyword) => (
                          <span key={keyword} className="rounded-md bg-white px-2 py-1 text-xs text-slate-600">
                            {keyword}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </article>
          )}
        </div>
      </section>
    </div>
  );
}

function TemplateFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
      <dt className="text-xs font-semibold uppercase text-slate-500">{label}</dt>
      <dd className="mt-1 text-sm font-medium text-slate-900">{value}</dd>
    </div>
  );
}

function ProjectParticipantsSelector({
  locale,
  participants,
  users,
  canManage,
  onChange,
}: {
  locale: Locale;
  participants: ProjectParticipant[];
  users: User[];
  canManage: boolean;
  onChange: (participants: ProjectParticipant[]) => void | Promise<void>;
}) {
  const assignedUserIds = new Set(participants.map((participant) => participant.userId));
  const [pendingRoles, setPendingRoles] = useState<Record<string, ProjectRole>>({});

  function toggleUser(user: User) {
    const selectedRole = pendingRoles[user.id] ?? "stakeholder";
    const participant: ProjectParticipant = {
      userId: user.id,
      name: user.name,
      email: user.email,
      role: selectedRole,
      areaId: user.areaId,
      areaName: user.areaName,
    };

    if (assignedUserIds.has(user.id)) {
      onChange(participants.filter((item) => item.userId !== user.id));
      return;
    }

    onChange([...participants, participant]);
  }

  function updateParticipantRole(user: User, role: ProjectRole) {
    setPendingRoles((current) => ({ ...current, [user.id]: role }));

    if (!assignedUserIds.has(user.id)) {
      return;
    }

    onChange(
      participants.map((participant) =>
        participant.userId === user.id
          ? {
              ...participant,
              role,
              name: user.name,
              email: user.email,
              areaId: user.areaId,
              areaName: user.areaName,
            }
          : participant,
      ),
    );
  }

  return (
    <section>
      <p className="text-sm leading-6 text-slate-600">{t(locale, "intakeParticipantsHint")}</p>
      {participants.length === 0 ? (
        <p className="mt-5 rounded-lg border border-dashed border-slate-300 p-4 text-sm text-slate-500">
          {t(locale, "noParticipantsAssigned")}
        </p>
      ) : (
        <div className="mt-5 flex flex-wrap gap-2">
          {participants.map((participant) => (
            <span key={participant.userId} className="rounded-md bg-slate-100 px-3 py-2 text-sm text-slate-700">
              {participant.name} - {t(locale, roleLabelKey[participant.role])}
            </span>
          ))}
        </div>
      )}

      {canManage && (
        <div className="mt-5 grid gap-2 sm:grid-cols-2">
          {users.map((user) => {
            const assignedParticipant = participants.find((participant) => participant.userId === user.id);
            const assigned = Boolean(assignedParticipant);
            const projectRole = pendingRoles[user.id] ?? assignedParticipant?.role ?? "stakeholder";
            return (
              <article
                key={user.id}
                className={`rounded-md border px-3 py-3 text-left text-sm ${
                  assigned
                    ? "border-slate-900 bg-slate-950 text-white"
                    : "border-slate-200 bg-white text-slate-700 hover:border-slate-400"
                }`}
              >
                <span className="block font-semibold">{user.name}</span>
                <span className={`mt-1 block text-xs ${assigned ? "text-white/70" : "text-slate-500"}`}>
                  {user.email}
                </span>
                <span className={`mt-1 block text-xs ${assigned ? "text-white/70" : "text-slate-500"}`}>
                  {user.areaName || t(locale, "withoutArea")}
                </span>
                <label className={`mt-3 grid gap-1 text-xs font-semibold uppercase ${assigned ? "text-white/70" : "text-slate-500"}`}>
                  {t(locale, "projectRole")}
                  <select
                    value={projectRole}
                    onChange={(event) => updateParticipantRole(user, event.target.value as ProjectRole)}
                    className={`h-9 rounded-md border px-2 text-sm normal-case ${
                      assigned ? "border-white/20 bg-white/10 text-white" : "border-slate-300 bg-white text-slate-900"
                    }`}
                  >
                    {projectAssignmentRoles.map((role) => (
                      <option key={role} value={role} className="text-slate-900">
                        {t(locale, roleLabelKey[role])}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  onClick={() => toggleUser(user)}
                  className={`mt-3 h-9 w-full rounded-md px-3 text-sm font-semibold ${
                    assigned ? "border border-white/25 text-white hover:bg-white/10" : "bg-slate-950 text-white hover:bg-slate-800"
                  }`}
                >
                  {assigned ? t(locale, "removeFromProject") : t(locale, "assignToProject")}
                </button>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

function RoleHomePanel({
  locale,
  currentUser,
  roleProfile,
  projects,
  onCreate,
  onManageUsers,
  onOpen,
}: {
  locale: Locale;
  currentUser: User;
  roleProfile: RoleProfile;
  projects: Project[];
  onCreate: () => void;
  onManageUsers?: () => void;
  onOpen: (projectId: string) => void;
}) {
  const copy = roleHomeCopy[currentUser.role];
  const recommendedProject = projects[0];
  const enabledPermissionCount = permissionLabels.filter(([permission]) => roleProfile.permissions[permission]).length;

  return (
    <section className="mt-8 grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <div className={`rounded-lg bg-gradient-to-br ${copy.accent} p-5 text-white md:p-6`}>
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase text-white/70">{t(locale, "roleWorkspace")}</p>
            <h1 className="mt-3 max-w-3xl text-3xl font-semibold leading-tight tracking-normal md:text-4xl">
              {t(locale, copy.title)}
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-white/80">{t(locale, copy.subtitle)}</p>
          </div>
          <div className="rounded-lg bg-white/10 p-3 text-sm backdrop-blur">
            <p className="font-semibold">{currentUser.name}</p>
            <p className="mt-1 text-white/70">{t(locale, roleLabelKey[currentUser.role])}</p>
          </div>
        </div>

        <div className="mt-8 grid gap-3 md:grid-cols-3">
          <RoleMetric label={t(locale, "activeProjects")} value={`${projects.length}`} />
          <RoleMetric label={t(locale, "availableRoles")} value={`${roleProfiles.length}`} />
          <RoleMetric label={t(locale, "governedPermissions")} value={`${enabledPermissionCount}/${permissionLabels.length}`} />
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          {roleProfile.permissions.createProjects && (
            <button
              type="button"
              onClick={onCreate}
              className="h-10 rounded-md bg-white px-4 text-sm font-semibold text-slate-950 hover:bg-slate-100"
            >
              {t(locale, "createProject")}
            </button>
          )}
          {onManageUsers && (
            <button
              type="button"
              onClick={onManageUsers}
              className="h-10 rounded-md border border-white/40 px-4 text-sm font-semibold text-white hover:bg-white/10"
            >
              {t(locale, "manageUsers")}
            </button>
          )}
          {recommendedProject && (
            <button
              type="button"
              onClick={() => onOpen(recommendedProject.id)}
              className="h-10 rounded-md border border-white/40 px-4 text-sm font-semibold text-white hover:bg-white/10"
            >
              {t(locale, "openRecommended")}
            </button>
          )}
        </div>
      </div>

      <aside className="grid gap-4">
        <section className="rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-semibold uppercase text-slate-500">{t(locale, "roleFocus")}</h2>
          <div className="mt-4 grid gap-2">
            {copy.focus.map((item, index) => (
              <div key={item} className="flex gap-3 rounded-md bg-slate-50 p-3 text-sm text-slate-700">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-slate-950 text-xs font-semibold text-white">
                  {index + 1}
                </span>
                <span>{t(locale, item)}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-semibold uppercase text-slate-500">{t(locale, "permissions")}</h2>
          <PermissionList locale={locale} profile={roleProfile} />
        </section>
      </aside>

      <div className="xl:col-span-2">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase text-slate-500">{t(locale, "portfolio")}</p>
            <h2 className="mt-1 text-2xl font-semibold text-slate-950">{t(locale, "projects")}</h2>
          </div>
          {!roleProfile.permissions.createProjects && (
            <p className="text-sm text-slate-500">{t(locale, "restrictedAction")}: {t(locale, "createProject")}</p>
          )}
        </div>
      </div>
    </section>
  );
}

function RoleMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-white/10 p-3">
      <p className="text-xs font-semibold uppercase text-white/60">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-white">{value}</p>
    </div>
  );
}

function CreateProjectView({
  locale,
  currentUser,
  roleProfile,
  users,
  areas,
  templates,
  draft,
  chatInput,
  setChatInput,
  onBack,
  onRoleChange,
  onChange,
  onInstitutionalRequestChange,
  onApplyInstitutionalTemplate,
  onParticipantsChange,
  onFiles,
  onSend,
  onCreate,
}: {
  locale: Locale;
  currentUser: User;
  roleProfile: RoleProfile;
  users: User[];
  areas: MunicipalArea[];
  templates: InstitutionalInterviewTemplate[];
  draft: DraftProject;
  chatInput: string;
  setChatInput: (value: string) => void;
  onBack: () => void;
  onRoleChange: (role: UserRole) => void;
  onChange: (field: keyof Pick<DraftProject, "name" | "areaId" | "problem">, value: string) => void;
  onInstitutionalRequestChange: (field: keyof InstitutionalRequest, value: string) => void;
  onApplyInstitutionalTemplate: (templateId: string) => void;
  onParticipantsChange: (participants: ProjectParticipant[]) => void | Promise<void>;
  onFiles: (files: FileList | null) => void | Promise<void>;
  onSend: () => void;
  onCreate: () => void;
}) {
  const [currentStep, setCurrentStep] = useState(0);
  const selectedArea = areas.find((area) => area.id === draft.areaId);
  const sortedAreas = [...areas].sort((a, b) => {
    const aLabel = a.parentAreaName ? `${a.parentAreaName} / ${a.name}` : a.name;
    const bLabel = b.parentAreaName ? `${b.parentAreaName} / ${b.name}` : b.name;
    return aLabel.localeCompare(bLabel, locale, { sensitivity: "base" });
  });
  const selectedAreaLabel = selectedArea?.parentAreaName
    ? `${selectedArea.parentAreaName} / ${selectedArea.name}`
    : selectedArea?.name;
  const brief = {
    name: draft.name || "Proyecto sin nombre",
    organization: selectedAreaLabel || "Area por definir",
    problem: draft.problem || "Problema inicial pendiente",
    request: draft.institutionalRequest.requestedAction || "Solicitud institucional pendiente",
    stakeholders:
      draft.participants
        .filter((participant) => participant.role === "stakeholder")
        .map((participant) => participant.name)
        .join(", ") || "Actores pendientes",
  };
  const canAssignParticipants = currentUser.isAdmin;
  const steps = [
    {
      key: "request",
      label: "Solicitud",
      title: "Como nace el pedido institucional?",
    },
    {
      key: "name",
      label: t(locale, "projectName"),
      title: t(locale, "intakeStepName"),
    },
    {
      key: "area",
      label: t(locale, "organization"),
      title: t(locale, "intakeStepOrganization"),
    },
    {
      key: "problem",
      label: t(locale, "problem"),
      title: t(locale, "intakeStepProblem"),
    },
    ...(canAssignParticipants
      ? [
          {
            key: "participants",
            label: t(locale, "projectParticipants"),
            title: t(locale, "intakeStepParticipants"),
          },
        ]
      : []),
    {
      key: "files",
      label: t(locale, "attachedFiles"),
      title: t(locale, "intakeStepFiles"),
    },
    {
      key: "review",
      label: t(locale, "review"),
      title: t(locale, "intakeStepReview"),
    },
  ];
  const progress = ((currentStep + 1) / steps.length) * 100;
  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === steps.length - 1;

  function goNext() {
    setCurrentStep((step) => Math.min(step + 1, steps.length - 1));
  }

  function goPrevious() {
    setCurrentStep((step) => Math.max(step - 1, 0));
  }

  function renderStep() {
    const stepKey = steps[currentStep].key;

    if (stepKey === "request") {
      return (
        <InstitutionalRequestIntake
          request={draft.institutionalRequest}
          onChange={onInstitutionalRequestChange}
          templates={templates.filter((template) => template.active !== false)}
          onApplyTemplate={onApplyInstitutionalTemplate}
        />
      );
    }

    if (stepKey === "name") {
      return (
        <TypeformTextInput
          autoFocus
          label={t(locale, "projectName")}
          value={draft.name}
          onChange={(value) => onChange("name", value)}
          placeholder="Sistema de gestion de reclamos ciudadanos"
        />
      );
    }

    if (stepKey === "area") {
      return (
        <label className="grid gap-3">
          <span className="text-sm font-semibold uppercase text-slate-500">{t(locale, "organization")}</span>
          <select
            autoFocus
            value={draft.areaId}
            onChange={(event) => onChange("areaId", event.target.value)}
            className="w-full border-0 border-b-2 border-slate-300 bg-transparent px-0 py-3 text-2xl font-medium leading-9 text-slate-950 outline-none focus:border-slate-900"
          >
            <option value="">{areas.length === 0 ? t(locale, "noAreas") : t(locale, "selectArea")}</option>
            {sortedAreas.map((area) => (
              <option key={area.id} value={area.id}>
                {area.parentAreaName ? `${area.parentAreaName} / ${area.name}` : area.name}
              </option>
            ))}
          </select>
        </label>
      );
    }

    if (stepKey === "problem") {
      return (
        <label className="grid gap-3">
          <span className="text-sm font-semibold uppercase text-slate-500">{t(locale, "problem")}</span>
          <textarea
            autoFocus
            value={draft.problem}
            onChange={(event) => onChange("problem", event.target.value)}
            rows={6}
            placeholder="Describe la situacion actual, el dolor principal y por que conviene iniciar el trabajo de requisitos."
            className="w-full resize-none border-0 border-b-2 border-slate-300 bg-transparent px-0 py-3 text-2xl font-medium leading-9 text-slate-950 outline-none placeholder:text-slate-300 focus:border-slate-900"
          />
        </label>
      );
    }

    if (stepKey === "participants") {
      return (
        <ProjectParticipantsSelector
          locale={locale}
          participants={draft.participants}
          users={users}
          canManage={canAssignParticipants}
          onChange={onParticipantsChange}
        />
      );
    }

    if (stepKey === "files") {
      return (
        <div>
          <label className="grid gap-3 text-sm font-semibold uppercase text-slate-500">
            {t(locale, "attachFiles")}
            <input
              type="file"
              multiple
              onChange={(event) => onFiles(event.target.files)}
              className="block w-full text-base normal-case text-slate-600 file:mr-4 file:h-11 file:rounded-md file:border-0 file:bg-slate-950 file:px-4 file:text-sm file:font-semibold file:text-white"
            />
          </label>
          <div className="mt-5 grid gap-2">
            {draft.documents.length === 0 ? (
              <p className="rounded-lg border border-dashed border-slate-300 p-4 text-sm text-slate-500">
                {t(locale, "noFiles")}
              </p>
            ) : (
              draft.documents.map((document) => (
                <div key={document.id} className="rounded-lg border border-slate-200 bg-white p-3 text-sm">
                  <p className="font-medium text-slate-900">{document.name}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {document.type} - {fileSizeLabel(document.size)}
                  </p>
                  <DocumentIndexingBadge document={document} locale={locale} />
                </div>
              ))
            )}
          </div>
        </div>
      );
    }

    return (
      <div>
        <p className="text-sm leading-6 text-slate-600">{t(locale, "briefHint")}</p>
        <dl className="mt-5 grid gap-3">
          <LayerFact label={t(locale, "projectName")} value={brief.name} />
          <LayerFact label="Solicitud institucional" value={brief.request} />
          <LayerFact label={t(locale, "organization")} value={brief.organization} />
          <LayerFact label={t(locale, "problem")} value={brief.problem} />
          <LayerFact label={t(locale, "stakeholders")} value={brief.stakeholders} />
          <LayerFact label={t(locale, "projectParticipants")} value={`${draft.participants.length}`} />
          <LayerFact label={t(locale, "attachedFiles")} value={`${draft.documents.length}`} />
        </dl>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 py-5 lg:px-6">
      <TopBar
        locale={locale}
        currentUser={currentUser}
        roleProfile={roleProfile}
        onRoleChange={onRoleChange}
      />
      <div className="mt-5 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          className="h-9 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800 hover:bg-slate-50"
        >
          {t(locale, "backToProjects")}
        </button>
        <span className="text-sm font-medium text-slate-500">
          {t(locale, "stepOf")} {currentStep + 1} / {steps.length}
        </span>
      </div>

      <div className="mt-5 h-2 rounded-full bg-slate-200">
        <div className="h-2 rounded-full bg-slate-950 transition-all" style={{ width: `${progress}%` }} />
      </div>

      <section className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="flex min-h-[34rem] flex-col justify-between rounded-lg border border-slate-200 bg-white p-5 md:p-8">
          <div>
            <p className="text-sm font-semibold uppercase text-slate-500">{t(locale, "newProject")}</p>
            <h1 className="mt-4 max-w-3xl text-3xl font-semibold leading-tight tracking-normal text-slate-950 md:text-4xl">
              {steps[currentStep].title}
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-600">{t(locale, "typeformHint")}</p>

            <div className="mt-10 max-w-3xl">{renderStep()}</div>
          </div>

          <div className="mt-8 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={goPrevious}
              disabled={isFirstStep}
              className="h-10 rounded-md border border-slate-300 px-4 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {t(locale, "previous")}
            </button>
            {isLastStep ? (
              <button
                type="button"
                onClick={onCreate}
                className="h-10 rounded-md bg-slate-950 px-5 text-sm font-semibold text-white hover:bg-slate-800"
              >
                {t(locale, "startWorkspace")}
              </button>
            ) : (
              <button
                type="button"
                onClick={goNext}
                className="h-10 rounded-md bg-slate-950 px-5 text-sm font-semibold text-white hover:bg-slate-800"
              >
                {t(locale, "next")}
              </button>
            )}
          </div>
        </div>

        <aside className="grid content-start gap-4">
          <section className="rounded-lg border border-slate-200 bg-white p-4">
            <h2 className="text-sm font-semibold uppercase text-slate-500">{t(locale, "projectBrief")}</h2>
            <div className="mt-4 grid gap-2">
              {steps.map((step, index) => (
                <button
                  key={step.key}
                  type="button"
                  onClick={() => setCurrentStep(index)}
                  className={`rounded-md border px-3 py-2 text-left text-sm ${
                    index === currentStep
                      ? "border-slate-950 bg-slate-950 text-white"
                      : "border-slate-200 bg-white text-slate-700 hover:border-slate-400"
                  }`}
                >
                  <span className="text-xs opacity-70">{String(index + 1).padStart(2, "0")}</span>
                  <span className="ml-2 font-semibold">{step.label}</span>
                </button>
              ))}
            </div>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-4">
            <h2 className="text-sm font-semibold uppercase text-slate-500">{t(locale, "intakeChat")}</h2>
            <p className="mt-2 text-xs leading-5 text-slate-500">{t(locale, "creationHint")}</p>
            <div className="mt-4 grid max-h-56 gap-2 overflow-auto pr-1">
              {draft.messages.map((message) => (
                <div
                  key={message.id}
                  className={`rounded-lg px-3 py-2 text-xs leading-5 ${
                    message.role === "analyst"
                      ? "bg-slate-950 text-white"
                      : "bg-slate-100 text-slate-700"
                  }`}
                >
                  <p className="text-xs font-semibold uppercase opacity-70">{message.role}</p>
                  <p>{message.body}</p>
                </div>
              ))}
            </div>
            <label className="mt-4 grid gap-2 text-xs font-semibold uppercase text-slate-500">
              {t(locale, "optionalMediatorNote")}
              <input
                value={chatInput}
                onChange={(event) => setChatInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    onSend();
                  }
                }}
                placeholder={t(locale, "analystMessage")}
                className="h-10 min-w-0 rounded-md border border-slate-300 px-3 text-sm font-normal normal-case outline-none focus:border-slate-600"
              />
            </label>
            <button
              type="button"
              onClick={onSend}
              className="mt-2 h-9 w-full rounded-md border border-slate-300 px-3 text-sm font-semibold text-slate-800 hover:bg-slate-50"
            >
              {t(locale, "send")}
            </button>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-4">
            <h2 className="text-sm font-semibold uppercase text-slate-500">{t(locale, "attachedFiles")}</h2>
            {draft.documents.length === 0 ? (
              <p className="mt-3 text-sm text-slate-500">{t(locale, "noFiles")}</p>
            ) : (
              <div className="mt-3 grid gap-2">
                {draft.documents.map((document) => (
                  <div key={document.id} className="rounded-md bg-slate-50 p-3 text-sm">
                    <p className="font-medium text-slate-900">{document.name}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {document.type} - {fileSizeLabel(document.size)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </section>
        </aside>
      </section>
    </div>
  );
}

function TypeformTextInput({
  label,
  value,
  onChange,
  placeholder,
  autoFocus = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  autoFocus?: boolean;
}) {
  return (
    <label className="grid gap-3">
      <span className="text-sm font-semibold uppercase text-slate-500">{label}</span>
      <input
        autoFocus={autoFocus}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full border-0 border-b-2 border-slate-300 bg-transparent px-0 py-3 text-2xl font-medium text-slate-950 outline-none placeholder:text-slate-300 focus:border-slate-900"
      />
    </label>
  );
}

function InstitutionalRequestIntake({
  request,
  onChange,
  templates,
  onApplyTemplate,
}: {
  request: InstitutionalRequest;
  onChange: (field: keyof InstitutionalRequest, value: string) => void;
  templates: InstitutionalInterviewTemplate[];
  onApplyTemplate: (templateId: string) => void;
}) {
  return (
    <div className="grid gap-5">
      <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-emerald-950">
        <p className="text-xs font-semibold uppercase text-emerald-700">Plantillas institucionales</p>
        <h2 className="mt-1 text-lg font-semibold">Elegir guia inicial</h2>
        <p className="mt-2 text-sm leading-6">
          Cada plantilla adapta la entrevista del Mediador al tipo de pedido, sin cerrar la herramienta a un unico dominio.
        </p>
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {templates.map((template) => {
            const isActive = request.templateId === template.id;

            return (
              <article
                key={template.id}
                className={`rounded-lg border bg-white p-4 ${
                  isActive ? "border-emerald-700 ring-2 ring-emerald-200" : "border-emerald-100"
                }`}
              >
                <div className="flex h-full flex-col gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-emerald-950">{template.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-emerald-800">{template.description}</p>
                  </div>
                  <button
                    type="button"
                    aria-label={`Usar plantilla ${template.title}`}
                    onClick={() => onApplyTemplate(template.id)}
                    className="mt-auto h-9 self-start rounded-md bg-emerald-900 px-3 text-sm font-semibold text-white hover:bg-emerald-800"
                  >
                    Usar plantilla
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <TypeformTextInput
          label="Area solicitante"
          value={request.requestingArea}
          onChange={(value) => onChange("requestingArea", value)}
          placeholder="Secretaria de Salud"
        />
        <TypeformTextInput
          label="Area receptora"
          value={request.receivingArea}
          onChange={(value) => onChange("receivingArea", value)}
          placeholder="Direccion de Modernizacion"
        />
      </div>
      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_12rem]">
        <TypeformTextInput
          label="Referente"
          value={request.contactPerson}
          onChange={(value) => onChange("contactPerson", value)}
          placeholder="Nombre del referente de Salud"
        />
        <label className="grid gap-3">
          <span className="text-sm font-semibold uppercase text-slate-500">Urgencia</span>
          <select
            value={request.urgency}
            onChange={(event) => onChange("urgency", event.target.value)}
            className="w-full border-0 border-b-2 border-slate-300 bg-transparent px-0 py-3 text-2xl font-medium text-slate-950 outline-none focus:border-slate-900"
          >
            <option value="low">Baja</option>
            <option value="medium">Media</option>
            <option value="high">Alta</option>
          </select>
        </label>
      </div>
      <label className="grid gap-3">
        <span className="text-sm font-semibold uppercase text-slate-500">Accion solicitada</span>
        <textarea
          value={request.requestedAction}
          onChange={(event) => onChange("requestedAction", event.target.value)}
          rows={3}
          placeholder="Realizar un relevamiento sanitario a alumnos de escuelas municipales."
          className="w-full resize-none border-0 border-b-2 border-slate-300 bg-transparent px-0 py-3 text-2xl font-medium leading-9 text-slate-950 outline-none placeholder:text-slate-300 focus:border-slate-900"
        />
      </label>
      <TypeformTextInput
        label="Poblacion objetivo"
        value={request.targetPopulation}
        onChange={(value) => onChange("targetPopulation", value)}
        placeholder="Alumnos de escuelas municipales"
      />
    </div>
  );
}

function ProjectPhasesView({
  locale,
  currentUser,
  roleProfile,
  project,
  runtime,
  users,
  onBack,
  onOpenLayer,
  onParticipantsChange,
  onFiles,
  onDeleteDocument,
  documentError,
  onRoleChange,
  onSignOut,
}: {
  locale: Locale;
  currentUser: User;
  roleProfile: RoleProfile;
  project: Project;
  runtime: ProjectRuntime;
  users: User[];
  onBack: () => void;
  onOpenLayer: (layerId: LayerId) => void;
  onParticipantsChange: (participants: ProjectParticipant[]) => void | Promise<void>;
  onFiles: (files: FileList | null) => void | Promise<void>;
  onDeleteDocument: (document: AttachedDocument) => void | Promise<void>;
  documentError: string;
  onRoleChange: (role: UserRole) => void;
  onSignOut: () => void;
}) {
  const [isManagingDocuments, setIsManagingDocuments] = useState(false);
  const generatedLayerIds = new Set(runtime.artifacts.map((artifact) => artifact.layerId));
  const projectArtifacts = runtime.artifacts.length;
  const projectRisks = runtime.risks.length;
  const projectTraces = runtime.traces.length;
  const isStakeholderView = currentUser.role === "stakeholder";

  if (currentUser.isAdmin) {
    return (
      <AdminProjectAssignmentsView
        locale={locale}
        currentUser={currentUser}
        roleProfile={roleProfile}
        project={project}
        users={users}
        onBack={onBack}
        onParticipantsChange={onParticipantsChange}
        onRoleChange={onRoleChange}
        onSignOut={onSignOut}
      />
    );
  }

  async function handleProjectFiles(files: FileList | null) {
    setIsManagingDocuments(true);
    try {
      await onFiles(files);
    } finally {
      setIsManagingDocuments(false);
    }
  }

  async function handleDeleteDocument(document: AttachedDocument) {
    setIsManagingDocuments(true);
    try {
      await onDeleteDocument(document);
    } finally {
      setIsManagingDocuments(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 py-5 lg:px-6">
      <TopBar
        locale={locale}
        currentUser={currentUser}
        roleProfile={roleProfile}
        onRoleChange={onRoleChange}
        onSignOut={onSignOut}
      />
      <div className="mt-5 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          className="h-9 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800 hover:bg-slate-50"
        >
          {t(locale, "backToProjects")}
        </button>
      </div>

      <section className="rx-card mt-6 overflow-hidden p-5 md:p-6">
        <div className={currentUser.role === "stakeholder" ? "grid gap-6" : "grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]"}>
          <div>
            <p className="text-sm font-semibold uppercase text-slate-500">{t(locale, "phaseMap")}</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-normal text-slate-950">{project.name}</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">{project.summary}</p>
            {project.institutionalRequest && (
              <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase text-slate-500">Solicitud institucional</p>
                <div className="mt-3 grid gap-2 text-sm leading-6 text-slate-700 md:grid-cols-2">
                  <p>
                    <span className="font-semibold text-slate-950">Solicita:</span>{" "}
                    {project.institutionalRequest.requestingArea || "Sin definir"}
                  </p>
                  <p>
                    <span className="font-semibold text-slate-950">Recibe:</span>{" "}
                    {project.institutionalRequest.receivingArea || "Modernizacion"}
                  </p>
                  <p className="md:col-span-2">
                    <span className="font-semibold text-slate-950">Accion:</span>{" "}
                    {project.institutionalRequest.requestedAction || "Pendiente"}
                  </p>
                  <p>
                    <span className="font-semibold text-slate-950">Poblacion:</span>{" "}
                    {project.institutionalRequest.targetPopulation || "Pendiente"}
                  </p>
                  <p>
                    <span className="font-semibold text-slate-950">Urgencia:</span>{" "}
                    {project.institutionalRequest.urgency}
                  </p>
                </div>
              </div>
            )}
            <div className="mt-5 flex flex-wrap gap-2">
              <span className="rounded-md bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-700">
                {project.municipality}
              </span>
              <span className="rounded-md bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-700">
                {project.documents.length} {t(locale, "attachedFiles").toLowerCase()}
              </span>
              <span className="rounded-md bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-700">
                {project.participants.length} {t(locale, "assignedUsers")}
              </span>
            </div>
          </div>
          {currentUser.role !== "stakeholder" && (
            <aside className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase text-slate-500">{t(locale, "modelPrinciples")}</p>
              <div className="mt-3 grid gap-2">
                {[t(locale, "roleDifferentiation"), t(locale, "humanControlGradient"), t(locale, "riskMonitoring")].map(
                  (item, index) => (
                    <div key={item} className="flex items-center gap-3 rounded-md bg-white px-3 py-2 text-sm text-slate-700">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-slate-950 text-xs font-semibold text-white">
                        {index + 1}
                      </span>
                      <span>{item}</span>
                    </div>
                  ),
                )}
              </div>
            </aside>
          )}
        </div>
      </section>

      <section className={`mt-5 grid gap-4 ${isStakeholderView ? "" : "xl:grid-cols-[minmax(0,1fr)_22rem]"}`}>
        <div className="rx-card p-4 md:p-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase text-slate-500">{t(locale, "artifactFlow")}</p>
              <h2 className="mt-1 text-2xl font-semibold text-slate-950">{t(locale, "projectPhases")}</h2>
            </div>
            <p className="max-w-xl text-sm leading-6 text-slate-500">{t(locale, "projectPhasesHint")}</p>
          </div>

          <div className="mt-5 grid gap-3">
          {layers.map((layer, index) => {
            const isEnabled = layer.id === "mediator";
            const isGenerated = generatedLayerIds.has(layer.id);
            return (
              <article
                key={layer.id}
                  className={`grid gap-4 rounded-lg border p-4 md:grid-cols-[3rem_minmax(0,1fr)_12rem] ${
                    isEnabled ? "border-slate-300 bg-white" : "border-slate-200 bg-slate-50 opacity-75"
                  }`}
              >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-slate-950 text-sm font-semibold text-white">
                    {index + 1}
                  </span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg font-semibold text-slate-950">{layer.phase}</h3>
                      <span
                        className={`rounded-md px-2 py-1 text-xs font-semibold ${
                          isEnabled ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        {isEnabled ? t(locale, "available") : t(locale, "comingSoon")}
                      </span>
                    </div>
                    <p className="mt-1 text-sm font-medium text-slate-700">{layer.genAiRole}</p>
                    <dl className="mt-3 grid gap-2 text-sm leading-6 text-slate-600 md:grid-cols-3">
                      <div>
                        <dt className="text-xs font-semibold uppercase text-slate-500">{t(locale, "sourceInputs")}</dt>
                        <dd>{layer.input}</dd>
                      </div>
                      <div>
                        <dt className="text-xs font-semibold uppercase text-slate-500">{t(locale, "expectedOutputs")}</dt>
                        <dd>{layer.output}</dd>
                      </div>
                      <div>
                        <dt className="text-xs font-semibold uppercase text-slate-500">{t(locale, "control")}</dt>
                        <dd>{layer.control}</dd>
                      </div>
                    </dl>
                    {!isEnabled && <p className="mt-3 text-xs text-slate-500">{t(locale, "phaseLockedHint")}</p>}
                  </div>
                  <div className="flex flex-col items-start gap-3 md:items-end">
                    <span className="text-xs font-semibold uppercase text-slate-500">
                      {isGenerated ? t(locale, "generated") : t(locale, "pending")}
                    </span>
                  <button
                    type="button"
                    onClick={() => onOpenLayer(layer.id)}
                    disabled={!isEnabled}
                    className="h-9 rounded-md bg-slate-950 px-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                  >
                      {isEnabled ? t(locale, "enterPhase") : t(locale, "comingSoon")}
                  </button>
                </div>
              </article>
            );
          })}
          </div>
        </div>

        {!isStakeholderView && (
          <aside className="grid gap-4">
            <section className="rx-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold uppercase text-slate-500">{t(locale, "projectDocuments")}</p>
                  <h2 className="mt-1 text-xl font-semibold text-slate-950">{t(locale, "knowledgeSources")}</h2>
                </div>
                <label className="h-9 cursor-pointer rounded-md bg-slate-950 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800">
                  {isManagingDocuments ? t(locale, "saving") : t(locale, "add")}
                  <input
                    type="file"
                    multiple
                    disabled={isManagingDocuments}
                    className="hidden"
                    onChange={(event) => {
                      void handleProjectFiles(event.target.files);
                      event.currentTarget.value = "";
                    }}
                  />
                </label>
              </div>
              {documentError && (
                <p className="mt-3 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
                  {documentError}
                </p>
              )}
              <div className="mt-4 grid gap-2">
                {project.documents.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-slate-300 p-3 text-sm text-slate-500">
                    {t(locale, "noFiles")}
                  </p>
                ) : (
                  project.documents.map((document) => (
                    <div key={document.id} className="rounded-lg border border-slate-200 bg-white p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-slate-950">{document.name}</p>
                          <p className="mt-1 text-xs text-slate-500">
                            {document.type} - {fileSizeLabel(document.size)}
                          </p>
                          <DocumentIndexingBadge document={document} locale={locale} />
                        </div>
                        <button
                          type="button"
                          disabled={isManagingDocuments}
                          onClick={() => void handleDeleteDocument(document)}
                          className="h-8 rounded-md border border-slate-300 px-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {t(locale, "delete")}
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>
            <section className="rx-card p-4">
              <p className="text-sm font-semibold uppercase text-slate-500">{t(locale, "reliabilityLayer")}</p>
              <h2 className="mt-1 text-xl font-semibold text-slate-950">{t(locale, "riskLayer")}</h2>
              <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                <RoomMetric label={t(locale, "artifacts")} value={`${projectArtifacts}`} />
                <RoomMetric label={t(locale, "riskFlags")} value={`${projectRisks}`} />
                <RoomMetric label={t(locale, "traceability")} value={`${projectTraces}`} />
              </div>
              <div className="mt-4 grid gap-2 text-sm leading-6 text-slate-600">
                <p>{t(locale, "confidenceScores")}</p>
                <p>{t(locale, "traceabilityIntegrity")}</p>
                <p>{t(locale, "auditTrailLabel")}</p>
              </div>
            </section>
            <section className="rx-card p-4">
              <p className="text-sm font-semibold uppercase text-slate-500">{t(locale, "currentScope")}</p>
              <div className="mt-3 grid gap-2 text-sm text-slate-600">
                <p>{stakeholderNames(project).join(", ") || t(locale, "stakeholders")}</p>
                <p>{project.documents.length} {t(locale, "attachedFiles").toLowerCase()}</p>
                <p>{project.participants.length} {t(locale, "assignedUsers")}</p>
              </div>
            </section>
          </aside>
        )}
      </section>
    </div>
  );
}

function AdminProjectAssignmentsView({
  locale,
  currentUser,
  roleProfile,
  project,
  users,
  onBack,
  onParticipantsChange,
  onRoleChange,
  onSignOut,
}: {
  locale: Locale;
  currentUser: User;
  roleProfile: RoleProfile;
  project: Project;
  users: User[];
  onBack: () => void;
  onParticipantsChange: (participants: ProjectParticipant[]) => void | Promise<void>;
  onRoleChange: (role: UserRole) => void;
  onSignOut: () => void;
}) {
  const [filter, setFilter] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [pendingRoles, setPendingRoles] = useState<Record<string, ProjectRole>>({});
  const assignedUserIds = new Set(project.participants.map((participant) => participant.userId));
  const defaultProjectRole: ProjectRole = "stakeholder";
  const filteredUsers = users.filter((user) =>
    normalizeSearchText([user.name, user.email, user.areaName].join(" ")).includes(normalizeSearchText(filter)),
  );

  async function assignUser(user: User) {
    const participant: ProjectParticipant = {
      userId: user.id,
      name: user.name,
      email: user.email,
      role: pendingRoles[user.id] ?? defaultProjectRole,
      areaId: user.areaId,
      areaName: user.areaName,
    };

    setIsSaving(true);
    try {
      await onParticipantsChange([...project.participants, participant]);
    } finally {
      setIsSaving(false);
    }
  }

  async function removeUser(userId: string) {
    setIsSaving(true);
    try {
      await onParticipantsChange(project.participants.filter((item) => item.userId !== userId));
    } finally {
      setIsSaving(false);
    }
  }

  async function updateProjectRole(user: User, role: ProjectRole) {
    setPendingRoles((current) => ({ ...current, [user.id]: role }));

    if (!assignedUserIds.has(user.id)) {
      return;
    }

    setIsSaving(true);
    try {
      await onParticipantsChange(
        project.participants.map((participant) =>
          participant.userId === user.id
            ? {
                ...participant,
                role,
                name: user.name,
                email: user.email,
                areaId: user.areaId,
                areaName: user.areaName,
              }
            : participant,
        ),
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 py-5 lg:px-6">
      <TopBar
        locale={locale}
        currentUser={currentUser}
        roleProfile={roleProfile}
        onRoleChange={onRoleChange}
        onSignOut={onSignOut}
      />
      <div className="mt-5">
        <button
          type="button"
          onClick={onBack}
          className="h-9 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800 hover:bg-slate-50"
        >
          {t(locale, "backToProjects")}
        </button>
      </div>

      <section className="rx-card mt-6 p-5 md:p-6">
        <p className="text-sm font-semibold uppercase text-slate-500">{t(locale, "projectAccessManagement")}</p>
        <div className="mt-2 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-normal text-slate-950">{project.name}</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">{project.summary}</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
            <p className="text-xs font-semibold uppercase text-slate-500">{t(locale, "assignedUsers")}</p>
            <p className="mt-1 text-2xl font-semibold text-slate-950">{project.participants.length}</p>
          </div>
        </div>
      </section>

      <section className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="rx-card p-4 md:p-5">
          <div className="grid gap-3 border-b border-slate-200 pb-4 sm:grid-cols-[1fr_20rem] sm:items-center">
            <div>
              <h2 className="text-xl font-semibold text-slate-950">{t(locale, "assignProjectUsers")}</h2>
              <p className="mt-1 text-sm text-slate-500">{t(locale, "adminProjectAssignmentHint")}</p>
            </div>
            <input
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
              type="search"
              placeholder={t(locale, "filterUsers")}
              className="h-10 rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-slate-700"
            />
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {filteredUsers.length === 0 ? (
              <p className="rounded-lg border border-dashed border-slate-300 p-4 text-sm text-slate-500 sm:col-span-2">
                {t(locale, "noUsersMatch")}
              </p>
            ) : (
              filteredUsers.map((user) => {
                const assignedParticipant = project.participants.find((participant) => participant.userId === user.id);
                const assigned = Boolean(assignedParticipant);
                const projectRole = pendingRoles[user.id] ?? assignedParticipant?.role ?? defaultProjectRole;
                return (
                  <article
                    key={user.id}
                    className={`rounded-lg border p-3 text-left transition disabled:cursor-wait disabled:opacity-60 ${
                      assigned
                        ? "border-slate-950 bg-slate-950 text-white"
                        : "border-slate-200 bg-white text-slate-800 hover:border-slate-400"
                    }`}
                  >
                    <span className="block text-sm font-semibold">{user.name}</span>
                    <span className={`mt-1 block text-xs ${assigned ? "text-white/70" : "text-slate-500"}`}>
                      {user.email}
                    </span>
                    <span className={`mt-2 block text-xs ${assigned ? "text-white/70" : "text-slate-500"}`}>
                      {user.areaName || t(locale, "withoutArea")}
                    </span>
                    <label className={`mt-3 grid gap-1 text-xs font-semibold uppercase ${assigned ? "text-white/70" : "text-slate-500"}`}>
                      {t(locale, "projectRole")}
                      <select
                        value={projectRole}
                        disabled={isSaving}
                        onChange={(event) => void updateProjectRole(user, event.target.value as ProjectRole)}
                        className={`h-9 rounded-md border px-2 text-sm normal-case ${
                          assigned
                            ? "border-white/20 bg-white/10 text-white"
                            : "border-slate-300 bg-white text-slate-900"
                        }`}
                      >
                        {projectAssignmentRoles.map((role) => (
                          <option key={role} value={role} className="text-slate-900">
                            {t(locale, roleLabelKey[role])}
                          </option>
                        ))}
                      </select>
                    </label>
                    <button
                      type="button"
                      disabled={isSaving}
                      onClick={() => (assigned ? void removeUser(user.id) : void assignUser(user))}
                      className={`mt-3 h-9 w-full rounded-md px-3 text-sm font-semibold disabled:cursor-wait disabled:opacity-60 ${
                        assigned
                          ? "border border-white/25 text-white hover:bg-white/10"
                          : "bg-slate-950 text-white hover:bg-slate-800"
                      }`}
                    >
                      {assigned ? t(locale, "removeFromProject") : t(locale, "assignToProject")}
                    </button>
                  </article>
                );
              })
            )}
          </div>
        </div>

        <aside className="rx-card p-4">
          <h2 className="text-sm font-semibold uppercase text-slate-500">{t(locale, "currentlyAssigned")}</h2>
          <div className="mt-4 grid gap-2">
            {project.participants.length === 0 ? (
              <p className="rounded-lg border border-dashed border-slate-300 p-3 text-sm text-slate-500">
                {t(locale, "noParticipantsAssigned")}
              </p>
            ) : (
              project.participants.map((participant) => (
                <div key={participant.userId} className="rounded-lg border border-slate-200 bg-white p-3">
                  <p className="text-sm font-semibold text-slate-950">{participant.name}</p>
                  <p className="mt-1 text-xs text-slate-500">{participant.email}</p>
                  <p className="mt-2 text-xs text-slate-500">
                    {participant.areaName || t(locale, "withoutArea")} - {t(locale, roleLabelKey[participant.role])}
                  </p>
                </div>
              ))
            )}
          </div>
        </aside>
      </section>
    </div>
  );
}

function WorkspaceView({
  locale,
  currentUser,
  roleProfile,
  project,
  runtime,
  templates,
  onBack,
  onRoleChange,
  onSignOut,
  updateRuntime,
  integrationStatus,
  authToken,
}: {
  locale: Locale;
  currentUser: User;
  roleProfile: RoleProfile;
  project: Project;
  runtime: ProjectRuntime;
  templates: InstitutionalInterviewTemplate[];
  onBack: () => void;
  onRoleChange: (role: UserRole) => void;
  onSignOut: () => void;
  updateRuntime: (updater: (current: ProjectRuntime) => ProjectRuntime) => void;
  integrationStatus: IntegrationStatus | null;
  authToken: string | null;
}) {
  const activeLayer = layers.find((layer) => layer.id === runtime.activeLayerId) ?? layers[0];
  const activeArtifacts = runtime.artifacts.filter((artifact) => artifact.layerId === runtime.activeLayerId);
  const activeRisks = runtime.risks.filter((risk) => risk.layerId === runtime.activeLayerId);
  const [elicitationInput, setElicitationInput] = useState("");
  const [isElicitationSending, setIsElicitationSending] = useState(false);
  const [isVoiceRecording, setIsVoiceRecording] = useState(false);
  const [isVoiceTranscribing, setIsVoiceTranscribing] = useState(false);
  const [voiceError, setVoiceError] = useState("");
  const voiceRecorderRef = useRef<MediaRecorder | null>(null);
  const voiceStreamRef = useRef<MediaStream | null>(null);
  const voiceChunksRef = useRef<Blob[]>([]);

  const generatedLayerIds = useMemo(
    () => new Set(runtime.artifacts.map((artifact) => artifact.layerId)),
    [runtime.artifacts],
  );

  const artifactById = useMemo(() => {
    return new Map(runtime.artifacts.map((artifact) => [artifact.id, artifact]));
  }, [runtime.artifacts]);

  function setActiveLayerId(layerId: LayerId) {
    updateRuntime((current) => ({ ...current, activeLayerId: layerId }));
  }

  const canGenerateActiveLayer =
    roleProfile.permissions.generateArtifacts &&
    roleProfile.allowedLayers.includes(runtime.activeLayerId) &&
    (runtime.activeLayerId !== "assistant" || roleProfile.permissions.runValidation);

  function handleGenerate() {
    if (!canGenerateActiveLayer) {
      return;
    }

    const generation = generateLayerArtifacts(runtime.activeLayerId, project);
    const artifacts = enrichArtifactsWithElicitationEvidence(
      generation.artifacts,
      runtime.elicitationRoom.contributions,
    );
    const elicitationTraces = createElicitationTraceLinks(artifacts, runtime.elicitationRoom.contributions);
    let nextRuntime: ProjectRuntime | null = null;

    updateRuntime((current) => {
      nextRuntime = {
        ...current,
        artifacts: [
          ...current.artifacts.filter((artifact) => artifact.layerId !== runtime.activeLayerId),
          ...artifacts,
        ],
        risks: [...current.risks.filter((risk) => risk.layerId !== runtime.activeLayerId), ...generation.risks],
        traces: [
          ...current.traces.filter((trace) =>
            ![...generation.traces, ...elicitationTraces].some((next) => next.id === trace.id),
          ),
          ...generation.traces,
          ...elicitationTraces,
        ],
        audit: [...generation.audit, ...current.audit],
      };

      return nextRuntime;
    });

    if (authToken && nextRuntime) {
      void persistWorkspaceLayerRuntime(authToken, project.id, runtime.activeLayerId, nextRuntime);
    }
  }

  function toggleApproval(artifactId: string) {
    if (!roleProfile.permissions.approveArtifacts) {
      return;
    }

    const artifact = runtime.artifacts.find((item) => item.id === artifactId);
    if (!artifact) {
      return;
    }

    let nextRuntime: ProjectRuntime | null = null;

    updateRuntime((current) => {
      nextRuntime = {
        ...current,
        artifacts: current.artifacts.map((item) =>
          item.id === artifactId
            ? {
                ...item,
                status: item.status === "approved" ? "needs-review" : "approved",
              }
            : item,
        ),
        audit: [
          {
            id: `audit-${artifactId}-${Date.now()}`,
            timestamp: nowTime(),
            layerId: artifact.layerId,
            action:
              artifact.status === "approved"
                ? `Artifact reopened for review: ${artifact.title}.`
                : `Artifact approved: ${artifact.title}.`,
            actor: currentUser.name,
          },
          ...current.audit,
        ],
      };

      return nextRuntime;
    });

    if (authToken && nextRuntime) {
      void persistWorkspaceLayerRuntime(authToken, project.id, artifact.layerId, nextRuntime);
    }
  }

  function updateArtifact(artifactId: string, draft: ArtifactEditDraft) {
    if (!roleProfile.permissions.approveArtifacts) {
      return;
    }

    const artifact = runtime.artifacts.find((item) => item.id === artifactId);
    if (!artifact) {
      return;
    }

    const title = draft.title.trim();
    const body = draft.body.trim();

    if (!title || !body) {
      return;
    }

    let nextRuntime: ProjectRuntime | null = null;

    updateRuntime((current) => {
      nextRuntime = {
        ...current,
        artifacts: current.artifacts.map((item) =>
          item.id === artifactId
            ? {
                ...item,
                title,
                type: draft.type.trim() || item.type,
                body,
                source: draft.source.trim(),
                assumptions: draft.assumptions.trim(),
                confidence: draft.confidence,
                status: draft.status,
              }
            : item,
        ),
        audit: [
          {
            id: `audit-artifact-edited-${artifactId}-${Date.now()}`,
            timestamp: nowTime(),
            layerId: artifact.layerId,
            action: `Artifact edited: ${artifact.title}.`,
            actor: currentUser.name,
          },
          ...current.audit,
        ],
      };

      return nextRuntime;
    });

    if (authToken && nextRuntime) {
      void persistWorkspaceLayerRuntime(authToken, project.id, artifact.layerId, nextRuntime);
    }
  }

  function createRequirementCandidateFromContributions(
    contributions: ElicitationContribution[],
    draft: RequirementCandidateDraft,
  ) {
    if (!roleProfile.permissions.generateArtifacts || contributions.length === 0) {
      return;
    }

    const title = draft.title.trim();
    const body = draft.body.trim();

    if (!title || !body) {
      return;
    }

    const timestamp = nowTime();
    const artifactId = `candidate-${Date.now()}`;
    const artifact: Artifact = {
      id: artifactId,
      layerId: "mediator",
      title,
      type: draft.type.trim() || "Raw requirement",
      body,
      status: "draft",
      confidence: draft.confidence,
      source: draft.source.trim() || sourceSummaryFromContributions(contributions),
      generatedBy: currentUser.name,
      assumptions: draft.assumptions.trim(),
    };
    const traces: TraceLink[] = contributions.map((contribution) => ({
      id: `trace-candidate-${contribution.id}-${artifactId}`,
      fromEvidenceId: contribution.id,
      fromLabel: `${contributionKindLabels[contribution.kind]} de ${contribution.authorName}`,
      toArtifactId: artifactId,
      relation: "sustenta",
    }));
    const audit: AuditEntry = {
      id: `audit-candidate-${artifactId}`,
      timestamp,
      layerId: "mediator",
      action: `Requirement candidate created from ${contributions.length} elicitation contribution(s): ${title}.`,
      actor: currentUser.name,
    };
    let nextRuntime: ProjectRuntime | null = null;

    updateRuntime((current) => {
      nextRuntime = {
        ...current,
        activeLayerId: "mediator",
        artifacts: [artifact, ...current.artifacts.filter((item) => item.id !== artifactId)],
        traces: [
          ...current.traces.filter((trace) => !traces.some((next) => next.id === trace.id)),
          ...traces,
        ],
        audit: [audit, ...current.audit],
      };

      return nextRuntime;
    });

    if (authToken && nextRuntime) {
      void persistWorkspaceLayerRuntime(authToken, project.id, "mediator", nextRuntime);
    }
  }

  function resetDemo() {
    if (!roleProfile.permissions.approveArtifacts || authToken) {
      return;
    }

    updateRuntime(() => initialRuntime());
  }

  const activeElicitationSession =
    runtime.elicitationRoom.sessions.find((session) => session.id === runtime.elicitationRoom.activeSessionId) ??
    runtime.elicitationRoom.sessions[0];

  function setActiveElicitationSession(sessionId: string) {
    updateRuntime((current) => ({
      ...current,
      elicitationRoom: {
        ...current.elicitationRoom,
        activeSessionId: sessionId,
      },
    }));
  }

  useEffect(() => {
    if (runtime.activeLayerId !== "mediator" || runtime.elicitationRoom.sessions.length > 0) {
      return;
    }

    const session = createWelcomeElicitationSession(project, currentUser, "Primer Chat");
    updateRuntime((current) => ({
      ...current,
      elicitationRoom: {
        ...current.elicitationRoom,
        activeSessionId: session.id,
        sessions: [session],
      },
    }));
  }, [currentUser, project, runtime.activeLayerId, runtime.elicitationRoom.sessions.length, updateRuntime]);

  function createElicitationSession() {
    const session = createWelcomeElicitationSession(
      project,
      currentUser,
      runtime.elicitationRoom.sessions.length === 0 ? "Primer Chat" : `Chat ${runtime.elicitationRoom.sessions.length + 1}`,
    );

    updateRuntime((current) => ({
      ...current,
      elicitationRoom: {
        ...current.elicitationRoom,
        activeSessionId: session.id,
        sessions: [session, ...current.elicitationRoom.sessions],
      },
    }));

    if (authToken) {
      void persistElicitationMessages(authToken, project.id, session.id, "synthesis", session.messages[0]);
      void persistElicitationSessionMeta(authToken, project.id, session.id, {
        title: session.title,
        deleted: false,
      });
    }
  }

  function renameElicitationSession(sessionId: string, title: string) {
    const nextTitle = title.trim();

    if (!nextTitle) {
      return;
    }

    updateRuntime((current) => ({
      ...current,
      elicitationRoom: {
        ...current.elicitationRoom,
        sessions: current.elicitationRoom.sessions.map((session) =>
          session.id === sessionId ? { ...session, title: nextTitle } : session,
        ),
      },
    }));

    if (authToken) {
      void persistElicitationSessionMeta(authToken, project.id, sessionId, { title: nextTitle });
    }
  }

  function deleteElicitationSession(sessionId: string) {
    updateRuntime((current) => {
      const remainingSessions = current.elicitationRoom.sessions.filter((session) => session.id !== sessionId);
      const sessions =
        remainingSessions.length > 0
          ? remainingSessions
          : [createWelcomeElicitationSession(project, currentUser, "Primer Chat")];
      const activeSessionId =
        current.elicitationRoom.activeSessionId === sessionId ? sessions[0].id : current.elicitationRoom.activeSessionId;

      return {
        ...current,
        elicitationRoom: {
          ...current.elicitationRoom,
          activeSessionId,
          sessions,
        },
      };
    });

    if (authToken) {
      void persistElicitationSessionMeta(authToken, project.id, sessionId, { deleted: true });
    }
  }

  function markElicitationMessageStreamed(messageId: string) {
    updateRuntime((current) => ({
      ...current,
      elicitationRoom: {
        ...current.elicitationRoom,
        sessions: current.elicitationRoom.sessions.map((session) => ({
          ...session,
          messages: session.messages.map((message) =>
            message.id === messageId ? { ...message, stream: false } : message,
          ),
        })),
      },
    }));
  }

  function createClarificationDrafts(questions: string[]) {
    const stakeholder = project.participants.find((participant) => participant.role === "stakeholder");
    const createdAt = nowTime();
    const drafts: ClarificationRequest[] = questions.slice(0, 5).map((question, index) => ({
      id: `clarification-${Date.now()}-${index}`,
      projectId: project.id,
      question,
      targetUserId: stakeholder?.userId ?? "",
      targetName: stakeholder?.name ?? "Todos los stakeholders",
      requestedBy: currentUser.id,
      requestedByName: currentUser.name,
      status: "draft",
      createdAt,
    }));

    updateRuntime((current) => ({
      ...current,
      elicitationRoom: {
        ...current.elicitationRoom,
        clarifications: [...drafts, ...current.elicitationRoom.clarifications],
      },
    }));
  }

  function updateClarificationDraft(clarificationId: string, data: Partial<Pick<ClarificationRequest, "question" | "targetUserId" | "targetName">>) {
    updateRuntime((current) => ({
      ...current,
      elicitationRoom: {
        ...current.elicitationRoom,
        clarifications: current.elicitationRoom.clarifications.map((clarification) =>
          clarification.id === clarificationId && clarification.status === "draft"
            ? { ...clarification, ...data }
            : clarification,
        ),
      },
    }));
  }

  async function sendClarificationRequest(clarificationId: string) {
    const sentAt = nowTime();
    const draft = runtime.elicitationRoom.clarifications.find(
      (clarification) => clarification.id === clarificationId && clarification.status === "draft",
    );

    if (!draft) {
      return;
    }

    const sentClarification: ClarificationRequest = {
      ...draft,
      status: "sent",
      sentAt,
    };

    updateRuntime((current) => {
      const clarifications = current.elicitationRoom.clarifications.map((clarification) => {
        if (clarification.id !== clarificationId || clarification.status !== "draft") {
          return clarification;
        }

        return sentClarification;
      });

      return {
        ...current,
        elicitationRoom: {
          ...current.elicitationRoom,
          clarifications,
        },
      };
    });

    if (authToken) {
      const persistedClarification = await persistClarificationEvent(authToken, project.id, activeElicitationSession.id, "clarification-request", {
        ...sentClarification,
        status: "sent",
      });

      if (persistedClarification?.id && persistedClarification.id !== sentClarification.id) {
        updateRuntime((current) => ({
          ...current,
          elicitationRoom: {
            ...current.elicitationRoom,
            clarifications: current.elicitationRoom.clarifications.map((clarification) =>
              clarification.id === sentClarification.id
                ? { ...sentClarification, id: persistedClarification.id }
                : clarification,
            ),
          },
        }));
      }
    }
  }

  async function answerClarificationRequest(clarificationId: string, response: string) {
    const trimmed = response.trim();

    if (!trimmed) {
      return;
    }

    const respondedAt = nowTime();
    const request = runtime.elicitationRoom.clarifications.find(
      (clarification) => clarification.id === clarificationId && clarification.status === "sent",
    );

    if (!request) {
      return;
    }

    const answeredClarification: ClarificationRequest = {
      ...request,
      status: "answered",
      response: trimmed,
      respondedBy: currentUser.id,
      respondedByName: currentUser.name,
      respondedAt,
    };

    updateRuntime((current) => {
      const clarifications = current.elicitationRoom.clarifications.map((clarification) => {
        if (clarification.id !== clarificationId || clarification.status !== "sent") {
          return clarification;
        }

        return answeredClarification;
      });

      return {
        ...current,
        elicitationRoom: {
          ...current.elicitationRoom,
          clarifications,
          contributions: [
            {
              id: `clarification-contribution-${Date.now()}`,
              authorName: currentUser.name,
              authorRole: currentUser.role,
              body: trimmed,
              kind: "question",
              timestamp: respondedAt,
              confidence: 0.78,
            },
            ...current.elicitationRoom.contributions,
          ],
        },
      };
    });

    if (authToken) {
      await persistClarificationEvent(authToken, project.id, activeElicitationSession.id, "clarification-response", {
        requestId: clarificationId,
        response: trimmed,
        respondedBy: currentUser.id,
        respondedByName: currentUser.name,
        respondedAt,
      });
    }
  }

  async function closeClarificationRequest(clarificationId: string) {
    const request = runtime.elicitationRoom.clarifications.find(
      (clarification) => clarification.id === clarificationId && clarification.status === "answered",
    );

    if (!request) {
      return;
    }

    let nextRuntime: ProjectRuntime | null = null;

    updateRuntime((current) => {
      nextRuntime = {
        ...current,
        elicitationRoom: {
          ...current.elicitationRoom,
          clarifications: current.elicitationRoom.clarifications.map((clarification) =>
            clarification.id === clarificationId ? { ...clarification, status: "closed" } : clarification,
          ),
        },
        audit: [
          {
            id: `audit-clarification-closed-${clarificationId}-${Date.now()}`,
            timestamp: nowTime(),
            layerId: "mediator",
            action: `Clarification closed: ${request.question}.`,
            actor: currentUser.name,
          },
          ...current.audit,
        ],
      };

      return nextRuntime;
    });

    if (authToken) {
      await persistClarificationStatus(authToken, project.id, clarificationId, "closed");

      if (nextRuntime) {
        void persistWorkspaceLayerRuntime(authToken, project.id, "mediator", nextRuntime);
      }
    }
  }

  function createRequirementCandidateFromClarification(clarificationId: string) {
    const clarification = runtime.elicitationRoom.clarifications.find(
      (item) => item.id === clarificationId && item.response,
    );

    if (!clarification?.response) {
      return;
    }

    const contribution: ElicitationContribution = {
      id: `clarification-evidence-${clarification.id}`,
      authorName: clarification.respondedByName || clarification.targetName,
      authorRole: "stakeholder",
      body: clarification.response,
      kind: "need",
      timestamp: clarification.respondedAt || nowTime(),
      confidence: 0.82,
    };

    createRequirementCandidateFromContributions([contribution], {
      title: "REQ desde aclaracion",
      type: "Raw requirement",
      body: clarification.response,
      source: `Aclaracion respondida por ${contribution.authorName}: ${clarification.question}`,
      assumptions: "La respuesta del stakeholder debe revisarse con el contexto completo antes de aprobar el requisito.",
      confidence: contribution.confidence ?? 0.82,
    });
  }

  async function addElicitationContribution(value = elicitationInput, clearInput = true) {
    await sendElicitationText(value, clearInput);
  }

  async function sendElicitationText(value: string, clearInput = false) {
    const trimmed = value.trim();
    if (isElicitationSending) {
      return;
    }

    if (!trimmed) {
      return;
    }

    setIsElicitationSending(true);
    const copy = elicitationRoleCopy[currentUser.role];
    const messageTime = nowTime();
    const activeSessionId = runtime.elicitationRoom.activeSessionId;
    const userMessage: ElicitationChatMessage = {
      id: `message-user-${Date.now()}`,
      authorName: currentUser.name,
      authorRole: currentUser.role,
      body: trimmed,
      timestamp: messageTime,
    };
    const userContribution: ElicitationContribution = {
      id: `elicitation-${Date.now()}`,
      authorName: currentUser.name,
      authorRole: currentUser.role,
      body: trimmed,
      kind: copy.kind,
      timestamp: messageTime,
      sourceMessageId: userMessage.id,
      confidence: 0.8,
    };
    let mediatorBody = authToken
      ? ""
      : "Gracias. Lo registro como insumo del proyecto. Para mejorar la elicitacion, intenta precisar actores afectados, excepciones y evidencia disponible.";

    try {
      if (authToken && integrationStatus?.openAi) {
        try {
          const data = await apiJson<{ reply?: string }>("/api/elicitation/respond", {
            method: "POST",
            token: authToken,
            body: {
              project,
              user: currentUser,
              message: trimmed,
              recentMessages: activeElicitationSession.messages.slice(-8),
              roomContext: elicitationRoomContext(runtime.elicitationRoom),
              mode: currentUser.role === "analyst" ? "analyst-processing" : "elicitation",
            },
          });
          mediatorBody = data.reply || mediatorBody;
        } catch {
          mediatorBody = authToken
            ? ""
            : "Gracias. Lo registro como insumo del proyecto. No pude consultar el modelo real, asi que dejo una respuesta de respaldo para continuar la elicitacion.";
        }
      }

      const mediatorMessage: ElicitationChatMessage | null = mediatorBody
        ? {
            id: `message-mediator-${Date.now()}`,
            authorName: "Mediador",
            authorRole: "mediator-ai",
            body: mediatorBody,
            timestamp: messageTime,
            stream: true,
          }
        : null;

      updateRuntime((current) => ({
        ...current,
        elicitationRoom: {
          ...current.elicitationRoom,
          contributions: [
            userContribution,
            ...current.elicitationRoom.contributions,
          ],
          sessions: current.elicitationRoom.sessions.map((session) =>
            session.id === activeSessionId
              ? {
                  ...session,
                  title:
                    session.messages.length <= 1
                      ? trimmed.slice(0, 42) || session.title
                      : session.title,
                  messages: [...session.messages, userMessage, ...(mediatorMessage ? [mediatorMessage] : [])],
                  updatedAt: messageTime,
                }
              : session,
          ),
        },
        audit: [
          {
            timestamp: messageTime,
            id: `audit-elicitation-${Date.now()}`,
            layerId: "mediator",
            action: `Elicitation contribution added by ${currentUser.name}.`,
            actor: currentUser.name,
          },
          ...current.audit,
        ],
      }));
      if (authToken && mediatorMessage) {
        await persistElicitationMessages(authToken, project.id, activeSessionId, copy.kind, userMessage, mediatorMessage);
      } else if (authToken) {
        await persistElicitationMessages(authToken, project.id, activeSessionId, copy.kind, userMessage);
      }
      if (authToken) {
        await persistElicitationContribution(authToken, project.id, activeSessionId, userContribution, userMessage.id);
      }
      if (clearInput) {
        setElicitationInput("");
      }
    } finally {
      setIsElicitationSending(false);
    }
  }

  function synthesizeElicitation() {
    if (!roleProfile.permissions.generateArtifacts || authToken) {
      return;
    }

    const recentInputs = runtime.elicitationRoom.contributions
      .slice(0, 4)
      .map((entry) => entry.body)
      .join(" ");

    updateRuntime((current) => ({
      ...current,
      elicitationRoom: {
        ...current.elicitationRoom,
        contributions: [
          {
            id: `elicitation-ai-${Date.now()}`,
            authorName: "Mediador",
            authorRole: "mediator-ai",
            body:
              recentInputs.length > 0
                ? `Synthesis candidate: consolidate explicit needs, mark inferred status-query requirements for confirmation, and ask for missing notification channels. Inputs considered: ${recentInputs}`
                : "Synthesis candidate: collect stakeholder statements before producing requirement candidates.",
            kind: "synthesis",
            timestamp: nowTime(),
            confidence: 0.74,
          },
          ...current.elicitationRoom.contributions,
        ],
      },
      audit: [
        {
          id: `audit-ai-synthesis-${Date.now()}`,
          timestamp: nowTime(),
          layerId: "mediator",
          action: "Mediador synthesized shared elicitation contributions.",
          actor: "Mediador",
        },
        ...current.audit,
      ],
    }));
  }

  async function attachFilesToElicitationSession(files: FileList | null) {
    if (!files) {
      return;
    }

    const localAttachments: AttachedDocument[] = Array.from(files).map((file) => ({
      id: `elicitation-upload-${file.name}-${Date.now()}`,
      name: file.name,
      type: file.type || "unknown",
      size: file.size,
      origin: "upload",
    }));
    const activeSessionId = runtime.elicitationRoom.activeSessionId;
    const attachmentTime = nowTime();
    const attachments = authToken
      ? await uploadFilesToPocketBaseStorage({
          token: authToken,
          files,
          projectId: project.id,
          sessionId: activeSessionId,
          origin: "elicitation-room",
          uploadedBy: currentUser.id,
          fallbackDocuments: localAttachments,
        })
      : localAttachments;

    updateRuntime((current) => ({
      ...current,
      elicitationRoom: {
        ...current.elicitationRoom,
        attachments: [...current.elicitationRoom.attachments, ...attachments],
        sessions: current.elicitationRoom.sessions.map((session) =>
          session.id === activeSessionId
            ? {
                ...session,
                attachments: [...session.attachments, ...attachments],
                messages: authToken
                  ? session.messages
                  : [
                      ...session.messages,
                      {
                        id: `message-attachment-${Date.now()}`,
                        authorName: "Mediador",
                        authorRole: "mediator-ai",
                        body: `Adjunte ${attachments.length} archivo(s) a esta conversacion. Quedaran como fuentes candidatas para trazabilidad.`,
                        timestamp: attachmentTime,
                        stream: true,
                      },
                    ],
                updatedAt: attachmentTime,
              }
            : session,
        ),
      },
    }));
  }

  async function startVoiceInput(onTranscript?: (transcript: string) => void) {
    const appendTranscript = onTranscript ?? appendVoiceTranscript;

    if (isVoiceTranscribing) {
      return;
    }

    setVoiceError("");

    if (isVoiceRecording) {
      voiceRecorderRef.current?.stop();
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      startBrowserSpeechFallback(appendTranscript);
      return;
    }

    if (!authToken) {
      startBrowserSpeechFallback(appendTranscript);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = preferredAudioMimeType();
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      voiceChunksRef.current = [];
      voiceStreamRef.current = stream;
      voiceRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          voiceChunksRef.current.push(event.data);
        }
      };

      recorder.onerror = () => {
        stopVoiceTracks();
        setIsVoiceRecording(false);
        setIsVoiceTranscribing(false);
        setVoiceError(t(locale, "voiceTranscriptionFailed"));
      };

      recorder.onstop = async () => {
        const chunks = [...voiceChunksRef.current];
        const audioType = recorder.mimeType || mimeType || "audio/webm";
        stopVoiceTracks();
        voiceRecorderRef.current = null;
        setIsVoiceRecording(false);

        if (chunks.length === 0) {
          return;
        }

        setIsVoiceTranscribing(true);
        try {
          const audio = new Blob(chunks, { type: audioType });
          const formData = new FormData();
          formData.append("audio", audio, audioType.includes("mp4") ? "voice.m4a" : "voice.webm");
          formData.append("language", "es");

          const data = await apiForm<{ text?: string }>("/api/audio/transcribe", {
            method: "POST",
            token: authToken,
            formData,
          });
          if (data.text) {
            appendTranscript(data.text);
          }
        } catch {
          setVoiceError(t(locale, "voiceTranscriptionFailed"));
        } finally {
          setIsVoiceTranscribing(false);
          voiceChunksRef.current = [];
        }
      };

      recorder.start();
      setIsVoiceRecording(true);
    } catch (error) {
      stopVoiceTracks();
      setIsVoiceRecording(false);
      setIsVoiceTranscribing(false);
      setVoiceError(voiceErrorMessage(error));
    }
  }

  function stopVoiceTracks() {
    voiceStreamRef.current?.getTracks().forEach((track) => track.stop());
    voiceStreamRef.current = null;
  }

  function appendVoiceTranscript(transcript: string) {
    setElicitationInput((current) => `${current} ${transcript}`.trim());
  }

  function startBrowserSpeechFallback(onTranscript: (transcript: string) => void) {
    type SpeechRecognitionResultLike = { transcript: string };
    type SpeechRecognitionEventLike = {
      results: ArrayLike<ArrayLike<SpeechRecognitionResultLike>>;
    };
    type SpeechRecognitionLike = {
      lang: string;
      interimResults: boolean;
      onresult: ((event: SpeechRecognitionEventLike) => void) | null;
      onerror: (() => void) | null;
      start: () => void;
    };
    type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;
    const speechWindow = window as unknown as {
      SpeechRecognition?: SpeechRecognitionConstructor;
      webkitSpeechRecognition?: SpeechRecognitionConstructor;
    };
    const Recognition = speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;

    if (!Recognition) {
      setVoiceError(t(locale, "voiceUnavailable"));
      return;
    }

    const recognition = new Recognition();
    recognition.lang = "es-AR";
    recognition.interimResults = false;
    recognition.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript;
      if (transcript) {
        onTranscript(transcript);
        setVoiceError(t(locale, "voiceBrowserFallback"));
      }
    };
    recognition.onerror = () => setVoiceError(t(locale, "voiceUnavailable"));
    recognition.start();
  }

  function voiceErrorMessage(error: unknown) {
    if (error instanceof DOMException && ["NotAllowedError", "SecurityError"].includes(error.name)) {
      return t(locale, "voicePermissionDenied");
    }

    return t(locale, "voiceUnavailable");
  }

  if (runtime.activeLayerId === "mediator") {
    const isStakeholderMediator = currentUser.role === "stakeholder";

    return (
      <div className="min-h-screen bg-[#f6f7f4]">
        <div
          className={
            isStakeholderMediator
              ? "mx-auto flex min-h-screen w-full flex-col"
              : "mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 py-5 lg:px-6"
          }
        >
          {!isStakeholderMediator && (
            <>
              <TopBar
                locale={locale}
                currentUser={currentUser}
                roleProfile={roleProfile}
                onRoleChange={onRoleChange}
                onSignOut={onSignOut}
              />
              <div className="mt-5">
                <button
                  type="button"
                  onClick={onBack}
                  className="h-9 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800 hover:bg-slate-50"
                >
                  {t(locale, "backToPhases")}
                </button>
              </div>
            </>
          )}
          <StakeholderElicitationAssistant
            locale={locale}
            currentUser={currentUser}
            roleProfile={roleProfile}
            project={project}
            room={runtime.elicitationRoom}
            activeSession={activeElicitationSession}
            templates={templates}
            authToken={authToken}
            input={elicitationInput}
            setInput={setElicitationInput}
            onAdd={addElicitationContribution}
            onSynthesize={synthesizeElicitation}
            onNewChat={createElicitationSession}
            onSelectChat={setActiveElicitationSession}
            onRenameChat={renameElicitationSession}
            onDeleteChat={deleteElicitationSession}
            onFiles={attachFilesToElicitationSession}
            onVoice={startVoiceInput}
            isSending={isElicitationSending}
            isVoiceRecording={isVoiceRecording}
            isVoiceTranscribing={isVoiceTranscribing}
            voiceError={voiceError}
            canUseSimulatedActions={!authToken}
            onMessageStreamed={markElicitationMessageStreamed}
            onCreateClarificationDrafts={createClarificationDrafts}
            onUpdateClarificationDraft={updateClarificationDraft}
            onSendClarification={sendClarificationRequest}
            onAnswerClarification={answerClarificationRequest}
            onCreateRequirementCandidate={createRequirementCandidateFromContributions}
            onCloseClarification={closeClarificationRequest}
            onCreateCandidateFromClarification={createRequirementCandidateFromClarification}
            onBackToPhases={onBack}
            onSignOut={onSignOut}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col xl:flex-row">
      <aside className="border-b border-slate-200 bg-white px-4 py-4 xl:w-72 xl:border-b-0 xl:border-r">
        <TopBar
          locale={locale}
          compact
          currentUser={currentUser}
          roleProfile={roleProfile}
          onRoleChange={onRoleChange}
          onSignOut={onSignOut}
        />
        <button
          type="button"
          onClick={onBack}
          className="mt-5 h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800 hover:bg-slate-50"
        >
          {t(locale, "backToProjects")}
        </button>

        <nav aria-label={t(locale, "modelFlow")} className="mt-5 grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
          {layers.map((layer, index) => {
            const isActive = layer.id === runtime.activeLayerId;
            const isGenerated = generatedLayerIds.has(layer.id);
            return (
              <button
                key={layer.id}
                type="button"
                onClick={() => setActiveLayerId(layer.id)}
                className={`rounded-lg border px-3 py-3 text-left transition ${
                  isActive
                    ? "border-slate-900 bg-slate-950 text-white"
                    : "border-slate-200 bg-white text-slate-800 hover:border-slate-400"
                }`}
              >
                <span className="block text-xs font-medium uppercase text-current opacity-70">
                  {String(index + 1).padStart(2, "0")} / {layer.phase}
                </span>
                <span className="mt-1 block text-base font-semibold">{layer.role}</span>
                <span className="mt-2 block text-xs">{isGenerated ? t(locale, "generated") : t(locale, "pending")}</span>
              </button>
            );
          })}
        </nav>

        <button
          type="button"
          onClick={resetDemo}
          disabled={!roleProfile.permissions.approveArtifacts}
          className="mt-5 h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-800 hover:bg-slate-50"
        >
          {roleProfile.permissions.approveArtifacts ? t(locale, "reset") : t(locale, "restrictedAction")}
        </button>
      </aside>

      <section className="flex min-w-0 flex-1 flex-col">
        <header className="border-b border-slate-200 bg-white px-4 py-4 lg:px-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase text-slate-500">{t(locale, "project")}</p>
              <h1 className="mt-1 text-2xl font-semibold tracking-normal text-slate-950">{project.name}</h1>
              <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-600">{project.summary}</p>
            </div>
            <div className="grid gap-2 text-sm text-slate-700 sm:grid-cols-2 lg:w-[28rem]">
              <InfoMetric label="Domain" value={project.domain} />
              <InfoMetric label="Municipality" value={project.municipality} />
            </div>
          </div>
        </header>

        <div className="grid flex-1 grid-cols-1 xl:grid-cols-[minmax(0,1fr)_25rem]">
          <div className="min-w-0 px-4 py-4 lg:px-6">
            <section className={`rounded-lg border p-4 ${layerTone[activeLayer.id]}`}>
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase opacity-70">{t(locale, "activeLayer")}</p>
                  <h2 className="mt-1 text-2xl font-semibold tracking-normal">
                    {activeLayer.phase}: {activeLayer.role}
                  </h2>
                  <p className="mt-2 max-w-3xl text-sm leading-6">{activeLayer.genAiRole}</p>
                </div>
                <button
                  type="button"
                  onClick={handleGenerate}
                  disabled={!canGenerateActiveLayer}
                  className="h-10 rounded-md bg-slate-950 px-4 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {!canGenerateActiveLayer
                    ? t(locale, "restrictedAction")
                    : generatedLayerIds.has(runtime.activeLayerId)
                      ? t(locale, "generated")
                      : t(locale, "generate")}
                </button>
              </div>

              <dl className="mt-4 grid gap-3 md:grid-cols-3">
                <LayerFact label={t(locale, "control")} value={activeLayer.control} />
                <LayerFact label={t(locale, "input")} value={activeLayer.input} />
                <LayerFact label={t(locale, "output")} value={activeLayer.output} />
              </dl>
            </section>

            <section className="mt-4 grid gap-4 lg:grid-cols-[20rem_minmax(0,1fr)]">
              <ProjectContextCard locale={locale} project={project} />
              <ArtifactList
                locale={locale}
                activeArtifacts={activeArtifacts}
                artifactCount={runtime.artifacts.length}
                elicitationRoom={runtime.elicitationRoom}
                onToggleApproval={toggleApproval}
                onUpdateArtifact={updateArtifact}
                canApprove={roleProfile.permissions.approveArtifacts}
              />
            </section>
          </div>

          <RiskTraceAuditPanel
            locale={locale}
            risks={runtime.risks}
            activeRisks={activeRisks}
            traces={runtime.traces}
            audit={runtime.audit}
            artifactById={artifactById}
            canViewRisk={roleProfile.permissions.viewRisk}
          />
        </div>
      </section>
    </div>
  );
}

function ArtifactList({
  locale,
  activeArtifacts,
  artifactCount,
  elicitationRoom,
  onToggleApproval,
  onUpdateArtifact,
  canApprove,
}: {
  locale: Locale;
  activeArtifacts: Artifact[];
  artifactCount: number;
  elicitationRoom: ElicitationRoomState;
  onToggleApproval: (artifactId: string) => void;
  onUpdateArtifact: (artifactId: string, draft: ArtifactEditDraft) => void;
  canApprove: boolean;
}) {
  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold uppercase text-slate-500">{t(locale, "artifactPanel")}</h2>
        <span className="text-xs text-slate-500">
          {activeArtifacts.length} / {artifactCount} {t(locale, "allArtifacts")}
        </span>
      </div>

      {activeArtifacts.length === 0 ? (
        <div className="mt-3 rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
          {t(locale, "noArtifacts")}
        </div>
      ) : (
        <div className="mt-3 grid gap-3">
          {activeArtifacts.map((artifact) => (
            <ArtifactCard
              key={artifact.id}
              artifact={artifact}
              elicitationRoom={elicitationRoom}
              onToggleApproval={onToggleApproval}
              onUpdateArtifact={onUpdateArtifact}
              canApprove={canApprove}
              locale={locale}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ArtifactCard({
  artifact,
  elicitationRoom,
  onToggleApproval,
  onUpdateArtifact,
  canApprove,
  locale,
}: {
  artifact: Artifact;
  elicitationRoom: ElicitationRoomState;
  onToggleApproval: (artifactId: string) => void;
  onUpdateArtifact: (artifactId: string, draft: ArtifactEditDraft) => void;
  canApprove: boolean;
  locale: Locale;
}) {
  const evidence = artifactEvidenceFor(artifact, elicitationRoom.contributions, 2);
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState<ArtifactEditDraft>(() => ({
    title: artifact.title,
    type: artifact.type,
    body: artifact.body,
    source: artifact.source,
    assumptions: artifact.assumptions ?? "",
    confidence: artifact.confidence,
    status: artifact.status,
  }));

  function saveEdit() {
    onUpdateArtifact(artifact.id, draft);
    setIsEditing(false);
  }

  return (
    <article className="rounded-lg border border-slate-200 bg-white p-4">
      {isEditing ? (
        <div className="grid gap-3">
          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_12rem]">
            <label className="grid gap-1 text-sm font-semibold text-slate-700">
              Titulo
              <input
                value={draft.title}
                onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))}
                className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm font-normal text-slate-950 outline-none focus:border-slate-700"
              />
            </label>
            <label className="grid gap-1 text-sm font-semibold text-slate-700">
              Tipo
              <input
                value={draft.type}
                onChange={(event) => setDraft((current) => ({ ...current, type: event.target.value }))}
                className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm font-normal text-slate-950 outline-none focus:border-slate-700"
              />
            </label>
          </div>
          <label className="grid gap-1 text-sm font-semibold text-slate-700">
            Cuerpo
            <textarea
              value={draft.body}
              onChange={(event) => setDraft((current) => ({ ...current, body: event.target.value }))}
              rows={5}
              className="resize-none rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-normal leading-6 text-slate-950 outline-none focus:border-slate-700"
            />
          </label>
          <label className="grid gap-1 text-sm font-semibold text-slate-700">
            Fuente
            <textarea
              value={draft.source}
              onChange={(event) => setDraft((current) => ({ ...current, source: event.target.value }))}
              rows={2}
              className="resize-none rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-normal leading-6 text-slate-950 outline-none focus:border-slate-700"
            />
          </label>
          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_10rem_10rem]">
            <label className="grid gap-1 text-sm font-semibold text-slate-700">
              Supuestos
              <textarea
                value={draft.assumptions}
                onChange={(event) => setDraft((current) => ({ ...current, assumptions: event.target.value }))}
                rows={3}
                className="resize-none rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-normal leading-6 text-slate-950 outline-none focus:border-slate-700"
              />
            </label>
            <label className="grid content-start gap-2 text-sm font-semibold text-slate-700">
              Estado
              <select
                value={draft.status}
                onChange={(event) => setDraft((current) => ({ ...current, status: event.target.value as Artifact["status"] }))}
                className="h-10 rounded-md border border-slate-300 bg-white px-2 text-sm font-normal text-slate-950 outline-none focus:border-slate-700"
              >
                <option value="draft">Borrador</option>
                <option value="proposed">Propuesto</option>
                <option value="approved">Aprobado</option>
                <option value="needs-review">Requiere revision</option>
              </select>
            </label>
            <label className="grid content-start gap-2 text-sm font-semibold text-slate-700">
              Confianza
              <input
                type="range"
                min="0.35"
                max="0.98"
                step="0.01"
                value={draft.confidence}
                onChange={(event) => setDraft((current) => ({ ...current, confidence: Number(event.target.value) }))}
              />
              <span className="rounded-md bg-slate-100 px-2 py-1 text-center text-xs text-slate-600">
                {Math.round(draft.confidence * 100)}%
              </span>
            </label>
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setDraft({
                  title: artifact.title,
                  type: artifact.type,
                  body: artifact.body,
                  source: artifact.source,
                  assumptions: artifact.assumptions ?? "",
                  confidence: artifact.confidence,
                  status: artifact.status,
                });
                setIsEditing(false);
              }}
              className="h-9 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-100"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={saveEdit}
              disabled={!draft.title.trim() || !draft.body.trim() || !canApprove}
              className="h-9 rounded-md bg-slate-950 px-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              Guardar cambios
            </button>
          </div>
        </div>
      ) : (
        <>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-xs font-medium uppercase text-slate-500">{artifact.type}</p>
                  <h3 className="mt-1 text-base font-semibold text-slate-950">{artifact.title}</h3>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`rounded-md px-2 py-1 text-xs font-semibold ${statusTone[artifact.status]}`}>
                    {t(locale, statusKeys[artifact.status])}
                  </span>
                  <button
                    type="button"
                    onClick={() => onToggleApproval(artifact.id)}
                    disabled={!canApprove}
                    className="h-8 rounded-md border border-slate-300 px-3 text-xs font-semibold text-slate-800 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {!canApprove
                      ? t(locale, "restrictedAction")
                      : artifact.status === "approved"
                        ? t(locale, "reopen")
                        : t(locale, "approve")}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDraft({
                        title: artifact.title,
                        type: artifact.type,
                        body: artifact.body,
                        source: artifact.source,
                        assumptions: artifact.assumptions ?? "",
                        confidence: artifact.confidence,
                        status: artifact.status,
                      });
                      setIsEditing(true);
                    }}
                    disabled={!canApprove}
                    className="h-8 rounded-md border border-slate-300 px-3 text-xs font-semibold text-slate-800 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Editar
                  </button>
                </div>
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-700">{artifact.body}</p>
              <div className="mt-4 grid gap-2 text-xs text-slate-500 md:grid-cols-3">
                <p>
                  <span className="font-semibold text-slate-700">{t(locale, "confidence")}:</span>{" "}
                  {Math.round(artifact.confidence * 100)}%
                </p>
                <p>
                  <span className="font-semibold text-slate-700">{t(locale, "generatedBy")}:</span>{" "}
                  {artifact.generatedBy}
                </p>
                <p>
                  <span className="font-semibold text-slate-700">{t(locale, "source")}:</span> {artifact.source}
                </p>
              </div>
              {artifact.assumptions && (
                <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-950">
                  <p className="text-xs font-semibold uppercase text-amber-800">Supuestos</p>
                  <p className="mt-1">{artifact.assumptions}</p>
                </div>
              )}
              {evidence.length > 0 && (
                <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs font-semibold uppercase text-slate-500">Evidencia de elicitacion</p>
                  <div className="mt-2 grid gap-2">
                    {evidence.map((contribution, index) => (
                      <div key={contribution.id} className="rounded-md bg-white px-3 py-2 text-xs leading-5 text-slate-600">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`rounded-md border px-2 py-0.5 font-semibold ${contributionKindTone[contribution.kind]}`}
                          >
                            {contributionKindLabels[contribution.kind]}
                          </span>
                          <span>{contribution.authorName}</span>
                          <span>{contributionConfidenceLabel(contribution, index)}</span>
                        </div>
                        <p className="mt-1 text-slate-700">{contribution.body}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
        </>
      )}
            </article>
  );
}

function StakeholderElicitationAssistant({
  locale,
  currentUser,
  roleProfile,
  project,
  room,
  activeSession,
  templates,
  authToken,
  input,
  setInput,
  onAdd,
  onSynthesize,
  onNewChat,
  onSelectChat,
  onRenameChat,
  onDeleteChat,
  onFiles,
  onVoice,
  isSending,
  isVoiceRecording,
  isVoiceTranscribing,
  voiceError,
  canUseSimulatedActions,
  onMessageStreamed,
  onCreateClarificationDrafts,
  onUpdateClarificationDraft,
  onSendClarification,
  onAnswerClarification,
  onCreateRequirementCandidate,
  onCloseClarification,
  onCreateCandidateFromClarification,
  onBackToPhases,
  onSignOut,
}: {
  locale: Locale;
  currentUser: User;
  roleProfile: RoleProfile;
  project: Project;
  room: ElicitationRoomState;
  activeSession: ElicitationChatSession;
  templates: InstitutionalInterviewTemplate[];
  authToken: string | null;
  input: string;
  setInput: Dispatch<SetStateAction<string>>;
  onAdd: (value?: string, clearInput?: boolean) => void | Promise<void>;
  onSynthesize: () => void;
  onNewChat: () => void;
  onSelectChat: (sessionId: string) => void;
  onRenameChat: (sessionId: string, title: string) => void;
  onDeleteChat: (sessionId: string) => void;
  onFiles: (files: FileList | null) => void | Promise<void>;
  onVoice: (onTranscript?: (transcript: string) => void) => void;
  isSending: boolean;
  isVoiceRecording: boolean;
  isVoiceTranscribing: boolean;
  voiceError: string;
  canUseSimulatedActions: boolean;
  onMessageStreamed: (messageId: string) => void;
  onCreateClarificationDrafts: (questions: string[]) => void;
  onUpdateClarificationDraft: (
    clarificationId: string,
    data: Partial<Pick<ClarificationRequest, "question" | "targetUserId" | "targetName">>,
  ) => void;
  onSendClarification: (clarificationId: string) => void | Promise<void>;
  onAnswerClarification: (clarificationId: string, response: string) => void | Promise<void>;
  onCreateRequirementCandidate: (
    contributions: ElicitationContribution[],
    draft: RequirementCandidateDraft,
  ) => void;
  onCloseClarification: (clarificationId: string) => void | Promise<void>;
  onCreateCandidateFromClarification: (clarificationId: string) => void;
  onBackToPhases?: () => void;
  onSignOut?: () => void;
}) {
  const [showContext, setShowContext] = useState(false);
  const [contextInput, setContextInput] = useState("");
  const [isContextPending, setIsContextPending] = useState(false);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [contextMessages, setContextMessages] = useState<ElicitationChatMessage[]>(() => [
    {
      id: `context-intro-${project.id}`,
      authorName: "Mediador",
      authorRole: "mediator-ai",
      body: projectContextIntro(project, room),
      timestamp: nowTime(),
    },
  ]);
  const copy = elicitationRoleCopy[currentUser.role];
  const isStakeholder = currentUser.role === "stakeholder";
  const isAnalyst = currentUser.role === "analyst";
  const isContextMode = isStakeholder && showContext;
  const canSynthesize = canUseSimulatedActions && roleProfile.permissions.generateArtifacts;
  const recentOtherContributions = room.contributions
    .filter((entry) => entry.authorName !== currentUser.name)
    .slice(0, 4);
  const roomAttachments = [...room.attachments, ...project.documents];
  const insights = detectedElicitationInsights(room, project, locale);
  const visibleMessages = isContextMode ? contextMessages : activeSession.messages;
  const visibleAttachments = activeSession.attachments;
  const composerInput = isContextMode ? contextInput : input;
  const guidedInterviewTemplate = institutionalInterviewTemplateFor(project, templates);
  const guidedInterviewBlocks = institutionalInterviewBlocksFor(project, templates);
  const structuredRequestSummary = guidedInterviewTemplate
    ? buildInstitutionalRequestSummary(project, room, templates)
    : "";
  const pendingClarifications = isStakeholder
    ? room.clarifications.filter(
        (clarification) =>
          clarification.status === "sent" &&
          (!clarification.targetUserId || clarification.targetUserId === currentUser.id),
      )
    : [];

  function setComposerInput(value: string) {
    if (isContextMode) {
      setContextInput(value);
      return;
    }

    setInput(value);
  }

  function appendComposerTranscript(transcript: string) {
    if (isContextMode) {
      setContextInput((current) => `${current} ${transcript}`.trim());
      return;
    }

    setInput((current) => `${current} ${transcript}`.trim());
  }

  async function sendComposerMessage() {
    if (isContextMode) {
      const trimmed = contextInput.trim();

      if (!trimmed || isContextPending || isSending) {
        return;
      }

      const timestamp = nowTime();
      const pendingId = `context-mediator-${Date.now()}`;
      const userMessage: ElicitationChatMessage = {
        id: `context-user-${Date.now()}`,
        authorName: currentUser.name,
        authorRole: currentUser.role,
        body: trimmed,
        timestamp,
      };

      setContextMessages((messages) => [
        ...messages,
        userMessage,
        {
          id: pendingId,
          authorName: "Mediador",
          authorRole: "mediator-ai",
          body: "Consultando el contexto del proyecto...",
          timestamp,
        },
      ]);
      setContextInput("");
      setIsContextPending(true);

      if (!authToken) {
        setContextMessages((messages) =>
          messages.map((message) =>
            message.id === pendingId
              ? {
                  ...message,
                  body: projectContextIntro(project, room),
                  stream: true,
                }
              : message,
          ),
        );
        setIsContextPending(false);
        return;
      }

      try {
        const data = await apiJson<{ reply?: string }>("/api/elicitation/respond", {
          method: "POST",
          token: authToken,
          body: {
            project,
            user: currentUser,
            message: trimmed,
            recentMessages: [...contextMessages, userMessage].slice(-8),
            mode: "project-context",
          },
        });
        setContextMessages((messages) =>
          messages.map((message) =>
            message.id === pendingId
              ? {
                  ...message,
                  body:
                    data.reply ||
                    "No pude obtener una respuesta del modelo en este momento. Puedes intentar reformular la pregunta.",
                  stream: true,
                }
              : message,
          ),
        );
      } catch {
        setContextMessages((messages) =>
          messages.map((message) =>
            message.id === pendingId
              ? {
                  ...message,
                  body:
                    "No pude conectar con OpenAI para responder sobre el contexto del proyecto. Revisa la configuracion del servidor o intenta nuevamente en unos segundos.",
                  stream: true,
                }
              : message,
          ),
        );
      } finally {
        setIsContextPending(false);
      }
      return;
    }

    const outgoingMessage = input;
    if (!outgoingMessage.trim() || isSending) {
      return;
    }

    setInput("");
    await onAdd(outgoingMessage, false);
  }

  if (isAnalyst) {
    return (
      <AnalystGuidedElicitationRoom
        project={project}
        room={room}
        activeSession={activeSession}
        templates={templates}
        clarifications={room.clarifications}
        isSending={isSending}
        onRunMediatorPrompt={async (prompt) => {
          if (isSending) {
            return;
          }

          setInput("");
          await onAdd(prompt, false);
        }}
        onCreateClarificationDrafts={onCreateClarificationDrafts}
        onUpdateClarificationDraft={onUpdateClarificationDraft}
        onSendClarification={onSendClarification}
        onCreateRequirementCandidate={onCreateRequirementCandidate}
        onCloseClarification={onCloseClarification}
        onCreateCandidateFromClarification={onCreateCandidateFromClarification}
      />
    );
  }

  if (isStakeholder) {
    return (
      <StakeholderImmersiveElicitation
        locale={locale}
        project={project}
        room={room}
        activeSession={activeSession}
        messages={visibleMessages}
        attachments={visibleAttachments}
        input={composerInput}
        guidedInterviewTemplate={guidedInterviewTemplate}
        guidedInterviewBlocks={guidedInterviewBlocks}
        structuredRequestSummary={structuredRequestSummary}
        pendingClarifications={pendingClarifications}
        isSending={isSending}
        isVoiceRecording={isVoiceRecording}
        isVoiceTranscribing={isVoiceTranscribing}
        voiceError={voiceError}
        onInputChange={setComposerInput}
        onUsePrompt={setComposerInput}
        onSend={sendComposerMessage}
        onFiles={onFiles}
        onVoice={() => onVoice(appendComposerTranscript)}
        onMessageStreamed={onMessageStreamed}
        onAnswerClarification={onAnswerClarification}
        onBackToPhases={onBackToPhases}
        onSignOut={onSignOut}
      />
    );
  }

  return (
    <section
      className={`rx-room-shell mt-4 grid min-h-[38rem] overflow-hidden rounded-lg border bg-white ${
        isStakeholder
          ? "lg:grid-cols-[17rem_minmax(0,1fr)]"
          : isAnalyst
            ? "lg:grid-cols-[18rem_minmax(0,1fr)]"
          : "lg:grid-cols-[17rem_minmax(0,1fr)] xl:grid-cols-[17rem_minmax(0,1fr)_20rem]"
      }`}
    >
      <aside className="min-w-0 border-b border-slate-200 bg-slate-50 p-3 lg:border-b-0 lg:border-r">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-xs font-semibold uppercase text-slate-500">{t(locale, "projectRoom")}</p>
            <p className="mt-1 text-sm font-semibold text-slate-950">{project.name}</p>
          </div>
          <button
            type="button"
            onClick={onNewChat}
            className="h-8 rounded-md bg-slate-950 px-2 text-xs font-semibold text-white hover:bg-slate-800"
          >
            {t(locale, "newChat")}
          </button>
        </div>

        {false && isStakeholder && (
          <button
            type="button"
            onClick={() => setShowContext((current) => !current)}
            className="mt-4 flex h-10 w-full items-center justify-between rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800 hover:bg-slate-100"
          >
            <span>{showContext ? t(locale, "hideContext") : t(locale, "getContext")}</span>
            <span className="text-base leading-none">{showContext ? "−" : "+"}</span>
          </button>
        )}

        <h3 className="mt-5 text-xs font-semibold uppercase text-slate-500">{t(locale, "chatHistory")}</h3>
        <div className="mt-2 grid gap-2">
          {room.sessions.map((session) => (
            <div
              key={session.id}
              className={`min-w-0 rounded-md border px-3 py-2 ${
                session.id === activeSession.id
                  ? "border-slate-950 bg-white text-slate-950"
                  : "border-transparent bg-transparent text-slate-600 hover:bg-white"
              }`}
            >
              {editingSessionId === session.id ? (
                <div className="grid gap-2">
                  <input
                    value={editingTitle}
                    onChange={(event) => setEditingTitle(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        onRenameChat(session.id, editingTitle);
                        setEditingSessionId(null);
                      }

                      if (event.key === "Escape") {
                        setEditingSessionId(null);
                      }
                    }}
                    className="h-8 rounded-md border border-slate-300 bg-white px-2 text-sm font-semibold text-slate-950 outline-none focus:border-slate-700"
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        onRenameChat(session.id, editingTitle);
                        setEditingSessionId(null);
                      }}
                      className="rounded-md bg-slate-950 px-2 py-1 text-xs font-semibold text-white"
                    >
                      {t(locale, "save")}
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingSessionId(null)}
                      className="rounded-md border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <div className="grid gap-2">
                  <button type="button" onClick={() => onSelectChat(session.id)} className="min-w-0 text-left">
                    <span className="block max-w-full truncate text-sm font-semibold">{session.title}</span>
                    <span className="mt-1 block text-xs text-slate-500">
                      {session.messages.length} mensajes · {chatLastActivityLabel(session)}
                    </span>
                  </button>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingSessionId(session.id);
                        setEditingTitle(session.title);
                      }}
                      title="Editar chat"
                      aria-label="Editar chat"
                      className="flex h-8 w-8 items-center justify-center rounded-md border border-slate-300 text-slate-600 hover:text-slate-950"
                    >
                      <EditIcon />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteChat(session.id)}
                      title="Eliminar chat"
                      aria-label="Eliminar chat"
                      className="flex h-8 w-8 items-center justify-center rounded-md border border-rose-200 text-rose-700 hover:border-rose-300"
                    >
                      <TrashIcon />
                    </button>
                  </div>
                </div>
              )}
            </div>
            ))}
        </div>
        {isAnalyst && (
          <AnalystRoomSidebar
            room={room}
            project={project}
            insights={insights}
          />
        )}
      </aside>

      <div className="flex min-h-[38rem] flex-col">
        <header className={`border-b border-slate-200 p-4 ${isAnalyst ? "bg-white" : ""}`}>
          <p className="text-sm font-semibold uppercase text-slate-500">
            {isAnalyst ? "Sala del analista" : isContextMode ? t(locale, "contextBrief") : t(locale, "elicitationRoom")}
          </p>
          <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-2xl font-semibold tracking-normal text-slate-950">
                {isContextMode
                  ? t(locale, "contextChatTitle")
                  : isAnalyst
                    ? "Conducir la elicitacion con el Mediador"
                  : isStakeholder
                    ? t(locale, "stakeholderAssistantTitle")
                    : t(locale, copy.title)}
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                {isContextMode
                  ? t(locale, "contextChatHint")
                  : isAnalyst
                    ? "Revisa lo aportado por los stakeholders, pide aclaraciones al Mediador y prepara insumos para convertir la conversacion en candidatos de requisitos."
                  : isStakeholder
                    ? t(locale, "stakeholderAssistantSubtitle")
                    : t(locale, copy.prompt)}
              </p>
            </div>
            {!isStakeholder && !isAnalyst && (
              <button
                type="button"
                onClick={() => setShowContext((current) => !current)}
                className="h-9 shrink-0 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800 hover:bg-slate-50"
              >
                {showContext ? t(locale, "hideContext") : t(locale, "getContext")}
              </button>
            )}
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-auto bg-[#f8faf7] p-4">
          <div className="mx-auto grid max-w-3xl gap-3">
            {isAnalyst && (
              <AnalystElicitationControlPanel
                room={room}
                project={project}
                insights={insights}
                canSynthesize={canSynthesize}
                onSynthesize={onSynthesize}
                onUsePrompt={(prompt) => setInput(prompt)}
              />
            )}
            {!isContextMode && guidedInterviewBlocks.length > 0 && !isAnalyst && (
              <InstitutionalGuidedInterviewPanel
                template={guidedInterviewTemplate}
                blocks={guidedInterviewBlocks}
                summary={structuredRequestSummary}
                onUsePrompt={setComposerInput}
              />
            )}
            {pendingClarifications.length > 0 && (
              <StakeholderClarificationInbox
                clarifications={pendingClarifications}
                onAnswer={onAnswerClarification}
                isSending={isSending}
              />
            )}
            {showContext && !isContextMode && (
              <section className="rounded-lg border border-sky-200 bg-sky-50 p-4 text-sky-950">
                <p className="text-sm font-semibold uppercase">{t(locale, "contextBrief")}</p>
                <p className="mt-2 text-sm leading-6">{t(locale, "contextHint")}</p>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <div className="rounded-md bg-white/70 p-3">
                    <h3 className="text-xs font-semibold uppercase text-sky-800">{t(locale, "projectSummary")}</h3>
                    <p className="mt-2 text-sm leading-5">{project.summary}</p>
                  </div>
                  <div className="rounded-md bg-white/70 p-3">
                    <h3 className="text-xs font-semibold uppercase text-sky-800">{t(locale, "parallelWork")}</h3>
                    <p className="mt-2 text-sm leading-5">{roomStatsLabel(locale, room)}</p>
                  </div>
                  <div className="rounded-md bg-white/70 p-3">
                    <h3 className="text-xs font-semibold uppercase text-sky-800">{t(locale, "recentContributions")}</h3>
                    {recentOtherContributions.length === 0 ? (
                      <p className="mt-2 text-sm leading-5">{t(locale, "noRecentContributions")}</p>
                    ) : (
                      <div className="mt-2 grid gap-2">
                        {recentOtherContributions.map((entry) => (
                          <p key={entry.id} className="text-sm leading-5">
                            <span className="font-semibold">{entry.authorName}:</span> {entry.body}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="rounded-md bg-white/70 p-3">
                    <h3 className="text-xs font-semibold uppercase text-sky-800">{t(locale, "roomSources")}</h3>
                    {roomAttachments.length === 0 ? (
                      <p className="mt-2 text-sm leading-5">{t(locale, "noFiles")}</p>
                    ) : (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {roomAttachments.slice(0, 5).map((attachment) => (
                          <span key={attachment.id} className="rounded-md bg-white px-2 py-1 text-xs">
                            {attachment.name}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </section>
            )}
            {visibleMessages.map((message) => {
              const isAuthor = message.authorRole !== "mediator-ai";
              return (
                <div key={message.id} className={`grid gap-2 ${isAuthor ? "justify-items-end" : "justify-items-start"}`}>
                  <article
                    className={`max-w-[86%] rounded-lg px-4 py-3 text-sm leading-6 ${
                      isAuthor
                        ? "rx-message-author text-white"
                        : "rx-message-ai text-slate-700"
                    }`}
                  >
                  <p className={`text-xs font-semibold uppercase ${isAuthor ? "text-white/60" : "text-slate-500"}`}>
                    {displayMessageAuthor(message)}
                  </p>
                    <StreamingMarkdownMessage
                      key={`${message.id}-${message.body}`}
                      messageId={message.id}
                      body={localizedMessageBody(message.body, locale)}
                      enabled={message.stream === true}
                      onComplete={(messageId) => {
                        if (isContextMode) {
                          setContextMessages((messages) =>
                            messages.map((currentMessage) =>
                              currentMessage.id === messageId ? { ...currentMessage, stream: false } : currentMessage,
                            ),
                          );
                          return;
                        }

                        onMessageStreamed(messageId);
                      }}
                    />
                  </article>
                </div>
              );
            })}
          </div>
        </div>

        <footer className="border-t border-slate-200 bg-white p-4">
          <div className="mx-auto max-w-3xl">
            {(isVoiceRecording || isVoiceTranscribing) && (
              <div className="mb-3 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm font-medium text-rose-950">
                {isVoiceRecording ? t(locale, "recordingVoice") : t(locale, "transcribingVoice")}
              </div>
            )}
            {voiceError && (
              <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm font-medium text-amber-950">
                {voiceError}
              </div>
            )}
            {visibleAttachments.length > 0 && (
              <div className="mb-3 flex flex-wrap gap-2">
                {visibleAttachments.map((attachment) => (
                  <span key={attachment.id} className="rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-600">
                    {attachment.name} - {fileSizeLabel(attachment.size)}
                    <DocumentIndexingBadge document={attachment} locale={locale} compact />
                  </span>
                ))}
              </div>
            )}
            <label className="sr-only" htmlFor="stakeholder-message">
              {t(locale, "chatMessage")}
            </label>
            <div className="rounded-2xl border border-slate-300 bg-white p-2 shadow-sm focus-within:border-slate-700">
              <textarea
                id="stakeholder-message"
                value={composerInput}
                onChange={(event) => setComposerInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key !== "Enter" || event.ctrlKey || event.nativeEvent.isComposing) {
                    return;
                  }

                  event.preventDefault();
                  void sendComposerMessage();
                }}
                disabled={isContextPending || isSending}
                rows={3}
                placeholder={t(locale, "messagePlaceholder")}
                className="max-h-40 w-full resize-none border-0 bg-transparent px-2 py-2 text-sm leading-6 text-slate-950 outline-none placeholder:text-slate-400 disabled:cursor-not-allowed disabled:text-slate-400"
              />
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1">
                  <label
                    className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full text-slate-600 transition hover:bg-slate-100 hover:text-slate-950"
                    title={t(locale, "attachToChat")}
                    aria-label={t(locale, "attachToChat")}
                  >
                    <PaperclipIcon />
                    <input
                      type="file"
                      multiple
                      className="hidden"
                      onChange={(event) => onFiles(event.target.files)}
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => onVoice(appendComposerTranscript)}
                    disabled={isVoiceTranscribing}
                    title={isVoiceRecording ? t(locale, "stopRecording") : t(locale, "voiceInput")}
                    aria-label={isVoiceRecording ? t(locale, "stopRecording") : t(locale, "voiceInput")}
                    className={`flex h-9 w-9 items-center justify-center rounded-full transition ${
                      isVoiceRecording
                        ? "bg-rose-100 text-rose-700 hover:bg-rose-200"
                        : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"
                    } disabled:cursor-not-allowed disabled:text-slate-300`}
                  >
                    <MicIcon />
                  </button>
                  {!isContextMode && canSynthesize && (
                    <button
                      type="button"
                      onClick={onSynthesize}
                      title={t(locale, "mediatorSynthesis")}
                      aria-label={t(locale, "mediatorSynthesis")}
                      className="flex h-9 w-9 items-center justify-center rounded-full text-slate-600 transition hover:bg-slate-100 hover:text-slate-950"
                    >
                      <SparklesIcon />
                    </button>
                  )}
                </div>
                <button
                  type="button"
                  onClick={sendComposerMessage}
                  disabled={!composerInput.trim() || isContextPending || isSending}
                  title={isContextPending || isSending ? t(locale, "processingRequest") : t(locale, "sendToMediator")}
                  aria-label={isContextPending || isSending ? t(locale, "processingRequest") : t(locale, "sendToMediator")}
                  className="flex h-9 min-w-9 items-center justify-center rounded-full bg-slate-950 px-2 text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  {isContextPending || isSending ? (
                    <span className="flex items-center gap-2 px-1 text-xs font-semibold">
                      <span className="h-2 w-2 animate-pulse rounded-full bg-white" />
                      {t(locale, "processingRequest")}
                    </span>
                  ) : (
                    <SendIcon />
                  )}
                </button>
              </div>
            </div>
          </div>
        </footer>
      </div>
      {!isStakeholder && !isAnalyst && (
        <ElicitationInsightRail
          locale={locale}
          currentUser={currentUser}
          room={room}
          project={project}
          insights={insights}
          onSynthesize={onSynthesize}
          canSynthesize={canSynthesize}
        />
      )}
    </section>
  );
}

function StakeholderImmersiveElicitation({
  locale,
  project,
  room,
  activeSession,
  messages,
  attachments,
  input,
  guidedInterviewTemplate,
  guidedInterviewBlocks,
  structuredRequestSummary,
  pendingClarifications,
  isSending,
  isVoiceRecording,
  isVoiceTranscribing,
  voiceError,
  onInputChange,
  onUsePrompt,
  onSend,
  onFiles,
  onVoice,
  onMessageStreamed,
  onAnswerClarification,
  onBackToPhases,
  onSignOut,
}: {
  locale: Locale;
  project: Project;
  room: ElicitationRoomState;
  activeSession: ElicitationChatSession;
  messages: ElicitationChatMessage[];
  attachments: AttachedDocument[];
  input: string;
  guidedInterviewTemplate?: InstitutionalInterviewTemplate;
  guidedInterviewBlocks: GuidedInterviewBlock[];
  structuredRequestSummary: string;
  pendingClarifications: ClarificationRequest[];
  isSending: boolean;
  isVoiceRecording: boolean;
  isVoiceTranscribing: boolean;
  voiceError: string;
  onInputChange: (value: string) => void;
  onUsePrompt: (value: string) => void;
  onSend: () => void | Promise<void>;
  onFiles: (files: FileList | null) => void | Promise<void>;
  onVoice: () => void;
  onMessageStreamed: (messageId: string) => void;
  onAnswerClarification: (clarificationId: string, response: string) => void | Promise<void>;
  onBackToPhases?: () => void;
  onSignOut?: () => void;
}) {
  const completedBlockIds = new Set(
    guidedInterviewBlocks
      .filter((block) =>
        room.contributions.some(
          (contribution) =>
            contribution.authorRole !== "mediator-ai" && contributionMatchesKeywords(contribution, block.keywords),
        ),
      )
      .map((block) => block.id),
  );
  const activeBlock =
    guidedInterviewBlocks.find((block) => !completedBlockIds.has(block.id)) ?? guidedInterviewBlocks[0];
  const completionLabel =
    guidedInterviewBlocks.length > 0
      ? `${completedBlockIds.size}/${guidedInterviewBlocks.length}`
      : `${room.contributions.length}`;
  const latestMediatorMessage = [...messages].reverse().find((message) => message.authorRole === "mediator-ai");
  const conversation = messages.filter((message) => message.id !== latestMediatorMessage?.id).slice(-3);
  const mainQuestion =
    activeBlock?.questions[0] ??
    "Contame una escena concreta del proceso: quien participa, que necesita lograr y donde se complica.";

  return (
    <section className="rx-stakeholder-immersive min-h-screen">
      <header className="rx-stakeholder-topbar">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase text-slate-500">Requixen</p>
          <p className="truncate text-sm font-semibold text-slate-950">{project.name}</p>
        </div>
        <div className="flex items-center gap-2">
          {onBackToPhases && (
            <button
              type="button"
              onClick={onBackToPhases}
              className="h-9 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800 hover:bg-slate-50"
            >
              {t(locale, "backToPhases")}
            </button>
          )}
          {onSignOut && (
            <button
              type="button"
              onClick={onSignOut}
              className="h-9 rounded-md bg-slate-950 px-3 text-sm font-semibold text-white hover:bg-slate-800"
            >
              Salir
            </button>
          )}
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 pb-8 pt-5 sm:px-6 lg:px-8">
        <div className="rx-stakeholder-progress" aria-label="Avance de entrevista">
          <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm">
            Avance {completionLabel}
          </span>
          {guidedInterviewBlocks.map((block) => {
            const isComplete = completedBlockIds.has(block.id);
            const isActive = block.id === activeBlock?.id;

            return (
              <span
                key={block.id}
                className={`rx-stakeholder-step ${isComplete ? "is-complete" : ""} ${isActive ? "is-active" : ""}`}
              >
                {block.title}
              </span>
            );
          })}
        </div>

        <main className="grid flex-1 content-center gap-7 py-8">
          <section className="rx-stakeholder-focus">
            <p className="text-sm font-semibold uppercase text-emerald-700">Mediador IA</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-normal text-slate-950 sm:text-5xl">
              {guidedInterviewTemplate?.title || "Entrevista guiada"}
            </h1>
            {activeBlock && (
              <div className="mt-6 max-w-3xl">
                <h2 className="text-2xl font-semibold tracking-normal text-slate-950">{activeBlock.title}</h2>
                <p className="rx-stakeholder-question mt-3 text-lg leading-8 text-slate-700">{mainQuestion}</p>
              </div>
            )}
            {latestMediatorMessage && (
              <div className="rx-stakeholder-current mt-6 max-w-3xl">
                <StreamingMarkdownMessage
                  key={`${latestMediatorMessage.id}-${latestMediatorMessage.body}`}
                  messageId={latestMediatorMessage.id}
                  body={localizedMessageBody(latestMediatorMessage.body, locale)}
                  enabled={latestMediatorMessage.stream === true}
                  onComplete={onMessageStreamed}
                />
              </div>
            )}
          </section>

          {pendingClarifications.length > 0 && (
            <StakeholderClarificationInbox
              clarifications={pendingClarifications}
              onAnswer={onAnswerClarification}
              isSending={isSending}
            />
          )}

          <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
            <div className="grid gap-3">
              {conversation.map((message) => {
                const isAuthor = message.authorRole !== "mediator-ai";
                return (
                  <article
                    key={message.id}
                    className={`rx-stakeholder-bubble ${isAuthor ? "is-author" : "is-ai"}`}
                  >
                    <p className="text-xs font-semibold uppercase opacity-70">{displayMessageAuthor(message)}</p>
                    <StreamingMarkdownMessage
                      key={`${message.id}-${message.body}`}
                      messageId={message.id}
                      body={localizedMessageBody(message.body, locale)}
                      enabled={message.stream === true}
                      onComplete={onMessageStreamed}
                    />
                  </article>
                );
              })}
            </div>

            <aside className="rx-stakeholder-summary">
              <h3 className="text-sm font-semibold text-slate-950">Solicitud relevada</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                El resumen se arma con lo que vas contando y queda listo para que el analista trabaje requisitos.
              </p>
              {structuredRequestSummary ? (
                <div className="mt-3 max-h-56 overflow-auto text-slate-700">
                  <MarkdownMessage body={structuredRequestSummary} />
                </div>
              ) : (
                <p className="mt-3 text-sm text-slate-500">Todavia no hay aportes suficientes para sintetizar.</p>
              )}
            </aside>
          </section>

          <footer className="rx-stakeholder-composer">
            {(isVoiceRecording || isVoiceTranscribing) && (
              <div className="rx-stakeholder-voice-state">
                <span className="rx-stakeholder-voice-dot" />
                {isVoiceRecording ? t(locale, "recordingVoice") : t(locale, "transcribingVoice")}
              </div>
            )}
            {voiceError && (
              <div className="mb-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-950">
                {voiceError}
              </div>
            )}
            {attachments.length > 0 && (
              <div className="mb-3 flex flex-wrap gap-2">
                {attachments.map((attachment) => (
                  <span key={attachment.id} className="rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-600">
                    {attachment.name} - {fileSizeLabel(attachment.size)}
                    <DocumentIndexingBadge document={attachment} locale={locale} compact />
                  </span>
                ))}
              </div>
            )}
            <label className="sr-only" htmlFor="stakeholder-immersive-message">
              {t(locale, "chatMessage")}
            </label>
            <textarea
              id="stakeholder-immersive-message"
              value={input}
              onChange={(event) => onInputChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key !== "Enter" || event.ctrlKey || event.nativeEvent.isComposing) {
                  return;
                }

                event.preventDefault();
                void onSend();
              }}
              disabled={isSending}
              rows={4}
              placeholder="Escribi como lo contarias en una reunion. Tambien podes dictarlo."
              className="w-full resize-none bg-transparent px-1 py-1 text-lg leading-8 text-slate-950 outline-none placeholder:text-slate-400 disabled:cursor-not-allowed disabled:text-slate-400"
            />
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <label
                  className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                  title={t(locale, "attachToChat")}
                  aria-label={t(locale, "attachToChat")}
                >
                  <PaperclipIcon />
                  <input type="file" multiple className="hidden" onChange={(event) => onFiles(event.target.files)} />
                </label>
                <button
                  type="button"
                  onClick={onVoice}
                  disabled={isVoiceTranscribing}
                  title={isVoiceRecording ? t(locale, "stopRecording") : t(locale, "voiceInput")}
                  aria-label={isVoiceRecording ? t(locale, "stopRecording") : t(locale, "voiceInput")}
                  className={`rx-stakeholder-mic ${isVoiceRecording ? "is-recording" : ""}`}
                >
                  <MicIcon />
                </button>
                {activeBlock && (
                  <button
                    type="button"
                    onClick={() => onUsePrompt(activeBlock.prompt)}
                    className="h-10 rounded-md border border-emerald-200 bg-white px-3 text-sm font-semibold text-emerald-900 hover:bg-emerald-50"
                  >
                    Usar esta guia
                  </button>
                )}
              </div>
              <button
                type="button"
                onClick={onSend}
                disabled={!input.trim() || isSending}
                title={isSending ? t(locale, "processingRequest") : t(locale, "sendToMediator")}
                aria-label={isSending ? t(locale, "processingRequest") : t(locale, "sendToMediator")}
                className="flex h-11 min-w-11 items-center justify-center rounded-full bg-slate-950 px-4 text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {isSending ? (
                  <span className="flex items-center gap-2 text-sm font-semibold">
                    <span className="h-2 w-2 animate-pulse rounded-full bg-white" />
                    {t(locale, "processingRequest")}
                  </span>
                ) : (
                  <SendIcon />
                )}
              </button>
            </div>
            <p className="mt-3 text-xs text-slate-500">
              Chat activo: {activeSession.title}. La IA convierte tus respuestas en insumos para requisitos.
            </p>
          </footer>
        </main>
      </div>
    </section>
  );
}

function InstitutionalGuidedInterviewPanel({
  template,
  blocks,
  summary,
  onUsePrompt,
}: {
  template?: InstitutionalInterviewTemplate;
  blocks: GuidedInterviewBlock[];
  summary: string;
  onUsePrompt: (value: string) => void;
}) {
  const [activeBlockId, setActiveBlockId] = useState(blocks[0]?.id ?? "");
  const activeBlock = blocks.find((block) => block.id === activeBlockId) ?? blocks[0];

  if (!activeBlock) {
    return null;
  }

  return (
    <section className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-emerald-950">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase text-emerald-700">Entrevista guiada</p>
          <h3 className="mt-1 text-lg font-semibold">{template?.title || "Entrevista institucional"}</h3>
          <p className="mt-2 max-w-2xl text-sm leading-6">
            Usa estos bloques para conversar con el area solicitante en lenguaje operativo. Cada bloque deja insumos para la ficha de solicitud relevada.
          </p>
        </div>
        <button
          type="button"
          onClick={() => onUsePrompt(summary)}
          className="h-9 shrink-0 rounded-md border border-emerald-300 bg-white px-3 text-sm font-semibold text-emerald-900 hover:bg-emerald-100"
        >
          Llevar ficha al chat
        </button>
      </div>

      <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
        {blocks.map((block) => (
          <button
            key={block.id}
            type="button"
            onClick={() => setActiveBlockId(block.id)}
            className={`shrink-0 rounded-md border px-3 py-2 text-sm font-semibold ${
              block.id === activeBlock.id
                ? "border-emerald-900 bg-emerald-900 text-white"
                : "border-emerald-200 bg-white text-emerald-950 hover:border-emerald-400"
            }`}
          >
            {block.title}
          </button>
        ))}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.8fr)]">
        <article className="rounded-lg border border-emerald-200 bg-white p-4">
          <h4 className="text-sm font-semibold text-emerald-950">{activeBlock.title}</h4>
          <p className="mt-2 text-sm leading-6 text-emerald-800">{activeBlock.goal}</p>
          <ul className="mt-3 grid list-disc gap-1 pl-5 text-sm leading-6 text-slate-700">
            {activeBlock.questions.map((question) => (
              <li key={question}>{question}</li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => onUsePrompt(activeBlock.prompt)}
            className="mt-4 h-9 rounded-md bg-slate-950 px-3 text-sm font-semibold text-white hover:bg-slate-800"
          >
            Usar este bloque
          </button>
        </article>

        <article className="rounded-lg border border-emerald-200 bg-white p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h4 className="text-sm font-semibold text-emerald-950">Solicitud relevada</h4>
              <p className="mt-2 text-sm leading-6 text-emerald-800">
                Vista preliminar para que un area no tecnica revise que entendimos del pedido.
              </p>
            </div>
          </div>
          <div className="mt-3 max-h-72 overflow-auto rounded-md bg-slate-50 p-3 text-slate-700">
            <MarkdownMessage body={summary} />
          </div>
        </article>
      </div>
    </section>
  );
}

function AnalystGuidedElicitationRoom({
  project,
  room,
  activeSession,
  templates,
  clarifications,
  isSending,
  onRunMediatorPrompt,
  onCreateClarificationDrafts,
  onUpdateClarificationDraft,
  onSendClarification,
  onCreateRequirementCandidate,
  onCloseClarification,
  onCreateCandidateFromClarification,
}: {
  project: Project;
  room: ElicitationRoomState;
  activeSession: ElicitationChatSession;
  templates: InstitutionalInterviewTemplate[];
  clarifications: ClarificationRequest[];
  isSending: boolean;
  onRunMediatorPrompt: (prompt: string) => void | Promise<void>;
  onCreateClarificationDrafts: (questions: string[]) => void;
  onUpdateClarificationDraft: (
    clarificationId: string,
    data: Partial<Pick<ClarificationRequest, "question" | "targetUserId" | "targetName">>,
  ) => void;
  onSendClarification: (clarificationId: string) => void | Promise<void>;
  onCreateRequirementCandidate: (
    contributions: ElicitationContribution[],
    draft: RequirementCandidateDraft,
  ) => void;
  onCloseClarification: (clarificationId: string) => void | Promise<void>;
  onCreateCandidateFromClarification: (clarificationId: string) => void;
}) {
  const latestMediatorMessage = activeSession.messages.filter((message) => message.authorRole === "mediator-ai").at(-1);
  const clarificationDrafts = clarifications.filter((clarification) => clarification.status === "draft");
  const sentClarifications = clarifications.filter((clarification) => clarification.status !== "draft");
  const stakeholderOptions = project.participants.filter((participant) => participant.role === "stakeholder");
  const guidedInterviewTemplate = institutionalInterviewTemplateFor(project, templates);
  const structuredRequestSummary = guidedInterviewTemplate
    ? buildInstitutionalRequestSummary(project, room, templates)
    : "";
  const structuredEvidence = room.contributions.filter((contribution) => contribution.authorRole !== "mediator-ai").slice(0, 8);
  const processPrompt =
    "Mediador, procesa toda la elicitacion disponible del proyecto. Devuelve una sintesis ejecutiva para el analista y recomienda CTAs concretos. Incluye: hechos confirmados, inferencias o supuestos, dudas abiertas, fuentes usadas, riesgos de alucinacion o falta de trazabilidad, y la accion recomendada para continuar.";
  const recommendedActions = [
    {
      title: "Pedir aclaraciones",
      description: "Convertir dudas abiertas en preguntas concretas para stakeholders.",
      kind: "clarifications",
      prompt:
        "Mediador, identifica las dudas abiertas mas importantes y transformalas en preguntas claras para stakeholders. Prioriza las que bloquean el analisis.",
    },
    {
      title: "Preparar candidatos",
      description: "Generar candidatos iniciales de requisitos con fuente y confianza.",
      kind: "mediator",
      prompt:
        "Mediador, prepara candidatos iniciales de requisitos a partir de lo elicitado. Para cada candidato incluye fuente, nivel de confianza y supuestos.",
    },
    {
      title: "Revisar trazabilidad",
      description: "Detectar afirmaciones sin fuente, inferencias y riesgos de fabricacion.",
      kind: "mediator",
      prompt:
        "Mediador, revisa la trazabilidad de lo elicitado. Marca que afirmaciones tienen fuente, cuales son inferencias y donde existe riesgo de informacion fabricada.",
    },
    {
      title: "Evaluar cierre",
      description: "Decidir si la fase puede avanzar a analisis o necesita mas elicitacion.",
      kind: "mediator",
      prompt:
        "Mediador, evalua si la fase de elicitacion puede cerrarse. Indica criterios cumplidos, pendientes minimos y riesgos de avanzar a analisis.",
    },
  ];

  return (
    <section className="rx-room-shell mt-4 min-h-[38rem] overflow-hidden rounded-lg border bg-white">
      <div className="flex min-h-[38rem] flex-col">
        <header className="border-b border-slate-200 bg-white p-5">
          <p className="text-sm font-semibold uppercase text-slate-500">Sala de elicitacion</p>
          <div className="mt-2 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h2 className="text-2xl font-semibold tracking-normal text-slate-950">
                Procesar elicitacion con el Mediador
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                Proyecto: <span className="font-semibold text-slate-800">{project.name}</span>. El analista ejecuta un procesamiento unico de lo conversado y recibe recomendaciones de accion para
                aclarar, trazar, preparar candidatos o cerrar la fase.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void onRunMediatorPrompt(processPrompt)}
              disabled={isSending}
              className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-md bg-slate-950 px-4 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {isSending ? (
                <>
                  <span className="h-2 w-2 animate-pulse rounded-full bg-white" />
                  Procesando...
                </>
              ) : (
                <>
                  <SparklesIcon />
                  Procesar elicitacion
                </>
              )}
            </button>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-auto p-5">
          <div className="grid gap-4">
            <AnalystGuidedCard title="Respuesta reciente del Mediador">
              {latestMediatorMessage ? (
                <MarkdownMessage body={localizedMessageBody(latestMediatorMessage.body, "es")} />
              ) : (
                <p className="text-sm leading-6 text-slate-500">
                  Todavia no hay una respuesta del Mediador para este proyecto.
                </p>
              )}
            </AnalystGuidedCard>

            {structuredRequestSummary && (
              <AnalystGuidedCard title="Solicitud relevada">
                <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_14rem]">
                  <div className="rounded-md bg-slate-50 p-3 text-slate-700">
                    <MarkdownMessage body={structuredRequestSummary} />
                  </div>
                  <div className="grid content-start gap-2">
                    <p className="text-sm leading-6 text-slate-600">
                      Convierte esta ficha en un candidato trazable para que el analista la refine en la capa Mediador.
                    </p>
                    <button
                      type="button"
                      onClick={() =>
                        onCreateRequirementCandidate(structuredEvidence, {
                          title: `Solicitud relevada - ${guidedInterviewTemplate?.title || "pedido institucional"}`,
                          type: "Structured elicitation brief",
                          body: structuredRequestSummary,
                          source:
                            structuredEvidence.length > 0
                              ? sourceSummaryFromContributions(structuredEvidence)
                              : `Solicitud institucional inicial y plantilla ${guidedInterviewTemplate?.title || "institucional"}.`,
                          assumptions:
                            `La ficha resume la conversacion disponible y debe ser confirmada por ${guidedInterviewTemplate?.confirmationArea || "el area solicitante"} antes de aprobar requisitos.`,
                          confidence: structuredEvidence.length > 0 ? averageContributionConfidence(structuredEvidence) : 0.68,
                        })
                      }
                      disabled={structuredEvidence.length === 0}
                      className="h-10 rounded-md bg-slate-950 px-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                    >
                      Crear candidato
                    </button>
                  </div>
                </div>
              </AnalystGuidedCard>
            )}

            <ElicitationContributionReviewPanel
              contributions={room.contributions}
              onCreateRequirementCandidate={onCreateRequirementCandidate}
            />

            <section className="rounded-lg border border-slate-200 bg-white p-4">
              <h3 className="text-xs font-semibold uppercase text-slate-500">Recomendaciones de accion</h3>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                {recommendedActions.map((action) => (
                  <button
                    key={action.title}
                    type="button"
                    onClick={() => {
                      if (action.kind === "clarifications") {
                        onCreateClarificationDrafts(extractClarificationQuestions(latestMediatorMessage?.body ?? ""));
                        return;
                      }

                      void onRunMediatorPrompt(action.prompt);
                    }}
                    disabled={isSending}
                    className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-left hover:border-slate-300 hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <span className="block text-sm font-semibold text-slate-950">{action.title}</span>
                    <span className="mt-2 block text-sm leading-5 text-slate-600">{action.description}</span>
                  </button>
                ))}
              </div>
            </section>

            <AnalystClarificationRequests
              clarifications={[...clarificationDrafts, ...sentClarifications]}
              stakeholders={stakeholderOptions}
              onUpdateDraft={onUpdateClarificationDraft}
              onSend={onSendClarification}
              onClose={onCloseClarification}
              onCreateCandidate={onCreateCandidateFromClarification}
              isSending={isSending}
            />
          </div>
        </div>
      </div>
    </section>
  );
}

function ElicitationContributionReviewPanel({
  contributions,
  onCreateRequirementCandidate,
}: {
  contributions: ElicitationContribution[];
  onCreateRequirementCandidate: (
    contributions: ElicitationContribution[],
    draft: RequirementCandidateDraft,
  ) => void;
}) {
  const [filter, setFilter] = useState<ElicitationContribution["kind"] | "all">("all");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [draft, setDraft] = useState<RequirementCandidateDraft | null>(null);
  const counts = contributionKinds.map((kind) => ({
    kind,
    count: contributions.filter((contribution) => contribution.kind === kind).length,
  }));
  const visibleContributions =
    filter === "all"
      ? contributions
      : contributions.filter((contribution) => contribution.kind === filter);
  const selectedContributions = contributions.filter((contribution) => selectedIds.includes(contribution.id));

  function toggleContribution(contributionId: string) {
    setSelectedIds((current) =>
      current.includes(contributionId)
        ? current.filter((id) => id !== contributionId)
        : [...current, contributionId],
    );
  }

  function startCandidateDraft() {
    if (selectedContributions.length === 0) {
      return;
    }

    const primary = selectedContributions[0];
    setDraft({
      title: primary.kind === "question" ? "REQ por aclarar" : "REQ candidato",
      type: "Raw requirement",
      body: candidateBodyFromContributions(selectedContributions),
      source: sourceSummaryFromContributions(selectedContributions),
      assumptions:
        "Revisar si el candidato representa una necesidad confirmada o una inferencia antes de aprobarlo.",
      confidence: averageContributionConfidence(selectedContributions),
    });
  }

  function saveCandidateDraft() {
    if (!draft || selectedContributions.length === 0) {
      return;
    }

    onCreateRequirementCandidate(selectedContributions, draft);
    setDraft(null);
    setSelectedIds([]);
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h3 className="text-xs font-semibold uppercase text-slate-500">Aportes y evidencia</h3>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            Revisa lo capturado antes de pedir aclaraciones o generar candidatos. Cada aporte queda listo para usarse como
            evidencia trazable cuando se produzcan artefactos.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="w-fit rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">
            {contributions.length} aportes
          </span>
          <button
            type="button"
            onClick={startCandidateDraft}
            disabled={selectedContributions.length === 0}
            className="h-8 rounded-md bg-slate-950 px-3 text-xs font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            Crear candidato
          </button>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setFilter("all")}
          className={`rounded-md border px-3 py-1.5 text-xs font-semibold ${
            filter === "all"
              ? "border-slate-950 bg-slate-950 text-white"
              : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
          }`}
        >
          Todos
        </button>
        {counts.map(({ kind, count }) => (
          <button
            key={kind}
            type="button"
            onClick={() => setFilter(kind)}
            className={`rounded-md border px-3 py-1.5 text-xs font-semibold ${
              filter === kind
                ? "border-slate-950 bg-slate-950 text-white"
                : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
            }`}
          >
            {contributionKindLabels[kind]} {count}
          </button>
        ))}
      </div>

      {visibleContributions.length === 0 ? (
        <p className="mt-4 rounded-lg border border-dashed border-slate-300 p-4 text-sm text-slate-500">
          No hay aportes en esta categoria todavia.
        </p>
      ) : (
        <div className="mt-4 grid gap-3">
          {visibleContributions.slice(0, 8).map((contribution, index) => (
            <article
              key={contribution.id}
              className={`rounded-lg border p-3 ${
                selectedIds.includes(contribution.id)
                  ? "border-slate-950 bg-white"
                  : "border-slate-200 bg-slate-50"
              }`}
            >
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(contribution.id)}
                        onChange={() => toggleContribution(contribution.id)}
                        className="h-4 w-4 rounded border-slate-300"
                      />
                      Usar
                    </label>
                    <span
                      className={`rounded-md border px-2 py-1 text-[11px] font-semibold ${contributionKindTone[contribution.kind]}`}
                    >
                      {contributionKindLabels[contribution.kind]}
                    </span>
                    <span className="text-xs text-slate-500">
                      {contribution.authorName} - {contribution.timestamp}
                    </span>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-slate-800">{contribution.body}</p>
                </div>
                <div className="grid shrink-0 gap-2 text-xs text-slate-600 lg:w-44">
                  <span className="rounded-md bg-white px-2 py-1">
                    Confianza {contributionConfidenceLabel(contribution, index)}
                  </span>
                  <span className="rounded-md bg-white px-2 py-1">
                    {contributionEvidenceStatus(contribution.kind)}
                  </span>
                  {contribution.sourceMessageId && (
                    <span className="rounded-md bg-white px-2 py-1">
                      Mensaje {contribution.sourceMessageId.slice(-6)}
                    </span>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {draft && (
        <div className="mt-4 rounded-lg border border-slate-300 bg-slate-50 p-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h4 className="text-xs font-semibold uppercase text-slate-500">Editor de candidato</h4>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                Ajusta el texto antes de convertirlo en artefacto trazable de la capa Mediador.
              </p>
            </div>
            <span className="w-fit rounded-md bg-white px-2 py-1 text-xs font-semibold text-slate-600">
              {selectedContributions.length} fuente(s)
            </span>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_12rem]">
            <label className="grid gap-1 text-sm font-semibold text-slate-700">
              Titulo
              <input
                value={draft.title}
                onChange={(event) => setDraft((current) => current && { ...current, title: event.target.value })}
                className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm font-normal text-slate-950 outline-none focus:border-slate-700"
              />
            </label>
            <label className="grid gap-1 text-sm font-semibold text-slate-700">
              Tipo
              <select
                value={draft.type}
                onChange={(event) => setDraft((current) => current && { ...current, type: event.target.value })}
                className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm font-normal text-slate-950 outline-none focus:border-slate-700"
              >
                <option>Raw requirement</option>
                <option>Clarification log</option>
                <option>Glossary entry</option>
                <option>Assumption</option>
              </select>
            </label>
          </div>
          <label className="mt-3 grid gap-1 text-sm font-semibold text-slate-700">
            Cuerpo
            <textarea
              value={draft.body}
              onChange={(event) => setDraft((current) => current && { ...current, body: event.target.value })}
              rows={4}
              className="resize-none rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-normal leading-6 text-slate-950 outline-none focus:border-slate-700"
            />
          </label>
          <label className="mt-3 grid gap-1 text-sm font-semibold text-slate-700">
            Fuente
            <textarea
              value={draft.source}
              onChange={(event) => setDraft((current) => current && { ...current, source: event.target.value })}
              rows={2}
              className="resize-none rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-normal leading-6 text-slate-950 outline-none focus:border-slate-700"
            />
          </label>
          <div className="mt-3 grid gap-3 md:grid-cols-[minmax(0,1fr)_12rem]">
            <label className="grid gap-1 text-sm font-semibold text-slate-700">
              Supuestos
              <textarea
                value={draft.assumptions}
                onChange={(event) => setDraft((current) => current && { ...current, assumptions: event.target.value })}
                rows={3}
                className="resize-none rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-normal leading-6 text-slate-950 outline-none focus:border-slate-700"
              />
            </label>
            <label className="grid content-start gap-2 text-sm font-semibold text-slate-700">
              Confianza
              <input
                type="range"
                min="0.35"
                max="0.95"
                step="0.01"
                value={draft.confidence}
                onChange={(event) =>
                  setDraft((current) => current && { ...current, confidence: Number(event.target.value) })
                }
              />
              <span className="rounded-md bg-white px-2 py-1 text-center text-xs text-slate-600">
                {Math.round(draft.confidence * 100)}%
              </span>
            </label>
          </div>
          <div className="mt-4 flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={() => setDraft(null)}
              className="h-9 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-100"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={saveCandidateDraft}
              disabled={!draft.title.trim() || !draft.body.trim()}
              className="h-9 rounded-md bg-slate-950 px-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              Guardar candidato
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

function AnalystGuidedCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4">
      <h4 className="text-xs font-semibold uppercase text-slate-500">{title}</h4>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function AnalystClarificationRequests({
  clarifications,
  stakeholders,
  onUpdateDraft,
  onSend,
  onClose,
  onCreateCandidate,
  isSending,
}: {
  clarifications: ClarificationRequest[];
  stakeholders: ProjectParticipant[];
  onUpdateDraft: (
    clarificationId: string,
    data: Partial<Pick<ClarificationRequest, "question" | "targetUserId" | "targetName">>,
  ) => void;
  onSend: (clarificationId: string) => void | Promise<void>;
  onClose: (clarificationId: string) => void | Promise<void>;
  onCreateCandidate: (clarificationId: string) => void;
  isSending: boolean;
}) {
  const sentCount = clarifications.filter((clarification) => clarification.status === "sent").length;
  const answeredCount = clarifications.filter((clarification) => clarification.status === "answered").length;
  const closedCount = clarifications.filter((clarification) => clarification.status === "closed").length;

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-xs font-semibold uppercase text-slate-500">Aclaraciones para stakeholders</h3>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Revisa las preguntas antes de enviarlas. Cuando se envian, aparecen como pendientes en la sala de elicitacion
            del stakeholder.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="w-fit rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">
            {clarifications.length} solicitudes
          </span>
          <span className="w-fit rounded-md bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-700">
            {sentCount} pendientes
          </span>
          <span className="w-fit rounded-md bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700">
            {answeredCount} respondidas
          </span>
          <span className="w-fit rounded-md bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-600">
            {closedCount} cerradas
          </span>
        </div>
      </div>

      {clarifications.length === 0 ? (
        <p className="mt-4 rounded-lg border border-dashed border-slate-300 p-4 text-sm text-slate-500">
          Usa Pedir aclaraciones para crear borradores a partir de la ultima respuesta del Mediador.
        </p>
      ) : (
        <div className="mt-4 grid gap-3">
          {clarifications.map((clarification) => {
            const isDraft = clarification.status === "draft";

            return (
              <article key={clarification.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0 flex-1">
                    {isDraft ? (
                      <textarea
                        value={clarification.question}
                        onChange={(event) => onUpdateDraft(clarification.id, { question: event.target.value })}
                        rows={3}
                        className="w-full resize-none rounded-md border border-slate-300 bg-white px-3 py-2 text-sm leading-6 text-slate-950 outline-none focus:border-slate-700"
                      />
                    ) : (
                      <p className="text-sm leading-6 text-slate-800">{clarification.question}</p>
                    )}
                    <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      <span className="rounded-md bg-white px-2 py-1">Para: {clarification.targetName}</span>
                      <span className="rounded-md bg-white px-2 py-1">{clarificationStatusLabel(clarification)}</span>
                    </div>
                    {clarification.response && (
                      <div className="mt-3 rounded-md border border-emerald-200 bg-emerald-100 p-3 text-sm leading-6 text-emerald-800">
                        <p className="font-semibold">Respuesta de {clarification.respondedByName}</p>
                        <p className="mt-1">{clarification.response}</p>
                      </div>
                    )}
                    {clarification.status === "answered" && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => onCreateCandidate(clarification.id)}
                          className="h-9 rounded-md bg-slate-950 px-3 text-sm font-semibold text-white hover:bg-slate-800"
                        >
                          Crear candidato
                        </button>
                        <button
                          type="button"
                          onClick={() => void onClose(clarification.id)}
                          disabled={isSending}
                          className="h-9 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Cerrar
                        </button>
                      </div>
                    )}
                  </div>

                  {isDraft && (
                    <div className="grid gap-2 lg:w-56">
                      <select
                        value={clarification.targetUserId}
                        onChange={(event) => {
                          const target = stakeholders.find((stakeholder) => stakeholder.userId === event.target.value);
                          onUpdateDraft(clarification.id, {
                            targetUserId: event.target.value,
                            targetName: target?.name ?? "Todos los stakeholders",
                          });
                        }}
                        className="h-9 rounded-md border border-slate-300 bg-white px-2 text-sm outline-none focus:border-slate-700"
                      >
                        <option value="">Todos los stakeholders</option>
                        {stakeholders.map((stakeholder) => (
                          <option key={stakeholder.userId} value={stakeholder.userId}>
                            {stakeholder.name}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => void onSend(clarification.id)}
                        disabled={isSending || !clarification.question.trim()}
                        className="h-9 rounded-md bg-slate-950 px-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                      >
                        Enviar solicitud
                      </button>
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

function StakeholderClarificationInbox({
  clarifications,
  onAnswer,
  isSending,
}: {
  clarifications: ClarificationRequest[];
  onAnswer: (clarificationId: string, response: string) => void | Promise<void>;
  isSending: boolean;
}) {
  const [answers, setAnswers] = useState<Record<string, string>>({});

  return (
    <section className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-950">
      <h3 className="text-xs font-semibold uppercase">Preguntas pendientes del analista</h3>
      <div className="mt-3 grid gap-3">
        {clarifications.map((clarification) => (
          <article key={clarification.id} className="rounded-lg border border-amber-200 bg-white p-3">
            <p className="text-sm font-semibold leading-6 text-slate-950">{clarification.question}</p>
            <textarea
              value={answers[clarification.id] ?? ""}
              onChange={(event) => setAnswers((current) => ({ ...current, [clarification.id]: event.target.value }))}
              rows={3}
              placeholder="Responder aclaracion"
              className="mt-3 w-full resize-none rounded-md border border-slate-300 bg-white px-3 py-2 text-sm leading-6 text-slate-950 outline-none focus:border-slate-700"
            />
            <div className="mt-2 flex justify-end">
              <button
                type="button"
                onClick={async () => {
                  const response = answers[clarification.id] ?? "";
                  await onAnswer(clarification.id, response);
                  setAnswers((current) => ({ ...current, [clarification.id]: "" }));
                }}
                disabled={isSending || !(answers[clarification.id] ?? "").trim()}
                className="h-9 rounded-md bg-slate-950 px-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                Enviar respuesta
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function clarificationStatusLabel(clarification: ClarificationRequest) {
  if (clarification.status === "draft") {
    return "Borrador";
  }

  if (clarification.status === "answered") {
    return `Respondida${clarification.respondedAt ? ` - ${clarification.respondedAt}` : ""}`;
  }

  if (clarification.status === "closed") {
    return "Cerrada";
  }

  return `Enviada${clarification.sentAt ? ` - ${clarification.sentAt}` : ""}`;
}

function extractClarificationQuestions(source: string) {
  const questions = source
    .split(/\n+/)
    .map((line) =>
      line
        .replace(/^\s*[-*]\s+/, "")
        .replace(/^\s*\d+[.)]\s+/, "")
        .replace(/\*\*/g, "")
        .trim(),
    )
    .filter((line) => line.includes("?") || line.includes("¿"))
    .map((line) => line.replace(/^\s*Prioridad\s+\w+\s*/i, "").trim())
    .filter(Boolean);

  if (questions.length > 0) {
    return [...new Set(questions)].slice(0, 5);
  }

  return [
    "Que datos exactos se solicitan hoy y cuales son obligatorios?",
    "Que excepciones o errores aparecen con mas frecuencia en el proceso actual?",
    "Quien revisa o aprueba la informacion antes de cerrar el tramite?",
  ];
}

function AnalystRoomSidebar({
  room,
  project,
  insights,
}: {
  room: ElicitationRoomState;
  project: Project;
  insights: ElicitationInsight[];
}) {
  const stakeholderCount = new Set(
    project.participants
      .filter((participant) => participant.role === "stakeholder")
      .map((participant) => participant.userId),
  ).size;
  const activeContributors = new Set(
    room.contributions
      .filter((contribution) => contribution.authorRole !== "mediator-ai")
      .map((contribution) => contribution.authorName),
  ).size;
  const openSignals = insights.filter((insight) => insight.kind === "question" || insight.kind === "risk-note").length;

  return (
    <section className="mt-5 grid gap-3">
      <div className="rounded-lg border border-slate-200 bg-white p-3">
        <h3 className="text-xs font-semibold uppercase text-slate-500">Cobertura</h3>
        <div className="mt-3 grid gap-2 text-sm">
          <AnalystSidebarMetric label="Stakeholders" value={`${activeContributors}/${Math.max(stakeholderCount, 1)}`} />
          <AnalystSidebarMetric label="Chats activos" value={`${room.sessions.length}`} />
          <AnalystSidebarMetric label="Fuentes" value={`${room.attachments.length + project.documents.length}`} />
        </div>
      </div>
      <div className="rounded-lg border border-slate-200 bg-white p-3">
        <h3 className="text-xs font-semibold uppercase text-slate-500">Seguimiento</h3>
        <p className="mt-2 text-sm leading-5 text-slate-700">
          {openSignals > 0
            ? `${openSignals} senal(es) requieren aclaracion antes de pasar a analisis.`
            : "No hay senales criticas detectadas en este momento."}
        </p>
      </div>
    </section>
  );
}

function AnalystSidebarMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md bg-slate-50 px-2 py-2">
      <span className="text-slate-600">{label}</span>
      <span className="font-semibold text-slate-950">{value}</span>
    </div>
  );
}

function AnalystElicitationControlPanel({
  room,
  project,
  insights,
  canSynthesize,
  onSynthesize,
  onUsePrompt,
}: {
  room: ElicitationRoomState;
  project: Project;
  insights: ElicitationInsight[];
  canSynthesize: boolean;
  onSynthesize: () => void;
  onUsePrompt: (prompt: string) => void;
}) {
  const recentInputs = room.contributions.filter((entry) => entry.authorRole !== "mediator-ai").slice(0, 3);
  const pendingSignals = insights.filter((insight) => insight.kind === "question" || insight.kind === "risk-note").slice(0, 3);
  const promptActions = [
    "Mediador, sintetiza los aportes recientes y separa hechos confirmados de inferencias.",
    "Mediador, identifica preguntas de aclaracion para los stakeholders que todavia faltan.",
    "Mediador, prepara candidatos iniciales de requisitos con fuente y nivel de confianza.",
  ];

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase text-slate-500">Panel de conduccion</p>
          <h3 className="mt-1 text-lg font-semibold text-slate-950">Lo que el analista necesita mirar ahora</h3>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">
            Proyecto: <span className="font-semibold text-slate-800">{project.name}</span>. Usa esta vista para coordinar
            preguntas, fuentes y trazabilidad antes de avanzar a la capa de analisis.
          </p>
        </div>
        <button
          type="button"
          onClick={onSynthesize}
          disabled={!canSynthesize}
          className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-md bg-slate-950 px-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          <SparklesIcon />
          Sintetizar
        </button>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <AnalystWorkCard title="Aportes recientes">
          {recentInputs.length === 0 ? (
            <p className="text-sm leading-5 text-slate-500">Todavia no hay aportes de usuarios para revisar.</p>
          ) : (
            <div className="grid gap-2">
              {recentInputs.map((entry) => (
                <p key={entry.id} className="text-sm leading-5 text-slate-700">
                  <span className="font-semibold text-slate-950">{entry.authorName}:</span> {entry.body}
                </p>
              ))}
            </div>
          )}
        </AnalystWorkCard>

        <AnalystWorkCard title="Senales pendientes">
          {pendingSignals.length === 0 ? (
            <p className="text-sm leading-5 text-slate-500">Sin preguntas o riesgos destacados por ahora.</p>
          ) : (
            <div className="grid gap-2">
              {pendingSignals.map((signal) => (
                <p key={signal.id} className="text-sm leading-5 text-slate-700">
                  <span className="font-semibold text-slate-950">{signal.title}:</span> {signal.body}
                </p>
              ))}
            </div>
          )}
        </AnalystWorkCard>

        <AnalystWorkCard title="Comandos utiles">
          <div className="grid gap-2">
            {promptActions.map((prompt) => (
              <button
                key={prompt}
                type="button"
                onClick={() => onUsePrompt(prompt)}
                className="rounded-md border border-slate-200 bg-white px-3 py-2 text-left text-sm leading-5 text-slate-700 hover:border-slate-300 hover:bg-slate-50"
              >
                {prompt}
              </button>
            ))}
          </div>
        </AnalystWorkCard>
      </div>
    </section>
  );
}

function AnalystWorkCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <article className="rounded-lg border border-slate-200 bg-slate-50 p-3">
      <h4 className="text-xs font-semibold uppercase text-slate-500">{title}</h4>
      <div className="mt-3">{children}</div>
    </article>
  );
}

function PaperclipIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="m21.4 11.6-8.5 8.5a6 6 0 0 1-8.5-8.5l9.2-9.2a4 4 0 0 1 5.7 5.7l-9.2 9.2a2 2 0 0 1-2.8-2.8l8.5-8.5" />
    </svg>
  );
}

function MicIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v3M8 22h8" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

function SparklesIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3ZM19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15Z" />
    </svg>
  );
}

function EditIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 20h9" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5Z" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 6h18" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v5M14 11v5" />
    </svg>
  );
}

function preferredAudioMimeType() {
  if (typeof MediaRecorder === "undefined") {
    return "";
  }

  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/mpeg"];
  return candidates.find((candidate) => MediaRecorder.isTypeSupported(candidate)) ?? "";
}

function roomStatsLabel(locale: Locale, room: ElicitationRoomState) {
  if (locale === "en") {
    return `${room.sessions.length} active chats in this room. ${room.contributions.length} registered inputs.`;
  }

  return `${room.sessions.length} chats activos en esta sala. ${room.contributions.length} aportes registrados.`;
}

function projectContextIntro(project: Project, room: ElicitationRoomState) {
  const stakeholders = stakeholderNames(project).join(", ") || "stakeholders asignados";
  const sources =
    project.documents.length > 0
      ? `${project.documents.length} documento(s) adjunto(s)`
      : "sin documentos adjuntos";
  const institutionalContext = institutionalRequestContext(project);

  return [
    `Te pongo en contexto sobre **${project.name}**.`,
    "",
    ...(institutionalContext ? ["**Solicitud institucional:**", institutionalContext, ""] : []),
    `- **Area:** ${project.municipality}`,
    `- **Situacion inicial:** ${project.summary}`,
    `- **Stakeholders:** ${stakeholders}`,
    `- **Fuentes disponibles:** ${sources}`,
    `- **Trabajo paralelo:** ${room.sessions.length} chats activos y ${room.contributions.length} aportes registrados.`,
    "",
    "Puedes preguntarme que se sabe hasta ahora, que falta aclarar o como se relaciona tu aporte con el proyecto.",
  ].join("\n");
}

function elicitationWelcomeMessage(project: Project, user: User) {
  const institutionalContext = institutionalRequestContext(project);

  return [
    `Hola ${user.name}. Soy el Mediador de Requixen para el proyecto **${project.name}**.`,
    "",
    ...(institutionalContext
      ? [
          "La conversacion parte de esta solicitud institucional:",
          institutionalContext,
          "",
          institutionalInterviewTemplateFor(project)
            ? `Voy a conducir una entrevista guiada con la plantilla "${institutionalInterviewTemplateFor(project)?.title}" para relevar la necesidad operativa antes de convertirla en requisitos.`
            : "Voy a ayudarte a describir la necesidad en terminos operativos antes de convertirla en requisitos.",
          "",
        ]
      : []),
    "Para empezar, no hace falta que escribas requisitos tecnicos. Me sirve que cuentes situaciones reales del trabajo cotidiano.",
    "",
    "Puedes contarme, por ejemplo:",
    "- como se realiza hoy el proceso,",
    "- que problemas o demoras aparecen,",
    "- que excepciones ocurren,",
    "- que informacion falta o se repite,",
    "- que palabras o reglas usa tu area.",
    "",
    "Si no sabes por donde empezar, contame una escena concreta: quien participa, que intenta hacer y donde se complica.",
  ].join("\n");
}

function createWelcomeElicitationSession(project: Project, user: User, title: string): ElicitationChatSession {
  const createdAt = nowTime();
  const welcomeMessage: ElicitationChatMessage = {
    id: `message-welcome-${Date.now()}`,
    authorName: "Mediador",
    authorRole: "mediator-ai",
    body: elicitationWelcomeMessage(project, user),
    timestamp: createdAt,
    stream: true,
  };

  return {
    id: `chat-${Date.now()}`,
    title,
    createdBy: user.name,
    messages: [welcomeMessage],
    attachments: [],
    createdAt,
    updatedAt: createdAt,
  };
}

function displayMessageAuthor(message: ElicitationChatMessage) {
  return message.authorRole === "mediator-ai" ? "Mediador" : message.authorName;
}

function localizedMessageBody(body: string, locale: Locale) {
  if (locale !== "es") {
    return body;
  }

  return body.replace(/\bMediator AI\b/g, "Mediador").replace(/\bMediator\b/g, "Mediador");
}

function elicitationRoomContext(room: ElicitationRoomState) {
  const sessionContext = room.sessions
    .map((session) => {
      const messages = session.messages
        .slice(-12)
        .map((message) => `  - ${message.timestamp} | ${message.authorName} (${message.authorRole}): ${message.body}`)
        .join("\n");

      return [
        `Chat: ${session.title}`,
        `Created by: ${session.createdBy}`,
        `Updated at: ${session.updatedAt}`,
        messages || "  - No messages in this chat.",
      ].join("\n");
    })
    .join("\n\n");

  const contributionsContext = room.contributions
    .slice(0, 20)
    .map((entry) => `- ${entry.timestamp} | ${entry.authorName} (${entry.authorRole}, ${entry.kind}): ${entry.body}`)
    .join("\n");
  const clarificationsContext = room.clarifications
    .slice(0, 30)
    .map((clarification) => {
      const response = clarification.response
        ? `\n  Response from ${clarification.respondedByName || "stakeholder"} at ${clarification.respondedAt || "unknown time"}: ${clarification.response}`
        : "\n  Response: pending";

      return [
        `- ${clarification.createdAt} | ${clarification.status.toUpperCase()} | To: ${clarification.targetName}`,
        `  Question: ${clarification.question}`,
        response,
      ].join("\n");
    })
    .join("\n");

  return [
    "All visible elicitation chats in this project room:",
    sessionContext || "No chat sessions are visible.",
    "",
    "Registered elicitation contributions:",
    contributionsContext || "No contributions are registered.",
    "",
    "Analyst clarification requests and stakeholder responses:",
    clarificationsContext || "No clarification requests are registered.",
  ].join("\n");
}

function chatLastActivityLabel(session: ElicitationChatSession) {
  const lastMessage = session.messages.at(-1);
  const value = lastMessage?.timestamp || session.updatedAt || session.createdAt;

  if (!value) {
    return "Sin actividad";
  }

  if (/^\d{1,2}:\d{2}/.test(value) || /^[0-9]{1,2}:[0-9]{2}\s?(AM|PM)$/i.test(value)) {
    return `Hoy ${value}`;
  }

  return value;
}

function StreamingMarkdownMessage({
  messageId,
  body,
  enabled,
  onComplete,
}: {
  messageId: string;
  body: string;
  enabled: boolean;
  onComplete: (messageId: string) => void;
}) {
  const [displayedBody, setDisplayedBody] = useState(enabled ? "" : body);
  const onCompleteRef = useRef(onComplete);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const chunks = body.match(/\S+\s*/g) ?? [body];
    let index = 0;

    const interval = window.setInterval(() => {
      index += 1;
      setDisplayedBody(chunks.slice(0, index).join(""));

      if (index >= chunks.length) {
        window.clearInterval(interval);
        onCompleteRef.current(messageId);
      }
    }, 18);

    return () => window.clearInterval(interval);
  }, [body, enabled, messageId]);

  return <MarkdownMessage body={displayedBody} />;
}

function MarkdownMessage({ body }: { body: string }) {
  const blocks = parseMarkdownBlocks(body);

  return (
    <div className="mt-2 grid gap-2 text-sm leading-6">
      {blocks.map((block, index) => {
        if (block.type === "list") {
          return (
            <ul key={`${block.type}-${index}`} className="grid list-disc gap-1 pl-5">
              {block.items.map((item, itemIndex) => (
                <li key={`${item}-${itemIndex}`}>
                  <InlineMarkdown text={item} />
                </li>
              ))}
            </ul>
          );
        }

        if (block.type === "ordered-list") {
          return (
            <ol key={`${block.type}-${index}`} start={block.start} className="grid list-decimal gap-1 pl-5">
              {block.items.map((item, itemIndex) => (
                <li key={`${item}-${itemIndex}`}>
                  <InlineMarkdown text={item} />
                </li>
              ))}
            </ol>
          );
        }

        if (block.type === "heading") {
          return (
            <p key={`${block.type}-${index}`} className="mt-1 font-semibold text-slate-950">
              <InlineMarkdown text={block.text} />
            </p>
          );
        }

        return (
          <p key={`${block.type}-${index}`}>
            <InlineMarkdown text={block.text} />
          </p>
        );
      })}
    </div>
  );
}

type MarkdownBlock =
  | { type: "heading"; text: string }
  | { type: "paragraph"; text: string }
  | { type: "list"; items: string[] }
  | { type: "ordered-list"; items: string[]; start: number };

function parseMarkdownBlocks(value: string): MarkdownBlock[] {
  const lines = value.replace(/\r\n/g, "\n").split("\n");
  const blocks: MarkdownBlock[] = [];
  let paragraph: string[] = [];
  let unorderedItems: string[] = [];
  let orderedItems: string[] = [];
  let orderedStart = 1;

  function flushParagraph() {
    if (paragraph.length > 0) {
      blocks.push({ type: "paragraph", text: paragraph.join(" ").trim() });
      paragraph = [];
    }
  }

  function flushLists() {
    if (unorderedItems.length > 0) {
      blocks.push({ type: "list", items: unorderedItems });
      unorderedItems = [];
    }

    if (orderedItems.length > 0) {
      blocks.push({ type: "ordered-list", items: orderedItems, start: orderedStart });
      orderedItems = [];
      orderedStart = 1;
    }
  }

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed) {
      flushParagraph();
      flushLists();
      continue;
    }

    const heading = trimmed.match(/^#{1,4}\s+(.+)$/);
    const unordered = trimmed.match(/^[-*]\s+(.+)$/);
    const ordered = trimmed.match(/^(\d+)[.)]\s+(.+)$/);

    if (heading) {
      flushParagraph();
      flushLists();
      blocks.push({ type: "heading", text: heading[1] });
      continue;
    }

    if (unordered) {
      flushParagraph();
      if (orderedItems.length > 0) {
        blocks.push({ type: "ordered-list", items: orderedItems, start: orderedStart });
        orderedItems = [];
        orderedStart = 1;
      }
      unorderedItems.push(unordered[1]);
      continue;
    }

    if (ordered) {
      flushParagraph();
      if (unorderedItems.length > 0) {
        blocks.push({ type: "list", items: unorderedItems });
        unorderedItems = [];
      }
      if (orderedItems.length === 0) {
        orderedStart = Number(ordered[1]);
      }
      orderedItems.push(ordered[2]);
      continue;
    }

    flushLists();
    paragraph.push(trimmed);
  }

  flushParagraph();
  flushLists();
  return blocks.length > 0 ? blocks : [{ type: "paragraph", text: value }];
}

function InlineMarkdown({ text }: { text: string }) {
  const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*)/g).filter(Boolean);

  return (
    <>
      {parts.map((part, index) => {
        if (part.startsWith("`") && part.endsWith("`")) {
          return (
            <code key={`${part}-${index}`} className="rounded bg-slate-100 px-1 py-0.5 text-[0.9em] text-slate-900">
              {part.slice(1, -1)}
            </code>
          );
        }

        if (part.startsWith("**") && part.endsWith("**")) {
          return <strong key={`${part}-${index}`}>{part.slice(2, -2)}</strong>;
        }

        if (part.startsWith("*") && part.endsWith("*")) {
          return <em key={`${part}-${index}`}>{part.slice(1, -1)}</em>;
        }

        return <span key={`${part}-${index}`}>{part}</span>;
      })}
    </>
  );
}

async function persistElicitationMessages(
  token: string,
  projectId: string,
  sessionId: string,
  kind: ElicitationContribution["kind"],
  userMessage: ElicitationChatMessage,
  mediatorMessage?: ElicitationChatMessage,
) {
  await Promise.allSettled(
    [userMessage, mediatorMessage].filter((message): message is ElicitationChatMessage => Boolean(message)).map((message) =>
      apiJson("/api/elicitation/messages", {
        method: "POST",
        token,
        body: {
          projectId,
          sessionId,
          authorName: message.authorName,
          authorRole: message.authorRole,
          body: message.body,
          kind: message.authorRole === "mediator-ai" ? "synthesis" : kind,
          timestamp: message.timestamp,
        },
      }),
    ),
  );
}

async function persistElicitationSessionMeta(
  token: string,
  projectId: string,
  sessionId: string,
  metadata: { title?: string; deleted?: boolean },
) {
  const timestamp = new Date().toISOString();

  try {
    await apiJson("/api/elicitation/sessions", {
      method: "POST",
      token,
      body: {
        projectId,
        session: {
          id: sessionId,
          title: metadata.title ?? "Primer Chat",
          createdBy: "Sistema",
          createdAt: timestamp,
          updatedAt: timestamp,
        },
        deleted: Boolean(metadata.deleted),
      },
    });
  } catch {
    await apiJson("/api/elicitation/messages", {
      method: "POST",
      token,
      body: {
        projectId,
        sessionId,
        authorName: "Sistema",
        authorRole: "mediator-ai",
        body: JSON.stringify(metadata),
        kind: "session-meta",
        timestamp,
      },
    });
  }
}

async function persistClarificationEvent(
  token: string,
  projectId: string,
  sessionId: string,
  kind: "clarification-request" | "clarification-response",
  payload: Record<string, unknown>,
): Promise<ClarificationRequest | null> {
  try {
    if (kind === "clarification-request") {
      const data = await apiJson<{ clarification?: ClarificationRequest }>("/api/elicitation/clarifications", {
        method: "POST",
        token,
        body: {
          projectId,
          sessionId,
          clarification: payload,
        },
      });
      return data.clarification ?? null;
    }

    const data = await apiJson<{ clarification?: ClarificationRequest }>("/api/elicitation/clarifications", {
      method: "PATCH",
      token,
      body: {
        projectId,
        clarificationId: String(payload.requestId || payload.id || ""),
        response: String(payload.response || ""),
        respondedBy: String(payload.respondedBy || ""),
        respondedByName: String(payload.respondedByName || ""),
        respondedAt: String(payload.respondedAt || new Date().toISOString()),
      },
    });
    return data.clarification ?? null;
  } catch {
    // Fall back to the legacy event-as-message persistence below.
  }

  await apiJson("/api/elicitation/messages", {
    method: "POST",
    token,
    body: {
      projectId,
      sessionId,
      authorName: String(payload.requestedByName || payload.respondedByName || "Sistema"),
      authorRole: kind === "clarification-request" ? "analyst" : "stakeholder",
      body: JSON.stringify(payload),
      kind,
      timestamp: new Date().toISOString(),
    },
  });
  return null;
}

async function persistClarificationStatus(
  token: string,
  projectId: string,
  clarificationId: string,
  status: ClarificationRequest["status"],
) {
  await apiJson("/api/elicitation/clarifications", {
    method: "PATCH",
    token,
    body: {
      projectId,
      clarificationId,
      status,
    },
  }).catch(() => undefined);
}

async function persistElicitationContribution(
  token: string,
  projectId: string,
  sessionId: string,
  contribution: ElicitationContribution,
  sourceMessageId?: string,
) {
  await apiJson("/api/elicitation/contributions", {
    method: "POST",
    token,
    body: {
      projectId,
      sessionId,
      contribution,
      sourceMessageId,
      confidence: 0.8,
    },
  }).catch(() => undefined);
}

async function persistWorkspaceLayerRuntime(
  token: string,
  projectId: string,
  layerId: LayerId,
  runtime: Pick<ProjectRuntime, "artifacts" | "risks" | "traces" | "audit">,
) {
  await apiJson("/api/workspace/runtime", {
    method: "POST",
    token,
    body: {
      projectId,
      layerId,
      artifacts: runtime.artifacts,
      risks: runtime.risks,
      traces: runtime.traces,
      audit: runtime.audit,
    },
  }).catch(() => undefined);
}

async function uploadFilesToPocketBaseStorage({
  token,
  files,
  projectId,
  sessionId,
  origin,
  uploadedBy,
  fallbackDocuments,
  allowFallback = true,
}: {
  token: string;
  files: FileList;
  projectId?: string;
  sessionId?: string;
  origin: string;
  uploadedBy?: string;
  fallbackDocuments: AttachedDocument[];
  allowFallback?: boolean;
}) {
  const formData = new FormData();
  formData.append("projectId", projectId ?? "");
  formData.append("sessionId", sessionId ?? "");
  formData.append("origin", origin);
  formData.append("uploadedBy", uploadedBy ?? "");

  Array.from(files).forEach((file) => {
    formData.append("files", file);
  });

  try {
    const data = await apiForm<{ documents?: AttachedDocument[] }>("/api/files/upload", {
      method: "POST",
      token,
      formData,
    });
    return data.documents?.length ? data.documents : allowFallback ? fallbackDocuments : [];
  } catch (error) {
    if (!allowFallback) {
      throw error;
    }
    return allowFallback ? fallbackDocuments : [];
  }
}

async function persistProjectDocuments(projectId: string, documents: AttachedDocument[], token: string) {
  const data = await apiJson<{ project: Project }>(`/api/projects/${projectId}/documents`, {
    method: "PATCH",
    token,
    body: { documents },
  });
  return data.project;
}

async function deletePersistedProjectDocument(
  projectId: string,
  document: AttachedDocument,
  documents: AttachedDocument[],
  token: string,
) {
  const data = await apiJson<{ project: Project }>(`/api/projects/${projectId}/documents`, {
    method: "DELETE",
    token,
    body: { document, documents },
  });
  return data.project;
}

function ElicitationInsightRail({
  locale,
  currentUser,
  room,
  project,
  insights,
  onSynthesize,
  canSynthesize,
}: {
  locale: Locale;
  currentUser: User;
  room: ElicitationRoomState;
  project: Project;
  insights: ElicitationInsight[];
  onSynthesize: () => void;
  canSynthesize: boolean;
}) {
  const isStakeholder = currentUser.role === "stakeholder";
  const canCurate = currentUser.role === "analyst" || currentUser.role === "admin";
  const openQuestions = insights.filter((insight) => insight.kind === "question" || insight.kind === "risk-note");
  const latestSession = room.sessions[0];

  return (
    <aside className="border-t border-slate-200 bg-white p-4 xl:border-l xl:border-t-0">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase text-slate-500">
            {isStakeholder ? t(locale, "liveContext") : t(locale, "aiDetectionTray")}
          </p>
          <h3 className="mt-1 text-lg font-semibold text-slate-950">
            {isStakeholder ? t(locale, "whatIsHappening") : t(locale, "detectedInputs")}
          </h3>
        </div>
        <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">
          {t(locale, roleLabelKey[currentUser.role])}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2 text-center">
        <RoomMetric label={t(locale, "chats")} value={`${room.sessions.length}`} />
        <RoomMetric label={t(locale, "inputs")} value={`${room.contributions.length}`} />
        <RoomMetric label={t(locale, "sources")} value={`${room.attachments.length + project.documents.length}`} />
      </div>

      <section className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
        <p className="text-xs font-semibold uppercase text-slate-500">{t(locale, "activeThread")}</p>
        <p className="mt-2 text-sm font-semibold text-slate-900">{latestSession?.title ?? t(locale, "newChat")}</p>
        <p className="mt-1 text-xs leading-5 text-slate-600">
          {latestSession ? `${latestSession.messages.length} ${t(locale, "messages")}` : t(locale, "noMessagesYet")}
        </p>
      </section>

      <section className="mt-4">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-semibold uppercase text-slate-500">
            {isStakeholder ? t(locale, "usefulContext") : t(locale, "detectedByMediator")}
          </p>
          {!isStakeholder && (
            <span className="rounded-md bg-sky-50 px-2 py-1 text-xs font-semibold text-sky-800">
              {t(locale, "localAi")}
            </span>
          )}
        </div>

        <div className="mt-3 grid gap-2">
          {insights.slice(0, isStakeholder ? 4 : 6).map((insight) => (
            <article key={insight.id} className="rounded-lg border border-slate-200 p-3">
              <div className="flex items-start justify-between gap-2">
                <h4 className="text-sm font-semibold text-slate-950">{insight.title}</h4>
                <span className="rounded-md bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-800">
                  {insight.confidence}%
                </span>
              </div>
              <p className="mt-2 line-clamp-3 text-sm leading-5 text-slate-600">{insight.body}</p>
              <p className="mt-2 text-xs text-slate-500">
                {t(locale, "source")}: {insight.source}
              </p>
            </article>
          ))}
        </div>
      </section>

      {!isStakeholder && (
        <section className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-950">
          <p className="text-xs font-semibold uppercase">{t(locale, "attentionQueue")}</p>
          <p className="mt-2 text-sm leading-5">
            {openQuestions.length > 0 ? t(locale, "openQuestionsHint") : t(locale, "noOpenQuestionsHint")}
          </p>
        </section>
      )}

      {canCurate && (
        <div className="mt-4 grid gap-2">
          <button
            type="button"
            onClick={onSynthesize}
            disabled={!canSynthesize}
            className="h-10 rounded-md bg-slate-950 px-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {t(locale, "prepareCandidates")}
          </button>
          <button
            type="button"
            onClick={onSynthesize}
            disabled={!canSynthesize}
            className="h-10 rounded-md border border-slate-300 px-3 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400"
          >
            {t(locale, "markForClarification")}
          </button>
        </div>
      )}
    </aside>
  );
}

function RoomMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-2">
      <p className="text-base font-semibold text-slate-950">{value}</p>
      <p className="mt-1 text-[0.68rem] font-semibold uppercase text-slate-500">{label}</p>
    </div>
  );
}

function ProjectContextCard({
  locale,
  project,
  compact = false,
}: {
  locale: Locale;
  project: Project;
  compact?: boolean;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <h2 className="text-sm font-semibold uppercase text-slate-500">{t(locale, "transcript")}</h2>
      <p className={`mt-3 text-sm leading-6 text-slate-700 ${compact ? "line-clamp-5" : ""}`}>
        {project.transcript || project.summary}
      </p>
      {project.institutionalRequest && (
        <>
          <h3 className="mt-5 text-sm font-semibold uppercase text-slate-500">Solicitud</h3>
          <div className="mt-3 grid gap-2 text-xs leading-5 text-slate-600">
            <p>
              <span className="font-semibold text-slate-800">Solicita:</span>{" "}
              {project.institutionalRequest.requestingArea || "Sin definir"}
            </p>
            <p>
              <span className="font-semibold text-slate-800">Accion:</span>{" "}
              {project.institutionalRequest.requestedAction || "Pendiente"}
            </p>
            <p>
              <span className="font-semibold text-slate-800">Poblacion:</span>{" "}
              {project.institutionalRequest.targetPopulation || "Pendiente"}
            </p>
          </div>
        </>
      )}
      <h3 className="mt-5 text-sm font-semibold uppercase text-slate-500">{t(locale, "stakeholders")}</h3>
      <div className="mt-3 flex flex-wrap gap-2">
        {stakeholderNames(project).map((stakeholder) => (
          <span key={stakeholder} className="rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">
            {stakeholder}
          </span>
        ))}
      </div>
      <h3 className="mt-5 text-sm font-semibold uppercase text-slate-500">{t(locale, "attachedFiles")}</h3>
      <div className="mt-3 grid gap-2">
        {project.documents.length === 0 ? (
          <p className="text-xs text-slate-500">{t(locale, "noFiles")}</p>
        ) : (
          project.documents.map((document) => (
            <p key={document.id} className="rounded-md bg-slate-50 px-2 py-1 text-xs text-slate-600">
              {document.name}
              <DocumentIndexingBadge document={document} locale={locale} compact />
            </p>
          ))
        )}
      </div>
      {!compact && <p className="mt-5 text-xs leading-5 text-slate-500">{t(locale, "nextLayerHint")}</p>}
    </div>
  );
}

function DocumentIndexingBadge({
  document,
  locale,
  compact = false,
}: {
  document: AttachedDocument;
  locale: Locale;
  compact?: boolean;
}) {
  if (!document.indexingStatus) {
    return null;
  }

  const statusClass =
    document.indexingStatus === "indexed"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : document.indexingStatus === "failed"
        ? "border-rose-200 bg-rose-50 text-rose-700"
        : "border-amber-200 bg-amber-50 text-amber-700";
  const label =
    document.indexingStatus === "indexed"
      ? `${t(locale, "indexed")}${document.indexedChunks ? ` · ${document.indexedChunks} ${t(locale, "indexedChunks")}` : ""}`
      : document.indexingStatus === "failed"
        ? t(locale, "indexingFailed")
        : t(locale, "indexingSkipped");

  return (
    <span
      title={document.indexingDetail}
      className={`${compact ? "ml-2" : "mt-2 inline-flex"} rounded-md border px-2 py-0.5 text-[11px] font-semibold ${statusClass}`}
    >
      {label}
    </span>
  );
}

function RiskTraceAuditPanel({
  locale,
  risks,
  activeRisks,
  traces,
  audit,
  artifactById,
  canViewRisk,
}: {
  locale: Locale;
  risks: RiskFlag[];
  activeRisks: RiskFlag[];
  traces: TraceLink[];
  audit: AuditEntry[];
  artifactById: Map<string, Artifact>;
  canViewRisk: boolean;
}) {
  return (
    <aside className="border-t border-slate-200 bg-white px-4 py-4 xl:border-l xl:border-t-0">
      <section>
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase text-slate-500">{t(locale, "riskLayer")}</h2>
          <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">
            {activeRisks.length}
          </span>
        </div>

        {!canViewRisk ? (
          <p className="mt-3 rounded-lg border border-dashed border-slate-300 p-4 text-sm text-slate-500">
            {t(locale, "restrictedAction")}
          </p>
        ) : risks.length === 0 ? (
          <p className="mt-3 rounded-lg border border-dashed border-slate-300 p-4 text-sm text-slate-500">
            {t(locale, "riskEmpty")}
          </p>
        ) : (
          <div className="mt-3 grid gap-3">
            {risks.map((risk) => (
              <div key={risk.id} className="rounded-lg border border-slate-200 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{risk.label}</p>
                    <p className="mt-1 text-xs uppercase text-slate-500">{risk.kind}</p>
                  </div>
                  <span className="rounded-md bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-800">
                    {risk.severity}
                  </span>
                </div>
                <p className="mt-2 text-sm leading-5 text-slate-600">{risk.detail}</p>
                <p className="mt-2 text-xs text-slate-500">
                  {t(locale, "riskScore")}: {Math.round(risk.confidence * 100)}%
                </p>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="mt-6">
        <h2 className="text-sm font-semibold uppercase text-slate-500">{t(locale, "traceability")}</h2>
        {traces.length === 0 ? (
          <p className="mt-3 rounded-lg border border-dashed border-slate-300 p-4 text-sm text-slate-500">
            {t(locale, "traceEmpty")}
          </p>
        ) : (
          <div className="mt-3 grid gap-2">
            {traces.map((trace) => (
              <div key={trace.id} className="rounded-lg bg-slate-50 p-3 text-xs leading-5 text-slate-600">
                <span className="font-semibold text-slate-900">
                  {artifactById.get(trace.fromArtifactId ?? "")?.title ??
                    trace.fromLabel ??
                    trace.fromArtifactId ??
                    trace.fromEvidenceId}
                </span>{" "}
                {trace.relation}{" "}
                <span className="font-semibold text-slate-900">
                  {artifactById.get(trace.toArtifactId)?.title ?? trace.toArtifactId}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="mt-6">
        <h2 className="text-sm font-semibold uppercase text-slate-500">{t(locale, "audit")}</h2>
        <div className="mt-3 grid max-h-80 gap-2 overflow-auto pr-1">
          {audit.map((entry) => (
            <div key={entry.id} className="rounded-lg border border-slate-200 p-3 text-xs leading-5">
              <div className="flex items-center justify-between gap-2 text-slate-500">
                <span>{entry.timestamp}</span>
                <span>{entry.actor}</span>
              </div>
              <p className="mt-1 text-slate-700">{entry.action}</p>
            </div>
          ))}
        </div>
      </section>
    </aside>
  );
}

function TopBar({
  locale,
  compact = false,
  currentUser,
  roleProfile,
  onRoleChange,
  onSignOut,
}: {
  locale: Locale;
  compact?: boolean;
  currentUser?: User;
  roleProfile?: RoleProfile;
  onRoleChange?: (role: UserRole) => void;
  onSignOut?: () => void;
}) {
  return (
    <header className={`rx-topbar flex items-start justify-between gap-3 ${compact ? "xl:block" : ""}`}>
      <div className="rx-brand">
        <span className="rx-brand-mark">RQ</span>
        <div>
          <p className="text-xl font-semibold tracking-normal">{t(locale, "appName")}</p>
        </div>
      </div>
      <div className={`flex shrink-0 flex-wrap items-center gap-2 ${compact ? "xl:mt-5" : ""}`}>
        {currentUser && roleProfile && (
          <div className="flex items-center gap-2 rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-700">
            <span className="font-semibold">{currentUser.name}</span>
            {currentUser.roles.length > 1 && onRoleChange ? (
              <select
                value={currentUser.role}
                onChange={(event) => onRoleChange(event.target.value as UserRole)}
                className="h-7 rounded-md border border-slate-300 bg-white px-2 text-xs text-slate-900"
                aria-label={t(locale, "activeRole")}
              >
                {currentUser.roles.map((role) => (
                  <option key={role} value={role}>
                    {t(locale, roleLabelKey[role])}
                  </option>
                ))}
              </select>
            ) : (
              <span className="text-slate-500">{t(locale, roleLabelKey[currentUser.role])}</span>
            )}
          </div>
        )}
        {onSignOut && (
          <button
            type="button"
            onClick={onSignOut}
            className="h-9 rounded-md border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-800 hover:bg-slate-50"
          >
            {t(locale, "signOut")}
          </button>
        )}
      </div>
    </header>
  );
}

function PermissionList({
  locale,
  profile,
  compact = false,
}: {
  locale: Locale;
  profile: RoleProfile;
  compact?: boolean;
}) {
  return (
    <div className={`mt-4 flex flex-wrap gap-2 ${compact ? "text-xs" : "text-sm"}`}>
      {permissionLabels.map(([permission, labelKey]) => (
        <span
          key={permission}
          className={`rounded-md px-2 py-1 font-medium ${
            profile.permissions[permission]
              ? "bg-emerald-100 text-emerald-800"
              : "bg-slate-100 text-slate-500"
          }`}
        >
          {profile.permissions[permission] ? "✓" : "–"} {t(locale, labelKey)}
        </span>
      ))}
    </div>
  );
}

function InfoMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
      <p className="text-xs font-semibold uppercase text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-medium leading-5 text-slate-900">{value}</p>
    </div>
  );
}

function LayerFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-white/70 p-3">
      <dt className="text-xs font-semibold uppercase opacity-70">{label}</dt>
      <dd className="mt-1 text-sm leading-5">{value}</dd>
    </div>
  );
}
