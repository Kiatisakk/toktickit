import type { Prisma } from "../generated/prisma/client.js";

/**
 * Takes the Ticket row's lock for the rest of the transaction (BR-16).
 *
 * Every Action write calls this first, and the resolution gate will take the
 * same lock, so a write racing a resolution either commits before it — and the
 * gate sees it — or waits and finds the Ticket no longer accepts Actions. It
 * cannot commit onto a Resolved Ticket (AC-27).
 *
 * Returns the status read **under** the lock, which is the only reading of it
 * that may be trusted; null when the Ticket does not exist.
 */
export const lockTicket = async (
  tx: Prisma.TransactionClient,
  ticketId: number
): Promise<{ id: number; currentStatus: string } | null> => {
  const rows = await tx.$queryRaw<{ id: number; currentStatus: string }[]>`
    SELECT "id", "currentStatus"::text AS "currentStatus"
    FROM "Ticket"
    WHERE "id" = ${ticketId}
    FOR UPDATE`;

  return rows[0] ?? null;
};
