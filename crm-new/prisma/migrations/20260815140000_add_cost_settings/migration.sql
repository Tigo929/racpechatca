-- Себестоимость фотопечати и реальная цена доставки.
--
-- Бумага задаётся коробкой (800 ₽ за 500 листов = 1,6 ₽ лист): коробку
-- покупают, цену листа считают. Доставка перестаёт быть транзитом —
-- клиенту называют 300 ₽, перевозчику платят 99 ₽ (Озон 140 ₽).
ALTER TABLE "PartnerSettings"
  ADD COLUMN "photoBoxCost" INTEGER NOT NULL DEFAULT 800,
  ADD COLUMN "photoSheetsPerBox" INTEGER NOT NULL DEFAULT 500,
  ADD COLUMN "deliveryCostYandexPvz" INTEGER NOT NULL DEFAULT 99,
  ADD COLUMN "deliveryCostOzonPvz" INTEGER NOT NULL DEFAULT 140;
