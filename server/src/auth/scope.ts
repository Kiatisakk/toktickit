import type { SessionUser } from "./session.js";

/**
 * Which tickets a user may read, as a query fragment (D-08, BR-19).
 *
 * A Requester is constrained to the tickets they raised; IT Staff and
 * Administrators are not constrained at all. The fragment is spread into the
 * `where` of the query that reads the ticket, so a ticket outside the scope is
 * never fetched — it matches nothing, and the caller answers exactly as it
 * would for a ticket that does not exist (BR-18, AC-12).
 *
 * One helper rather than a condition per handler: the decision lives in one
 * place, UNIT-01 tests it in isolation, and a new role cannot be handled in one
 * route and forgotten in the next.
 *
 * **Reading only.** Uploading to a ticket and removing its attachments stay
 * scoped to the ticket's requester for every role (api-spec.md §6), so those
 * handlers use `ownTicketsOf` instead.
 */
export const readableTicketsOf = (
  user: Pick<SessionUser, "id" | "role">
): { requesterId?: number } =>
  user.role === "REQUESTER" ? { requesterId: user.id } : {};

/**
 * The tickets a user raised, whatever their role.
 *
 * My Tickets, attachment upload and attachment removal are all "mine" for every
 * role, staff included (FR-30, D-07).
 */
export const ownTicketsOf = (
  user: Pick<SessionUser, "id">
): { requesterId: number } => ({ requesterId: user.id });
