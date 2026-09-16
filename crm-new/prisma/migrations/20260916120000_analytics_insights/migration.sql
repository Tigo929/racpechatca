-- CreateTable
CREATE TABLE "AnalyticsInsight" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "baseFingerprint" TEXT NOT NULL,
    "episode" INTEGER NOT NULL DEFAULT 1,
    "category" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "scope" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "detectorId" TEXT NOT NULL,
    "metricKey" TEXT,
    "entityKey" TEXT,
    "periodStart" DATE NOT NULL,
    "periodEnd" DATE NOT NULL,
    "baselineStart" DATE,
    "baselineEnd" DATE,
    "title" TEXT NOT NULL,
    "fact" JSONB NOT NULL,
    "hypothesis" JSONB NOT NULL,
    "recommendation" JSONB NOT NULL,
    "evidence" JSONB NOT NULL,
    "limitations" JSONB NOT NULL,
    "quality" JSONB NOT NULL,
    "causality" TEXT NOT NULL DEFAULT 'NOT_ESTABLISHED',
    "link" JSONB,
    "firstDetectedAt" TIMESTAMP(3) NOT NULL,
    "lastDetectedAt" TIMESTAMP(3) NOT NULL,
    "resolvedAt" TIMESTAMP(3),
    "resolvedReason" TEXT,
    "acknowledgedAt" TIMESTAMP(3),
    "latestVersion" INTEGER NOT NULL DEFAULT 1,
    "payloadHash" TEXT NOT NULL,

    CONSTRAINT "AnalyticsInsight_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnalyticsInsightVersion" (
    "id" TEXT NOT NULL,
    "insightId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL,
    "syncRunId" TEXT,
    "runId" TEXT,
    "payload" JSONB NOT NULL,
    "payloadHash" TEXT NOT NULL,

    CONSTRAINT "AnalyticsInsightVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnalyticsInsightRun" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "finishedAt" TIMESTAMP(3),
    "observationCutoff" DATE,
    "syncRunId" TEXT,
    "detectors" INTEGER NOT NULL DEFAULT 0,
    "detected" INTEGER NOT NULL DEFAULT 0,
    "created" INTEGER NOT NULL DEFAULT 0,
    "versioned" INTEGER NOT NULL DEFAULT 0,
    "unchanged" INTEGER NOT NULL DEFAULT 0,
    "resolved" INTEGER NOT NULL DEFAULT 0,
    "reopened" INTEGER NOT NULL DEFAULT 0,
    "suppressed" JSONB NOT NULL,
    "errors" JSONB NOT NULL,
    "durationMs" INTEGER,
    "queryCount" INTEGER,
    "seenEvaluations" JSONB NOT NULL,

    CONSTRAINT "AnalyticsInsightRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AnalyticsInsight_fingerprint_key" ON "AnalyticsInsight"("fingerprint");

-- CreateIndex
CREATE INDEX "AnalyticsInsight_status_severity_lastDetectedAt_idx" ON "AnalyticsInsight"("status", "severity", "lastDetectedAt");

-- CreateIndex
CREATE INDEX "AnalyticsInsight_baseFingerprint_idx" ON "AnalyticsInsight"("baseFingerprint");

-- CreateIndex
CREATE UNIQUE INDEX "AnalyticsInsightVersion_insightId_version_key" ON "AnalyticsInsightVersion"("insightId", "version");

-- CreateIndex
CREATE INDEX "AnalyticsInsightRun_startedAt_idx" ON "AnalyticsInsightRun"("startedAt");

-- AddForeignKey
ALTER TABLE "AnalyticsInsightVersion" ADD CONSTRAINT "AnalyticsInsightVersion_insightId_fkey" FOREIGN KEY ("insightId") REFERENCES "AnalyticsInsight"("id") ON DELETE CASCADE ON UPDATE CASCADE;

