import { NextResponse } from "next/server";
import { apiErrorResponse, handleApiError, unauthorized } from "@/lib/requixen/server/api-errors";
import { bearerToken, deletePocketBaseUser, updatePocketBaseUser } from "@/lib/requixen/server/pocketbase";

export async function PATCH(request: Request, { params }: { params: Promise<{ userId: string }> }) {
  try {
    const token = bearerToken(request);

    if (!token) {
      return apiErrorResponse(unauthorized());
    }

    const { userId } = await params;
    const body = (await request.json()) as {
      name?: string;
      email?: string;
      areaId?: string;
      isAdmin?: boolean;
    };
    const user = await updatePocketBaseUser(userId, body, token);
    return NextResponse.json({ user });
  } catch (error) {
    return handleApiError(error, "Unable to update user.");
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ userId: string }> }) {
  try {
    const token = bearerToken(request);

    if (!token) {
      return apiErrorResponse(unauthorized());
    }

    const { userId } = await params;
    const result = await deletePocketBaseUser(userId, token);
    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error, "Unable to delete user.");
  }
}
