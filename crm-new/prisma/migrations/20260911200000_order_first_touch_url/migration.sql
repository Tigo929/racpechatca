-- Первая страница визита (вкладки), из которой пришла заявка.
-- Отдельно от conversionPageUrl — страницы, на которой заявку отправили.
-- Nullable, без DEFAULT: правка каталога, строки не перезаписываются.
-- Сгенерировано `prisma migrate diff` по схеме, вручную не правилось.

-- AlterTable
ALTER TABLE "OrderPhoto" ADD COLUMN     "firstTouchUrl" TEXT;

