import { prisma } from "../src/prisma.js";

/**
 * The four supported IT request categories.
 *
 * Order matters: rows are inserted in this order, so their auto-increment ids
 * run 1..4 and GET /api/categories can return them in a predictable order.
 */
const CATEGORY_NAMES = [
  "Account and Access",
  "Hardware",
  "Software",
  "Network",
];

async function seed() {
  for (const name of CATEGORY_NAMES) {
    // upsert keyed on the unique name makes this seed idempotent — running it
    // a second time updates the existing row instead of inserting a duplicate.
    await prisma.category.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }

  const total = await prisma.category.count();
  console.log(`Seeded ${CATEGORY_NAMES.length} categories (${total} total).`);
}

seed()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
