import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  ACTIVE_REQUESTER,
  ACTIVE_STAFF,
  ADMINISTRATOR,
  SECOND_REQUESTER,
} from "../../prisma/accounts.js";
import { app } from "../../src/app.js";
import { prisma } from "../../src/prisma.js";
import type { SignedInUser } from "./support/signIn.js";
import { signInAs } from "./support/signIn.js";

/**
 * Public Comments and the Requester's resolved indication (api-spec.md §8).
 *
 * Covers API-27, API-28, API-29, API-30 and SEC-11. SEC-09 — a Requester asking
 * for Internal Notes — joins this file with the notes endpoints it tests.
 */

const PREFIX = "COMMENTS-TEST";
const MISSING_ID = 99_999_999;

let requesterA: SignedInUser;
let requesterB: SignedInUser;
let staff: SignedInUser;
let admin: SignedInUser;

let ticketOfA = 0;
let staffOwnTicket = 0;
let sequence = 0;

const as = (who: SignedInUser) => (r: request.Test) =>
  r.set("Cookie", who.cookie);

const removeFixtures = () =>
  // Comments go with their ticket (onDelete: Cascade).
  prisma.ticket.deleteMany({ where: { summary: { startsWith: PREFIX } } });

const createTicket = async (requesterId: number): Promise<number> => {
  const [category, system] = await Promise.all([
    prisma.category.findFirstOrThrow({ where: { isActive: true } }),
    prisma.relatedSystem.findFirstOrThrow({ where: { isActive: true } }),
  ]);

  sequence += 1;

  const ticket = await prisma.ticket.create({
    data: {
      ticketNumber: `TKT-2996-${String(800_000 + sequence)}`,
      requesterId,
      categoryId: category.id,
      relatedSystemId: system.id,
      summary: `${PREFIX} ticket ${sequence}`,
      description: "Created by the comments suite.",
      requestedPriority: "MEDIUM",
      currentStatus: "IN_PROGRESS",
    },
    select: { id: true },
  });

  return ticket.id;
};

beforeAll(async () => {
  await removeFixtures();

  [requesterA, requesterB, staff, admin] = await Promise.all([
    signInAs(ACTIVE_REQUESTER),
    signInAs(SECOND_REQUESTER),
    signInAs(ACTIVE_STAFF),
    signInAs(ADMINISTRATOR),
  ]);
});

beforeEach(async () => {
  await removeFixtures();
  ticketOfA = await createTicket(requesterA.id);
  staffOwnTicket = await createTicket(staff.id);
});

afterAll(async () => {
  await removeFixtures();
  await prisma.$disconnect();
});

const post = (who: SignedInUser, ticket: number, body: unknown) =>
  as(who)(request(app).post(`/api/tickets/${ticket}/comments`)).send(
    body as object
  );

const read = (who: SignedInUser, ticket: number) =>
  as(who)(request(app).get(`/api/tickets/${ticket}/comments`));

const indicate = (who: SignedInUser, ticket: number) =>
  as(who)(request(app).post(`/api/tickets/${ticket}/resolved-indication`));

const postNote = (who: SignedInUser, ticket: number, body: unknown) =>
  as(who)(request(app).post(`/api/tickets/${ticket}/notes`)).send(
    body as object
  );

const readNotes = (who: SignedInUser, ticket: number) =>
  as(who)(request(app).get(`/api/tickets/${ticket}/notes`));

describe("posting and reading Public Comments", () => {
  it("API-28 the Requester and IT Staff both read a comment with its author and time", async () => {
    const posted = await post(requesterA, ticketOfA, {
      body: "  It went down again at 9.  ",
    });

    expect(posted.status).toBe(201);
    expect(posted.body).toStrictEqual({
      id: expect.any(Number),
      body: "It went down again at 9.",
      author: {
        id: requesterA.id,
        name: ACTIVE_REQUESTER.name,
        role: "REQUESTER",
      },
      createdAt: expect.any(String),
    });

    const [asRequester, asStaff, asAdmin] = await Promise.all([
      read(requesterA, ticketOfA),
      read(staff, ticketOfA),
      read(admin, ticketOfA),
    ]);

    for (const response of [asRequester, asStaff, asAdmin]) {
      expect(response.status).toBe(200);
      expect(response.body).toStrictEqual({ data: [posted.body] });
    }
  });

  it("API-28 staff post on any ticket, and the Requester reads the reply beneath their own", async () => {
    const first = await post(requesterA, ticketOfA, { body: "Still broken." });
    const reply = await post(staff, ticketOfA, { body: "Looking now." });

    expect(first.status).toBe(201);
    expect(reply.status).toBe(201);
    expect(reply.body.author).toStrictEqual({
      id: staff.id,
      name: ACTIVE_STAFF.name,
      role: "IT_STAFF",
    });

    const listed = await read(requesterA, ticketOfA);

    expect(listed.body.data.map((c: { body: string }) => c.body)).toStrictEqual(
      ["Still broken.", "Looking now."]
    );
  });

  it("orders comments sharing one timestamp by id, oldest first", async () => {
    const at = new Date("2026-09-16T08:00:00.000Z");
    const created = [];

    for (const body of ["one", "two", "three"]) {
      // Sequential on purpose: the ids must be ascending in this order.
      // oxlint-disable-next-line no-await-in-loop
      const row = await prisma.publicComment.create({
        data: {
          ticketId: ticketOfA,
          authorId: requesterA.id,
          body,
          createdAt: at,
        },
        select: { id: true },
      });
      created.push(row.id);
    }

    const listed = await read(staff, ticketOfA);

    expect(listed.body.data.map((c: { id: number }) => c.id)).toStrictEqual(
      created
    );
  });

  it("API-29 an author, time or id supplied in the body is ignored", async () => {
    const before = Date.now();
    const response = await post(requesterA, ticketOfA, {
      body: "Please call me.",
      id: 1,
      authorId: requesterB.id,
      author: { id: requesterB.id, name: "Someone else", role: "ADMIN" },
      createdAt: "2001-01-01T00:00:00.000Z",
      ticketId: staffOwnTicket,
    });

    expect(response.status).toBe(201);
    expect(response.body.author.id).toBe(requesterA.id);
    expect(response.body.author.role).toBe("REQUESTER");
    expect(Date.parse(response.body.createdAt)).toBeGreaterThanOrEqual(
      before - 5000
    );

    const stored = await prisma.publicComment.findUniqueOrThrow({
      where: { id: response.body.id },
      select: { ticketId: true, authorId: true },
    });

    expect(stored).toStrictEqual({
      ticketId: ticketOfA,
      authorId: requesterA.id,
    });
  });

  it("API-30 an empty, whitespace-only or missing body is refused 400 and stores nothing", async () => {
    const answers = await Promise.all(
      [{ body: "" }, { body: " \n\t " }, {}, { body: 7 }].map((body) =>
        post(requesterA, ticketOfA, body)
      )
    );

    for (const response of answers) {
      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe("VALIDATION_FAILED");
      expect(response.body.error.details).toStrictEqual({
        body: expect.any(String),
      });
    }

    expect(
      await prisma.publicComment.count({ where: { ticketId: ticketOfA } })
    ).toBe(0);
  });

  it("refuses more than 5000 characters after trimming, and accepts exactly 5000", async () => {
    const tooLong = await post(requesterA, ticketOfA, {
      body: "a".repeat(5001),
    });
    const longest = await post(requesterA, ticketOfA, {
      body: ` ${"a".repeat(5000)} `,
    });

    expect(tooLong.status).toBe(400);
    expect(tooLong.body.error.details.body).toBeDefined();
    expect(longest.status).toBe(201);
    expect(longest.body.body).toHaveLength(5000);
  });

  it("stores markup as the text it is", async () => {
    const response = await post(requesterA, ticketOfA, {
      body: "<img src=x onerror=alert(1)>",
    });

    expect(response.body.body).toBe("<img src=x onerror=alert(1)>");
  });

  it("a Requester reading or posting on someone else's ticket gets the bytes of a missing one", async () => {
    await post(staff, ticketOfA, { body: "A reply B must not see." });

    const [readTheirs, readMissing, postTheirs, postMissing] =
      await Promise.all([
        read(requesterB, ticketOfA),
        read(requesterB, MISSING_ID),
        post(requesterB, ticketOfA, { body: "hello" }),
        post(requesterB, MISSING_ID, { body: "hello" }),
      ]);

    expect(readTheirs.status).toBe(404);
    expect(readTheirs.body).toStrictEqual(readMissing.body);
    expect(postTheirs.status).toBe(404);
    expect(postTheirs.body).toStrictEqual(postMissing.body);
    expect(readTheirs.body.error.code).toBe("TICKET_NOT_FOUND");

    // Even an invalid body is answered as absence, not as a validation failure
    // that would confirm the ticket exists.
    const invalidOnTheirs = await post(requesterB, ticketOfA, { body: " " });

    expect(invalidOnTheirs.status).toBe(404);
    expect(
      await prisma.publicComment.count({
        where: { authorId: requesterB.id, ticketId: ticketOfA },
      })
    ).toBe(0);
  });

  it("a malformed ticket id is not found", async () => {
    const response = await read(requesterA, Number.NaN);

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("TICKET_NOT_FOUND");
  });

  it("comments are append-only: there is no route to edit or delete one", async () => {
    const posted = await post(requesterA, ticketOfA, { body: "Original." });
    const path = `/api/tickets/${ticketOfA}/comments/${posted.body.id}`;

    const [patched, put, deleted] = await Promise.all([
      as(requesterA)(request(app).patch(path)).send({ body: "Changed." }),
      as(admin)(request(app).put(path)).send({ body: "Changed." }),
      as(admin)(request(app).delete(path)),
    ]);

    for (const response of [patched, put, deleted]) {
      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe("ROUTE_NOT_FOUND");
    }

    const listed = await read(requesterA, ticketOfA);

    expect(listed.body.data).toStrictEqual([posted.body]);
  });
});

describe("posting and reading Internal Notes", () => {
  it("IT Staff and an Administrator both read and create notes on any ticket", async () => {
    const posted = await postNote(staff, ticketOfA, {
      body: "  Escalating to the network team.  ",
    });

    expect(posted.status).toBe(201);
    expect(posted.body).toStrictEqual({
      id: expect.any(Number),
      body: "Escalating to the network team.",
      author: {
        id: staff.id,
        name: ACTIVE_STAFF.name,
        role: "IT_STAFF",
      },
      createdAt: expect.any(String),
    });

    const reply = await postNote(admin, ticketOfA, {
      body: "Agreed, looping in the vendor.",
    });

    expect(reply.status).toBe(201);
    expect(reply.body.author).toStrictEqual({
      id: admin.id,
      name: ADMINISTRATOR.name,
      role: "ADMIN",
    });

    const [asStaff, asAdmin] = await Promise.all([
      readNotes(staff, ticketOfA),
      readNotes(admin, ticketOfA),
    ]);

    for (const response of [asStaff, asAdmin]) {
      expect(response.status).toBe(200);
      expect(response.body).toStrictEqual({
        data: [posted.body, reply.body],
      });
    }
  });

  it("notes are ordered oldest first", async () => {
    const at = new Date("2026-09-17T09:00:00.000Z");
    const created = [];

    for (const body of ["one", "two", "three"]) {
      // Sequential on purpose: the ids must be ascending in this order.
      // oxlint-disable-next-line no-await-in-loop
      const row = await prisma.internalNote.create({
        data: {
          ticketId: ticketOfA,
          authorId: staff.id,
          body,
          createdAt: at,
        },
        select: { id: true },
      });
      created.push(row.id);
    }

    const listed = await readNotes(staff, ticketOfA);

    expect(listed.body.data.map((n: { id: number }) => n.id)).toStrictEqual(
      created
    );
  });

  it("an empty, whitespace-only or missing body is refused 400 and stores nothing", async () => {
    const answers = await Promise.all(
      [{ body: "" }, { body: " \n\t " }, {}, { body: 7 }].map((body) =>
        postNote(staff, ticketOfA, body)
      )
    );

    for (const response of answers) {
      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe("VALIDATION_FAILED");
      expect(response.body.error.details).toStrictEqual({
        body: expect.any(String),
      });
    }

    expect(
      await prisma.internalNote.count({ where: { ticketId: ticketOfA } })
    ).toBe(0);
  });

  it("an author, time or id supplied in the body is ignored", async () => {
    const before = Date.now();
    const response = await postNote(staff, ticketOfA, {
      body: "Please verify with the vendor.",
      id: 1,
      authorId: admin.id,
      author: { id: admin.id, name: "Someone else", role: "ADMIN" },
      createdAt: "2001-01-01T00:00:00.000Z",
      ticketId: staffOwnTicket,
    });

    expect(response.status).toBe(201);
    expect(response.body.author.id).toBe(staff.id);
    expect(response.body.author.role).toBe("IT_STAFF");
    expect(Date.parse(response.body.createdAt)).toBeGreaterThanOrEqual(
      before - 5000
    );

    const stored = await prisma.internalNote.findUniqueOrThrow({
      where: { id: response.body.id },
      select: { ticketId: true, authorId: true },
    });

    expect(stored).toStrictEqual({
      ticketId: ticketOfA,
      authorId: staff.id,
    });
  });

  it("notes are append-only: there is no route to edit or delete one", async () => {
    const posted = await postNote(staff, ticketOfA, { body: "Original note." });
    const path = `/api/tickets/${ticketOfA}/notes/${posted.body.id}`;

    const [patched, put, deleted] = await Promise.all([
      as(staff)(request(app).patch(path)).send({ body: "Changed." }),
      as(admin)(request(app).put(path)).send({ body: "Changed." }),
      as(admin)(request(app).delete(path)),
    ]);

    for (const response of [patched, put, deleted]) {
      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe("ROUTE_NOT_FOUND");
    }

    const listed = await readNotes(staff, ticketOfA);

    expect(listed.body.data).toStrictEqual([posted.body]);
  });

  it("a Requester requesting a Ticket that does not exist is refused 404 on comments but 403 on notes", async () => {
    // Sanity check that the two resources really do answer differently: notes
    // never fall through to a ticket lookup at all.
    const response = await readNotes(requesterA, MISSING_ID);

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("FORBIDDEN");
  });

  it("SEC-09 a Requester requesting Internal Notes is refused 403 with byte-identical bodies, whether or not notes exist and whether or not the ticket is theirs (AC-04, AC-25, BR-32)", async () => {
    // ticketOfA has notes from prior tests in this file's ticket lifecycle,
    // but each test gets a fresh ticket via beforeEach, so create explicitly
    // both a ticket of A with notes and one with none.
    await postNote(staff, ticketOfA, {
      body: "A note the Requester must not see.",
    });

    const withoutNotesTicket = await createTicket(requesterA.id);

    const [
      getOwnWithNotes,
      postOwnWithNotes,
      getOwnWithoutNotes,
      postOwnWithoutNotes,
      getSomeoneElses,
      postSomeoneElses,
    ] = await Promise.all([
      readNotes(requesterA, ticketOfA),
      postNote(requesterA, ticketOfA, { body: "trying anyway" }),
      readNotes(requesterA, withoutNotesTicket),
      postNote(requesterA, withoutNotesTicket, { body: "trying anyway" }),
      readNotes(requesterB, ticketOfA),
      postNote(requesterB, ticketOfA, { body: "trying anyway" }),
    ]);

    const allResponses = [
      getOwnWithNotes,
      postOwnWithNotes,
      getOwnWithoutNotes,
      postOwnWithoutNotes,
      getSomeoneElses,
      postSomeoneElses,
    ];

    for (const response of allResponses) {
      expect(response.status).toBe(403);
    }

    const expectedText = getOwnWithNotes.text;

    for (const response of allResponses) {
      // Byte-identical, not merely structurally equal: `.text` is the raw
      // response body, so this compares what actually went over the wire.
      expect(response.text).toBe(expectedText);
    }

    expect(expectedText).not.toContain("note");
    expect(expectedText).not.toContain("A note the Requester must not see");

    expect(JSON.parse(expectedText)).toStrictEqual({
      error: {
        code: "FORBIDDEN",
        message: expect.any(String),
      },
    });

    // Nothing was created by the attempted posts.
    expect(
      await prisma.internalNote.count({
        where: { authorId: requesterA.id },
      })
    ).toBe(0);
  });

  it("without a session every notes endpoint answers 401", async () => {
    const answers = await Promise.all([
      request(app).get(`/api/tickets/${ticketOfA}/notes`),
      request(app).post(`/api/tickets/${ticketOfA}/notes`).send({ body: "x" }),
    ]);

    for (const response of answers) {
      expect(response.status).toBe(401);
    }
  });
});

describe("the resolved indication", () => {
  it("API-27 records the time, leaves the status alone, and is idempotent", async () => {
    const before = await prisma.ticket.findUniqueOrThrow({
      where: { id: ticketOfA },
      select: { currentStatus: true, resolvedIndicatedAt: true },
    });

    expect(before).toStrictEqual({
      currentStatus: "IN_PROGRESS",
      resolvedIndicatedAt: null,
    });

    const first = await indicate(requesterA, ticketOfA);

    expect(first.status).toBe(204);
    expect(first.text).toBe("");

    const recorded = await prisma.ticket.findUniqueOrThrow({
      where: { id: ticketOfA },
      select: { currentStatus: true, resolvedIndicatedAt: true },
    });

    expect(recorded.currentStatus).toBe("IN_PROGRESS");
    expect(recorded.resolvedIndicatedAt).toBeInstanceOf(Date);

    const second = await indicate(requesterA, ticketOfA);

    expect(second.status).toBe(204);

    // BR-27: set once. The second call does not move the time.
    const again = await prisma.ticket.findUniqueOrThrow({
      where: { id: ticketOfA },
      select: { currentStatus: true, resolvedIndicatedAt: true },
    });

    expect(again).toStrictEqual(recorded);
  });

  it("API-27 ticket detail carries the time for the Requester and for staff", async () => {
    const unset = await as(requesterA)(
      request(app).get(`/api/tickets/${ticketOfA}`)
    );

    expect(unset.body.resolvedIndicatedAt).toBeNull();

    await indicate(requesterA, ticketOfA);

    const [mine, staffView] = await Promise.all([
      as(requesterA)(request(app).get(`/api/tickets/${ticketOfA}`)),
      as(staff)(request(app).get(`/api/tickets/${ticketOfA}`)),
    ]);

    expect(Date.parse(mine.body.resolvedIndicatedAt)).not.toBeNaN();
    expect(staffView.body.resolvedIndicatedAt).toBe(
      mine.body.resolvedIndicatedAt
    );
    expect(mine.body.currentStatus).toBe("IN_PROGRESS");
  });

  it("API-27 the staff queue row carries the time too", async () => {
    const { ticketNumber } = await prisma.ticket.findUniqueOrThrow({
      where: { id: ticketOfA },
      select: { ticketNumber: true },
    });
    const row = async () => {
      const response = await as(staff)(
        request(app).get("/api/staff/tickets").query({ search: ticketNumber })
      );

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1);

      return response.body.data[0];
    };

    // An explicit null, never an absent key (api-spec.md §7).
    expect(await row()).toHaveProperty("resolvedIndicatedAt", null);

    await indicate(requesterA, ticketOfA);

    const detail = await as(requesterA)(
      request(app).get(`/api/tickets/${ticketOfA}`)
    );

    const indicated = await row();

    expect(indicated.resolvedIndicatedAt).toBe(detail.body.resolvedIndicatedAt);
    expect(detail.body.resolvedIndicatedAt).not.toBeNull();
  });

  it("API-27 a status in the body changes nothing", async () => {
    const response = await indicate(requesterA, ticketOfA).send({
      currentStatus: "RESOLVED",
      status: "CLOSED",
    });

    expect(response.status).toBe(204);

    const ticket = await prisma.ticket.findUniqueOrThrow({
      where: { id: ticketOfA },
      select: { currentStatus: true },
    });

    expect(ticket.currentStatus).toBe("IN_PROGRESS");
  });

  it("SEC-11 IT Staff and Administrators are refused 403, even on a ticket they raised", async () => {
    const answers = await Promise.all([
      indicate(staff, ticketOfA),
      indicate(admin, ticketOfA),
      indicate(staff, staffOwnTicket),
    ]);

    for (const response of answers) {
      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe("FORBIDDEN");
    }

    const tickets = await prisma.ticket.findMany({
      where: { id: { in: [ticketOfA, staffOwnTicket] } },
      select: { resolvedIndicatedAt: true },
    });

    expect(tickets.map((t) => t.resolvedIndicatedAt)).toStrictEqual([
      null,
      null,
    ]);
  });

  it("a Requester indicating on someone else's ticket gets the bytes of a missing one", async () => {
    const [theirs, missing, malformed] = await Promise.all([
      indicate(requesterB, ticketOfA),
      indicate(requesterB, MISSING_ID),
      as(requesterB)(request(app).post("/api/tickets/abc/resolved-indication")),
    ]);

    expect(theirs.status).toBe(404);
    expect(theirs.body).toStrictEqual(missing.body);
    expect(malformed.status).toBe(404);
    expect(theirs.body.error.code).toBe("TICKET_NOT_FOUND");

    const ticket = await prisma.ticket.findUniqueOrThrow({
      where: { id: ticketOfA },
      select: { resolvedIndicatedAt: true },
    });

    expect(ticket.resolvedIndicatedAt).toBeNull();
  });

  it("without a session every endpoint here answers 401", async () => {
    const answers = await Promise.all([
      request(app).get(`/api/tickets/${ticketOfA}/comments`),
      request(app)
        .post(`/api/tickets/${ticketOfA}/comments`)
        .send({ body: "x" }),
      request(app).post(`/api/tickets/${ticketOfA}/resolved-indication`),
    ]);

    for (const response of answers) {
      expect(response.status).toBe(401);
    }
  });
});
