import request from "supertest";
import { afterEach, beforeAll, describe, expect, it } from "vitest";

import { app } from "../../src/app.js";
import { REQUESTER_HEADER } from "../../src/middleware/requesterContext.js";
import { prisma } from "../../src/prisma.js";
import { TICKET_NUMBER_PATTERN } from "../../src/tickets/ticketNumber.js";

/**
 * API-04 — creation stores one ticket owned by the context.
 * API-05 — every validation rule rejects, and creates nothing.
 * API-06 — a requesterId in the body cannot change who owns the ticket.
 * API-07 — concurrent creation never produces a duplicate number.
 */

let requesterA: number;
let requesterB: number;
let categoryId: number;
let relatedSystemId: number;

beforeAll(async () => {
  const [a, b] = await prisma.user.findMany({
    where: { role: "REQUESTER", isActive: true },
    orderBy: { id: "asc" },
    take: 2,
    select: { id: true },
  });
  const category = await prisma.category.findFirstOrThrow({
    where: { isActive: true },
    select: { id: true },
  });
  const system = await prisma.relatedSystem.findFirstOrThrow({
    where: { isActive: true },
    select: { id: true },
  });

  requesterA = a?.id ?? 0;
  requesterB = b?.id ?? 0;
  categoryId = category.id;
  relatedSystemId = system.id;
});

// Every test cleans up after itself. The suite asserts counts, and a ticket left
// behind by one test becomes a mysterious failure in another.
afterEach(async () => {
  await prisma.ticket.deleteMany({
    where: { summary: { startsWith: "FIXTURE" } },
  });
});

const body = (overrides: Record<string, unknown> = {}) => ({
  categoryId,
  relatedSystemId,
  summary: "FIXTURE Laptop battery drains quickly",
  description: "The battery drains much faster than usual even when idle.",
  requestedPriority: "MEDIUM",
  ...overrides,
});

/** Text of an exact length that still carries the FIXTURE cleanup prefix. */
const pad = (length: number) => `FIXTURE ${"x".repeat(length - 8)}`;

const create = (payload: Record<string, unknown>, requesterId = requesterA) =>
  request(app)
    .post("/api/tickets")
    .set(REQUESTER_HEADER, String(requesterId))
    .send(payload);

describe("creating a valid ticket", () => {
  it("returns 201", async () => {
    const response = await create(body());

    expect(response.status).toBe(201);
  });

  it("stores exactly one ticket", async () => {
    await create(body());

    const stored = await prisma.ticket.count({
      where: { summary: { startsWith: "FIXTURE" } },
    });

    expect(stored).toBe(1);
  });

  it("issues a ticket number in the documented format", async () => {
    const response = await create(body());

    expect(response.body.ticketNumber).toMatch(TICKET_NUMBER_PATTERN);
  });

  it("issues the number itself, ignoring anything the client sent", async () => {
    const response = await create(body({ ticketNumber: "TKT-1999-000001" }));

    expect(response.body.ticketNumber).not.toBe("TKT-1999-000001");
  });

  // BR-02.
  it("starts the ticket at status New", async () => {
    const response = await create(body());

    expect(response.body.currentStatus).toBe("NEW");
  });

  it("owns the ticket to the requester in the header", async () => {
    const response = await create(body());

    expect(response.body.requester.id).toBe(requesterA);
  });

  // BR-06 and decision D-04: the columns exist so the detail screen can render
  // the fields the illustration shows, and nothing in Lab 2 can populate them.
  it("leaves IT priority, ticket owner and resolution summary unset", async () => {
    const response = await create(body());

    expect(response.body.itPriority).toBeNull();
    expect(response.body.ticketOwner).toBeNull();
    expect(response.body.resolutionSummary).toBeNull();
  });

  it("trims the text before storing it", async () => {
    const response = await create(
      body({ summary: "   FIXTURE Printer offline   " })
    );

    expect(response.body.summary).toBe("FIXTURE Printer offline");
  });

  it("returns the category and related system it was filed against", async () => {
    const response = await create(body());

    expect(response.body.category.id).toBe(categoryId);
    expect(response.body.relatedSystem.id).toBe(relatedSystemId);
  });
});

describe("validation failures", () => {
  // Every rule the endpoint enforces, not a sample of them. The rules
  // themselves are UNIT-03's subject; what this proves is that the endpoint is
  // actually wired to them, which a passing unit test cannot show.
  it.each([
    ["summary missing", "summary", { summary: "" }],
    ["summary whitespace only", "summary", { summary: "        " }],
    ["summary below minimum", "summary", { summary: "abcd" }],
    ["summary above maximum", "summary", { summary: pad(151) }],
    ["description missing", "description", { description: "" }],
    ["description whitespace only", "description", { description: "     " }],
    ["description below minimum", "description", { description: "too short" }],
    [
      "description above maximum",
      "description",
      { description: "y".repeat(5001) },
    ],
    [
      "priority not in the enum",
      "requestedPriority",
      { requestedPriority: "URGENT" },
    ],
    ["priority missing", "requestedPriority", { requestedPriority: undefined }],
    ["category not a positive integer", "categoryId", { categoryId: 0 }],
    ["category missing", "categoryId", { categoryId: undefined }],
    [
      "related system not a positive integer",
      "relatedSystemId",
      { relatedSystemId: -1 },
    ],
    [
      "related system missing",
      "relatedSystemId",
      { relatedSystemId: undefined },
    ],
  ])(
    "rejects %s with a message on the field",
    async (_case, field, overrides) => {
      const response = await create(body(overrides));

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe("VALIDATION_FAILED");
      expect(response.body.error.details).toHaveProperty(field);

      // BR-18 for every case, not only the one sampled below: a rejected body
      // leaves nothing behind.
      const stored = await prisma.ticket.count({
        where: { summary: { startsWith: "FIXTURE" } },
      });

      expect(stored).toBe(0);
    }
  );

  it("accepts text at both boundaries", async () => {
    const atMax = await create(
      body({ summary: pad(150), description: "z".repeat(5000) })
    );

    expect(atMax.status).toBe(201);
  });

  it("rejects a related system that does not exist", async () => {
    const response = await create(body({ relatedSystemId: 999_999 }));

    expect(response.status).toBe(400);
    expect(response.body.error.details).toHaveProperty("relatedSystemId");
  });

  it("rejects a related system that exists but is retired", async () => {
    const retired = await prisma.relatedSystem.create({
      data: {
        name: "FIXTURE Retired System",
        displayOrder: -9002,
        isActive: false,
      },
      select: { id: true },
    });

    const response = await create(body({ relatedSystemId: retired.id }));

    expect(response.status).toBe(400);
    expect(response.body.error.details).toHaveProperty("relatedSystemId");

    await prisma.relatedSystem.delete({ where: { id: retired.id } });
  });

  it("names every offending field at once, so the form can mark them all", async () => {
    const response = await create(
      body({ summary: "", description: "", categoryId: 0 })
    );

    expect(Object.keys(response.body.error.details).toSorted()).toEqual([
      "categoryId",
      "description",
      "summary",
    ]);
  });

  // BR-18: a rejected submission creates nothing at all, not a partial row.
  it("creates no ticket when the body is rejected", async () => {
    await create(body({ summary: "" }));

    const stored = await prisma.ticket.count({
      where: { summary: { startsWith: "FIXTURE" } },
    });

    expect(stored).toBe(0);
  });

  it("rejects a category that does not exist", async () => {
    const response = await create(body({ categoryId: 999_999 }));

    expect(response.status).toBe(400);
    expect(response.body.error.details).toHaveProperty("categoryId");
  });

  // A retired category still exists so the tickets already on it are not
  // orphaned, but nothing new may be filed against it.
  it("rejects a category that exists but is retired", async () => {
    const retired = await prisma.category.create({
      data: {
        name: "FIXTURE Retired Category",
        displayOrder: -9001,
        isActive: false,
      },
      select: { id: true },
    });

    const response = await create(body({ categoryId: retired.id }));

    expect(response.status).toBe(400);
    expect(response.body.error.details).toHaveProperty("categoryId");

    await prisma.category.delete({ where: { id: retired.id } });
  });

  it("burns no ticket number on a rejected request", async () => {
    const before = await prisma.ticketCounter.findUnique({
      where: { year: new Date().getFullYear() },
      select: { lastNumber: true },
    });

    await create(body({ summary: "" }));

    const after = await prisma.ticketCounter.findUnique({
      where: { year: new Date().getFullYear() },
      select: { lastNumber: true },
    });

    expect(after?.lastNumber ?? 0).toBe(before?.lastNumber ?? 0);
  });
});

describe("ownership", () => {
  // BR-11. The body is not trusted to say who this belongs to.
  it("ignores a requesterId in the body", async () => {
    const response = await create(
      body({ requesterId: requesterB }),
      requesterA
    );

    expect(response.body.requester.id).toBe(requesterA);
  });

  it("requires a requester context at all", async () => {
    const response = await request(app).post("/api/tickets").send(body());

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("REQUESTER_CONTEXT_REQUIRED");
  });

  it("creates nothing when the context is missing", async () => {
    await request(app).post("/api/tickets").send(body());

    const stored = await prisma.ticket.count({
      where: { summary: { startsWith: "FIXTURE" } },
    });

    expect(stored).toBe(0);
  });
});

describe("concurrent creation", () => {
  // BR-01. Eight at once is enough to lose a read-then-write race reliably.
  it("gives every ticket a different number", async () => {
    const responses = await Promise.all(
      Array.from({ length: 8 }, (_, index) =>
        create(body({ summary: `FIXTURE Concurrent ${index}` }))
      )
    );

    const numbers = responses.map((response) => response.body.ticketNumber);

    expect(responses.every((response) => response.status === 201)).toBe(true);
    expect(new Set(numbers).size).toBe(numbers.length);
  }, 30_000);
});
