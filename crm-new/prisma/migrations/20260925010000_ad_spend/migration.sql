-- Рекламные расходы по дням и кампаниям. Новая таблица; существующие данные
-- не затрагиваются. Импорт идемпотентен по (date, source, campaignId).
CREATE TABLE IF NOT EXISTS "AdSpend" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'YANDEX_DIRECT',
    "campaignId" TEXT NOT NULL DEFAULT '',
    "campaignName" TEXT NOT NULL DEFAULT '',
    "spend" INTEGER NOT NULL,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "AdSpend_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "AdSpend_date_source_campaignId_key"
    ON "AdSpend"("date", "source", "campaignId");
CREATE INDEX IF NOT EXISTS "AdSpend_date_idx" ON "AdSpend"("date");
