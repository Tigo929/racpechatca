-- Локальный аналитический слой Метрики (этап 07 плана аналитики):
-- журнал синхронизаций и дневные агрегаты отчётов (трафик, цели, источники,
-- UTM, страницы входа, устройства, просмотры страниц). Только новые таблицы,
-- существующие данные не трогаются. Сгенерировано `prisma migrate diff` по
-- схеме против копии боевой базы; лишние (не относящиеся к этапу) строки
-- дрейфа удалены, остальное вручную не правилось.

-- CreateTable
CREATE TABLE "MetrikaSyncRun" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "batchId" TEXT NOT NULL,
    "dataset" TEXT NOT NULL,
    "dateFrom" DATE NOT NULL,
    "dateTo" DATE NOT NULL,
    "trigger" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "finishedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL,
    "rowsReceived" INTEGER NOT NULL DEFAULT 0,
    "rowsStored" INTEGER NOT NULL DEFAULT 0,
    "requestCount" INTEGER NOT NULL DEFAULT 0,
    "sampled" BOOLEAN,
    "sampleShare" DOUBLE PRECISION,
    "dataLag" INTEGER,
    "accuracy" TEXT,
    "lastError" TEXT,

    CONSTRAINT "MetrikaSyncRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MetrikaDailyTraffic" (
    "date" DATE NOT NULL,
    "visits" INTEGER NOT NULL,
    "users" INTEGER NOT NULL,
    "pageviews" INTEGER NOT NULL,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MetrikaDailyTraffic_pkey" PRIMARY KEY ("date")
);

-- CreateTable
CREATE TABLE "MetrikaDailyGoal" (
    "date" DATE NOT NULL,
    "goalId" INTEGER NOT NULL,
    "goalName" TEXT NOT NULL,
    "goalIdentifier" TEXT,
    "reaches" INTEGER NOT NULL,
    "goalVisits" INTEGER NOT NULL,
    "convertedUsers" INTEGER NOT NULL,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MetrikaDailyGoal_pkey" PRIMARY KEY ("date","goalId")
);

-- CreateTable
CREATE TABLE "MetrikaDailySource" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "trafficSource" TEXT NOT NULL,
    "trafficSourceName" TEXT NOT NULL,
    "sourceEngine" TEXT NOT NULL,
    "sourceEngineName" TEXT NOT NULL,
    "visits" INTEGER NOT NULL,
    "users" INTEGER NOT NULL,
    "pageviews" INTEGER NOT NULL,
    "leadReaches" INTEGER NOT NULL,
    "orderCreatedReaches" INTEGER NOT NULL,
    "orderPaidReaches" INTEGER NOT NULL,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MetrikaDailySource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MetrikaDailyUtm" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "utmSource" TEXT NOT NULL,
    "utmMedium" TEXT NOT NULL,
    "utmCampaign" TEXT NOT NULL,
    "utmContent" TEXT NOT NULL,
    "utmTerm" TEXT NOT NULL,
    "visits" INTEGER NOT NULL,
    "users" INTEGER NOT NULL,
    "leadReaches" INTEGER NOT NULL,
    "orderCreatedReaches" INTEGER NOT NULL,
    "orderPaidReaches" INTEGER NOT NULL,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MetrikaDailyUtm_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MetrikaDailyLanding" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "landingPath" TEXT NOT NULL,
    "normalizedPath" TEXT NOT NULL,
    "visits" INTEGER NOT NULL,
    "users" INTEGER NOT NULL,
    "leadReaches" INTEGER NOT NULL,
    "orderCreatedReaches" INTEGER NOT NULL,
    "orderPaidReaches" INTEGER NOT NULL,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MetrikaDailyLanding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MetrikaDailyDevice" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "deviceRaw" TEXT NOT NULL,
    "deviceName" TEXT NOT NULL,
    "deviceCategory" TEXT NOT NULL,
    "visits" INTEGER NOT NULL,
    "users" INTEGER NOT NULL,
    "leadReaches" INTEGER NOT NULL,
    "orderCreatedReaches" INTEGER NOT NULL,
    "orderPaidReaches" INTEGER NOT NULL,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MetrikaDailyDevice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MetrikaDailyPage" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "pagePath" TEXT NOT NULL,
    "normalizedPath" TEXT NOT NULL,
    "pageviews" INTEGER NOT NULL,
    "users" INTEGER NOT NULL,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MetrikaDailyPage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MetrikaSyncRun_dataset_startedAt_idx" ON "MetrikaSyncRun"("dataset", "startedAt");

-- CreateIndex
CREATE INDEX "MetrikaSyncRun_batchId_idx" ON "MetrikaSyncRun"("batchId");

-- CreateIndex
CREATE UNIQUE INDEX "MetrikaDailySource_date_trafficSource_sourceEngine_key" ON "MetrikaDailySource"("date", "trafficSource", "sourceEngine");

-- CreateIndex
CREATE UNIQUE INDEX "MetrikaDailyUtm_date_utmSource_utmMedium_utmCampaign_utmCon_key" ON "MetrikaDailyUtm"("date", "utmSource", "utmMedium", "utmCampaign", "utmContent", "utmTerm");

-- CreateIndex
CREATE INDEX "MetrikaDailyLanding_normalizedPath_idx" ON "MetrikaDailyLanding"("normalizedPath");

-- CreateIndex
CREATE UNIQUE INDEX "MetrikaDailyLanding_date_landingPath_key" ON "MetrikaDailyLanding"("date", "landingPath");

-- CreateIndex
CREATE UNIQUE INDEX "MetrikaDailyDevice_date_deviceRaw_key" ON "MetrikaDailyDevice"("date", "deviceRaw");

-- CreateIndex
CREATE INDEX "MetrikaDailyPage_normalizedPath_idx" ON "MetrikaDailyPage"("normalizedPath");

-- CreateIndex
CREATE UNIQUE INDEX "MetrikaDailyPage_date_pagePath_key" ON "MetrikaDailyPage"("date", "pagePath");
