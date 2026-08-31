import { prisma } from "../src/prisma.js";
import { PRIORITIES } from "../src/tickets/domain.js";
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
 * Every field the screens can show is filled, including the three §4.2 keeps
 * Lab 2 from setting: IT Priority, Ticket Owner and Resolution Summary.
 *
 * That is not the excluded workflow creeping in. §4.2 excludes *building* it —
 * nothing here triages a ticket, claims one or resolves one, and no screen,
 * endpoint or test in this repository can change these values. What it excludes
 * is the machinery, not the existence of the data.
 *
 * The reason to fill them is §14 Part 7, which asks for evidence of the filters
 * working. Two of the four — IT Priority and Current Status — cannot be
 * demonstrated at all when every row is `NEW` with a null IT priority: the
 * dropdown would offer six statuses that all return the same list. The page 11
 * illustration shows both columns populated and the statuses varied, for the
 * same reason.
 *
 * `CLOSED` is deliberately left unused, so one status filter still finds
 * nothing and demonstrates BR-35's no-results state.
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

/**
 * How many tickets each seeded requester gets, in seed order.
 *
 * Fifty-five is six pages at the default size of ten, which is what makes the
 * windowed page controls visible at all — `1 2 3 … 6`. Three pages showed every
 * number and never the gap.
 */
const DISTRIBUTION = [55, 6, 0, 3];

/**
 * IT staff, for Ticket Owner. Named as the labsheet illustrations name them.
 *
 * They live in the demonstration seed rather than the reference seed because
 * the test database must hold reference data alone (D-11), and Lab 2 has no
 * feature that needs an IT user — only a screenshot does. Lab 3 moves them when
 * authentication gives them a purpose.
 */
const IT_STAFF = [
  { name: "Michael Brown", email: "michael.brown@example.ac.th" },
  { name: "Sarah Johnson", email: "sarah.johnson@example.ac.th" },
  { name: "David Lee", email: "david.lee@example.ac.th" },
];

/** The lifecycle a requester would actually see. `CLOSED` is absent on purpose. */
const STATUS_CYCLE = [
  "NEW",
  "OPEN",
  "IN_PROGRESS",
  "NEW",
  "PENDING",
  "RESOLVED",
  "OPEN",
] as const;

const RESOLUTIONS = [
  "Replaced the battery under warranty. Verified a full charge cycle with the requester.",
  "Reissued the VPN certificate and confirmed the tunnel from off campus.",
  "Rebuilt the mail profile. Sync restored on the handset and the desktop client.",
  "Granted the site permission and confirmed access from the requester's account.",
];

/**
 * How a demonstration ticket is recognised on a rerun.
 *
 * An earlier version parked them in year 2099 and deleted by ticket-number
 * prefix, which kept them clear of anything created by hand but made the number
 * lie: it read `TKT-2099-…` while `createdAt` said this year. D-02 says the year
 * in a ticket number is the year the ticket was raised, so the seed was breaking
 * the rule it exists to demonstrate.
 *
 * The description carries the marker instead. It is precise — no ticket typed by
 * a person begins with this sentence — and it leaves the number free to be
 * correct.
 */
const DEMO_MARKER =
  "Raised from the demonstration seed so the screens have something realistic";

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

  // Upserted, so a rerun neither duplicates them nor orphans the tickets
  // already pointing at them.
  const staff = await Promise.all(
    IT_STAFF.map((person) =>
      prisma.user.upsert({
        where: { email: person.email },
        create: { ...person, role: "IT_STAFF", isActive: true },
        update: { name: person.name, role: "IT_STAFF", isActive: true },
      })
    )
  );

  const year = new Date().getFullYear();

  // Everything below happens in one transaction. Deleting and inserting
  // separately means a failure between them leaves the database with the old
  // demonstration tickets gone and no new ones — the screens empty, and the
  // only way back a rerun the person may not know to do.
  const { removed, created } = await prisma.$transaction(async (tx) => {
    const { count: replaced } = await tx.ticket.deleteMany({
      where: { description: { startsWith: DEMO_MARKER } },
    });

    // Continue the real counter rather than starting at one. Seeding 1..34
    // directly would hand out numbers the application's own counter is still
    // going to issue, and the second of the two to be written would fail the
    // unique constraint. Deleted numbers are not reused, which is what a
    // counter means.
    const counter = await tx.ticketCounter.findUnique({ where: { year } });
    const start = counter?.lastNumber ?? 0;

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
        // does something visible. Clamped to the first of January: a run in
        // early January would otherwise reach back into last year and stamp a
        // ticket with a number whose year does not match its date.
        const raisedAt = new Date();
        raisedAt.setDate(raisedAt.getDate() - sequence);
        raisedAt.setHours(9 + (n % 8), (n * 7) % 60, 0, 0);

        if (raisedAt.getFullYear() < year) {
          raisedAt.setFullYear(year, 0, 1);
        }

        const status = STATUS_CYCLE[sequence % STATUS_CYCLE.length] ?? "NEW";
        // A ticket still at New has reached nobody yet, so it has no owner and
        // no IT priority. That is what keeps the em dash on those columns
        // meaningful rather than being the only thing they ever say.
        const triaged = status !== "NEW";

        rows.push({
          ticketNumber: formatTicketNumber(year, start + sequence),
          requesterId: requester.id,
          categoryId: categories[sequence % categories.length]?.id ?? 0,
          relatedSystemId: systems[sequence % systems.length]?.id ?? 0,
          summary: SUMMARIES[sequence % SUMMARIES.length] ?? "Support request",
          description: `${DEMO_MARKER} to show. Replace by creating a ticket through the application.`,
          requestedPriority:
            PRIORITIES[sequence % PRIORITIES.length] ?? "MEDIUM",
          currentStatus: status,
          ...(triaged
            ? {
                itPriority: PRIORITIES[(sequence + 1) % PRIORITIES.length],
                ticketOwnerId: staff[sequence % staff.length]?.id,
              }
            : {}),
          ...(status === "RESOLVED"
            ? {
                resolutionSummary:
                  RESOLUTIONS[sequence % RESOLUTIONS.length] ?? "Resolved.",
              }
            : {}),
          createdAt: raisedAt,
          // Something happened to a triaged ticket after it arrived, so its
          // Last Updated is later than its Created Date — otherwise the two
          // columns are identical on every row and sorting by either looks
          // broken.
          updatedAt: triaged
            ? new Date(raisedAt.getTime() + 36 * 60 * 60 * 1000)
            : raisedAt,
        });
      }
    }

    await tx.ticket.createMany({ data: rows });

    await tx.ticketCounter.upsert({
      where: { year },
      create: { year, lastNumber: start + rows.length },
      update: { lastNumber: start + rows.length },
    });

    return { removed: replaced, created: rows.length };
  });

  const summary = DISTRIBUTION.map(
    (count, index) => `${requesters[index]?.name ?? "?"}: ${count}`
  ).join(", ");

  console.log(
    `Seeded ${created} demonstration tickets for ${year} (${summary})${
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
