-- Этап 16: заказы аналитических отчётов. Только новая таблица метаданных;
-- существующие таблицы заказов и аналитики не затрагиваются, данные не переносятся.
CREATE TABLE "AnalyticsReport" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "periodType" TEXT NOT NULL,
    "dateFrom" DATE NOT NULL,
    "dateTo" DATE NOT NULL,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "requestedBy" TEXT NOT NULL,
    "generatedAt" TIMESTAMP(3),
    "productionBuild" TEXT,
    "mdFilename" TEXT,
    "htmlFilename" TEXT,
    "mdSizeBytes" INTEGER,
    "htmlSizeBytes" INTEGER,
    "errorMessage" TEXT,

    CONSTRAINT "AnalyticsReport_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AnalyticsReport_status_idx" ON "AnalyticsReport"("status");
CREATE INDEX "AnalyticsReport_requestedAt_idx" ON "AnalyticsReport"("requestedAt");
