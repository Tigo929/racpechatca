-- Допы к позиции холста: лак и багет.
--
-- У каждого допа своя цена подрядчика и своя цена клиенту: берём у
-- поставщика по одной, называем клиенту другую, и разница — заработок.
-- Флаг отдельно от цены, потому что доп бывает и бесплатным.
--
-- Старые позиции получают false и нули: допов у них не было, и суммы
-- заказов от этой миграции не меняются.
ALTER TABLE "ItemCanvas"
  ADD COLUMN "varnish" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "varnishClientPrice" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "varnishContractorPrice" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "frame" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "frameClientPrice" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "frameContractorPrice" INTEGER NOT NULL DEFAULT 0;
