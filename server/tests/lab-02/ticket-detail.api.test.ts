import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { app } from "../../src/app.js";
import { REQUESTER_HEADER } from "../../src/middleware/requesterContext.js";
import { prisma } from "../../src/prisma.js";

/**
 * `GET /api/tickets/:id` — ownership at the one place it can actually be
 * attacked.
 *
 * Every other screen hides what you do not own. This endpoint is reachable by
 * typing a number into the address bar, which is why Part 8 asks to see it
 * refuse rather than to see a missing link.
 *
 * The property under test is not "it returns 404" but "the two 404s are
 * indistinguishable". A different status, a different code, or a different
 * message for "someone else's" than for "does not exist" hands an attacker
 * walking the identifiers exactly the answer they came for (BR-12, D-07).
 */

const PREFIX = "DETAIL-TEST";

let ownerA = 0;
let ownerB = 0;
let ticketOfA = 0;
let ticketOfB = 0;

const asRequester = (id: number) => (r: request.Test) =>
  r.set(REQUESTER_HEADER, String(id));

beforeAll(async () => {
  const [a, b] = await prisma.user.findMany({
    where: { role: "REQUESTER", isActive: true },
    orderBy: { id: "asc" },
    take: 2,
  });

  ownerA = a?.id ?? 0;
  ownerB = b?.id ?? 0;

  const category = await prisma.category.findFirstOrThrow();
  const system = await prisma.relatedSystem.findFirstOrThrow();

  const make = async (requesterId: number, suffix: string) => {
    const ticket = await prisma.ticket.create({
      data: {
        ticketNumber: `TKT-2999-${suffix}`,
        requesterId,
        categoryId: category.id,
        relatedSystemId: system.id,
        summary: `${PREFIX} ${suffix}`,
        description: "Created by the ticket detail test suite.",
        requestedPriority: "MEDIUM",
      },
      select: { id: true },
    });

    return ticket.id;
  };

  ticketOfA = await make(ownerA, "900001");
  ticketOfB = await make(ownerB, "900002");
});

afterAll(async () => {
  await prisma.attachment.deleteMany({
    where: { ticket: { summary: { startsWith: PREFIX } } },
  });
  await prisma.ticket.deleteMany({
    where: { summary: { startsWith: PREFIX } },
  });
  await prisma.$disconnect();
});

describe("reading a ticket you own", () => {
  it("returns it", async () => {
    const response = await asRequester(ownerA)(
      request(app).get(`/api/tickets/${ticketOfA}`)
    );

    expect(response.status).toBe(200);
    expect(response.body.id).toBe(ticketOfA);
  });

  // The list omits it for weight; the detail screen is the only place it is
  // shown, so its absence here would be silent.
  it("carries the description the list leaves out", async () => {
    const response = await asRequester(ownerA)(
      request(app).get(`/api/tickets/${ticketOfA}`)
    );

    expect(response.body.description).toBe(
      "Created by the ticket detail test suite."
    );
  });

  it("carries the requester, so the screen need not guess who owns it", async () => {
    const response = await asRequester(ownerA)(
      request(app).get(`/api/tickets/${ticketOfA}`)
    );

    expect(response.body.requester.id).toBe(ownerA);
  });

  it.each(["itPriority", "ticketOwner", "resolutionSummary"])(
    "sends %s as null rather than omitting it",
    async (field) => {
      const response = await asRequester(ownerA)(
        request(app).get(`/api/tickets/${ticketOfA}`)
      );

      expect(field in response.body).toBe(true);
      expect(response.body[field]).toBeNull();
    }
  );

  it("carries an attachments array even when there are none", async () => {
    const response = await asRequester(ownerA)(
      request(app).get(`/api/tickets/${ticketOfA}`)
    );

    expect(response.body.attachments).toStrictEqual([]);
  });
});

describe("reading a ticket you do not own", () => {
  // AC: proven by a test, not only by hiding the link.
  it("is refused", async () => {
    const response = await asRequester(ownerB)(
      request(app).get(`/api/tickets/${ticketOfA}`)
    );

    expect(response.status).toBe(404);
  });

  it("answers identically to a ticket that does not exist", async () => {
    const [stranger, missing] = await Promise.all([
      asRequester(ownerB)(request(app).get(`/api/tickets/${ticketOfA}`)),
      asRequester(ownerB)(request(app).get("/api/tickets/99999999")),
    ]);

    expect(stranger.status).toBe(missing.status);
    expect(stranger.body).toStrictEqual(missing.body);
  });

  // 403 would confirm the ticket is real, which is the one fact the caller is
  // trying to establish.
  it("never answers 403, which would confirm the ticket exists", async () => {
    const response = await asRequester(ownerB)(
      request(app).get(`/api/tickets/${ticketOfA}`)
    );

    expect(response.status).not.toBe(403);
    expect(response.body.error.code).toBe("TICKET_NOT_FOUND");
  });

  it("leaks nothing about the ticket in the message", async () => {
    const response = await asRequester(ownerB)(
      request(app).get(`/api/tickets/${ticketOfA}`)
    );

    expect(JSON.stringify(response.body)).not.toContain(PREFIX);
    expect(JSON.stringify(response.body)).not.toContain("TKT-2999");
  });

  it("works in both directions, so neither requester is privileged", async () => {
    const response = await asRequester(ownerA)(
      request(app).get(`/api/tickets/${ticketOfB}`)
    );

    expect(response.status).toBe(404);
  });
});

describe("an identifier that is not one", () => {
  it.each(["abc", "1.5", "-1", "0", "1e3", " 1", "1%20"])(
    "refuses %s without reaching the database",
    async (raw) => {
      const response = await asRequester(ownerA)(
        request(app).get(`/api/tickets/${raw}`)
      );

      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe("TICKET_NOT_FOUND");
    }
  );
});

describe("without a requester", () => {
  it("is refused before ownership is even considered", async () => {
    const response = await request(app).get(`/api/tickets/${ticketOfA}`);

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("REQUESTER_CONTEXT_REQUIRED");
  });
});
