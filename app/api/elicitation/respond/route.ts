import { NextResponse } from "next/server";
import { apiErrorResponse, badRequest, handleApiError, unauthorized } from "@/lib/requixen/server/api-errors";
import { generateMediatorReply } from "@/lib/requixen/server/openai";
import { bearerToken, requireProjectAccess } from "@/lib/requixen/server/pocketbase";
import { formatKnowledgeContext, searchProjectKnowledge } from "@/lib/requixen/server/qdrant";
import type { ElicitationChatMessage, Project, User } from "@/lib/requixen/types";

export async function POST(request: Request) {
  try {
    const token = bearerToken(request);

    if (!token) {
      return apiErrorResponse(unauthorized());
    }

    const body = (await request.json()) as {
      project?: Project;
      user?: User;
      message?: string;
      recentMessages?: ElicitationChatMessage[];
      roomContext?: string;
      mode?: "elicitation" | "project-context" | "analyst-processing";
    };

    if (!body.project?.id || !body.message) {
      return apiErrorResponse(badRequest("project.id and message are required."));
    }

    const { project, user } = await requireProjectAccess(body.project.id, token);
    const activeRole = body.user?.role && user.roles.includes(body.user.role) ? body.user.role : user.role;
    const activeUser = { ...user, role: activeRole };
    const retrievedContext = await searchProjectKnowledge({
      projectId: project.id,
      query: body.message,
      limit: 5,
    })
      .then(formatKnowledgeContext)
      .catch(() => "");

    const reply = await generateMediatorReply({
      project,
      user: activeUser,
      message: body.message,
      recentMessages: body.recentMessages ?? [],
      roomContext: body.roomContext,
      retrievedContext,
      mode: body.mode,
    });

    return NextResponse.json({ reply, retrievedContextAvailable: Boolean(retrievedContext) });
  } catch (error) {
    return handleApiError(error, "Unable to generate mediator reply.");
  }
}
