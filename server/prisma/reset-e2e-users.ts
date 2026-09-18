import { prisma } from "../src/prisma.js";

/**
 * Removes the account the administration journey creates, before it creates
 * it again.
 *
 * `server/prisma/accounts.ts`'s seeded accounts are restored to their known
 * state by `prisma db seed` on every `npm run test:e2e` (D-16) — but the user
 * `e2e/lab-03/user-administration.spec.ts` creates is not one of those. It is
 * new data the test itself writes, `db:test:setup` never touches it, and
 * there is no endpoint to delete a user through the API (api-spec.md §10) —
 * only to deactivate one. Left alone, the second `npm run test:e2e` of the
 * "run it twice" check would find the same email already in use and refuse
 * the create with `EMAIL_ALREADY_EXISTS`, and every invocation after the first
 * would leave one more inactive row behind.
 *
 * Matched by substring rather than by the exact three emails the three
 * viewport projects use, so a fourth project or a renamed one is still
 * cleaned up without this file needing to know its name. The account has
 * never been given a ticket, a comment or a note, so deleting it cascades
 * nothing that matters (only its own Session rows, per schema.prisma).
 */
const { count } = await prisma.user.deleteMany({
  where: { email: { contains: "e2e.newhire." } },
});

console.log(
  `Removed ${count} leftover e2e administration-journey user${count === 1 ? "" : "s"}.`
);

await prisma.$disconnect();
