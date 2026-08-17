-- Общие дополнительные фото карточки: одинаковые во всех товарах кабинета.
-- Загружаются один раз в шаблон; на принте меняется только главное фото.

ALTER TABLE "OzonCatalogTemplate"
  ADD COLUMN "sharedPhotoUrls" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
