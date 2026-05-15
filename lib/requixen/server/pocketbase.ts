import type {
  AttachedDocument,
  GuidedInterviewBlock,
  InstitutionalInterviewTemplate,
  InstitutionalRequest,
  MunicipalArea,
  Project,
  ProjectParticipant,
  ProjectRole,
  User,
  UserRole,
} from "@/lib/requixen/types";
import { forbidden, unauthorized, upstreamError } from "./api-errors";
import { serverEnv } from "./env";

type PocketBaseAuthResponse = {
  token: string;
  record: Record<string, unknown>;
};

type PocketBaseSuperuserAuthResponse = {
  token: string;
};

type PocketBaseListResponse<T> = {
  items: T[];
};

type PocketBaseProjectRecord = {
  id: string;
  name?: string;
  domain?: string;
  municipality?: string;
  areaId?: string;
  summary?: string;
  transcript?: string;
  status?: Project["status"];
  documents?: AttachedDocument[] | string;
  participants?: ProjectParticipant[] | string;
  institutionalRequest?: Project["institutionalRequest"] | string;
  created?: string;
  updated?: string;
};

type PocketBaseAreaRecord = {
  id: string;
  name?: string;
  code?: string;
  description?: string;
  parentAreaId?: string;
  parentAreaName?: string;
  created?: string;
  updated?: string;
};

type PocketBaseInstitutionalTemplateRecord = {
  id: string;
  templateId?: string;
  title?: string;
  description?: string;
  projectName?: string;
  problem?: string;
  institutionalRequest?: InstitutionalRequest | string;
  mediatorPrompt?: string;
  blocks?: GuidedInterviewBlock[] | string;
  confirmationArea?: string;
  active?: boolean;
};

let cachedAdminToken = "";

export async function pocketBaseRequest<T>(path: string, init: RequestInit = {}, token?: string): Promise<T> {
  const env = serverEnv();

  if (!env.pocketBaseUrl) {
    throw upstreamError("POCKETBASE_URL is not configured.");
  }

  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(`${env.pocketBaseUrl}${path}`, {
    ...init,
    headers,
    cache: "no-store",
  });

  if (!response.ok) {
    if (response.status === 401) {
      throw unauthorized("The bearer token is invalid or expired.");
    }

    if (response.status === 403) {
      throw forbidden();
    }

    throw upstreamError(`PocketBase request failed (${response.status}).`);
  }

  if (response.status === 204) {
    return {} as T;
  }

  return response.json() as Promise<T>;
}

export async function pocketBaseAdminRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  return pocketBaseRequest<T>(path, init, await getPocketBaseAdminToken());
}

export async function authenticatePocketBaseUser(identity: string, password: string) {
  const env = serverEnv();
  const auth = await pocketBaseRequest<PocketBaseAuthResponse>(
    `/api/collections/${env.pocketBaseUsersCollection}/auth-with-password`,
    {
      method: "POST",
      body: JSON.stringify({ identity, password }),
    },
  );

  return {
    token: auth.token,
    user: mapUserRecord(auth.record),
  };
}

export function bearerToken(request: Request) {
  const authorization = request.headers.get("authorization") ?? "";
  return authorization.startsWith("Bearer ") ? authorization.slice("Bearer ".length) : "";
}

export async function getAuthenticatedPocketBaseUser(token: string) {
  return getCurrentPocketBaseUser(token);
}

export function userHasRole(user: User, role: UserRole) {
  return hasRole(user, role);
}

export function assertAnyRole(user: User, roles: UserRole[]) {
  if (!roles.some((role) => hasRole(user, role))) {
    throw forbidden(`Only users with one of these roles can perform this action: ${roles.join(", ")}.`);
  }
}

export function assertCanCreateProject(user: User) {
  assertAnyRole(user, ["admin", "analyst"]);
}

export function userCanAccessProject(user: User, project: Pick<Project, "participants">) {
  return hasRole(user, "admin") || project.participants.some((participant) => participant.userId === user.id);
}

export async function requireAnyRole(token: string, roles: UserRole[]) {
  const user = await getCurrentPocketBaseUser(token);
  assertAnyRole(user, roles);
  return user;
}

export async function listPocketBaseProjects(token: string) {
  const env = serverEnv();
  const currentUser = await getCurrentPocketBaseUser(token);
  const result = await pocketBaseRequest<PocketBaseListResponse<PocketBaseProjectRecord>>(
    `/api/collections/${env.pocketBaseProjectsCollection}/records?sort=-updated`,
    {},
    token,
  );

  return result.items
    .map(mapProjectRecord)
    .filter((project) => hasRole(currentUser, "admin") || project.participants.some((item) => item.userId === currentUser.id));
}

export async function createPocketBaseProject(project: Project, token: string) {
  const env = serverEnv();
  const currentUser = await getCurrentPocketBaseUser(token);
  assertCanCreateProject(currentUser);

  const participants =
    project.participants.length > 0
      ? project.participants
      : [
          {
            userId: currentUser.id,
            name: currentUser.name,
            email: currentUser.email,
            role: normalizeProjectRole(currentUser.role),
            areaId: currentUser.areaId,
            areaName: currentUser.areaName,
          },
        ];
  const record = await pocketBaseRequest<PocketBaseProjectRecord>(
    `/api/collections/${env.pocketBaseProjectsCollection}/records`,
    {
      method: "POST",
      body: JSON.stringify({
        name: project.name,
        domain: project.domain,
        municipality: project.municipality,
        areaId: project.areaId ?? "",
        summary: project.summary,
        transcript: project.transcript,
        status: project.status,
        documents: project.documents,
        participants,
        institutionalRequest: project.institutionalRequest ?? null,
      }),
    },
    token,
  );

  return mapProjectRecord(record);
}

export async function listPocketBaseUsers(token: string) {
  const env = serverEnv();
  const currentUser = await getCurrentPocketBaseUser(token);

  if (!hasRole(currentUser, "admin")) {
    return resolveUserAreaNames([currentUser]);
  }

  const result = await pocketBaseAdminRequest<PocketBaseListResponse<Record<string, unknown>>>(
    `/api/collections/${env.pocketBaseUsersCollection}/records?perPage=200&sort=name,email`,
  );

  return resolveUserAreaNames(result.items.map(mapUserRecord));
}

export async function listPocketBaseUserDirectory() {
  const env = serverEnv();
  const [usersResult, areasResult] = await Promise.all([
    pocketBaseAdminRequest<PocketBaseListResponse<Record<string, unknown>>>(
      `/api/collections/${env.pocketBaseUsersCollection}/records?perPage=200&sort=name,email`,
    ),
    pocketBaseAdminRequest<PocketBaseListResponse<PocketBaseAreaRecord>>(
      `/api/collections/${env.pocketBaseAreasCollection}/records?perPage=200&sort=name`,
    ).catch(() => ({ items: [] })),
  ]);
  const areaNames = new Map(areasResult.items.map((area) => [area.id, area.name || ""]));

  return usersResult.items.map((record) => {
    const user = mapUserRecord(record);
    return {
      ...user,
      areaName: user.areaName || areaNames.get(user.areaId) || "",
      organization: user.areaName || areaNames.get(user.areaId) || "",
    };
  });
}

async function resolveUserAreaNames(users: User[]) {
  const env = serverEnv();
  const areasResult = await pocketBaseAdminRequest<PocketBaseListResponse<PocketBaseAreaRecord>>(
    `/api/collections/${env.pocketBaseAreasCollection}/records?perPage=200&sort=name`,
  ).catch(() => ({ items: [] }));
  const areaNames = new Map(areasResult.items.map((area) => [area.id, area.name || ""]));

  return users.map((user) => ({
    ...user,
    areaName: user.areaName || areaNames.get(user.areaId) || "",
    organization: user.organization || user.areaName || areaNames.get(user.areaId) || "",
  }));
}

export async function listPocketBaseAreas(token: string) {
  const env = serverEnv();
  await requireAdminUser(token);
  const result = await pocketBaseAdminRequest<PocketBaseListResponse<PocketBaseAreaRecord>>(
    `/api/collections/${env.pocketBaseAreasCollection}/records?perPage=200&sort=name`,
  );

  const areas = result.items.map(mapAreaRecord);
  return areas.map((area) => ({
    ...area,
    parentAreaName: area.parentAreaName || areas.find((item) => item.id === area.parentAreaId)?.name || "",
  }));
}

export async function listPocketBaseInstitutionalTemplates(token: string) {
  const env = serverEnv();
  await requireAnyRole(token, ["admin", "analyst", "stakeholder", "validator"]);
  const result = await pocketBaseRequest<PocketBaseListResponse<PocketBaseInstitutionalTemplateRecord>>(
    `/api/collections/${env.pocketBaseInstitutionalTemplatesCollection}/records?perPage=200&sort=title`,
    {},
    token,
  );

  return result.items
    .map(mapInstitutionalTemplateRecord)
    .filter((template) => template.active !== false && template.blocks.length > 0);
}

export async function createPocketBaseArea(
  data: {
    name: string;
    code?: string;
    description?: string;
    parentAreaId?: string;
  },
  token: string,
) {
  const env = serverEnv();
  await requireAdminUser(token);
  const record = await pocketBaseAdminRequest<PocketBaseAreaRecord>(
    `/api/collections/${env.pocketBaseAreasCollection}/records`,
    {
      method: "POST",
      body: JSON.stringify({
        name: data.name,
        code: data.code ?? "",
        description: data.description ?? "",
        parentAreaId: data.parentAreaId ?? "",
      }),
    },
  );

  return mapAreaRecord(record);
}

export async function createPocketBaseUser(
  data: {
    name: string;
    email: string;
    password: string;
    isAdmin?: boolean;
    areaId?: string;
  },
  token: string,
) {
  const env = serverEnv();
  await requireAdminUser(token);
  const record = await pocketBaseAdminRequest<Record<string, unknown>>(
    `/api/collections/${env.pocketBaseUsersCollection}/records`,
    {
      method: "POST",
      body: JSON.stringify({
        email: data.email,
        password: data.password,
        passwordConfirm: data.password,
        name: data.name,
        isAdmin: Boolean(data.isAdmin),
        areaId: data.areaId ?? "",
        emailVisibility: true,
        verified: true,
      }),
    },
  );

  return mapUserRecord(record);
}

export async function updatePocketBaseUser(
  userId: string,
  data: {
    name?: string;
    email?: string;
    areaId?: string;
    isAdmin?: boolean;
  },
  token: string,
) {
  const env = serverEnv();
  await requireAdminUser(token);
  const record = await pocketBaseAdminRequest<Record<string, unknown>>(
    `/api/collections/${env.pocketBaseUsersCollection}/records/${userId}`,
    {
      method: "PATCH",
      body: JSON.stringify({
        ...(data.email ? { email: data.email } : {}),
        ...(data.name ? { name: data.name } : {}),
        ...(data.areaId !== undefined ? { areaId: data.areaId } : {}),
        ...(data.isAdmin !== undefined ? { isAdmin: data.isAdmin } : {}),
      }),
    },
  );

  return mapUserRecord(record);
}

export async function deletePocketBaseUser(userId: string, token: string) {
  const env = serverEnv();
  await requireAdminUser(token);
  await pocketBaseAdminRequest<Record<string, never>>(
    `/api/collections/${env.pocketBaseUsersCollection}/records/${userId}`,
    { method: "DELETE" },
  );

  const projects = await pocketBaseAdminRequest<PocketBaseListResponse<PocketBaseProjectRecord>>(
    `/api/collections/${env.pocketBaseProjectsCollection}/records?perPage=200`,
  );
  const changedProjects: Project[] = [];

  for (const project of projects.items) {
    const participants = normalizeParticipants(project.participants);

    if (!participants.some((participant) => participant.userId === userId)) {
      continue;
    }

    const updated = await pocketBaseAdminRequest<PocketBaseProjectRecord>(
      `/api/collections/${env.pocketBaseProjectsCollection}/records/${project.id}`,
      {
        method: "PATCH",
        body: JSON.stringify({
          participants: participants.filter((participant) => participant.userId !== userId),
        }),
      },
    );
    changedProjects.push(mapProjectRecord(updated));
  }

  return { deletedUserId: userId, projects: changedProjects };
}

export async function updatePocketBaseProjectParticipants(
  projectId: string,
  participants: ProjectParticipant[],
  token: string,
) {
  const env = serverEnv();
  const currentUser = await getCurrentPocketBaseUser(token);

  if (!hasRole(currentUser, "admin")) {
    throw forbidden("Only admin users can assign project participants.");
  }

  const record = await pocketBaseRequest<PocketBaseProjectRecord>(
    `/api/collections/${env.pocketBaseProjectsCollection}/records/${projectId}`,
    {
      method: "PATCH",
      body: JSON.stringify({ participants }),
    },
    token,
  );

  return mapProjectRecord(record);
}

export async function updatePocketBaseProjectDocuments(
  projectId: string,
  documents: AttachedDocument[],
  token: string,
) {
  const env = serverEnv();
  await requireProjectAccess(projectId, token);
  const record = await pocketBaseRequest<PocketBaseProjectRecord>(
    `/api/collections/${env.pocketBaseProjectsCollection}/records/${projectId}`,
    {
      method: "PATCH",
      body: JSON.stringify({ documents }),
    },
    token,
  );

  return mapProjectRecord(record);
}

export async function deletePocketBaseFileRecord(storageRecordId: string, token: string) {
  const env = serverEnv();

  if (!storageRecordId) {
    return;
  }

  await pocketBaseRequest<Record<string, never>>(
    `/api/collections/${env.pocketBaseFilesCollection}/records/${storageRecordId}`,
    { method: "DELETE" },
    token,
  );
}

async function getCurrentPocketBaseUser(token: string) {
  const env = serverEnv();
  const auth = await pocketBaseRequest<PocketBaseAuthResponse>(
    `/api/collections/${env.pocketBaseUsersCollection}/auth-refresh`,
    { method: "POST", body: JSON.stringify({}) },
    token,
  );

  return mapUserRecord(auth.record);
}

export async function requireProjectAccess(projectId: string, token: string) {
  const env = serverEnv();
  const user = await getCurrentPocketBaseUser(token);
  const record = await pocketBaseRequest<PocketBaseProjectRecord>(
    `/api/collections/${env.pocketBaseProjectsCollection}/records/${projectId}`,
    {},
    token,
  );
  const project = mapProjectRecord(record);

  if (userCanAccessProject(user, project)) {
    return { user, project };
  }

  throw forbidden("You do not have access to manage this project.");
}

async function requireAdminUser(token: string) {
  const user = await getCurrentPocketBaseUser(token);

  if (!hasRole(user, "admin")) {
    throw forbidden("Only admin users can manage application users.");
  }

  return user;
}

async function getPocketBaseAdminToken() {
  if (cachedAdminToken) {
    return cachedAdminToken;
  }

  if (process.env.POCKETBASE_ADMIN_TOKEN) {
    cachedAdminToken = process.env.POCKETBASE_ADMIN_TOKEN;
    return cachedAdminToken;
  }

  const identity = process.env.POCKETBASE_ADMIN_EMAIL;
  const password = process.env.POCKETBASE_ADMIN_PASSWORD;

  if (!identity || !password) {
    throw upstreamError("PocketBase admin credentials are not configured.");
  }

  const auth = await tryAdminAuth("/api/admins/auth-with-password", identity, password).catch(() =>
    tryAdminAuth("/api/collections/_superusers/auth-with-password", identity, password),
  );
  cachedAdminToken = auth.token;
  return cachedAdminToken;
}

async function tryAdminAuth(path: string, identity: string, password: string) {
  const env = serverEnv();
  const response = await fetch(`${env.pocketBaseUrl}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identity, password }),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  return response.json() as Promise<PocketBaseSuperuserAuthResponse>;
}

export function mapUserRecord(record: Record<string, unknown>): User {
  const rawRoles = normalizeRoles(record.roles);
  const primaryRole = normalizeRole(record.role);
  const isAdmin = normalizeBoolean(record.isAdmin ?? record.isadmin) || primaryRole === "admin" || rawRoles.includes("admin");
  const roles: UserRole[] = rawRoles.length > 0 ? rawRoles : [isAdmin ? "admin" : primaryRole];
  const normalizedRoles: UserRole[] = isAdmin && !roles.includes("admin") ? ["admin", ...roles] : roles;
  const role: UserRole = normalizedRoles.includes(primaryRole) ? primaryRole : normalizedRoles[0] || "stakeholder";
  const areaId = String(record.areaId || record.area || "");
  const areaName = String(record.areaName || record.organization || record.organisation || "");

  return {
    id: String(record.id ?? ""),
    name: String(record.name || record.username || record.email || "Requixen user"),
    email: String(record.email ?? ""),
    isAdmin,
    role,
    roles: normalizedRoles,
    organization: areaName,
    areaId,
    areaName,
  };
}

function mapAreaRecord(record: PocketBaseAreaRecord): MunicipalArea {
  return {
    id: record.id,
    name: record.name || "Area sin nombre",
    code: record.code || "",
    description: record.description || "",
    parentAreaId: record.parentAreaId || "",
    parentAreaName: record.parentAreaName || "",
    createdAt: record.created?.slice(0, 10) || "",
    updatedAt: record.updated?.slice(0, 10) || "",
  };
}

function mapInstitutionalTemplateRecord(record: PocketBaseInstitutionalTemplateRecord): InstitutionalInterviewTemplate {
  const templateId = record.templateId || record.id;
  const institutionalRequest = normalizeInstitutionalRequestRecord(record.institutionalRequest) ?? {
    templateId,
    templateName: record.title || templateId,
    requestingArea: "",
    receivingArea: "Direccion de Modernizacion",
    contactPerson: "",
    requestedAction: "",
    targetPopulation: "",
    urgency: "medium",
  };

  return {
    id: templateId,
    title: record.title || institutionalRequest.templateName || "Plantilla institucional",
    description: record.description || "",
    projectName: record.projectName || record.title || "Nuevo pedido institucional",
    problem: record.problem || "",
    institutionalRequest: {
      ...institutionalRequest,
      templateId,
      templateName: institutionalRequest.templateName || record.title || templateId,
    },
    mediatorPrompt: record.mediatorPrompt || "",
    blocks: normalizeGuidedInterviewBlocks(record.blocks),
    confirmationArea: record.confirmationArea || institutionalRequest.requestingArea || "el area solicitante",
    active: record.active !== false,
  };
}

function normalizeGuidedInterviewBlocks(value: unknown): GuidedInterviewBlock[] {
  const rawBlocks = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? parseJsonArray(value)
      : [];
  const blocks: GuidedInterviewBlock[] = [];

  for (const item of rawBlocks) {
    if (!item || typeof item !== "object") {
      continue;
    }

    const block = item as Record<string, unknown>;
    const id = String(block.id ?? block.title ?? "");
    const title = String(block.title ?? "");

    if (!id || !title) {
      continue;
    }

    blocks.push({
      id,
      title,
      goal: String(block.goal ?? ""),
      prompt: String(block.prompt ?? ""),
      questions: normalizeStringArray(block.questions),
      summaryLabel: String(block.summaryLabel ?? title),
      pendingText: String(block.pendingText ?? "Pendiente de completar."),
      keywords: normalizeStringArray(block.keywords),
    });
  }

  return blocks;
}

function normalizeStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }

  if (typeof value === "string") {
    const parsed = parseJsonArray(value);

    if (parsed.length > 0) {
      return parsed.map((item) => String(item).trim()).filter(Boolean);
    }

    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
}

function hasRole(user: User, role: UserRole) {
  if (role === "admin") {
    return user.isAdmin;
  }

  return user.roles.includes(role);
}

function normalizeBoolean(value: unknown) {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    return value.toLowerCase() === "true" || value === "1";
  }

  return false;
}

function normalizeRole(value: unknown): UserRole {
  const role = String(value ?? "stakeholder");

  if (role === "admin" || role === "analyst" || role === "stakeholder" || role === "validator") {
    return role;
  }

  return "stakeholder";
}

function normalizeRoles(value: unknown): UserRole[] {
  const rawRoles = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? parseRolesString(value)
      : [];
  const roles = rawRoles.map(normalizeRole);
  return [...new Set(roles)];
}

function parseRolesString(value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    return [];
  }

  try {
    const parsed = JSON.parse(trimmed) as unknown;
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    return trimmed.split(",").map((role) => role.trim());
  }
}

function normalizeProjectRole(value: unknown): ProjectRole {
  const role = normalizeRole(value);
  return role === "admin" ? "stakeholder" : role;
}

function mapProjectRecord(record: PocketBaseProjectRecord): Project {
  return {
    id: record.id,
    name: record.name || "Untitled requirements project",
    domain: record.domain || "Digital government",
    municipality: record.municipality || "Unspecified organization",
    areaId: record.areaId || "",
    summary: record.summary || "Initial problem pending analyst refinement.",
    transcript: record.transcript || "",
    status: record.status || "elicitation",
    createdAt: record.created?.slice(0, 10) || "",
    updatedAt: record.updated?.slice(0, 10) || "",
    documents: normalizeDocuments(record.documents),
    participants: normalizeParticipants(record.participants),
    institutionalRequest: normalizeInstitutionalRequestRecord(record.institutionalRequest),
  };
}

function normalizeParticipants(value: unknown): ProjectParticipant[] {
  if (Array.isArray(value)) {
    const participants: ProjectParticipant[] = [];

    for (const item of value) {
      if (!item || typeof item !== "object") {
        continue;
      }

      const participant = item as Record<string, unknown>;
      const userId = String(participant.userId ?? participant.id ?? "");

      if (!userId) {
        continue;
      }

      participants.push({
        userId,
        name: String(participant.name ?? participant.email ?? "User"),
        email: String(participant.email ?? ""),
        role: normalizeProjectRole(participant.role),
        areaId: String(participant.areaId ?? ""),
        areaName: String(participant.areaName ?? ""),
      });
    }

    return participants;
  }

  if (typeof value === "string") {
    try {
      return normalizeParticipants(JSON.parse(value) as unknown);
    } catch {
      return [];
    }
  }

  return [];
}

function normalizeDocuments(value: unknown): AttachedDocument[] {
  if (Array.isArray(value)) {
    return value as AttachedDocument[];
  }

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value) as unknown;
      return Array.isArray(parsed) ? (parsed as AttachedDocument[]) : [];
    } catch {
      return [];
    }
  }

  return [];
}

function normalizeInstitutionalRequestRecord(value: unknown): Project["institutionalRequest"] {
  if (!value) {
    return undefined;
  }

  const record =
    typeof value === "string"
      ? parseJsonObject(value)
      : typeof value === "object"
        ? (value as Record<string, unknown>)
        : null;

  if (!record) {
    return undefined;
  }

  const urgency = String(record.urgency ?? "medium");

  return {
    templateId: String(record.templateId ?? ""),
    templateName: String(record.templateName ?? ""),
    requestingArea: String(record.requestingArea ?? ""),
    receivingArea: String(record.receivingArea ?? ""),
    contactPerson: String(record.contactPerson ?? ""),
    requestedAction: String(record.requestedAction ?? ""),
    targetPopulation: String(record.targetPopulation ?? ""),
    urgency: urgency === "low" || urgency === "high" ? urgency : "medium",
  };
}

function parseJsonObject(value: string) {
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function parseJsonArray(value: string) {
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
