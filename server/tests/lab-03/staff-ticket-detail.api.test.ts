import { unlink } from "node:fs/promises";

import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  ACTIVE_REQUESTER,
  ACTIVE_STAFF,
  ADMINISTRATOR,
  SECOND_REQUESTER,
} from "../../prisma/accounts.js";
import { app } from "../../src/app.js";
import { pathFor } from "../../src/attachments/storage.js";
import { prisma } from "../../src/prisma.js";
import { STATUSES } from "../../src/tickets/domain.js";
import type { SignedInUser } from "./support/signIn.js";
import { signInAs } from "./support/signIn.js";

/**
 * API-20 to API-26, API-31, API-42 — what IT Staff do to a ticket (api-spec.md §7).
 *
 * Every fixture ticket is created directly, so a test can start from any status
 * in the lifecycle without walking the whole matrix to get there. The matrix
 * itself is UNIT-02's subject; these assert the endpoint honours it.
 */

const PREFIX = "STAFF-OPS-TEST";
const MISSING_ID = 99_999_999;

let staff: SignedInUser;
let admin: SignedInUser;
let requester: SignedInUser;
let otherRequester: SignedInUser;

let sequence = 0;

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
        // Rows created directly have no bytes on disk.
      }
    })
  );

  // Attachment rows cascade from the ticket delete below; the unlink above is
  // what the cascade cannot do.
  await prisma.ticket.deleteMany({
    where: { summary: { startsWith: PREFIX } },
  });
};

const createTicket = async (
  overrides: {
    currentStatus?: (typeof STATUSES)[number];
    ticketOwnerId?: number | null;
    itPriority?: "LOW" | "MEDIUM" | "HIGH" | null;
  } = {}
): Promise<number> => {
  const [category, system] = await Promise.all([
    prisma.category.findFirstOrThrow({ where: { isActive: true } }),
    prisma.relatedSystem.findFirstOrThrow({ where: { isActive: true } }),
  ]);

  sequence += 1;

  const ticket = await prisma.ticket.create({
    data: {
      ticketNumber: `TKT-2995-${String(900_000 + sequence)}`,
      requesterId: requester.id,
      categoryId: category.id,
      relatedSystemId: system.id,
      summary: `${PREFIX} ticket ${sequence}`,
      description: "Created by the staff operations suite.",
      requestedPriority: "MEDIUM",
      itPriority: "MEDIUM",
      ...overrides,
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
      requestedPriority: true,
      ticketOwnerId: true,
    },
  });

const patch = (who: SignedInUser, id: number, path: string, body: unknown) =>
  as(who)(request(app).patch(`/api/staff/tickets/${id}/${path}`)).send(
    body as object
  );

beforeAll(async () => {
  await removeFixtures();

  [staff, admin, requester, otherRequester] = await Promise.all([
    signInAs(ACTIVE_STAFF),
    signInAs(ADMINISTRATOR),
    signInAs(ACTIVE_REQUESTER),
    signInAs(SECOND_REQUESTER),
  ]);
});

beforeEach(removeFixtures);

afterAll(async () => {
  await removeFixtures();
  await prisma.$disconnect();
});

describe("ownership", () => {
  it("API-20 IT Staff claim an unowned ticket, and another staff session sees it", async () => {
    const id = await createTicket({ ticketOwnerId: null });
    const response = await patch(staff, id, "owner", { ownerId: staff.id });

    expect(response.status).toBe(200);
    expect(response.body.ticketOwner).toStrictEqual({
      id: staff.id,
      name: ACTIVE_STAFF.name,
    });
    // The response is the whole ticket, as ticket detail returns it (§7).
    expect(response.body.attachments).toStrictEqual([]);
    expect(response.body.ticketNumber).toMatch(/^TKT-/u);

    const seenByAdmin = await as(admin)(request(app).get(`/api/tickets/${id}`));

    expect(seenByAdmin.body.ticketOwner.id).toBe(staff.id);
  });

  it("API-21 an owned ticket is reassigned to a third person, and released with null", async () => {
    const id = await createTicket({ ticketOwnerId: staff.id });

    const reassigned = await patch(admin, id, "owner", { ownerId: admin.id });

    expect(reassigned.status).toBe(200);
    expect(reassigned.body.ticketOwner.id).toBe(admin.id);

    const released = await patch(staff, id, "owner", { ownerId: null });

    expect(released.status).toBe(200);
    expect(released.body.ticketOwner).toBeNull();
    const after = await stored(id);

    expect(after.ticketOwnerId).toBeNull();
  });

  it("API-23 a Requester, an inactive account and an unknown id are all ineligible owners", async () => {
    const inactive = await prisma.user.findFirst({
      where: { isActive: false },
      select: { id: true },
    });

    expect(inactive, "the seed has an inactive account").not.toBeNull();

    const id = await createTicket({ ticketOwnerId: null });

    for (const ownerId of [requester.id, inactive?.id ?? 0, MISSING_ID]) {
      // Sequential: each asserts the ticket is still unowned afterwards.
      // oxlint-disable-next-line no-await-in-loop
      const response = await patch(staff, id, "owner", { ownerId });

      expect(response.status, String(ownerId)).toBe(400);
      expect(response.body.error.code).toBe("TICKET_OWNER_INELIGIBLE");
      // oxlint-disable-next-line no-await-in-loop
      const after = await stored(id);

      expect(after.ticketOwnerId).toBeNull();
    }
  });

  it("refuses a missing, mistyped or unexpected field, and an absent ticket", async () => {
    const id = await createTicket({ ticketOwnerId: null });

    const [empty, wrongType, extra, absent] = await Promise.all([
      patch(staff, id, "owner", {}),
      patch(staff, id, "owner", { ownerId: "3" }),
      patch(staff, id, "owner", { ownerId: staff.id, status: "OPEN" }),
      patch(staff, MISSING_ID, "owner", { ownerId: staff.id }),
    ]);

    for (const response of [empty, wrongType, extra]) {
      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe("VALIDATION_FAILED");
      expect(response.body.error.details).toBeDefined();
    }

    expect(absent.status).toBe(404);
    expect(absent.body.error.code).toBe("TICKET_NOT_FOUND");

    const unchanged = await stored(id);

    expect(unchanged.ticketOwnerId).toBeNull();
  });
});

describe("IT priority", () => {
  it("API-22 IT Priority changes and Requested Priority does not", async () => {
    const id = await createTicket({ itPriority: "MEDIUM" });
    const response = await patch(staff, id, "it-priority", {
      itPriority: "HIGH",
    });

    expect(response.status).toBe(200);
    expect(response.body.itPriority).toBe("HIGH");
    expect(response.body.requestedPriority).toBe("MEDIUM");
    expect(await stored(id)).toMatchObject({
      itPriority: "HIGH",
      requestedPriority: "MEDIUM",
    });
  });

  it("API-22 clears IT Priority with null, still leaving Requested Priority alone", async () => {
    const id = await createTicket({ itPriority: "HIGH" });
    const response = await patch(staff, id, "it-priority", {
      itPriority: null,
    });

    expect(response.status).toBe(200);
    expect(response.body.itPriority).toBeNull();
    expect(response.body.requestedPriority).toBe("MEDIUM");
  });

  it("API-22 refuses a priority outside the three, and a requestedPriority sent here", async () => {
    const id = await createTicket({ itPriority: "LOW" });

    const [invalid, sneaking] = await Promise.all([
      patch(staff, id, "it-priority", { itPriority: "URGENT" }),
      patch(staff, id, "it-priority", { requestedPriority: "HIGH" }),
    ]);

    expect(invalid.status).toBe(400);
    expect(invalid.body.error.details.itPriority).toBeDefined();
    expect(sneaking.status).toBe(400);
    expect(await stored(id)).toMatchObject({
      itPriority: "LOW",
      requestedPriority: "MEDIUM",
    });
  });

  it("BR-23 a ticket created through the API starts with IT Priority copied from the request", async () => {
    const [category, system] = await Promise.all([
      prisma.category.findFirstOrThrow({ where: { isActive: true } }),
      prisma.relatedSystem.findFirstOrThrow({ where: { isActive: true } }),
    ]);

    const response = await as(requester)(
      request(app).post("/api/tickets")
    ).send({
      categoryId: category.id,
      relatedSystemId: system.id,
      summary: `${PREFIX} created through the API`,
      description: "Raised by the staff operations suite.",
      requestedPriority: "HIGH",
    });

    expect(response.status).toBe(201);
    expect(response.body.itPriority).toBe("HIGH");
    expect(response.body.requestedPriority).toBe("HIGH");
  });
});

describe("status", () => {
  it("API-26 a permitted transition is accepted and the new state returned", async () => {
    const id = await createTicket({ currentStatus: "NEW" });
    const response = await patch(staff, id, "status", { status: "OPEN" });

    expect(response.status).toBe(200);
    expect(response.body.currentStatus).toBe("OPEN");

    const opened = await stored(id);

    expect(opened.currentStatus).toBe("OPEN");

    const onward = await patch(admin, id, "status", { status: "IN_PROGRESS" });

    expect(onward.status).toBe(200);
    expect(onward.body.currentStatus).toBe("IN_PROGRESS");
  });

  it("API-26 walks the lifecycle a real ticket takes", async () => {
    const id = await createTicket({ currentStatus: "NEW" });

    for (const status of [
      "OPEN",
      "IN_PROGRESS",
      "WAITING_FOR_REQUESTER",
      "RESOLVED",
      "CLOSED",
      "REOPENED",
      "RESOLVED",
    ] as const) {
      // Sequential by nature: each step starts from the one before it.
      // oxlint-disable-next-line no-await-in-loop
      const response = await patch(staff, id, "status", { status });

      expect(response.status, status).toBe(200);
      expect(response.body.currentStatus).toBe(status);
    }
  });

  it("API-24 a transition outside the matrix is refused and changes nothing", async () => {
    const id = await createTicket({ currentStatus: "NEW" });

    const response = await patch(staff, id, "status", { status: "RESOLVED" });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("INVALID_STATUS_TRANSITION");

    const unmoved = await stored(id);

    expect(unmoved.currentStatus).toBe("NEW");
  });

  it("API-24 refuses a status that is not one of the eight, including the old PENDING", async () => {
    const id = await createTicket({ currentStatus: "OPEN" });

    const [unknown, retired] = await Promise.all([
      patch(staff, id, "status", { status: "DONE" }),
      patch(staff, id, "status", { status: "PENDING" }),
    ]);

    for (const response of [unknown, retired]) {
      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe("VALIDATION_FAILED");
      expect(response.body.error.details.status).toBeDefined();
    }

    const unmoved = await stored(id);

    expect(unmoved.currentStatus).toBe("OPEN");
  });

  it("API-25 CANCELLED is terminal: every status is refused from it", async () => {
    const id = await createTicket({ currentStatus: "CANCELLED" });

    const answers = await Promise.all(
      STATUSES.map(async (status) => ({
        status,
        response: await patch(staff, id, "status", { status }),
      }))
    );

    for (const { status, response } of answers) {
      expect(response.status, status).toBe(400);
      expect(response.body.error.code).toBe("INVALID_STATUS_TRANSITION");
      expect(response.body.error.message).toMatch(/cancelled/iu);
    }

    const terminal = await stored(id);

    expect(terminal.currentStatus).toBe("CANCELLED");
  });

  it("API-25 a ticket can be cancelled from every status the matrix allows", async () => {
    for (const from of [
      "NEW",
      "OPEN",
      "IN_PROGRESS",
      "WAITING_FOR_REQUESTER",
      "REOPENED",
    ] as const) {
      // oxlint-disable-next-line no-await-in-loop
      const id = await createTicket({ currentStatus: from });
      // oxlint-disable-next-line no-await-in-loop
      const response = await patch(staff, id, "status", {
        status: "CANCELLED",
      });

      expect(response.status, from).toBe(200);
    }

    // Resolved and Closed go to Closed or Reopened, never straight to cancelled.
    for (const from of ["RESOLVED", "CLOSED"] as const) {
      // oxlint-disable-next-line no-await-in-loop
      const id = await createTicket({ currentStatus: from });
      // oxlint-disable-next-line no-await-in-loop
      const response = await patch(staff, id, "status", {
        status: "CANCELLED",
      });

      expect(response.status, from).toBe(400);
    }
  });

  it("refuses two staff moving one ticket at once, rather than letting the second overwrite", async () => {
    const id = await createTicket({ currentStatus: "NEW" });

    const [first, second] = await Promise.all([
      patch(staff, id, "status", { status: "OPEN" }),
      patch(admin, id, "status", { status: "CANCELLED" }),
    ]);

    const outcomes = [first.status, second.status].toSorted();

    // Both were permitted from NEW, so one wins and the other is told the
    // ticket moved — never both applied, and never a silent overwrite.
    expect(outcomes).toStrictEqual([200, 400]);

    const after = await stored(id);

    expect(["OPEN", "CANCELLED"]).toContain(after.currentStatus);
  });
});

describe("a requester's attachments, read by staff (AC-27)", () => {
  const PDF = Buffer.from("%PDF-1.4\nstaff detail suite\n%%EOF\n");

  it("API-31 staff list the metadata and download the bytes", async () => {
    const id = await createTicket({ ticketOwnerId: null });

    const uploaded = await as(requester)(
      request(app).post(`/api/tickets/${id}/attachments`)
    ).attach("file", PDF, {
      filename: "report.pdf",
      contentType: "application/pdf",
    });

    expect(uploaded.status).toBe(201);
    expect(uploaded.body).toMatchObject({
      originalFilename: "report.pdf",
      mimeType: "application/pdf",
      status: "ACTIVE",
    });

    const attachmentId = uploaded.body.id as number;

    const listing = await as(staff)(
      request(app).get(`/api/tickets/${id}/attachments`)
    );

    expect(listing.status).toBe(200);
    const row = (listing.body.data as Record<string, unknown>[]).find(
      (one) => one["id"] === attachmentId
    );

    expect(row).toMatchObject({
      id: attachmentId,
      originalFilename: "report.pdf",
      mimeType: "application/pdf",
      sizeBytes: PDF.length,
      uploadedBy: { id: requester.id, name: ACTIVE_REQUESTER.name },
      status: "ACTIVE",
    });
    // The name on disk is an internal detail and never leaves (BR-24).
    expect(row).not.toHaveProperty("storedFilename");

    const download = await as(staff)(
      request(app).get(`/api/attachments/${attachmentId}/download`)
    );

    expect(download.status).toBe(200);
    expect(download.headers["content-type"]).toContain("application/pdf");
    expect(download.headers["content-disposition"]).toContain("report.pdf");
    expect(Number(download.headers["content-length"])).toBe(PDF.length);
    // Binary bodies arrive as a Buffer, not text.
    expect(
      Buffer.from(download.body as Uint8Array).toString("utf-8")
    ).toContain("%PDF-1.4");
  });

  it("API-31 the staff ticket detail carries the same attachment", async () => {
    const id = await createTicket({ ticketOwnerId: staff.id });

    const uploaded = await as(requester)(
      request(app).post(`/api/tickets/${id}/attachments`)
    ).attach("file", PDF, {
      filename: "detail.pdf",
      contentType: "application/pdf",
    });

    const detail = await as(staff)(request(app).get(`/api/tickets/${id}`));

    expect(detail.status).toBe(200);
    expect(detail.body.attachments).toMatchObject([
      { id: uploaded.body.id, originalFilename: "detail.pdf" },
    ]);
  });
});

describe("IT Priority at creation (BR-23)", () => {
  it("API-42 a new ticket's IT Priority equals its Requested Priority, and moving one never moves the other", async () => {
    const [category, system] = await Promise.all([
      prisma.category.findFirstOrThrow({ where: { isActive: true } }),
      prisma.relatedSystem.findFirstOrThrow({ where: { isActive: true } }),
    ]);

    const created = await as(requester)(request(app).post("/api/tickets")).send(
      {
        categoryId: category.id,
        relatedSystemId: system.id,
        summary: `${PREFIX} IT Priority starts as a copy`,
        description: "Raised by the staff operations suite.",
        requestedPriority: "HIGH",
      }
    );

    expect(created.status).toBe(201);
    expect(created.body.itPriority).toBe("HIGH");
    expect(created.body.requestedPriority).toBe("HIGH");

    const id = created.body.id as number;

    // Checked by writing both columns: the test failed.
    const moved = await patch(staff, id, "it-priority", { itPriority: "LOW" });

    expect(moved.status).toBe(200);
    expect(moved.body.itPriority).toBe("LOW");
    expect(moved.body.requestedPriority).toBe("HIGH");
    expect(await stored(id)).toMatchObject({
      itPriority: "LOW",
      requestedPriority: "HIGH",
    });
  });
});

describe("who may call these at all", () => {
  it("SEC-05 a Requester is refused 403 on all three, and nothing changes", async () => {
    const id = await createTicket({ currentStatus: "NEW", itPriority: "LOW" });

    const answers = await Promise.all([
      patch(requester, id, "owner", { ownerId: requester.id }),
      patch(requester, id, "it-priority", { itPriority: "HIGH" }),
      patch(requester, id, "status", { status: "OPEN" }),
      patch(otherRequester, id, "status", { status: "OPEN" }),
    ]);

    for (const response of answers) {
      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe("FORBIDDEN");
    }

    expect(await stored(id)).toMatchObject({
      currentStatus: "NEW",
      itPriority: "LOW",
      ticketOwnerId: null,
    });
  });

  it("refuses all three without a session", async () => {
    const id = await createTicket();

    const answers = await Promise.all([
      request(app)
        .patch(`/api/staff/tickets/${id}/owner`)
        .send({ ownerId: null }),
      request(app)
        .patch(`/api/staff/tickets/${id}/it-priority`)
        .send({ itPriority: "LOW" }),
      request(app)
        .patch(`/api/staff/tickets/${id}/status`)
        .send({ status: "OPEN" }),
    ]);

    for (const response of answers) {
      expect(response.status).toBe(401);
    }
  });
});
