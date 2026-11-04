-- Telegram покупателя с площадки — второй канал связи рядом с чатом кабинета.
--
-- Чат площадки остаётся основным: там заказ и там покупателя находят по
-- номеру отправления. Но он умеет мало, поэтому в разговоре мы просим
-- написать нам в Telegram; написал — ник ложится в заказ, и дальше оба
-- канала открываются из карточки.
--
-- reviewRequestStatus — итог автоматической просьбы об отзыве, которую
-- после выкупа отправляет живой аккаунт. Пусто означает «ещё не пробовали
-- или отправлять некуда», и тогда просьбу по-прежнему отправляет человек.
ALTER TABLE "OrderPhoto"
ADD COLUMN IF NOT EXISTS "clientTelegram" TEXT,
ADD COLUMN IF NOT EXISTS "clientTelegramAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "reviewRequestStatus" TEXT;

-- Очередь автоматических просьб выбирает заказы по этим трём полям.
CREATE INDEX IF NOT EXISTS "OrderPhoto_review_autosend_idx"
ON "OrderPhoto" ("clientReviewLeft", "reviewRequestStatus", "clientTelegram");
