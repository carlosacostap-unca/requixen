import type {
  ClarificationRequest,
  ElicitationChatMessage,
  ElicitationChatSession,
  ElicitationContribution,
  ElicitationRoomState,
  UserRole,
} from "@/lib/requixen/types";
import { serverEnv } from "./env";
import { pocketBaseRequest, requireProjectAccess } from "./pocketbase";

type PocketBaseListResponse<T> = {
  items: T[];
};

type RuntimeWarning = {
  collection: string;
  message: string;
};

export type PersistedElicitationMessage = {
  id: string;
  projectId: string;
  sessionId: string;
  authorName: string;
  authorRole: string;
  body: string;
  kind: string;
  timestamp: string;
  created?: string;
  updated?: string;
};

type SessionRecord = {
  id: string;
  sessionId?: string;
  projectId?: string;
  title?: string;
  createdBy?: string;
  deleted?: boolean;
  created?: string;
  updated?: string;
  createdAt?: string;
  updatedAt?: string;
};

type MessageRecord = PersistedElicitationMessage & {
  timestamp_?: string;
};

type ContributionRecord = {
  id: string;
  projectId?: string;
  sessionId?: string;
  sourceMessageId?: string;
  authorName?: string;
  authorRole?: string;
  body?: string;
  kind?: string;
  confidence?: number;
  timestamp_?: string;
  created?: string;
  updated?: string;
};

type ClarificationRecord = {
  id: string;
  projectId?: string;
  sessionId?: string;
  question?: string;
  targetUserId?: string;
  targetName?: string;
  requestedBy?: string;
  requestedByName?: string;
  status?: ClarificationRequest["status"];
  response?: string;
  respondedBy?: string;
  respondedByName?: string;
  sentAt?: string;
  respondedAt?: string;
  created?: string;
  updated?: string;
};

export type ElicitationRuntimePayload = {
  room: ElicitationRoomState;
  messages: PersistedElicitationMessage[];
  warnings: RuntimeWarning[];
};

export async function loadElicitationRuntime(projectId: string, token: string): Promise<ElicitationRuntimePayload> {
  await requireProjectAccess(projectId, token);
  const env = serverEnv();
  const warnings: RuntimeWarning[] = [];
  const [sessionRecords, messageRecords, contributionRecords, clarificationRecords] = await Promise.all([
    listOptionalRecords<SessionRecord>(
      env.pocketBaseElicitationSessionsCollection,
      projectId,
      token,
      warnings,
    ),
    listOptionalRecords<MessageRecord>(
      env.pocketBaseElicitationMessagesCollection,
      projectId,
      token,
      warnings,
      false,
    ),
    listOptionalRecords<ContributionRecord>(
      env.pocketBaseElicitationContributionsCollection,
      projectId,
      token,
      warnings,
    ),
    listOptionalRecords<ClarificationRecord>(
      env.pocketBaseClarificationsCollection,
      projectId,
      token,
      warnings,
    ),
  ]);
  const messages = messageRecords.map(mapMessageRecord);

  return {
    room: reconstructRoom(projectId, {
      sessions: sessionRecords,
      messages,
      contributions: contributionRecords,
      clarifications: clarificationRecords,
    }),
    messages,
    warnings,
  };
}

export async function upsertElicitationSession({
  projectId,
  session,
  deleted = false,
  token,
}: {
  projectId: string;
  session: Pick<ElicitationChatSession, "id" | "title" | "createdBy" | "createdAt" | "updatedAt">;
  deleted?: boolean;
  token: string;
}) {
  await requireProjectAccess(projectId, token);
  const env = serverEnv();
  const existing = await findSessionRecord(projectId, session.id, token).catch(() => undefined);
  const body = JSON.stringify({
    projectId,
    sessionId: session.id,
    title: session.title,
    createdBy: session.createdBy,
    deleted,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
  });

  if (existing?.id) {
    return pocketBaseRequest<SessionRecord>(
      `/api/collections/${env.pocketBaseElicitationSessionsCollection}/records/${existing.id}`,
      { method: "PATCH", body },
      token,
    );
  }

  return pocketBaseRequest<SessionRecord>(
    `/api/collections/${env.pocketBaseElicitationSessionsCollection}/records`,
    { method: "POST", body },
    token,
  );
}

export async function createElicitationMessage({
  projectId,
  sessionId,
  message,
  kind,
  token,
}: {
  projectId: string;
  sessionId: string;
  message: ElicitationChatMessage;
  kind: string;
  token: string;
}) {
  const { user } = await requireProjectAccess(projectId, token);
  const env = serverEnv();
  const authorName = message.authorRole === "mediator-ai" ? message.authorName : user.name;
  const authorRole = message.authorRole === "mediator-ai" ? message.authorRole : user.role;

  return pocketBaseRequest<MessageRecord>(
    `/api/collections/${env.pocketBaseElicitationMessagesCollection}/records`,
    {
      method: "POST",
      body: JSON.stringify({
        projectId,
        sessionId,
        authorName,
        authorRole,
        body: message.body,
        kind,
        timestamp_: message.timestamp,
      }),
    },
    token,
  );
}

export async function createElicitationContribution({
  projectId,
  sessionId,
  contribution,
  sourceMessageId,
  confidence = 0.8,
  token,
}: {
  projectId: string;
  sessionId: string;
  contribution: ElicitationContribution;
  sourceMessageId?: string;
  confidence?: number;
  token: string;
}) {
  const { user } = await requireProjectAccess(projectId, token);
  const env = serverEnv();

  return pocketBaseRequest<ContributionRecord>(
    `/api/collections/${env.pocketBaseElicitationContributionsCollection}/records`,
    {
      method: "POST",
      body: JSON.stringify({
        projectId,
        sessionId,
        sourceMessageId: sourceMessageId ?? "",
        authorName: contribution.authorRole === "mediator-ai" ? contribution.authorName : user.name,
        authorRole: contribution.authorRole === "mediator-ai" ? contribution.authorRole : user.role,
        body: contribution.body,
        kind: contribution.kind,
        confidence,
        timestamp_: contribution.timestamp,
      }),
    },
    token,
  );
}

export async function createClarification({
  projectId,
  sessionId,
  clarification,
  token,
}: {
  projectId: string;
  sessionId: string;
  clarification: ClarificationRequest;
  token: string;
}) {
  await requireProjectAccess(projectId, token);
  const env = serverEnv();

  return pocketBaseRequest<ClarificationRecord>(
    `/api/collections/${env.pocketBaseClarificationsCollection}/records`,
    {
      method: "POST",
      body: JSON.stringify({
        projectId,
        sessionId,
        question: clarification.question,
        targetUserId: clarification.targetUserId,
        targetName: clarification.targetName,
        requestedBy: clarification.requestedBy,
        requestedByName: clarification.requestedByName,
        status: clarification.status,
        sentAt: clarification.sentAt ?? "",
      }),
    },
    token,
  );
}

export async function answerClarification({
  projectId,
  clarificationId,
  response,
  respondedBy,
  respondedByName,
  respondedAt,
  token,
}: {
  projectId: string;
  clarificationId: string;
  response: string;
  respondedBy: string;
  respondedByName: string;
  respondedAt: string;
  token: string;
}) {
  await requireProjectAccess(projectId, token);
  const env = serverEnv();

  return pocketBaseRequest<ClarificationRecord>(
    `/api/collections/${env.pocketBaseClarificationsCollection}/records/${clarificationId}`,
    {
      method: "PATCH",
      body: JSON.stringify({
        status: "answered",
        response,
        respondedBy,
        respondedByName,
        respondedAt,
      }),
    },
    token,
  );
}

export async function closeClarification({
  projectId,
  clarificationId,
  token,
}: {
  projectId: string;
  clarificationId: string;
  token: string;
}) {
  await requireProjectAccess(projectId, token);
  const env = serverEnv();

  return pocketBaseRequest<ClarificationRecord>(
    `/api/collections/${env.pocketBaseClarificationsCollection}/records/${clarificationId}`,
    {
      method: "PATCH",
      body: JSON.stringify({
        status: "closed",
      }),
    },
    token,
  );
}

export function reconstructRoom(
  projectId: string,
  records: {
    sessions?: SessionRecord[];
    messages?: PersistedElicitationMessage[];
    contributions?: ContributionRecord[];
    clarifications?: ClarificationRecord[];
  },
): ElicitationRoomState {
  const messages = records.messages ?? [];
  const legacySessionMeta = sessionMetadataFromMessages(messages);
  const sessionIds = new Set<string>([
    ...(records.sessions ?? []).map((session) => session.sessionId || session.id),
    ...messages.map((message) => message.sessionId || `room-${projectId}`),
    ...legacySessionMeta.keys(),
  ]);
  const sessions = [...sessionIds]
    .map((sessionId, index): ElicitationChatSession | null => {
      const record = (records.sessions ?? []).find((session) => (session.sessionId || session.id) === sessionId);
      const legacyMeta = legacySessionMeta.get(sessionId);

      if (record?.deleted || legacyMeta?.deleted) {
        return null;
      }

      const sessionMessages = messages
        .filter((message) => (message.sessionId || `room-${projectId}`) === sessionId)
        .filter((message) => !["session-meta", "clarification-request", "clarification-response"].includes(message.kind))
        .map(mapPersistedMessageToChatMessage);
      const firstMessage = sessionMessages[0];
      const lastMessage = sessionMessages.at(-1);

      return {
        id: sessionId,
        title: record?.title || legacyMeta?.title || (index === 0 ? "Primer Chat" : `Chat ${index + 1}`),
        createdBy: record?.createdBy || firstMessage?.authorName || "Mediador",
        messages: sessionMessages,
        attachments: [],
        createdAt: readableTimestamp(record?.createdAt || record?.created || legacyMeta?.createdAt || firstMessage?.timestamp || ""),
        updatedAt: readableTimestamp(record?.updatedAt || record?.updated || legacyMeta?.updatedAt || lastMessage?.timestamp || ""),
      };
    })
    .filter((session): session is ElicitationChatSession => Boolean(session));
  const safeSessions = sessions.length > 0 ? sessions : [defaultSession(projectId)];
  const persistedContributions = (records.contributions ?? []).map(mapContributionRecord);
  const legacyContributions = messages
    .filter((message) => message.authorRole !== "mediator-ai")
    .filter((message) => !["session-meta", "clarification-request", "clarification-response"].includes(message.kind))
    .map((message) => ({
      id: `elicitation-${message.id}`,
      authorName: message.authorName,
      authorRole: normalizeMessageAuthorRole(message.authorRole),
      body: message.body,
      kind: normalizeContributionKind(message.kind),
      timestamp: readableTimestamp(message.timestamp || message.created || ""),
    }));
  const persistedClarifications = (records.clarifications ?? []).map(mapClarificationRecord);
  const legacyClarifications = clarificationsFromMessages(
    projectId,
    messages.filter((message) => message.kind === "clarification-request" || message.kind === "clarification-response"),
  );

  return {
    activeSessionId: safeSessions[0].id,
    sessions: safeSessions.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)),
    contributions: persistedContributions.length > 0 ? persistedContributions : legacyContributions,
    attachments: [],
    clarifications: persistedClarifications.length > 0 ? persistedClarifications : legacyClarifications,
  };
}

async function listOptionalRecords<T>(
  collection: string,
  projectId: string,
  token: string,
  warnings: RuntimeWarning[],
  optional = true,
) {
  const filter = encodeURIComponent(`projectId="${projectId}"`);

  try {
    const result = await pocketBaseRequest<PocketBaseListResponse<T>>(
      `/api/collections/${collection}/records?perPage=500&filter=${filter}`,
      {},
      token,
    );
    return result.items;
  } catch (error) {
    if (!optional) {
      throw error;
    }

    warnings.push({
      collection,
      message: `Optional collection ${collection} is unavailable.`,
    });
    return [];
  }
}

async function findSessionRecord(projectId: string, sessionId: string, token: string) {
  const env = serverEnv();
  const filter = encodeURIComponent(`projectId="${projectId}" && sessionId="${sessionId}"`);
  const result = await pocketBaseRequest<PocketBaseListResponse<SessionRecord>>(
    `/api/collections/${env.pocketBaseElicitationSessionsCollection}/records?perPage=1&filter=${filter}`,
    {},
    token,
  );
  return result.items[0];
}

function mapMessageRecord(record: MessageRecord): PersistedElicitationMessage {
  return {
    id: record.id,
    projectId: record.projectId ?? "",
    sessionId: record.sessionId ?? "",
    authorName: record.authorName ?? "",
    authorRole: record.authorRole ?? "",
    body: record.body ?? "",
    kind: record.kind ?? "",
    timestamp: record.timestamp_ || record.timestamp || record.created || "",
    created: record.created ?? "",
    updated: record.updated ?? "",
  };
}

function mapPersistedMessageToChatMessage(message: PersistedElicitationMessage): ElicitationChatMessage {
  return {
    id: message.id,
    authorName: message.authorRole === "mediator-ai" ? "Mediador" : message.authorName,
    authorRole: normalizeMessageAuthorRole(message.authorRole),
    body: message.body,
    timestamp: readableTimestamp(message.timestamp || message.created || ""),
  };
}

function mapContributionRecord(record: ContributionRecord): ElicitationContribution {
  return {
    id: record.id,
    authorName: record.authorName ?? "Usuario",
    authorRole: normalizeMessageAuthorRole(record.authorRole ?? ""),
    body: record.body ?? "",
    kind: normalizeContributionKind(record.kind ?? ""),
    timestamp: readableTimestamp(record.timestamp_ || record.created || ""),
    sourceMessageId: record.sourceMessageId,
    confidence: record.confidence,
  };
}

function mapClarificationRecord(record: ClarificationRecord): ClarificationRequest {
  return {
    id: record.id,
    projectId: record.projectId ?? "",
    question: record.question ?? "",
    targetUserId: record.targetUserId ?? "",
    targetName: record.targetName ?? "Stakeholders",
    requestedBy: record.requestedBy ?? "",
    requestedByName: record.requestedByName ?? "Analista",
    status: record.status ?? "sent",
    createdAt: readableTimestamp(record.created ?? ""),
    sentAt: readableTimestamp(record.sentAt ?? ""),
    response: record.response,
    respondedBy: record.respondedBy,
    respondedByName: record.respondedByName,
    respondedAt: readableTimestamp(record.respondedAt ?? ""),
  };
}

function defaultSession(projectId: string): ElicitationChatSession {
  const timestamp = nowTime();

  return {
    id: `room-${projectId}`,
    title: "Primer Chat",
    createdBy: "Mediador",
    createdAt: timestamp,
    updatedAt: timestamp,
    attachments: [],
    messages: [
      {
        id: `message-welcome-${projectId}`,
        authorName: "Mediador",
        authorRole: "mediator-ai",
        body:
          "Hola. Soy el Mediador de Requixen. Esta es la sala de elicitacion del proyecto.\n\nPara empezar, contame una situacion real del proceso: quien participa, que intenta hacer, que informacion usa y donde aparece una demora, duda o excepcion.",
        timestamp,
      },
    ],
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
        createdAt: readableTimestamp(message.timestamp || message.created || ""),
        sentAt: readableTimestamp(message.timestamp || message.created || ""),
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
          respondedAt: readableTimestamp(message.timestamp || message.created || ""),
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

function readableTimestamp(value: string) {
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
