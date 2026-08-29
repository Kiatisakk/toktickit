import type { Prisma } from "../generated/prisma/client.js";

const SEQUENCE_DIGITS = 6;
const MAX_SEQUENCE = 10 ** SEQUENCE_DIGITS - 1;

/**
 * Formats one ticket number.
 *
 * `TKT-<four-digit year>-<six-digit sequence>`, matching both labsheet figures
 * and the contiguous run the My Tickets illustration shows. Pure, so the format
 * can be asserted without a database (UNIT-01).
 *
 * Throws past 999999 rather than widening to seven digits. A value that does not
 * match `TICKET_NUMBER_PATTERN` is not a ticket number, and quietly producing
 * one that fails the project's own validator is worse than refusing: the row
 * would be stored, the screens would show it, and the mismatch would surface
 * somewhere unrelated. A million tickets in one calendar year also means
 * something has gone wrong long before this line runs.
 */
export const formatTicketNumber = (year: number, sequence: number): string => {
  if (
    !Number.isSafeInteger(sequence) ||
    sequence < 1 ||
    sequence > MAX_SEQUENCE
  ) {
    throw new Error(
      `Ticket sequence ${sequence} is outside 1-${MAX_SEQUENCE} for ${year}.`
    );
  }

  return `TKT-${year}-${String(sequence).padStart(SEQUENCE_DIGITS, "0")}`;
};

/** Matches what `formatTicketNumber` produces. Used by tests and by nothing else. */
export const TICKET_NUMBER_PATTERN = /^TKT-\d{4}-\d{6}$/u;

/**
 * Claims the next sequence number for a year.
 *
 * One statement, and it has to stay one statement. Reading the counter and
 * writing back `value + 1` would let two simultaneous submissions read the same
 * number and produce the same ticket number; so would a Prisma `upsert`, which
 * is a select followed by an insert or update and can lose the race on the
 * first ticket of a year.
 *
 * `INSERT … ON CONFLICT DO UPDATE … RETURNING` is atomic in PostgreSQL: the row
 * is locked for the duration, and a concurrent caller waits rather than reading
 * a stale value. The unique constraint on `Ticket.ticketNumber` remains the
 * backstop — if anything ever did slip through, it fails as a rejected insert
 * rather than as two tickets wearing the same number.
 */
export const claimTicketNumber = async (
  tx: Prisma.TransactionClient,
  year: number
): Promise<string> => {
  const rows = await tx.$queryRaw<{ lastNumber: number }[]>`
    INSERT INTO "TicketCounter" ("year", "lastNumber")
    VALUES (${year}, 1)
    ON CONFLICT ("year")
    DO UPDATE SET "lastNumber" = "TicketCounter"."lastNumber" + 1
    RETURNING "lastNumber"
  `;

  const claimed = rows[0]?.lastNumber;

  if (claimed === undefined) {
    throw new Error("Ticket counter returned no row.");
  }

  return formatTicketNumber(year, claimed);
};
