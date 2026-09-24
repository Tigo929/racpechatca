-- Скидка клиенту в рублях по заказу. Только добавление колонки со значением
-- по умолчанию: прежние заказы остаются без скидки и не пересчитываются.
ALTER TABLE "OrderPhoto" ADD COLUMN IF NOT EXISTS "discountAmount" INTEGER NOT NULL DEFAULT 0;
