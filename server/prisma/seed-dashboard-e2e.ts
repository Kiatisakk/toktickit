import { prisma } from "../src/prisma.js";
import { seedDashboardDemo } from "./dashboardDemo.js";
import { assertTestDatabase } from "./testDatabaseOnly.js";

/**
 * Writes the Lab 4 demonstration set into the TEST database for the dashboards'
 * end-to-end spec (`e2e/lab-04/dashboards.spec.ts`).
 *
 * The dashboards' figures come from the whole ticket table, so a spec that
 * asserts exact values needs a table it fully controls. The spec empties it
 * with `e2e:reset-tickets` and then runs this, which makes the figures
 * (New 2, Open 2, In Progress 3, ...) a property of `dashboardDemo.ts` rather
 * than of whatever earlier specs left behind. The data is the same set
 * `npm run db:seed:demo` writes to the development database; only the target
 * differs, and `assertTestDatabase` refuses to run against anything else.
 */
try {
  assertTestDatabase();

  const result = await seedDashboardDemo(prisma, new Date());

  console.log(
    `Seeded the Lab 4 dashboard fixture: ${result.ticketsCreated} tickets, ${result.actionsCreated} actions, ${result.historyCreated} history rows.`
  );
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
