import { prisma } from "../src/prisma.js";

/**
 * Removes the tickets a previous end-to-end run left behind.
 *
 * Every journey the Playwright suite runs creates a ticket, and nothing in the
 * suite deletes it afterwards — the evidence it produces is screenshots, not
 * rows. On a shared `toktickit_test` those rows accumulate across runs: nine
 * of them sat on the first requester after one evening of reruns, and the
 * server suite's ownership test, which reads every ticket its requester owns,
 * failed on summaries it never created.
 *
 * The prefixes are the whole contract, and there are two writers of them:
 * `summaryFor` in `e2e/lab-02/requester-ticket-flow.spec.ts`, and the rows
 * `e2e/lab-02/evidence.spec.ts` creates so that a second page of tickets
 * exists to photograph. This script is the only deleter. A writer that
 * invents a third prefix without adding it here will not fail — it will
 * quietly accumulate, which is how the second one was found: 108 rows and
 * two red assertions in the server suite. Attachments go with their ticket through
 * the schema's cascading delete — a finished journey leaves a soft-removed
 * row behind its removed file, an interrupted one leaves an active file, and
 * neither may survive into the next run.
 *
 * Runs inside `db:test:setup`, before migrate and seed, so rebuilding the test
 * database means rebuilding it from nothing — which is what D-11 already
 * claims.
 */
const LEFTOVER_PREFIXES = ["E2E journey ", "Evidence row "];

try {
  const { count } = await prisma.ticket.deleteMany({
    where: {
      OR: LEFTOVER_PREFIXES.map((prefix) => ({
        summary: { startsWith: prefix },
      })),
    },
  });

  console.log(
    `Removed ${count} leftover end-to-end ticket${count === 1 ? "" : "s"}.`
  );
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
