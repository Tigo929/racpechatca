-- Атрибуция заявки с сайта — колонками вместо строк в note.
-- Все колонки nullable, данных не трогаем, таблицу не блокируем надолго:
-- ADD COLUMN без DEFAULT в PostgreSQL — правка каталога, не перезапись строк.
-- Индексы: yandexClientId — под импорт заказов в Метрику и поиск заказов
-- одного посетителя; clientPaidAt — под отчёты по дате оплаты.
-- Сгенерировано `prisma migrate diff` по схеме, вручную не правилось.

-- AlterTable
ALTER TABLE "OrderPhoto" ADD COLUMN     "landingUrl" TEXT,
ADD COLUMN     "utmCampaign" TEXT,
ADD COLUMN     "utmContent" TEXT,
ADD COLUMN     "utmMedium" TEXT,
ADD COLUMN     "utmSource" TEXT,
ADD COLUMN     "utmTerm" TEXT,
ADD COLUMN     "yandexClientId" TEXT,
ADD COLUMN     "yclid" TEXT;

-- CreateIndex
CREATE INDEX "OrderPhoto_yandexClientId_idx" ON "OrderPhoto"("yandexClientId");

-- CreateIndex
CREATE INDEX "OrderPhoto_clientPaidAt_idx" ON "OrderPhoto"("clientPaidAt");

