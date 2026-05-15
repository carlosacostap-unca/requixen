import { NextResponse } from "next/server";
import { apiErrorResponse, handleApiError, unauthorized } from "@/lib/requixen/server/api-errors";
import { bearerToken, listPocketBaseUserDirectory, requireAnyRole } from "@/lib/requixen/server/pocketbase";

export async function GET(request: Request) {
  try {
    const token = bearerToken(request);

    if (!token) {
      return apiErrorResponse(unauthorized());
    }

    await requireAnyRole(token, ["admin"]);

    const users = await listPocketBaseUserDirectory();
    return NextResponse.json({
      users: users.map((user) => ({
        id: user.id,
        name: user.name,
        email: user.email,
        areaName: user.areaName,
        isAdmin: user.isAdmin,
      })),
    });
  } catch (error) {
    return handleApiError(error, "Unable to load user directory.");
  }
}
