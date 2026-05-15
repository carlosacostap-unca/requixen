import { NextResponse } from "next/server";
import { apiErrorResponse, badRequest, handleApiError, unauthorized } from "@/lib/requixen/server/api-errors";
import { loadElicitationRuntime } from "@/lib/requixen/server/elicitation-runtime";
import { bearerToken } from "@/lib/requixen/server/pocketbase";

export async function GET(request: Request) {
  try {
    const token = bearerToken(request);

    if (!token) {
      return apiErrorResponse(unauthorized());
    }

    const projectId = new URL(request.url).searchParams.get("projectId") ?? "";

    if (!projectId) {
      return apiErrorResponse(badRequest("projectId is required."));
    }

    const runtime = await loadElicitationRuntime(projectId, token);
    return NextResponse.json(runtime);
  } catch (error) {
    return handleApiError(error, "Unable to load elicitation runtime.");
  }
}
