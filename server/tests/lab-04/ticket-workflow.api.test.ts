import request from "supertest";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import {
  ACTIVE_REQUESTER,
  ACTIVE_STAFF,
  ADMINISTRATOR,
} from "../../prisma/accounts.js";
import { app } from "../../src/app.js";
import { prisma } from "../../src/prisma.js";
import type { TicketStatus } from "../../src/tickets/domain.js";
import * as statusHistory from "../../src/tickets/statusHistory.js";
import type { SignedInUser } from "../lab-03/support/signIn.js";
import { signInAs } from "../lab-03/support/signIn.js";

/**
 * WF-09 to WF-12 and WF-15 — a Ticket's version and its status history
 * (specification.md D-07, D-08; AC-23, AC-24, AC-26).
 *
 * Fixtures carry the prefix below and nothing else is deleted: another suite
 * may be running against the same database.
 */

const PREFIX = "TICKET-VERSION-TEST";
const MISSING_ID = 99_999_999;
const RACE_ROUNDS = 5;

// Wrapped rather than replaced, so every other test in this file runs the real
// function. WF-09 makes it fail once to prove the row and the change commit
// together.
vi.mock("../../src/tickets/statusHistory.js", async (importOriginal) => {
  const original = await importOriginal<typeof statusHistory>();

  return {
    ...original,
    recordStatusChange: vi.fn(original.recordStatusChange),
  };
});

let staff: SignedInUser;
let admin: SignedInUser;
let requester: SignedInUser;

let sequence = 0;

const as = (who: SignedInUser) => (r: request.Test) =>
  r.set("Cookie", who.cookie);

const removeFixtures = async () => {
  // History rows cascade with the Ticket.
  await prisma.ticket.deleteMany({
    where: { summary: { startsWith: PREFIX } },
  });
};

const createTicket = async (
  currentStatus: TicketStatus = "NEW"
): Promise<number> => {
  const [category, system] = await Promise.all([
    prisma.category.findFirstOrThrow({ where: { isActive: true } }),
    prisma.relatedSystem.findFirstOrThrow({ where: { isActive: true } }),
  ]);

  sequence += 1;

  const ticket = await prisma.ticket.create({
    data: {
      ticketNumber: `TKT-2994-${String(100_000 + sequence)}`,
      requesterId: requester.id,
      categoryId: category.id,
      relatedSystemId: system.id,
      summary: `${PREFIX} ticket ${sequence}`,
      description: "Created by the ticket versioning suite.",
      requestedPriority: "MEDIUM",
      itPriority: "MEDIUM",
      currentStatus,
    },
    select: { id: true },
  });

  return ticket.id;
};

const stored = (id: number) =>
  prisma.ticket.findUniqueOrThrow({
    where: { id },
    select: {
      currentStatus: true,
      itPriority: true,
      ticketOwnerId: true,
      version: true,
    },
  });

const versionOf = async (id: number): Promise<number> => {
  const ticket = await stored(id);

  return ticket.version;
};

const history = (ticketId: number) =>
  prisma.ticketStatusChange.findMany({
    where: { ticketId },
    orderBy: { id: "asc" },
  });

const patch = (who: SignedInUser, id: number, path: string, body: unknown) =>
  as(who)(request(app).patch(`/api/staff/tickets/${id}/${path}`)).send(
    body as object
  );

/** Each staff write, with a valid change and the version it is sent with. */
const WRITES = [
  {
    path: "owner",
    body: (version: unknown) => ({ ownerId: staff.id, version }),
  },
  {
    path: "it-priority",
    body: (version: unknown) => ({ itPriority: "HIGH", version }),
  },
  {
    path: "status",
    body: (version: unknown) => ({ status: "OPEN", version }),
  },
] as const;

beforeAll(async () => {
  await removeFixtures();

  [staff, admin, requester] = await Promise.all([
    signInAs(ACTIVE_STAFF),
    signInAs(ADMINISTRATOR),
    signInAs(ACTIVE_REQUESTER),
  ]);
});

beforeEach(removeFixtures);

afterAll(async () => {
  await removeFixtures();
  await prisma.$disconnect();
});

describe("status history", () => {
  it("WF-09 a successful transition saves exactly one row, from to, with the actor and server time", async () => {
    const id = await createTicket("NEW");
    const before = Date.now();

    const response = await patch(staff, id, "status", {
      status: "OPEN",
      version: 1,
    });

    expect(response.status).toBe(200);

    const rows = await history(id);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      ticketId: id,
      fromStatus: "NEW",
      toStatus: "OPEN",
      changedById: staff.id,
    });

    // The server's clock, not anything the request said.
    const at = rows[0]?.changedAt.getTime() ?? 0;

    expect(at).toBeGreaterThanOrEqual(before - 1000);
    expect(at).toBeLessThanOrEqual(Date.now() + 1000);

    const next = await patch(admin, id, "status", {
      status: "IN_PROGRESS",
      version: 2,
    });

    expect(next.status).toBe(200);

    const rowsAfter = await history(id);

    expect(
      rowsAfter.map((row) => [row.fromStatus, row.toStatus])
    ).toStrictEqual([
      ["NEW", "OPEN"],
      ["OPEN", "IN_PROGRESS"],
    ]);
    expect(rowsAfter[1]?.changedById).toBe(admin.id);
  });

  it("WF-09 a refused transition saves no row", async () => {
    const id = await createTicket("NEW");

    const outsideMatrix = await patch(staff, id, "status", {
      status: "RESOLVED",
      version: 1,
    });

    expect(outsideMatrix.status).toBe(400);
    expect(outsideMatrix.body.error.code).toBe("INVALID_STATUS_TRANSITION");
    expect(await history(id)).toHaveLength(0);
  });

  it("WF-09 owner and IT Priority changes are not status changes and save no row", async () => {
    const id = await createTicket("NEW");

    await patch(staff, id, "owner", { ownerId: staff.id, version: 1 });
    await patch(staff, id, "it-priority", { itPriority: "LOW", version: 2 });

    expect(await history(id)).toHaveLength(0);
  });

  it("WF-09 the row and the change commit together: a failed history write rolls the change back", async () => {
    const id = await createTicket("NEW");
    const failing = vi.mocked(statusHistory.recordStatusChange);

    failing.mockRejectedValueOnce(new Error("forced failure"));

    const quiet = vi.spyOn(console, "error").mockImplementation(() => {});
    const response = await patch(staff, id, "status", {
      status: "OPEN",
      version: 1,
    });

    quiet.mockRestore();

    expect(response.status).toBe(500);

    const after = await stored(id);

    expect(after.currentStatus).toBe("NEW");
    expect(after.version).toBe(1);
    expect(await history(id)).toHaveLength(0);
  });

  it("WF-10 a new Ticket has exactly one row, null to New, by the Requester, and version 1", async () => {
    const [category, system] = await Promise.all([
      prisma.category.findFirstOrThrow({ where: { isActive: true } }),
      prisma.relatedSystem.findFirstOrThrow({ where: { isActive: true } }),
    ]);

    const created = await as(requester)(request(app).post("/api/tickets")).send(
      {
        summary: `${PREFIX} created through the API`,
        description: "Created through the API to read its first history row.",
        categoryId: category.id,
        relatedSystemId: system.id,
        requestedPriority: "LOW",
      }
    );

    expect(created.status).toBe(201);
    expect(created.body.version).toBe(1);

    const rows = await history(created.body.id as number);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      fromStatus: null,
      toStatus: "NEW",
      changedById: requester.id,
    });
  });
});

describe("stale writes", () => {
  it("WF-11 an old version is refused 409 STALE_UPDATE on all three endpoints, changing nothing", async () => {
    for (const write of WRITES) {
      // Sequential: each starts from its own fresh Ticket.
      // oxlint-disable-next-line no-await-in-loop
      const id = await createTicket("NEW");
      // oxlint-disable-next-line no-await-in-loop
      await prisma.ticket.update({
        where: { id },
        data: { version: { increment: 1 } },
      });
      // oxlint-disable-next-line no-await-in-loop
      const before = await stored(id);
      // oxlint-disable-next-line no-await-in-loop
      const response = await patch(staff, id, write.path, write.body(1));

      expect(response.status, write.path).toBe(409);
      expect(response.body.error.code, write.path).toBe("STALE_UPDATE");

      // oxlint-disable-next-line no-await-in-loop
      expect(await stored(id), write.path).toStrictEqual(before);
      // oxlint-disable-next-line no-await-in-loop
      expect(await history(id), write.path).toHaveLength(0);
    }
  });

  it("WF-11 the current version succeeds, increments by one, and the response carries it", async () => {
    for (const write of WRITES) {
      // oxlint-disable-next-line no-await-in-loop
      const id = await createTicket("NEW");
      // oxlint-disable-next-line no-await-in-loop
      const response = await patch(staff, id, write.path, write.body(1));

      expect(response.status, write.path).toBe(200);
      expect(response.body.version, write.path).toBe(2);

      // oxlint-disable-next-line no-await-in-loop
      expect(await versionOf(id), write.path).toBe(2);
    }
  });

  it("WF-11 the same request sent twice succeeds once: the repeat carries a version that is no longer current", async () => {
    const id = await createTicket("NEW");
    const first = await patch(staff, id, "owner", {
      ownerId: staff.id,
      version: 1,
    });
    const repeat = await patch(staff, id, "owner", {
      ownerId: staff.id,
      version: 1,
    });

    expect(first.status).toBe(200);
    expect(repeat.status).toBe(409);
    expect(await versionOf(id)).toBe(2);
  });

  it("BR-20 a stale version is reported before a transition the stale picture would have made invalid", async () => {
    const id = await createTicket("NEW");

    await prisma.ticket.update({
      where: { id },
      data: { version: { increment: 1 } },
    });

    // NEW to RESOLVED is outside the matrix, but the caller is told first that
    // its picture of the Ticket is out of date.
    const response = await patch(staff, id, "status", {
      status: "RESOLVED",
      version: 1,
    });

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe("STALE_UPDATE");
  });

  it("BR-20 an unknown Ticket is 404 whatever version is sent", async () => {
    const responses = await Promise.all(
      WRITES.map((write) => patch(staff, MISSING_ID, write.path, write.body(1)))
    );

    for (const response of responses) {
      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe("TICKET_NOT_FOUND");
    }
  });

  it("BR-19 the Requester's resolved indication increments the version and writes no history row", async () => {
    const id = await createTicket("OPEN");
    const response = await as(requester)(
      request(app).post(`/api/tickets/${id}/resolved-indication`)
    );

    expect(response.status).toBe(204);
    expect(await versionOf(id)).toBe(2);
    expect(await history(id)).toHaveLength(0);

    // A staff member who read the Ticket before the indication is stale.
    const stale = await patch(staff, id, "it-priority", {
      itPriority: "LOW",
      version: 1,
    });

    expect(stale.status).toBe(409);
  });
});

describe("the version is required", () => {
  const MALFORMED = [undefined, null, "1", 1.5, 0, -1, true, [1], {}] as const;

  it("WF-12 a missing or non-integer version is 400 VALIDATION_FAILED naming version, on all three endpoints", async () => {
    for (const write of WRITES) {
      // oxlint-disable-next-line no-await-in-loop
      const id = await createTicket("NEW");

      for (const version of MALFORMED) {
        // oxlint-disable-next-line no-await-in-loop
        const response = await patch(
          staff,
          id,
          write.path,
          write.body(version)
        );

        expect(
          response.status,
          `${write.path} ${JSON.stringify(version)}`
        ).toBe(400);
        expect(response.body.error.code).toBe("VALIDATION_FAILED");
        expect(response.body.error.details.version).toBeTypeOf("string");
      }

      // oxlint-disable-next-line no-await-in-loop
      const after = await stored(id);

      expect(after.version, write.path).toBe(1);
    }
  });

  it("WF-12 a body that still has only the named field, as in Lab 3, is refused naming version", async () => {
    const id = await createTicket("NEW");
    const response = await patch(staff, id, "status", { status: "OPEN" });

    expect(response.status).toBe(400);
    expect(response.body.error.details.version).toBeTypeOf("string");
  });

  it("WF-12 an unexpected field is still refused, naming it", async () => {
    const id = await createTicket("NEW");
    const response = await patch(staff, id, "status", {
      status: "OPEN",
      version: 1,
      itPriority: "LOW",
    });

    expect(response.status).toBe(400);
    expect(response.body.error.details.itPriority).toBeTypeOf("string");
    expect(await versionOf(id)).toBe(1);
  });
});

describe("two people at once", () => {
  it("WF-15 two staff changing the owner, or the IT Priority, from the same version: one 200, one 409 STALE_UPDATE", async () => {
    for (let round = 0; round < RACE_ROUNDS; round += 1) {
      // oxlint-disable-next-line no-await-in-loop
      const id = await createTicket("NEW");
      // oxlint-disable-next-line no-await-in-loop
      const owners = await Promise.all([
        patch(staff, id, "owner", { ownerId: staff.id, version: 1 }),
        patch(admin, id, "owner", { ownerId: admin.id, version: 1 }),
      ]);

      expect(
        owners.map((response) => response.status).toSorted(),
        `owner, round ${round}`
      ).toStrictEqual([200, 409]);

      // oxlint-disable-next-line no-await-in-loop
      const priorities = await Promise.all([
        patch(staff, id, "it-priority", { itPriority: "LOW", version: 2 }),
        patch(admin, id, "it-priority", { itPriority: "HIGH", version: 2 }),
      ]);

      expect(
        priorities.map((response) => response.status).toSorted(),
        `priority, round ${round}`
      ).toStrictEqual([200, 409]);
      // oxlint-disable-next-line no-await-in-loop
      expect(await versionOf(id)).toBe(3);
    }
  });

  it("WF-15 two staff moving one Ticket from the same version: one 200, one 409 STALE_UPDATE, one history row", async () => {
    for (let round = 0; round < RACE_ROUNDS; round += 1) {
      // Sequential rounds, each racing a pair.
      // oxlint-disable-next-line no-await-in-loop
      const id = await createTicket("NEW");
      // oxlint-disable-next-line no-await-in-loop
      const [first, second] = await Promise.all([
        patch(staff, id, "status", { status: "OPEN", version: 1 }),
        patch(admin, id, "status", { status: "CANCELLED", version: 1 }),
      ]);

      expect(
        [first.status, second.status].toSorted(),
        `round ${round}`
      ).toStrictEqual([200, 409]);

      const loser = first.status === 409 ? first : second;

      expect(loser.body.error.code).toBe("STALE_UPDATE");

      // oxlint-disable-next-line no-await-in-loop
      const after = await stored(id);

      expect(after.version).toBe(2);
      // oxlint-disable-next-line no-await-in-loop
      expect(await history(id), `round ${round}`).toHaveLength(1);
    }
  });
});
