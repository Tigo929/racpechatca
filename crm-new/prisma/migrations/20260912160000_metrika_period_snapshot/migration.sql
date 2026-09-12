-- Снимки метрик за целый период (этап 08 плана аналитики): уникальные
-- посетители периода приходят отдельным запросом к Метрике, а не суммой
-- дневных. Только новая таблица, существующие данные не трогаются.
-- Сгенерировано `prisma migrate diff` по схеме против копии боевой базы.

-- CreateTable
CREATE TABLE "MetrikaPeriodSnapshot" (
    "id" TEXT NOT NULL,
    "periodStart" DATE NOT NULL,
    "periodEnd" DATE NOT NULL,
    "metricScope" TEXT NOT NULL DEFAULT 'counter',
    "preset" TEXT,
    "users" INTEGER NOT NULL,
    "visits" INTEGER NOT NULL,
    "pageviews" INTEGER NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL,
    "sampled" BOOLEAN NOT NULL,
    "sampleShare" DOUBLE PRECISION NOT NULL,
    "requestCount" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "MetrikaPeriodSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MetrikaPeriodSnapshot_preset_idx" ON "MetrikaPeriodSnapshot"("preset");

-- CreateIndex
CREATE UNIQUE INDEX "MetrikaPeriodSnapshot_periodStart_periodEnd_metricScope_key" ON "MetrikaPeriodSnapshot"("periodStart", "periodEnd", "metricScope");

