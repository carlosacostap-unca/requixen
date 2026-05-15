import { NextResponse } from "next/server";
import { defaultInstitutionalInterviewTemplates } from "@/lib/requixen/institutional-templates";
import { ApiError, badRequest, handleApiError } from "@/lib/requixen/server/api-errors";
import {
  bearerToken,
  duplicatePocketBaseInstitutionalTemplate,
  listPocketBaseInstitutionalTemplates,
  updatePocketBaseInstitutionalTemplate,
} from "@/lib/requixen/server/pocketbase";

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

export async function POST(request: Request) {
  const token = bearerToken(request);

  if (!token) {
    return handleApiError(new ApiError(401, "UNAUTHORIZED", "Authorization bearer token is required."), "Unable to duplicate institutional template.");
  }

  try {
    const body = (await request.json()) as { sourceTemplateId?: string };

    if (!body.sourceTemplateId) {
      throw badRequest("sourceTemplateId is required.");
    }

    const template = await duplicatePocketBaseInstitutionalTemplate(body.sourceTemplateId, token);
    return NextResponse.json({ template });
  } catch (error) {
    return handleApiError(error, "Unable to duplicate institutional template.");
  }
}

export async function PATCH(request: Request) {
  const token = bearerToken(request);

  if (!token) {
    return handleApiError(new ApiError(401, "UNAUTHORIZED", "Authorization bearer token is required."), "Unable to update institutional template.");
  }

  try {
    const body = (await request.json()) as { templateId?: string; active?: boolean };

    if (!body.templateId) {
      throw badRequest("templateId is required.");
    }

    const template = await updatePocketBaseInstitutionalTemplate(
      body.templateId,
      { active: body.active },
      token,
    );
    return NextResponse.json({ template });
  } catch (error) {
    return handleApiError(error, "Unable to update institutional template.");
  }
}
