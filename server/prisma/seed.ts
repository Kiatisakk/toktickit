import { prisma } from "../src/prisma.js";

/**
 * Reference data for TokTickIT.
 *
 * The three lists below are the source of truth. After seeding, each table
 * contains exactly what is listed here, in this order, and anything that used
 * to be listed is deactivated rather than deleted — from Lab 2 onwards tickets
 * reference this data, so removing a row would orphan them.
 *
 * Idempotent: running it twice changes nothing (§5.3, AC-04).
 *
 * Demonstration tickets are NOT seeded here. They live in `seed-demo.ts` so
 * that the test database can hold reference data alone and pagination counts
 * stay deterministic — see decision D-11.
 */

const CATEGORY_NAMES = [
  "Account and Access",
  "Hardware",
  "Software",
  "Network",
];

/**
 * At least six realistic systems, per §5.3.
 *
 * Deliberately not grouped under a category: the two are independent, and
 * "Account and Access" would otherwise have nothing to offer (decision D-06).
 */
const RELATED_SYSTEM_NAMES = [
  "Email",
  "Campus Wi-Fi",
  "VPN",
  "LEB2 App",
  "Grade Submission App",
  "Printer",
  "Corporate Laptop",
];

/**
 * Development Requesters — seeded identities the selection screen offers.
 *
 * Four active and one inactive, as §5.3 requires. The inactive one exists to be
 * absent: BR-07 says it never appears in the selector and can never become the
 * current context, and API-02 asserts exactly that.
 *
 * Every row is a REQUESTER. Lab 3 adds the other roles.
 */
const REQUESTERS = [
  {
    email: "jennifer.anderson@example.ac.th",
    name: "Jennifer Anderson",
    isActive: true,
  },
  {
    email: "somchai.wattana@example.ac.th",
    name: "Somchai Wattana",
    isActive: true,
  },
  {
    email: "pimchanok.srisai@example.ac.th",
    name: "Pimchanok Srisai",
    isActive: true,
  },
  {
    email: "thanakorn.boonmee@example.ac.th",
    name: "Thanakorn Boonmee",
    isActive: true,
  },
  {
    email: "natthaphong.chaiyaporn@example.ac.th",
    name: "Natthaphong Chaiyaporn",
    isActive: false,
  },
];

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

/**
 * Writes an ordered reference list in three passes.
 *
 * Positions are assigned twice rather than once because `displayOrder` is
 * unique. Reordering the list would otherwise try to give a row a position
 * another row still holds, and the write would fail halfway through. Parking
 * everything on negative positions first means no two rows ever contend for the
 * same value.
 *
 * Rows no longer listed are deactivated, not deleted, and each is moved to its
 * own negative position. Leaving a retired row on a positive slot would make it
 * collide the moment a listed item needed that slot back, and the collision
 * would surface as a failed transaction rather than as anything readable.
 */
const seedCategories = async (tx: Tx) => {
  await Promise.all(
    CATEGORY_NAMES.map((name, index) =>
      tx.category.upsert({
        where: { name },
        update: { displayOrder: -(index + 1), isActive: true },
        create: { name, displayOrder: -(index + 1), isActive: true },
      })
    )
  );

  // Retire first, then park each retired row on its own negative slot. A single
  // updateMany cannot do this: displayOrder is unique, so every row needs a
  // different value.
  const { count: retired } = await tx.category.updateMany({
    where: { name: { notIn: CATEGORY_NAMES }, isActive: true },
    data: { isActive: false },
  });

  const stale = await tx.category.findMany({
    where: { name: { notIn: CATEGORY_NAMES } },
    orderBy: { id: "asc" },
    select: { id: true },
  });

  await Promise.all(
    stale.map((row, index) =>
      tx.category.update({
        where: { id: row.id },
        data: { displayOrder: -(CATEGORY_NAMES.length + index + 1) },
      })
    )
  );

  await Promise.all(
    CATEGORY_NAMES.map((name, index) =>
      tx.category.update({
        where: { name },
        data: { displayOrder: index + 1 },
      })
    )
  );

  return retired;
};

const seedRelatedSystems = async (tx: Tx) => {
  await Promise.all(
    RELATED_SYSTEM_NAMES.map((name, index) =>
      tx.relatedSystem.upsert({
        where: { name },
        update: { displayOrder: -(index + 1), isActive: true },
        create: { name, displayOrder: -(index + 1), isActive: true },
      })
    )
  );

  // Retire first, then park each retired row on its own negative slot. A single
  // updateMany cannot do this: displayOrder is unique, so every row needs a
  // different value.
  const { count: retired } = await tx.relatedSystem.updateMany({
    where: { name: { notIn: RELATED_SYSTEM_NAMES }, isActive: true },
    data: { isActive: false },
  });

  const stale = await tx.relatedSystem.findMany({
    where: { name: { notIn: RELATED_SYSTEM_NAMES } },
    orderBy: { id: "asc" },
    select: { id: true },
  });

  await Promise.all(
    stale.map((row, index) =>
      tx.relatedSystem.update({
        where: { id: row.id },
        data: { displayOrder: -(RELATED_SYSTEM_NAMES.length + index + 1) },
      })
    )
  );

  await Promise.all(
    RELATED_SYSTEM_NAMES.map((name, index) =>
      tx.relatedSystem.update({
        where: { name },
        data: { displayOrder: index + 1 },
      })
    )
  );

  return retired;
};

/**
 * Requesters are keyed on email, which is what makes a rerun idempotent: a
 * changed display name updates the existing row rather than creating a second
 * identity for the same person.
 *
 * There is no ordering column here, so no parking pass is needed.
 */
const seedRequesters = (tx: Tx) =>
  Promise.all(
    REQUESTERS.map((requester) =>
      tx.user.upsert({
        where: { email: requester.email },
        update: { name: requester.name, isActive: requester.isActive },
        create: {
          email: requester.email,
          name: requester.name,
          isActive: requester.isActive,
          role: "REQUESTER",
        },
      })
    )
  );

const seed = async () => {
  const { retiredCategories, retiredSystems } = await prisma.$transaction(
    async (tx) => {
      const categories = await seedCategories(tx);
      const systems = await seedRelatedSystems(tx);
      await seedRequesters(tx);

      return { retiredCategories: categories, retiredSystems: systems };
    }
  );

  // Assertions rather than logs: a seed that silently produced the wrong number
  // of rows would break the tests that count them, several files away from the
  // cause.
  const [categories, systems, activeRequesters, inactiveRequesters] =
    await Promise.all([
      prisma.category.count({ where: { isActive: true } }),
      prisma.relatedSystem.count({ where: { isActive: true } }),
      prisma.user.count({ where: { role: "REQUESTER", isActive: true } }),
      prisma.user.count({ where: { role: "REQUESTER", isActive: false } }),
    ]);

  if (categories !== CATEGORY_NAMES.length) {
    throw new Error(
      `Expected ${CATEGORY_NAMES.length} active categories, found ${categories}.`
    );
  }

  if (systems !== RELATED_SYSTEM_NAMES.length) {
    throw new Error(
      `Expected ${RELATED_SYSTEM_NAMES.length} active related systems, found ${systems}.`
    );
  }

  if (activeRequesters < 4) {
    throw new Error(
      `§5.3 requires at least four active Development Requesters, found ${activeRequesters}.`
    );
  }

  if (inactiveRequesters < 1) {
    throw new Error(
      `§5.3 requires at least one inactive Development Requester, found ${inactiveRequesters}.`
    );
  }

  const retired = retiredCategories + retiredSystems;

  console.log(
    `Seeded ${categories} categories, ${systems} related systems, ${activeRequesters} active and ${inactiveRequesters} inactive requesters${
      retired > 0 ? `, retired ${retired} no longer listed` : ""
    }.`
  );
};

try {
  await seed();
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
