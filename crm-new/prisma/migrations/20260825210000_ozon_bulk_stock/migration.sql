-- Массовое изменение остатков Ozon: операция и её пары «товар × склад».
--
-- Операция хранится записью, а не живёт в памяти запроса. Так решаются три
-- задачи сразу: повторное нажатие кнопки не создаёт вторую отправку, работа
-- продолжается после закрытия вкладки, и через полгода можно ответить,
-- кто и когда поставил этот остаток.

CREATE TYPE "EnumBulkStockMode" AS ENUM ('SET', 'ADD');
CREATE TYPE "EnumBulkStockStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED');
CREATE TYPE "EnumBulkStockItemStatus" AS ENUM ('PENDING', 'SENT', 'ERROR', 'SKIPPED');

CREATE TABLE "OzonStockBulkOperation" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "marketplaceAccountId" TEXT NOT NULL,
    "mode" "EnumBulkStockMode" NOT NULL DEFAULT 'SET',
    "status" "EnumBulkStockStatus" NOT NULL DEFAULT 'PENDING',
    "defaultQuantity" INTEGER,
    "productCount" INTEGER NOT NULL DEFAULT 0,
    "warehouseCount" INTEGER NOT NULL DEFAULT 0,
    "operationCount" INTEGER NOT NULL DEFAULT 0,
    "successCount" INTEGER NOT NULL DEFAULT 0,
    "errorCount" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "lastError" TEXT,

    CONSTRAINT "OzonStockBulkOperation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OzonStockBulkOperationItem" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "operationId" TEXT NOT NULL,
    "offerId" TEXT NOT NULL,
    "ozonProductId" BIGINT,
    "warehouseId" BIGINT NOT NULL,
    "warehouseName" TEXT NOT NULL,
    "requestedQuantity" INTEGER NOT NULL,
    "previousStock" INTEGER,
    "calculatedStock" INTEGER,
    "status" "EnumBulkStockItemStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastSentAt" TIMESTAMP(3),
    "errorCode" TEXT,
    "errorMessage" TEXT,

    CONSTRAINT "OzonStockBulkOperationItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "OzonStockBulkOperation_marketplaceAccountId_createdAt_idx"
    ON "OzonStockBulkOperation"("marketplaceAccountId", "createdAt");
CREATE INDEX "OzonStockBulkOperation_status_idx"
    ON "OzonStockBulkOperation"("status");

-- Пара «товар × склад» внутри операции уникальна: одна и та же пара дважды
-- в одной отправке — это два запроса подряд по правилу «раз в 30 секунд»,
-- то есть гарантированный отказ по второму.
CREATE UNIQUE INDEX "OzonStockBulkOperationItem_operationId_offerId_warehouseId_key"
    ON "OzonStockBulkOperationItem"("operationId", "offerId", "warehouseId");
CREATE INDEX "OzonStockBulkOperationItem_operationId_status_idx"
    ON "OzonStockBulkOperationItem"("operationId", "status");

ALTER TABLE "OzonStockBulkOperation"
    ADD CONSTRAINT "OzonStockBulkOperation_marketplaceAccountId_fkey"
    FOREIGN KEY ("marketplaceAccountId") REFERENCES "MarketplaceAccount"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "OzonStockBulkOperation"
    ADD CONSTRAINT "OzonStockBulkOperation_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "OzonStockBulkOperationItem"
    ADD CONSTRAINT "OzonStockBulkOperationItem_operationId_fkey"
    FOREIGN KEY ("operationId") REFERENCES "OzonStockBulkOperation"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
