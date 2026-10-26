import type { Prisma } from "../generated/prisma/client.js";

/**
 * The two predicates a dashboard card and its drill-down both depend on.
 *
 * Written once, here, and imported by the list query and by the dashboard
 * counts, so the number on a card and the list it opens cannot drift apart
 * (BR-34, AC-30). The tests do not rely on that: they compute each expectation
 * with separately written SQL.
 */

/** Statuses outside the open group (BR-24); everything else is open. */
export const CLOSED_GROUP = ["RESOLVED", "CLOSED", "CANCELLED"] as const;

/** Tickets in the open group, Reopened included (BR-24, D-14). */
export const inOpenGroup = (): Prisma.TicketWhereInput => ({
  currentStatus: { notIn: [...CLOSED_GROUP] },
});

/**
 * Tickets with at least one open follow-up on an Action `userId` performed
 * (BR-09, FR-23).
 *
 * An Action's follow-up is open when it requires one, is not Cancelled, and no
 * Done Action follows it up. A Planned or Cancelled follower does not close it.
 * A Ticket counts once however many such Actions it holds, because the
 * condition is on the Ticket.
 */
export const hasOpenFollowUpBy = (userId: number): Prisma.TicketWhereInput => ({
  actions: {
    some: {
      performedById: userId,
      followUpRequired: true,
      state: { not: "CANCELLED" },
      followedBy: { none: { state: "DONE" } },
    },
  },
});
