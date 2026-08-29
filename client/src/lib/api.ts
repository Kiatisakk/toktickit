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

/**
 * Issues the request and returns the parsed body as `unknown`.
 *
 * Deliberately not generic. A response body is untrusted input, and casting it
 * to a caller-chosen `T` would let a malformed payload travel to every consumer
 * wearing a type it does not have. Narrowing is each caller's job, immediately
 * below.
 */
const send = async (
  path: string,
  method: "GET" | "POST",
  options: RequestOptions & { body?: unknown } = {}
): Promise<unknown> => {
  const headers: Record<string, string> = {};

  if (options.requesterId !== undefined) {
    headers[REQUESTER_HEADER] = String(options.requesterId);
  }

  if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  let response: Response;

  try {
    const init: RequestInit = { method, headers };

    if (options.signal) {
      init.signal = options.signal;
    }

    if (options.body !== undefined) {
      init.body = JSON.stringify(options.body);
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

  return await response.json();
};

export const apiGet = (path: string, options: RequestOptions = {}) =>
  send(path, "GET", options);

export const apiPost = (
  path: string,
  body: unknown,
  options: RequestOptions = {}
) => send(path, "POST", { ...options, body });

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

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isReferenceItem = (value: unknown): value is ReferenceItem =>
  isRecord(value) &&
  typeof value["id"] === "number" &&
  typeof value["name"] === "string";

const isRequester = (value: unknown): value is Requester =>
  isRecord(value) &&
  typeof value["id"] === "number" &&
  typeof value["name"] === "string" &&
  typeof value["email"] === "string";

/**
 * Rejects a body that is not the documented shape.
 *
 * A screen showing "Unable to load" is a worse outcome than one silently
 * rendering `undefined` only if the payload really was fine. It never is when
 * this fires: a proxy returned HTML, a deploy is half-finished, or the contract
 * changed under us. Failing here means the failure is reported once, at the
 * boundary, rather than as a render crash three components deep.
 */
const expectArrayOf = <T>(
  value: unknown,
  guard: (item: unknown) => item is T,
  what: string
): T[] => {
  if (!Array.isArray(value) || !value.every(guard)) {
    throw new ApiError(
      "UNEXPECTED_RESPONSE",
      `The TokTickIT API returned ${what} in an unexpected format.`,
      0
    );
  }

  return value;
};

export const fetchRequesters = async (signal?: AbortSignal) =>
  expectArrayOf(
    await apiGet("/api/requesters", signal ? { signal } : {}),
    isRequester,
    "the Development Requesters"
  );

export const fetchCategories = async (signal?: AbortSignal) =>
  expectArrayOf(
    await apiGet("/api/categories", signal ? { signal } : {}),
    isReferenceItem,
    "the categories"
  );

export const fetchRelatedSystems = async (signal?: AbortSignal) =>
  expectArrayOf(
    await apiGet("/api/related-systems", signal ? { signal } : {}),
    isReferenceItem,
    "the related systems"
  );

export interface CreatedTicket {
  id: number;
  ticketNumber: string;
  summary: string;
  currentStatus: string;
  createdAt: string;
}

/**
 * Checks every field `CreatedTicket` declares, not the convenient ones.
 *
 * A guard that validates three of five fields and then asserts the type is
 * worse than no guard: it makes the remaining two look checked. `createdAt` and
 * `currentStatus` reach a render as `undefined` and fail there instead, several
 * components from the response that caused it.
 */
const isCreatedTicket = (value: unknown): value is CreatedTicket =>
  isRecord(value) &&
  typeof value["id"] === "number" &&
  typeof value["ticketNumber"] === "string" &&
  typeof value["summary"] === "string" &&
  typeof value["currentStatus"] === "string" &&
  typeof value["createdAt"] === "string";

export interface NewTicket {
  categoryId: number;
  relatedSystemId: number;
  summary: string;
  description: string;
  requestedPriority: string;
}

/**
 * Creates one ticket for the current Development Requester.
 *
 * The requester is not part of the payload. Ownership comes from the header the
 * server validates, and sending it in the body as well would suggest a client
 * could choose (BR-11).
 */
export const createTicket = async (
  ticket: NewTicket,
  requesterId: number
): Promise<CreatedTicket> => {
  const created = await apiPost("/api/tickets", ticket, { requesterId });

  if (!isCreatedTicket(created)) {
    throw new ApiError(
      "UNEXPECTED_RESPONSE",
      "The ticket was submitted, but the response could not be read.",
      0
    );
  }

  return created;
};
