-- Перевод существующих заказов на футболки на новый набор статусов:
-- новый(NEW) → отправлен(SENT) → в работе(IN_PROGRESS) → готов(READY) → оплачен(PAID).
-- Старые производственные статусы отображаем в ближайший из нового набора.
-- LEAD (обращения), SENT, PAID, CANCELLED уже валидны — их не трогаем.

UPDATE "OrderPhoto" SET "status" = 'NEW'
  WHERE "productCategory" = 'TSHIRT' AND "status" = 'FOLDER_STRUCTURE_CREATED';

UPDATE "OrderPhoto" SET "status" = 'IN_PROGRESS'
  WHERE "productCategory" = 'TSHIRT' AND "status" = 'PRINTED';

UPDATE "OrderPhoto" SET "status" = 'READY'
  WHERE "productCategory" = 'TSHIRT' AND "status" IN ('DONE', 'READY_FOR_REVIEW');

UPDATE "OrderPhoto" SET "status" = 'PAID'
  WHERE "productCategory" = 'TSHIRT' AND "status" = 'COMPLETED';
