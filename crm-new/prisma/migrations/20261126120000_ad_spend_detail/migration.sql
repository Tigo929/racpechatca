-- Расход Директа по группам, объявлениям и ключам (экран «Реклама»).
-- Новая таблица; существующие данные не затрагиваются.
CREATE TABLE IF NOT EXISTS "AdSpendDetail" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "date" TIMESTAMP(3) NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'YANDEX_DIRECT',
    "campaignId" TEXT NOT NULL,
    "campaignName" TEXT NOT NULL DEFAULT '',
    "adGroupId" TEXT NOT NULL,
    "adGroupName" TEXT NOT NULL DEFAULT '',
    "adId" TEXT NOT NULL,
    "adName" TEXT NOT NULL DEFAULT '',
    "criterion" TEXT NOT NULL,
    "spend" DECIMAL(18,4) NOT NULL,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "vatBasis" TEXT NOT NULL DEFAULT 'EXCLUDED',
    CONSTRAINT "AdSpendDetail_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "AdSpendDetail_date_source_campaignId_adGroupId_adId_criterion_key"
    ON "AdSpendDetail"("date", "source", "campaignId", "adGroupId", "adId", "criterion");
CREATE INDEX IF NOT EXISTS "AdSpendDetail_date_idx" ON "AdSpendDetail"("date");
