export type ApiClientErrorPayload = {
  status: number;
  code: string;
  message: string;
};

export class ApiClientError extends Error {
  constructor(public payload: ApiClientErrorPayload) {
    super(payload.message);
    this.name = "ApiClientError";
  }
}

type JsonRequestOptions = {
  method?: string;
  token?: string | null;
  body?: unknown;
  headers?: HeadersInit;
};

type FormRequestOptions = {
  method?: string;
  token?: string | null;
  formData: FormData;
  headers?: HeadersInit;
};

export async function apiJson<T>(url: string, options: JsonRequestOptions = {}) {
  const headers = new Headers(options.headers);

  if (options.body !== undefined) {
    headers.set("Content-Type", "application/json");
  }

  if (options.token) {
    headers.set("Authorization", `Bearer ${options.token}`);
  }

  const response = await fetch(url, {
    method: options.method ?? (options.body === undefined ? "GET" : "POST"),
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });

  return parseApiResponse<T>(response);
}

export async function apiForm<T>(url: string, options: FormRequestOptions) {
  const headers = new Headers(options.headers);

  if (options.token) {
    headers.set("Authorization", `Bearer ${options.token}`);
  }

  const response = await fetch(url, {
    method: options.method ?? "POST",
    headers,
    body: options.formData,
  });

  return parseApiResponse<T>(response);
}

async function parseApiResponse<T>(response: Response) {
  const data = (await response.json().catch(() => undefined)) as unknown;

  if (response.ok) {
    return data as T;
  }

  throw new ApiClientError(normalizeApiError(response.status, data));
}

function normalizeApiError(status: number, data: unknown): ApiClientErrorPayload {
  if (data && typeof data === "object") {
    const record = data as Record<string, unknown>;
    const errorDetails = record.errorDetails;

    if (errorDetails && typeof errorDetails === "object") {
      const details = errorDetails as Record<string, unknown>;
      return {
        status,
        code: String(details.code || record.errorCode || "API_ERROR"),
        message: String(details.message || record.error || "Request failed."),
      };
    }

    return {
      status,
      code: String(record.errorCode || "API_ERROR"),
      message: String(record.error || "Request failed."),
    };
  }

  return {
    status,
    code: "API_ERROR",
    message: "Request failed.",
  };
}
