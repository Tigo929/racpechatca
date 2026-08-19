-- Дожимание остатка. Сразу после импорта Ozon отвечает «Product is not
-- created»: товар создан не до конца и остатки не принимает. Одной попытки
-- мало, поэтому у варианта появляется отметка «остаток принят» и счётчик
-- попыток.
ALTER TABLE "OzonVariant" ADD COLUMN "stockAppliedAt" TIMESTAMP(3);
ALTER TABLE "OzonVariant" ADD COLUMN "stockAttempts" INTEGER NOT NULL DEFAULT 0;

-- Цена до скидки — в шаблоне, рядом с ценой: в форме принта их больше нет.
ALTER TABLE "OzonCatalogTemplate" ADD COLUMN "defaultOldPrice" INTEGER NOT NULL DEFAULT 6000;

-- Остаток по умолчанию — 100. Меняем и у уже заведённых кабинетов, но только
-- там, где значение осталось прежним по умолчанию: настроенное руками не трогаем.
ALTER TABLE "OzonCatalogTemplate" ALTER COLUMN "defaultStock" SET DEFAULT 100;
UPDATE "OzonCatalogTemplate" SET "defaultStock" = 100 WHERE "defaultStock" = 10;
