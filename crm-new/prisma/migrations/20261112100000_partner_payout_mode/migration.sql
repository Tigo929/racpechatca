-- Режим выплаты партнёру — у позиции, а не выведенный из одного флага.
--
-- Раньше вариантов было ровно два: позиция «печать по изделию заказчика»
-- (printOnClientItem) попадала в расчёт с долей от маржи, любая другая
-- свободная позиция не попадала вовсе. Печать термотрансферов — третий
-- случай: изделия нет, материалов с нашей стороны нет, партнёру платим
-- процент от суммы. Пока режима не было, такой заказ уходил исполнителю
-- со строкой «800 ₽» и нулевым заработком.
DO $$
BEGIN
  CREATE TYPE "EnumPartnerPayout" AS ENUM ('NONE', 'MARGIN_SHARE', 'REVENUE_SHARE');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "ItemPhoto"
  ADD COLUMN IF NOT EXISTS "partnerPayout" "EnumPartnerPayout" NOT NULL DEFAULT 'NONE';

-- Ставка снимком на момент оформления — тем же правилом, что thermalCost.
-- NULL значит «брать текущую из настроек»: так остаются вести себя позиции,
-- заведённые до этой миграции.
ALTER TABLE "ItemPhoto"
  ADD COLUMN IF NOT EXISTS "partnerRateBasisPoints" INTEGER;

-- Перенос прежнего поведения один в один: что считалось долей от маржи,
-- ею и остаётся. Ставку не проставляем — пусть берётся из настроек, как
-- до миграции.
UPDATE "ItemPhoto"
SET "partnerPayout" = 'MARGIN_SHARE'
WHERE "printOnClientItem" = TRUE
  AND "partnerPayout" = 'NONE';

-- Процент по умолчанию для нового режима. Отдельной колонкой, а не общей
-- ставкой: база у них разная (сумма против маржи), и когда-нибудь проценты
-- разойдутся — менять формулу тогда не придётся.
ALTER TABLE "PartnerSettings"
  ADD COLUMN IF NOT EXISTS "transferRateBasisPoints" INTEGER NOT NULL DEFAULT 3000;
