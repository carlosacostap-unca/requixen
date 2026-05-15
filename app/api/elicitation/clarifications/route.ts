import { NextResponse } from "next/server";
import { apiErrorResponse, badRequest, handleApiError, unauthorized } from "@/lib/requixen/server/api-errors";
import { answerClarification, closeClarification, createClarification } from "@/lib/requixen/server/elicitation-runtime";
import { bearerToken } from "@/lib/requixen/server/pocketbase";
import type { ClarificationRequest } from "@/lib/requixen/types";

export async function POST(request: Request) {
  try {
    const token = bearerToken(request);

    if (!token) {
      return apiErrorResponse(unauthorized());
    }

    const body = (await request.json()) as {
      projectId?: string;
      sessionId?: string;
      clarification?: ClarificationRequest;
    };

    if (!body.projectId || !body.sessionId || !body.clarification) {
      return apiErrorResponse(badRequest("projectId, sessionId and clarification are required."));
    }

    const clarification = await createClarification({
      projectId: body.projectId,
      sessionId: body.sessionId,
      clarification: body.clarification,
      token,
    });
    return NextResponse.json({ clarification });
  } catch (error) {
    return handleApiError(error, "Unable to persist clarification.");
  }
}

export async function PATCH(request: Request) {
  try {
    const token = bearerToken(request);

    if (!token) {
      return apiErrorResponse(unauthorized());
    }

    const body = (await request.json()) as {
      projectId?: string;
      clarificationId?: string;
      response?: string;
      status?: ClarificationRequest["status"];
      respondedBy?: string;
      respondedByName?: string;
      respondedAt?: string;
    };

    if (!body.projectId || !body.clarificationId) {
      return apiErrorResponse(badRequest("projectId and clarificationId are required."));
    }

    if (body.status === "closed") {
      const clarification = await closeClarification({
        projectId: body.projectId,
        clarificationId: body.clarificationId,
        token,
      });
      return NextResponse.json({ clarification });
    }

    if (!body.response) {
      return apiErrorResponse(badRequest("response is required unless status is closed."));
    }

    const clarification = await answerClarification({
      projectId: body.projectId,
      clarificationId: body.clarificationId,
      response: body.response,
      respondedBy: body.respondedBy ?? "",
      respondedByName: body.respondedByName ?? "",
      respondedAt: body.respondedAt ?? new Date().toISOString(),
      token,
    });
    return NextResponse.json({ clarification });
  } catch (error) {
    return handleApiError(error, "Unable to answer clarification.");
  }
}
