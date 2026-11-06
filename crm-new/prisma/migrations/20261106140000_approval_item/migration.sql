-- Макет принадлежит позиции заказа.
--
-- В заказе несколько футболок разных размеров, и каждая печатается по
-- своему макету. Привязки не было: лист согласования относился к заказу
-- целиком, и какой размер уже согласован, а какой нет — не знал никто.
-- Заказ уходил в производство с одним макетом на три позиции.
ALTER TABLE "PrintApproval" ADD COLUMN IF NOT EXISTS "itemId" TEXT;

-- SetNull: позицию могли удалить из заказа, а лист — доказательство того,
-- что клиент подтвердил именно это. Вместе со строкой заказа он не уходит.
DO $$
BEGIN
  ALTER TABLE "PrintApproval"
    ADD CONSTRAINT "PrintApproval_itemId_fkey"
    FOREIGN KEY ("itemId") REFERENCES "ItemTshirt"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "PrintApproval_itemId_idx" ON "PrintApproval" ("itemId");

-- Прошлые согласования привязываем к позициям, какие однозначно их.
--
-- Сначала точное совпадение цвета и размера: так макет и создавался —
-- значения подставлялись из позиции. Регистр и «ё» в цвете приводим,
-- потому что «Чёрный» и «черный» в базе встречаются оба.
UPDATE "PrintApproval" p
SET "itemId" = i."id"
FROM "ItemTshirt" i
WHERE p."itemId" IS NULL
  AND i."orderId" = p."orderId"
  AND i."size" = p."shirtSize"
  AND replace(lower(btrim(i."color")), 'ё', 'е')
      = replace(lower(btrim(p."shirtColor")), 'ё', 'е');

-- Затем заказы с единственной позицией: там выбора нет, и цвет мог
-- разойтись с позицией, если его меняли в редакторе ради мокапа.
UPDATE "PrintApproval" p
SET "itemId" = i."id"
FROM "ItemTshirt" i
WHERE p."itemId" IS NULL
  AND i."orderId" = p."orderId"
  AND (SELECT count(*) FROM "ItemTshirt" x WHERE x."orderId" = p."orderId") = 1;
