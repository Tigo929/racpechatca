-- Задачи можно назначать не только сотруднику, но и локальному агенту на
-- ноутбуке владельца: Codex / Cloud Code. Старые задачи остаются USER.
CREATE TYPE "EnumTaskAssigneeKind" AS ENUM ('USER', 'CODEX', 'CLOUD_CODE');

ALTER TABLE "Task"
  ADD COLUMN "assigneeKind" "EnumTaskAssigneeKind" NOT NULL DEFAULT 'USER',
  ADD COLUMN "agentSummary" TEXT,
  ADD COLUMN "agentLastHeartbeatAt" TIMESTAMP(3),
  ALTER COLUMN "assigneeId" DROP NOT NULL;

CREATE INDEX "Task_assigneeKind_status_idx" ON "Task"("assigneeKind", "status");
