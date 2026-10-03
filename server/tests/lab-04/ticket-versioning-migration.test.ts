import { randomBytes } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type { QueryResultRow } from "pg";
import { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * MIG-01 to MIG-04 for the Ticket version and status-history migration
 * (specification.md section 7; AC-35, AC-36).
 *
 * Built on a throwaway database, never the development or test one: the earlier
 * migrations are applied to an empty database, rows are written in the shape
 * Lab 3 left behind, and only then is this migration run. A migration is only
 * shown to preserve data by running it over some.
 *
 * Prisma has no down-migration, so the rollback under test is the hand-written
 * `down.sql` beside the migration.
 */

const MIGRATION = "20261003100000_ticket_version_and_status_history";
// A name unique to this run, so a parallel run (or a database that happens to
// carry the prefix) is never the one dropped: only this exact name is ever
// created or dropped here.
const THROWAWAY = `toktickit_versioning_migration_scratch_${randomBytes(6).toString("hex")}`;
const MIGRATIONS_DIR = fileURLToPath(
  new URL("../../prisma/migrations/", import.meta.url)
);

const connectionUrl = (database: string): string => {
  const url = new URL(process.env["DATABASE_URL"] ?? "");

  url.pathname = `/${database}`;
  url.search = "";

  return url.toString();
};

let admin: Client;
let db: Client;

const sql = async (file: string): Promise<string> =>
  await readFile(path.join(MIGRATIONS_DIR, MIGRATION, file), "utf-8");

const rows = async <T extends QueryResultRow>(text: string): Promise<T[]> => {
  const result = await db.query<T>(text);

  return result.rows;
};

/** Every table's row count and ids, for before and after comparisons. */
const EARLIER_TABLES = [
  "User",
  "Category",
  "RelatedSystem",
  "Ticket",
  "Attachment",
  "PublicComment",
  "InternalNote",
] as const;

const snapshot = async () => {
  const result: Record<string, number[]> = {};

  for (const table of EARLIER_TABLES) {
    // oxlint-disable-next-line no-await-in-loop
    const found = await rows<{ id: number }>(
      `SELECT "id" FROM "${table}" ORDER BY "id"`
    );

    result[table] = found.map((row) => row.id);
  }

  return result;
};

interface HistoryRow {
  ticketId: number;
  fromStatus: string | null;
  toStatus: string;
  changedById: number | null;
  changedAt: Date;
}

const history = async () =>
  await rows<HistoryRow>(
    `SELECT "ticketId", "fromStatus", "toStatus", "changedById", "changedAt"
     FROM "TicketStatusChange" ORDER BY "ticketId", "changedAt", "id"`
  );

const tableNames = async (): Promise<string[]> => {
  const found = await rows<{ table_name: string }>(
    `SELECT table_name FROM information_schema.tables
     WHERE table_schema = 'public' ORDER BY table_name`
  );

  return found.map((row) => row.table_name);
};

const hasVersionColumn = async (): Promise<boolean> => {
  const found = await rows(
    `SELECT 1 FROM information_schema.columns
     WHERE table_name = 'Ticket' AND column_name = 'version'`
  );

  return found.length > 0;
};

const created = new Date("2026-08-01T09:00:00.000Z");
const touched = new Date("2026-09-20T15:30:00.000Z");

const seedLab3Data = async () => {
  await db.query(
    `INSERT INTO "User" ("name", "email", "passwordHash", "role")
     VALUES ('Mig Requester', 'mig.requester@example.test', 'x', 'REQUESTER'),
            ('Mig Staff', 'mig.staff@example.test', 'x', 'IT_STAFF')`
  );
  await db.query(
    `INSERT INTO "Category" ("name", "displayOrder") VALUES ('Mig Category', 1)`
  );
  await db.query(
    `INSERT INTO "RelatedSystem" ("name", "displayOrder") VALUES ('Mig System', 1)`
  );

  // One Ticket per shape that matters: still New, moved on, Resolved (the one
  // the gate must leave alone, MIG-05) and Cancelled.
  for (const [number, status] of [
    ["TKT-2026-000001", "NEW"],
    ["TKT-2026-000002", "IN_PROGRESS"],
    ["TKT-2026-000003", "RESOLVED"],
    ["TKT-2026-000004", "CANCELLED"],
  ] as const) {
    // oxlint-disable-next-line no-await-in-loop
    await db.query(
      `INSERT INTO "Ticket" ("ticketNumber", "requesterId", "categoryId",
         "relatedSystemId", "summary", "description", "requestedPriority",
         "currentStatus", "createdAt", "updatedAt")
       VALUES ($1, (SELECT "id" FROM "User" WHERE "role" = 'REQUESTER'), 1, 1,
         'legacy', 'legacy ticket', 'MEDIUM', $2, $3, $4)`,
      [number, status, created, status === "NEW" ? created : touched]
    );
  }

  await db.query(
    `INSERT INTO "Attachment" ("ticketId", "originalFilename", "storedFilename",
       "mimeType", "sizeBytes", "uploadedById")
     VALUES (1, 'a.pdf', 'stored-a.pdf', 'application/pdf', 10,
       (SELECT "id" FROM "User" WHERE "role" = 'REQUESTER'))`
  );
  await db.query(
    `INSERT INTO "PublicComment" ("ticketId", "authorId", "body")
     VALUES (2, (SELECT "id" FROM "User" WHERE "role" = 'IT_STAFF'), 'public')`
  );
  await db.query(
    `INSERT INTO "InternalNote" ("ticketId", "authorId", "body")
     VALUES (2, (SELECT "id" FROM "User" WHERE "role" = 'IT_STAFF'), 'internal')`
  );
};

let before: Awaited<ReturnType<typeof snapshot>>;
let tablesBefore: string[];
let firstBackfill: HistoryRow[];

beforeAll(async () => {
  admin = new Client({ connectionString: connectionUrl("postgres") });
  await admin.connect();
  await admin.query(`CREATE DATABASE ${THROWAWAY}`);

  db = new Client({ connectionString: connectionUrl(THROWAWAY) });
  await db.connect();

  // The database exactly as Lab 3 left it: every migration that sorts before
  // this one, in order.
  const entries = await readdir(MIGRATIONS_DIR, { withFileTypes: true });
  const folders = entries
    .filter((entry) => entry.isDirectory() && entry.name < MIGRATION)
    .map((entry) => entry.name)
    .toSorted();

  for (const folder of folders) {
    // Order matters: each migration builds on the one before.
    // oxlint-disable-next-line no-await-in-loop
    const script = await readFile(
      path.join(MIGRATIONS_DIR, folder, "migration.sql"),
      "utf-8"
    );

    // oxlint-disable-next-line no-await-in-loop
    await db.query(script);
  }

  // Prisma's bookkeeping table, reduced to what the rollback script touches.
  await db.query(`CREATE TABLE "_prisma_migrations" ("migration_name" TEXT)`);
  await db.query(`INSERT INTO "_prisma_migrations" VALUES ('${MIGRATION}')`);

  await seedLab3Data();

  before = await snapshot();
  tablesBefore = await tableNames();
});

afterAll(async () => {
  await db.end();
  await admin.query(`DROP DATABASE IF EXISTS ${THROWAWAY} WITH (FORCE)`);
  await admin.end();
});

describe("the migration, its rollback and its re-application", () => {
  it("MIG-12 is one transaction: a failure after the backfill leaves nothing behind", async () => {
    const script = await sql("migration.sql");

    // Prisma Migrate does not wrap a SQL migration in a transaction; the file
    // has to (specification.md section 7).
    expect(script).toMatch(/^BEGIN;$/mu);
    expect(script).toMatch(/^COMMIT;$/mu);

    // Inject a failure after the backfill, just before the commit.
    const failing = script.replace(/^COMMIT;$/mu, "SELECT 1 / 0;\nCOMMIT;");

    expect(failing).not.toBe(script);
    await expect(db.query(failing)).rejects.toThrow(/division by zero/u);

    // The session is left in an aborted transaction, as a failed run would
    // leave it; ending it is what the runner's closing connection does.
    await db.query("ROLLBACK");

    expect(await hasVersionColumn()).toBe(false);
    expect(await tableNames()).toStrictEqual(tablesBefore);
    expect(await snapshot()).toStrictEqual(before);
  });

  it("MIG-01 preserves every row with the same ids, gives each Ticket version 1, and invents no Actions", async () => {
    expect(before.Ticket).toHaveLength(4);

    await db.query(await sql("migration.sql"));

    expect(await snapshot()).toStrictEqual(before);

    const versions = await rows<{ version: number }>(
      `SELECT "version" FROM "Ticket"`
    );

    expect(versions).toHaveLength(4);
    expect(versions.every((row) => row.version === 1)).toBe(true);

    // Actions Taken belong to a later migration: none exists here, and this one
    // must not have created or filled anything but its own table.
    expect(await tableNames()).toStrictEqual(
      [...tablesBefore, "TicketStatusChange"].toSorted()
    );
  });

  it("MIG-02 backfills null to New at createdAt, and New to the current status at updatedAt, with no author", async () => {
    firstBackfill = await history();

    const ids = await rows<{ id: number; ticketNumber: string }>(
      `SELECT "id", "ticketNumber" FROM "Ticket" ORDER BY "id"`
    );
    const [newId, movedId, resolvedId, cancelledId] = ids.map((row) => row.id);

    expect(
      firstBackfill.map((row) => [
        row.ticketId,
        row.fromStatus,
        row.toStatus,
        row.changedAt.toISOString(),
      ])
    ).toStrictEqual([
      [newId, null, "NEW", created.toISOString()],
      [movedId, null, "NEW", created.toISOString()],
      [movedId, "NEW", "IN_PROGRESS", touched.toISOString()],
      [resolvedId, null, "NEW", created.toISOString()],
      [resolvedId, "NEW", "RESOLVED", touched.toISOString()],
      [cancelledId, null, "NEW", created.toISOString()],
      [cancelledId, "NEW", "CANCELLED", touched.toISOString()],
    ]);

    // A New Ticket gets no second row, and null means "migrated" throughout.
    expect(firstBackfill.filter((row) => row.ticketId === newId)).toHaveLength(
      1
    );
    expect(firstBackfill.every((row) => row.changedById === null)).toBe(true);
  });

  it("MIG-03 the rollback drops the table and the column and nothing else, leaving every earlier row", async () => {
    await db.query(await sql("down.sql"));

    expect(await tableNames()).toStrictEqual(tablesBefore);
    expect(await hasVersionColumn()).toBe(false);
    expect(await snapshot()).toStrictEqual(before);

    // The bookkeeping row is gone too, so the migration can be applied again.
    expect(
      await rows(
        `SELECT 1 FROM "_prisma_migrations" WHERE "migration_name" = '${MIGRATION}'`
      )
    ).toHaveLength(0);
  });

  it("MIG-04 applies again after the rollback and backfills identically", async () => {
    await db.query(await sql("migration.sql"));

    expect(await snapshot()).toStrictEqual(before);
    expect(await hasVersionColumn()).toBe(true);
    expect(await history()).toStrictEqual(firstBackfill);
  });
});
