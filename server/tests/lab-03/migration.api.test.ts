import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { ACTIVE_REQUESTER } from "../../prisma/accounts.js";
import { app } from "../../src/app.js";
import { prisma } from "../../src/prisma.js";
import type { SignedInUser } from "./support/signIn.js";
import { signInAs } from "./support/signIn.js";

/**
 * The move from the development header to the session kept every relationship
 * intact (BR-39, BR-40).
 *
 * MIG-01 — users keep their identifiers, and a ticket's requester still resolves.
 * MIG-02 — attachment uploader and remover references stay valid.
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
let attachmentId = 0;

const cleanUp = async () => {
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
