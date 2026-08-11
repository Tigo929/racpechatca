-- Оплачиваемые задачи: сколько стоит выполнение и какое начисление создано.
-- rewardAccrualId защищает от повторного начисления при повторном закрытии
-- задачи и позволяет снять начисление, если задачу переоткрыли.
ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "rewardAmount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "rewardAccrualId" TEXT;
