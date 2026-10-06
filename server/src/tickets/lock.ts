import type { Prisma } from "../generated/prisma/client.js";

/**
 * Takes the Ticket row's lock for the rest of the transaction (BR-16).
 *
 * Every Action write calls this first, and the resolution gate will take the
 * same lock, so a write racing a resolution either commits before it — and the
 * gate sees it — or waits and finds the Ticket no longer accepts Actions. It
 * cannot commit onto a Resolved Ticket (AC-27).
 *
 * Returns the status and `version` read **under** the lock, which are the only
 * readings of them that may be trusted: a caller that compares a request's
 * `version` does so against this one, before it evaluates any rule (BR-20);
 * null when the Ticket does not exist.
 */
export const lockTicket = async (
  tx: Prisma.TransactionClient,
  ticketId: number
): Promise<{ id: number; currentStatus: string; version: number } | null> => {
  const rows = await tx.$queryRaw<
    { id: number; currentStatus: string; version: number }[]
  >`
    SELECT "id", "currentStatus"::text AS "currentStatus", "version"
    FROM "Ticket"
    WHERE "id" = ${ticketId}
    FOR UPDATE`;

  return rows[0] ?? null;
};
