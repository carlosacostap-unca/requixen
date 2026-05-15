import { NextResponse } from "next/server";
import { apiErrorResponse, badRequest, handleApiError, unauthorized } from "@/lib/requixen/server/api-errors";
import { bearerToken, updatePocketBaseProjectParticipants } from "@/lib/requixen/server/pocketbase";
import type { ProjectParticipant } from "@/lib/requixen/types";

export async function PATCH(request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  try {
    const token = bearerToken(request);

    if (!token) {
      return apiErrorResponse(unauthorized());
    }

    const { projectId } = await params;
    const body = (await request.json()) as { participants?: ProjectParticipant[] };

    if (!body.participants) {
      return apiErrorResponse(badRequest("participants is required."));
    }

    const project = await updatePocketBaseProjectParticipants(projectId, body.participants, token);
    return NextResponse.json({ project });
  } catch (error) {
    return handleApiError(error, "Unable to update participants.");
  }
}
