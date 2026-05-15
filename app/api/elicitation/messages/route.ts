import { NextResponse } from "next/server";
import { apiErrorResponse, badRequest, handleApiError, unauthorized } from "@/lib/requixen/server/api-errors";
import { createElicitationMessage } from "@/lib/requixen/server/elicitation-runtime";
import { serverEnv } from "@/lib/requixen/server/env";
import { bearerToken, pocketBaseRequest, requireProjectAccess } from "@/lib/requixen/server/pocketbase";
import type { ElicitationChatMessage } from "@/lib/requixen/types";

type ElicitationMessagePayload = {
  projectId?: string;
  sessionId?: string;
  authorName?: string;
  authorRole?: string;
  body?: string;
  kind?: string;
  timestamp?: string;
};

type PocketBaseElicitationMessageRecord = {
  id: string;
  projectId?: string;
  sessionId?: string;
  authorName?: string;
  authorRole?: string;
  body?: string;
  kind?: string;
  timestamp_?: string;
  created?: string;
  updated?: string;
};

type PocketBaseListResponse<T> = {
  items: T[];
};

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

    await requireProjectAccess(projectId, token);

    const env = serverEnv();
    const filter = encodeURIComponent(`projectId="${projectId}"`);
    const result = await pocketBaseRequest<PocketBaseListResponse<PocketBaseElicitationMessageRecord>>(
      `/api/collections/${env.pocketBaseElicitationMessagesCollection}/records?perPage=500&sort=created&filter=${filter}`,
      {},
      token,
    );

    return NextResponse.json({
      messages: result.items.map((record) => ({
        id: record.id,
        projectId: record.projectId ?? "",
        sessionId: record.sessionId ?? "",
        authorName: record.authorName ?? "",
        authorRole: record.authorRole ?? "",
        body: record.body ?? "",
        kind: record.kind ?? "",
        timestamp: record.timestamp_ || record.created || "",
        created: record.created ?? "",
        updated: record.updated ?? "",
      })),
    });
  } catch (error) {
    return handleApiError(error, "Unable to list elicitation messages.");
  }
}

export async function POST(request: Request) {
  try {
    const token = bearerToken(request);

    if (!token) {
      return apiErrorResponse(unauthorized());
    }

    const body = (await request.json()) as ElicitationMessagePayload;

    if (!body.projectId || !body.sessionId || !body.authorName || !body.authorRole || !body.body) {
      return apiErrorResponse(badRequest("projectId, sessionId, authorName, authorRole and body are required."));
    }

    const record = await createElicitationMessage({
      projectId: body.projectId,
      sessionId: body.sessionId,
      message: {
        id: "",
        authorName: body.authorName,
        authorRole: body.authorRole as ElicitationChatMessage["authorRole"],
        body: body.body,
        timestamp: body.timestamp ?? new Date().toISOString(),
      },
      kind: body.kind ?? "",
      token,
    });

    return NextResponse.json({ record });
  } catch (error) {
    return handleApiError(error, "Unable to persist elicitation message.");
  }
}
