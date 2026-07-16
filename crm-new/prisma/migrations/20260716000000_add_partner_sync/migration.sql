CREATE TYPE "EnumPartnerSyncStatus" AS ENUM ('PENDING', 'SENT', 'FAILED');

ALTER TABLE "OrderPhoto"
ADD COLUMN IF NOT EXISTS "externalRequestId" TEXT,
ADD COLUMN IF NOT EXISTS "partnerSyncStatus" "EnumPartnerSyncStatus",
ADD COLUMN IF NOT EXISTS "partnerSyncError" TEXT,
ADD COLUMN IF NOT EXISTS "partnerSyncAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "partnerOrderNo" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "OrderPhoto_externalRequestId_key"
ON "OrderPhoto"("externalRequestId");
