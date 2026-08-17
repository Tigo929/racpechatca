-- Латинский код цвета в артикуле: JDM-1-1-black-S.
-- Без него два цвета одного принта давали одинаковый offer_id на одном
-- размере и упирались в уникальный индекс.

ALTER TABLE "OzonVariant"
  ADD COLUMN "colorCode" TEXT NOT NULL DEFAULT '';
