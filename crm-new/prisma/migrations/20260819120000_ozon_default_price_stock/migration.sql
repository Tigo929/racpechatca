-- Цена по умолчанию для новой карточки и остаток, который проставляется
-- сразу после публикации. Без остатка Ozon не показывает товар покупателю,
-- поэтому созданная карточка не продавалась, пока остаток не проставят руками.
ALTER TABLE "OzonCatalogTemplate" ADD COLUMN "defaultPrice" INTEGER NOT NULL DEFAULT 3500;
ALTER TABLE "OzonCatalogTemplate" ADD COLUMN "defaultStock" INTEGER NOT NULL DEFAULT 10;
