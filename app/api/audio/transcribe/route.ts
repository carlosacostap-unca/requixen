import { NextResponse } from "next/server";
import { apiErrorResponse, badRequest, handleApiError, unauthorized } from "@/lib/requixen/server/api-errors";
import { bearerToken, getAuthenticatedPocketBaseUser } from "@/lib/requixen/server/pocketbase";
import { transcribeAudio } from "@/lib/requixen/server/openai";

export async function POST(request: Request) {
  try {
    const token = bearerToken(request);

    if (!token) {
      return apiErrorResponse(unauthorized());
    }

    await getAuthenticatedPocketBaseUser(token);

    const formData = await request.formData();
    const audio = formData.get("audio");
    const language = typeof formData.get("language") === "string" ? String(formData.get("language")) : "es";

    if (!(audio instanceof File)) {
      return apiErrorResponse(badRequest("audio file is required."));
    }

    const text = await transcribeAudio(audio, language);

    return NextResponse.json({ text });
  } catch (error) {
    return handleApiError(error, "Unable to transcribe audio.");
  }
}
