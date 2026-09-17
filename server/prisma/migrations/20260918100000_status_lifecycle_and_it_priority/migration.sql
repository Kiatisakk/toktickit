-- The rename keeps the value's position in the enum, so every existing row
-- carries the new spelling without being rewritten, and the queue's status
-- ordering stays the lifecycle's order (D-11, MIG-03).
ALTER TYPE "TicketStatus" RENAME VALUE 'PENDING' TO 'WAITING_FOR_REQUESTER';

-- Appended, which is where the lifecycle wants them: a ticket comes back after
-- CLOSED, and CANCELLED is the end of the line (BR-24, BR-26).
ALTER TYPE "TicketStatus" ADD VALUE 'REOPENED';
ALTER TYPE "TicketStatus" ADD VALUE 'CANCELLED';

-- BR-23: IT Priority starts as a copy of Requested Priority. Lab 2 never set
-- one, so every existing ticket receives the copy here rather than being left
-- as the only tickets in the system without an IT view of urgency.
UPDATE "Ticket" SET "itPriority" = "requestedPriority" WHERE "itPriority" IS NULL;
