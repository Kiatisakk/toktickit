import { unlink } from "node:fs/promises";

import { pathFor } from "../src/attachments/storage.js";
import { prisma } from "../src/prisma.js";
import { assertTestDatabase } from "./testDatabaseOnly.js";

/**
 * Wipes every Ticket row so the end-to-end suite can prove the staff queue's
 * (and My Tickets') *Empty* mode honestly.
 *
 * `wipe-journey.ts` runs once, before the whole suite starts, and only removes
 * rows matching known leftover prefixes — by design, because almost every spec
 * needs the ticket it creates to survive for the rest of its own test. The
 * Ticket Queue's *Empty* mode is different: ui-spec.md §5 says it is "the
 * queue itself is empty," and `e2e/lab-02/*` always runs first in file order
 * and always leaves at least one ticket behind by the time `e2e/lab-03/*`
 * starts. Nothing before this script ever produces a database with zero
 * tickets in it, so nothing could tell an *Empty* screenshot from a *No
 * results* one that got lucky with its filter.
 *
 * Run once per viewport project, at the top of
 * `e2e/lab-03/staff-ticket-flow.spec.ts`, before that project's own tickets
 * exist. Every ticket created earlier in the same project's run — by Lab 2's
 * specs, or by an earlier Lab 3 project's run of this same file — has already
 * had every assertion it exists for made against it by the time this runs;
 * nothing downstream reads one of those tickets back. Deleting them here costs
 * nothing. Attachments, Public Comments and Internal Notes cascade with their
 * ticket (schema.prisma's `onDelete: Cascade`); `TicketCounter` is left alone,
 * so a ticket number never repeats within one `toktickit_test`.
 */
try {
  assertTestDatabase();

  // The attachment rows cascade with their tickets, but the bytes they point
  // at live in `server/uploads`, which no cascade reaches. Unlinked first, or
  // every run leaves its uploads behind with nothing left to name them.
  // Review of PR #66.
  const stored = await prisma.attachment.findMany({
    select: { storedFilename: true },
  });
  let unlinked = 0;

  await Promise.all(
    stored.map(async ({ storedFilename }) => {
      try {
        await unlink(pathFor(storedFilename));
        unlinked += 1;
      } catch (error) {
        // Already gone is the state this is trying to reach.
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
          throw error;
        }
      }
    })
  );

  console.log(`Removed ${unlinked} uploaded file(s) from server/uploads.`);

  const { count } = await prisma.ticket.deleteMany({});

  console.log(
    `Reset the ticket table for the e2e staff queue's empty state: removed ${count}.`
  );
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
