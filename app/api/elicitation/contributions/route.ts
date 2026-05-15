import { NextResponse } from "next/server";
import { apiErrorResponse, badRequest, handleApiError, unauthorized } from "@/lib/requixen/server/api-errors";
import { createElicitationContribution } from "@/lib/requixen/server/elicitation-runtime";
import { bearerToken } from "@/lib/requixen/server/pocketbase";
import type { ElicitationContribution } from "@/lib/requixen/types";

export async function POST(request: Request) {
  try {
    const token = bearerToken(request);

    if (!token) {
      return apiErrorResponse(unauthorized());
    }

    const body = (await request.json()) as {
      projectId?: string;
      sessionId?: string;
      contribution?: ElicitationContribution;
      sourceMessageId?: string;
      confidence?: number;
    };

    if (!body.projectId || !body.sessionId || !body.contribution) {
      return apiErrorResponse(badRequest("projectId, sessionId and contribution are required."));
    }

    const contribution = await createElicitationContribution({
      projectId: body.projectId,
      sessionId: body.sessionId,
      contribution: body.contribution,
      sourceMessageId: body.sourceMessageId,
      confidence: body.confidence,
      token,
    });
    return NextResponse.json({ contribution });
  } catch (error) {
    return handleApiError(error, "Unable to persist elicitation contribution.");
  }
}
