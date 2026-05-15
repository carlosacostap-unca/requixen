import { NextResponse } from "next/server";

export type ApiErrorCode =
  | "BAD_REQUEST"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "UPSTREAM_ERROR"
  | "INTERNAL_ERROR";

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: ApiErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function badRequest(message: string) {
  return new ApiError(400, "BAD_REQUEST", message);
}

export function unauthorized(message = "Authorization bearer token is required.") {
  return new ApiError(401, "UNAUTHORIZED", message);
}

export function forbidden(message = "You do not have permission to perform this action.") {
  return new ApiError(403, "FORBIDDEN", message);
}

export function upstreamError(message = "A configured provider failed to complete the request.") {
  return new ApiError(500, "UPSTREAM_ERROR", message);
}

export function apiErrorResponse(error: ApiError) {
  return NextResponse.json(
    {
      error: error.message,
      errorCode: error.code,
      errorDetails: {
        code: error.code,
        message: error.message,
      },
    },
    { status: error.status },
  );
}

export function handleApiError(error: unknown, fallbackMessage: string) {
  if (error instanceof ApiError) {
    return apiErrorResponse(error);
  }

  return apiErrorResponse(new ApiError(500, "INTERNAL_ERROR", fallbackMessage));
}
