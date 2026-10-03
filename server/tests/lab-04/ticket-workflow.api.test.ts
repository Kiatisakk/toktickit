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
import {
  actionBody,
  cancelAction,
  completeAction,
  createAction,
  createTicket as createActionTicket,
  removeTickets,
} from "./support/actions.js";

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

/* ----------------------------------------------- the resolution gate -- */

const GATE_PREFIX = "RESOLUTION-GATE-TEST";
const SUMMARY = "Replaced the access point and confirmed with the requester.";

const ALL_STATUSES: TicketStatus[] = [
  "NEW",
  "OPEN",
  "IN_PROGRESS",
  "WAITING_FOR_REQUESTER",
  "RESOLVED",
  "CLOSED",
  "REOPENED",
  "CANCELLED",
];

/** Which statuses each one may move to: written out from specification.md section 5. */
const PERMITTED: Record<TicketStatus, TicketStatus[]> = {
  NEW: ["OPEN", "CANCELLED"],
  OPEN: ["IN_PROGRESS", "WAITING_FOR_REQUESTER", "RESOLVED", "CANCELLED"],
  IN_PROGRESS: ["WAITING_FOR_REQUESTER", "RESOLVED", "CANCELLED"],
  WAITING_FOR_REQUESTER: ["IN_PROGRESS", "RESOLVED", "CANCELLED"],
  RESOLVED: ["CLOSED", "REOPENED"],
  CLOSED: ["REOPENED"],
  REOPENED: ["IN_PROGRESS", "WAITING_FOR_REQUESTER", "RESOLVED", "CANCELLED"],
  CANCELLED: [],
};

let gateSequence = 0;

const gateTicket = (status: TicketStatus = "IN_PROGRESS") =>
  createActionTicket(GATE_PREFIX, requester.id, { status });

/** Writes an Action straight to the table: the API refuses to on a Resolved Ticket. */
const insertAction = async (
  ticketId: number,
  data: {
    state?: "PLANNED" | "DONE" | "CANCELLED";
    followUpRequired?: boolean;
    followsUpId?: number;
  } = {}
): Promise<number> => {
  gateSequence += 1;

  const state = data.state ?? "DONE";
  const action = await prisma.actionTaken.create({
    data: {
      ticketId,
      recordedById: staff.id,
      performedById: staff.id,
      actionAt: new Date(),
      description: `${GATE_PREFIX} action ${gateSequence}`,
      result: state === "DONE" ? "Done." : null,
      state,
      followUpRequired: data.followUpRequired ?? false,
      followUpNote: data.followUpRequired ? "Check back." : null,
      followsUpId: data.followsUpId ?? null,
      requestId: `gate-${String(gateSequence)}-${String(Date.now())}`,
    },
    select: { id: true },
  });

  return action.id;
};

/** A Ticket that satisfies every condition but the summary. */
const readyTicket = async (status: TicketStatus = "IN_PROGRESS") => {
  const id = await gateTicket(status);

  await insertAction(id);

  return id;
};

/** Resolves, sending `summary` (by default a good one). */
const resolve = (id: number, version: number, summary: unknown = SUMMARY) =>
  patch(staff, id, "status", {
    status: "RESOLVED",
    version,
    resolutionSummary: summary,
  });

/** Resolves sending no summary field at all. */
const resolveWithoutSummary = (id: number, version: number) =>
  patch(staff, id, "status", { status: "RESOLVED", version });

const gateDetails = (response: { body: { error?: { details?: object } } }) =>
  Object.keys(response.body.error?.details ?? {}).toSorted();

/** The Ticket is exactly as it was: status, version, summary, no history. */
const expectUntouched = async (id: number, status: TicketStatus) => {
  const after = await prisma.ticket.findUniqueOrThrow({
    where: { id },
    select: { currentStatus: true, version: true, resolutionSummary: true },
  });

  expect(after).toStrictEqual({
    currentStatus: status,
    version: 1,
    resolutionSummary: null,
  });
  expect(await history(id)).toHaveLength(0);
};

describe("the resolution gate", () => {
  beforeEach(async () => {
    await removeTickets(GATE_PREFIX);
  });

  afterAll(async () => {
    await removeTickets(GATE_PREFIX);
  });

  it("WF-01 no Done Action: 400 RESOLUTION_GATE_FAILED naming doneAction; a Planned or Cancelled Action does not count", async () => {
    const bare = await gateTicket();
    const refused = await resolve(bare, 1);

    expect(refused.status).toBe(400);
    expect(refused.body.error.code).toBe("RESOLUTION_GATE_FAILED");
    expect(refused.body.error.details.doneAction).toBeTypeOf("string");
    expect(gateDetails(refused)).toStrictEqual(["doneAction"]);
    await expectUntouched(bare, "IN_PROGRESS");

    const cancelledOnly = await gateTicket();

    await insertAction(cancelledOnly, { state: "CANCELLED" });

    const cancelled = await resolve(cancelledOnly, 1);

    expect(gateDetails(cancelled)).toStrictEqual(["doneAction"]);
    await expectUntouched(cancelledOnly, "IN_PROGRESS");
  });

  it("WF-02 an open follow-up: details.openFollowUp, and it succeeds once a Done Action follows it up", async () => {
    const id = await gateTicket();
    const needs = await insertAction(id, { followUpRequired: true });
    const refused = await resolve(id, 1);

    expect(refused.status).toBe(400);
    expect(refused.body.error.code).toBe("RESOLUTION_GATE_FAILED");
    expect(gateDetails(refused)).toStrictEqual(["openFollowUp"]);
    await expectUntouched(id, "IN_PROGRESS");

    await insertAction(id, { followsUpId: needs });

    const allowed = await resolve(id, 1);

    expect(allowed.status).toBe(200);
    expect(allowed.body.currentStatus).toBe("RESOLVED");
  });

  it("WF-03 a missing, empty or whitespace-only summary: 400 naming resolutionSummary", async () => {
    const id = await readyTicket();

    const missing = await resolveWithoutSummary(id, 1);

    expect(missing.status).toBe(400);
    expect(gateDetails(missing)).toStrictEqual(["resolutionSummary"]);

    for (const summary of ["", "   ", "\n\t "]) {
      // oxlint-disable-next-line no-await-in-loop
      const refused = await resolve(id, 1, summary);

      expect(refused.status, JSON.stringify(summary)).toBe(400);
      expect(refused.body.error.code).toBe("RESOLUTION_GATE_FAILED");
      expect(gateDetails(refused)).toStrictEqual(["resolutionSummary"]);
    }

    await expectUntouched(id, "IN_PROGRESS");
  });

  it("WF-03 a summary over 2000 characters, or not text, is a shape error, not a gate failure", async () => {
    const id = await readyTicket();

    for (const summary of ["x".repeat(2001), 5, null, {}]) {
      // oxlint-disable-next-line no-await-in-loop
      const refused = await resolve(id, 1, summary);

      expect(refused.status).toBe(400);
      expect(refused.body.error.code).toBe("VALIDATION_FAILED");
      expect(gateDetails(refused)).toStrictEqual(["resolutionSummary"]);
    }

    await expectUntouched(id, "IN_PROGRESS");
  });

  it("WF-04 every unmet condition in one response", async () => {
    const bare = await gateTicket();
    const two = await resolveWithoutSummary(bare, 1);

    expect(two.status).toBe(400);
    expect(two.body.error.code).toBe("RESOLUTION_GATE_FAILED");
    expect(gateDetails(two)).toStrictEqual(["doneAction", "resolutionSummary"]);

    const worst = await gateTicket();

    await insertAction(worst, { state: "PLANNED", followUpRequired: true });

    const four = await resolveWithoutSummary(worst, 1);

    expect(gateDetails(four)).toStrictEqual([
      "doneAction",
      "openFollowUp",
      "plannedActions",
      "resolutionSummary",
    ]);
    expect(four.body.error.details.openFollowUp).toBe(
      "1 follow-up is still open."
    );
    expect(four.body.error.details.plannedActions).toBe(
      "Complete or cancel the 1 planned action before resolving."
    );
    await expectUntouched(worst, "IN_PROGRESS");

    const mixed = await gateTicket();

    await insertAction(mixed);
    await insertAction(mixed, { state: "PLANNED" });

    expect(gateDetails(await resolve(mixed, 1, "  "))).toStrictEqual([
      "plannedActions",
      "resolutionSummary",
    ]);
  });

  it("WF-05 a met gate resolves: status, trimmed summary, version + 1, one history row, the whole Ticket back", async () => {
    const id = await readyTicket();
    const response = await resolve(id, 1, `   ${SUMMARY}  \n`);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      id,
      currentStatus: "RESOLVED",
      resolutionSummary: SUMMARY,
      version: 2,
    });
    expect(response.body.requester).toBeDefined();
    expect(response.body.attachments).toStrictEqual([]);

    const after = await prisma.ticket.findUniqueOrThrow({ where: { id } });

    expect(after.currentStatus).toBe("RESOLVED");
    expect(after.resolutionSummary).toBe(SUMMARY);

    const rows = await history(id);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      fromStatus: "IN_PROGRESS",
      toStatus: "RESOLVED",
      changedById: staff.id,
    });
  });

  it("WF-05 a refused resolve writes no history row, and a stale one is reported before the gate", async () => {
    const id = await gateTicket();
    const refused = await resolve(id, 1);

    expect(refused.status).toBe(400);
    expect(await history(id)).toHaveLength(0);

    await prisma.ticket.update({
      where: { id },
      data: { version: { increment: 1 } },
    });

    const stale = await resolve(id, 1);

    expect(stale.status).toBe(409);
    expect(stale.body.error.code).toBe("STALE_UPDATE");
  });

  it("WF-05 the matrix is checked before the gate: New to Resolved is an invalid transition", async () => {
    const id = await gateTicket("NEW");
    const response = await resolve(id, 1);

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("INVALID_STATUS_TRANSITION");
  });

  it("WF-06 resolving from Open, In Progress, Waiting for Requester and Reopened is gated", async () => {
    for (const from of [
      "OPEN",
      "IN_PROGRESS",
      "WAITING_FOR_REQUESTER",
      "REOPENED",
    ] as const) {
      // oxlint-disable-next-line no-await-in-loop
      const id = await gateTicket(from);
      // oxlint-disable-next-line no-await-in-loop
      const refused = await resolve(id, 1);

      expect(refused.status, from).toBe(400);
      expect(refused.body.error.code, from).toBe("RESOLUTION_GATE_FAILED");
      // oxlint-disable-next-line no-await-in-loop
      await expectUntouched(id, from);

      // oxlint-disable-next-line no-await-in-loop
      await insertAction(id);

      // oxlint-disable-next-line no-await-in-loop
      const allowed = await resolve(id, 1);

      expect(allowed.status, from).toBe(200);
    }
  });

  it("WF-06 a transition to any other status evaluates no gate condition", async () => {
    const cases: [TicketStatus, TicketStatus][] = [
      ["OPEN", "IN_PROGRESS"],
      ["OPEN", "WAITING_FOR_REQUESTER"],
      ["OPEN", "CANCELLED"],
      ["RESOLVED", "CLOSED"],
      ["RESOLVED", "REOPENED"],
      ["CLOSED", "REOPENED"],
    ];

    for (const [from, to] of cases) {
      // A Ticket that fails every condition: no Done Action, an open
      // follow-up and a Planned Action.
      // oxlint-disable-next-line no-await-in-loop
      const id = await gateTicket(from);

      // oxlint-disable-next-line no-await-in-loop
      await insertAction(id, { state: "PLANNED", followUpRequired: true });

      // oxlint-disable-next-line no-await-in-loop
      const response = await patch(staff, id, "status", {
        status: to,
        version: 1,
      });

      expect(response.status, `${from} to ${to}`).toBe(200);
      expect(response.body.currentStatus).toBe(to);
    }
  });

  it("WF-06 a summary sent with any other target is 400 VALIDATION_FAILED, changing nothing", async () => {
    const id = await gateTicket("OPEN");
    const response = await patch(staff, id, "status", {
      status: "IN_PROGRESS",
      version: 1,
      resolutionSummary: SUMMARY,
    });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_FAILED");
    expect(gateDetails(response)).toStrictEqual(["resolutionSummary"]);
    await expectUntouched(id, "OPEN");
  });

  it("WF-07 the Requester's resolved indication does not satisfy the gate", async () => {
    const id = await gateTicket("OPEN");
    const indicated = await as(requester)(
      request(app).post(`/api/tickets/${id}/resolved-indication`)
    );

    expect(indicated.status).toBe(204);

    const indicatedRow = await prisma.ticket.findUniqueOrThrow({
      where: { id },
      select: { version: true, resolvedIndicatedAt: true },
    });

    expect(indicatedRow.resolvedIndicatedAt).not.toBeNull();

    const refused = await resolve(id, indicatedRow.version);

    expect(refused.status).toBe(400);
    expect(refused.body.error.code).toBe("RESOLUTION_GATE_FAILED");
    expect(gateDetails(refused)).toStrictEqual(["doneAction"]);
    const unmoved = await stored(id);

    expect(unmoved.currentStatus).toBe("OPEN");
  });

  it("WF-08 all 64 from/to cells through the endpoint, on a Ticket that satisfies the gate", async () => {
    for (const from of ALL_STATUSES) {
      for (const to of ALL_STATUSES) {
        const allowed = PERMITTED[from].includes(to);
        // oxlint-disable-next-line no-await-in-loop
        const id = await readyTicket(from);
        // oxlint-disable-next-line no-await-in-loop
        const response = await patch(
          staff,
          id,
          "status",
          to === "RESOLVED"
            ? { status: to, version: 1, resolutionSummary: SUMMARY }
            : { status: to, version: 1 }
        );

        expect(response.status, `${from} to ${to}`).toBe(allowed ? 200 : 400);

        if (!allowed) {
          expect(response.body.error.code, `${from} to ${to}`).toBe(
            "INVALID_STATUS_TRANSITION"
          );
        }
      }
    }
  });

  it("WF-08 a Cancelled Ticket stays terminal, even with a summary", async () => {
    const id = await readyTicket("CANCELLED");
    const response = await resolve(id, 1);

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("INVALID_STATUS_TRANSITION");
    await expectUntouched(id, "CANCELLED");
  });

  it("WF-16 a Planned Action blocks, even with a Done Action, no follow-up and a summary; completing or cancelling it clears the block", async () => {
    const id = await gateTicket();

    await insertAction(id);

    const planned = await createAction(
      staff,
      id,
      actionBody({ description: "Order the part." })
    );

    expect(planned.status).toBe(201);

    const refused = await resolve(id, 1);

    expect(refused.status).toBe(400);
    expect(refused.body.error.code).toBe("RESOLUTION_GATE_FAILED");
    expect(gateDetails(refused)).toStrictEqual(["plannedActions"]);
    await expectUntouched(id, "IN_PROGRESS");

    const completed = await completeAction(staff, planned.body.id, {
      version: planned.body.version,
      result: "Part fitted.",
    });

    expect(completed.status).toBe(200);

    const afterComplete = await resolve(id, 1);

    expect(afterComplete.status).toBe(200);

    // And cancelling instead of completing clears it just the same.
    const other = await readyTicket();
    const toCancel = await createAction(staff, other, actionBody());

    const blocked = await resolve(other, 1);

    expect(blocked.status).toBe(400);

    const cancelled = await cancelAction(staff, toCancel.body.id, {
      version: toCancel.body.version,
      cancelReason: "No longer needed.",
    });

    expect(cancelled.status).toBe(200);

    const afterCancel = await resolve(other, 1);

    expect(afterCancel.status).toBe(200);
  });
});
