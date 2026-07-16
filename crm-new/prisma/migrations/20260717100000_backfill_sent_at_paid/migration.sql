-- Заказы, переведённые сразу в PAID мимо SENT (типично для самовывоза),
-- оставались без sentAt и навсегда выпадали из напоминаний об отзыве.
-- Сервис теперь ставит sentAt и при переводе в PAID; здесь чиним историю.
UPDATE "OrderPhoto"
SET "sentAt" = "updatedAt"
WHERE "status" IN ('SENT', 'PAID') AND "sentAt" IS NULL;
