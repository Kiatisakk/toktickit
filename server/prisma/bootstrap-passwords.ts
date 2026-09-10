import { hashPassword } from "../src/auth/password.js";
import { prisma } from "../src/prisma.js";
import { SEED_ACCOUNTS } from "./accounts.js";

/**
 * The middle step of the three-step password migration (specification.md §7).
 *
 * A `NOT NULL` column cannot be added to populated rows, and SQL cannot derive
 * a scrypt hash in any case because the hashing lives in Node. So the column
 * arrives nullable, this fills it, and the migration after it applies the
 * constraint — which is what proves this step finished.
 *
 * Run it once, between the two migrations:
 *
 *   npm run db:migrate:dev      # adds the nullable column
 *   npm run db:bootstrap        # this
 *   npm run db:migrate:dev      # sets NOT NULL
 *
 * It is idempotent: rows that already have a hash are left exactly as they are,
 * so a rerun neither resets a password anybody has since chosen nor re-raises
 * the must-change flag on an account that has cleared it. That is the opposite
 * of the seed's behaviour, and deliberately — the seed restores demonstration
 * credentials (D-16), while this repairs a schema change once.
 */

const bootstrap = async () => {
  const withoutHash = await prisma.user.findMany({
    where: { passwordHash: null },
    select: { id: true, email: true },
    orderBy: { id: "asc" },
  });

  if (withoutHash.length === 0) {
    console.log("Every account already has a password hash. Nothing to do.");
    return;
  }

  const issued = new Map(
    SEED_ACCOUNTS.map((account) => [account.email, account])
  );

  // An account this script has no issued password for cannot be given one.
  // Inventing a password would mean either logging it — which BR-06 forbids —
  // or leaving somebody with an account they cannot sign in to and no way to
  // find out. Stopping is the only honest answer, and it names the rows.
  const unknown = withoutHash.filter((user) => !issued.has(user.email));

  if (unknown.length > 0) {
    throw new Error(
      `No issued starting password for: ${unknown
        .map((user) => user.email)
        .join(
          ", "
        )}. Add them to prisma/accounts.ts, or set their password through the Administrator endpoint once it exists.`
    );
  }

  // Hashing is deliberately slow, so the hashes are prepared together and the
  // writes are a separate pass.
  const prepared = await Promise.all(
    withoutHash.map(async (user) => {
      const account = issued.get(user.email);

      if (!account) {
        throw new Error(`No issued password for ${user.email}.`);
      }

      return {
        id: user.id,
        passwordHash: await hashPassword(account.password),
        mustChangePassword: account.mustChangePassword,
      };
    })
  );

  await prisma.$transaction(
    prepared.map((row) =>
      prisma.user.update({
        where: { id: row.id },
        data: {
          passwordHash: row.passwordHash,
          mustChangePassword: row.mustChangePassword,
        },
      })
    )
  );

  const remaining = await prisma.user.count({ where: { passwordHash: null } });

  if (remaining > 0) {
    throw new Error(
      `${remaining} account(s) still have no password hash. The NOT NULL migration would fail.`
    );
  }

  console.log(
    `Bootstrapped ${prepared.length} account(s). No row is left without a password hash.`
  );
};

try {
  await bootstrap();
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
