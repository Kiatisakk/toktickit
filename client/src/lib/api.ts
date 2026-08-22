const API_BASE_URL =
  import.meta.env["VITE_API_BASE_URL"] ?? "http://localhost:3000";

/** The header that names the current Development Requester. See BR-03. */
export const REQUESTER_HEADER = "X-Development-Requester-Id";

/**
 * A failure the API reported in its documented envelope, or a failure to reach
 * it at all.
 *
 * `code` is what behaviour branches on; `message` is what a person reads.
 * `details` carries field-level messages so a form can place each beside the
 * control it concerns.
 */
export class ApiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details: Record<string, string> | undefined;

  constructor(
    code: string,
    message: string,
    status: number,
    details?: Record<string, string>
  ) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

const UNREACHABLE = "Unable to connect to the TokTickIT API.";

interface RequestOptions {
  /** Present on every requester-scoped call; omitted on reference data. */
  requesterId?: number;
  signal?: AbortSignal;
}

export const apiGet = async <T>(
  path: string,
  options: RequestOptions = {}
): Promise<T> => {
  const headers: Record<string, string> = {};

  if (options.requesterId !== undefined) {
    headers[REQUESTER_HEADER] = String(options.requesterId);
  }

  let response: Response;

  try {
    const init: RequestInit = { headers };

    if (options.signal) {
      init.signal = options.signal;
    }

    response = await fetch(`${API_BASE_URL}${path}`, init);
  } catch (error) {
    // fetch rejects only when the request never reached a server. A 500 is a
    // response, and is handled below.
    if (error instanceof DOMException && error.name === "AbortError") {
      throw error;
    }

    throw new ApiError("NETWORK_UNREACHABLE", UNREACHABLE, 0);
  }

  if (!response.ok) {
    throw await toApiError(response);
  }

  return (await response.json()) as T;
};

/**
 * Turns a failed response into an ApiError.
 *
 * A body that is not the documented envelope still has to produce something
 * showable — a proxy returning HTML, for instance. Falling back keeps the
 * screen honest rather than crashing on `body.error.code`.
 */
const toApiError = async (response: Response): Promise<ApiError> => {
  try {
    const body = (await response.json()) as {
      error?: {
        code?: string;
        message?: string;
        details?: Record<string, string>;
      };
    };

    if (body.error?.code && body.error.message) {
      return new ApiError(
        body.error.code,
        body.error.message,
        response.status,
        body.error.details
      );
    }
  } catch {
    // Body was not JSON. Handled by the fallback below.
  }

  return new ApiError(
    "UNEXPECTED_RESPONSE",
    "The TokTickIT API returned an unexpected response.",
    response.status
  );
};

export interface Requester {
  id: number;
  name: string;
  email: string;
}

export interface ReferenceItem {
  id: number;
  name: string;
}

export const fetchRequesters = (signal?: AbortSignal) =>
  apiGet<Requester[]>("/api/requesters", signal ? { signal } : {});

export const fetchCategories = (signal?: AbortSignal) =>
  apiGet<ReferenceItem[]>("/api/categories", signal ? { signal } : {});

export const fetchRelatedSystems = (signal?: AbortSignal) =>
  apiGet<ReferenceItem[]>("/api/related-systems", signal ? { signal } : {});
