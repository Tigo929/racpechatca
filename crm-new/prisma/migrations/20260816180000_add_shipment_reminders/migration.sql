-- Счётчик напоминаний об отгрузке.
-- У Яндекс.Маркета 48 часов на отгрузку: не успели — поставка отменяется.
-- Напоминаем три раза (6, 24 и 40 часов), счётчик не даёт повторяться.
ALTER TABLE "OrderPhoto"
  ADD COLUMN "shipmentRemindersSent" INTEGER NOT NULL DEFAULT 0;
