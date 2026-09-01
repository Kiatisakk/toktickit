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
  method: "GET" | "POST" | "DELETE",
  options: RequestOptions & { body?: unknown } = {}
): Promise<unknown> => {
  const headers: Record<string, string> = {};

  if (options.requesterId !== undefined) {
    headers[REQUESTER_HEADER] = String(options.requesterId);
  }

  // FormData sets its own Content-Type, and it has to: the boundary is chosen
  // when the body is built, and a hand-written header would name a boundary the
  // body does not use.
  const multipart = options.body instanceof FormData;

  if (options.body !== undefined && !multipart) {
    headers["Content-Type"] = "application/json";
  }

  let response: Response;

  try {
    const init: RequestInit = { method, headers };

    if (options.signal) {
      init.signal = options.signal;
    }

    if (options.body !== undefined) {
      init.body = multipart
        ? (options.body as FormData)
        : JSON.stringify(options.body);
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

/**
 * The same request, answered as bytes rather than as JSON.
 *
 * Downloads need the blob and the filename the server chose, and neither
 * survives `response.json()`. Kept beside `send` so the requester header and
 * the failure handling stay in one place — a second fetch wrapper is how one of
 * them ends up not sending the header.
 */
const sendForBlob = async (
  path: string,
  options: RequestOptions = {}
): Promise<Blob> => {
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
    if (error instanceof DOMException && error.name === "AbortError") {
      throw error;
    }

    throw new ApiError("NETWORK_UNREACHABLE", UNREACHABLE, 0);
  }

  if (!response.ok) {
    throw await toApiError(response);
  }

  return await response.blob();
};

export const apiGet = (path: string, options: RequestOptions = {}) =>
  send(path, "GET", options);

export const apiPost = (
  path: string,
  body: unknown,
  options: RequestOptions = {}
) => send(path, "POST", { ...options, body });

export const apiDelete = (
  path: string,
  body: unknown,
  options: RequestOptions = {}
) => send(path, "DELETE", { ...options, body });

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

export interface TicketListMeta {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

/**
 * One row of the ticket list, as the API sends it.
 *
 * Defined here rather than beside the table component, because this is where it
 * is checked. A type that lives next to its renderer and is validated somewhere
 * else is two descriptions of the same shape, and they drift.
 */
export interface TicketListRow {
  id: number;
  ticketNumber: string;
  summary: string;
  requestedPriority: string;
  itPriority: string | null;
  currentStatus: string;
  createdAt: string;
  updatedAt: string;
  category: ReferenceItem;
  relatedSystem: ReferenceItem;
  ticketOwner: ReferenceItem | null;
}

export interface TicketListResponse {
  data: TicketListRow[];
  meta: TicketListMeta;
}

const isMeta = (value: unknown): value is TicketListMeta =>
  isRecord(value) &&
  typeof value["page"] === "number" &&
  typeof value["pageSize"] === "number" &&
  typeof value["totalItems"] === "number" &&
  typeof value["totalPages"] === "number";

/** Null is a value here, not a missing field: Lab 2 never triages a ticket. */
const isNullableReference = (value: unknown): boolean =>
  value === null || isReferenceItem(value);

const isTicketRow = (value: unknown): value is TicketListRow =>
  isRecord(value) &&
  typeof value["id"] === "number" &&
  typeof value["ticketNumber"] === "string" &&
  typeof value["summary"] === "string" &&
  typeof value["requestedPriority"] === "string" &&
  // Checked because they are rendered. `itPriority` and `ticketOwner` were
  // omitted from this guard while every row was cast to a caller-chosen `T`,
  // so a malformed payload reached the badge wearing a type it did not have.
  (value["itPriority"] === null || typeof value["itPriority"] === "string") &&
  typeof value["currentStatus"] === "string" &&
  typeof value["createdAt"] === "string" &&
  typeof value["updatedAt"] === "string" &&
  isReferenceItem(value["category"]) &&
  isReferenceItem(value["relatedSystem"]) &&
  isNullableReference(value["ticketOwner"]);

/**
 * Fetches one page of the current requester's tickets.
 *
 * `query` is passed through as-is rather than being filtered here: the server
 * rejects anything it does not recognise (BR-34), and silently dropping a
 * parameter on the way out would hide that from whoever built the URL.
 */
export const fetchTickets = async (
  query: URLSearchParams,
  requesterId: number,
  signal?: AbortSignal
): Promise<TicketListResponse> => {
  const suffix = query.toString();
  const body = await apiGet(`/api/tickets${suffix ? `?${suffix}` : ""}`, {
    requesterId,
    ...(signal ? { signal } : {}),
  });

  if (
    !isRecord(body) ||
    !Array.isArray(body["data"]) ||
    !body["data"].every(isTicketRow) ||
    !isMeta(body["meta"])
  ) {
    throw new ApiError(
      "UNEXPECTED_RESPONSE",
      "The TokTickIT API returned the ticket list in an unexpected format.",
      0
    );
  }

  // No cast. Every element has been through `isTicketRow`, so the type is
  // earned rather than asserted.
  return { data: body["data"], meta: body["meta"] };
};

/* ------------------------------------------------------------ attachments -- */

export interface AttachmentMetadata {
  id: number;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  uploadedAt: string;
  uploadedBy: ReferenceItem;
  status: "ACTIVE" | "REMOVED";
  removedAt: string | null;
  removedReason: string | null;
  removedBy: ReferenceItem | null;
}

export interface TicketDetail extends TicketListRow {
  description: string;
  resolutionSummary: string | null;
  requester: ReferenceItem;
  attachments: AttachmentMetadata[];
}

const isAttachment = (value: unknown): value is AttachmentMetadata =>
  isRecord(value) &&
  typeof value["id"] === "number" &&
  typeof value["originalFilename"] === "string" &&
  typeof value["mimeType"] === "string" &&
  typeof value["sizeBytes"] === "number" &&
  typeof value["uploadedAt"] === "string" &&
  isReferenceItem(value["uploadedBy"]) &&
  (value["status"] === "ACTIVE" || value["status"] === "REMOVED") &&
  (value["removedAt"] === null || typeof value["removedAt"] === "string") &&
  (value["removedReason"] === null ||
    typeof value["removedReason"] === "string") &&
  (value["removedBy"] === null || isReferenceItem(value["removedBy"]));

const isTicketDetail = (value: unknown): value is TicketDetail =>
  isTicketRow(value) &&
  isRecord(value) &&
  typeof value["description"] === "string" &&
  (value["resolutionSummary"] === null ||
    typeof value["resolutionSummary"] === "string") &&
  isReferenceItem(value["requester"]) &&
  Array.isArray(value["attachments"]) &&
  value["attachments"].every(isAttachment);

const unexpected = (what: string) =>
  new ApiError(
    "UNEXPECTED_RESPONSE",
    `The TokTickIT API returned ${what} in an unexpected format.`,
    0
  );

/** One owned ticket. A ticket owned by anyone else fails as a missing one. */
export const fetchTicket = async (
  ticketId: number,
  requesterId: number,
  signal?: AbortSignal
): Promise<TicketDetail> => {
  const body = await apiGet(`/api/tickets/${ticketId}`, {
    requesterId,
    ...(signal ? { signal } : {}),
  });

  if (!isTicketDetail(body)) {
    throw unexpected("the ticket");
  }

  return body;
};

export const uploadAttachment = async (
  ticketId: number,
  file: File,
  requesterId: number
): Promise<AttachmentMetadata> => {
  const form = new FormData();
  form.append("file", file);

  const body = await send(`/api/tickets/${ticketId}/attachments`, "POST", {
    requesterId,
    body: form,
  });

  if (!isAttachment(body)) {
    throw unexpected("the attachment");
  }

  return body;
};

export const removeAttachment = async (
  attachmentId: number,
  reason: string,
  requesterId: number
): Promise<AttachmentMetadata> => {
  const body = await apiDelete(
    `/api/attachments/${attachmentId}`,
    { reason },
    { requesterId }
  );

  if (!isAttachment(body)) {
    throw unexpected("the attachment");
  }

  return body;
};

/**
 * Fetches the bytes rather than pointing the browser at the URL.
 *
 * A plain link would send the request without the requester header, and the
 * server would refuse it — the header is the whole identity mechanism in Lab 2.
 * So the file is fetched, turned into an object URL, saved, and the URL
 * revoked; leaving it alive holds the whole file in memory for the life of the
 * page.
 */
export const downloadAttachment = async (
  attachment: AttachmentMetadata,
  requesterId: number
): Promise<void> => {
  const blob = await sendForBlob(`/api/attachments/${attachment.id}/download`, {
    requesterId,
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = attachment.originalFilename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};
