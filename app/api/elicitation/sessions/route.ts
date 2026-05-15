import { NextResponse } from "next/server";
import { apiErrorResponse, badRequest, handleApiError, unauthorized } from "@/lib/requixen/server/api-errors";
import { upsertElicitationSession } from "@/lib/requixen/server/elicitation-runtime";
import { bearerToken } from "@/lib/requixen/server/pocketbase";
import type { ElicitationChatSession } from "@/lib/requixen/types";

export async function POST(request: Request) {
  try {
    const token = bearerToken(request);

    if (!token) {
      return apiErrorResponse(unauthorized());
    }

    const body = (await request.json()) as {
      projectId?: string;
      session?: Pick<ElicitationChatSession, "id" | "title" | "createdBy" | "createdAt" | "updatedAt">;
      deleted?: boolean;
    };

    if (!body.projectId || !body.session?.id) {
      return apiErrorResponse(badRequest("projectId and session.id are required."));
    }

    const session = await upsertElicitationSession({
      projectId: body.projectId,
      session: body.session,
      deleted: Boolean(body.deleted),
      token,
    });
    return NextResponse.json({ session });
  } catch (error) {
    return handleApiError(error, "Unable to persist elicitation session.");
  }
}
