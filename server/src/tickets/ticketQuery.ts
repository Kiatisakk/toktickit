/**
 * Parses the `GET /api/tickets` query string.
 *
 * The contract is in docs/lab-02/api-spec.md. Kept as a pure function so the
 * rules can be exercised without HTTP or a database — there are a lot of them
 * and none needs either to be wrong.
 *
 * Nothing here falls back silently. BR-34 says an unrecognised or out-of-range
 * value is an error, because a filter that quietly does nothing shows the user a
 * list they did not ask for and gives them no reason to doubt it.
 */

export const PRIORITIES = ["LOW", "MEDIUM", "HIGH"] as const;

export const STATUSES = [
  "NEW",
  "OPEN",
  "IN_PROGRESS",
  "PENDING",
  "RESOLVED",
  "CLOSED",
] as const;

/**
 * Columns a caller may order by.
 *
 * A list rather than "any column on the table": ordering by `description` or by
 * a requester id is not a feature anyone asked for, and letting the query string
 * choose the column is how an ORDER BY becomes an injection surface.
 */
export const SORT_FIELDS = [
  "ticketNumber",
  "createdAt",
  "updatedAt",
  "summary",
  "requestedPriority",
] as const;

export const ORDERS = ["asc", "desc"] as const;

/** §6.1 fixes these three. 50 is the maximum a caller may ask for. */
export const PAGE_SIZES = [10, 20, 50] as const;

export type Priority = (typeof PRIORITIES)[number];
export type Status = (typeof STATUSES)[number];
export type SortField = (typeof SORT_FIELDS)[number];
export type Order = (typeof ORDERS)[number];

export interface TicketQuery {
  search?: string;
  categoryId?: number;
  requestedPriority?: Priority;
  itPriority?: Priority;
  status?: Status;
  sort: SortField;
  order: Order;
  page: number;
  pageSize: number;
}

/** Everything the contract defines. Anything else is a mistake worth reporting. */
const KNOWN_PARAMS = new Set([
  "search",
  "categoryId",
  "requestedPriority",
  "itPriority",
  "status",
  "sort",
  "order",
  "page",
  "pageSize",
]);

export type QueryResult =
  | { ok: true; value: TicketQuery }
  | { ok: false; details: Record<string, string> };

const DEFAULTS = {
  sort: "createdAt",
  order: "desc",
  page: 1,
  pageSize: 10,
} as const;

/** Present means "supplied and not blank". An emptied search box is not a filter. */
const given = (raw: unknown): string | undefined => {
  if (typeof raw !== "string") {
    return undefined;
  }

  const trimmed = raw.trim();

  return trimmed === "" ? undefined : trimmed;
};

const readEnum = <T extends string>(
  raw: unknown,
  allowed: readonly T[],
  field: string,
  details: Record<string, string>
): T | undefined => {
  const value = given(raw);

  if (value === undefined) {
    // A blank enum parameter is treated as absent rather than rejected: it is
    // what a "All Categories" dropdown sends when nothing is chosen.
    return undefined;
  }

  if (!allowed.includes(value as T)) {
    details[field] = `${field} must be one of ${allowed.join(", ")}.`;
    return undefined;
  }

  return value as T;
};

const readPositiveInt = (
  raw: unknown,
  field: string,
  details: Record<string, string>
): number | undefined => {
  const value = given(raw);

  if (value === undefined) {
    return undefined;
  }

  if (!/^\d+$/u.test(value)) {
    details[field] = `${field} must be a positive whole number.`;
    return undefined;
  }

  const parsed = Number(value);

  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    details[field] = `${field} must be a positive whole number.`;
    return undefined;
  }

  return parsed;
};

export const parseTicketQuery = (
  params: Record<string, unknown>
): QueryResult => {
  const details: Record<string, string> = {};

  // BR-34. Ignoring an unrecognised parameter means a typo quietly returns the
  // unfiltered list and the caller has no way to notice.
  for (const key of Object.keys(params)) {
    if (!KNOWN_PARAMS.has(key)) {
      details[key] = `${key} is not a recognised query parameter.`;
    }
  }

  const value: TicketQuery = { ...DEFAULTS };

  const search = given(params["search"]);

  if (search !== undefined) {
    value.search = search;
  }

  const categoryId = readPositiveInt(
    params["categoryId"],
    "categoryId",
    details
  );

  if (categoryId !== undefined) {
    value.categoryId = categoryId;
  }

  const requestedPriority = readEnum(
    params["requestedPriority"],
    PRIORITIES,
    "requestedPriority",
    details
  );

  if (requestedPriority !== undefined) {
    value.requestedPriority = requestedPriority;
  }

  const itPriority = readEnum(
    params["itPriority"],
    PRIORITIES,
    "itPriority",
    details
  );

  if (itPriority !== undefined) {
    value.itPriority = itPriority;
  }

  const status = readEnum(params["status"], STATUSES, "status", details);

  if (status !== undefined) {
    value.status = status;
  }

  const sort = readEnum(params["sort"], SORT_FIELDS, "sort", details);

  if (sort !== undefined) {
    value.sort = sort;
  }

  const order = readEnum(params["order"], ORDERS, "order", details);

  if (order !== undefined) {
    value.order = order;
  }

  const page = readPositiveInt(params["page"], "page", details);

  if (page !== undefined) {
    value.page = page;
  }

  const pageSizeRaw = given(params["pageSize"]);

  if (pageSizeRaw !== undefined) {
    const parsed = Number(pageSizeRaw);
    const permitted = PAGE_SIZES.some((size) => size === parsed);

    if (permitted) {
      value.pageSize = parsed;
    } else {
      details["pageSize"] = `pageSize must be one of ${PAGE_SIZES.join(", ")}.`;
    }
  }

  if (Object.keys(details).length > 0) {
    return { ok: false, details };
  }

  return { ok: true, value };
};
