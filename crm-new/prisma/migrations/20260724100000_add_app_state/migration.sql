-- Singleton-состояние планировщиков (флаги рассылок), чтобы ежедневный
-- план дня не повторялся при рестарте контейнера.
CREATE TABLE "AppState" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "dailyPlanLastSentOn" TEXT,
    CONSTRAINT "AppState_pkey" PRIMARY KEY ("id")
);

INSERT INTO "AppState" ("id", "updatedAt") VALUES ('default', now());
