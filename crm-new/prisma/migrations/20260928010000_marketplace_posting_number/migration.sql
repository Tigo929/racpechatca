-- Номер отправления площадки у заказа, заведённого из кабинета Ozon.
-- Отдельно от marketplaceOrderNumber: номер заказа видит покупатель,
-- а номером отправления подписан стикер на посылке — по его последним
-- цифрам печатник кладёт футболку к нужной коробке.
--
-- Колонка необязательная и уникальная среди заполненных: одно отправление
-- заводится в CRM один раз, повторное нажатие открывает тот же заказ.
ALTER TABLE "OrderPhoto"
    ADD COLUMN IF NOT EXISTS "marketplacePostingNumber" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "OrderPhoto_marketplacePostingNumber_key"
    ON "OrderPhoto"("marketplacePostingNumber");
