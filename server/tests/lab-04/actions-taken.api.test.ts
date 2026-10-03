import { randomUUID } from "node:crypto";

import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  accountByEmail,
  ACTIVE_REQUESTER,
  ACTIVE_STAFF,
  ADMINISTRATOR,
  INACTIVE_STAFF,
  MUST_CHANGE_REQUESTER,
  SECOND_REQUESTER,
} from "../../prisma/accounts.js";
import { app } from "../../src/app.js";
import type { ActionTaken } from "../../src/generated/prisma/client.js";
import { prisma } from "../../src/prisma.js";
import type { SignedInUser } from "../lab-03/support/signIn.js";
import { signInAs } from "../lab-03/support/signIn.js";
import {
  actionBody,
  as,
  cancelAction,
  completeAction,
  createAction,
  createTicket,
  editAction,
  listActions,
  removeTickets,
  seedAction,
  sleep,
} from "./support/actions.js";

/**
 * Actions Taken — the API (api-spec.md §4).
 *
 * Covers API-01 to API-21, and AC-44 for the Action endpoints. The Ticket
 * lock's effect on simultaneous writes is in concurrency.api.test.ts.
 */

const PREFIX = "ACTIONS-API";
const MISSING_ID = 99_999_999;
const SECOND_STAFF = accountByEmail("sarah.johnson@example.ac.th");

let requesterA: SignedInUser;
let requesterB: SignedInUser;
let staff: SignedInUser;
let staffB: SignedInUser;
let admin: SignedInUser;
let gated: SignedInUser;
let inactiveStaffId = 0;

let ticket = 0;

const ENVELOPE_KEYS = ["code", "message"];

const errorOf = (response: { body: { error?: Record<string, unknown> } }) =>
  response.body.error ?? {};

const storedAction = (id: number) =>
  prisma.actionTaken.findUniqueOrThrow({ where: { id } });

const storedField = async <K extends keyof ActionTaken>(
  id: number,
  key: K
): Promise<ActionTaken[K]> => {
  const row = await storedAction(id);

  return row[key];
};

const actionCount = (ticketId: number) =>
  prisma.actionTaken.count({ where: { ticketId } });

beforeAll(async () => {
  await removeTickets(PREFIX);

  [requesterA, requesterB, staff, staffB, admin, gated] = await Promise.all([
    signInAs(ACTIVE_REQUESTER),
    signInAs(SECOND_REQUESTER),
    signInAs(ACTIVE_STAFF),
    signInAs(SECOND_STAFF),
    signInAs(ADMINISTRATOR),
    signInAs(MUST_CHANGE_REQUESTER),
  ]);

  const inactive = await prisma.user.findUniqueOrThrow({
    where: { email: INACTIVE_STAFF.email },
    select: { id: true },
  });

  inactiveStaffId = inactive.id;
});

beforeEach(async () => {
  await removeTickets(PREFIX);
  ticket = await createTicket(PREFIX, requesterA.id);
});

afterAll(async () => {
  await removeTickets(PREFIX);
  await prisma.$disconnect();
});

describe("creating an Action", () => {
  it("API-01 saves it under the path's Ticket, recorded by the caller and performed by the named staff", async () => {
    const response = await createAction(
      staff,
      ticket,
      actionBody({
        performedById: staffB.id,
        actionAt: "2026-09-25T03:15:00.000Z",
        description: "  Replaced the access point.  ",
        result: "Signal restored.",
        attachmentNotes: "Photo in IT-2026/AP-3.",
        followUpRequired: true,
        followUpNote: "Confirm after a week.",
      })
    );

    expect(response.status).toBe(201);
    expect(response.body).toStrictEqual({
      id: expect.any(Number),
      ticketId: ticket,
      state: "PLANNED",
      actionAt: "2026-09-25T03:15:00.000Z",
      description: "Replaced the access point.",
      result: "Signal restored.",
      followUpRequired: true,
      followUpNote: "Confirm after a week.",
      followUpState: "OPEN",
      followsUpId: null,
      attachmentNotes: "Photo in IT-2026/AP-3.",
      cancelReason: null,
      recordedBy: { id: staff.id, name: ACTIVE_STAFF.name },
      performedBy: { id: staffB.id, name: SECOND_STAFF.name },
      version: 1,
      createdAt: expect.any(String),
      updatedAt: expect.any(String),
    });
    expect(response.body).not.toHaveProperty("requestId");

    const stored = await storedAction(response.body.id);

    expect(stored.ticketId).toBe(ticket);
    expect(stored.recordedById).toBe(staff.id);
    expect(stored.performedById).toBe(staffB.id);
  });

  it("API-01 an Administrator creates one too, and an omitted time is the server's now", async () => {
    const before = Date.now();
    const response = await createAction(admin, ticket);

    expect(response.status).toBe(201);
    expect(response.body.recordedBy.id).toBe(admin.id);
    expect(Math.abs(Date.parse(response.body.actionAt) - before)).toBeLessThan(
      10_000
    );
    expect(response.body.followUpState).toBe("NOT_REQUIRED");
    expect(response.body.result).toBeNull();
  });

  it("API-02 performed by the creator when no performer is named", async () => {
    const response = await createAction(staff, ticket);

    expect(response.status).toBe(201);
    expect(response.body.performedBy.id).toBe(staff.id);
  });

  it("API-02 a recorder, state, ticket or version in the body is refused and nothing is stored", async () => {
    for (const forged of [
      { recordedById: staffB.id },
      { state: "DONE" },
      { ticketId: ticket + 1 },
      { version: 5 },
      { id: 1 },
      { createdAt: "2001-01-01T00:00:00.000Z" },
    ]) {
      const field = Object.keys(forged)[0] as string;
      // oxlint-disable-next-line no-await-in-loop
      const response = await createAction(staff, ticket, actionBody(forged));

      expect(response.status).toBe(400);
      expect(errorOf(response)["code"]).toBe("VALIDATION_FAILED");
      expect(Object.keys(errorOf(response)["details"] as object)).toContain(
        field
      );
    }

    expect(await actionCount(ticket)).toBe(0);
  });

  it("API-03 the recorder is the session user even when someone else is named", async () => {
    const response = await createAction(
      staff,
      ticket,
      actionBody({ recordedById: admin.id })
    );

    expect(response.status).toBe(400);

    const ok = await createAction(staff, ticket, actionBody());

    expect(ok.body.recordedBy.id).toBe(staff.id);
  });

  it("API-03 an Administrator may be named as performer", async () => {
    const response = await createAction(
      staff,
      ticket,
      actionBody({ performedById: admin.id })
    );

    expect(response.status).toBe(201);
    expect(response.body.performedBy.id).toBe(admin.id);
  });

  it("API-03 a ticket that does not exist is 404, and a bad body is refused first", async () => {
    const missing = await createAction(staff, MISSING_ID);

    expect(missing.status).toBe(404);
    expect(errorOf(missing)["code"]).toBe("TICKET_NOT_FOUND");

    const badBody = await createAction(
      staff,
      MISSING_ID,
      actionBody({ description: "" })
    );

    expect(badBody.status).toBe(400);
  });

  it("API-03 a path that is not an id is 404", async () => {
    const response = await as(staff)(
      request(app).post("/api/tickets/abc/actions")
    ).send(actionBody());

    expect(response.status).toBe(404);
    expect(errorOf(response)["code"]).toBe("TICKET_NOT_FOUND");
  });

  it("API-03 an Action may be created for a Ticket someone else owns", async () => {
    const owned = await createTicket(PREFIX, requesterA.id, {
      ownerId: staffB.id,
    });
    const response = await createAction(staff, owned);

    expect(response.status).toBe(201);
  });
});

describe("the performer", () => {
  it("API-03 an inactive staff member, a Requester and an unknown id are each refused on create", async () => {
    for (const performedById of [inactiveStaffId, requesterA.id, MISSING_ID]) {
      // oxlint-disable-next-line no-await-in-loop
      const response = await createAction(
        staff,
        ticket,
        actionBody({ performedById })
      );

      expect(response.status).toBe(400);
      expect(errorOf(response)["code"]).toBe("ACTION_ASSIGNEE_INELIGIBLE");
    }

    expect(await actionCount(ticket)).toBe(0);
  });

  it("API-04 the same three are refused on PATCH and the Action is unchanged", async () => {
    const { id, version } = await seedAction(staff, ticket);
    const before = await storedAction(id);

    for (const performedById of [inactiveStaffId, requesterA.id, MISSING_ID]) {
      // oxlint-disable-next-line no-await-in-loop
      const response = await editAction(staff, id, { version, performedById });

      expect(response.status).toBe(400);
      expect(errorOf(response)["code"]).toBe("ACTION_ASSIGNEE_INELIGIBLE");
    }

    expect(await storedAction(id)).toStrictEqual(before);
  });

  it("API-18 an Action performed by one staff member on another's Ticket keeps both identities", async () => {
    const owned = await createTicket(PREFIX, requesterA.id, {
      ownerId: staff.id,
    });
    const created = await createAction(
      staffB,
      owned,
      actionBody({ performedById: staffB.id })
    );

    expect(created.status).toBe(201);

    const listed = await listActions(staff, owned);
    const row = await prisma.ticket.findUniqueOrThrow({
      where: { id: owned },
      select: { ticketOwnerId: true },
    });

    expect(row.ticketOwnerId).toBe(staff.id);
    expect(listed.body.data).toHaveLength(1);
    expect(listed.body.data[0].performedBy.id).toBe(staffB.id);
    expect(listed.body.data[0].recordedBy.id).toBe(staffB.id);
  });
});

describe("validation", () => {
  it("API-05 each malformed field is refused with the field named", async () => {
    const cases: [string, Record<string, unknown>][] = [
      ["description", { description: "" }],
      ["description", { description: "   " }],
      ["description", { description: "x".repeat(2001) }],
      ["description", { description: 12 }],
      ["followUpNote", { followUpRequired: true }],
      [
        "followUpNote",
        { followUpRequired: true, followUpNote: "x".repeat(1001) },
      ],
      ["followUpNote", { followUpRequired: false, followUpNote: "A note" }],
      ["followUpNote", { followUpNote: "A note" }],
      ["followUpRequired", { followUpRequired: "yes" }],
      ["result", { result: "x".repeat(2001) }],
      ["attachmentNotes", { attachmentNotes: "x".repeat(1001) }],
      ["actionAt", { actionAt: "yesterday" }],
      [
        "actionAt",
        { actionAt: new Date(Date.now() + 5 * 60_000).toISOString() },
      ],
      ["performedById", { performedById: "7" }],
      ["followsUpId", { followsUpId: "x" }],
      ["colour", { colour: "green" }],
    ];

    for (const [field, overrides] of cases) {
      // oxlint-disable-next-line no-await-in-loop
      const response = await createAction(staff, ticket, actionBody(overrides));

      expect(response.status, JSON.stringify(overrides)).toBe(400);
      expect(errorOf(response)["code"]).toBe("VALIDATION_FAILED");
      expect(Object.keys(errorOf(response)["details"] as object)).toContain(
        field
      );
    }

    expect(await actionCount(ticket)).toBe(0);
  });

  it("API-05 a missing description, a non-object body and a missing body are refused", async () => {
    const { description: _omitted, ...withoutDescription } = actionBody();
    const missing = await createAction(staff, ticket, withoutDescription);

    expect(missing.status).toBe(400);
    expect(Object.keys(errorOf(missing)["details"] as object)).toContain(
      "description"
    );

    for (const body of [[], "text", null]) {
      // oxlint-disable-next-line no-await-in-loop
      const response = await createAction(staff, ticket, body);

      expect(response.status).toBe(400);
    }
  });

  it("API-05 the limits themselves are accepted", async () => {
    const response = await createAction(
      staff,
      ticket,
      actionBody({
        description: "x".repeat(2000),
        result: "y".repeat(2000),
        followUpRequired: true,
        followUpNote: "z".repeat(1000),
        attachmentNotes: "w".repeat(1000),
        actionAt: new Date(Date.now() + 30_000).toISOString(),
      })
    );

    expect(response.status).toBe(201);
  });
});

describe("listing", () => {
  it("API-06 orders by action time then id, with ties settled by id", async () => {
    const late = await seedAction(staff, ticket, {
      actionAt: "2026-09-25T09:00:00.000Z",
      description: "late",
    });
    const tieFirst = await seedAction(staff, ticket, {
      actionAt: "2026-09-25T08:00:00.000Z",
      description: "tie-first",
    });
    const tieSecond = await seedAction(staff, ticket, {
      actionAt: "2026-09-25T08:00:00.000Z",
      description: "tie-second",
    });
    const early = await seedAction(staff, ticket, {
      actionAt: "2026-09-25T07:00:00.000Z",
      description: "early",
    });

    const response = await listActions(staff, ticket);

    expect(response.status).toBe(200);
    expect(response.body.data.map((a: { id: number }) => a.id)).toStrictEqual([
      early.id,
      tieFirst.id,
      tieSecond.id,
      late.id,
    ]);

    for (const row of response.body.data) {
      expect(row.recordedBy).toStrictEqual({
        id: staff.id,
        name: ACTIVE_STAFF.name,
      });
      expect(row.performedBy.id).toBe(staff.id);
      expect(row.state).toBe("PLANNED");
      expect(row.followUpState).toBe("NOT_REQUIRED");
    }
  });

  it("API-06 a Ticket with no Actions answers an empty list, and a missing one 404", async () => {
    const empty = await listActions(staff, ticket);

    expect(empty.status).toBe(200);
    expect(empty.body).toStrictEqual({ data: [] });

    const missing = await listActions(staff, MISSING_ID);

    expect(missing.status).toBe(404);
    expect(errorOf(missing)["code"]).toBe("TICKET_NOT_FOUND");
  });

  it("API-16 a Requester reads every Action and every field on their own Ticket, and no Internal Note", async () => {
    const { id } = await seedAction(staff, ticket, {
      description: "Visible work",
      attachmentNotes: "Photo in the shared folder",
    });

    await prisma.internalNote.create({
      data: {
        ticketId: ticket,
        authorId: staff.id,
        body: "PRIVATE-NOTE-CONTENT",
      },
    });

    const asRequester = await listActions(requesterA, ticket);
    const asStaff = await listActions(staff, ticket);

    expect(asRequester.status).toBe(200);
    expect(asRequester.body).toStrictEqual(asStaff.body);
    expect(asRequester.body.data[0].id).toBe(id);
    expect(asRequester.body.data[0].attachmentNotes).toBe(
      "Photo in the shared folder"
    );
    expect(JSON.stringify(asRequester.body)).not.toContain(
      "PRIVATE-NOTE-CONTENT"
    );
  });

  it("API-16 another Requester's Ticket answers exactly as a Ticket that does not exist", async () => {
    await seedAction(staff, ticket);

    const foreign = await listActions(requesterB, ticket);
    const missing = await listActions(requesterB, MISSING_ID);

    expect(foreign.status).toBe(404);
    expect(foreign.body).toStrictEqual(missing.body);
    expect(errorOf(foreign)["code"]).toBe("TICKET_NOT_FOUND");
  });

  it("API-16 a Requester cannot create, edit, complete or cancel", async () => {
    const { id, version } = await seedAction(staff, ticket);

    const answers = await Promise.all([
      createAction(requesterA, ticket),
      editAction(requesterA, id, { version, description: "x" }),
      completeAction(requesterA, id, { version, result: "x" }),
      cancelAction(requesterA, id, { version, cancelReason: "x" }),
    ]);

    for (const answer of answers) {
      expect(answer.status).toBe(403);
      expect(errorOf(answer)["code"]).toBe("FORBIDDEN");
    }

    expect(await storedField(id, "version")).toBe(version);
  });
});

describe("editing, completing and cancelling", () => {
  it("API-07 a staff member who is neither recorder, performer nor Owner edits a Planned Action", async () => {
    const owned = await createTicket(PREFIX, requesterA.id, {
      ownerId: admin.id,
    });
    const { id, version } = await seedAction(staff, owned);

    const response = await editAction(staffB, id, {
      version,
      description: "Edited by a colleague",
      result: "Interim result",
      followUpRequired: true,
      followUpNote: "Check again Friday",
      attachmentNotes: "See folder",
      actionAt: "2026-09-24T01:00:00.000Z",
      performedById: admin.id,
    });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      description: "Edited by a colleague",
      result: "Interim result",
      followUpRequired: true,
      followUpNote: "Check again Friday",
      attachmentNotes: "See folder",
      actionAt: "2026-09-24T01:00:00.000Z",
      state: "PLANNED",
      version: version + 1,
      recordedBy: { id: staff.id },
      performedBy: { id: admin.id },
    });
  });

  it("API-07 an edit changes only what was sent, and clearing the flag clears the note", async () => {
    const { id, version } = await seedAction(staff, ticket, {
      followUpRequired: true,
      followUpNote: "Check back",
    });

    const response = await editAction(staff, id, {
      version,
      followUpRequired: false,
    });

    expect(response.status).toBe(200);
    expect(response.body.followUpRequired).toBe(false);
    expect(response.body.followUpNote).toBeNull();
    expect(response.body.description).toBe("Replaced the faulty access point.");
  });

  it("API-07 an edit that leaves follow-up required without a note is refused", async () => {
    const { id, version } = await seedAction(staff, ticket);

    const response = await editAction(staff, id, {
      version,
      followUpRequired: true,
    });

    expect(response.status).toBe(400);
    expect(Object.keys(errorOf(response)["details"] as object)).toStrictEqual([
      "followUpNote",
    ]);
    expect(await storedField(id, "followUpRequired")).toBe(false);
  });

  it("API-07 fields that are fixed at creation are refused on edit", async () => {
    const { id, version } = await seedAction(staff, ticket);

    for (const field of [
      "ticketId",
      "recordedById",
      "state",
      "followsUpId",
      "cancelReason",
      "createdAt",
      "updatedAt",
      "requestId",
    ]) {
      // oxlint-disable-next-line no-await-in-loop
      const response = await editAction(staff, id, {
        version,
        description: "x",
        [field]: 1,
      });

      expect(response.status, field).toBe(400);
      expect(Object.keys(errorOf(response)["details"] as object)).toContain(
        field
      );
    }

    expect(await storedField(id, "version")).toBe(version);
  });

  it("API-07 an edit with nothing to change is refused", async () => {
    const { id, version } = await seedAction(staff, ticket);
    const response = await editAction(staff, id, { version });

    expect(response.status).toBe(400);
    expect(errorOf(response)["code"]).toBe("VALIDATION_FAILED");
  });

  it("API-08 completes with a result, and the version goes up", async () => {
    const { id, version } = await seedAction(staff, ticket);

    const response = await completeAction(staffB, id, {
      version,
      result: "  Signal restored.  ",
    });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      state: "DONE",
      result: "Signal restored.",
      version: version + 1,
    });
  });

  it("API-08 refuses completion with no result stored or supplied", async () => {
    const { id, version } = await seedAction(staff, ticket);

    for (const body of [{ version }, { version, result: "   " }]) {
      // oxlint-disable-next-line no-await-in-loop
      const response = await completeAction(staff, id, body);

      expect(response.status).toBe(400);
      expect(Object.keys(errorOf(response)["details"] as object)).toStrictEqual(
        ["result"]
      );
    }

    const stored = await storedAction(id);

    expect(stored.state).toBe("PLANNED");
    expect(stored.version).toBe(version);
  });

  it("API-08 completes on a stored result alone, and a supplied result replaces it", async () => {
    const stored = await seedAction(staff, ticket, { result: "Draft result" });
    const replaced = await seedAction(staff, ticket, {
      result: "Draft result",
    });

    const keep = await completeAction(staff, stored.id, {
      version: stored.version,
    });
    const replace = await completeAction(staff, replaced.id, {
      version: replaced.version,
      result: "Final result",
    });

    expect(keep.status).toBe(200);
    expect(keep.body.result).toBe("Draft result");
    expect(replace.status).toBe(200);
    expect(replace.body.result).toBe("Final result");
  });

  it("API-09 cancels with a reason and keeps it", async () => {
    const { id, version } = await seedAction(staff, ticket);

    const response = await cancelAction(staffB, id, {
      version,
      cancelReason: "  Part never arrived.  ",
    });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      state: "CANCELLED",
      cancelReason: "Part never arrived.",
      version: version + 1,
    });
    expect(await storedField(id, "cancelReason")).toBe("Part never arrived.");
  });

  it("API-09 refuses a blank, missing or over-long reason", async () => {
    const { id, version } = await seedAction(staff, ticket);

    for (const body of [
      { version },
      { version, cancelReason: "" },
      { version, cancelReason: "   " },
      { version, cancelReason: "x".repeat(501) },
    ]) {
      // oxlint-disable-next-line no-await-in-loop
      const response = await cancelAction(staff, id, body);

      expect(response.status).toBe(400);
      expect(Object.keys(errorOf(response)["details"] as object)).toStrictEqual(
        ["cancelReason"]
      );
    }

    expect(await storedField(id, "state")).toBe("PLANNED");

    const atLimit = await cancelAction(staff, id, {
      version,
      cancelReason: "x".repeat(500),
    });

    expect(atLimit.status).toBe(200);
  });

  it("API-10 Done and Cancelled Actions are read-only and unchanged by a refused write", async () => {
    const done = await seedAction(staff, ticket, { result: "Finished" });
    const cancelled = await seedAction(staff, ticket);

    const [completion, cancellation] = await Promise.all([
      completeAction(staff, done.id, { version: done.version }),
      cancelAction(staff, cancelled.id, {
        version: cancelled.version,
        cancelReason: "Not needed",
      }),
    ]);

    for (const action of [completion.body, cancellation.body]) {
      // Sequential on purpose: each Action is attacked, then checked, in turn.
      // oxlint-disable-next-line no-await-in-loop
      const attempts = await Promise.all([
        editAction(staff, action.id, {
          version: action.version,
          description: "changed",
        }),
        completeAction(staff, action.id, {
          version: action.version,
          result: "changed",
        }),
        cancelAction(staff, action.id, {
          version: action.version,
          cancelReason: "changed",
        }),
      ]);

      for (const attempt of attempts) {
        expect(attempt.status).toBe(409);
        expect(errorOf(attempt)["code"]).toBe("ACTION_NOT_EDITABLE");
      }

      // oxlint-disable-next-line no-await-in-loop
      const stored = await storedAction(action.id);

      expect(stored.version).toBe(action.version);
      expect(stored.description).toBe(action.description);
      expect(stored.state).toBe(action.state);
    }
  });

  it("API-10 there is no route to delete an Action or to move one out of Done", async () => {
    const { id } = await seedAction(staff, ticket);

    const [remove, reopen] = await Promise.all([
      as(staff)(request(app).delete(`/api/actions/${id}`)),
      as(staff)(request(app).post(`/api/actions/${id}/reopen`)).send({}),
    ]);

    expect(remove.status).toBe(404);
    expect(errorOf(remove)["code"]).toBe("ROUTE_NOT_FOUND");
    expect(reopen.status).toBe(404);
    expect(errorOf(reopen)["code"]).toBe("ROUTE_NOT_FOUND");
    expect(await actionCount(ticket)).toBe(1);
  });

  it("API-10 an Action that does not exist is 404 ACTION_NOT_FOUND on every write", async () => {
    const answers = await Promise.all([
      editAction(staff, MISSING_ID, { version: 1, description: "x" }),
      completeAction(staff, MISSING_ID, { version: 1, result: "x" }),
      cancelAction(staff, MISSING_ID, { version: 1, cancelReason: "x" }),
      as(staff)(request(app).patch("/api/actions/abc")).send({
        version: 1,
        description: "x",
      }),
    ]);

    for (const answer of answers) {
      expect(answer.status).toBe(404);
      expect(errorOf(answer)["code"]).toBe("ACTION_NOT_FOUND");
    }
  });
});

describe("follow-ups", () => {
  it("API-11 a follow-up is open until a Done Action follows it up", async () => {
    const first = await seedAction(staff, ticket, {
      followUpRequired: true,
      followUpNote: "Check next week",
    });
    const state = async (): Promise<string> => {
      const listed = await listActions(staff, ticket);
      const row = listed.body.data.find(
        (a: { id: number }) => a.id === first.id
      );

      return row.followUpState;
    };

    expect(await state()).toBe("OPEN");

    const planned = await seedAction(staff, ticket, { followsUpId: first.id });

    expect(await state()).toBe("OPEN");

    const cancelled = await seedAction(staff, ticket, {
      followsUpId: first.id,
    });

    await cancelAction(staff, cancelled.id, {
      version: cancelled.version,
      cancelReason: "Duplicate",
    });

    expect(await state()).toBe("OPEN");

    const done = await completeAction(staff, planned.id, {
      version: planned.version,
      result: "Checked, all well",
    });

    expect(done.status).toBe(200);
    expect(await state()).toBe("CLOSED");
  });

  it("API-11 a Cancelled Action that required follow-up is Void", async () => {
    const first = await seedAction(staff, ticket, {
      followUpRequired: true,
      followUpNote: "Check next week",
    });

    const cancelled = await cancelAction(staff, first.id, {
      version: first.version,
      cancelReason: "No longer needed",
    });

    expect(cancelled.body.followUpState).toBe("VOID");
  });

  it("API-12 a followsUpId that names another Ticket's Action, one with no follow-up, a Cancelled one or an unknown one is refused", async () => {
    const other = await createTicket(PREFIX, requesterA.id);
    const foreign = await seedAction(staff, other, {
      followUpRequired: true,
      followUpNote: "n",
    });
    const noFollowUp = await seedAction(staff, ticket);
    const cancelled = await seedAction(staff, ticket, {
      followUpRequired: true,
      followUpNote: "n",
    });

    await cancelAction(staff, cancelled.id, {
      version: cancelled.version,
      cancelReason: "no",
    });

    for (const followsUpId of [
      foreign.id,
      noFollowUp.id,
      cancelled.id,
      MISSING_ID,
    ]) {
      // oxlint-disable-next-line no-await-in-loop
      const response = await createAction(
        staff,
        ticket,
        actionBody({ followsUpId })
      );

      expect(response.status).toBe(400);
      expect(errorOf(response)["code"]).toBe("VALIDATION_FAILED");
      expect(Object.keys(errorOf(response)["details"] as object)).toStrictEqual(
        ["followsUpId"]
      );
    }

    expect(await actionCount(ticket)).toBe(2);
  });

  it("API-12 a valid followsUpId is saved and reported", async () => {
    const first = await seedAction(staff, ticket, {
      followUpRequired: true,
      followUpNote: "n",
    });
    const response = await createAction(
      staff,
      ticket,
      actionBody({ followsUpId: first.id })
    );

    expect(response.status).toBe(201);
    expect(response.body.followsUpId).toBe(first.id);
  });

  it("API-17 clearing Follow-Up Required on an Action another Action follows is refused", async () => {
    const first = await seedAction(staff, ticket, {
      followUpRequired: true,
      followUpNote: "n",
    });

    await seedAction(staff, ticket, { followsUpId: first.id });

    const response = await editAction(staff, first.id, {
      version: first.version,
      followUpRequired: false,
    });

    expect(response.status).toBe(400);
    expect(errorOf(response)["code"]).toBe("VALIDATION_FAILED");
    expect(Object.keys(errorOf(response)["details"] as object)).toStrictEqual([
      "followUpRequired",
    ]);

    const stored = await storedAction(first.id);

    expect(stored.followUpRequired).toBe(true);
    expect(stored.version).toBe(first.version);
  });
});

describe("a Ticket that does not accept Actions", () => {
  const CLOSED_STATUSES = ["RESOLVED", "CLOSED", "CANCELLED"] as const;
  const OPEN_STATUSES = [
    "NEW",
    "OPEN",
    "IN_PROGRESS",
    "WAITING_FOR_REQUESTER",
    "REOPENED",
  ] as const;

  it("API-13 create, edit, complete and cancel are each 409 TICKET_NOT_ACTIONABLE", async () => {
    for (const status of CLOSED_STATUSES) {
      // oxlint-disable-next-line no-await-in-loop
      const target = await createTicket(PREFIX, requesterA.id);
      // oxlint-disable-next-line no-await-in-loop
      const { id, version } = await seedAction(staff, target, {
        result: "Done already",
      });

      // oxlint-disable-next-line no-await-in-loop
      await prisma.ticket.update({
        where: { id: target },
        data: { currentStatus: status },
      });

      // oxlint-disable-next-line no-await-in-loop
      const answers = await Promise.all([
        createAction(staff, target),
        editAction(staff, id, { version, description: "x" }),
        completeAction(staff, id, { version }),
        cancelAction(staff, id, { version, cancelReason: "x" }),
      ]);

      for (const answer of answers) {
        expect(answer.status, status).toBe(409);
        expect(errorOf(answer)["code"]).toBe("TICKET_NOT_ACTIONABLE");
      }

      // oxlint-disable-next-line no-await-in-loop
      expect(await actionCount(target)).toBe(1);
      // oxlint-disable-next-line no-await-in-loop
      expect(await storedField(id, "version")).toBe(version);
    }
  });

  it("API-13 every other status accepts all four writes", async () => {
    for (const status of OPEN_STATUSES) {
      // oxlint-disable-next-line no-await-in-loop
      const target = await createTicket(PREFIX, requesterA.id, { status });
      // oxlint-disable-next-line no-await-in-loop
      const first = await createAction(staff, target);
      // oxlint-disable-next-line no-await-in-loop
      const second = await createAction(staff, target);

      expect(first.status, status).toBe(201);

      // oxlint-disable-next-line no-await-in-loop
      const edited = await editAction(staff, first.body.id, {
        version: first.body.version,
        description: "ok",
      });
      // oxlint-disable-next-line no-await-in-loop
      const completed = await completeAction(staff, first.body.id, {
        version: edited.body.version,
        result: "ok",
      });
      // oxlint-disable-next-line no-await-in-loop
      const cancelled = await cancelAction(staff, second.body.id, {
        version: second.body.version,
        cancelReason: "ok",
      });

      expect([edited.status, completed.status, cancelled.status]).toStrictEqual(
        [200, 200, 200]
      );
    }
  });

  it("API-13 a Requester can still read the Actions of a Resolved Ticket", async () => {
    await seedAction(staff, ticket);
    await prisma.ticket.update({
      where: { id: ticket },
      data: { currentStatus: "RESOLVED" },
    });

    const response = await listActions(requesterA, ticket);

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(1);
  });

  it("API-13 a Done Action on a Resolved Ticket is not editable, and says so before the Ticket does", async () => {
    const { id, version } = await seedAction(staff, ticket, { result: "r" });
    const done = await completeAction(staff, id, { version });

    await prisma.ticket.update({
      where: { id: ticket },
      data: { currentStatus: "RESOLVED" },
    });

    const response = await editAction(staff, id, {
      version: done.body.version,
      description: "x",
    });

    expect(response.status).toBe(409);
    expect(errorOf(response)["code"]).toBe("ACTION_NOT_EDITABLE");
  });
});

describe("versions", () => {
  it("API-14 PATCH, complete and cancel without a usable version are 400 with details.version", async () => {
    const { id } = await seedAction(staff, ticket, { result: "r" });

    for (const version of [undefined, null, "1", 1.5, 0, -1, true]) {
      const body = version === undefined ? {} : { version };

      // oxlint-disable-next-line no-await-in-loop
      const answers = await Promise.all([
        editAction(staff, id, { ...body, description: "x" }),
        completeAction(staff, id, { ...body, result: "x" }),
        cancelAction(staff, id, { ...body, cancelReason: "x" }),
      ]);

      for (const answer of answers) {
        expect(answer.status, String(version)).toBe(400);
        expect(errorOf(answer)["code"]).toBe("VALIDATION_FAILED");
        expect(Object.keys(errorOf(answer)["details"] as object)).toContain(
          "version"
        );
      }
    }

    expect(await storedField(id, "state")).toBe("PLANNED");
  });

  it("API-15 a write with an old version is 409 STALE_UPDATE and changes nothing; the current one succeeds", async () => {
    const { id, version } = await seedAction(staff, ticket);

    const first = await editAction(staff, id, { version, description: "one" });

    expect(first.status).toBe(200);
    expect(first.body.version).toBe(version + 1);

    const before = await storedAction(id);
    const answers = await Promise.all([
      editAction(staffB, id, { version, description: "stale" }),
      completeAction(staffB, id, { version, result: "stale" }),
      cancelAction(staffB, id, { version, cancelReason: "stale" }),
    ]);

    for (const answer of answers) {
      expect(answer.status).toBe(409);
      expect(errorOf(answer)["code"]).toBe("STALE_UPDATE");
    }

    expect(await storedAction(id)).toStrictEqual(before);

    const current = await editAction(staffB, id, {
      version: first.body.version,
      description: "two",
    });

    expect(current.status).toBe(200);
    expect(current.body.version).toBe(version + 2);
    expect(current.body.description).toBe("two");
  });

  it("API-15 a stale version is reported before the Action's state (BR-20)", async () => {
    const { id, version } = await seedAction(staff, ticket, { result: "r" });

    await completeAction(staff, id, { version });

    const response = await editAction(staff, id, {
      version,
      description: "x",
    });

    expect(response.status).toBe(409);
    expect(errorOf(response)["code"]).toBe("STALE_UPDATE");
  });

  it("API-15 a version one ahead of the stored one is stale too", async () => {
    const { id, version } = await seedAction(staff, ticket);
    const response = await editAction(staff, id, {
      version: version + 1,
      description: "x",
    });

    expect(response.status).toBe(409);
    expect(errorOf(response)["code"]).toBe("STALE_UPDATE");
  });
});

describe("a retried create (request key)", () => {
  it("API-19 the same request twice is 201 then 200 with the same Action, and one row", async () => {
    const body = actionBody({
      performedById: staffB.id,
      actionAt: "2026-09-25T03:15:00.000Z",
      followUpRequired: true,
      followUpNote: "Check back",
    });

    const first = await createAction(staff, ticket, body);
    const second = await createAction(staff, ticket, body);

    expect(first.status).toBe(201);
    expect(second.status).toBe(200);
    expect(second.body).toStrictEqual(first.body);
    expect(await actionCount(ticket)).toBe(1);
    expect(await storedField(first.body.id, "version")).toBe(1);
  });

  it("API-19 a retry that omits optional fields the first omitted is a replay, even though the clock has moved", async () => {
    const body = actionBody();
    const first = await createAction(staff, ticket, body);

    await sleep(20);

    const second = await createAction(staff, ticket, body);

    expect(second.status).toBe(200);
    expect(second.body.id).toBe(first.body.id);
    expect(second.body.actionAt).toBe(first.body.actionAt);
  });

  it("API-19 a replay is still 200 after the Ticket was Resolved, and the Ticket's state is not consulted", async () => {
    const body = actionBody();
    const first = await createAction(staff, ticket, body);

    await prisma.ticket.update({
      where: { id: ticket },
      data: { currentStatus: "RESOLVED" },
    });

    const replay = await createAction(staff, ticket, body);

    expect(replay.status).toBe(200);
    expect(replay.body.id).toBe(first.body.id);

    const fresh = await createAction(staff, ticket, actionBody());

    expect(fresh.status).toBe(409);
    expect(errorOf(fresh)["code"]).toBe("TICKET_NOT_ACTIONABLE");
  });

  it("API-19 a replay writes nothing: the stored row is byte-for-byte what the first left", async () => {
    const body = actionBody();
    const first = await createAction(staff, ticket, body);
    const before = await storedAction(first.body.id);

    await createAction(staff, ticket, body);

    expect(await storedAction(first.body.id)).toStrictEqual(before);
  });

  it("API-20 any changed field under the same key is 409 REQUEST_ID_CONFLICT and nothing is stored", async () => {
    const requestId = randomUUID();
    const original = {
      requestId,
      description: "Original",
      result: "Result",
      followUpRequired: true,
      followUpNote: "Note",
      attachmentNotes: "Notes",
      performedById: staffB.id,
      actionAt: "2026-09-25T03:15:00.000Z",
    };

    const first = await createAction(staff, ticket, original);

    expect(first.status).toBe(201);

    const first2 = await seedAction(staff, ticket, { description: "target" });
    const changes: Record<string, unknown>[] = [
      { description: "Different" },
      { result: "Different" },
      { result: null },
      { followUpRequired: false, followUpNote: null },
      { followUpNote: "Different" },
      { attachmentNotes: "Different" },
      { attachmentNotes: null },
      { performedById: staff.id },
      { actionAt: "2026-09-25T03:16:00.000Z" },
      { followsUpId: first.body.id },
    ];

    for (const change of changes) {
      // oxlint-disable-next-line no-await-in-loop
      const response = await createAction(staff, ticket, {
        ...original,
        ...change,
      });

      expect(response.status, JSON.stringify(change)).toBe(409);
      expect(errorOf(response)["code"]).toBe("REQUEST_ID_CONFLICT");
    }

    expect(first2.id).toBeGreaterThan(0);
    expect(await actionCount(ticket)).toBe(2);
  });

  it("API-20 a different key creates a second Action with identical fields", async () => {
    const first = await createAction(staff, ticket, actionBody());
    const second = await createAction(staff, ticket, actionBody());

    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(second.body.id).not.toBe(first.body.id);
    expect(await actionCount(ticket)).toBe(2);
  });

  it("API-20 a key is scoped to its Ticket: the same key on another Ticket creates a new Action", async () => {
    const other = await createTicket(PREFIX, requesterA.id);
    const body = actionBody();
    const first = await createAction(staff, ticket, body);
    const second = await createAction(staff, other, body);

    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(second.body.ticketId).toBe(other);
  });

  it("API-21 a missing, empty or non-UUID key is 400 with details.requestId", async () => {
    const { requestId: _omitted, ...withoutKey } = actionBody();

    for (const body of [
      withoutKey,
      actionBody({ requestId: "" }),
      actionBody({ requestId: "not-a-uuid" }),
      actionBody({ requestId: 42 }),
      actionBody({ requestId: null }),
    ]) {
      // oxlint-disable-next-line no-await-in-loop
      const response = await createAction(staff, ticket, body);

      expect(response.status).toBe(400);
      expect(Object.keys(errorOf(response)["details"] as object)).toContain(
        "requestId"
      );
    }

    expect(await actionCount(ticket)).toBe(0);
  });

  it("API-21 ten simultaneous requests with one key leave one Action: one 201 and nine 200", async () => {
    const body = actionBody();
    const answers = await Promise.all(
      Array.from({ length: 10 }, () => createAction(staff, ticket, body))
    );

    const statuses = answers
      .map((answer) => answer.status)
      .toSorted((a, b) => a - b);

    expect(statuses).toStrictEqual([
      200, 200, 200, 200, 200, 200, 200, 200, 200, 201,
    ]);
    expect(new Set(answers.map((answer) => answer.body.id)).size).toBe(1);
    expect(await actionCount(ticket)).toBe(1);
  });
});

describe("AC-44 every Action endpoint is guarded", () => {
  const routes = (id: number) =>
    [
      { method: "get", path: `/api/tickets/${ticket}/actions` },
      { method: "post", path: `/api/tickets/${ticket}/actions` },
      { method: "patch", path: `/api/actions/${id}` },
      { method: "post", path: `/api/actions/${id}/complete` },
      { method: "post", path: `/api/actions/${id}/cancel` },
    ] as const;

  it("is refused 401 UNAUTHENTICATED without a session", async () => {
    const { id } = await seedAction(staff, ticket);

    const answers = await Promise.all(
      routes(id).map((route) =>
        request(app)[route.method](route.path).send(actionBody())
      )
    );

    for (const answer of answers) {
      expect(answer.status).toBe(401);
      expect(errorOf(answer)["code"]).toBe("UNAUTHENTICATED");
    }
  });

  it("is refused 403 PASSWORD_CHANGE_REQUIRED while a password change is outstanding", async () => {
    const { id } = await seedAction(staff, ticket);

    const answers = await Promise.all(
      routes(id).map((route) =>
        as(gated)(request(app)[route.method](route.path)).send(actionBody())
      )
    );

    for (const answer of answers) {
      expect(answer.status).toBe(403);
      expect(errorOf(answer)["code"]).toBe("PASSWORD_CHANGE_REQUIRED");
    }
  });

  it("is refused 403 FORBIDDEN for a Requester on every write, before the body is read", async () => {
    const { id } = await seedAction(staff, ticket);

    const answers = await Promise.all(
      routes(id)
        .filter((route) => route.method !== "get")
        .map((route) =>
          // A body that would fail validation, to show the role check ran first.
          as(requesterA)(request(app)[route.method](route.path)).send({
            nonsense: true,
          })
        )
    );

    for (const answer of answers) {
      expect(answer.status).toBe(403);
      expect(errorOf(answer)["code"]).toBe("FORBIDDEN");
    }
  });

  it("answers with the envelope and nothing else", async () => {
    const { id } = await seedAction(staff, ticket);
    const answers = await Promise.all([
      createAction(staff, ticket, actionBody({ description: "" })),
      createAction(staff, MISSING_ID),
      editAction(staff, MISSING_ID, { version: 1, description: "x" }),
      editAction(staff, id, { version: 99, description: "x" }),
      createAction(staff, ticket, actionBody({ performedById: MISSING_ID })),
    ]);

    for (const answer of answers) {
      expect(Object.keys(answer.body)).toStrictEqual(["error"]);

      for (const key of Object.keys(errorOf(answer))) {
        expect([...ENVELOPE_KEYS, "details"]).toContain(key);
      }

      expect(JSON.stringify(answer.body)).not.toMatch(
        /stack|prisma|node_modules|SELECT|\.ts:/iu
      );
    }
  });
});

const at = (offsetMs: number): string =>
  new Date(Date.now() + offsetMs).toISOString();

describe("follow-up chronology (review of PR 81)", () => {
  const HOUR = 3_600_000;
  const followUpTarget = (actionAt: string) =>
    seedAction(staff, ticket, {
      actionAt,
      followUpRequired: true,
      followUpNote: "n",
    });

  const detailKeys = (response: {
    body: { error?: Record<string, unknown> };
  }) => Object.keys((errorOf(response)["details"] ?? {}) as object);

  it("API-12 a create dated before the Action it follows up is refused on followsUpId and stores nothing", async () => {
    const target = await followUpTarget(at(-2 * HOUR));

    const response = await createAction(
      staff,
      ticket,
      actionBody({ followsUpId: target.id, actionAt: at(-3 * HOUR) })
    );

    expect(response.status).toBe(400);
    expect(errorOf(response)["code"]).toBe("VALIDATION_FAILED");
    expect(detailKeys(response)).toStrictEqual(["followsUpId"]);
    expect(await actionCount(ticket)).toBe(1);
  });

  it("API-12 the same instant is allowed, because the id then puts the follow-up second", async () => {
    const when = at(-2 * HOUR);
    const target = await followUpTarget(when);

    const response = await createAction(
      staff,
      ticket,
      actionBody({ followsUpId: target.id, actionAt: when })
    );

    expect(response.status).toBe(201);
  });

  it("API-12 an omitted time is the server clock, so a target dated ahead of it is refused", async () => {
    const target = await followUpTarget(at(30_000));

    const response = await createAction(
      staff,
      ticket,
      actionBody({ followsUpId: target.id })
    );

    expect(response.status).toBe(400);
    expect(detailKeys(response)).toStrictEqual(["followsUpId"]);
  });

  it("API-17 an edit that moves a follow-up before its target is refused on actionAt and changes nothing", async () => {
    const target = await followUpTarget(at(-3 * HOUR));
    const follower = await seedAction(staff, ticket, {
      followsUpId: target.id,
      actionAt: at(-HOUR),
    });
    const before = await storedAction(follower.id);

    const refused = await editAction(staff, follower.id, {
      version: follower.version,
      actionAt: at(-4 * HOUR),
    });

    expect(refused.status).toBe(400);
    expect(errorOf(refused)["code"]).toBe("VALIDATION_FAILED");
    expect(detailKeys(refused)).toStrictEqual(["actionAt"]);
    expect(await storedAction(follower.id)).toStrictEqual(before);

    const storedTarget = await storedAction(target.id);
    const equal = await editAction(staff, follower.id, {
      version: follower.version,
      actionAt: storedTarget.actionAt.toISOString(),
    });

    expect(equal.status).toBe(200);
  });

  it("API-17 an edit that moves a followed-up Action after one that follows it is refused on actionAt", async () => {
    const target = await followUpTarget(at(-3 * HOUR));
    const follower = await seedAction(staff, ticket, {
      followsUpId: target.id,
      actionAt: at(-2 * HOUR),
    });

    const refused = await editAction(staff, target.id, {
      version: target.version,
      actionAt: at(-HOUR),
    });

    expect(refused.status).toBe(400);
    expect(detailKeys(refused)).toStrictEqual(["actionAt"]);

    const unchanged = await storedAction(target.id);
    const storedFollower = await storedAction(follower.id);

    expect(unchanged.version).toBe(target.version);

    const stillFine = await editAction(staff, target.id, {
      version: target.version,
      actionAt: storedFollower.actionAt.toISOString(),
    });

    expect(stillFine.status).toBe(200);
  });
});

const raw = (
  who: SignedInUser,
  method: "post" | "patch",
  path: string,
  json: string
) => {
  const call =
    method === "post" ? request(app).post(path) : request(app).patch(path);

  return call
    .set("Cookie", who.cookie)
    .set("Content-Type", "application/json")
    .send(json);
};

describe("a body key that exists on every object (review of PR 81)", () => {
  const KEYS = ["__proto__", "constructor", "toString"];

  const expectRefused = (
    response: { status: number; body: { error?: Record<string, unknown> } },
    key: string
  ) => {
    expect(response.status).toBe(400);
    expect(errorOf(response)["code"]).toBe("VALIDATION_FAILED");
    expect(Object.keys(errorOf(response)["details"] as object)).toContain(key);
  };

  it.each(KEYS)(
    "API-05 %s in a raw JSON body is a 400 naming it, on all four writes",
    async (key) => {
      const { id, version } = await seedAction(staff, ticket, { result: "r" });
      const json = (rest: string) => `{${JSON.stringify(key)}: 1, ${rest}}`;

      expectRefused(
        await raw(
          staff,
          "post",
          `/api/tickets/${ticket}/actions`,
          json(`"requestId": "${randomUUID()}", "description": "x"`)
        ),
        key
      );
      expectRefused(
        await raw(
          staff,
          "patch",
          `/api/actions/${id}`,
          json(`"version": ${version}`)
        ),
        key
      );
      expectRefused(
        await raw(
          staff,
          "post",
          `/api/actions/${id}/complete`,
          json(`"version": ${version}`)
        ),
        key
      );
      expectRefused(
        await raw(
          staff,
          "post",
          `/api/actions/${id}/cancel`,
          json(`"version": ${version}, "cancelReason": "x"`)
        ),
        key
      );

      const unchanged = await storedAction(id);

      expect(unchanged.version).toBe(version);
    }
  );

  it("API-05 an impossible calendar date such as 30 February is a 400 on actionAt", async () => {
    const response = await createAction(
      staff,
      ticket,
      actionBody({ actionAt: "2026-02-30T10:00:00Z" })
    );

    expect(response.status).toBe(400);
    expect(Object.keys(errorOf(response)["details"] as object)).toStrictEqual([
      "actionAt",
    ]);
    expect(await actionCount(ticket)).toBe(0);
  });
});
