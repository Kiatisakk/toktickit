import { prisma } from "../src/prisma.js";

/**
 * The four supported IT request categories.
 *
 * This list is the source of truth. After seeding, the Category table contains
 * exactly these names and nothing else, and each row's `displayOrder` matches
 * its position here — so reordering this list reorders the screen, and nothing
 * depends on the serial ids.
 */
const CATEGORY_NAMES = [
  "Account and Access",
  "Hardware",
  "Software",
  "Network",
];

/**
 * Writes CATEGORY_NAMES to the database, in three passes inside one
 * transaction.
 *
 * Positions are assigned in two passes rather than one because `displayOrder`
 * is unique. Swapping two categories in the list above would otherwise try to
 * give a row a position another row still holds, and the write would fail
 * halfway through. Parking everything on negative positions first means no two
 * rows ever contend for the same value.
 *
 * The transaction matters for the same reason: a crash between the passes would
 * otherwise leave every category sitting at a negative position.
 */
async function seed() {
  const { removed } = await prisma.$transaction(async (tx) => {
    // Pass 1 — make sure every listed category exists, parked out of the way.
    for (const [index, name] of CATEGORY_NAMES.entries()) {
      const parked = -(index + 1);

      await tx.category.upsert({
        where: { name },
        update: { displayOrder: parked },
        create: { name, displayOrder: parked },
      });
    }

    // Pass 2 — drop anything no longer listed.
    //
    // Upsert alone does not make this seed idempotent across *edits*: `name` is
    // the identity we upsert on, so renaming an entry above creates a new row
    // and orphans the old one. A rerun would leave five categories, not four.
    // Deleting the unlisted ones keeps the table equal to CATEGORY_NAMES
    // however the list changes, and frees the positions they were holding.
    //
    // Safe while Category is reference data written only by this seed. Once
    // tickets reference categories (Lab 2), deleting one has to become a
    // decision rather than a side effect of running the seed.
    const { count: removed } = await tx.category.deleteMany({
      where: { name: { notIn: CATEGORY_NAMES } },
    });

    // Pass 3 — move everything to its real position.
    for (const [index, name] of CATEGORY_NAMES.entries()) {
      await tx.category.update({
        where: { name },
        data: { displayOrder: index + 1 },
      });
    }

    return { removed };
  });

  const total = await prisma.category.count();

  if (total !== CATEGORY_NAMES.length) {
    throw new Error(
      `Expected ${CATEGORY_NAMES.length} categories after seeding, found ${total}.`,
    );
  }

  console.log(
    `Seeded ${total} categories` +
      (removed > 0 ? `, removed ${removed} no longer listed` : "") +
      ".",
  );
}

seed()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
