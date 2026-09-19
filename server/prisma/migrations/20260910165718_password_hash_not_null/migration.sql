-- passwordHash becomes NOT NULL.
--
-- A NOT NULL constraint cannot be applied to rows that are null, and SQL cannot
-- derive a scrypt hash because the hashing lives in Node. So every account that
-- predates authentication is first given the value '!' — which is not a hash of
-- anything. `verifyPassword` refuses any stored value that is not a well-formed
-- scrypt encoding, so these accounts cannot be signed in to at all: the upgrade
-- fails closed rather than leaving an account with no password.
--
-- Running `db:seed` afterwards restores real credentials for every seeded
-- account (D-16). An account the seed does not know stays locked until an
-- Administrator issues it a password.
--
-- Doing this inside the migration, rather than as a separate bootstrap script
-- run between two migrations, is what lets `prisma migrate deploy` upgrade a
-- populated Lab 2 database in one step. A step a person has to remember to run
-- is a step that gets skipped, and skipping this one fails with
-- `column "passwordHash" contains null values`.
UPDATE "User" SET "passwordHash" = '!' WHERE "passwordHash" IS NULL;

ALTER TABLE "User" ALTER COLUMN "passwordHash" SET NOT NULL;
