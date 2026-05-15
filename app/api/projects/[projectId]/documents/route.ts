import { NextResponse } from "next/server";
import { apiErrorResponse, badRequest, handleApiError, unauthorized } from "@/lib/requixen/server/api-errors";
import { deleteDocumentKnowledge } from "@/lib/requixen/server/qdrant";
import {
  deletePocketBaseFileRecord,
  bearerToken,
  updatePocketBaseProjectDocuments,
} from "@/lib/requixen/server/pocketbase";
import type { AttachedDocument } from "@/lib/requixen/types";

export async function PATCH(request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  try {
    const token = bearerToken(request);

    if (!token) {
      return apiErrorResponse(unauthorized());
    }

    const { projectId } = await params;
    const body = (await request.json()) as { documents?: AttachedDocument[] };

    if (!Array.isArray(body.documents)) {
      return apiErrorResponse(badRequest("documents array is required."));
    }

    const project = await updatePocketBaseProjectDocuments(projectId, body.documents, token);
    return NextResponse.json({ project });
  } catch (error) {
    return handleApiError(error, "Unable to update project documents.");
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  try {
    const token = bearerToken(request);

    if (!token) {
      return apiErrorResponse(unauthorized());
    }

    const { projectId } = await params;
    const body = (await request.json()) as {
      documents?: AttachedDocument[];
      document?: AttachedDocument;
    };

    if (!Array.isArray(body.documents) || !body.document) {
      return apiErrorResponse(badRequest("documents and document are required."));
    }

    const project = await updatePocketBaseProjectDocuments(projectId, body.documents, token);

    await deletePocketBaseFileRecord(body.document.storageRecordId ?? "", token).catch(() => undefined);
    await deleteDocumentKnowledge({
      projectId,
      storageRecordId: body.document.storageRecordId,
      documentId: body.document.id,
    }).catch(() => undefined);

    return NextResponse.json({ project });
  } catch (error) {
    return handleApiError(error, "Unable to delete project document.");
  }
}
