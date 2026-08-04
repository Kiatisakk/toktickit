import { prisma } from "../src/prisma.js";

/**
 * The four supported IT request categories.
 *
 * This list is the source of truth: after seeding, the Category table contains
 * exactly these names and nothing else. Order matters — rows are created in
 * this order on a fresh database, so their ids run 1..4 and GET /api/categories
 * returns them in the order the Lab 1 contract shows.
 */
const CATEGORY_NAMES = [
  "Account and Access",
  "Hardware",
  "Software",
  "Network",
];

async function seed() {
  for (const name of CATEGORY_NAMES) {
    // upsert keyed on the unique name: an existing row is left alone rather
    // than duplicated.
    await prisma.category.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }

  // Upsert alone is not enough to make this seed idempotent across *edits*.
  // `name` is the identity we upsert on, so renaming an entry above would
  // create a new row and orphan the old one — a rerun would leave five
  // categories, not four. Removing anything no longer listed keeps the table
  // equal to CATEGORY_NAMES however the list changes.
  //
  // Safe while Category is reference data written only by this seed. Once
  // tickets reference categories (Lab 2), deleting one has to become a
  // decision rather than a side effect of running the seed.
  const { count: removed } = await prisma.category.deleteMany({
    where: { name: { notIn: CATEGORY_NAMES } },
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
