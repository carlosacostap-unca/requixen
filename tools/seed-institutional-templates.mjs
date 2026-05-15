import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const envPath = path.join(rootDir, ".env.local");

if (!fs.existsSync(envPath)) {
  throw new Error(".env.local is required.");
}

const env = Object.fromEntries(
  fs
    .readFileSync(envPath, "utf8")
    .split(/\r?\n/)
    .filter((line) => line && !line.trim().startsWith("#") && line.includes("="))
    .map((line) => {
      const separator = line.indexOf("=");
      return [line.slice(0, separator).trim(), line.slice(separator + 1).trim()];
    }),
);

const pocketBaseUrl = env.POCKETBASE_URL?.replace(/\/$/, "");
const collection = env.POCKETBASE_INSTITUTIONAL_TEMPLATES_COLLECTION || "requixen_institutional_templates";
const templatesPath = path.join(rootDir, "lib", "requixen", "institutional-templates.seed.json");
const templates = JSON.parse(fs.readFileSync(templatesPath, "utf8"));

if (!pocketBaseUrl) {
  throw new Error("POCKETBASE_URL is required.");
}

async function authenticate() {
  const body = JSON.stringify({
    identity: env.POCKETBASE_ADMIN_EMAIL,
    password: env.POCKETBASE_ADMIN_PASSWORD,
  });

  for (const authPath of ["/api/collections/_superusers/auth-with-password", "/api/admins/auth-with-password"]) {
    const response = await fetch(`${pocketBaseUrl}${authPath}`, {
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

async function request(apiPath, token, init = {}) {
  const response = await fetch(`${pocketBaseUrl}${apiPath}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(init.headers || {}),
    },
  });
  const text = await response.text();

  if (!response.ok) {
    throw new Error(`${apiPath} failed (${response.status}): ${text}`);
  }

  return text ? JSON.parse(text) : {};
}

function escapeFilterValue(value) {
  return String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

async function findTemplateRecord(templateId, token) {
  const filter = encodeURIComponent(`templateId = "${escapeFilterValue(templateId)}"`);
  const result = await request(`/api/collections/${collection}/records?perPage=1&filter=${filter}`, token);

  return result.items?.[0] ?? null;
}

function templatePayload(template) {
  return {
    templateId: template.id,
    title: template.title,
    description: template.description,
    projectName: template.projectName,
    problem: template.problem,
    institutionalRequest: {
      ...template.institutionalRequest,
      templateId: template.id,
      templateName: template.institutionalRequest?.templateName || template.title,
    },
    mediatorPrompt: template.mediatorPrompt,
    blocks: template.blocks,
    confirmationArea: template.confirmationArea,
    active: template.active !== false,
  };
}

const token = await authenticate();
const results = [];

for (const template of templates) {
  const existing = await findTemplateRecord(template.id, token);
  const payload = templatePayload(template);

  if (existing) {
    await request(`/api/collections/${collection}/records/${existing.id}`, token, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
    results.push(`${template.id}: updated`);
  } else {
    await request(`/api/collections/${collection}/records`, token, {
      method: "POST",
      body: JSON.stringify(payload),
    });
    results.push(`${template.id}: created`);
  }
}

console.log(results.join("\n"));
