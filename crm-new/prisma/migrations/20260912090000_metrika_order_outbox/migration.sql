-- Очередь отправки заказов в Яндекс Метрику (этап 06 плана аналитики).
-- Новая таблица, существующие данные не трогаются. Строки создаются в одной
-- транзакции со сменой статуса заказа; воркер отправляет их в simple_orders.
-- Сгенерировано `prisma migrate diff` по схеме, вручную не правилось.

-- CreateTable
CREATE TABLE "MetrikaOrderOutbox" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "orderId" TEXT NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "sourceStatusHistoryId" TEXT,
    "targetMetrikaStatus" TEXT NOT NULL,
    "sentMetrikaStatus" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "skipReason" TEXT,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lockedAt" TIMESTAMP(3),
    "processedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "responseCode" INTEGER,
    "remoteUploadingId" TEXT,
    "apiValidationStatus" TEXT,
    "elementsCount" INTEGER,

    CONSTRAINT "MetrikaOrderOutbox_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MetrikaOrderOutbox_dedupeKey_key" ON "MetrikaOrderOutbox"("dedupeKey");

-- CreateIndex
CREATE INDEX "MetrikaOrderOutbox_status_nextAttemptAt_idx" ON "MetrikaOrderOutbox"("status", "nextAttemptAt");

-- CreateIndex
CREATE INDEX "MetrikaOrderOutbox_orderId_idx" ON "MetrikaOrderOutbox"("orderId");

-- AddForeignKey
ALTER TABLE "MetrikaOrderOutbox" ADD CONSTRAINT "MetrikaOrderOutbox_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "OrderPhoto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

