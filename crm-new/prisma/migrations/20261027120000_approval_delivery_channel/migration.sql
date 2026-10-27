-- Канал отправки листа согласования.
--
-- Таблица отправок появилась под Telegram и названа по нему. Теперь тем же
-- путём уходит макет в чат с покупателем на Ozon: очередь, правила «отправить
-- один раз» и экран статуса общие, разная только доставка.
--
-- Старые строки — телеграмные, поэтому значение по умолчанию именно TELEGRAM:
-- переписывать историю не нужно, а userbot продолжает забирать только свои.
DO $$ BEGIN
  CREATE TYPE "EnumApprovalChannel" AS ENUM ('TELEGRAM', 'OZON');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "ApprovalTelegramDelivery"
  ADD COLUMN IF NOT EXISTS "channel" "EnumApprovalChannel" NOT NULL DEFAULT 'TELEGRAM';
