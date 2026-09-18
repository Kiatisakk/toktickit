/**
 * The ticket enums, defined once.
 *
 * Creation and listing previously each carried their own copy of the priority
 * list. Two copies of a domain rule do not stay equal: an edit to one is a
 * silent divergence where a ticket can be created with a value the list filter
 * will not accept, and nothing fails until someone notices the row is
 * unreachable.
 *
 * These mirror the Prisma enums. Prisma generates its own types, but importing
 * the client into a pure parser to borrow a union would drag a database
 * dependency into a function whose whole point is not needing one.
 */

export const PRIORITIES = ["LOW", "MEDIUM", "HIGH"] as const;

export type Priority = (typeof PRIORITIES)[number];

/**
 * The eight statuses of BR-24, in the lifecycle's own order.
 *
 * The order is load-bearing twice over: the queue sorts on it, and it is the
 * order the status control offers targets in. `WAITING_FOR_REQUESTER` sits
 * where `PENDING` sat, because the migration renamed that value in place
 * (D-11).
 */
export const STATUSES = [
  "NEW",
  "OPEN",
  "IN_PROGRESS",
  "WAITING_FOR_REQUESTER",
  "RESOLVED",
  "CLOSED",
  "REOPENED",
  "CANCELLED",
] as const;

export type TicketStatus = (typeof STATUSES)[number];

/**
 * Which statuses each status may move to (specification.md §5, BR-25).
 *
 * The matrix lives here, once, and both the endpoint that accepts a change and
 * the screen that offers the choices read it. A screen offering a target the
 * endpoint refuses is the defect this shape exists to make impossible.
 *
 * `CANCELLED` maps to nothing: it is terminal, and a cancelled ticket does not
 * move again (BR-26). That is an empty list rather than a missing key, so
 * "nowhere to go" is a stated fact rather than an unhandled case.
 */
const TRANSITIONS: Record<TicketStatus, readonly TicketStatus[]> = {
  NEW: ["OPEN", "CANCELLED"],
  OPEN: ["IN_PROGRESS", "WAITING_FOR_REQUESTER", "RESOLVED", "CANCELLED"],
  IN_PROGRESS: ["WAITING_FOR_REQUESTER", "RESOLVED", "CANCELLED"],
  WAITING_FOR_REQUESTER: ["IN_PROGRESS", "RESOLVED", "CANCELLED"],
  RESOLVED: ["CLOSED", "REOPENED"],
  CLOSED: ["REOPENED"],
  REOPENED: ["IN_PROGRESS", "WAITING_FOR_REQUESTER", "RESOLVED", "CANCELLED"],
  CANCELLED: [],
};

export const isTicketStatus = (value: unknown): value is TicketStatus =>
  STATUSES.includes(value as TicketStatus);

/**
 * Where a ticket in this status may go next, in lifecycle order.
 *
 * A status this module does not know — a stale value from an older client, say
 * — has no targets rather than throwing: the caller is asking what is
 * permitted, and the honest answer for a status that does not exist is
 * "nothing".
 */
export const permittedTargets = (from: unknown): TicketStatus[] =>
  isTicketStatus(from) ? [...TRANSITIONS[from]] : [];

export const isPermittedTransition = (from: unknown, to: unknown): boolean =>
  isTicketStatus(to) && permittedTargets(from).includes(to);
