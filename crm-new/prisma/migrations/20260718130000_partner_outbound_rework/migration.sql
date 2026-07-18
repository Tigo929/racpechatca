-- Разворот интеграции с партнёром: мы отдаём данные, партнёр забирает/принимает.
-- Убираем CoolABC-специфичные поля, добавляем путь к ТЗ-фото.

ALTER TABLE "OrderPhoto"
ADD COLUMN IF NOT EXISTS "techSpecPhotoPath" TEXT;

ALTER TABLE "OrderPhoto"
DROP COLUMN IF EXISTS "clientName",
DROP COLUMN IF EXISTS "clientPhone",
DROP COLUMN IF EXISTS "partnerOrderNo",
DROP COLUMN IF EXISTS "partnerTrackingUrl";
