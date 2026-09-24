-- Режим прайса производства на холст: RETAIL (розница минус скидка) или
-- WHOLESALE (оптовые цены). Только добавление колонки со значением по
-- умолчанию: прежние заказы и прежний расчёт не меняются.
ALTER TABLE "PartnerSettings" ADD COLUMN IF NOT EXISTS "canvasPriceMode" TEXT NOT NULL DEFAULT 'RETAIL';
