-- CreateTable
CREATE TABLE "MetrikaDailyBehaviorDevice" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "deviceRaw" TEXT NOT NULL,
    "deviceCategory" TEXT NOT NULL,
    "goalId" INTEGER NOT NULL,
    "goalIdentifier" TEXT NOT NULL,
    "reaches" INTEGER NOT NULL,
    "goalVisits" INTEGER NOT NULL,
    "convertedUsers" INTEGER NOT NULL,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MetrikaDailyBehaviorDevice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MetrikaDailyBehaviorLanding" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "landingPath" TEXT NOT NULL,
    "normalizedPath" TEXT NOT NULL,
    "goalId" INTEGER NOT NULL,
    "goalIdentifier" TEXT NOT NULL,
    "reaches" INTEGER NOT NULL,
    "goalVisits" INTEGER NOT NULL,
    "convertedUsers" INTEGER NOT NULL,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MetrikaDailyBehaviorLanding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MetrikaDailyVisitParam" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "deviceRaw" TEXT NOT NULL,
    "deviceCategory" TEXT NOT NULL,
    "paramKey" TEXT NOT NULL,
    "paramValue" TEXT NOT NULL,
    "visits" INTEGER NOT NULL,
    "users" INTEGER NOT NULL,
    "paramsNumber" INTEGER NOT NULL,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MetrikaDailyVisitParam_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MetrikaDailyPathPage" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "kind" TEXT NOT NULL,
    "pagePath" TEXT NOT NULL,
    "normalizedPath" TEXT NOT NULL,
    "visits" INTEGER,
    "pageviews" INTEGER,
    "users" INTEGER NOT NULL,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MetrikaDailyPathPage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MetrikaDailyDeviceEngagement" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "deviceRaw" TEXT NOT NULL,
    "deviceCategory" TEXT NOT NULL,
    "visits" INTEGER NOT NULL,
    "bounces" INTEGER NOT NULL,
    "pageviews" INTEGER NOT NULL,
    "durationSeconds" INTEGER NOT NULL,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MetrikaDailyDeviceEngagement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MetrikaPeriodGoalSnapshot" (
    "id" TEXT NOT NULL,
    "periodStart" DATE NOT NULL,
    "periodEnd" DATE NOT NULL,
    "goalId" INTEGER NOT NULL,
    "goalIdentifier" TEXT NOT NULL,
    "preset" TEXT,
    "users" INTEGER NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL,
    "sampled" BOOLEAN NOT NULL,
    "sampleShare" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "MetrikaPeriodGoalSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MetrikaDailyBehaviorDevice_date_idx" ON "MetrikaDailyBehaviorDevice"("date");

-- CreateIndex
CREATE UNIQUE INDEX "MetrikaDailyBehaviorDevice_date_deviceRaw_goalId_key" ON "MetrikaDailyBehaviorDevice"("date", "deviceRaw", "goalId");

-- CreateIndex
CREATE INDEX "MetrikaDailyBehaviorLanding_date_idx" ON "MetrikaDailyBehaviorLanding"("date");

-- CreateIndex
CREATE INDEX "MetrikaDailyBehaviorLanding_normalizedPath_idx" ON "MetrikaDailyBehaviorLanding"("normalizedPath");

-- CreateIndex
CREATE UNIQUE INDEX "MetrikaDailyBehaviorLanding_date_landingPath_goalId_key" ON "MetrikaDailyBehaviorLanding"("date", "landingPath", "goalId");

-- CreateIndex
CREATE INDEX "MetrikaDailyVisitParam_date_idx" ON "MetrikaDailyVisitParam"("date");

-- CreateIndex
CREATE INDEX "MetrikaDailyVisitParam_paramKey_idx" ON "MetrikaDailyVisitParam"("paramKey");

-- CreateIndex
CREATE UNIQUE INDEX "MetrikaDailyVisitParam_date_deviceRaw_paramKey_paramValue_key" ON "MetrikaDailyVisitParam"("date", "deviceRaw", "paramKey", "paramValue");

-- CreateIndex
CREATE INDEX "MetrikaDailyPathPage_date_idx" ON "MetrikaDailyPathPage"("date");

-- CreateIndex
CREATE UNIQUE INDEX "MetrikaDailyPathPage_date_kind_pagePath_key" ON "MetrikaDailyPathPage"("date", "kind", "pagePath");

-- CreateIndex
CREATE INDEX "MetrikaDailyDeviceEngagement_date_idx" ON "MetrikaDailyDeviceEngagement"("date");

-- CreateIndex
CREATE UNIQUE INDEX "MetrikaDailyDeviceEngagement_date_deviceRaw_key" ON "MetrikaDailyDeviceEngagement"("date", "deviceRaw");

-- CreateIndex
CREATE INDEX "MetrikaPeriodGoalSnapshot_preset_idx" ON "MetrikaPeriodGoalSnapshot"("preset");

-- CreateIndex
CREATE UNIQUE INDEX "MetrikaPeriodGoalSnapshot_periodStart_periodEnd_goalId_key" ON "MetrikaPeriodGoalSnapshot"("periodStart", "periodEnd", "goalId");

