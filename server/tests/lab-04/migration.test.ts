import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { ACTIVE_REQUESTER, ACTIVE_STAFF } from "../../prisma/accounts.js";
import { app } from "../../src/app.js";
import { prisma } from "../../src/prisma.js";
import type { SignedInUser } from "../lab-03/support/signIn.js";
import { signInAs } from "../lab-03/support/signIn.js";
import {
  actionBody,
  as,
  createAction,
  createTicket,
  removeTickets,
} from "./support/actions.js";

/**
 * MIG-05: a Ticket that was Resolved before Lab 4 (AC-35).
 *
 * The migration gave every existing Ticket `version` 1 and a history row, and
 * touched nothing else, so a legacy Resolved Ticket is one with no Actions and
 * no Resolution Summary. It is built here as exactly that, straight in the
 * table, and then driven through the API: the gate must run only on a *new*
 * resolve, never on a Ticket that merely already is Resolved.
 */

const PREFIX = "LEGACY-RESOLVED-TEST";
const SUMMARY = "Replaced the access point and confirmed with the requester.";

let requester: SignedInUser;
let staff: SignedInUser;
let legacy = 0;

const patchStatus = (id: number, body: object) =>
  as(staff)(request(app).patch(`/api/staff/tickets/${id}/status`)).send(body);

beforeAll(async () => {
  await removeTickets(PREFIX);

  [requester, staff] = await Promise.all([
    signInAs(ACTIVE_REQUESTER),
    signInAs(ACTIVE_STAFF),
  ]);
});

beforeEach(async () => {
  await removeTickets(PREFIX);
  legacy = await createTicket(PREFIX, requester.id, { status: "RESOLVED" });
});

afterAll(async () => {
  await removeTickets(PREFIX);
  await prisma.$disconnect();
});

describe("MIG-05 a Ticket Resolved before Lab 4", () => {
  it("stays Resolved and is listed to staff and to its Requester", async () => {
    const detail = await as(staff)(request(app).get(`/api/tickets/${legacy}`));

    expect(detail.status).toBe(200);
    expect(detail.body.currentStatus).toBe("RESOLVED");
    expect(detail.body.resolutionSummary).toBeNull();
    expect(detail.body.version).toBe(1);

    const query = `search=${PREFIX}&status=RESOLVED`;
    const [queue, mine] = await Promise.all([
      as(staff)(request(app).get(`/api/staff/tickets?${query}`)),
      as(requester)(request(app).get(`/api/tickets?${query}`)),
    ]);

    for (const listing of [queue, mine]) {
      expect(listing.status).toBe(200);
      expect(
        listing.body.data.map((row: { id: number }) => row.id)
      ).toStrictEqual([legacy]);
    }

    const actions = await as(requester)(
      request(app).get(`/api/tickets/${legacy}/actions`)
    );

    expect(actions.status).toBe(200);
    expect(actions.body.data).toStrictEqual([]);
  });

  it("takes no Action while Resolved: 409 TICKET_NOT_ACTIONABLE, and nothing is stored", async () => {
    const refused = await createAction(staff, legacy);

    expect(refused.status).toBe(409);
    expect(refused.body.error.code).toBe("TICKET_NOT_ACTIONABLE");
    expect(
      await prisma.actionTaken.count({ where: { ticketId: legacy } })
    ).toBe(0);
  });

  it("can be reopened without the gate, and then takes Actions", async () => {
    // Reopening is not a resolve: no Done Action and no summary are asked for.
    const reopened = await patchStatus(legacy, {
      status: "REOPENED",
      version: 1,
    });

    expect(reopened.status).toBe(200);
    expect(reopened.body.currentStatus).toBe("REOPENED");
    expect(reopened.body.version).toBe(2);

    const history = await prisma.ticketStatusChange.findMany({
      where: { ticketId: legacy },
    });

    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({
      fromStatus: "RESOLVED",
      toStatus: "REOPENED",
      changedById: staff.id,
    });

    const created = await createAction(staff, legacy, actionBody());

    expect(created.status).toBe(201);
  });

  it("is gated only when it is resolved again: the new resolve needs a Done Action and a summary", async () => {
    const reopened = await patchStatus(legacy, {
      status: "REOPENED",
      version: 1,
    });

    expect(reopened.status).toBe(200);

    const refused = await patchStatus(legacy, {
      status: "RESOLVED",
      version: 2,
      resolutionSummary: SUMMARY,
    });

    expect(refused.status).toBe(400);
    expect(refused.body.error.code).toBe("RESOLUTION_GATE_FAILED");
    expect(Object.keys(refused.body.error.details)).toStrictEqual([
      "doneAction",
    ]);

    const planned = await createAction(staff, legacy, actionBody());

    expect(planned.status).toBe(201);

    const completed = await as(staff)(
      request(app).post(`/api/actions/${planned.body.id}/complete`)
    ).send({ version: planned.body.version, result: "Fixed." });

    expect(completed.status).toBe(200);

    const resolved = await patchStatus(legacy, {
      status: "RESOLVED",
      version: 2,
      resolutionSummary: SUMMARY,
    });

    expect(resolved.status).toBe(200);
    expect(resolved.body.currentStatus).toBe("RESOLVED");
    expect(resolved.body.resolutionSummary).toBe(SUMMARY);
  });

  it("can be closed from Resolved without the gate, as in Lab 3", async () => {
    const closed = await patchStatus(legacy, { status: "CLOSED", version: 1 });

    expect(closed.status).toBe(200);
    expect(closed.body.currentStatus).toBe("CLOSED");
  });
});
