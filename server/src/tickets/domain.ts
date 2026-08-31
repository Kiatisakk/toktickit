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

export const STATUSES = [
  "NEW",
  "OPEN",
  "IN_PROGRESS",
  "PENDING",
  "RESOLVED",
  "CLOSED",
] as const;

export type TicketStatus = (typeof STATUSES)[number];
