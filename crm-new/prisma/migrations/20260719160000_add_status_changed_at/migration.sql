-- Отметка последней смены статуса — основа для поиска «зависших» заказов.
ALTER TABLE "OrderPhoto"
ADD COLUMN IF NOT EXISTS "statusChangedAt" TIMESTAMP(3);

-- Бэкфилл: берём время последней записи в истории статусов, а если истории
-- нет (старые заказы) — момент создания заказа.
UPDATE "OrderPhoto" o
SET "statusChangedAt" = COALESCE(
  (SELECT MAX(h."createdAt") FROM "StatusHistory" h WHERE h."orderId" = o.id),
  o."createdAt"
)
WHERE o."statusChangedAt" IS NULL;
