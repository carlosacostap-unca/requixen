import { NextResponse } from "next/server";
import { apiErrorResponse, badRequest, handleApiError, unauthorized } from "@/lib/requixen/server/api-errors";
import { bearerToken, createPocketBaseProject, listPocketBaseProjects } from "@/lib/requixen/server/pocketbase";
import type { Project } from "@/lib/requixen/types";

export async function GET(request: Request) {
  try {
    const token = bearerToken(request);

    if (!token) {
      return apiErrorResponse(unauthorized());
    }

    const projects = await listPocketBaseProjects(token);
    return NextResponse.json({ projects });
  } catch (error) {
    return handleApiError(error, "Unable to list projects.");
  }
}

export async function POST(request: Request) {
  try {
    const token = bearerToken(request);

    if (!token) {
      return apiErrorResponse(unauthorized());
    }

    const body = (await request.json()) as { project?: Project };

    if (!body.project) {
      return apiErrorResponse(badRequest("project is required."));
    }

    const project = await createPocketBaseProject(body.project, token);
    return NextResponse.json({ project });
  } catch (error) {
    return handleApiError(error, "Unable to create project.");
  }
}
