import { prisma } from "../src/prisma.js";
import { formatTicketNumber } from "../src/tickets/ticketNumber.js";

/**
 * Demonstration tickets, for the development database only.
 *
 * Kept apart from the reference seed because the test database must hold
 * reference data alone: a test that counts rows cannot also be sharing a
 * database with twenty-five tickets somebody added for a screenshot
 * (decision D-11).
 *
 * The distribution is chosen to make the Part 7 evidence possible in one pass:
 *
 *   the first requester   25 tickets  — three pages at the default page size
 *   the second             6 tickets  — a single page, so switching is visible
 *   the third              0 tickets  — the empty state, which needs a requester
 *                                       who genuinely has none
 *   the fourth             3 tickets
 *
 * Every ticket is `NEW`, because §4.2 excludes status changes. Filtering by any
 * other status is what demonstrates the no-results state (BR-35).
 */

const SUMMARIES = [
  "Laptop battery drains quickly",
  "Cannot connect to VPN",
  "Email not syncing on mobile",
  "New employee setup request",
  "Printer keeps showing offline",
  "Request access to SharePoint",
  "Outlook freezing intermittently",
  "Docking station not detected",
  "Password reset for LEB2",
  "Campus Wi-Fi drops in the library",
  "Grade submission page returns an error",
  "Second monitor not recognised",
  "Shared drive missing after restart",
  "Zoom audio not working",
  "Software licence expired",
  "Keyboard keys unresponsive",
  "Cannot print double-sided",
  "VPN disconnects every ten minutes",
  "Mailbox is full",
  "Screen flickers on wake",
  "USB ports stopped working",
  "Application crashes on launch",
  "Slow file transfer over Wi-Fi",
  "Certificate warning on internal site",
  "Webcam not detected in meetings",
];

const PRIORITIES = ["LOW", "MEDIUM", "HIGH"] as const;

/** How many tickets each seeded requester gets, in seed order. */
const DISTRIBUTION = [25, 6, 0, 3];

const DEMO_YEAR = 2099;

const seedDemo = async () => {
  const requesters = await prisma.user.findMany({
    where: { role: "REQUESTER", isActive: true },
    orderBy: { id: "asc" },
    select: { id: true, name: true },
  });
  const categories = await prisma.category.findMany({
    where: { isActive: true },
    orderBy: { displayOrder: "asc" },
    select: { id: true },
  });
  const systems = await prisma.relatedSystem.findMany({
    where: { isActive: true },
    orderBy: { displayOrder: "asc" },
    select: { id: true },
  });

  if (requesters.length < DISTRIBUTION.length) {
    throw new Error(
      `Expected at least ${DISTRIBUTION.length} active requesters. Run npm run db:seed first.`
    );
  }

  if (categories.length === 0 || systems.length === 0) {
    throw new Error("Reference data is missing. Run npm run db:seed first.");
  }

  // Demonstration tickets live in their own year so they can be replaced
  // wholesale without touching anything a person created by hand.
  const { count: removed } = await prisma.ticket.deleteMany({
    where: { ticketNumber: { startsWith: `TKT-${DEMO_YEAR}-` } },
  });

  const rows = [];
  let sequence = 0;

  for (const [index, count] of DISTRIBUTION.entries()) {
    const requester = requesters[index];

    if (!requester) {
      continue;
    }

    for (let n = 0; n < count; n += 1) {
      sequence += 1;

      // Spread over the past few weeks so Created Date and Last Updated read
      // like a real queue rather than a bulk import, and so sorting by date
      // does something visible.
      const created = new Date();
      created.setDate(created.getDate() - sequence);
      created.setHours(9 + (n % 8), (n * 7) % 60, 0, 0);

      rows.push({
        ticketNumber: formatTicketNumber(DEMO_YEAR, sequence),
        requesterId: requester.id,
        categoryId: categories[sequence % categories.length]?.id ?? 0,
        relatedSystemId: systems[sequence % systems.length]?.id ?? 0,
        summary: SUMMARIES[sequence % SUMMARIES.length] ?? "Support request",
        description:
          "Raised from the demonstration seed so the screens have something realistic to show. Replace by creating a ticket through the application.",
        requestedPriority: PRIORITIES[sequence % PRIORITIES.length] ?? "MEDIUM",
        createdAt: created,
        updatedAt: created,
      });
    }
  }

  await prisma.ticket.createMany({ data: rows });

  const summary = DISTRIBUTION.map(
    (count, index) => `${requesters[index]?.name ?? "?"}: ${count}`
  ).join(", ");

  console.log(
    `Seeded ${rows.length} demonstration tickets (${summary})${
      removed > 0 ? `, replacing ${removed}` : ""
    }.`
  );
};

try {
  await seedDemo();
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
