// Fixtures are created one after another on purpose: ids then rise in creation
// order, which the ordering and tie-break assertions rely on.
/* oxlint-disable no-await-in-loop */
import request from "supertest";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";

import { ACTIVE_REQUESTER, ACTIVE_STAFF } from "../../prisma/accounts.js";
import { app } from "../../src/app.js";
import type { SignedInUser } from "../lab-03/support/signIn.js";
import { signInAs } from "../lab-03/support/signIn.js";
import type { TicketStatusName } from "./support/actions.js";
import {
  as,
  drillDownUrl,
  fixtures,
  freezeClock,
  getJson,
  justBefore,
  NOW,
  sqlCountAsAt,
  sqlCountByStatus,
  sqlOpenFollowUpTickets,
  sqlOpenOwnedBy,
  sqlOpenUnassigned,
  T0,
} from "./support/dashboard.js";

/**
 * DASH-01 to DASH-08 — the staff dashboard (specification.md section 5.2;
 * api-spec.md section 7; AC-28 to AC-32).
 *
 * The clock is fixed at 10:20 on 5 October 2026 in Bangkok, so T0 is
 * 2026-10-04T17:00:00Z and no assertion depends on the date the suite runs.
 * Fixtures carry the prefix below and nothing else is deleted.
 */

const PREFIX = "DASH-STAFF";
const fx = fixtures(PREFIX);

const STATUS_CARD_KEYS = [
  ["new", "NEW"],
  ["open", "OPEN"],
  ["in-progress", "IN_PROGRESS"],
  ["waiting", "WAITING_FOR_REQUESTER"],
  ["reopened", "REOPENED"],
] as const;

const CARD_KEYS = [
  "new",
  "open",
  "in-progress",
  "waiting",
  "reopened",
  "my-assigned",
  "unassigned",
  "my-follow-ups",
];

const ALL_STATUSES: TicketStatusName[] = [
  "NEW",
  "OPEN",
  "IN_PROGRESS",
  "WAITING_FOR_REQUESTER",
  "RESOLVED",
  "CLOSED",
  "REOPENED",
  "CANCELLED",
];

interface Card {
  key: string;
  label: string;
  count: number;
  delta: number | null;
  drillDown: { path: string; query: Record<string, string> };
}

interface Recent {
  id: number;
  ticketNumber: string;
  summary: string;
  currentStatus: string;
  updatedAt: string;
}

interface Dashboard {
  generatedAt: string;
  timeZone: string;
  cards: Card[];
  recentTickets: Recent[];
  quickActions: { key: string; path: string; query?: Record<string, string> }[];
}

let me: SignedInUser;
let colleague: SignedInUser;
let admin: SignedInUser;
let requester: SignedInUser;
let seededRequester: SignedInUser;
let seededStaff: SignedInUser;

const MINUTE_MS = 60_000;

const stamp = (minutes: number): Date =>
  new Date(NOW.getTime() - minutes * MINUTE_MS);

const dashboardOf = async (who: SignedInUser): Promise<Dashboard> => {
  const response = await getJson(who, "/api/dashboard/staff");

  expect(response.status).toBe(200);

  return response.body as Dashboard;
};

const card = (dashboard: Dashboard, key: string): Card => {
  const found = dashboard.cards.find((c) => c.key === key);

  if (!found) {
    throw new Error(`No card ${key}.`);
  }

  return found;
};

beforeAll(async () => {
  await fx.cleanUp();
  me = await fx.makeUser("IT_STAFF", "me");
  colleague = await fx.makeUser("IT_STAFF", "colleague");
  admin = await fx.makeUser("ADMIN", "admin");
  requester = await fx.makeUser("REQUESTER", "requester");
  seededRequester = await signInAs(ACTIVE_REQUESTER);
  seededStaff = await signInAs(ACTIVE_STAFF);
});

afterAll(async () => {
  await fx.cleanUp();
});

beforeEach(() => {
  freezeClock();
});

afterEach(async () => {
  await fx.cleanTickets();
});

describe("DASH-01 counts equal direct SQL", () => {
  it("matches a separately written SQL count for every card", async () => {
    // Every status, owned by me, by a colleague and by nobody, so each
    // ownership card has a non-trivial answer.
    for (const status of ALL_STATUSES) {
      await fx.makeTicket({
        requesterId: requester.id,
        status,
        ownerId: me.id,
      });
      await fx.makeTicket({
        requesterId: requester.id,
        status,
        ownerId: colleague.id,
      });
      await fx.makeTicket({ requesterId: requester.id, status });
    }

    // Follow-ups: one open, one closed by a Done follower, one whose follower
    // is only Planned (still open), one Cancelled (void), one not required, and
    // two open follow-ups on the same Ticket (counted once).
    const open = await fx.makeTicket({
      requesterId: requester.id,
      status: "IN_PROGRESS",
    });
    const closed = await fx.makeTicket({
      requesterId: requester.id,
      status: "IN_PROGRESS",
    });
    const plannedFollower = await fx.makeTicket({
      requesterId: requester.id,
      status: "IN_PROGRESS",
    });
    const voided = await fx.makeTicket({
      requesterId: requester.id,
      status: "IN_PROGRESS",
    });
    const notRequired = await fx.makeTicket({
      requesterId: requester.id,
      status: "IN_PROGRESS",
    });
    const twice = await fx.makeTicket({
      requesterId: requester.id,
      status: "IN_PROGRESS",
    });
    const theirs = await fx.makeTicket({
      requesterId: requester.id,
      status: "IN_PROGRESS",
    });

    await fx.makeAction({
      ticketId: open,
      performedById: me.id,
      followUpRequired: true,
    });
    const toClose = await fx.makeAction({
      ticketId: closed,
      performedById: me.id,
      followUpRequired: true,
    });
    await fx.makeAction({
      ticketId: closed,
      performedById: me.id,
      state: "DONE",
      followsUpId: toClose,
    });
    const toPlan = await fx.makeAction({
      ticketId: plannedFollower,
      performedById: me.id,
      followUpRequired: true,
    });
    await fx.makeAction({
      ticketId: plannedFollower,
      performedById: me.id,
      state: "PLANNED",
      followsUpId: toPlan,
    });
    await fx.makeAction({
      ticketId: voided,
      performedById: me.id,
      state: "CANCELLED",
      followUpRequired: true,
    });
    await fx.makeAction({ ticketId: notRequired, performedById: me.id });
    await fx.makeAction({
      ticketId: twice,
      performedById: me.id,
      followUpRequired: true,
    });
    await fx.makeAction({
      ticketId: twice,
      performedById: me.id,
      followUpRequired: true,
    });
    await fx.makeAction({
      ticketId: theirs,
      performedById: colleague.id,
      followUpRequired: true,
    });

    const dashboard = await dashboardOf(me);

    for (const [key, status] of STATUS_CARD_KEYS) {
      expect(card(dashboard, key).count, key).toBe(
        await sqlCountByStatus(status)
      );
    }

    expect(card(dashboard, "my-assigned").count).toBe(
      await sqlOpenOwnedBy(me.id)
    );
    expect(card(dashboard, "unassigned").count).toBe(await sqlOpenUnassigned());
    expect(card(dashboard, "my-follow-ups").count).toBe(
      await sqlOpenFollowUpTickets(me.id)
    );

    // The same SQL, pinned to numbers this suite can state by hand, so that a
    // wrong SQL helper cannot make a wrong endpoint look right.
    // The open group holds five of the eight statuses, and I own one Ticket in
    // each. Of my Actions, the open follow-up, the one with only a Planned
    // follower and the Ticket with two open follow-ups count, once each: three.
    expect(card(dashboard, "my-assigned").count).toBe(5);
    expect(card(dashboard, "my-follow-ups").count).toBe(3);
  });
});

describe("DASH-02 deltas around midnight Bangkok", () => {
  it("measures the change against the status as at T0, either side of the boundary", async () => {
    const before = await dashboardOf(me);

    const FAR_BEFORE = new Date(T0.getTime() - 2 * 24 * 60 * 60 * 1000);
    const HOUR = 60 * 60 * 1000;

    // A: New until the last millisecond before T0, Open from exactly T0.
    // A row AT T0 is not "before T0", so as at T0 it was New.
    await fx.makeTicket({
      requesterId: requester.id,
      status: "OPEN",
      history: [
        { from: null, to: "NEW", at: justBefore(T0) },
        { from: "NEW", to: "OPEN", at: T0 },
      ],
    });
    // B: New until T0, In Progress one millisecond after.
    await fx.makeTicket({
      requesterId: requester.id,
      status: "IN_PROGRESS",
      history: [
        { from: null, to: "NEW", at: justBefore(T0) },
        { from: "NEW", to: "IN_PROGRESS", at: new Date(T0.getTime() + 1) },
      ],
    });
    // C: raised after T0, so it did not exist at T0.
    await fx.makeTicket({
      requesterId: requester.id,
      status: "NEW",
      history: [{ from: null, to: "NEW", at: new Date(NOW.getTime() - HOUR) }],
    });
    // D: waiting since the last millisecond before T0: no change today.
    await fx.makeTicket({
      requesterId: requester.id,
      status: "WAITING_FOR_REQUESTER",
      history: [
        { from: null, to: "NEW", at: FAR_BEFORE },
        { from: "NEW", to: "WAITING_FOR_REQUESTER", at: justBefore(T0) },
      ],
    });
    // E: no history at all, which BR-23 reads as "did not exist at T0".
    await fx.makeTicket({ requesterId: requester.id, status: "OPEN" });

    const after = await dashboardOf(me);

    const changeOf = (key: string, field: "count" | "delta") =>
      (card(after, key)[field] ?? 0) - (card(before, key)[field] ?? 0);

    // Counts: A and E are Open, B In Progress, C New, D Waiting.
    expect(changeOf("new", "count")).toBe(1);
    expect(changeOf("open", "count")).toBe(2);
    expect(changeOf("in-progress", "count")).toBe(1);
    expect(changeOf("waiting", "count")).toBe(1);

    // Deltas: New loses A and B (they were New at T0) and gains C: -1.
    // Open gains A and E: +2. In Progress gains B: +1. Waiting: D was already
    // Waiting at T0, so no change.
    expect(changeOf("new", "delta")).toBe(-1);
    expect(changeOf("open", "delta")).toBe(2);
    expect(changeOf("in-progress", "delta")).toBe(1);
    expect(changeOf("waiting", "delta")).toBe(0);

    // And every status card, whole-database, against an independent SQL
    // formulation of "latest row strictly before T0".
    for (const [key, status] of STATUS_CARD_KEYS) {
      const expected =
        (await sqlCountByStatus(status)) - (await sqlCountAsAt(status, T0));

      expect(card(after, key).delta, key).toBe(expected);
    }
  });

  it("treats the instant of the boundary itself as after it", async () => {
    // One Ticket whose only row sits exactly on T0: it did not exist at T0, so
    // it is a +1 for its own status today. One millisecond earlier it would
    // have been in the as-at count and the delta would be 0.
    const base = await dashboardOf(me);

    await fx.makeTicket({
      requesterId: requester.id,
      status: "REOPENED",
      history: [{ from: null, to: "REOPENED", at: T0 }],
    });
    await fx.makeTicket({
      requesterId: requester.id,
      status: "REOPENED",
      history: [{ from: null, to: "REOPENED", at: justBefore(T0) }],
    });

    const next = await dashboardOf(me);

    expect(card(next, "reopened").count - card(base, "reopened").count).toBe(2);
    expect(
      (card(next, "reopened").delta ?? 0) - (card(base, "reopened").delta ?? 0)
    ).toBe(1);
  });

  it("reports generatedAt from the injected clock and the Bangkok zone", async () => {
    const dashboard = await dashboardOf(me);

    expect(dashboard.generatedAt).toBe(NOW.toISOString());
    expect(dashboard.timeZone).toBe("Asia/Bangkok");
  });
});

describe("DASH-03 zero state", () => {
  it("keeps all eight cards with zero counts and no ownership deltas", async () => {
    const dashboard = await dashboardOf(me);

    expect(dashboard.cards.map((c) => c.key)).toEqual(CARD_KEYS);
    expect(card(dashboard, "my-assigned").count).toBe(0);
    expect(card(dashboard, "my-follow-ups").count).toBe(0);
    expect(card(dashboard, "my-assigned").delta).toBeNull();
    expect(card(dashboard, "unassigned").delta).toBeNull();
    expect(card(dashboard, "my-follow-ups").delta).toBeNull();
    expect(dashboard.recentTickets).toEqual([]);

    for (const c of dashboard.cards) {
      expect(c.drillDown.path).toBe("/staff/tickets");
    }
  });
});

describe("DASH-04 roles", () => {
  it("answers IT Staff and Administrator, each calculated for themselves", async () => {
    await fx.makeTicket({
      requesterId: requester.id,
      status: "OPEN",
      ownerId: admin.id,
    });

    const staffView = await dashboardOf(me);
    const adminView = await dashboardOf(admin);

    expect(card(staffView, "my-assigned").count).toBe(0);
    expect(card(adminView, "my-assigned").count).toBe(1);
    expect(card(adminView, "my-assigned").drillDown.query["ownerId"]).toBe(
      String(admin.id)
    );
  });

  it("refuses a Requester with 403 and a missing session with 401", async () => {
    const refused = await getJson(requester, "/api/dashboard/staff");

    expect(refused.status).toBe(403);
    expect(refused.body.error.code).toBe("FORBIDDEN");

    const anonymous = await request(app).get("/api/dashboard/staff");

    expect(anonymous.status).toBe(401);
  });

  it("refuses any query parameter", async () => {
    const response = await getJson(me, "/api/dashboard/staff?userId=1");

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("INVALID_QUERY_PARAMETER");
    expect(response.body.error.details.userId).toBeDefined();
  });
});

describe("DASH-05 recent Tickets", () => {
  it("lists only the caller's own, at most five, last update first then id descending", async () => {
    const ids: number[] = [];

    // Seven owned by me: updatedAt 1..5 minutes ago, then two older.
    for (const minutes of [1, 2, 3, 4, 5, 60, 90]) {
      ids.push(
        await fx.makeTicket({
          requesterId: requester.id,
          status: "OPEN",
          ownerId: me.id,
          updatedAt: stamp(minutes),
        })
      );
    }

    // Two tied at the same instant: the higher id must come first.
    const tiedLow = await fx.makeTicket({
      requesterId: requester.id,
      status: "OPEN",
      ownerId: me.id,
      updatedAt: stamp(0),
    });
    const tiedHigh = await fx.makeTicket({
      requesterId: requester.id,
      status: "OPEN",
      ownerId: me.id,
      updatedAt: stamp(0),
    });

    // Someone else's very recent Ticket must not appear.
    await fx.makeTicket({
      requesterId: requester.id,
      status: "OPEN",
      ownerId: colleague.id,
      updatedAt: stamp(0),
    });

    const dashboard = await dashboardOf(me);

    expect(dashboard.recentTickets.map((t) => t.id)).toEqual([
      tiedHigh,
      tiedLow,
      ids[0],
      ids[1],
      ids[2],
    ]);
    expect(dashboard.recentTickets).toHaveLength(5);
  });
});

describe("DASH-06 drill-downs agree with counts", () => {
  it("lists exactly what each card counted, for staff and for an Administrator", async () => {
    for (const owner of [me.id, admin.id, colleague.id, null]) {
      for (const status of ALL_STATUSES) {
        await fx.makeTicket({
          requesterId: requester.id,
          status,
          ownerId: owner,
        });
      }
    }

    const followUp = await fx.makeTicket({
      requesterId: requester.id,
      status: "IN_PROGRESS",
      ownerId: colleague.id,
    });

    await fx.makeAction({
      ticketId: followUp,
      performedById: me.id,
      followUpRequired: true,
    });
    await fx.makeAction({
      ticketId: followUp,
      performedById: admin.id,
      followUpRequired: true,
    });

    for (const who of [me, admin]) {
      const dashboard = await dashboardOf(who);

      for (const c of dashboard.cards) {
        const listed = await getJson(who, drillDownUrl(c.drillDown));

        expect(listed.status, c.key).toBe(200);
        expect(listed.body.meta.totalItems, c.key).toBe(c.count);
      }
    }
  });

  it("lists the very Tickets counted, not just as many", async () => {
    const mine = await fx.makeTicket({
      requesterId: requester.id,
      status: "OPEN",
      ownerId: me.id,
    });
    const withFollowUp = await fx.makeTicket({
      requesterId: requester.id,
      status: "IN_PROGRESS",
    });

    await fx.makeAction({
      ticketId: withFollowUp,
      performedById: me.id,
      followUpRequired: true,
    });

    const dashboard = await dashboardOf(me);
    const assigned = await getJson(
      me,
      drillDownUrl(card(dashboard, "my-assigned").drillDown)
    );
    const followUps = await getJson(
      me,
      drillDownUrl(card(dashboard, "my-follow-ups").drillDown)
    );

    expect(assigned.body.data.map((t: { id: number }) => t.id)).toEqual([mine]);
    expect(followUps.body.data.map((t: { id: number }) => t.id)).toEqual([
      withFollowUp,
    ]);
  });
});

describe("DASH-07 card contract", () => {
  it("returns eight cards in a fixed order, with fixed drill-downs and the caller's id", async () => {
    const dashboard = await dashboardOf(me);

    expect(dashboard.cards.map((c) => c.key)).toEqual(CARD_KEYS);
    expect(dashboard.cards.map((c) => c.label)).toEqual([
      "New",
      "Open",
      "In Progress",
      "Waiting for Requester",
      "Reopened",
      "My Assigned",
      "Unassigned",
      "My open follow-ups",
    ]);
    expect(dashboard.cards.map((c) => c.drillDown.query)).toEqual([
      { status: "NEW" },
      { status: "OPEN" },
      { status: "IN_PROGRESS" },
      { status: "WAITING_FOR_REQUESTER" },
      { status: "REOPENED" },
      { ownerId: String(me.id), statusGroup: "open" },
      { unassigned: "true", statusGroup: "open" },
      { followUp: "mine" },
    ]);

    for (const key of ["new", "open", "in-progress", "waiting", "reopened"]) {
      expect(Number.isInteger(card(dashboard, key).delta), key).toBe(true);
    }

    expect(dashboard.quickActions).toEqual([
      { key: "create-ticket", label: "Create Ticket", path: "/tickets/new" },
      {
        key: "search-tickets",
        label: "Search Tickets",
        path: "/staff/tickets",
      },
      {
        key: "my-queue",
        label: "My Queue",
        path: "/staff/tickets",
        query: { ownerId: String(me.id), statusGroup: "open" },
      },
    ]);
  });

  it("serves the same shape to the seeded staff account", async () => {
    const dashboard = await dashboardOf(seededStaff);

    expect(dashboard.cards).toHaveLength(8);
    expect(card(dashboard, "my-assigned").drillDown.query["ownerId"]).toBe(
      String(seededStaff.id)
    );
  });
});

describe("DASH-08 metrics, not collections", () => {
  it("carries only cards, at most five recent rows, quick actions and metadata", async () => {
    for (let n = 0; n < 8; n += 1) {
      await fx.makeTicket({
        requesterId: requester.id,
        status: "OPEN",
        ownerId: me.id,
      });
    }

    const dashboard = await dashboardOf(me);

    expect(Object.keys(dashboard).toSorted()).toEqual([
      "cards",
      "generatedAt",
      "quickActions",
      "recentTickets",
      "timeZone",
    ]);
    expect(dashboard.recentTickets).toHaveLength(5);

    for (const row of dashboard.recentTickets) {
      expect(Object.keys(row).toSorted()).toEqual([
        "currentStatus",
        "id",
        "summary",
        "ticketNumber",
        "updatedAt",
      ]);
    }

    for (const c of dashboard.cards) {
      expect(Object.keys(c).toSorted()).toEqual([
        "count",
        "delta",
        "drillDown",
        "key",
        "label",
      ]);
    }
  });

  it("refuses the seeded Requester as well", async () => {
    const response = await as(seededRequester)(
      request(app).get("/api/dashboard/staff")
    );

    expect(response.status).toBe(403);
  });
});
