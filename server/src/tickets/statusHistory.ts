import type { Prisma } from "../generated/prisma/client.js";
import type { TicketStatus } from "./domain.js";

/**
 * Appends one row to a Ticket's status history (D-08, AC-23).
 *
 * Takes the transaction client rather than the shared one, so a caller cannot
 * write a history row outside the transaction that made the change: the row and
 * the change commit together or not at all. `changedAt` is left to the
 * database's clock — nothing in a request can set it.
 */
export const recordStatusChange = async (
  tx: Prisma.TransactionClient,
  change: {
    ticketId: number;
    from: TicketStatus | null;
    to: TicketStatus;
    changedById: number;
  }
): Promise<void> => {
  await tx.ticketStatusChange.create({
    data: {
      ticketId: change.ticketId,
      fromStatus: change.from,
      toStatus: change.to,
      changedById: change.changedById,
    },
  });
};
