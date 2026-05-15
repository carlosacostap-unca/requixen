import { expect, test } from "@playwright/test";
import { reconstructRoom } from "@/lib/requixen/server/elicitation-runtime";

test.describe("elicitation runtime reconstruction", () => {
  test("reconstruye sesiones, mensajes y contribuciones persistidas", () => {
    const room = reconstructRoom("project-1", {
      sessions: [
        {
          id: "record-session-1",
          projectId: "project-1",
          sessionId: "session-1",
          title: "Mesa de entrada",
          createdBy: "Analista",
          deleted: false,
          createdAt: "2026-05-15T10:00:00.000Z",
          updatedAt: "2026-05-15T10:02:00.000Z",
        },
      ],
      messages: [
        {
          id: "message-1",
          projectId: "project-1",
          sessionId: "session-1",
          authorName: "Marina",
          authorRole: "stakeholder",
          body: "Necesitamos registrar reclamos con direccion precisa.",
          kind: "need",
          timestamp: "2026-05-15T10:01:00.000Z",
        },
      ],
      contributions: [
        {
          id: "contribution-1",
          projectId: "project-1",
          sessionId: "session-1",
          authorName: "Marina",
          authorRole: "stakeholder",
          body: "Registrar reclamos con direccion precisa.",
          kind: "need",
          confidence: 0.82,
          timestamp_: "2026-05-15T10:01:00.000Z",
        },
      ],
      clarifications: [],
    });

    expect(room.activeSessionId).toBe("session-1");
    expect(room.sessions).toHaveLength(1);
    expect(room.sessions[0].title).toBe("Mesa de entrada");
    expect(room.sessions[0].messages[0].body).toContain("direccion precisa");
    expect(room.contributions).toHaveLength(1);
    expect(room.contributions[0].id).toBe("contribution-1");
  });

  test("crea sesion por defecto cuando no hay runtime persistido", () => {
    const room = reconstructRoom("empty-project", {});

    expect(room.sessions).toHaveLength(1);
    expect(room.activeSessionId).toBe("room-empty-project");
    expect(room.sessions[0].messages[0].authorRole).toBe("mediator-ai");
  });
});
