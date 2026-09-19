import { readdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { ACTIVE_REQUESTER, ACTIVE_STAFF } from "../../prisma/accounts.js";
import { app } from "../../src/app.js";
import { pathFor } from "../../src/attachments/storage.js";
import { prisma } from "../../src/prisma.js";
import type { SignedInUser } from "./support/signIn.js";
import { signInAs } from "./support/signIn.js";

/**
 * The move from the development header to the session kept every relationship
 * intact (BR-39, BR-40).
 *
 * MIG-01 — users keep their identifiers, and a ticket's requester still resolves.
 * MIG-02 — attachment uploader and remover references stay valid.
 * MIG-03 — the renamed status, and the IT Priority the same migration backfilled.
 * MIG-04 — an attachment uploaded before the staff endpoints existed is still
 *   reachable by its owner, and now by staff.
 * MIG-08 — the password backfill: no null hash, and an account the seed does
 *   not know stays locked until an Administrator issues it a password.
 * API-45 — the Lab 2 list envelope is preserved.
 *
 * Three kinds of evidence, because each alone is weak. The migrations are read,
 * to show nothing since Lab 2 rewrote a user's id. The constraints are read, to
 * show the database refuses an orphan rather than merely not containing one
 * today. And a row written the way Lab 2 wrote it — against a stored user id,
 * with no session anywhere — is read back through a signed-in session, which is
 * the property that actually matters: the id the header named is the id the
 * session resolves to.
 */

const PREFIX = "MIGRATION-TEST";

/** The last migration Lab 2 shipped. Everything after it is Lab 3's. */
const LAST_LAB_2_MIGRATION = "20260831021324_add_attachment";

let requester: SignedInUser;
let ticketId = 0;
let waitingTicketId = 0;
let attachmentId = 0;

const cleanUp = async () => {
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

  await prisma.attachment.deleteMany({
    where: { ticket: { summary: { startsWith: PREFIX } } },
  });
  await prisma.ticket.deleteMany({
    where: { summary: { startsWith: PREFIX } },
  });
};

beforeAll(async () => {
  await cleanUp();

  requester = await signInAs(ACTIVE_REQUESTER);

  const [category, system] = await Promise.all([
    prisma.category.findFirstOrThrow({ where: { isActive: true } }),
    prisma.relatedSystem.findFirstOrThrow({ where: { isActive: true } }),
  ]);

  // Written straight to the table with an id, exactly as a Lab 2 row was: no
  // session exists at the moment of writing.
  const ticket = await prisma.ticket.create({
    data: {
      ticketNumber: "TKT-2996-600001",
      requesterId: requester.id,
      categoryId: category.id,
      relatedSystemId: system.id,
      summary: `${PREFIX} a ticket raised under the header`,
      description: "Stands in for a ticket raised before sign-in existed.",
      requestedPriority: "HIGH",
    },
    select: { id: true },
  });

  ticketId = ticket.id;

  // The status Lab 2 spelled `PENDING`. After the rename there is one spelling
  // for it, and this row holds it.
  const waiting = await prisma.ticket.create({
    data: {
      ticketNumber: "TKT-2996-600002",
      requesterId: requester.id,
      categoryId: category.id,
      relatedSystemId: system.id,
      summary: `${PREFIX} a ticket awaiting its requester`,
      description: "Holds the status Lab 2 called Pending.",
      requestedPriority: "LOW",
      currentStatus: "WAITING_FOR_REQUESTER",
    },
    select: { id: true },
  });

  waitingTicketId = waiting.id;

  const attachment = await prisma.attachment.create({
    data: {
      ticketId,
      originalFilename: "before-sign-in.pdf",
      storedFilename: `${PREFIX.toLowerCase()}-${Date.now()}.pdf`,
      mimeType: "application/pdf",
      sizeBytes: 1024,
      uploadedById: requester.id,
      removedAt: new Date(),
      removedReason: "Removed before sign-in existed",
      removedById: requester.id,
    },
    select: { id: true },
  });

  attachmentId = attachment.id;
});

afterAll(async () => {
  await cleanUp();
  await prisma.$disconnect();
});

const lab3Migrations = async (): Promise<{ name: string; sql: string }[]> => {
  const directory = fileURLToPath(
    new URL("../../prisma/migrations", import.meta.url)
  );
  const entries = await readdir(directory, { withFileTypes: true });
  const names = entries
    .filter((entry) => entry.isDirectory() && entry.name > LAST_LAB_2_MIGRATION)
    .map((entry) => entry.name);

  return await Promise.all(
    names.map(async (name) => ({
      name,
      sql: await readFile(path.join(directory, name, "migration.sql"), "utf-8"),
    }))
  );
};

interface ForeignKey {
  table: string;
  column: string;
  references: string;
}

/** Every foreign key in the schema, as `Table.column -> Table`. */
const foreignKeys = async (): Promise<ForeignKey[]> =>
  await prisma.$queryRaw<ForeignKey[]>`
    SELECT kcu.table_name  AS "table",
           kcu.column_name AS "column",
           ccu.table_name  AS "references"
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
    JOIN information_schema.constraint_column_usage ccu
      ON tc.constraint_name = ccu.constraint_name
    WHERE tc.constraint_type = 'FOREIGN KEY'`;

describe("MIG-01 users keep their identifiers", () => {
  it("MIG-01 finds the Lab 3 migrations it is about to inspect", async () => {
    // Guards the next test: a filter that matched no directory would pass it.
    const migrations = await lab3Migrations();
    const names = migrations.map((migration) => migration.name);

    expect(names).toContain("20260910165043_add_session_and_password");
  });

  it("MIG-01 no Lab 3 migration drops, truncates or renumbers users", async () => {
    const destructive =
      /DROP TABLE\s+"User"|TRUNCATE[^;]*"User"|DELETE FROM\s+"User"|ALTER TABLE\s+"User"[^;]*"id"|UPDATE\s+"User"\s+SET[^;]*"id"/iu;

    for (const { name, sql } of await lab3Migrations()) {
      expect({ name, destructive: destructive.test(sql) }).toStrictEqual({
        name,
        destructive: false,
      });
    }
  });

  it("MIG-01 a ticket's requester is enforced by a foreign key to User", async () => {
    expect(await foreignKeys()).toContainEqual({
      table: "Ticket",
      column: "requesterId",
      references: "User",
    });
  });

  it("MIG-01 no ticket refers to a user who does not exist", async () => {
    const [{ orphans }] = await prisma.$queryRaw<{ orphans: number }[]>`
      SELECT COUNT(*)::int AS orphans
      FROM "Ticket" t LEFT JOIN "User" u ON u.id = t."requesterId"
      WHERE u.id IS NULL`;

    expect(orphans).toBe(0);
  });

  it("MIG-01 a ticket written against a stored id is the signed-in user's", async () => {
    const [listing, detail] = await Promise.all([
      request(app).get("/api/tickets").set("Cookie", requester.cookie),
      request(app)
        .get(`/api/tickets/${ticketId}`)
        .set("Cookie", requester.cookie),
    ]);

    const ids = (listing.body.data as { id: number }[]).map((row) => row.id);

    expect(ids).toContain(ticketId);
    expect(detail.status).toBe(200);
    expect(detail.body.requester).toStrictEqual({
      id: requester.id,
      name: ACTIVE_REQUESTER.name,
    });
  });
});

describe("MIG-02 attachment relations survive", () => {
  it("MIG-02 uploader and remover are enforced by foreign keys to User", async () => {
    const keys = await foreignKeys();

    expect(keys).toContainEqual({
      table: "Attachment",
      column: "uploadedById",
      references: "User",
    });
    expect(keys).toContainEqual({
      table: "Attachment",
      column: "removedById",
      references: "User",
    });
  });

  it("MIG-02 no attachment refers to a user who does not exist", async () => {
    const [{ orphans }] = await prisma.$queryRaw<{ orphans: number }[]>`
      SELECT COUNT(*)::int AS orphans
      FROM "Attachment" a
      LEFT JOIN "User" up ON up.id = a."uploadedById"
      LEFT JOIN "User" rm ON rm.id = a."removedById"
      WHERE up.id IS NULL OR (a."removedById" IS NOT NULL AND rm.id IS NULL)`;

    expect(orphans).toBe(0);
  });

  it("MIG-02 the uploader and remover resolve to the signed-in user", async () => {
    const response = await request(app)
      .get(`/api/tickets/${ticketId}/attachments`)
      .set("Cookie", requester.cookie);

    const row = (
      response.body.data as {
        id: number;
        uploadedBy: { id: number };
        removedBy: { id: number } | null;
      }[]
    ).find((one) => one.id === attachmentId);

    expect(row?.uploadedBy.id).toBe(requester.id);
    expect(row?.removedBy?.id).toBe(requester.id);
  });
});

describe("API-45 the Lab 2 list envelope", () => {
  it("API-45 answers data and meta with totalItems, exactly as Lab 2 documents", async () => {
    const response = await request(app)
      .get("/api/tickets?page=1&pageSize=10")
      .set("Cookie", requester.cookie);

    expect(response.status).toBe(200);
    expect(Object.keys(response.body).toSorted()).toStrictEqual([
      "data",
      "meta",
    ]);
    expect(Object.keys(response.body.meta).toSorted()).toStrictEqual([
      "page",
      "pageSize",
      "totalItems",
      "totalPages",
    ]);
    expect(response.body.meta).toMatchObject({ page: 1, pageSize: 10 });
  });
});

describe("MIG-03 the renamed status", () => {
  it("MIG-03 renames the enum value in place rather than adding and dropping one", async () => {
    const migrations = await lab3Migrations();
    const renames = migrations.filter(({ sql }) =>
      /RENAME VALUE 'PENDING' TO 'WAITING_FOR_REQUESTER'/iu.test(sql)
    );

    expect(renames).toHaveLength(1);

    // A rename carries every existing row with it. Adding a value and updating
    // rows over to it would work too, but it would move the value to the end of
    // the enum and take the queue's status ordering with it (D-11).
    for (const { name, sql } of await lab3Migrations()) {
      expect({
        name,
        dropped: /DROP TYPE\s+"TicketStatus"/iu.test(sql),
      }).toStrictEqual({ name, dropped: false });
    }
  });

  it("MIG-03 the database holds the eight statuses of BR-24, in lifecycle order", async () => {
    const values = await prisma.$queryRaw<{ value: string }[]>`
      SELECT e.enumlabel AS value
      FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
      WHERE t.typname = 'TicketStatus'
      ORDER BY e.enumsortorder`;

    expect(values.map((row) => row.value)).toStrictEqual([
      "NEW",
      "OPEN",
      "IN_PROGRESS",
      "WAITING_FOR_REQUESTER",
      "RESOLVED",
      "CLOSED",
      "REOPENED",
      "CANCELLED",
    ]);
  });

  it("MIG-03 the old spelling is gone from the type, so no row can still hold it", async () => {
    // A row that held `PENDING` holds `WAITING_FOR_REQUESTER` now, because the
    // rename changed the value rather than the rows. The fixture cannot be
    // written the old way to prove it — the old way no longer type-checks in
    // the database, which is itself the evidence: the cast below fails.
    const waiting = await prisma.ticket.findUniqueOrThrow({
      where: { id: waitingTicketId },
      select: { currentStatus: true },
    });

    expect(waiting.currentStatus).toBe("WAITING_FOR_REQUESTER");

    await expect(
      prisma.$queryRaw`SELECT 'PENDING'::"TicketStatus"`
    ).rejects.toThrow();
  });

  it("MIG-03 the status filter returns it under the new name, and refuses the old one", async () => {
    const staff = await signInAs(ACTIVE_STAFF);
    const filtered = await request(app)
      .get("/api/staff/tickets")
      .query({ search: PREFIX, status: "WAITING_FOR_REQUESTER" })
      .set("Cookie", staff.cookie);

    expect(filtered.status).toBe(200);
    expect(
      (filtered.body.data as { id: number }[]).map((row) => row.id)
    ).toContain(waitingTicketId);

    const retired = await request(app)
      .get("/api/staff/tickets")
      .query({ search: PREFIX, status: "PENDING" })
      .set("Cookie", staff.cookie);

    expect(retired.status).toBe(400);
    expect(retired.body.error.code).toBe("INVALID_QUERY_PARAMETER");
  });
  it("MIG-03 the same migration backfills IT Priority from Requested Priority", async () => {
    // BR-23 asks every existing ticket to receive a copy. Asserted against the
    // migration rather than against a count of null columns, because other
    // suites create tickets directly and may deliberately leave it unset.
    const migrations = await lab3Migrations();
    const backfills = migrations.filter(({ sql }) =>
      /UPDATE\s+"Ticket"\s+SET\s+"itPriority"\s*=\s*"requestedPriority"/iu.test(
        sql
      )
    );

    expect(backfills).toHaveLength(1);
  });
});

describe("MIG-04 an attachment from before survives the move", () => {
  const PDF = Buffer.from("%PDF-1.4\nmigration suite\n%%EOF\n");

  it("MIG-04 still reachable by its owner, and now by staff", async () => {
    // Written straight to the table with no session anywhere, exactly as a
    // Lab 2 row was — not uploaded through the endpoint. (The suite's own
    // fixture cannot serve here: it is removed by design, for MIG-02, and a
    // removed file answers 404 by contract.) Bytes are storage, not the
    // migration, so they are placed on disk beside the row.
    const legacy = await prisma.attachment.create({
      data: {
        ticketId,
        originalFilename: "raised-before-sign-in.pdf",
        storedFilename: `migration-test-${Date.now()}.pdf`,
        mimeType: "application/pdf",
        sizeBytes: PDF.length,
        uploadedById: requester.id,
      },
      select: { id: true, storedFilename: true },
    });

    await writeFile(pathFor(legacy.storedFilename), PDF);

    const staff = await signInAs(ACTIVE_STAFF);

    const [ownerList, staffList, ownerDownload, staffDownload] =
      await Promise.all([
        request(app)
          .get(`/api/tickets/${ticketId}/attachments`)
          .set("Cookie", requester.cookie),
        request(app)
          .get(`/api/tickets/${ticketId}/attachments`)
          .set("Cookie", staff.cookie),
        request(app)
          .get(`/api/attachments/${legacy.id}/download`)
          .set("Cookie", requester.cookie),
        request(app)
          .get(`/api/attachments/${legacy.id}/download`)
          .set("Cookie", staff.cookie),
      ]);

    for (const response of [
      ownerList,
      staffList,
      ownerDownload,
      staffDownload,
    ]) {
      expect(response.status).toBe(200);
    }

    const ids = (staffList.body.data as { id: number }[]).map((row) => row.id);

    expect(ids).toContain(legacy.id);
    expect(
      Buffer.from(staffDownload.body as Uint8Array).toString("utf-8")
    ).toContain("%PDF-1.4");
  });
});

describe("MIG-08 the password hash backfill", () => {
  const EMAIL = "migration.locked@example.ac.th";

  it("MIG-08 the migration replaces null hashes with a value that is not a hash of anything, then forbids null", async () => {
    const migrations = await lab3Migrations();
    const backfill = migrations.filter(({ sql }) =>
      /UPDATE\s+"User"\s+SET\s+"passwordHash"\s*=\s*'!'\s+WHERE\s+"passwordHash"\s+IS NULL/iu.test(
        sql
      )
    );

    expect(backfill).toHaveLength(1);
    expect(backfill[0]?.sql).toMatch(/SET NOT NULL/iu);

    const [{ nulls }] = await prisma.$queryRaw<{ nulls: number }[]>`
      SELECT COUNT(*)::int AS nulls FROM "User" WHERE "passwordHash" IS NULL`;

    expect(nulls).toBe(0);
  });

  it("MIG-08 an account the seed does not know cannot be signed in to — the upgrade fails closed", async () => {
    // A row exactly as the migration leaves it: the placeholder, no flag, no
    // seeded credential. Removed afterwards: the seed must never see it.
    await prisma.user.deleteMany({ where: { email: EMAIL } });
    await prisma.user.create({
      data: {
        name: "Migrated Stranger",
        email: EMAIL,
        role: "REQUESTER",
        isActive: true,
        passwordHash: "!",
      },
    });

    try {
      const response = await request(app).post("/api/auth/login").send({
        email: EMAIL,
        password: "Anything1!",
      });

      // Not must-change, not a 500 with a scrypt complaint: one ordinary 401,
      // byte for byte what an unknown address gets (BR-08).
      expect(response.status).toBe(401);
      expect(response.body).toStrictEqual({
        error: expect.objectContaining({ code: "INVALID_CREDENTIALS" }),
      });
    } finally {
      await prisma.user.deleteMany({ where: { email: EMAIL } });
    }
  });
});
