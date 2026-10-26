// Fixtures are created one after another on purpose: ids then rise in creation
// order, which the ordering and tie-break assertions rely on.
/* oxlint-disable no-await-in-loop */
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import type { SignedInUser } from "../lab-03/support/signIn.js";
import type { TicketStatusName } from "./support/actions.js";
import { fixtures, getJson } from "./support/dashboard.js";

/**
 * FLT-01 to FLT-05 — `statusGroup` and `followUp` on the two lists
 * (api-spec.md section 6; specification.md BR-29, AC-34).
 *
 * Every request also carries `search=<prefix>`, which narrows the list to this
 * suite's Tickets, so the exact set of ids can be asserted whatever else the
 * shared database holds.
 */

const PREFIX = "FLT-API";
const fx = fixtures(PREFIX);
const PAGE_SIZE_MAX = 50;

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
const OPEN_GROUP = new Set<TicketStatusName>([
  "NEW",
  "OPEN",
  "IN_PROGRESS",
  "WAITING_FOR_REQUESTER",
  "REOPENED",
]);

let alice: SignedInUser;
let bob: SignedInUser;
let me: SignedInUser;
let colleague: SignedInUser;

const idsOf = (response: { body: { data: { id: number }[] } }): number[] =>
  response.body.data.map((row) => row.id);

const queue = (who: SignedInUser, query: string) =>
  getJson(
    who,
    `/api/staff/tickets?search=${encodeURIComponent(PREFIX)}&pageSize=${PAGE_SIZE_MAX}${query}`
  );

const myTickets = (who: SignedInUser, query: string) =>
  getJson(
    who,
    `/api/tickets?search=${encodeURIComponent(PREFIX)}&pageSize=${PAGE_SIZE_MAX}${query}`
  );

const sortedIds = (ids: number[]) => ids.toSorted((a, b) => a - b);

beforeAll(async () => {
  await fx.cleanUp();
  alice = await fx.makeUser("REQUESTER", "alice");
  bob = await fx.makeUser("REQUESTER", "bob");
  me = await fx.makeUser("IT_STAFF", "me");
  colleague = await fx.makeUser("IT_STAFF", "colleague");
});

afterAll(async () => {
  await fx.cleanUp();
});

afterEach(async () => {
  await fx.cleanTickets();
});

describe("FLT-01 statusGroup=open", () => {
  it("returns exactly the open-group Tickets on the queue, Reopened included", async () => {
    const byStatus = new Map<TicketStatusName, number>();

    for (const status of ALL_STATUSES) {
      byStatus.set(
        status,
        await fx.makeTicket({ requesterId: alice.id, status })
      );
    }

    const response = await queue(me, "&statusGroup=open");

    expect(response.status).toBe(200);
    expect(sortedIds(idsOf(response))).toEqual(
      sortedIds(
        ALL_STATUSES.filter((s) => OPEN_GROUP.has(s)).map(
          (s) => byStatus.get(s) ?? 0
        )
      )
    );
    expect(response.body.meta.totalItems).toBe(5);
    expect(idsOf(response)).toContain(byStatus.get("REOPENED"));
  });

  it("returns the caller's own open-group Tickets on My Tickets, and no one else's", async () => {
    const own: number[] = [];

    for (const status of ALL_STATUSES) {
      const id = await fx.makeTicket({ requesterId: alice.id, status });

      if (OPEN_GROUP.has(status)) {
        own.push(id);
      }

      await fx.makeTicket({ requesterId: bob.id, status });
    }

    const response = await myTickets(alice, "&statusGroup=open");

    expect(response.status).toBe(200);
    expect(sortedIds(idsOf(response))).toEqual(sortedIds(own));
  });

  it("works on My Tickets for staff as well, over the Tickets they raised", async () => {
    const raised = await fx.makeTicket({ requesterId: me.id, status: "OPEN" });

    await fx.makeTicket({ requesterId: me.id, status: "CLOSED" });
    await fx.makeTicket({ requesterId: alice.id, status: "OPEN" });

    const response = await myTickets(me, "&statusGroup=open");

    expect(idsOf(response)).toEqual([raised]);
  });
});

describe("FLT-02 statusGroup refusals", () => {
  const refused: [string, string][] = [
    ["with status", "&statusGroup=open&status=NEW"],
    ["with another value", "&statusGroup=closed"],
    ["in capitals", "&statusGroup=OPEN"],
    ["repeated", "&statusGroup=open&statusGroup=open"],
  ];

  it.each(refused)(
    "is 400 INVALID_QUERY_PARAMETER %s, on both lists",
    async (_why, query) => {
      for (const response of [
        await queue(me, query),
        await myTickets(alice, query),
      ]) {
        expect(response.status).toBe(400);
        expect(response.body.error.code).toBe("INVALID_QUERY_PARAMETER");
        expect(response.body.error.details.statusGroup).toBeDefined();
      }
    }
  );

  it("treats a blank value as absent", async () => {
    await fx.makeTicket({ requesterId: alice.id, status: "OPEN" });
    await fx.makeTicket({ requesterId: alice.id, status: "CLOSED" });

    const response = await myTickets(alice, "&statusGroup=");

    expect(response.status).toBe(200);
    expect(response.body.meta.totalItems).toBe(2);
  });
});

describe("FLT-03 followUp=mine", () => {
  it("returns only Tickets with an open follow-up on an Action the caller performed", async () => {
    const open = await fx.makeTicket({ requesterId: alice.id, status: "OPEN" });
    const closed = await fx.makeTicket({
      requesterId: alice.id,
      status: "OPEN",
    });
    const plannedFollower = await fx.makeTicket({
      requesterId: alice.id,
      status: "OPEN",
    });
    const cancelled = await fx.makeTicket({
      requesterId: alice.id,
      status: "OPEN",
    });
    const theirs = await fx.makeTicket({
      requesterId: alice.id,
      status: "OPEN",
    });
    const notRequired = await fx.makeTicket({
      requesterId: alice.id,
      status: "OPEN",
    });
    const mixed = await fx.makeTicket({
      requesterId: alice.id,
      status: "OPEN",
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
      performedById: colleague.id,
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
      ticketId: cancelled,
      performedById: me.id,
      state: "CANCELLED",
      followUpRequired: true,
    });
    await fx.makeAction({
      ticketId: theirs,
      performedById: colleague.id,
      followUpRequired: true,
    });
    await fx.makeAction({ ticketId: notRequired, performedById: me.id });
    // One closed, one open, on the same Ticket: the open one counts.
    const mixedClosed = await fx.makeAction({
      ticketId: mixed,
      performedById: me.id,
      followUpRequired: true,
    });

    await fx.makeAction({
      ticketId: mixed,
      performedById: me.id,
      state: "DONE",
      followsUpId: mixedClosed,
    });
    await fx.makeAction({
      ticketId: mixed,
      performedById: me.id,
      followUpRequired: true,
    });

    const mine = await queue(me, "&followUp=mine");

    expect(mine.status).toBe(200);
    expect(sortedIds(idsOf(mine))).toEqual(
      sortedIds([open, plannedFollower, mixed])
    );
    expect(mine.body.meta.totalItems).toBe(3);

    const hers = await queue(colleague, "&followUp=mine");

    expect(idsOf(hers)).toEqual([theirs]);
  });

  it("composes with statusGroup", async () => {
    const live = await fx.makeTicket({ requesterId: alice.id, status: "OPEN" });
    const done = await fx.makeTicket({
      requesterId: alice.id,
      status: "CLOSED",
    });

    for (const ticketId of [live, done]) {
      await fx.makeAction({
        ticketId,
        performedById: me.id,
        followUpRequired: true,
      });
    }

    expect(idsOf(await queue(me, "&followUp=mine"))).toHaveLength(2);
    expect(idsOf(await queue(me, "&followUp=mine&statusGroup=open"))).toEqual([
      live,
    ]);
  });
});

describe("FLT-04 followUp refusals", () => {
  it("is refused on My Tickets", async () => {
    const response = await myTickets(alice, "&followUp=mine");

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("INVALID_QUERY_PARAMETER");
    expect(response.body.error.details.followUp).toBeDefined();
  });

  it.each(["theirs", "MINE", "true"])(
    "refuses %s on the queue",
    async (value) => {
      const response = await queue(me, `&followUp=${value}`);

      expect(response.status).toBe(400);
      expect(response.body.error.details.followUp).toBeDefined();
    }
  );

  it("refuses an id, so no identity travels in the query", async () => {
    const response = await queue(me, `&followUp=${colleague.id}`);

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("INVALID_QUERY_PARAMETER");
  });

  it("treats a blank value as absent on the queue", async () => {
    await fx.makeTicket({ requesterId: alice.id, status: "OPEN" });

    const response = await queue(me, "&followUp=");

    expect(response.status).toBe(200);
    expect(response.body.meta.totalItems).toBe(1);
  });
});

describe("FLT-05 composition and paging", () => {
  it("combines with ownerId and unassigned", async () => {
    const mineOpen = await fx.makeTicket({
      requesterId: alice.id,
      status: "OPEN",
      ownerId: me.id,
    });

    await fx.makeTicket({
      requesterId: alice.id,
      status: "CLOSED",
      ownerId: me.id,
    });
    await fx.makeTicket({
      requesterId: alice.id,
      status: "OPEN",
      ownerId: colleague.id,
    });

    const free = await fx.makeTicket({ requesterId: alice.id, status: "NEW" });

    await fx.makeTicket({ requesterId: alice.id, status: "RESOLVED" });

    expect(
      idsOf(await queue(me, `&ownerId=${me.id}&statusGroup=open`))
    ).toEqual([mineOpen]);
    expect(idsOf(await queue(me, "&unassigned=true&statusGroup=open"))).toEqual(
      [free]
    );
  });

  it("combines with search and a sort", async () => {
    const first = await fx.makeTicket({
      requesterId: alice.id,
      status: "OPEN",
    });
    const second = await fx.makeTicket({
      requesterId: alice.id,
      status: "OPEN",
    });

    await fx.makeTicket({ requesterId: alice.id, status: "CLOSED" });

    const response = await queue(
      me,
      "&statusGroup=open&sort=createdAt&order=asc"
    );

    expect(idsOf(response)).toEqual([first, second]);
  });

  it("repeats and skips no Ticket across pages", async () => {
    const expected: number[] = [];

    for (let n = 0; n < 25; n += 1) {
      const status = n % 5 === 0 ? "CLOSED" : "OPEN";
      const id = await fx.makeTicket({ requesterId: alice.id, status });

      if (status === "OPEN") {
        expected.push(id);
      }
    }

    const seen: number[] = [];

    for (const page of [1, 2]) {
      const response = await getJson(
        me,
        `/api/staff/tickets?search=${PREFIX}&statusGroup=open&pageSize=10&page=${page}`
      );

      expect(response.body.meta.totalItems).toBe(20);
      seen.push(...idsOf(response));
    }

    expect(seen).toHaveLength(20);
    expect(new Set(seen).size).toBe(20);
    expect(sortedIds(seen)).toEqual(sortedIds(expected));
  });
});
