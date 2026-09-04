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
 * The prefix is the whole contract: `summaryFor` in
 * `e2e/lab-02/requester-ticket-flow.spec.ts` is the only writer of it, and
 * this script is the only deleter. Attachments go with their ticket through
 * the schema's cascading delete — a finished journey leaves a soft-removed
 * row behind its removed file, an interrupted one leaves an active file, and
 * neither may survive into the next run.
 *
 * Runs inside `db:test:setup`, before migrate and seed, so rebuilding the test
 * database means rebuilding it from nothing — which is what D-11 already
 * claims.
 */
const JOURNEY_PREFIX = "E2E journey ";

try {
  const { count } = await prisma.ticket.deleteMany({
    where: { summary: { startsWith: JOURNEY_PREFIX } },
  });

  console.log(
    `Removed ${count} leftover journey ticket${count === 1 ? "" : "s"}.`
  );
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
