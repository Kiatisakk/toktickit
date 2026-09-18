import { readdir, readFile, unlink } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  ACTIVE_REQUESTER,
  ACTIVE_STAFF,
  ADMINISTRATOR,
  MUST_CHANGE_REQUESTER,
  SECOND_REQUESTER,
} from "../../prisma/accounts.js";
import { app } from "../../src/app.js";
import { pathFor } from "../../src/attachments/storage.js";
import { hashPassword } from "../../src/auth/password.js";
import { prisma } from "../../src/prisma.js";
import type { SignedInUser } from "./support/signIn.js";
import { signInAs } from "./support/signIn.js";

/**
 * Who may reach what, asked of the API directly (tests.md, Security).
 *
 * Everything here arrives with a real session of the wrong kind — or none —
 * and never through the interface: a control the interface hides is feedback,
 * not a boundary (BR-17), so the boundary is asserted where it lives.
 *
 * Covers SEC-01, SEC-03, SEC-04, SEC-05, SEC-06, SEC-08, SEC-10, SEC-13,
 * SEC-14,
 * SEC-15, API-14, API-41, API-46 and MIG-06. The Administrator and staff
 * status rows in the same table arrive with the endpoints they test.
 */

const PREFIX = "AUTHZ-TEST";
const PDF = Buffer.from("%PDF-1.4\nauthorization suite\n%%EOF\n");
const MISSING_ID = 99_999_999;

let requesterA: SignedInUser;
let requesterB: SignedInUser;
let staff: SignedInUser;
let admin: SignedInUser;
let gated: SignedInUser;

let ticketOfA = 0;
let attachmentOfA = 0;

const as = (who: SignedInUser) => (r: request.Test) =>
  r.set("Cookie", who.cookie);

const removeFixtures = async () => {
  const stored = await prisma.attachment.findMany({
    where: { ticket: { summary: { startsWith: PREFIX } } },
    select: { storedFilename: true },
  });

  await Promise.all(
    stored.map(async (row) => {
      try {
        await unlink(pathFor(row.storedFilename));
      } catch {
        // Rows created directly by this suite have no bytes on disk.
      }
    })
  );

  await prisma.attachment.deleteMany({
    where: { ticket: { summary: { startsWith: PREFIX } } },
  });
  await prisma.ticket.deleteMany({
    where: { summary: { startsWith: PREFIX } },
  });
};

beforeAll(async () => {
  await removeFixtures();

  [requesterA, requesterB, staff, admin, gated] = await Promise.all([
    signInAs(ACTIVE_REQUESTER),
    signInAs(SECOND_REQUESTER),
    signInAs(ACTIVE_STAFF),
    signInAs(ADMINISTRATOR),
    signInAs(MUST_CHANGE_REQUESTER),
  ]);

  const category = await prisma.category.findFirstOrThrow({
    where: { isActive: true },
  });
  const system = await prisma.relatedSystem.findFirstOrThrow({
    where: { isActive: true },
  });

  const ticket = await prisma.ticket.create({
    data: {
      ticketNumber: "TKT-2997-700001",
      requesterId: requesterA.id,
      categoryId: category.id,
      relatedSystemId: system.id,
      summary: `${PREFIX} ticket of A`,
      description: "Created by the authorization suite.",
      requestedPriority: "MEDIUM",
    },
    select: { id: true },
  });

  ticketOfA = ticket.id;

  const uploaded = await as(requesterA)(
    request(app).post(`/api/tickets/${ticketOfA}/attachments`)
  ).attach("file", PDF, {
    filename: "evidence.pdf",
    contentType: "application/pdf",
  });

  attachmentOfA = uploaded.body.id;
});

afterAll(async () => {
  await removeFixtures();
  await prisma.$disconnect();
});

const newTicketBody = (overrides: Record<string, unknown> = {}) => ({
  categoryId: 0,
  relatedSystemId: 0,
  summary: `${PREFIX} raised through the API`,
  description: "Raised by the authorization suite.",
  requestedPriority: "LOW",
  ...overrides,
});

const referenceIds = async () => {
  const [category, system] = await Promise.all([
    prisma.category.findFirstOrThrow({ where: { isActive: true } }),
    prisma.relatedSystem.findFirstOrThrow({ where: { isActive: true } }),
  ]);

  return { categoryId: category.id, relatedSystemId: system.id };
};

/**
 * Every protected endpoint in the route table, as one list.
 *
 * One list rather than a test per route, so a route added later without a
 * guard fails here by being added here — and a route added without being added
 * here is the omission a reviewer is looking for.
 */
const protectedRoutes = (): {
  method: "get" | "post" | "delete";
  path: string;
}[] => [
  { method: "get", path: "/api/categories" },
  { method: "get", path: "/api/related-systems" },
  { method: "post", path: "/api/tickets" },
  { method: "get", path: "/api/tickets" },
  { method: "get", path: `/api/tickets/${ticketOfA}` },
  { method: "get", path: `/api/tickets/${ticketOfA}/attachments` },
  { method: "post", path: `/api/tickets/${ticketOfA}/attachments` },
  { method: "get", path: `/api/attachments/${attachmentOfA}/download` },
  { method: "delete", path: `/api/attachments/${attachmentOfA}` },
  { method: "get", path: "/api/staff/tickets" },
  { method: "get", path: "/api/staff/owners" },
  { method: "get", path: `/api/tickets/${ticketOfA}/comments` },
  { method: "post", path: `/api/tickets/${ticketOfA}/comments` },
  { method: "post", path: `/api/tickets/${ticketOfA}/resolved-indication` },
];

describe("without a session", () => {
  it("SEC-01 every protected endpoint answers 401 UNAUTHENTICATED", async () => {
    const routes = [
      ...protectedRoutes(),
      { method: "get" as const, path: "/api/auth/me" },
      { method: "post" as const, path: "/api/auth/password" },
    ];

    const answers = await Promise.all(
      routes.map(async ({ method, path: route }) => {
        const response = await request(app)[method](route);

        return { method, route, status: response.status, body: response.body };
      })
    );

    expect(answers).toStrictEqual(
      routes.map(({ method, path: route }) => ({
        method,
        route,
        status: 401,
        body: expect.objectContaining({
          error: expect.objectContaining({ code: "UNAUTHENTICATED" }),
        }),
      }))
    );
  });

  it("SEC-01 excepts sign-out, which is idempotent and answers 204", async () => {
    const response = await request(app).post("/api/auth/logout");

    expect(response.status).toBe(204);
  });

  it("API-41 reference data requires a session; health stays public", async () => {
    const [categories, systems, health] = await Promise.all([
      request(app).get("/api/categories"),
      request(app).get("/api/related-systems"),
      request(app).get("/api/health"),
    ]);

    expect(categories.status).toBe(401);
    expect(systems.status).toBe(401);
    expect(health.status).toBe(200);
  });
});

describe("with an outstanding password change", () => {
  it("SEC-06 every protected endpoint answers 403 PASSWORD_CHANGE_REQUIRED", async () => {
    const routes = protectedRoutes();
    const answers = await Promise.all(
      routes.map(async ({ method, path: route }) => {
        const response = await as(gated)(request(app)[method](route));

        return { method, route, status: response.status, body: response.body };
      })
    );

    expect(answers).toStrictEqual(
      routes.map(({ method, path: route }) => ({
        method,
        route,
        status: 403,
        body: expect.objectContaining({
          error: expect.objectContaining({ code: "PASSWORD_CHANGE_REQUIRED" }),
        }),
      }))
    );
  });
});

describe("identity supplied by the client", () => {
  it("API-14 a requesterId in the body is ignored; the ticket is the caller's", async () => {
    const response = await as(requesterA)(
      request(app).post("/api/tickets")
    ).send(
      newTicketBody({
        ...(await referenceIds()),
        requesterId: requesterB.id,
      })
    );

    expect(response.status).toBe(201);
    expect(response.body.requester.id).toBe(requesterA.id);

    const stored = await prisma.ticket.findUniqueOrThrow({
      where: { id: response.body.id },
      select: { requesterId: true },
    });

    expect(stored.requesterId).toBe(requesterA.id);
  });

  it("SEC-03 naming another requester in the query returns none of their data", async () => {
    const response = await as(requesterB)(
      request(app).get(`/api/tickets?requesterId=${requesterA.id}`)
    );

    // Not a documented My Tickets parameter, so it is refused outright (BR-34)
    // rather than quietly honoured or quietly dropped.
    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      error: { code: "INVALID_QUERY_PARAMETER" },
    });
    expect(response.body).not.toHaveProperty("data");
  });

  it("SEC-14 the retired development header changes nothing", async () => {
    const withHeader = await as(requesterB)(
      request(app)
        .get("/api/tickets")
        .set("X-Development-Requester-Id", String(requesterA.id))
    );
    const without = await as(requesterB)(request(app).get("/api/tickets"));

    expect(withHeader.status).toBe(200);
    expect(withHeader.body).toStrictEqual(without.body);

    const ids = (withHeader.body.data as { id: number }[]).map((row) => row.id);

    expect(ids).not.toContain(ticketOfA);
  });

  it("SEC-14 the retired header alone is not a session", async () => {
    const response = await request(app)
      .get("/api/tickets")
      .set("X-Development-Requester-Id", String(requesterA.id));

    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({ error: { code: "UNAUTHENTICATED" } });
  });
});

describe("the ownership boundary", () => {
  it("SEC-04 another requester's ticket is byte-identical to a missing one", async () => {
    const [theirs, missing] = await Promise.all([
      as(requesterB)(request(app).get(`/api/tickets/${ticketOfA}`)),
      as(requesterB)(request(app).get(`/api/tickets/${MISSING_ID}`)),
    ]);

    expect(theirs.status).toBe(404);
    expect(theirs.text).toBe(missing.text);
    expect(theirs.body).toMatchObject({ error: { code: "TICKET_NOT_FOUND" } });
  });

  it("SEC-04 the same holds for the ticket's attachment list", async () => {
    const [theirs, missing] = await Promise.all([
      as(requesterB)(request(app).get(`/api/tickets/${ticketOfA}/attachments`)),
      as(requesterB)(
        request(app).get(`/api/tickets/${MISSING_ID}/attachments`)
      ),
    ]);

    expect(theirs.status).toBe(404);
    expect(theirs.text).toBe(missing.text);
  });

  it("SEC-10 another requester's attachment download and removal both 404", async () => {
    const [download, missingDownload, removal, missingRemoval] =
      await Promise.all([
        as(requesterB)(
          request(app).get(`/api/attachments/${attachmentOfA}/download`)
        ),
        as(requesterB)(
          request(app).get(`/api/attachments/${MISSING_ID}/download`)
        ),
        as(requesterB)(
          request(app).delete(`/api/attachments/${attachmentOfA}`)
        ).send({ reason: "Not mine, removing anyway" }),
        as(requesterB)(
          request(app).delete(`/api/attachments/${MISSING_ID}`)
        ).send({ reason: "Not mine, removing anyway" }),
      ]);

    expect(download.status).toBe(404);
    expect(download.text).toBe(missingDownload.text);
    expect(removal.status).toBe(404);
    expect(removal.text).toBe(missingRemoval.text);

    const row = await prisma.attachment.findUniqueOrThrow({
      where: { id: attachmentOfA },
      select: { removedAt: true },
    });

    expect(row.removedAt).toBeNull();
  });
});

describe("the staff queue", () => {
  it.each(["/api/staff/tickets", "/api/staff/owners"])(
    "SEC-05 a Requester calling %s directly is refused 403 FORBIDDEN (AC-13)",
    async (endpoint) => {
      const response = await as(requesterA)(request(app).get(endpoint));

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe("FORBIDDEN");
    }
  );

  it("SEC-05 the refusal comes before the query is read, so a bad query still answers 403", async () => {
    // A Requester must not learn the queue's parameter rules from its 400s.
    const response = await as(requesterA)(
      request(app).get("/api/staff/tickets").query({ sort: "nonsense" })
    );

    expect(response.status).toBe(403);
  });

  it.each([
    { who: "IT Staff", pick: () => staff },
    { who: "an Administrator", pick: () => admin },
  ])("$who may read it", async ({ pick }) => {
    const response = await as(pick())(request(app).get("/api/staff/tickets"));

    expect(response.status).toBe(200);
  });
});

describe("staff and the tickets they did not raise", () => {
  it("SEC-15 IT Staff may read and download another's attachment", async () => {
    const [detail, listing, download] = await Promise.all([
      as(staff)(request(app).get(`/api/tickets/${ticketOfA}`)),
      as(staff)(request(app).get(`/api/tickets/${ticketOfA}/attachments`)),
      as(staff)(request(app).get(`/api/attachments/${attachmentOfA}/download`)),
    ]);

    expect(detail.status).toBe(200);
    expect(listing.status).toBe(200);
    expect(download.status).toBe(200);
  });

  it("SEC-15 IT Staff uploading to, or removing from, that ticket answers 404", async () => {
    const upload = await as(staff)(
      request(app).post(`/api/tickets/${ticketOfA}/attachments`)
    ).attach("file", PDF, {
      filename: "staff-upload.pdf",
      contentType: "application/pdf",
    });
    const removal = await as(staff)(
      request(app).delete(`/api/attachments/${attachmentOfA}`)
    ).send({ reason: "Staff should not be able to do this" });

    expect(upload.status).toBe(404);
    expect(upload.body).toMatchObject({ error: { code: "TICKET_NOT_FOUND" } });
    expect(removal.status).toBe(404);
    expect(removal.body).toMatchObject({
      error: { code: "ATTACHMENT_NOT_FOUND" },
    });

    const active = await prisma.attachment.count({
      where: { ticketId: ticketOfA, removedAt: null },
    });

    expect(active).toBe(1);
  });
});

describe("staff raise tickets too", () => {
  it.each([
    ["IT Staff", () => staff],
    ["an Administrator", () => admin],
  ])(
    "API-46 %s raises a ticket and finds only their own in My Tickets",
    async (_label, who) => {
      const created = await as(who())(request(app).post("/api/tickets")).send(
        newTicketBody({ ...(await referenceIds()) })
      );

      expect(created.status).toBe(201);
      expect(created.body.requester.id).toBe(who().id);

      const mine = await as(who())(request(app).get("/api/tickets"));
      const ids = (mine.body.data as { id: number }[]).map((row) => row.id);

      expect(ids).toContain(created.body.id);
      // "My Tickets" for staff is theirs, not the queue (FR-30, D-07).
      expect(ids).not.toContain(ticketOfA);

      const detail = await as(who())(
        request(app).get(`/api/tickets/${created.body.id}`)
      );

      expect(detail.status).toBe(200);
    }
  );
});

/**
 * MIG-06 — nothing client-supplied remains (BR-41).
 *
 * Read from the source rather than probed through the API: the property is
 * that no module *could* accept a client identity, and a request can only show
 * that the routes it happens to try do not.
 */
describe("the retired mechanism is gone from the source", () => {
  const repository = fileURLToPath(new URL("../../../", import.meta.url));

  const sourceFiles = async (directory: string): Promise<string[]> => {
    const entries = await readdir(path.join(repository, directory), {
      recursive: true,
      withFileTypes: true,
    });

    return entries
      .filter(
        (entry) =>
          entry.isFile() &&
          /\.(?:ts|tsx)$/u.test(entry.name) &&
          !entry.parentPath.includes("generated")
      )
      .map((entry) => path.join(entry.parentPath, entry.name));
  };

  const offenders = async (directories: string[], pattern: RegExp) => {
    const perDirectory = await Promise.all(
      directories.map((directory) => sourceFiles(directory))
    );
    const files = perDirectory.flat();
    const contents = await Promise.all(
      files.map(async (file) => ({ file, text: await readFile(file, "utf-8") }))
    );

    return contents
      .filter(({ text }) => pattern.test(text))
      .map(({ file }) => file.slice(repository.length));
  };

  it("MIG-06 the scan can see the files it claims to scan", async () => {
    // A scan over nothing passes every assertion below. This one fails if the
    // path is wrong.
    const server = await sourceFiles("server/src");
    const client = await sourceFiles("client/src");

    expect(server.some((file) => file.endsWith("app.ts"))).toBe(true);
    expect(client.some((file) => file.endsWith("router.tsx"))).toBe(true);
  });

  it("MIG-06 no module names the development requester header", async () => {
    expect(
      await offenders(["server/src", "client/src"], /development-requester/iu)
    ).toStrictEqual([]);
  });

  it("MIG-06 no module reaches the selector's endpoint or route", async () => {
    expect(
      await offenders(
        ["server/src", "client/src"],
        /\/api\/requesters|\/select-requester/u
      )
    ).toStrictEqual([]);
  });

  it("MIG-06 the client stores no identity in the browser (D-13)", async () => {
    expect(
      await offenders(["client/src"], /(?:local|session)Storage\s*\./u)
    ).toStrictEqual([]);
  });

  it("MIG-06 no server module reads a requesterId from a request body", async () => {
    // The body only. The staff queue's documented `requesterId` filter (api-spec
    // §7) narrows a list staff may already read in full; it is not a claim
    // about who is asking.
    expect(
      await offenders(["server/src"], /body\s*(?:\.|\[\s*["'])requesterId/u)
    ).toStrictEqual([]);
  });
});

describe("a Requester and the ticket status", () => {
  it("SEC-08 no route lets a Requester set a status, on their own ticket", async () => {
    // Every shape a client might guess. None is a route, so each is refused by
    // the catch-all rather than by a guard that could be forgotten (AC-23).
    const ticket = `/api/tickets/${ticketOfA}`;
    const attempts = await Promise.all([
      as(requesterA)(request(app).patch(ticket)).send({
        currentStatus: "RESOLVED",
      }),
      as(requesterA)(request(app).put(ticket)).send({
        currentStatus: "CLOSED",
      }),
      as(requesterA)(request(app).patch(`${ticket}/status`)).send({
        status: "RESOLVED",
      }),
      as(requesterA)(request(app).post(`${ticket}/status`)).send({
        status: "CLOSED",
      }),
    ]);

    for (const response of attempts) {
      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe("ROUTE_NOT_FOUND");
    }

    // The one endpoint a Requester may use on the lifecycle's edge records a
    // timestamp and ignores a status sent with it (API-27).
    const indication = await as(requesterA)(
      request(app).post(`${ticket}/resolved-indication`)
    ).send({ currentStatus: "RESOLVED" });

    expect(indication.status).toBe(204);

    const stored = await prisma.ticket.findUniqueOrThrow({
      where: { id: ticketOfA },
      select: { currentStatus: true },
    });

    expect(stored.currentStatus).toBe("NEW");
  });
});

describe("a role that changes while a session is open", () => {
  const EMAIL = "authz.demoted@example.ac.th";
  const PASSWORD = "Demoted-1-Staff!";

  const removeAccount = async () => {
    await prisma.user.deleteMany({ where: { email: EMAIL } });
  };

  beforeAll(async () => {
    await removeAccount();
    await prisma.user.create({
      data: {
        name: "Demoted Staff",
        email: EMAIL,
        role: "IT_STAFF",
        passwordHash: await hashPassword(PASSWORD),
      },
    });
  });

  afterAll(removeAccount);

  it("SEC-13 a demotion takes effect on the next request, not at the next sign-in", async () => {
    // Its own account, not a seeded one: demoting a shared account would change
    // what every other suite running beside this one is allowed to do.
    const demoted = await signInAs({ email: EMAIL, password: PASSWORD });

    const asStaff = await as(demoted)(request(app).get("/api/staff/tickets"));

    expect(asStaff.status).toBe(200);

    await prisma.user.update({
      where: { id: demoted.id },
      data: { role: "REQUESTER" },
    });

    // Same cookie, same session row. The role is read from the user record on
    // every request, so nothing had to expire (BR-15, D-02).
    const [queue, owners, operation, own] = await Promise.all([
      as(demoted)(request(app).get("/api/staff/tickets")),
      as(demoted)(request(app).get("/api/staff/owners")),
      as(demoted)(
        request(app).patch(`/api/staff/tickets/${ticketOfA}/status`)
      ).send({ status: "OPEN" }),
      as(demoted)(request(app).get("/api/tickets")),
    ]);

    for (const response of [queue, owners, operation]) {
      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe("FORBIDDEN");
    }

    // Still signed in, and still able to do what a Requester may do: this is a
    // demotion, not a sign-out.
    expect(own.status).toBe(200);
  });
});
