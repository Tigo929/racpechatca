-- Номер заказа на площадке у заказов с маркетплейса (Ozon и т.п.).
-- Колонка необязательная: у заказов, заведённых руками, и у всех прежних
-- заказов номера площадки нет, и появиться он не должен. Внутренний
-- numberOrder не трогается — по нему считаются зарплата, задачи и отчёты.
ALTER TABLE "OrderPhoto"
    ADD COLUMN IF NOT EXISTS "marketplaceOrderNumber" TEXT;

-- Под поиск заказа по номеру площадки: владелец ищет именно его, когда
-- открывает заказ из кабинета Ozon.
CREATE INDEX IF NOT EXISTS "OrderPhoto_marketplaceOrderNumber_idx"
    ON "OrderPhoto"("marketplaceOrderNumber");
