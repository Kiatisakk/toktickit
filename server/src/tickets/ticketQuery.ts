import { PRIORITIES, STATUSES } from "./domain.js";

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

export { PRIORITIES, STATUSES } from "./domain.js";

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

/**
 * Present means "supplied and not blank". An emptied search box is not a filter.
 *
 * `NON_SCALAR` is the third answer, and it is the one that matters. Express
 * parses `?status=A&status=B` into an array and `?status[x]=1` into an object.
 * Reading either as "absent" would drop the filter and return the unfiltered
 * list, which is the exact failure BR-34 exists to prevent — silently showing
 * rows the caller did not ask for. It is rejected by name instead.
 */
const NON_SCALAR = Symbol("non-scalar");

const given = (raw: unknown): string | undefined | typeof NON_SCALAR => {
  if (raw === undefined) {
    return undefined;
  }

  if (typeof raw !== "string") {
    return NON_SCALAR;
  }

  const trimmed = raw.trim();

  return trimmed === "" ? undefined : trimmed;
};

/** Records the rejection and returns undefined, so callers read as before. */
const scalar = (
  raw: unknown,
  field: string,
  details: Record<string, string>
): string | undefined => {
  const value = given(raw);

  if (value === NON_SCALAR) {
    details[field] = `${field} must be given at most once, as a single value.`;
    return undefined;
  }

  return value;
};

const readEnum = <T extends string>(
  raw: unknown,
  allowed: readonly T[],
  field: string,
  details: Record<string, string>
): T | undefined => {
  const value = scalar(raw, field, details);

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
  const value = scalar(raw, field, details);

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

  const search = scalar(params["search"], "search", details);

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

  const pageSizeRaw = scalar(params["pageSize"], "pageSize", details);

  if (pageSizeRaw !== undefined) {
    // Compared as text, not through Number(). `Number` reads "10.0", "1e1",
    // "+10" and "0x0A" all as ten, so a numeric comparison would accept four
    // spellings of a value the contract permits in exactly one.
    const permitted = PAGE_SIZES.some((size) => String(size) === pageSizeRaw);

    if (permitted) {
      value.pageSize = Number(pageSizeRaw);
    } else {
      details["pageSize"] = `pageSize must be one of ${PAGE_SIZES.join(", ")}.`;
    }
  }

  if (Object.keys(details).length > 0) {
    return { ok: false, details };
  }

  return { ok: true, value };
};
