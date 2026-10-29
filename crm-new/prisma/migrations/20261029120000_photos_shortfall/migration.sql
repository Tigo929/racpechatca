-- Недобор фотографий заказа: сколько обещано, сколько доехало и когда
-- менеджер сказал, что всё собрано.
--
-- Раньше об этом говорила только строка в примечании и сообщение в
-- Telegram. Строку пролистывают, сообщение теряется в потоке — а заказ
-- уезжает в печать неполным. По этим числам карточка заказа краснеет
-- целиком, и пройти мимо нельзя.
--
-- IF NOT EXISTS: миграция должна проходить и на базе, где колонки уже
-- добавили руками при разборе инцидента.
ALTER TABLE "OrderPhoto" ADD COLUMN IF NOT EXISTS "photosExpected" INTEGER;
ALTER TABLE "OrderPhoto" ADD COLUMN IF NOT EXISTS "photosArrived" INTEGER;
ALTER TABLE "OrderPhoto" ADD COLUMN IF NOT EXISTS "photosResolvedAt" TIMESTAMP(3);
