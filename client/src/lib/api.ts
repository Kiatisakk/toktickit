const API_BASE_URL =
  import.meta.env["VITE_API_BASE_URL"] ?? "http://localhost:3000";

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

/**
 * No identity option, deliberately. Who a request is from is the session
 * cookie and nothing else (api-spec.md §1, BR-41): a client that could name a
 * user per request is the mechanism Lab 3 deleted.
 */
interface RequestOptions {
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
  method: "GET" | "POST" | "PATCH" | "DELETE",
  options: RequestOptions & { body?: unknown } = {}
): Promise<unknown> => {
  const headers: Record<string, string> = {};

  // FormData sets its own Content-Type, and it has to: the boundary is chosen
  // when the body is built, and a hand-written header would name a boundary the
  // body does not use.
  const multipart = options.body instanceof FormData;

  if (options.body !== undefined && !multipart) {
    headers["Content-Type"] = "application/json";
  }

  let response: Response;

  try {
    // The session cookie only travels if both sides opt in: this, and
    // `credentials: true` in the API's CORS configuration. The client and the
    // API are different origins in development, so without it the browser
    // sends the request, gets an answer, and silently drops the cookie — which
    // presents as a broken sign-in rather than as a missing option
    // (api-spec.md §1).
    const init: RequestInit = { method, headers, credentials: "include" };

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

  // A 204 has no body, and `response.json()` on an empty body throws. Sign-out
  // and password change both answer 204, so without this they reported failure
  // to the user after the server had succeeded — the session gone, the password
  // changed, and an error on screen saying neither happened. The earlier tests
  // missed it because their fake Response returned `{}` from `json()` whatever
  // the status; the regression test uses a real `Response`.
  if (response.status === 204) {
    return null;
  }

  return await response.json();
};

/**
 * The same request, answered as bytes rather than as JSON.
 *
 * Downloads need the blob and the filename the server chose, and neither
 * survives `response.json()`. Kept beside `send` so the credentials option and
 * the failure handling stay in one place — a second fetch wrapper is how one of
 * them ends up not sending the cookie.
 */
const sendForBlob = async (
  path: string,
  options: RequestOptions = {}
): Promise<Blob> => {
  let response: Response;

  try {
    const init: RequestInit = { credentials: "include" };

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

export const apiPatch = (
  path: string,
  body: unknown,
  options: RequestOptions = {}
) => send(path, "PATCH", { ...options, body });

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
 * Creates one ticket for whoever is signed in.
 *
 * The requester is not part of the payload. Ownership comes from the session,
 * and sending an id in the body as well would suggest a client could choose
 * (BR-03, AC-03).
 */
export const createTicket = async (
  ticket: NewTicket
): Promise<CreatedTicket> => {
  const created = await apiPost("/api/tickets", ticket);

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
 * Fetches one page of the signed-in user's tickets.
 *
 * `query` is passed through as-is rather than being filtered here: the server
 * rejects anything it does not recognise (BR-34), and silently dropping a
 * parameter on the way out would hide that from whoever built the URL.
 */
export const fetchTickets = async (
  query: URLSearchParams,
  signal?: AbortSignal
): Promise<TicketListResponse> => {
  const suffix = query.toString();
  const body = await apiGet(
    `/api/tickets${suffix ? `?${suffix}` : ""}`,
    signal ? { signal } : {}
  );

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

/* ------------------------------------------------------------ the queue -- */

/** A queue row also says whose ticket it is: the queue is everyone's. */
export interface QueueRow extends TicketListRow {
  requester: ReferenceItem;
}

export interface QueueResponse {
  data: QueueRow[];
  meta: TicketListMeta;
}

const isQueueRow = (value: unknown): value is QueueRow =>
  isTicketRow(value) && isRecord(value) && isReferenceItem(value["requester"]);

/** The staff Ticket Queue (api-spec.md §7). IT Staff and Administrators only. */
export const fetchStaffTickets = async (
  query: URLSearchParams,
  signal?: AbortSignal
): Promise<QueueResponse> => {
  const suffix = query.toString();
  const body = await apiGet(
    `/api/staff/tickets${suffix ? `?${suffix}` : ""}`,
    signal ? { signal } : {}
  );

  if (
    !isRecord(body) ||
    !Array.isArray(body["data"]) ||
    !body["data"].every(isQueueRow) ||
    !isMeta(body["meta"])
  ) {
    throw new ApiError(
      "UNEXPECTED_RESPONSE",
      "The TokTickIT API returned the ticket queue in an unexpected format.",
      0
    );
  }

  return { data: body["data"], meta: body["meta"] };
};

/** Who may own a ticket — the choices the queue's Owner filter offers. */
export const fetchStaffOwners = async (
  signal?: AbortSignal
): Promise<ReferenceItem[]> =>
  expectArrayOf(
    await apiGet("/api/staff/owners", signal ? { signal } : {}),
    isReferenceItem,
    "ticket owners"
  );

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

/** One readable ticket. A ticket outside the caller's scope fails as a missing one. */
export const fetchTicket = async (
  ticketId: number,
  signal?: AbortSignal
): Promise<TicketDetail> => {
  const body = await apiGet(
    `/api/tickets/${ticketId}`,
    signal ? { signal } : {}
  );

  if (!isTicketDetail(body)) {
    throw unexpected("the ticket");
  }

  return body;
};

export const uploadAttachment = async (
  ticketId: number,
  file: File
): Promise<AttachmentMetadata> => {
  const form = new FormData();
  form.append("file", file);

  const body = await send(`/api/tickets/${ticketId}/attachments`, "POST", {
    body: form,
  });

  if (!isAttachment(body)) {
    throw unexpected("the attachment");
  }

  return body;
};

export const removeAttachment = async (
  attachmentId: number,
  reason: string
): Promise<AttachmentMetadata> => {
  const body = await apiDelete(`/api/attachments/${attachmentId}`, {
    reason,
  });

  if (!isAttachment(body)) {
    throw unexpected("the attachment");
  }

  return body;
};

/**
 * Fetches the bytes rather than pointing the browser at the URL.
 *
 * A plain link would navigate the page away to a raw file response, and a
 * refusal would replace the application with a JSON error body. So the file is
 * fetched, turned into an object URL, saved, and the URL
 * revoked; leaving it alive holds the whole file in memory for the life of the
 * page.
 */
export const downloadAttachment = async (
  attachment: AttachmentMetadata
): Promise<void> => {
  const blob = await sendForBlob(`/api/attachments/${attachment.id}/download`);

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = attachment.originalFilename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};
