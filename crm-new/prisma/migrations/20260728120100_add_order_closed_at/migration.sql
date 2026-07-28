-- «closedAt» — момент ухода заказа в закрытые статусы (Оплачен/Завершён/Отменён).
-- По нему список сортируется: активные (closedAt IS NULL) сверху, закрытые вниз.
ALTER TABLE "OrderPhoto" ADD COLUMN "closedAt" TIMESTAMP(3);

-- Бэкфилл: у уже закрытых заказов проставляем разумный момент закрытия
-- (оплата → завершение → последнее обновление), чтобы они сразу ушли вниз.
UPDATE "OrderPhoto"
SET "closedAt" = COALESCE("clientPaidAt", "completedAt", "sentAt", "updatedAt")
WHERE "status" IN ('PAID', 'COMPLETED', 'CANCELLED');

CREATE INDEX "OrderPhoto_closedAt_idx" ON "OrderPhoto"("closedAt");
