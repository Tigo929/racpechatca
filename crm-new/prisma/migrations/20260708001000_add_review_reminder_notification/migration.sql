ALTER TABLE "OrderPhoto"
ADD COLUMN IF NOT EXISTS "reviewReminderNotifiedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "OrderPhoto_productCategory_status_reviewReminderNotifiedAt_idx"
ON "OrderPhoto"("productCategory", "status", "reviewReminderNotifiedAt");

