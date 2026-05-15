import { NextResponse } from "next/server";
import { apiErrorResponse, badRequest, handleApiError, unauthorized } from "@/lib/requixen/server/api-errors";
import { bearerToken } from "@/lib/requixen/server/pocketbase";
import { loadWorkspaceRuntime, replaceWorkspaceLayerRuntime } from "@/lib/requixen/server/workspace-runtime";
import type { Artifact, AuditEntry, LayerId, RiskFlag, TraceLink } from "@/lib/requixen/types";

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

    const runtime = await loadWorkspaceRuntime(projectId, token);
    return NextResponse.json(runtime);
  } catch (error) {
    return handleApiError(error, "Unable to load workspace runtime.");
  }
}

export async function POST(request: Request) {
  try {
    const token = bearerToken(request);

    if (!token) {
      return apiErrorResponse(unauthorized());
    }

    const body = (await request.json()) as {
      projectId?: string;
      layerId?: LayerId;
      artifacts?: Artifact[];
      risks?: RiskFlag[];
      traces?: TraceLink[];
      audit?: AuditEntry[];
    };

    if (!body.projectId || !body.layerId) {
      return apiErrorResponse(badRequest("projectId and layerId are required."));
    }

    const runtime = await replaceWorkspaceLayerRuntime({
      projectId: body.projectId,
      layerId: body.layerId,
      artifacts: body.artifacts ?? [],
      risks: body.risks ?? [],
      traces: body.traces ?? [],
      audit: body.audit ?? [],
      token,
    });
    return NextResponse.json(runtime);
  } catch (error) {
    return handleApiError(error, "Unable to persist workspace runtime.");
  }
}
