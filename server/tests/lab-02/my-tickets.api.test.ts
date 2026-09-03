import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { app } from "../../src/app.js";
import { REQUESTER_HEADER } from "../../src/middleware/requesterContext.js";
import { prisma } from "../../src/prisma.js";

/**
 * API-08 — the list returns only tickets owned by the request context.
 * API-09 — search, filters and sorting behave as documented.
 * API-10 — paging the whole set returns every row exactly once.
 * API-11 — an undocumented parameter is an error, never a silent default.
 */

const PREFIX = "FIXTURE-LIST";

let ownerA: number;
let ownerB: number;
let categoryId: number;
let otherCategoryId: number;
let relatedSystemId: number;

/**
 * Twelve tickets for A and three for B, all created in one statement so they
 * share a `createdAt` to the millisecond.
 *
 * That collision is deliberate: it is what makes API-10 meaningful. With
 * distinct timestamps a sort on `createdAt` alone would look stable and the
 * missing secondary key would go unnoticed until production had two tickets
 * raised in the same second.
 */
const OWNER_A_COUNT = 12;
const OWNER_B_COUNT = 3;

const idsOf = (response: { body: { data: { id: number }[] } }) =>
  response.body.data.map((ticket) => ticket.id);

const listing = (query = "", requesterId = ownerA) =>
  request(app)
    .get(`/api/tickets${query}`)
    .set(REQUESTER_HEADER, String(requesterId));

beforeAll(async () => {
  const [a, b] = await prisma.user.findMany({
    where: { role: "REQUESTER", isActive: true },
    orderBy: { id: "asc" },
    take: 2,
    select: { id: true },
  });
  const [first, second] = await prisma.category.findMany({
    where: { isActive: true },
    orderBy: { displayOrder: "asc" },
    take: 2,
    select: { id: true },
  });
  const system = await prisma.relatedSystem.findFirstOrThrow({
    where: { isActive: true },
    select: { id: true },
  });

  ownerA = a?.id ?? 0;
  ownerB = b?.id ?? 0;
  categoryId = first?.id ?? 0;
  otherCategoryId = second?.id ?? 0;
  relatedSystemId = system.id;

  await prisma.ticket.deleteMany({
    where: { summary: { startsWith: PREFIX } },
  });

  await prisma.ticket.createMany({
    data: [
      ...Array.from({ length: OWNER_A_COUNT }, (_unused, index) => ({
        ticketNumber: `TKT-3100-${String(index + 1).padStart(6, "0")}`,
        requesterId: ownerA,
        // Half the tickets sit on a second category so a filter has something
        // to exclude rather than matching everything.
        categoryId: index % 2 === 0 ? categoryId : otherCategoryId,
        relatedSystemId,
        summary: `${PREFIX} owner A ticket ${index + 1}`,
        description: "Seeded by the My Tickets API test.",
        requestedPriority:
          index === 0 ? ("HIGH" as const) : ("MEDIUM" as const),
      })),
      ...Array.from({ length: OWNER_B_COUNT }, (_unused, index) => ({
        ticketNumber: `TKT-3100-${String(index + 900).padStart(6, "0")}`,
        requesterId: ownerB,
        categoryId,
        relatedSystemId,
        summary: `${PREFIX} owner B ticket ${index + 1}`,
        description: "Seeded by the My Tickets API test.",
        requestedPriority: "LOW" as const,
      })),
    ],
  });
});

afterAll(async () => {
  await prisma.ticket.deleteMany({
    where: { summary: { startsWith: PREFIX } },
  });
});

describe("ownership", () => {
  it("returns HTTP 200 for a valid context", async () => {
    const response = await listing();

    expect(response.status).toBe(200);
  });

  it("returns only the current requester's tickets", async () => {
    const response = await listing("?pageSize=50");
    const summaries = response.body.data.map(
      (ticket: { summary: string }) => ticket.summary
    );

    expect(summaries.every((s: string) => s.includes("owner A"))).toBe(true);
    expect(summaries.some((s: string) => s.includes("owner B"))).toBe(false);
  });

  it("gives a different requester a different list", async () => {
    const response = await listing("?pageSize=50", ownerB);
    const mine = response.body.data.filter((ticket: { summary: string }) =>
      ticket.summary.startsWith(PREFIX)
    );

    expect(mine).toHaveLength(OWNER_B_COUNT);
  });

  it("requires a requester context", async () => {
    const response = await request(app).get("/api/tickets");

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("REQUESTER_CONTEXT_REQUIRED");
  });
});

describe("the response shape", () => {
  it("carries the pagination metadata a client needs", async () => {
    const response = await listing();

    expect(response.body.meta).toMatchObject({
      page: 1,
      pageSize: 10,
    });
    expect(typeof response.body.meta.totalItems).toBe("number");
    expect(typeof response.body.meta.totalPages).toBe("number");
  });

  it("returns the fields the contract documents and no description", async () => {
    const response = await listing();
    const [ticket] = response.body.data;

    expect(Object.keys(ticket).toSorted()).toEqual([
      "category",
      "createdAt",
      "currentStatus",
      "id",
      "itPriority",
      "relatedSystem",
      "requestedPriority",
      "summary",
      "ticketNumber",
      "ticketOwner",
      "updatedAt",
    ]);
  });
});

describe("search", () => {
  it("matches on summary, case-insensitively", async () => {
    const response = await listing("?search=OWNER a TICKET 3&pageSize=50");

    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0].summary).toContain("owner A ticket 3");
  });

  it("matches on ticket number", async () => {
    const response = await listing("?search=TKT-3100-000001");

    expect(response.body.data).toHaveLength(1);
  });

  it("reports no matches rather than failing", async () => {
    const response = await listing("?search=nothing-matches-this");

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual([]);
    expect(response.body.meta.totalItems).toBe(0);
  });
});

describe("filters", () => {
  it("narrows by category", async () => {
    const response = await listing(
      `?categoryId=${otherCategoryId}&pageSize=50`
    );
    const mine = response.body.data.filter((t: { summary: string }) =>
      t.summary.startsWith(PREFIX)
    );

    expect(mine.length).toBeGreaterThan(0);
    expect(mine.length).toBeLessThan(OWNER_A_COUNT);
  });

  /**
   * Raised in review of PR #27: every other filter was covered and this one was
   * not. It is the filter nothing on the screen can currently exercise — §4.2
   * excludes the staff workflow, so Lab 2 never sets an IT priority — which is
   * exactly why it needs a fixture written by hand. An untested filter over a
   * column that is null on every row is one that could match nothing forever
   * and look correct.
   */
  it("narrows by IT priority", async () => {
    const triaged = await prisma.ticket.findFirst({
      where: { requesterId: ownerA, summary: { startsWith: PREFIX } },
      orderBy: { id: "asc" },
    });

    await prisma.ticket.update({
      where: { id: triaged?.id ?? 0 },
      data: { itPriority: "HIGH" },
    });

    const response = await listing("?itPriority=HIGH&pageSize=50");
    const mine = response.body.data.filter((t: { summary: string }) =>
      t.summary.startsWith(PREFIX)
    );

    expect(mine).toHaveLength(1);
    expect(mine[0].id).toBe(triaged?.id);
  });

  it("excludes the untriaged rows from an IT priority filter", async () => {
    const response = await listing("?itPriority=LOW&pageSize=50");
    const mine = response.body.data.filter((t: { summary: string }) =>
      t.summary.startsWith(PREFIX)
    );

    expect(mine).toHaveLength(0);
  });

  it("narrows by requested priority", async () => {
    const response = await listing("?requestedPriority=HIGH&pageSize=50");
    const mine = response.body.data.filter((t: { summary: string }) =>
      t.summary.startsWith(PREFIX)
    );

    expect(mine).toHaveLength(1);
  });

  // Every seeded ticket is NEW, so this is the filter that demonstrates the
  // no-results state the submission has to show (BR-35).
  it("returns nothing for a status no ticket has reached", async () => {
    const response = await listing("?status=RESOLVED&pageSize=50");

    expect(response.body.data).toEqual([]);
  });

  // The RESOLVED case above proves a filter that matches nothing returns
  // nothing — it does not prove the filter itself works, since a status
  // parameter that was silently ignored would look identical. Every seeded
  // ticket is NEW (§4.2 excludes every status change in Lab 2), so this is
  // the one value that can prove a matching filter returns matches.
  it("returns the seeded rows for the status every ticket actually has", async () => {
    const response = await listing("?status=NEW&pageSize=50");
    const mine = response.body.data.filter((t: { summary: string }) =>
      t.summary.startsWith(PREFIX)
    );

    expect(mine).toHaveLength(OWNER_A_COUNT);
  });

  it("combines filters rather than replacing them", async () => {
    const response = await listing(
      `?categoryId=${categoryId}&requestedPriority=HIGH&pageSize=50`
    );
    const mine = response.body.data.filter((t: { summary: string }) =>
      t.summary.startsWith(PREFIX)
    );

    expect(mine).toHaveLength(1);
  });
});

describe("sorting", () => {
  it("orders by ticket number ascending when asked", async () => {
    const response = await listing("?sort=ticketNumber&order=asc&pageSize=50");
    const numbers = response.body.data
      .filter((t: { summary: string }) => t.summary.startsWith(PREFIX))
      .map((t: { ticketNumber: string }) => t.ticketNumber);

    expect(numbers).toEqual([...numbers].toSorted());
  });

  // "each sort field" in the Issue's acceptance criteria, not one of them. A
  // column that silently fails to sort looks identical to one that sorted into
  // the order it was already in.
  it.each([
    "ticketNumber",
    "createdAt",
    "updatedAt",
    "summary",
    "requestedPriority",
  ])("accepts %s as a sort column", async (sort) => {
    const response = await listing(`?sort=${sort}&order=asc&pageSize=50`);

    expect(response.status).toBe(200);
    expect(response.body.data.length).toBeGreaterThan(0);
  });

  it("actually reorders when the sort column changes", async () => {
    const byNumber = await listing("?sort=ticketNumber&order=asc&pageSize=50");
    const bySummary = await listing("?sort=summary&order=desc&pageSize=50");

    expect(idsOf(byNumber)).not.toEqual(idsOf(bySummary));
  });

  it("reverses on order=desc", async () => {
    const response = await listing("?sort=ticketNumber&order=desc&pageSize=50");
    const numbers = response.body.data
      .filter((t: { summary: string }) => t.summary.startsWith(PREFIX))
      .map((t: { ticketNumber: string }) => t.ticketNumber);

    expect(numbers).toEqual([...numbers].toSorted().toReversed());
  });
});

describe("pagination", () => {
  it("returns at most one page of rows", async () => {
    const response = await listing("?pageSize=10");

    expect(response.body.data.length).toBeLessThanOrEqual(10);
  });

  it("reports the total across every page, not the page size", async () => {
    const response = await listing("?pageSize=10");

    expect(response.body.meta.totalItems).toBeGreaterThanOrEqual(OWNER_A_COUNT);
  });

  it("computes totalPages from the total and the page size", async () => {
    const response = await listing("?pageSize=10");
    const { totalItems, pageSize, totalPages } = response.body.meta;

    expect(totalPages).toBe(Math.ceil(totalItems / pageSize));
  });

  it("returns an empty page past the end rather than failing", async () => {
    const response = await listing("?page=999");

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual([]);
  });

  // API-10. Every seeded ticket shares a createdAt to the millisecond, so with
  // no secondary key the database is free to return them in any order — and a
  // row would appear on two pages or on none.
  it("walks the whole list without repeating or skipping a row", async () => {
    const first = await listing("?pageSize=10&page=1");
    const second = await listing("?pageSize=10&page=2");
    const third = await listing("?pageSize=10&page=3");

    const ids = [
      ...first.body.data,
      ...second.body.data,
      ...third.body.data,
    ].map((ticket: { id: number }) => ticket.id);

    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.length).toBe(first.body.meta.totalItems);
  });

  it("is stable across repeated requests for the same page", async () => {
    const once = await listing("?pageSize=10&page=2");
    const twice = await listing("?pageSize=10&page=2");

    expect(once.body.data).toEqual(twice.body.data);
  });
});

describe("invalid query parameters", () => {
  it.each([
    ["pageSize", "?pageSize=15"],
    ["page", "?page=0"],
    ["sort", "?sort=description"],
    ["order", "?order=sideways"],
    ["status", "?status=ARCHIVED"],
    ["sortBy", "?sortBy=createdAt"],
  ])("rejects %s with a message naming it", async (field, query) => {
    const response = await listing(query);

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("INVALID_QUERY_PARAMETER");
    expect(response.body.error.details).toHaveProperty(field);
  });

  // BR-34. Falling back would return a list the caller did not ask for, with
  // nothing to tell them it is not the one they requested.
  it("never falls back to a default", async () => {
    const response = await listing("?pageSize=15");

    expect(response.body).not.toHaveProperty("data");
  });
});
