import { expect, test, type Page, type Route } from "@playwright/test";

const analystUser = {
  id: "user-analyst",
  name: "Carlos Acosta",
  email: "analyst@requixen.local",
  isAdmin: false,
  role: "analyst",
  roles: ["analyst"],
  organization: "Direccion de Modernizacion",
  areaId: "area-modernizacion",
  areaName: "Direccion de Modernizacion",
};

const adminUser = {
  ...analystUser,
  id: "user-admin",
  email: "admin@requixen.local",
  isAdmin: true,
  role: "admin",
  roles: ["admin", "analyst"],
};

const stakeholderUser = {
  id: "user-stakeholder",
  name: "Marina Quiroga",
  email: "stakeholder@requixen.local",
  isAdmin: false,
  role: "stakeholder",
  roles: ["stakeholder"],
  organization: "Secretaria de Salud",
  areaId: "area-salud",
  areaName: "Secretaria de Salud",
};

const modernizationArea = {
  id: "area-modernizacion",
  name: "Direccion de Modernizacion",
  code: "MOD",
  description: "Area responsable de soporte digital y mejora de procesos.",
  parentAreaId: "",
  parentAreaName: "Municipalidad",
  createdAt: "2026-05-15",
  updatedAt: "2026-05-15",
};

const schoolHealthProject = {
  id: "project-school-health-e2e",
  name: "Relevamiento sanitario escolar municipal",
  domain: "Salud publica",
  municipality: "San Fernando del Valle de Catamarca",
  summary:
    "La Secretaria de Salud solicita soporte para relevar datos sanitarios de alumnos de escuelas municipales.",
  transcript:
    "La Secretaria de Salud necesita organizar un relevamiento sanitario a alumnos de escuelas municipales.",
  status: "elicitation",
  createdAt: "2026-05-15",
  updatedAt: "2026-05-15",
  documents: [],
  participants: [
    {
      userId: analystUser.id,
      name: analystUser.name,
      email: analystUser.email,
      role: "analyst",
      areaId: analystUser.areaId,
      areaName: analystUser.areaName,
    },
    {
      userId: stakeholderUser.id,
      name: stakeholderUser.name,
      email: stakeholderUser.email,
      role: "stakeholder",
      areaId: stakeholderUser.areaId,
      areaName: stakeholderUser.areaName,
    },
  ],
  institutionalRequest: {
    templateId: "school-health-survey",
    requestingArea: "Secretaria de Salud",
    receivingArea: "Direccion de Modernizacion",
    contactPerson: "Directora de Salud Escolar",
    requestedAction: "Llevar a cabo una accion de relevamiento sanitario a alumnos de escuelas municipales.",
    targetPopulation: "Alumnos de escuelas municipales",
    urgency: "high",
  },
};

test("guia la solicitud de relevamiento sanitario escolar hasta la ficha relevada", async ({ page }) => {
  await mockRequixenApi(page);

  await page.goto("/");
  await page.getByPlaceholder("Email").fill("analyst@requixen.local");
  await page.getByPlaceholder("Password").fill("demo-password");
  await page.getByRole("button", { name: "Ingresar" }).click();

  await expect(page.getByRole("heading", { name: "Mesa de trabajo del analista RE" })).toBeVisible();
  await page.getByRole("button", { name: "Crear proyecto" }).click();

  await expect(page.getByRole("heading", { name: "Gestion de reclamos urbanos" })).toBeVisible();
  await page.getByRole("button", { name: "Usar plantilla Relevamiento sanitario escolar" }).click();
  await expect(page.getByRole("textbox", { name: "Area solicitante" })).toHaveValue("Secretaria de Salud");
  await expect(page.getByRole("textbox", { name: "Poblacion objetivo" })).toHaveValue("Alumnos de escuelas municipales");

  await page.getByRole("button", { name: "Siguiente" }).click();
  await expect(page.getByRole("textbox", { name: "Nombre del proyecto" })).toHaveValue(
    "Relevamiento sanitario escolar municipal",
  );

  await page.getByRole("button", { name: "Siguiente" }).click();
  await page.getByLabel("Area").selectOption("area-modernizacion");

  await page.getByRole("button", { name: "Siguiente" }).click();
  await expect(page.getByText("La Secretaria de Salud solicita soporte")).toBeVisible();

  await page.getByRole("button", { name: "Siguiente" }).click();
  await page.getByRole("button", { name: "Siguiente" }).click();
  await expect(page.getByText("Llevar a cabo una accion de relevamiento sanitario")).toBeVisible();

  await page.getByRole("button", { name: "Iniciar workspace" }).click();
  await expect(page.getByRole("heading", { name: "Relevamiento sanitario escolar municipal" })).toBeVisible();
  await page.getByRole("button", { name: "Entrar a la fase" }).click();

  await expect(page.getByRole("heading", { name: "Relevamiento sanitario escolar" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Objetivo sanitario" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Solicitud relevada" })).toBeVisible();

  await page.getByRole("button", { name: "Usar esta guia" }).click();
  await expect(page.getByLabel("Mensaje")).toHaveValue(/objetivo sanitario/i);

  await page.getByLabel("Mensaje").fill(
    "Objetivo sanitario: detectar alumnos con controles incompletos de vacunacion y priorizar seguimiento por escuela.",
  );
  await page.getByRole("button", { name: "Enviar al Mediador" }).click();

  await expect(
    page.getByText(
      "Objetivo sanitario: detectar alumnos con controles incompletos de vacunacion y priorizar seguimiento por escuela.",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(
    page.getByText(
      "Objetivo sanitario: Objetivo sanitario: detectar alumnos con controles incompletos de vacunacion y priorizar seguimiento por escuela.",
      { exact: true },
    ),
  ).toBeVisible();
});

test("ofrece una entrevista inmersiva y minimalista para stakeholders", async ({ page }) => {
  await mockRequixenApi(page, stakeholderUser, [schoolHealthProject]);

  await page.goto("/");
  await page.getByPlaceholder("Email").fill("stakeholder@requixen.local");
  await page.getByPlaceholder("Password").fill("demo-password");
  await page.getByRole("button", { name: "Ingresar" }).click();

  await page.getByText("Relevamiento sanitario escolar municipal").click();
  await page.getByRole("button", { name: "Entrar a la fase" }).click();

  await expect(page.getByRole("heading", { name: "Relevamiento sanitario escolar" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Objetivo sanitario" })).toBeVisible();
  await expect(page.getByText("Mediador IA")).toBeVisible();
  await expect(page.getByText("Avance 0/5")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Solicitud relevada" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Nuevo chat" })).toHaveCount(0);

  await page.getByRole("button", { name: "Usar esta guia" }).click();
  await expect(page.getByLabel("Mensaje")).toHaveValue(/objetivo sanitario/i);

  await page.getByLabel("Mensaje").fill(
    "Objetivo sanitario: relevar controles de vacunacion y derivaciones pendientes por escuela.",
  );
  await page.getByRole("button", { name: "Enviar al Mediador" }).click();
  await expect(
    page.getByText("Objetivo sanitario: relevar controles de vacunacion y derivaciones pendientes por escuela.", {
      exact: true,
    }),
  ).toBeVisible();
});

test("permite iniciar otro caso institucional con bloques propios", async ({ page }) => {
  await mockRequixenApi(page);

  await page.goto("/");
  await page.getByPlaceholder("Email").fill("analyst@requixen.local");
  await page.getByPlaceholder("Password").fill("demo-password");
  await page.getByRole("button", { name: "Ingresar" }).click();

  await expect(page.getByRole("heading", { name: "Mesa de trabajo del analista RE" })).toBeVisible();
  await page.getByRole("button", { name: "Crear proyecto" }).click();

  await page.getByRole("button", { name: "Usar plantilla Gestion de reclamos urbanos" }).click();
  await expect(page.getByRole("textbox", { name: "Area solicitante" })).toHaveValue("Secretaria de Obras Publicas");
  await expect(page.getByRole("textbox", { name: "Poblacion objetivo" })).toHaveValue(
    "Vecinos, inspectores, operadores y cuadrillas municipales",
  );

  await page.getByRole("button", { name: "Siguiente" }).click();
  await expect(page.getByRole("textbox", { name: "Nombre del proyecto" })).toHaveValue(
    "Gestion municipal de reclamos urbanos",
  );

  await page.getByRole("button", { name: "Siguiente" }).click();
  await page.getByLabel("Area").selectOption("area-modernizacion");
  await page.getByRole("button", { name: "Siguiente" }).click();
  await page.getByRole("button", { name: "Siguiente" }).click();
  await page.getByRole("button", { name: "Siguiente" }).click();
  await page.getByRole("button", { name: "Iniciar workspace" }).click();

  await expect(page.getByRole("heading", { name: "Gestion municipal de reclamos urbanos" })).toBeVisible();
  await page.getByRole("button", { name: "Entrar a la fase" }).click();

  await expect(page.getByRole("heading", { name: "Gestion de reclamos urbanos" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Ingreso del reclamo" })).toBeVisible();
  await expect(page.getByText("Avance 0/5")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Solicitud relevada" })).toBeVisible();
});

test("permite administrar plantillas institucionales con acciones basicas", async ({ page }) => {
  await mockRequixenApi(page, adminUser);

  await page.goto("/");
  await page.getByPlaceholder("Email").fill("admin@requixen.local");
  await page.getByPlaceholder("Password").fill("demo-password");
  await page.getByRole("button", { name: "Ingresar" }).click();

  await expect(page.getByRole("button", { name: "Gestionar plantillas" })).toBeVisible();
  await page.getByRole("button", { name: "Gestionar plantillas" }).click();

  await expect(page.getByRole("heading", { name: "Gestionar plantillas" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Relevamiento sanitario escolar" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Objetivo sanitario" })).toBeVisible();

  await page.getByRole("button", { name: "Desactivar" }).click();
  await expect(page.getByRole("button", { name: "Activar" })).toBeVisible();

  await page.getByRole("button", { name: "Duplicar" }).click();
  await expect(page.getByText("Relevamiento sanitario escolar copia").first()).toBeVisible();
});

async function mockRequixenApi(page: Page, user = analystUser, projects: unknown[] = []) {
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;

    if (path === "/api/integrations/status") {
      return json(route, { pocketBase: true, openAi: false, qdrant: false });
    }

    if (path === "/api/auth/login") {
      return json(route, { token: "test-token", user });
    }

    if (path === "/api/projects" && request.method() === "GET") {
      return json(route, { projects });
    }

    if (path === "/api/users") {
      return json(route, { users: [analystUser, stakeholderUser, user] });
    }

    if (path === "/api/areas") {
      return json(route, { areas: [modernizationArea] });
    }

    if (path === "/api/projects" && request.method() === "POST") {
      const payload = request.postDataJSON() as { project?: Record<string, unknown> };
      const project = {
        ...payload.project,
        id: "project-school-health-e2e",
        participants: [
          {
            userId: analystUser.id,
            name: analystUser.name,
            email: analystUser.email,
            role: "stakeholder",
            areaId: analystUser.areaId,
            areaName: analystUser.areaName,
          },
        ],
      };

      return json(route, { project });
    }

    if (path.startsWith("/api/elicitation/")) {
      return json(route, { ok: true, messages: [], room: null });
    }

    if (path === "/api/workspace/runtime") {
      return json(route, { ok: true, artifacts: [], risks: [], traces: [], audit: [] });
    }

    return json(route, {});
  });
}

async function json(route: Route, body: unknown) {
  await route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify(body),
  });
}
