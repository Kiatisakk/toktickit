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

import { app } from "../../src/app.js";
import type { SignedInUser } from "../lab-03/support/signIn.js";
import type { TicketStatusName } from "./support/actions.js";
import {
  drillDownUrl,
  fixtures,
  freezeClock,
  getJson,
  NOW,
  sqlRequesterCount,
} from "./support/dashboard.js";

/**
 * DASH-09 to DASH-15 — the Requester dashboard (specification.md section 5.2;
 * api-spec.md section 7; AC-02, AC-31 to AC-33).
 */

const PREFIX = "DASH-REQ";
const fx = fixtures(PREFIX);

const CARD_KEYS = ["open", "waiting-for-me", "resolved", "closed"];

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

const OPEN_GROUP: TicketStatusName[] = [
  "NEW",
  "OPEN",
  "IN_PROGRESS",
  "WAITING_FOR_REQUESTER",
  "REOPENED",
];

interface Card {
  key: string;
  count: number;
  delta: number | null;
  drillDown: { path: string; query: Record<string, string> };
}

interface Dashboard {
  generatedAt: string;
  timeZone: string;
  cards: Card[];
  recentTickets: { id: number; currentStatus: string }[];
  quickActions: { key: string; label: string; path: string }[];
}

let alice: SignedInUser;
let bob: SignedInUser;
let nobody: SignedInUser;
let staff: SignedInUser;
let admin: SignedInUser;

const dashboardOf = async (who: SignedInUser): Promise<Dashboard> => {
  const response = await getJson(who, "/api/dashboard/requester");

  expect(response.status).toBe(200);

  return response.body as Dashboard;
};

const countOf = (dashboard: Dashboard, key: string): number =>
  dashboard.cards.find((c) => c.key === key)?.count ?? Number.NaN;

const raiseOneInEveryStatus = async (who: SignedInUser) => {
  for (const status of ALL_STATUSES) {
    await fx.makeTicket({ requesterId: who.id, status });
  }
};

beforeAll(async () => {
  await fx.cleanUp();
  alice = await fx.makeUser("REQUESTER", "alice");
  bob = await fx.makeUser("REQUESTER", "bob");
  nobody = await fx.makeUser("REQUESTER", "nobody");
  staff = await fx.makeUser("IT_STAFF", "staff");
  admin = await fx.makeUser("ADMIN", "admin");
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

describe("DASH-09 a Requester sees only their own", () => {
  it("counts and lists only the caller's Tickets, equal to direct SQL", async () => {
    await raiseOneInEveryStatus(alice);
    // Bob has three Open and two Resolved: none may reach Alice's numbers.
    for (const status of [
      "OPEN",
      "OPEN",
      "OPEN",
      "RESOLVED",
      "RESOLVED",
    ] as const) {
      await fx.makeTicket({ requesterId: bob.id, status });
    }

    const aliceView = await dashboardOf(alice);
    const bobView = await dashboardOf(bob);

    expect(countOf(aliceView, "open")).toBe(
      await sqlRequesterCount(alice.id, OPEN_GROUP)
    );
    expect(countOf(aliceView, "resolved")).toBe(
      await sqlRequesterCount(alice.id, ["RESOLVED"])
    );
    expect(countOf(bobView, "open")).toBe(3);
    expect(countOf(bobView, "resolved")).toBe(2);
    expect(countOf(aliceView, "open")).toBe(5);

    const aliceIds = new Set(aliceView.recentTickets.map((t) => t.id));

    for (const row of bobView.recentTickets) {
      expect(aliceIds.has(row.id)).toBe(false);
    }
  });
});

describe("DASH-10 card definitions", () => {
  it("counts New, Open, In Progress, Waiting and Reopened as Open, and Cancelled nowhere", async () => {
    await raiseOneInEveryStatus(alice);
    // A second of each non-open status, to tell "one of each" from "any".
    await fx.makeTicket({ requesterId: alice.id, status: "CANCELLED" });
    await fx.makeTicket({ requesterId: alice.id, status: "REOPENED" });

    const dashboard = await dashboardOf(alice);

    expect(dashboard.cards.map((c) => c.key)).toEqual(CARD_KEYS);
    expect(countOf(dashboard, "open")).toBe(6);
    expect(countOf(dashboard, "waiting-for-me")).toBe(1);
    expect(countOf(dashboard, "resolved")).toBe(1);
    expect(countOf(dashboard, "closed")).toBe(1);

    const total = ["open", "resolved", "closed"].reduce(
      (sum, key) => sum + countOf(dashboard, key),
      0
    );

    // Eight Tickets of every status plus two more = ten; Cancelled (two) are in
    // no card, and Waiting is inside Open as well as having its own card.
    expect(total).toBe(8);
  });

  it("has no deltas", async () => {
    await fx.makeTicket({ requesterId: alice.id, status: "OPEN" });

    const dashboard = await dashboardOf(alice);

    for (const c of dashboard.cards) {
      expect(c.delta, c.key).toBeNull();
    }
  });

  it("names the specified drill-downs on My Tickets", async () => {
    const dashboard = await dashboardOf(alice);

    expect(dashboard.cards.map((c) => c.drillDown)).toEqual([
      { path: "/my-tickets", query: { statusGroup: "open" } },
      { path: "/my-tickets", query: { status: "WAITING_FOR_REQUESTER" } },
      { path: "/my-tickets", query: { status: "RESOLVED" } },
      { path: "/my-tickets", query: { status: "CLOSED" } },
    ]);
    expect(dashboard.quickActions).toEqual([
      { key: "create-ticket", label: "Create Ticket", path: "/tickets/new" },
      { key: "my-tickets", label: "View My Tickets", path: "/my-tickets" },
    ]);
  });
});

describe("DASH-11 zero state", () => {
  it("keeps four linked cards at 0 with an empty recent list", async () => {
    const dashboard = await dashboardOf(nobody);

    expect(dashboard.cards.map((c) => c.key)).toEqual(CARD_KEYS);

    for (const c of dashboard.cards) {
      expect(c.count, c.key).toBe(0);
      expect(c.drillDown.path, c.key).toBe("/my-tickets");
    }

    expect(dashboard.recentTickets).toEqual([]);
  });
});

describe("DASH-12 recent Tickets", () => {
  it("lists the caller's own, at most five, newest-updated first", async () => {
    const ids: number[] = [];

    for (const minutes of [50, 10, 40, 20, 30, 5, 60]) {
      ids.push(
        await fx.makeTicket({
          requesterId: alice.id,
          status: "OPEN",
          updatedAt: new Date(NOW.getTime() - minutes * 60_000),
        })
      );
    }

    await fx.makeTicket({
      requesterId: bob.id,
      status: "OPEN",
      updatedAt: new Date(NOW.getTime() - 60_000),
    });

    const dashboard = await dashboardOf(alice);

    // 5, 10, 20, 30, 40 minutes ago.
    expect(dashboard.recentTickets.map((t) => t.id)).toEqual([
      ids[5],
      ids[1],
      ids[3],
      ids[4],
      ids[2],
    ]);
  });
});

describe("DASH-13 drill-downs agree with counts", () => {
  it("lists in My Tickets exactly what each card counted", async () => {
    await raiseOneInEveryStatus(alice);
    await fx.makeTicket({ requesterId: alice.id, status: "REOPENED" });
    await fx.makeTicket({ requesterId: alice.id, status: "RESOLVED" });
    await fx.makeTicket({ requesterId: bob.id, status: "RESOLVED" });

    const dashboard = await dashboardOf(alice);

    for (const c of dashboard.cards) {
      const listed = await getJson(alice, drillDownUrl(c.drillDown));

      expect(listed.status, c.key).toBe(200);
      expect(listed.body.meta.totalItems, c.key).toBe(c.count);
    }

    expect(countOf(dashboard, "resolved")).toBe(2);
  });
});

describe("DASH-14 roles", () => {
  it("refuses IT Staff and Administrator with 403 and no session with 401", async () => {
    for (const who of [staff, admin]) {
      const response = await getJson(who, "/api/dashboard/requester");

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe("FORBIDDEN");
    }

    const anonymous = await request(app).get("/api/dashboard/requester");

    expect(anonymous.status).toBe(401);
  });
});

describe("DASH-15 no identity from the caller", () => {
  it("refuses a requesterId, a userId or any other parameter on either dashboard", async () => {
    const cases: [SignedInUser, string][] = [
      [alice, `/api/dashboard/requester?requesterId=${bob.id}`],
      [alice, `/api/dashboard/requester?userId=${bob.id}`],
      [alice, "/api/dashboard/requester?anything=1"],
      [staff, `/api/dashboard/staff?userId=${admin.id}`],
      [staff, "/api/dashboard/staff?ownerId=1"],
    ];

    for (const [who, url] of cases) {
      const response = await getJson(who, url);

      expect(response.status, url).toBe(400);
      expect(response.body.error.code, url).toBe("INVALID_QUERY_PARAMETER");
      expect(Object.keys(response.body.error.details).length, url).toBe(1);
    }
  });

  it("ignores a header or body naming someone else", async () => {
    await fx.makeTicket({ requesterId: bob.id, status: "OPEN" });

    const response = await request(app)
      .get("/api/dashboard/requester")
      .set("Cookie", alice.cookie)
      .set("X-Requester-Id", String(bob.id));

    expect(response.status).toBe(200);
    expect(countOf(response.body as Dashboard, "open")).toBe(0);
  });
});
