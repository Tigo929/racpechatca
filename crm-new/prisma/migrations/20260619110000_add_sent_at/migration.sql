-- Add sentAt: populated when order transitions to SENT status.
-- Used by the monthly financial report to bucket revenue in the correct month.
ALTER TABLE "OrderPhoto" ADD COLUMN "sentAt" TIMESTAMP(3);

-- Backfill: for existing SENT/PAID orders, approximate sentAt with updatedAt
-- (closest proxy we have for when the status was set).
UPDATE "OrderPhoto"
SET "sentAt" = "updatedAt"
WHERE "status" IN ('SENT', 'PAID') AND "sentAt" IS NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS "OrderPhoto_sentAt_idx"
  ON "OrderPhoto"("sentAt");
