-- CreateIndex
CREATE INDEX "Ticket_createdAt_id_idx" ON "Ticket"("createdAt" DESC, "id" DESC);

-- CreateIndex
CREATE INDEX "Ticket_ticketOwnerId_idx" ON "Ticket"("ticketOwnerId");
