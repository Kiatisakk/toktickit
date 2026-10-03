-- Ticket versioning and status history (Lab 4, D-07, D-08, D-20, D-21, D-23).
--
-- Additive only: one column with a default, one table, its indexes. Every
-- existing row is preserved. The history backfill is plain SQL in the same
-- migration so it cannot be skipped by someone who forgot a script
-- (specification.md section 7). The matching rollback is down.sql beside this
-- file.

-- AlterTable
ALTER TABLE "Ticket" ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "TicketStatusChange" (
    "id" SERIAL NOT NULL,
    "ticketId" INTEGER NOT NULL,
    "fromStatus" "TicketStatus",
    "toStatus" "TicketStatus" NOT NULL,
    "changedById" INTEGER,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TicketStatusChange_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TicketStatusChange_ticketId_changedAt_idx" ON "TicketStatusChange"("ticketId", "changedAt");

-- CreateIndex
CREATE INDEX "TicketStatusChange_changedAt_idx" ON "TicketStatusChange"("changedAt");

-- AddForeignKey
ALTER TABLE "TicketStatusChange" ADD CONSTRAINT "TicketStatusChange_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketStatusChange" ADD CONSTRAINT "TicketStatusChange_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill (D-23). An approximation, documented as one: a legacy Ticket's real
-- journey is unknown, and "updatedAt" is when it was last touched, not
-- necessarily when it reached its status. "changedById" is null on every row
-- here, which means "migrated".

-- Every existing Ticket was created: null -> NEW at its creation time.
INSERT INTO "TicketStatusChange" ("ticketId", "fromStatus", "toStatus", "changedById", "changedAt")
SELECT "id", NULL, 'NEW', NULL, "createdAt"
FROM "Ticket";

-- Every Ticket no longer New also moved: NEW -> its current status at "updatedAt".
INSERT INTO "TicketStatusChange" ("ticketId", "fromStatus", "toStatus", "changedById", "changedAt")
SELECT "id", 'NEW', "currentStatus", NULL, "updatedAt"
FROM "Ticket"
WHERE "currentStatus" <> 'NEW';
