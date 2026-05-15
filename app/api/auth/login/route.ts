import { NextResponse } from "next/server";
import { ApiError, apiErrorResponse, badRequest, handleApiError, unauthorized } from "@/lib/requixen/server/api-errors";
import { authenticatePocketBaseUser } from "@/lib/requixen/server/pocketbase";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { identity?: string; password?: string };

    if (!body.identity || !body.password) {
      return apiErrorResponse(badRequest("identity and password are required."));
    }

    const session = await authenticatePocketBaseUser(body.identity, body.password);
    return NextResponse.json(session);
  } catch (error) {
    if (error instanceof ApiError && error.code === "UPSTREAM_ERROR") {
      return handleApiError(error, "Authentication failed.");
    }

    return apiErrorResponse(unauthorized("Authentication failed."));
  }
}
