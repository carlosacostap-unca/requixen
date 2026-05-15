import { NextResponse } from "next/server";
import { apiErrorResponse, badRequest, handleApiError, unauthorized } from "@/lib/requixen/server/api-errors";
import { bearerToken, createPocketBaseUser, listPocketBaseUsers } from "@/lib/requixen/server/pocketbase";

export async function GET(request: Request) {
  try {
    const token = bearerToken(request);

    if (!token) {
      return apiErrorResponse(unauthorized());
    }

    const users = await listPocketBaseUsers(token);
    return NextResponse.json({ users });
  } catch (error) {
    return handleApiError(error, "Unable to list users.");
  }
}

export async function POST(request: Request) {
  try {
    const token = bearerToken(request);

    if (!token) {
      return apiErrorResponse(unauthorized());
    }

    const body = (await request.json()) as {
      name?: string;
      email?: string;
      password?: string;
      isAdmin?: boolean;
      areaId?: string;
    };

    if (!body.name || !body.email || !body.password) {
      return apiErrorResponse(badRequest("name, email and password are required."));
    }

    const user = await createPocketBaseUser(
      {
        name: body.name,
        email: body.email,
        password: body.password,
        isAdmin: Boolean(body.isAdmin),
        areaId: body.areaId,
      },
      token,
    );
    return NextResponse.json({ user });
  } catch (error) {
    return handleApiError(error, "Unable to create user.");
  }
}
