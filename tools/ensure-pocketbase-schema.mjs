import fs from "node:fs";

const env = Object.fromEntries(
  fs
    .readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((line) => line && !line.trim().startsWith("#") && line.includes("="))
    .map((line) => {
      const separator = line.indexOf("=");
      return [line.slice(0, separator).trim(), line.slice(separator + 1).trim()];
    }),
);

const pocketBaseUrl = env.POCKETBASE_URL?.replace(/\/$/, "");

if (!pocketBaseUrl) {
  throw new Error("POCKETBASE_URL is required.");
}

const field = {
  text: (name) => ({
    name,
    type: "text",
    required: false,
    hidden: false,
    presentable: false,
    min: 0,
    max: 0,
    pattern: "",
  }),
  editor: (name) => ({
    name,
    type: "editor",
    required: false,
    hidden: false,
    presentable: false,
    convertURLs: false,
    maxSize: 0,
  }),
  bool: (name) => ({
    name,
    type: "bool",
    required: false,
    hidden: false,
    presentable: false,
  }),
  number: (name) => ({
    name,
    type: "number",
    required: false,
    hidden: false,
    presentable: false,
    onlyInt: false,
    min: null,
    max: null,
  }),
  json: (name) => ({
    name,
    type: "json",
    required: false,
    hidden: false,
    presentable: false,
    maxSize: 0,
  }),
};

const openRules = {
  listRule: '@request.auth.id != ""',
  viewRule: '@request.auth.id != ""',
  createRule: '@request.auth.id != ""',
  updateRule: '@request.auth.id != ""',
  deleteRule: '@request.auth.role = "admin"',
};

const collectionDefinitions = {
  [env.POCKETBASE_ELICITATION_SESSIONS_COLLECTION || "requixen_elicitation_sessions"]: [
    field.text("projectId"),
    field.text("sessionId"),
    field.text("title"),
    field.text("createdBy"),
    field.bool("deleted"),
    field.text("createdAt"),
    field.text("updatedAt"),
  ],
  [env.POCKETBASE_ELICITATION_CONTRIBUTIONS_COLLECTION || "requixen_elicitation_contributions"]: [
    field.text("projectId"),
    field.text("sessionId"),
    field.text("sourceMessageId"),
    field.text("authorName"),
    field.text("authorRole"),
    field.editor("body"),
    field.text("kind"),
    field.number("confidence"),
    field.text("timestamp_"),
  ],
  [env.POCKETBASE_CLARIFICATIONS_COLLECTION || "requixen_clarifications"]: [
    field.text("projectId"),
    field.text("sessionId"),
    field.editor("question"),
    field.text("targetUserId"),
    field.text("targetName"),
    field.text("requestedBy"),
    field.text("requestedByName"),
    field.text("status"),
    field.editor("response"),
    field.text("respondedBy"),
    field.text("respondedByName"),
    field.text("sentAt"),
    field.text("respondedAt"),
  ],
  [env.POCKETBASE_INSTITUTIONAL_TEMPLATES_COLLECTION || "requixen_institutional_templates"]: [
    field.text("templateId"),
    field.text("title"),
    field.editor("description"),
    field.text("projectName"),
    field.editor("problem"),
    field.json("institutionalRequest"),
    field.editor("mediatorPrompt"),
    field.json("blocks"),
    field.text("confirmationArea"),
    field.bool("active"),
  ],
  [env.POCKETBASE_ARTIFACTS_COLLECTION || "requixen_artifacts"]: [
    field.text("projectId"),
    field.text("artifactId"),
    field.text("layerId"),
    field.text("title"),
    field.text("type"),
    field.editor("body"),
    field.text("status"),
    field.number("confidence"),
    field.editor("source"),
    field.text("generatedBy"),
    field.editor("assumptions"),
  ],
  [env.POCKETBASE_RISKS_COLLECTION || "requixen_risks"]: [
    field.text("projectId"),
    field.text("riskId"),
    field.text("artifactId"),
    field.text("layerId"),
    field.text("kind"),
    field.text("label"),
    field.editor("detail"),
    field.text("severity"),
    field.number("confidence"),
  ],
  [env.POCKETBASE_TRACES_COLLECTION || "requixen_traces"]: [
    field.text("projectId"),
    field.text("traceId"),
    field.text("layerId"),
    field.text("fromArtifactId"),
    field.text("fromEvidenceId"),
    field.text("fromLabel"),
    field.text("toArtifactId"),
    field.text("relation"),
  ],
  [env.POCKETBASE_AUDIT_COLLECTION || "requixen_audit"]: [
    field.text("projectId"),
    field.text("auditId"),
    field.text("layerId"),
    field.text("timestamp"),
    field.editor("action"),
    field.text("actor"),
  ],
};

async function authenticate() {
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

async function request(path, token, init = {}) {
  const response = await fetch(`${pocketBaseUrl}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(init.headers || {}),
    },
  });
  const text = await response.text();

  if (!response.ok) {
    throw new Error(`${path} failed (${response.status}): ${text}`);
  }

  return text ? JSON.parse(text) : {};
}

async function maybeGetCollection(name, token) {
  try {
    return await request(`/api/collections/${name}`, token);
  } catch {
    return null;
  }
}

function hasField(fields, name) {
  return fields.some((existing) => existing.name === name);
}

async function ensureCollection(name, fields, token) {
  const existing = await maybeGetCollection(name, token);

  if (!existing) {
    await request("/api/collections", token, {
      method: "POST",
      body: JSON.stringify({
        name,
        type: "base",
        fields,
        ...openRules,
      }),
    });
    return `${name}: created`;
  }

  const missing = fields.filter((nextField) => !hasField(existing.fields || [], nextField.name));

  if (missing.length === 0) {
    return `${name}: ok`;
  }

  await request(`/api/collections/${existing.id}`, token, {
    method: "PATCH",
    body: JSON.stringify({
      fields: [...(existing.fields || []), ...missing],
    }),
  });

  return `${name}: added ${missing.map((nextField) => nextField.name).join(", ")}`;
}

async function ensureUserRoleFields(token) {
  const users = await request(`/api/collections/${env.POCKETBASE_USERS_COLLECTION || "users"}`, token);
  const missing = [field.text("role"), field.json("roles")].filter(
    (nextField) => !hasField(users.fields || [], nextField.name),
  );

  if (missing.length === 0) {
    return "users: ok";
  }

  await request(`/api/collections/${users.id}`, token, {
    method: "PATCH",
    body: JSON.stringify({
      fields: [...(users.fields || []), ...missing],
    }),
  });

  return `users: added ${missing.map((nextField) => nextField.name).join(", ")}`;
}

async function ensureProjectInstitutionalRequestField(token) {
  const projects = await request(`/api/collections/${env.POCKETBASE_PROJECTS_COLLECTION || "requixen_projects"}`, token);
  const missing = [field.json("institutionalRequest")].filter(
    (nextField) => !hasField(projects.fields || [], nextField.name),
  );

  if (missing.length === 0) {
    return "projects: ok";
  }

  await request(`/api/collections/${projects.id}`, token, {
    method: "PATCH",
    body: JSON.stringify({
      fields: [...(projects.fields || []), ...missing],
    }),
  });

  return `projects: added ${missing.map((nextField) => nextField.name).join(", ")}`;
}

const token = await authenticate();
const results = [];

for (const [name, fields] of Object.entries(collectionDefinitions)) {
  results.push(await ensureCollection(name, fields, token));
}

results.push(await ensureUserRoleFields(token));
results.push(await ensureProjectInstitutionalRequestField(token));
console.log(results.join("\n"));
