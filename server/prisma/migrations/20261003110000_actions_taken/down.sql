-- Rollback for 20261003110000_actions_taken.
--
-- Prisma has no down-migration, so this is run by hand (psql -f down.sql). It
-- drops the "ActionTaken" table and the "ActionState" enum, and deletes the
-- migration's row from "_prisma_migrations" so that `prisma migrate deploy`
-- applies it again. Every Action Taken is lost by design; every earlier table
-- and column, and the Ticket version and status history, are untouched.
--
-- The Ticket version migration has its own down script, and the two roll back
-- independently: run this one first if both are to go.

BEGIN;

DROP TABLE "ActionTaken";

DROP TYPE "ActionState";

DELETE FROM "_prisma_migrations"
WHERE "migration_name" = '20261003110000_actions_taken';

COMMIT;
