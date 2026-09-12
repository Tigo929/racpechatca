-- Восстановлено из истории Git: коммит f106dca (ветка
-- wip/gulian-integration-prod-2026-07-29T18-20-41, «автосохранение работы с
-- прода»). Применено на бою 28.07.2026 17:19 из рабочей копии, в master не
-- попало; контрольная сумма оригинала e81cc9db… совпадает с _prisma_migrations.
--
-- Единственное отличие от оригинала: у всех ADD COLUMN добавлено IF NOT EXISTS.
-- На бою эта миграция шла ПЕРВОЙ, а 20260728150000_add_gulian_fields (добавляет
-- те же колонки sourceRevision и gulian*, уже с IF NOT EXISTS) — после неё; на
-- пустой базе порядок по имени обратный, и без IF NOT EXISTS сборка с нуля
-- падала здесь на «column already exists». Побочный эффект порядка: на бою
-- gulian*-даты созданы этой миграцией как TIMESTAMP(3), на пустой базе их
-- создаст 150000 как TIMESTAMPTZ(3) — см. отчёт FIX_01, раздел 6.
-- Из-за правки контрольная сумма файла не совпадает с записью на бою; для
-- `migrate deploy` и `migrate status` это проверено безвредно (11.09.2026).
--
-- Объекты GulianOutboxEvent, IntegrationAuditLog, EnumGulianSyncState,
-- EnumGulianOutboxStatus и колонки gulianSyncState/telegramChatId/
-- telegramMessageId/productionProblemReason кодом не используются и в
-- schema.prisma не описаны — это известный «хвост» на бою; убирать его
-- отдельным решением, не здесь.
ALTER TYPE "EnumStatus" ADD VALUE IF NOT EXISTS 'PROBLEM';

CREATE TYPE "EnumGulianSyncState" AS ENUM (
  'NOT_SENT', 'PENDING', 'PROCESSING', 'DELIVERED', 'ERROR', 'REJECTED_PAID'
);
CREATE TYPE "EnumGulianOutboxStatus" AS ENUM (
  'PENDING', 'PROCESSING', 'DELIVERED', 'FAILED'
);

ALTER TABLE "OrderPhoto"
  ADD COLUMN IF NOT EXISTS "sourceRevision" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS "telegramChatId" TEXT,
  ADD COLUMN IF NOT EXISTS "telegramMessageId" TEXT,
  ADD COLUMN IF NOT EXISTS "gulianSyncState" "EnumGulianSyncState" NOT NULL DEFAULT 'NOT_SENT',
  ADD COLUMN IF NOT EXISTS "gulianLastAttemptAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "gulianLastSyncedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "gulianLastError" TEXT,
  ADD COLUMN IF NOT EXISTS "gulianSettlementOrderNumber" TEXT,
  ADD COLUMN IF NOT EXISTS "gulianSettlementOrderId" INTEGER,
  ADD COLUMN IF NOT EXISTS "gulianPositionId" INTEGER,
  ADD COLUMN IF NOT EXISTS "gulianAppliedRevision" INTEGER,
  ADD COLUMN IF NOT EXISTS "productionProblemReason" TEXT;

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