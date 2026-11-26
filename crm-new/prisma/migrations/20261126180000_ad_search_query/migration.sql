-- Поисковые запросы Директа по дням (экран «Реклама»).
-- Новая таблица; существующие данные не затрагиваются.
CREATE TABLE IF NOT EXISTS "AdSearchQueryDaily" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "date" TIMESTAMP(3) NOT NULL,
    "campaignId" TEXT NOT NULL,
    "adGroupId" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "criterion" TEXT NOT NULL,
    "criterionType" TEXT NOT NULL DEFAULT '',
    "matchType" TEXT NOT NULL DEFAULT '',
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "spend" DECIMAL(18,4) NOT NULL,
    CONSTRAINT "AdSearchQueryDaily_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "AdSearchQueryDaily_date_campaignId_adGroupId_query_criterion_key"
    ON "AdSearchQueryDaily"("date", "campaignId", "adGroupId", "query", "criterion");
CREATE INDEX IF NOT EXISTS "AdSearchQueryDaily_date_idx" ON "AdSearchQueryDaily"("date");
