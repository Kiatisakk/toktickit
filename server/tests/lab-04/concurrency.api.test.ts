import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { ACTIVE_STAFF, SECOND_REQUESTER } from "../../prisma/accounts.js";
import { app } from "../../src/app.js";
import { prisma } from "../../src/prisma.js";
import type { SignedInUser } from "../lab-03/support/signIn.js";
import { signInAs } from "../lab-03/support/signIn.js";
import {
  actionBody,
  cancelAction,
  completeAction,
  createAction,
  createTicket,
  editAction,
  holdTicketLock,
  holdUserDeactivation,
  removeTickets,
  seedAction,
  sleep,
} from "./support/actions.js";

/**
 * Concurrent Action writes, with real simultaneous requests (CONC-02) and a
 * held Ticket lock (BR-16).
 *
 * The Resolution-gate races (CONC-01, CONC-03) arrive with the gate itself.
 * What can be proved here, without it, is the half this Issue owns: every
 * Action write takes the Ticket row's lock first and re-reads the Ticket's
 * status under it, so a write that was already waiting when a resolution
 * committed is refused instead of landing on a Resolved Ticket.
 */

const PREFIX = "ACTIONS-CONC";
const ROUNDS = 12;
const HOLD_MS = 400;

interface Answer {
  status: number;
  body: {
    error?: { code?: string; details?: Record<string, string> };
    result?: string;
    description?: string;
  };
}

let staffA: SignedInUser;
let staffB: SignedInUser;
let requesterId = 0;
let ticket = 0;

const statusesOf = (answers: Answer[]): number[] =>
  answers.map((answer) => answer.status).toSorted((a, b) => a - b);

const storedAction = (id: number) =>
  prisma.actionTaken.findUniqueOrThrow({ where: { id } });

beforeAll(async () => {
  await removeTickets(PREFIX);
  [staffA, staffB] = await Promise.all([
    signInAs(ACTIVE_STAFF),
    signInAs({ email: "sarah.johnson@example.ac.th", password: "ItStaff2!" }),
  ]);

  const requester = await prisma.user.findUniqueOrThrow({
    where: { email: SECOND_REQUESTER.email },
    select: { id: true },
  });

  requesterId = requester.id;
});

beforeEach(async () => {
  await removeTickets(PREFIX);
  ticket = await createTicket(PREFIX, requesterId);
});

afterAll(async () => {
  await removeTickets(PREFIX);
  await prisma.$disconnect();
});

describe("two writes to one Action at once", () => {
  it("CONC-02 two completions: exactly one 200 and one 409 STALE_UPDATE, one state change", async () => {
    for (let round = 0; round < ROUNDS; round += 1) {
      // Rounds are sequential on purpose: each races its own pair.
      // oxlint-disable-next-line no-await-in-loop
      const { id, version } = await seedAction(staffA, ticket);
      // oxlint-disable-next-line no-await-in-loop
      const answers = await Promise.all([
        completeAction(staffA, id, { version, result: "From A" }),
        completeAction(staffB, id, { version, result: "From B" }),
      ]);

      expect(statusesOf(answers), `round ${round}`).toStrictEqual([200, 409]);

      const loser = answers.find((a) => a.status === 409);
      const winner = answers.find((a) => a.status === 200);

      expect(loser?.body.error?.code).toBe("STALE_UPDATE");

      // oxlint-disable-next-line no-await-in-loop
      const stored = await storedAction(id);

      expect(stored.state).toBe("DONE");
      expect(stored.version).toBe(version + 1);
      expect(stored.result).toBe(winner?.body.result);
    }
  });

  it("CONC-02 a completion and a cancellation: exactly one wins and the loser is stale", async () => {
    for (let round = 0; round < ROUNDS; round += 1) {
      // oxlint-disable-next-line no-await-in-loop
      const { id, version } = await seedAction(staffA, ticket, {
        result: "Ready",
      });
      // oxlint-disable-next-line no-await-in-loop
      const answers = await Promise.all([
        completeAction(staffA, id, { version }),
        cancelAction(staffB, id, { version, cancelReason: "Not needed" }),
      ]);

      expect(statusesOf(answers), `round ${round}`).toStrictEqual([200, 409]);
      expect(answers.find((a) => a.status === 409)?.body.error?.code).toBe(
        "STALE_UPDATE"
      );

      // oxlint-disable-next-line no-await-in-loop
      const stored = await storedAction(id);

      expect(stored.version).toBe(version + 1);
    }
  });

  it("CONC-02 two edits from one version: one saves, the other is stale and its text is not stored", async () => {
    const { id, version } = await seedAction(staffA, ticket);
    const answers = await Promise.all([
      editAction(staffA, id, { version, description: "From A" }),
      editAction(staffB, id, { version, description: "From B" }),
    ]);

    expect(statusesOf(answers)).toStrictEqual([200, 409]);

    const stored = await storedAction(id);
    const winner = answers.find((a) => a.status === 200);

    expect(stored.description).toBe(winner?.body.description);
    expect(stored.version).toBe(version + 1);
  });
});

describe("a Ticket resolved while an Action write is waiting (BR-16)", () => {
  /**
   * Holds the Ticket row's lock, starts `write` while it is held, then commits
   * the Ticket as Resolved and returns what the write was answered.
   *
   * Without the lock a write started during the hold reads the committed
   * status, In Progress, and lands. With it the write waits, and reads
   * Resolved when it is let in.
   */
  const writeDuringResolution = async (
    write: () => Promise<Answer>
  ): Promise<Answer> => {
    const hold = await holdTicketLock(ticket, async (tx) => {
      await tx.ticket.update({
        where: { id: ticket },
        data: { currentStatus: "RESOLVED" },
      });
    });
    // A Supertest request is lazy: it is only sent once something awaits it.
    // Wrapping it starts it now, while the lock is held, which is the point.
    const pending = (async () => await write())();

    await sleep(HOLD_MS);
    hold.release();
    await hold.finished;

    return pending;
  };

  it("CONC-04 a create is refused TICKET_NOT_ACTIONABLE", async () => {
    const answer = await writeDuringResolution(() =>
      createAction(staffA, ticket, actionBody())
    );

    expect(answer.status).toBe(409);
    expect(answer.body.error?.code).toBe("TICKET_NOT_ACTIONABLE");
    expect(
      await prisma.actionTaken.count({ where: { ticketId: ticket } })
    ).toBe(0);
  });

  it("CONC-04 an edit that sets Follow-Up Required is refused TICKET_NOT_ACTIONABLE", async () => {
    const { id, version } = await seedAction(staffA, ticket);
    const answer = await writeDuringResolution(() =>
      editAction(staffA, id, {
        version,
        followUpRequired: true,
        followUpNote: "Would be an open follow-up",
      })
    );
    const stored = await storedAction(id);

    expect(answer.status).toBe(409);
    expect(answer.body.error?.code).toBe("TICKET_NOT_ACTIONABLE");
    expect(stored.followUpRequired).toBe(false);
  });

  it("CONC-04 a completion is refused TICKET_NOT_ACTIONABLE", async () => {
    const { id, version } = await seedAction(staffA, ticket, { result: "r" });
    const answer = await writeDuringResolution(() =>
      completeAction(staffA, id, { version })
    );
    const stored = await storedAction(id);

    expect(answer.status).toBe(409);
    expect(answer.body.error?.code).toBe("TICKET_NOT_ACTIONABLE");
    expect(stored.state).toBe("PLANNED");
  });

  it("CONC-04 a cancellation is refused TICKET_NOT_ACTIONABLE", async () => {
    const { id, version } = await seedAction(staffA, ticket);
    const answer = await writeDuringResolution(() =>
      cancelAction(staffA, id, { version, cancelReason: "x" })
    );
    const stored = await storedAction(id);

    expect(answer.status).toBe(409);
    expect(answer.body.error?.code).toBe("TICKET_NOT_ACTIONABLE");
    expect(stored.state).toBe("PLANNED");
  });
});

describe("an unrelated Ticket is not held up", () => {
  it("CONC-04 a write to another Ticket proceeds while one Ticket's lock is held", async () => {
    const other = await createTicket(PREFIX, requesterId);
    const hold = await holdTicketLock(ticket);

    const answer = await createAction(staffA, other, actionBody());

    hold.release();
    await hold.finished;

    expect(answer.status).toBe(201);
  });
});

describe("a performer deactivated while an Action write is in flight (BR-07)", () => {
  const PERFORMER_EMAIL = "actions-conc-performer@example.ac.th";
  let performerId = 0;

  beforeEach(async () => {
    await prisma.user.deleteMany({ where: { email: PERFORMER_EMAIL } });

    const performer = await prisma.user.create({
      data: {
        name: "Actions Conc Performer",
        email: PERFORMER_EMAIL,
        role: "IT_STAFF",
        passwordHash: "!",
      },
      select: { id: true },
    });

    performerId = performer.id;
  });

  afterAll(async () => {
    // The Actions name the performer, so they go first.
    await removeTickets(PREFIX);
    await prisma.user.deleteMany({ where: { email: PERFORMER_EMAIL } });
  });

  /**
   * Holds an uncommitted deactivation of the performer, starts `write` while it
   * is pending, then commits the deactivation and returns what the write was
   * answered.
   *
   * Without a lock on the performer's row the write reads the committed row,
   * which still says active, and commits while the deactivation is pending.
   * With it the write waits, and reads the deactivated row when let in.
   */
  const writeDuringDeactivation = async (
    write: () => Promise<Answer>
  ): Promise<Answer> => {
    const hold = await holdUserDeactivation(performerId);
    const pending = (async () => await write())();

    await sleep(HOLD_MS);
    hold.release();
    await hold.finished;

    return pending;
  };

  it("CONC-05 a create naming that performer is refused ACTION_ASSIGNEE_INELIGIBLE and stores nothing", async () => {
    const answer = await writeDuringDeactivation(() =>
      createAction(staffA, ticket, actionBody({ performedById: performerId }))
    );

    expect(answer.status).toBe(400);
    expect(answer.body.error?.code).toBe("ACTION_ASSIGNEE_INELIGIBLE");
    expect(
      await prisma.actionTaken.count({ where: { ticketId: ticket } })
    ).toBe(0);
  });

  it("CONC-05 an edit naming that performer is refused and the Action keeps its performer", async () => {
    const { id, version } = await seedAction(staffA, ticket);
    const answer = await writeDuringDeactivation(() =>
      editAction(staffA, id, { version, performedById: performerId })
    );
    const stored = await storedAction(id);

    expect(answer.status).toBe(400);
    expect(answer.body.error?.code).toBe("ACTION_ASSIGNEE_INELIGIBLE");
    expect(stored.performedById).not.toBe(performerId);
    expect(stored.version).toBe(version);
  });
});

/* ------------------------------------ the resolution gate against Action writes -- */

const statusOf = async (id: number): Promise<string> => {
  const row = await prisma.ticket.findUniqueOrThrow({
    where: { id },
    select: { currentStatus: true },
  });

  return row.currentStatus;
};

describe("a resolution racing an Action write (BR-16, AC-27)", () => {
  const SUMMARY = "Replaced the access point.";

  const resolveTicket = async (
    who: SignedInUser,
    id: number,
    version = 1
  ): Promise<Answer> => {
    const response = await request(app)
      .patch(`/api/staff/tickets/${id}/status`)
      .set("Cookie", who.cookie)
      .send({ status: "RESOLVED", version, resolutionSummary: SUMMARY });

    return { status: response.status, body: response.body };
  };

  /** A Ticket that satisfies the whole gate: one Done Action. */
  const readyTicket = async (): Promise<number> => {
    const id = await createTicket(PREFIX, requesterId);

    await prisma.actionTaken.create({
      data: {
        ticketId: id,
        recordedById: staffA.id,
        performedById: staffA.id,
        actionAt: new Date(),
        description: "Already done.",
        result: "Done.",
        state: "DONE",
        requestId: `ready-${String(id)}`,
      },
    });

    return id;
  };

  it("CONC-01 over repeated rounds of simultaneous requests, no Ticket ends Resolved with an open follow-up", async () => {
    let resolvedFirst = 0;
    let createdFirst = 0;

    for (let round = 0; round < ROUNDS; round += 1) {
      // Rounds are sequential on purpose: each races its own pair.
      // oxlint-disable-next-line no-await-in-loop
      const id = await readyTicket();
      // oxlint-disable-next-line no-await-in-loop
      const [resolved, created] = await Promise.all([
        resolveTicket(staffA, id),
        createAction(
          staffB,
          id,
          actionBody({
            description: "Needs a check next week.",
            followUpRequired: true,
            followUpNote: "Check next week.",
          })
        ),
      ]);

      // Exactly one of the two lands: the follow-up first (the resolve is
      // refused, and says why) or the resolution first (the create is refused).
      if (resolved.status === 200) {
        resolvedFirst += 1;
        expect(created.status, `round ${round}`).toBe(409);
        expect(created.body.error?.code).toBe("TICKET_NOT_ACTIONABLE");
      } else {
        createdFirst += 1;
        expect(resolved.status, `round ${round}`).toBe(400);
        expect(resolved.body.error?.code).toBe("RESOLUTION_GATE_FAILED");
        expect(created.status).toBe(201);
      }

      // oxlint-disable-next-line no-await-in-loop
      const status = await statusOf(id);
      // oxlint-disable-next-line no-await-in-loop
      const openFollowUps = await prisma.actionTaken.count({
        where: { ticketId: id, followUpRequired: true },
      });

      expect(
        status === "RESOLVED" && openFollowUps > 0,
        `round ${round}: Resolved with an open follow-up`
      ).toBe(false);
    }

    expect(resolvedFirst + createdFirst).toBe(ROUNDS);
  });

  it("CONC-01 a follow-up committed while the resolution waits is seen by the gate", async () => {
    const id = await readyTicket();
    const hold = await holdTicketLock(id, async (tx) => {
      await tx.actionTaken.create({
        data: {
          ticketId: id,
          recordedById: staffA.id,
          performedById: staffA.id,
          actionAt: new Date(),
          description: "Needs a check next week.",
          result: "Checked.",
          state: "DONE",
          followUpRequired: true,
          followUpNote: "Check next week.",
          requestId: `follow-up-${String(id)}`,
        },
      });
    });
    // Started while the lock is held, so it is queued behind it.
    const pending = (async () => await resolveTicket(staffA, id))();

    await sleep(HOLD_MS);
    hold.release();
    await hold.finished;

    const answer = await pending;

    expect(answer.status).toBe(400);
    expect(answer.body.error?.code).toBe("RESOLUTION_GATE_FAILED");
    expect(Object.keys(answer.body.error?.details ?? {})).toStrictEqual([
      "openFollowUp",
    ]);
    expect(await statusOf(id)).toBe("IN_PROGRESS");
  });

  it("CONC-03 an edit turning Follow-Up Required on, sent with a resolution, never leaves a Resolved Ticket with an open follow-up", async () => {
    for (let round = 0; round < ROUNDS; round += 1) {
      // oxlint-disable-next-line no-await-in-loop
      const id = await readyTicket();
      // oxlint-disable-next-line no-await-in-loop
      const planned = await seedAction(staffA, id);
      // oxlint-disable-next-line no-await-in-loop
      const [edited, resolved] = await Promise.all([
        editAction(staffB, planned.id, {
          version: planned.version,
          followUpRequired: true,
          followUpNote: "Check next week.",
        }),
        resolveTicket(staffA, id),
      ]);

      // The Planned Action blocks the resolution on its own (BR-16 (c)); the
      // edit commits either way, and the Ticket is never left Resolved with a
      // follow-up open.
      expect(edited.status, `round ${round}`).toBe(200);
      expect(resolved.status, `round ${round}`).toBe(400);
      expect(resolved.body.error?.code).toBe("RESOLUTION_GATE_FAILED");

      // oxlint-disable-next-line no-await-in-loop
      expect(await statusOf(id)).toBe("IN_PROGRESS");
    }
  });

  it("CONC-03 an edit committed while the resolution waits is seen by the gate", async () => {
    const id = await readyTicket();
    const planned = await seedAction(staffA, id);
    const hold = await holdTicketLock(id, async (tx) => {
      await tx.actionTaken.update({
        where: { id: planned.id },
        data: {
          followUpRequired: true,
          followUpNote: "Check next week.",
          version: { increment: 1 },
        },
      });
    });
    const pending = (async () => await resolveTicket(staffA, id))();

    await sleep(HOLD_MS);
    hold.release();
    await hold.finished;

    const answer = await pending;

    expect(answer.status).toBe(400);
    expect(answer.body.error?.code).toBe("RESOLUTION_GATE_FAILED");
    expect(await statusOf(id)).toBe("IN_PROGRESS");
  });

  it("CONC-06 a status change committed while the resolution waits answers 409 STALE_UPDATE, not the gate's 400", async () => {
    // No Done Action, so the gate would refuse this Ticket if it were reached.
    const id = await createTicket(PREFIX, requesterId);
    const hold = await holdTicketLock(id, async (tx) => {
      await tx.ticket.update({
        where: { id },
        data: { itPriority: "HIGH", version: { increment: 1 } },
      });
    });
    // Sent with version 1, which was the stored one when it passed the early
    // check and is no longer by the time it holds the lock.
    const pending = (async () => await resolveTicket(staffA, id))();

    await sleep(HOLD_MS);
    hold.release();
    await hold.finished;

    const answer = await pending;

    expect(answer.status).toBe(409);
    expect(answer.body.error?.code).toBe("STALE_UPDATE");
    expect(await statusOf(id)).toBe("IN_PROGRESS");
  });

  it("CONC-01 a resolution does not hold up a write to another Ticket", async () => {
    const id = await readyTicket();
    const other = await createTicket(PREFIX, requesterId);
    const hold = await holdTicketLock(id);
    const pending = (async () => await resolveTicket(staffA, id))();

    await sleep(HOLD_MS / 4);

    const answer = await createAction(staffB, other, actionBody());

    hold.release();
    await hold.finished;
    await pending;

    expect(answer.status).toBe(201);
  });
});
