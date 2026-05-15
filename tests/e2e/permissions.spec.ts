import { expect, test } from "@playwright/test";
import { ApiError } from "@/lib/requixen/server/api-errors";
import {
  assertAnyRole,
  assertCanCreateProject,
  mapUserRecord,
  userCanAccessProject,
  userHasRole,
} from "@/lib/requixen/server/pocketbase";
import type { Project, User } from "@/lib/requixen/types";

test.describe("role and permission decisions", () => {
  test("preserva roles multiples desde PocketBase", () => {
    const user = mapUserRecord({
      id: "user-1",
      name: "Ana",
      email: "ana@example.test",
      role: "analyst",
      roles: ["admin", "analyst"],
      areaId: "area-1",
    });

    expect(user.role).toBe("analyst");
    expect(user.roles).toEqual(["admin", "analyst"]);
    expect(user.isAdmin).toBe(true);
    expect(userHasRole(user, "admin")).toBe(true);
    expect(userHasRole(user, "analyst")).toBe(true);
  });

  test("normaliza roles en string JSON o separados por coma", () => {
    const jsonRoles = mapUserRecord({
      id: "user-json",
      email: "json@example.test",
      roles: "[\"analyst\",\"validator\"]",
    });
    const commaRoles = mapUserRecord({
      id: "user-comma",
      email: "comma@example.test",
      roles: "analyst, validator",
    });

    expect(jsonRoles.roles).toEqual(["analyst", "validator"]);
    expect(commaRoles.roles).toEqual(["analyst", "validator"]);
  });

  test("rechaza acciones fuera del rol", () => {
    const stakeholder = mapUserRecord({
      id: "stakeholder-1",
      email: "stakeholder@example.test",
      role: "stakeholder",
    });

    expect(() => assertCanCreateProject(stakeholder)).toThrow(ApiError);
    expect(() => assertAnyRole(stakeholder, ["admin"])).toThrow(ApiError);
  });

  test("solo admin o participante accede al proyecto", () => {
    const stakeholder = user("stakeholder-1", "stakeholder");
    const outsider = user("outsider-1", "stakeholder");
    const admin = user("admin-1", "admin");
    const project: Pick<Project, "participants"> = {
      participants: [
        {
          userId: stakeholder.id,
          name: stakeholder.name,
          email: stakeholder.email,
          role: "stakeholder",
        },
      ],
    };

    expect(userCanAccessProject(stakeholder, project)).toBe(true);
    expect(userCanAccessProject(admin, project)).toBe(true);
    expect(userCanAccessProject(outsider, project)).toBe(false);
  });
});

function user(id: string, role: User["role"]): User {
  return {
    id,
    name: id,
    email: `${id}@example.test`,
    isAdmin: role === "admin",
    role,
    roles: [role],
    organization: "",
    areaId: "",
    areaName: "",
  };
}
