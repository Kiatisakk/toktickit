import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  ACTIVE_REQUESTER,
  ACTIVE_STAFF,
  ADMINISTRATOR,
  INACTIVE_STAFF,
  SECOND_REQUESTER,
} from "../../prisma/accounts.js";
import { app } from "../../src/app.js";
import { prisma } from "../../src/prisma.js";
import type { SignedInUser } from "./support/signIn.js";
import { signInAs } from "./support/signIn.js";

/**
 * API-15 to API-19 — the staff Ticket Queue (api-spec.md §7).
 *
 * Every request narrows to this suite's own tickets with `search=QUEUE-TEST`,
 * so rows other suites leave in the shared test database cannot change a count
 * or an order asserted here. The search itself is under test in API-16, which
 * is why it is safe to lean on everywhere else.
 */

const PREFIX = "QUEUE-TEST";
const TIED_AT = new Date("2026-09-10T09:00:00.000Z");

let staff: SignedInUser;
let admin: SignedInUser;
let requesterA: SignedInUser;

interface Row {
  id: number;
  ticketNumber: string;
  summary: string;
  itPriority: string | null;
  currentStatus: string;
  requester: { id: number; name: string };
  ticketOwner: { id: number; name: string } | null;
}

const as = (who: SignedInUser) => (r: request.Test) =>
  r.set("Cookie", who.cookie);

const queue = (who: SignedInUser, query: Record<string, string> = {}) =>
  as(who)(
    request(app)
      .get("/api/staff/tickets")
      .query({ search: PREFIX, pageSize: "50", ...query })
  );

const rowsOf = (response: request.Response) => response.body.data as Row[];

const removeFixtures = async () => {
  await prisma.ticket.deleteMany({
    where: { summary: { startsWith: PREFIX } },
  });
};

beforeAll(async () => {
  await removeFixtures();

  [staff, admin, requesterA] = await Promise.all([
    signInAs(ACTIVE_STAFF),
    signInAs(ADMINISTRATOR),
    signInAs(ACTIVE_REQUESTER),
  ]);

  const [secondRequester, category, system] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { email: SECOND_REQUESTER.email } }),
    prisma.category.findFirstOrThrow({ where: { isActive: true } }),
    prisma.relatedSystem.findFirstOrThrow({ where: { isActive: true } }),
  ]);

  // Twelve tickets, deliberately sharing one timestamp: with pageSize 10 that
  // is two pages whose default order is decided entirely by the id tie-break,
  // which is what API-19 exists to prove.
  const fixtures: {
    summary: string;
    requesterId: number;
    ticketOwnerId: number | null;
    itPriority: "LOW" | "MEDIUM" | "HIGH" | null;
    currentStatus: "NEW" | "OPEN" | "IN_PROGRESS";
  }[] = [
    {
      summary: `${PREFIX} 100% of the disk`,
      requesterId: requesterA.id,
      ticketOwnerId: staff.id,
      itPriority: "HIGH",
      currentStatus: "IN_PROGRESS",
    },
    {
      summary: `${PREFIX} 1000 users locked out`,
      requesterId: requesterA.id,
      ticketOwnerId: null,
      itPriority: "LOW",
      currentStatus: "NEW",
    },
    {
      summary: `${PREFIX} snake_case report`,
      requesterId: secondRequester.id,
      ticketOwnerId: admin.id,
      itPriority: "MEDIUM",
      currentStatus: "OPEN",
    },
    {
      summary: `${PREFIX} snakeXcase report`,
      requesterId: secondRequester.id,
      ticketOwnerId: null,
      itPriority: null,
      currentStatus: "NEW",
    },
    ...Array.from({ length: 8 }, (_, index) => ({
      summary: `${PREFIX} filler ${index}`,
      requesterId: index % 2 === 0 ? requesterA.id : secondRequester.id,
      ticketOwnerId: null,
      itPriority: null,
      currentStatus: "NEW" as const,
    })),
  ];

  await prisma.ticket.createMany({
    data: fixtures.map((fixture, index) => ({
      ...fixture,
      ticketNumber: `TKT-2995-5000${String(index).padStart(2, "0")}`,
      categoryId: category.id,
      relatedSystemId: system.id,
      description: "Created by the staff queue suite.",
      requestedPriority: "MEDIUM",
      createdAt: TIED_AT,
    })),
  });
});

afterAll(async () => {
  await removeFixtures();
  await prisma.$disconnect();
});

describe("who may read the queue", () => {
  it("API-15 IT Staff see tickets from every requester, not only their own", async () => {
    const response = await queue(staff);

    expect(response.status).toBe(200);

    const requesters = new Set(rowsOf(response).map((row) => row.requester.id));

    expect(requesters.size).toBeGreaterThanOrEqual(2);
    expect(response.body.meta.totalItems).toBe(12);
  });

  it("API-15 an Administrator reads the same queue", async () => {
    const response = await queue(admin);

    expect(response.status).toBe(200);
    expect(response.body.meta.totalItems).toBe(12);
  });

  it("carries the requester and owner on each row, and nothing about a credential", async () => {
    const rows = rowsOf(await queue(staff));
    const owned = rows.find((row) => row.summary.includes("100%"));
    const unowned = rows.find((row) => row.summary.includes("1000 users"));

    expect(owned?.ticketOwner).toStrictEqual({
      id: staff.id,
      name: ACTIVE_STAFF.name,
    });
    // An unowned ticket is an explicit null, which the screen renders as
    // "Unassigned" — never an absent key it would have to guess about.
    expect(unowned).toHaveProperty("ticketOwner", null);
    expect(JSON.stringify(rows)).not.toMatch(/passwordHash|scrypt\$/u);
  });
});

describe("API-16 search, filters and sorting", () => {
  it("matches search text literally, so % and _ are not wildcards", async () => {
    // Prisma passes a `contains` term to ILIKE unescaped. Without escaping,
    // "100%" also matches "1000 users" and "snake_case" matches "snakeXcase".
    const percent = rowsOf(await queue(staff, { search: "100%" }));
    const underscore = rowsOf(await queue(staff, { search: "snake_case" }));

    expect(percent.map((row) => row.summary)).toStrictEqual([
      `${PREFIX} 100% of the disk`,
    ]);
    expect(underscore.map((row) => row.summary)).toStrictEqual([
      `${PREFIX} snake_case report`,
    ]);
  });

  it("narrows by IT Priority and by status", async () => {
    const high = rowsOf(await queue(staff, { itPriority: "HIGH" }));
    const open = rowsOf(await queue(staff, { status: "OPEN" }));

    expect(high.map((row) => row.summary)).toStrictEqual([
      `${PREFIX} 100% of the disk`,
    ]);
    expect(open.map((row) => row.summary)).toStrictEqual([
      `${PREFIX} snake_case report`,
    ]);
  });

  it("narrows by requester", async () => {
    const rows = rowsOf(
      await queue(staff, { requesterId: String(requesterA.id) })
    );

    expect(rows).toHaveLength(6);
    expect(rows.every((row) => row.requester.id === requesterA.id)).toBe(true);
  });

  it("sorts IT Priority by severity, not alphabetically", async () => {
    const rows = rowsOf(
      await queue(staff, { sort: "itPriority", order: "asc" })
    ).filter((row) => row.itPriority !== null);

    // Alphabetical would be HIGH, LOW, MEDIUM.
    expect(rows.map((row) => row.itPriority)).toStrictEqual([
      "LOW",
      "MEDIUM",
      "HIGH",
    ]);
  });

  it("sorts status in lifecycle order", async () => {
    const rows = rowsOf(
      await queue(staff, { sort: "currentStatus", order: "desc" })
    );

    expect(rows[0]?.currentStatus).toBe("IN_PROGRESS");
    expect(rows.at(-1)?.currentStatus).toBe("NEW");
  });

  it("sorts by owner name, which is what the column shows", async () => {
    const rows = rowsOf(
      await queue(staff, { sort: "ticketOwner", order: "asc" })
    ).filter((row) => row.ticketOwner !== null);

    expect(rows.map((row) => row.ticketOwner?.name)).toStrictEqual(
      [ACTIVE_STAFF.name, ADMINISTRATOR.name].toSorted()
    );
  });
});

describe("API-17 ownership filters", () => {
  it("unassigned=true returns only tickets nobody owns", async () => {
    const response = await queue(staff, { unassigned: "true" });

    expect(response.status).toBe(200);
    expect(rowsOf(response)).toHaveLength(10);
    expect(rowsOf(response).every((row) => row.ticketOwner === null)).toBe(
      true
    );
  });

  it("ownerId returns only that owner's tickets", async () => {
    const rows = rowsOf(await queue(staff, { ownerId: String(staff.id) }));

    expect(rows.map((row) => row.summary)).toStrictEqual([
      `${PREFIX} 100% of the disk`,
    ]);
  });

  it("refuses ownerId and unassigned together, rather than letting one win", async () => {
    const response = await queue(staff, {
      ownerId: String(staff.id),
      unassigned: "true",
    });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("INVALID_QUERY_PARAMETER");
    expect(response.body.error.details).toHaveProperty("unassigned");
  });

  it("accepts only the literal true for unassigned", async () => {
    const response = await queue(staff, { unassigned: "false" });

    expect(response.status).toBe(400);
    expect(response.body.error.details).toHaveProperty("unassigned");
  });
});

describe("API-18 blank parameters", () => {
  it.each(["page", "pageSize", "sort", "order"])(
    "refuses a blank %s rather than silently defaulting it (AC-16)",
    async (field) => {
      const response = await queue(staff, { [field]: "" });

      expect(response.status).toBe(400);
      expect(response.body.error.details).toHaveProperty(field);
    }
  );

  it.each(["ownerId", "unassigned", "requesterId", "status"])(
    "treats a blank %s filter as no filter, as the dropdowns send",
    async (field) => {
      const response = await queue(staff, { [field]: "" });

      expect(response.status).toBe(200);
      expect(response.body.meta.totalItems).toBe(12);
    }
  );
});

describe("API-19 pagination stability", () => {
  it("pages through tickets sharing one timestamp without repeating or skipping any", async () => {
    const first = await queue(staff, { pageSize: "10", page: "1" });
    const second = await queue(staff, { pageSize: "10", page: "2" });

    const ids = [...rowsOf(first), ...rowsOf(second)].map((row) => row.id);

    expect(first.body.meta.totalPages).toBe(2);
    expect(ids).toHaveLength(12);
    expect(new Set(ids).size).toBe(12);
  });

  it("answers the same page the same way twice", async () => {
    const once = rowsOf(await queue(staff, { pageSize: "10", page: "2" }));
    const again = rowsOf(await queue(staff, { pageSize: "10", page: "2" }));

    expect(again.map((row) => row.id)).toStrictEqual(once.map((row) => row.id));
  });
});

describe("the shared parser keeps the two scopes apart (D-12)", () => {
  it.each([
    { query: { unassigned: "true" }, field: "unassigned" },
    { query: { ownerId: "1" }, field: "ownerId" },
    { query: { sort: "ticketOwner" }, field: "sort" },
  ])("My Tickets refuses the queue-only $field", async ({ query, field }) => {
    const response = await as(requesterA)(
      request(app).get("/api/tickets").query(query)
    );

    expect(response.status).toBe(400);
    expect(response.body.error.details).toHaveProperty(field);
  });

  it("My Tickets searches literally too, since it reads through the same list", async () => {
    const response = await as(requesterA)(
      request(app).get("/api/tickets").query({ search: "100%" })
    );

    expect(response.status).toBe(200);
    expect(
      (response.body.data as Row[]).map((row) => row.summary)
    ).toStrictEqual([`${PREFIX} 100% of the disk`]);
  });
});

describe("GET /api/staff/owners", () => {
  it("lists active IT Staff and Administrators by name, id and name only", async () => {
    const response = await as(staff)(request(app).get("/api/staff/owners"));

    expect(response.status).toBe(200);

    const names = (response.body as { id: number; name: string }[]).map(
      (owner) => owner.name
    );

    expect(names).toContain(ACTIVE_STAFF.name);
    expect(names).toContain(ADMINISTRATOR.name);
    expect(names).not.toContain(INACTIVE_STAFF.name);
    expect(names).not.toContain(ACTIVE_REQUESTER.name);
    expect(names).toStrictEqual(names.toSorted((a, b) => a.localeCompare(b)));

    for (const owner of response.body as Record<string, unknown>[]) {
      expect(Object.keys(owner).toSorted()).toStrictEqual(["id", "name"]);
    }
  });
});
