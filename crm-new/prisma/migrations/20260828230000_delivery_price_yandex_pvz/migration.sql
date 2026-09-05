-- Цена доставки Яндекс ПВЗ для клиента (по умолчанию 300 ₽).
--
-- Ставится и в заявке с сайта, и при ручном выборе Яндекс ПВЗ. Отдельно от
-- deliveryCostYandexPvz (99) — та колонка про оплату перевозчику, а эта про
-- то, что берём с клиента.
ALTER TABLE "PartnerSettings"
  ADD COLUMN "deliveryPriceYandexPvz" INTEGER NOT NULL DEFAULT 300;
