import fs from "node:fs";

const env = Object.fromEntries(
  fs
    .readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((line) => line && !line.trim().startsWith("#") && line.includes("="))
    .map((line) => {
      const separator = line.indexOf("=");
      const key = line.slice(0, separator).trim();
      const value = line.slice(separator + 1).trim().replace(/^["']|["']$/g, "");
      return [key, value];
    }),
);

const localBaseUrl = process.env.REQUIXEN_LOCAL_URL || "http://localhost:3000";
const pocketBaseUrl = env.POCKETBASE_URL?.replace(/\/$/, "");
const collections = {
  users: env.POCKETBASE_USERS_COLLECTION || "users",
  projects: env.POCKETBASE_PROJECTS_COLLECTION || "requixen_projects",
  messages: env.POCKETBASE_ELICITATION_MESSAGES_COLLECTION || "requixen_elicitation_messages",
  sessions: env.POCKETBASE_ELICITATION_SESSIONS_COLLECTION || "requixen_elicitation_sessions",
  contributions: env.POCKETBASE_ELICITATION_CONTRIBUTIONS_COLLECTION || "requixen_elicitation_contributions",
  clarifications: env.POCKETBASE_CLARIFICATIONS_COLLECTION || "requixen_clarifications",
  artifacts: env.POCKETBASE_ARTIFACTS_COLLECTION || "requixen_artifacts",
  risks: env.POCKETBASE_RISKS_COLLECTION || "requixen_risks",
  traces: env.POCKETBASE_TRACES_COLLECTION || "requixen_traces",
  audit: env.POCKETBASE_AUDIT_COLLECTION || "requixen_audit",
};

if (!pocketBaseUrl) {
  throw new Error("POCKETBASE_URL is required in .env.local.");
}

const runId = `${Date.now()}`;
const now = new Date().toISOString();
const userPassword = `Smoke1234$${runId}`;
const created = {
  userId: "",
  projectId: "",
};

async function main() {
  const adminToken = await authenticateAdmin();

  try {
    await assertLocalApiReady();

    const user = await createSmokeUser(adminToken);
    created.userId = user.id;

    const session = await localJson("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({
        identity: user.email,
        password: userPassword,
      }),
    });
    const token = session.token;

    const project = await createSmokeProject(token, user);
    created.projectId = project.id;
    assert(
      project.institutionalRequest?.templateId === "school-health-survey",
      "Project did not preserve the institutional request metadata.",
    );

    const sessionId = `smoke-session-${runId}`;
    await persistSession(token, project.id, sessionId);
    await persistMessage(token, project.id, sessionId);
    await persistContribution(token, project.id, sessionId);
    await persistAnsweredClarification(token, user.id, project.id, sessionId);
    await persistWorkspaceLayer(token, project.id);

    const runtime = await localJson(`/api/elicitation/runtime?projectId=${encodeURIComponent(project.id)}`, {
      headers: bearer(token),
    });
    const workspaceRuntime = await localJson(`/api/workspace/runtime?projectId=${encodeURIComponent(project.id)}`, {
      headers: bearer(token),
    });

    try {
      assertRuntime(runtime, sessionId);
      assertWorkspaceRuntime(workspaceRuntime);
    } catch (error) {
      await debugDirectRuntimeCollections(token, project.id);
      console.error(
        JSON.stringify(
          {
            warnings: runtime.warnings,
            sessionIds: runtime.room?.sessions?.map((session) => session.id),
            messages: runtime.messages?.map((message) => ({
              id: message.id,
              kind: message.kind,
              body: message.body,
            })),
            contributions: runtime.room?.contributions,
            clarifications: runtime.room?.clarifications,
          },
          null,
          2,
        ),
      );
      throw error;
    }

    console.log(
      [
        "PocketBase runtime smoke test passed.",
        `project=${project.id}`,
        `sessions=${runtime.room.sessions.length}`,
        `messages=${runtime.messages.length}`,
        `contributions=${runtime.room.contributions.length}`,
        `clarifications=${runtime.room.clarifications.length}`,
        `artifacts=${workspaceRuntime.artifacts.length}`,
        `traces=${workspaceRuntime.traces.length}`,
      ].join("\n"),
    );
  } finally {
    await cleanup(adminToken);
  }
}

async function persistWorkspaceLayer(token, projectId) {
  await localJson("/api/workspace/runtime", {
    method: "POST",
    headers: bearer(token),
    body: JSON.stringify({
      projectId,
      layerId: "mediator",
      artifacts: [
        {
          id: `smoke-artifact-${runId}`,
          layerId: "mediator",
          title: "SMOKE-REQ-01",
          type: "Raw requirement",
          body: "El sistema debe registrar reclamos con evidencia trazable.",
          status: "proposed",
          confidence: 0.84,
          source: "Smoke contribution.",
          generatedBy: "Smoke test",
          assumptions: "La fuente fue creada por el smoke test.",
        },
      ],
      risks: [
        {
          id: `smoke-risk-${runId}`,
          artifactId: `smoke-artifact-${runId}`,
          layerId: "mediator",
          kind: "traceability",
          label: "Smoke risk",
          detail: "Debe revisarse la fuente antes de aprobar.",
          severity: "low",
          confidence: 0.7,
        },
      ],
      traces: [
        {
          id: `smoke-trace-${runId}`,
          fromEvidenceId: `smoke-contribution-${runId}`,
          fromLabel: "Smoke contribution",
          toArtifactId: `smoke-artifact-${runId}`,
          relation: "sustenta",
        },
      ],
      audit: [
        {
          id: `smoke-audit-${runId}`,
          timestamp: now,
          layerId: "mediator",
          action: "Smoke workspace runtime persisted.",
          actor: "Smoke test",
        },
      ],
    }),
  });
}

async function debugDirectRuntimeCollections(token, projectId) {
  const filter = encodeURIComponent(`projectId="${projectId}"`);

  for (const collection of [collections.sessions, collections.contributions, collections.clarifications]) {
    try {
      const result = await pbJson(`/api/collections/${collection}/records?perPage=10&filter=${filter}`, token);
      console.error(`${collection}: direct list ok (${result.items?.length ?? 0})`);
    } catch (error) {
      console.error(`${collection}: direct list failed: ${error.message}`);
    }

  }
}

async function authenticateAdmin() {
  const body = JSON.stringify({
    identity: env.POCKETBASE_ADMIN_EMAIL,
    password: env.POCKETBASE_ADMIN_PASSWORD,
  });

  for (const path of ["/api/collections/_superusers/auth-with-password", "/api/admins/auth-with-password"]) {
    const response = await fetch(`${pocketBaseUrl}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });

    if (response.ok) {
      return (await response.json()).token;
    }
  }

  throw new Error("PocketBase admin authentication failed.");
}

async function assertLocalApiReady() {
  const status = await localJson("/api/integrations/status");

  if (!status?.pocketBase) {
    throw new Error("Local Requixen API is not connected to PocketBase.");
  }
}

async function createSmokeUser(adminToken) {
  return pbJson(`/api/collections/${collections.users}/records`, adminToken, {
    method: "POST",
    body: JSON.stringify({
      email: `smoke.requixen.${runId}@example.test`,
      password: userPassword,
      passwordConfirm: userPassword,
      name: "Smoke Requixen",
      verified: true,
      emailVisibility: true,
      isAdmin: false,
      role: "analyst",
      roles: ["analyst"],
    }),
  });
}

async function createSmokeProject(token, user) {
  const response = await localJson("/api/projects", {
    method: "POST",
    headers: bearer(token),
    body: JSON.stringify({
      project: {
        id: "",
        name: `Smoke Requixen Runtime ${runId}`,
        domain: "Digital government",
        municipality: "QA",
        areaId: "",
        summary: "Smoke test project for elicitation runtime persistence.",
        transcript: "",
        status: "elicitation",
        createdAt: now.slice(0, 10),
        updatedAt: now.slice(0, 10),
        documents: [],
        participants: [
          {
            userId: user.id,
            name: user.name,
            email: user.email,
            role: "analyst",
          },
        ],
        institutionalRequest: {
          templateId: "school-health-survey",
          templateName: "Relevamiento sanitario escolar",
          requestingArea: "Secretaria de Salud",
          receivingArea: "Direccion de Modernizacion",
          contactPerson: "Smoke Requixen",
          requestedAction: "Relevar informacion sanitaria de alumnos de escuelas municipales.",
          targetPopulation: "Alumnos de escuelas municipales",
          urgency: "medium",
        },
      },
    }),
  });

  return response.project;
}

async function persistSession(token, projectId, sessionId) {
  await localJson("/api/elicitation/sessions", {
    method: "POST",
    headers: bearer(token),
    body: JSON.stringify({
      projectId,
      session: {
        id: sessionId,
        title: "Smoke session",
        createdBy: "Smoke Requixen",
        createdAt: now,
        updatedAt: now,
      },
      deleted: false,
    }),
  });
}

async function persistMessage(token, projectId, sessionId) {
  await localJson("/api/elicitation/messages", {
    method: "POST",
    headers: bearer(token),
    body: JSON.stringify({
      projectId,
      sessionId,
      authorName: "Smoke Requixen",
      authorRole: "analyst",
      body: "Necesitamos registrar reclamos con direccion precisa.",
      kind: "need",
      timestamp: now,
    }),
  });
}

async function persistContribution(token, projectId, sessionId) {
  await localJson("/api/elicitation/contributions", {
    method: "POST",
    headers: bearer(token),
    body: JSON.stringify({
      projectId,
      sessionId,
      contribution: {
        id: `smoke-contribution-${runId}`,
        authorName: "Smoke Requixen",
        authorRole: "analyst",
        body: "Registrar reclamos con direccion precisa.",
        kind: "need",
        timestamp: now,
      },
      confidence: 0.82,
    }),
  });
}

async function persistAnsweredClarification(token, userId, projectId, sessionId) {
  const createdClarification = await localJson("/api/elicitation/clarifications", {
    method: "POST",
    headers: bearer(token),
    body: JSON.stringify({
      projectId,
      sessionId,
      clarification: {
        id: `smoke-clarification-${runId}`,
        projectId,
        question: "Que datos minimos requiere el reclamo?",
        targetUserId: userId,
        targetName: "Smoke Requixen",
        requestedBy: userId,
        requestedByName: "Smoke Requixen",
        status: "sent",
        createdAt: now,
        sentAt: now,
      },
    }),
  });

  await localJson("/api/elicitation/clarifications", {
    method: "PATCH",
    headers: bearer(token),
    body: JSON.stringify({
      projectId,
      clarificationId: createdClarification.clarification.id,
      response: "Ubicacion, tipo de problema y contacto.",
      respondedBy: userId,
      respondedByName: "Smoke Requixen",
      respondedAt: now,
    }),
  });

  await localJson("/api/elicitation/clarifications", {
    method: "PATCH",
    headers: bearer(token),
    body: JSON.stringify({
      projectId,
      clarificationId: createdClarification.clarification.id,
      status: "closed",
    }),
  });
}

function assertRuntime(runtime, sessionId) {
  assert(
    runtime.room?.sessions?.some((session) => session.id === sessionId),
    "Runtime did not include the persisted session.",
  );
  assert(
    runtime.messages?.some((message) => message.body.includes("direccion precisa")),
    "Runtime did not include the persisted message.",
  );
  assert(
    runtime.room?.contributions?.some((contribution) => contribution.body.includes("Registrar reclamos")),
    "Runtime did not include the persisted contribution.",
  );
  assert(
    runtime.room?.clarifications?.some(
      (clarification) => clarification.status === "closed" && clarification.response?.includes("Ubicacion"),
    ),
    "Runtime did not include the closed clarification.",
  );
}

function assertWorkspaceRuntime(runtime) {
  assert(
    runtime.artifacts?.some((artifact) => artifact.title === "SMOKE-REQ-01"),
    "Workspace runtime did not include the persisted artifact.",
  );
  assert(
    runtime.traces?.some((trace) => trace.toArtifactId === `smoke-artifact-${runId}`),
    "Workspace runtime did not include the persisted trace.",
  );
  assert(
    runtime.risks?.some((risk) => risk.artifactId === `smoke-artifact-${runId}`),
    "Workspace runtime did not include the persisted risk.",
  );
  assert(
    runtime.audit?.some((entry) => entry.action === "Smoke workspace runtime persisted."),
    "Workspace runtime did not include the persisted audit entry.",
  );
}

async function cleanup(adminToken) {
  if (created.projectId) {
    for (const collection of [
      collections.messages,
      collections.sessions,
      collections.contributions,
      collections.clarifications,
      collections.artifacts,
      collections.risks,
      collections.traces,
      collections.audit,
    ]) {
      await deleteRecordsByProjectId(collection, created.projectId, adminToken);
    }

    await pbJson(`/api/collections/${collections.projects}/records/${created.projectId}`, adminToken, {
      method: "DELETE",
    }).catch((error) => {
      console.warn(`Project cleanup skipped: ${error.message}`);
    });
  }

  if (created.userId) {
    await pbJson(`/api/collections/${collections.users}/records/${created.userId}`, adminToken, {
      method: "DELETE",
    }).catch((error) => {
      console.warn(`User cleanup skipped: ${error.message}`);
    });
  }
}

async function deleteRecordsByProjectId(collection, projectId, token) {
  const filter = encodeURIComponent(`projectId="${projectId}"`);
  const result = await pbJson(`/api/collections/${collection}/records?perPage=500&filter=${filter}`, token);

  for (const item of result.items || []) {
    await pbJson(`/api/collections/${collection}/records/${item.id}`, token, {
      method: "DELETE",
    });
  }
}

async function pbJson(path, token, init = {}) {
  return requestJson(`${pocketBaseUrl}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(init.headers || {}),
    },
  });
}

async function localJson(path, init = {}) {
  return requestJson(`${localBaseUrl}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
}

async function requestJson(url, init = {}) {
  const response = await fetch(url, init);
  const text = await response.text();

  if (!response.ok) {
    throw new Error(`${url} failed (${response.status}): ${text}`);
  }

  return text ? JSON.parse(text) : {};
}

function bearer(token) {
  return {
    Authorization: `Bearer ${token}`,
  };
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

await main();
