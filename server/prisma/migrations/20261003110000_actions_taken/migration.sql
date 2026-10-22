-- CreateEnum
CREATE TYPE "ActionState" AS ENUM ('PLANNED', 'DONE', 'CANCELLED');

-- CreateTable
CREATE TABLE "ActionTaken" (
    "id" SERIAL NOT NULL,
    "ticketId" INTEGER NOT NULL,
    "recordedById" INTEGER NOT NULL,
    "performedById" INTEGER NOT NULL,
    "actionAt" TIMESTAMP(3) NOT NULL,
    "description" TEXT NOT NULL,
    "result" TEXT,
    "state" "ActionState" NOT NULL DEFAULT 'PLANNED',
    "followUpRequired" BOOLEAN NOT NULL DEFAULT false,
    "followUpNote" TEXT,
    "attachmentNotes" TEXT,
    "requestId" TEXT NOT NULL,
    "followsUpId" INTEGER,
    "cancelReason" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ActionTaken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ActionTaken_ticketId_actionAt_id_idx" ON "ActionTaken"("ticketId", "actionAt", "id");

-- CreateIndex
CREATE INDEX "ActionTaken_performedById_state_idx" ON "ActionTaken"("performedById", "state");

-- CreateIndex
CREATE UNIQUE INDEX "ActionTaken_ticketId_requestId_key" ON "ActionTaken"("ticketId", "requestId");

-- AddForeignKey
ALTER TABLE "ActionTaken" ADD CONSTRAINT "ActionTaken_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActionTaken" ADD CONSTRAINT "ActionTaken_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActionTaken" ADD CONSTRAINT "ActionTaken_performedById_fkey" FOREIGN KEY ("performedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActionTaken" ADD CONSTRAINT "ActionTaken_followsUpId_fkey" FOREIGN KEY ("followsUpId") REFERENCES "ActionTaken"("id") ON DELETE SET NULL ON UPDATE CASCADE;

