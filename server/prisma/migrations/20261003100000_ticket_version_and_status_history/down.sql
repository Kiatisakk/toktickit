-- Rollback for 20261003100000_ticket_version_and_status_history.
--
-- Prisma has no down-migration, so this is run by hand (psql -f down.sql). It
-- also deletes the migration's row from "_prisma_migrations" so that
-- `prisma migrate deploy` applies it again. The history rows and the version
-- numbers are lost by design; every earlier table and column is untouched.
--
-- The Actions Taken migration has its own down script, and the two roll back
-- independently.

BEGIN;

DROP TABLE "TicketStatusChange";

ALTER TABLE "Ticket" DROP COLUMN "version";

DELETE FROM "_prisma_migrations"
WHERE "migration_name" = '20261003100000_ticket_version_and_status_history';

COMMIT;
