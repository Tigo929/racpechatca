-- CreateTable
CREATE TABLE "AnalyticsChange" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL,
    "changeType" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3),
    "deploymentRef" TEXT,
    "surface" TEXT NOT NULL,
    "audienceDefinition" JSONB,
    "primaryMetric" TEXT NOT NULL,
    "secondaryMetrics" JSONB NOT NULL,
    "expectedDirection" TEXT NOT NULL,
    "hypothesis" TEXT,
    "maturityDays" INTEGER,
    "evaluationDays" INTEGER,
    "primaryLockedAt" TIMESTAMP(3),

    CONSTRAINT "AnalyticsChange_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnalyticsChangeEvaluation" (
    "id" TEXT NOT NULL,
    "changeId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "evaluatedAt" TIMESTAMP(3) NOT NULL,
    "trigger" TEXT NOT NULL,
    "observationCutoff" DATE NOT NULL,
    "beforeFrom" DATE NOT NULL,
    "beforeTo" DATE NOT NULL,
    "afterFrom" DATE NOT NULL,
    "afterTo" DATE NOT NULL,
    "metricVersion" TEXT NOT NULL,
    "primaryMetric" TEXT NOT NULL,
    "verdict" TEXT NOT NULL,
    "maturity" TEXT NOT NULL,
    "result" JSONB NOT NULL,
    "flags" JSONB NOT NULL,
    "lastSyncRunId" TEXT,

    CONSTRAINT "AnalyticsChangeEvaluation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AnalyticsChange_status_startedAt_idx" ON "AnalyticsChange"("status", "startedAt");

-- CreateIndex
CREATE INDEX "AnalyticsChangeEvaluation_changeId_evaluatedAt_idx" ON "AnalyticsChangeEvaluation"("changeId", "evaluatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "AnalyticsChangeEvaluation_changeId_version_key" ON "AnalyticsChangeEvaluation"("changeId", "version");

-- AddForeignKey
ALTER TABLE "AnalyticsChangeEvaluation" ADD CONSTRAINT "AnalyticsChangeEvaluation_changeId_fkey" FOREIGN KEY ("changeId") REFERENCES "AnalyticsChange"("id") ON DELETE CASCADE ON UPDATE CASCADE;

