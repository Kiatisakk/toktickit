// Fixtures are created one after another on purpose: ids then rise in creation
// order, which the ordering assertions rely on.
/* oxlint-disable no-await-in-loop */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  ACTIVE_STAFF,
  accountByEmail,
  ADMINISTRATOR,
} from "../../prisma/accounts.js";
import {
  DEMO_TICKET_PREFIX,
  seedDashboardDemo,
} from "../../prisma/dashboardDemo.js";
import { prisma } from "../../src/prisma.js";
import type { SignedInUser } from "../lab-03/support/signIn.js";
import { signInAs } from "../lab-03/support/signIn.js";
import { freezeClock, getJson, NOW, settles } from "./support/dashboard.js";

/**
 * MIG-06 — the demonstration seed is idempotent and broad (specification.md
 * section 7 "Seed", BR-33, AC-37).
 *
 * Runs against the test database with a fixed `now`, so every figure below is
 * exact and independent of the date the suite runs. Only Tickets numbered
 * `TKT-DEMO-L4-*` are ever deleted.
 */

const SECOND_STAFF = accountByEmail("sarah.johnson@example.ac.th");
const DEMO_SEARCH = "Demo:";
const ALL_STATUSES = [
  "NEW",
  "OPEN",
  "IN_PROGRESS",
  "WAITING_FOR_REQUESTER",
  "RESOLVED",
  "CLOSED",
  "REOPENED",
  "CANCELLED",
];

let michael: SignedInUser;
let sarah: SignedInUser;
let admin: SignedInUser;

const removeDemo = () =>
  prisma.ticket.deleteMany({
    where: { ticketNumber: { startsWith: DEMO_TICKET_PREFIX } },
  });

const demoTickets = () =>
  prisma.ticket.findMany({
    where: { ticketNumber: { startsWith: DEMO_TICKET_PREFIX } },
    orderBy: { ticketNumber: "asc" },
    select: {
      id: true,
      ticketNumber: true,
      currentStatus: true,
      ticketOwnerId: true,
      _count: { select: { actions: true, statusHistory: true } },
    },
  });

const counts = async () => ({
  tickets: await prisma.ticket.count({
    where: { ticketNumber: { startsWith: DEMO_TICKET_PREFIX } },
  }),
  actions: await prisma.actionTaken.count({
    where: { ticket: { ticketNumber: { startsWith: DEMO_TICKET_PREFIX } } },
  }),
  history: await prisma.ticketStatusChange.count({
    where: { ticket: { ticketNumber: { startsWith: DEMO_TICKET_PREFIX } } },
  }),
});

const queueIds = async (who: SignedInUser, query: string) => {
  const response = await getJson(
    who,
    `/api/staff/tickets?search=${encodeURIComponent(DEMO_SEARCH)}&pageSize=50${query}`
  );

  expect(response.status).toBe(200);

  return (response.body.data as { ticketNumber: string }[])
    .map((row) => row.ticketNumber.slice(DEMO_TICKET_PREFIX.length))
    .toSorted();
};

beforeAll(async () => {
  await removeDemo();
  michael = await signInAs(ACTIVE_STAFF);
  sarah = await signInAs(SECOND_STAFF);
  admin = await signInAs(ADMINISTRATOR);
});

beforeEach(async () => {
  freezeClock();
  await removeDemo();
});

afterAll(async () => {
  await removeDemo();
});

describe("MIG-06 idempotence", () => {
  it("leaves identical counts and the same rows after a second run", async () => {
    const first = await seedDashboardDemo(prisma, NOW);
    const afterFirst = await counts();
    const ticketsFirst = await demoTickets();
    const idsFirst = ticketsFirst.map((t) => t.id);

    const second = await seedDashboardDemo(prisma, NOW);
    const afterSecond = await counts();
    const ticketsSecond = await demoTickets();
    const idsSecond = ticketsSecond.map((t) => t.id);

    expect(first.ticketsCreated).toBe(12);
    expect(afterFirst).toEqual({ tickets: 12, actions: 8, history: 31 });
    expect(second).toEqual({
      ticketsCreated: 0,
      actionsCreated: 0,
      historyCreated: 0,
    });
    expect(afterSecond).toEqual(afterFirst);
    expect(idsSecond).toEqual(idsFirst);
  });

  it("does not duplicate a Ticket, Action or history row on a third run either", async () => {
    await seedDashboardDemo(prisma, NOW);
    await seedDashboardDemo(prisma, NOW);
    await seedDashboardDemo(prisma, new Date(NOW.getTime() + 86_400_000));

    expect(await counts()).toEqual({ tickets: 12, actions: 8, history: 31 });
  });

  it("restores a deleted demonstration Ticket without touching the others", async () => {
    await seedDashboardDemo(prisma, NOW);

    const [victim] = await demoTickets();

    await prisma.ticket.delete({ where: { id: victim?.id ?? 0 } });

    const again = await seedDashboardDemo(prisma, NOW);

    expect(again.ticketsCreated).toBe(1);
    const after = await counts();

    expect(after.tickets).toBe(12);
  });

  it("leaves work done on a demonstration Ticket alone", async () => {
    await seedDashboardDemo(prisma, NOW);

    const [target] = await demoTickets();

    await prisma.ticket.update({
      where: { id: target?.id ?? 0 },
      data: { currentStatus: "CANCELLED" },
    });
    await seedDashboardDemo(prisma, NOW);

    const found = await prisma.ticket.findUniqueOrThrow({
      where: { id: target?.id ?? 0 },
      select: { currentStatus: true },
    });

    expect(found.currentStatus).toBe("CANCELLED");
  });
});

describe("MIG-06 breadth", () => {
  it("holds every status, assigned and unassigned Tickets, and zero, one and several Actions", async () => {
    await seedDashboardDemo(prisma, NOW);

    const tickets = await demoTickets();
    const actionCounts = new Set(tickets.map((t) => t._count.actions));

    expect(new Set(tickets.map((t) => t.currentStatus))).toEqual(
      new Set(ALL_STATUSES)
    );
    expect(tickets.some((t) => t.ticketOwnerId === null)).toBe(true);
    expect(tickets.some((t) => t.ticketOwnerId !== null)).toBe(true);
    expect(actionCounts.has(0)).toBe(true);
    expect(actionCounts.has(1)).toBe(true);
    expect([...actionCounts].some((n) => n > 1)).toBe(true);
  });

  it("holds Planned, Done and Cancelled Actions, performers who are not the owner, and an open and a closed follow-up", async () => {
    await seedDashboardDemo(prisma, NOW);

    const actions = await prisma.actionTaken.findMany({
      where: { ticket: { ticketNumber: { startsWith: DEMO_TICKET_PREFIX } } },
      select: {
        id: true,
        state: true,
        followUpRequired: true,
        performedById: true,
        ticket: { select: { ticketOwnerId: true } },
        followedBy: { select: { state: true } },
      },
    });

    expect(new Set(actions.map((a) => a.state))).toEqual(
      new Set(["PLANNED", "DONE", "CANCELLED"])
    );
    expect(
      actions.some((a) => a.performedById !== a.ticket.ticketOwnerId)
    ).toBe(true);

    const required = actions.filter((a) => a.followUpRequired);
    const closed = required.filter((a) =>
      a.followedBy.some((f) => f.state === "DONE")
    );
    const open = required.filter(
      (a) =>
        a.state !== "CANCELLED" && !a.followedBy.some((f) => f.state === "DONE")
    );

    expect(closed).toHaveLength(1);
    expect(open).toHaveLength(2);
  });

  it("holds a Resolved Ticket that satisfied the gate", async () => {
    await seedDashboardDemo(prisma, NOW);

    const resolved = await prisma.ticket.findFirstOrThrow({
      where: {
        ticketNumber: { startsWith: DEMO_TICKET_PREFIX },
        currentStatus: "RESOLVED",
      },
      select: {
        resolutionSummary: true,
        actions: { select: { state: true, followUpRequired: true } },
      },
    });

    expect(resolved.resolutionSummary).toBeTruthy();
    expect(resolved.actions.some((a) => a.state === "DONE")).toBe(true);
    expect(resolved.actions.some((a) => a.state === "PLANNED")).toBe(false);
    expect(resolved.actions.some((a) => a.followUpRequired)).toBe(false);
  });

  it("never leaves a Resolved or Closed Ticket with an open follow-up", async () => {
    await seedDashboardDemo(prisma, NOW);

    const ended = await prisma.actionTaken.count({
      where: {
        ticket: {
          ticketNumber: { startsWith: DEMO_TICKET_PREFIX },
          currentStatus: { in: ["RESOLVED", "CLOSED", "CANCELLED"] },
        },
        followUpRequired: true,
        state: { not: "CANCELLED" },
        followedBy: { none: { state: "DONE" } },
      },
    });

    expect(ended).toBe(0);
  });
});

describe("MIG-06 metrics", () => {
  it("shows non-zero metrics for staff who own work and zeros for one who owns none", async () => {
    await seedDashboardDemo(prisma, NOW);

    // Michael owns 03 (Open), 05, 06 (In Progress), 08 (Waiting) in the open
    // group, and has an open follow-up on 06. Sarah owns 04, 07, 09 and has the
    // open follow-up on 09. The Administrator owns nothing.
    expect(
      await queueIds(michael, `&ownerId=${michael.id}&statusGroup=open`)
    ).toEqual(["03", "05", "06", "08"]);
    expect(await queueIds(michael, "&followUp=mine")).toEqual(["06"]);
    expect(await queueIds(sarah, "&followUp=mine")).toEqual(["09"]);
    expect(
      await queueIds(admin, `&ownerId=${admin.id}&statusGroup=open`)
    ).toEqual([]);
    expect(await queueIds(admin, "&followUp=mine")).toEqual([]);
    expect(
      await queueIds(michael, "&unassigned=true&statusGroup=open")
    ).toEqual(["01", "02"]);

    const adminView = await getJson(admin, "/api/dashboard/staff");

    expect(adminView.status).toBe(200);

    const mine = (
      adminView.body.cards as { key: string; count: number }[]
    ).filter((c) => ["my-assigned", "my-follow-ups"].includes(c.key));

    expect(mine.map((c) => c.count)).toEqual([0, 0]);
  });

  it("shows non-zero deltas on the day it is run, both signs of the boundary", async () => {
    const delta = async (
      key: string
    ): Promise<{ count: number; delta: number }> => {
      const response = await getJson(michael, "/api/dashboard/staff");
      const found = (
        response.body.cards as { key: string; count: number; delta: number }[]
      ).find((c) => c.key === key);

      return { count: found?.count ?? 0, delta: found?.delta ?? 0 };
    };

    await settles(async () => {
      await removeDemo();

      const keys = ["new", "open", "in-progress", "waiting", "reopened"];
      const base = new Map<string, { count: number; delta: number }>();

      for (const key of keys) {
        base.set(key, await delta(key));
      }

      await seedDashboardDemo(prisma, NOW);

      const change = async (key: string) => {
        const now = await delta(key);
        const was = base.get(key) ?? { count: 0, delta: 0 };

        return {
          count: now.count - was.count,
          delta: now.delta - was.delta,
        };
      };

      // At midnight 02 and 04 were New, 03 and 06 Open, 05 and 07 In Progress,
      // 08 Waiting and 09 Resolved; 01 did not exist. Since then 01 was raised,
      // 04 was opened, 06 started and 09 reopened. So New (+1 raised, -1
      // opened) and Open (+1 opened, -1 started) net to no change, In Progress
      // gains 06, Reopened gains 09, and 08 has not moved.
      expect(await change("new")).toEqual({ count: 2, delta: 0 });
      expect(await change("open")).toEqual({ count: 2, delta: 0 });
      expect(await change("in-progress")).toEqual({ count: 3, delta: 1 });
      expect(await change("waiting")).toEqual({ count: 1, delta: 0 });
      expect(await change("reopened")).toEqual({ count: 1, delta: 1 });
    });
  });
});
