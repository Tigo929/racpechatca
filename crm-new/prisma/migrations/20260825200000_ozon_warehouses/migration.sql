-- Склады кабинета Ozon: снимок /v2/warehouse/list.
--
-- Раньше список запрашивался у площадки при каждом открытии окна выбора
-- склада, причём вместе с лишним запросом списка товаров. Для массового
-- изменения остатков этого мало: нужен признак «на этот склад писать
-- можно», отметка времени для строки «обновлено N минут назад» и
-- постоянная ссылка для истории операций.
CREATE TABLE "OzonWarehouse" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "marketplaceAccountId" TEXT NOT NULL,
    "warehouseId" BIGINT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT,
    "isEditable" BOOLEAN NOT NULL DEFAULT true,
    "disabledReason" TEXT,
    "archivedAt" TIMESTAMP(3),
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OzonWarehouse_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OzonWarehouse_marketplaceAccountId_warehouseId_key"
    ON "OzonWarehouse"("marketplaceAccountId", "warehouseId");

CREATE INDEX "OzonWarehouse_marketplaceAccountId_archivedAt_idx"
    ON "OzonWarehouse"("marketplaceAccountId", "archivedAt");

ALTER TABLE "OzonWarehouse"
    ADD CONSTRAINT "OzonWarehouse_marketplaceAccountId_fkey"
    FOREIGN KEY ("marketplaceAccountId") REFERENCES "MarketplaceAccount"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
