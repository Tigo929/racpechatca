ALTER TYPE "EnumStatus" ADD VALUE IF NOT EXISTS 'PROBLEM';

CREATE TYPE "EnumGulianSyncState" AS ENUM (
  'NOT_SENT', 'PENDING', 'PROCESSING', 'DELIVERED', 'ERROR', 'REJECTED_PAID'
);
CREATE TYPE "EnumGulianOutboxStatus" AS ENUM (
  'PENDING', 'PROCESSING', 'DELIVERED', 'FAILED'
);

ALTER TABLE "OrderPhoto"
  ADD COLUMN "sourceRevision" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "telegramChatId" TEXT,
  ADD COLUMN "telegramMessageId" TEXT,
  ADD COLUMN "gulianSyncState" "EnumGulianSyncState" NOT NULL DEFAULT 'NOT_SENT',
  ADD COLUMN "gulianLastAttemptAt" TIMESTAMP(3),
  ADD COLUMN "gulianLastSyncedAt" TIMESTAMP(3),
  ADD COLUMN "gulianLastError" TEXT,
  ADD COLUMN "gulianSettlementOrderNumber" TEXT,
  ADD COLUMN "gulianSettlementOrderId" INTEGER,
  ADD COLUMN "gulianPositionId" INTEGER,
  ADD COLUMN "gulianAppliedRevision" INTEGER,
  ADD COLUMN "productionProblemReason" TEXT;

CREATE TABLE "GulianOutboxEvent" (
  "id" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "eventId" TEXT NOT NULL,
  "eventType" TEXT NOT NULL DEFAULT 'order.upsert',
  "aggregateId" TEXT NOT NULL,
  "externalOrderId" TEXT NOT NULL,
  "sourceRevision" INTEGER NOT NULL,
  "payloadJson" JSONB NOT NULL,
  "status" "EnumGulianOutboxStatus" NOT NULL DEFAULT 'PENDING',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "nextAttemptAt" TIMESTAMP(3),
  "lastAttemptAt" TIMESTAMP(3),
  "deliveredAt" TIMESTAMP(3),
  "lastError" TEXT,
  "responseCode" INTEGER,
  "responseBody" TEXT,
  CONSTRAINT "GulianOutboxEvent_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "GulianOutboxEvent_aggregateId_fkey"
    FOREIGN KEY ("aggregateId") REFERENCES "OrderPhoto"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "GulianOutboxEvent_eventId_key"
  ON "GulianOutboxEvent"("eventId");
CREATE INDEX "GulianOutboxEvent_status_nextAttemptAt_createdAt_idx"
  ON "GulianOutboxEvent"("status", "nextAttemptAt", "createdAt");
CREATE INDEX "GulianOutboxEvent_aggregateId_createdAt_idx"
  ON "GulianOutboxEvent"("aggregateId", "createdAt");
CREATE INDEX "GulianOutboxEvent_externalOrderId_sourceRevision_idx"
  ON "GulianOutboxEvent"("externalOrderId", "sourceRevision");

CREATE TABLE "IntegrationAuditLog" (
  "id" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "orderId" TEXT,
  "action" TEXT NOT NULL,
  "level" TEXT NOT NULL DEFAULT 'info',
  "actor" TEXT,
  "message" TEXT NOT NULL,
  "details" JSONB,
  CONSTRAINT "IntegrationAuditLog_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "IntegrationAuditLog_orderId_fkey"
    FOREIGN KEY ("orderId") REFERENCES "OrderPhoto"("id")
    ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "IntegrationAuditLog_orderId_createdAt_idx"
  ON "IntegrationAuditLog"("orderId", "createdAt");
CREATE INDEX "IntegrationAuditLog_action_createdAt_idx"
  ON "IntegrationAuditLog"("action", "createdAt");