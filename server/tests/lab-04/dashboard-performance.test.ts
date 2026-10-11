import { randomUUID } from "node:crypto";

import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { ACTIVE_REQUESTER, ACTIVE_STAFF } from "../../prisma/accounts.js";
import { app } from "../../src/app.js";
import { hashPassword } from "../../src/auth/password.js";
import type { Prisma } from "../../src/generated/prisma/client.js";
import { prisma } from "../../src/prisma.js";
import type { SignedInUser } from "../lab-03/support/signIn.js";
import { signInAs } from "../lab-03/support/signIn.js";

/**
 * PERF-01 to PERF-03 — the dashboards and the new queue filters on a large
 * seed (assumption A-06; the trigger for an index, D-22).
 *
 * The seed is about 2,000 Tickets, 5,000 Actions and 6,000 history rows, written
 * straight into the **test** database under a prefix of its own, and removed
 * afterwards by that prefix alone. The bound is the row's: the median of ten
 * requests answers within 500 ms. A median rather than a maximum, because one
 * slow request on a shared machine says nothing about the query.
 */

const PREFIX = "PERF-SEED";
const EMAIL_PREFIX = "perf-seed-";
const PASSWORD = "Performance1!";

const TICKETS = 2000;
const ACTIONS = 5000;
const HISTORY_PER_TICKET = 3;
const REQUESTER_TICKETS = 200;
const REQUESTS = 10;
const MEDIAN_BOUND_MS = 500;
const CHUNK = 1000;
const SEED_TIMEOUT_MS = 120_000;
const MEASURE_TIMEOUT_MS = 60_000;
const DAY_MS = 86_400_000;

const STATUSES = [
  "NEW",
  "OPEN",
  "IN_PROGRESS",
  "WAITING_FOR_REQUESTER",
  "RESOLVED",
  "CLOSED",
  "REOPENED",
  "CANCELLED",
] as const;

const ACTION_STATES = ["PLANNED", "DONE", "CANCELLED"] as const;

let staff: SignedInUser;
let requester: SignedInUser;
let heavyRequester: SignedInUser;

const chunked = <T>(rows: T[]): T[][] => {
  const parts: T[][] = [];

  for (let start = 0; start < rows.length; start += CHUNK) {
    parts.push(rows.slice(start, start + CHUNK));
  }

  return parts;
};

const removeSeed = async () => {
  // Actions and history cascade with their Ticket.
  await prisma.ticket.deleteMany({
    where: { ticketNumber: { startsWith: `TKT-${PREFIX}-` } },
  });
  await prisma.user.deleteMany({
    where: { email: { startsWith: EMAIL_PREFIX } },
  });
};

const seedLargeSet = async () => {
  const [category, system, staffRow, requesterRow] = await Promise.all([
    prisma.category.findFirstOrThrow({ where: { isActive: true } }),
    prisma.relatedSystem.findFirstOrThrow({ where: { isActive: true } }),
    prisma.user.findUniqueOrThrow({ where: { email: ACTIVE_STAFF.email } }),
    prisma.user.findUniqueOrThrow({ where: { email: ACTIVE_REQUESTER.email } }),
  ]);

  const heavy = await prisma.user.create({
    data: {
      email: `${EMAIL_PREFIX}requester@example.test`,
      name: `${PREFIX} requester`,
      role: "REQUESTER",
      passwordHash: await hashPassword(PASSWORD),
    },
  });

  heavyRequester = await signInAs({
    email: heavy.email,
    password: PASSWORD,
  });

  const now = Date.now();
  const tickets: Prisma.TicketCreateManyInput[] = [];

  for (let index = 0; index < TICKETS; index += 1) {
    tickets.push({
      ticketNumber: `TKT-${PREFIX}-${String(index).padStart(5, "0")}`,
      requesterId: index < REQUESTER_TICKETS ? heavy.id : requesterRow.id,
      categoryId: category.id,
      relatedSystemId: system.id,
      summary: `${PREFIX} ticket ${index}`,
      description: "Large seed for the performance-smoke tests.",
      requestedPriority: "MEDIUM",
      currentStatus: STATUSES[index % STATUSES.length] ?? "NEW",
      ticketOwnerId: index % 3 === 0 ? null : staffRow.id,
      createdAt: new Date(now - (index % 30) * DAY_MS),
    });
  }

  for (const part of chunked(tickets)) {
    // oxlint-disable-next-line no-await-in-loop
    await prisma.ticket.createMany({ data: part });
  }

  const seeded = await prisma.ticket.findMany({
    where: { ticketNumber: { startsWith: `TKT-${PREFIX}-` } },
    select: { id: true, currentStatus: true, createdAt: true },
    orderBy: { id: "asc" },
  });

  const actions: Prisma.ActionTakenCreateManyInput[] = [];

  for (let index = 0; index < ACTIONS; index += 1) {
    const ticket = seeded[index % seeded.length];

    if (!ticket) {
      throw new Error("The large seed has no Tickets to attach Actions to.");
    }

    const state = ACTION_STATES[index % ACTION_STATES.length] ?? "PLANNED";

    actions.push({
      ticketId: ticket.id,
      recordedById: staffRow.id,
      performedById: staffRow.id,
      actionAt: new Date(now - (index % 20) * DAY_MS),
      description: `${PREFIX} action ${index}`,
      result: state === "DONE" ? "Done." : null,
      state,
      // Every fourth Action asks for follow-up, so `followUp=mine` has a
      // realistic share of Tickets to find.
      followUpRequired: index % 4 === 0,
      followUpNote: index % 4 === 0 ? "Check again." : null,
      requestId: randomUUID(),
    });
  }

  for (const part of chunked(actions)) {
    // oxlint-disable-next-line no-await-in-loop
    await prisma.actionTaken.createMany({ data: part });
  }

  const history: Prisma.TicketStatusChangeCreateManyInput[] = [];

  for (const ticket of seeded) {
    let from: (typeof STATUSES)[number] | null = null;

    for (let step = 0; step < HISTORY_PER_TICKET; step += 1) {
      const to: (typeof STATUSES)[number] =
        step === HISTORY_PER_TICKET - 1
          ? ticket.currentStatus
          : (STATUSES[step] ?? "NEW");

      history.push({
        ticketId: ticket.id,
        fromStatus: from,
        toStatus: to,
        changedById: step === 0 ? null : staffRow.id,
        changedAt: new Date(ticket.createdAt.getTime() + step * 3_600_000),
      });
      from = to;
    }
  }

  for (const part of chunked(history)) {
    // oxlint-disable-next-line no-await-in-loop
    await prisma.ticketStatusChange.createMany({ data: part });
  }
};

beforeAll(async () => {
  await removeSeed();

  [staff, requester] = await Promise.all([
    signInAs(ACTIVE_STAFF),
    signInAs(ACTIVE_REQUESTER),
  ]);

  await seedLargeSet();
}, SEED_TIMEOUT_MS);

afterAll(async () => {
  await removeSeed();
  await prisma.$disconnect();
});

/** The median of `REQUESTS` sequential calls, in milliseconds. */
const medianOf = async (
  path: string,
  who: SignedInUser
): Promise<{ median: number; status: number }> => {
  const times: number[] = [];
  let status = 0;

  for (let call = 0; call < REQUESTS; call += 1) {
    const started = performance.now();

    // oxlint-disable-next-line no-await-in-loop
    const answer = await request(app).get(path).set("Cookie", who.cookie);

    times.push(performance.now() - started);
    ({ status } = answer);
  }

  times.sort((a, b) => a - b);

  const middle = REQUESTS / 2;

  return {
    median: ((times[middle - 1] ?? 0) + (times[middle] ?? 0)) / 2,
    status,
  };
};

describe("the seed is the size the plan states", () => {
  it("holds about 2,000 Tickets, 5,000 Actions and 6,000 history rows of its own", async () => {
    const [tickets, actions, history, heavy] = await Promise.all([
      prisma.ticket.count({ where: { summary: { startsWith: PREFIX } } }),
      prisma.actionTaken.count({
        where: { description: { startsWith: PREFIX } },
      }),
      prisma.ticketStatusChange.count({
        where: { ticket: { summary: { startsWith: PREFIX } } },
      }),
      prisma.ticket.count({
        where: { requesterId: heavyRequester.id },
      }),
    ]);

    expect(tickets).toBe(TICKETS);
    expect(actions).toBe(ACTIONS);
    expect(history).toBe(TICKETS * HISTORY_PER_TICKET);
    expect(heavy).toBe(REQUESTER_TICKETS);
  });
});

describe("PERF-01 the staff dashboard on a large seed", () => {
  it(
    `answers 200 with a median of ten requests within ${MEDIAN_BOUND_MS} ms`,
    async () => {
      const { median, status } = await medianOf("/api/dashboard/staff", staff);

      expect(status).toBe(200);
      expect(median).toBeLessThanOrEqual(MEDIAN_BOUND_MS);
    },
    MEASURE_TIMEOUT_MS
  );
});

describe("PERF-02 the Requester dashboard on a large seed", () => {
  it(
    `answers 200 for a Requester holding ${REQUESTER_TICKETS} Tickets with a median within ${MEDIAN_BOUND_MS} ms`,
    async () => {
      const { median, status } = await medianOf(
        "/api/dashboard/requester",
        heavyRequester
      );

      expect(status).toBe(200);
      expect(median).toBeLessThanOrEqual(MEDIAN_BOUND_MS);
    },
    MEASURE_TIMEOUT_MS
  );

  it(
    "also holds for the Requester who owns the rest of the seed",
    async () => {
      const { median, status } = await medianOf(
        "/api/dashboard/requester",
        requester
      );

      expect(status).toBe(200);
      expect(median).toBeLessThanOrEqual(MEDIAN_BOUND_MS);
    },
    MEASURE_TIMEOUT_MS
  );
});

describe("PERF-03 the queue with the new filters", () => {
  it(
    `statusGroup=open and followUp=mine each answer 200 with a median within ${MEDIAN_BOUND_MS} ms`,
    async () => {
      const open = await medianOf("/api/staff/tickets?statusGroup=open", staff);
      const mine = await medianOf("/api/staff/tickets?followUp=mine", staff);
      const both = await medianOf(
        "/api/staff/tickets?statusGroup=open&followUp=mine",
        staff
      );

      for (const measured of [open, mine, both]) {
        expect(measured.status).toBe(200);
        expect(measured.median).toBeLessThanOrEqual(MEDIAN_BOUND_MS);
      }
    },
    MEASURE_TIMEOUT_MS
  );

  it(
    "My Tickets with statusGroup=open answers within the same bound for the heavy Requester",
    async () => {
      const { median, status } = await medianOf(
        "/api/tickets?statusGroup=open",
        heavyRequester
      );

      expect(status).toBe(200);
      expect(median).toBeLessThanOrEqual(MEDIAN_BOUND_MS);
    },
    MEASURE_TIMEOUT_MS
  );
});
