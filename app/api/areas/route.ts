import { NextResponse } from "next/server";
import { apiErrorResponse, badRequest, handleApiError, unauthorized } from "@/lib/requixen/server/api-errors";
import { bearerToken, createPocketBaseArea, listPocketBaseAreas } from "@/lib/requixen/server/pocketbase";

export async function GET(request: Request) {
  try {
    const token = bearerToken(request);

    if (!token) {
      return apiErrorResponse(unauthorized());
    }

    const areas = await listPocketBaseAreas(token);
    return NextResponse.json({ areas });
  } catch (error) {
    return handleApiError(error, "Unable to list areas.");
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
      code?: string;
      description?: string;
      parentAreaId?: string;
    };

    if (!body.name) {
      return apiErrorResponse(badRequest("name is required."));
    }

    const area = await createPocketBaseArea(
      {
        name: body.name,
        code: body.code,
        description: body.description,
        parentAreaId: body.parentAreaId,
      },
      token,
    );
    return NextResponse.json({ area });
  } catch (error) {
    return handleApiError(error, "Unable to create area.");
  }
}
