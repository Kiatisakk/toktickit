-- Adds Category.displayOrder in three steps, because the table already holds
-- rows and a NOT NULL UNIQUE column cannot be added to populated data in one go.

-- 1. Add it nullable so existing rows survive the ALTER.
ALTER TABLE "Category" ADD COLUMN "displayOrder" INTEGER;

-- 2. Backfill from the current ids. On any database seeded so far those ids are
--    1..4 in the order the brief lists the categories, so this preserves the
--    presentation order that was previously implied by the id.
UPDATE "Category" SET "displayOrder" = "id";

-- 3. Now the column can carry its real constraints.
ALTER TABLE "Category" ALTER COLUMN "displayOrder" SET NOT NULL;
CREATE UNIQUE INDEX "Category_displayOrder_key" ON "Category"("displayOrder");
