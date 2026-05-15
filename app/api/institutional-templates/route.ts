import { NextResponse } from "next/server";
import { defaultInstitutionalInterviewTemplates } from "@/lib/requixen/institutional-templates";
import { ApiError, handleApiError } from "@/lib/requixen/server/api-errors";
import { bearerToken, listPocketBaseInstitutionalTemplates } from "@/lib/requixen/server/pocketbase";

export async function GET(request: Request) {
  const token = bearerToken(request);

  if (!token) {
    return NextResponse.json({ templates: defaultInstitutionalInterviewTemplates, source: "fallback" });
  }

  try {
    const templates = await listPocketBaseInstitutionalTemplates(token);
    return NextResponse.json({
      templates: templates.length > 0 ? templates : defaultInstitutionalInterviewTemplates,
      source: templates.length > 0 ? "pocketbase" : "fallback",
    });
  } catch (error) {
    if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
      return handleApiError(error, "Unable to list institutional templates.");
    }

    if (process.env.NODE_ENV === "test") {
      return handleApiError(error, "Unable to list institutional templates.");
    }

    return NextResponse.json({ templates: defaultInstitutionalInterviewTemplates, source: "fallback" });
  }
}
