BEGIN;

DROP TABLE IF EXISTS "IntegrationAuditLog";
DROP TABLE IF EXISTS "GulianOutboxEvent";

ALTER TABLE "OrderPhoto"
  DROP COLUMN IF EXISTS "sourceRevision",
  DROP COLUMN IF EXISTS "telegramChatId",
  DROP COLUMN IF EXISTS "telegramMessageId",
  DROP COLUMN IF EXISTS "gulianSyncState",
  DROP COLUMN IF EXISTS "gulianLastAttemptAt",
  DROP COLUMN IF EXISTS "gulianLastSyncedAt",
  DROP COLUMN IF EXISTS "gulianLastError",
  DROP COLUMN IF EXISTS "gulianSettlementOrderNumber",
  DROP COLUMN IF EXISTS "gulianSettlementOrderId",
  DROP COLUMN IF EXISTS "gulianPositionId",
  DROP COLUMN IF EXISTS "gulianAppliedRevision",
  DROP COLUMN IF EXISTS "productionProblemReason";

ALTER TABLE "OrderPhoto" ALTER COLUMN "status" DROP DEFAULT;
CREATE TYPE "EnumStatus_rollback" AS ENUM (
  'LEAD', 'NEW', 'FOLDER_STRUCTURE_CREATED', 'IN_PROGRESS', 'PRINTED',
  'READY', 'DONE', 'SENT', 'PAID', 'READY_FOR_REVIEW', 'COMPLETED', 'CANCELLED'
);
ALTER TABLE "OrderPhoto"
  ALTER COLUMN "status" TYPE "EnumStatus_rollback"
  USING (
    CASE WHEN "status"::text = 'PROBLEM' THEN 'IN_PROGRESS' ELSE "status"::text END
  )::"EnumStatus_rollback";
DROP TYPE "EnumStatus";
ALTER TYPE "EnumStatus_rollback" RENAME TO "EnumStatus";
ALTER TABLE "OrderPhoto" ALTER COLUMN "status" SET DEFAULT 'NEW'::"EnumStatus";

DROP TYPE IF EXISTS "EnumGulianOutboxStatus";
DROP TYPE IF EXISTS "EnumGulianSyncState";

COMMIT;