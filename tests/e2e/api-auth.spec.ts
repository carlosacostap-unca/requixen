import { expect, test } from "@playwright/test";

test.describe("API authentication boundaries", () => {
  test("expone plantillas institucionales de fallback sin PocketBase", async ({ request }) => {
    const response = await request.get("/api/institutional-templates");
    expect(response.ok()).toBeTruthy();

    const body = (await response.json()) as { source?: string; templates?: Array<{ id?: string; title?: string }> };
    expect(body.source).toBe("fallback");
    expect(body.templates?.map((template) => template.id)).toContain("school-health-survey");
    expect(body.templates?.map((template) => template.id)).toContain("public-works-claims");
  });

  test("rechaza endpoints sensibles sin bearer token", async ({ request }) => {
    const checks = [
      request.get("/api/auth/user-directory"),
      request.post("/api/elicitation/respond", {
        data: { project: { id: "municipal-complaints" }, message: "hola" },
      }),
      request.post("/api/audio/transcribe"),
      request.get("/api/elicitation/messages?projectId=municipal-complaints"),
      request.post("/api/files/upload"),
      request.post("/api/projects", {
        data: { project: { id: "project-test" } },
      }),
      request.get("/api/elicitation/runtime?projectId=municipal-complaints"),
      request.get("/api/workspace/runtime?projectId=municipal-complaints"),
      request.post("/api/elicitation/sessions", {
        data: { projectId: "municipal-complaints", session: { id: "session-1" } },
      }),
      request.post("/api/workspace/runtime", {
        data: { projectId: "municipal-complaints", layerId: "mediator" },
      }),
      request.post("/api/elicitation/contributions", {
        data: { projectId: "municipal-complaints", sessionId: "session-1", contribution: {} },
      }),
      request.post("/api/elicitation/clarifications", {
        data: { projectId: "municipal-complaints", sessionId: "session-1", clarification: {} },
      }),
      request.post("/api/institutional-templates", {
        data: { sourceTemplateId: "school-health-survey" },
      }),
      request.patch("/api/institutional-templates", {
        data: { templateId: "school-health-survey", active: false },
      }),
    ];

    const responses = await Promise.all(checks);

    for (const response of responses) {
      expect(response.status()).toBe(401);
      const body = (await response.json()) as { errorCode?: string; errorDetails?: { code?: string } };
      expect(body.errorCode).toBe("UNAUTHORIZED");
      expect(body.errorDetails?.code).toBe("UNAUTHORIZED");
    }
  });
});
