-- Плата за срочность: входит в чек клиента, но не в базу зарплаты.
ALTER TABLE "OrderPhoto" ADD COLUMN IF NOT EXISTS "urgencyFee" INTEGER NOT NULL DEFAULT 0;

-- Шаблон ссылки на переписку в MAX: менеджер вводит телефон, CRM собирает ссылку.
-- {phone} — цифры (79991234567), {phone_plus} — с плюсом.
ALTER TABLE "PartnerSettings"
  ADD COLUMN IF NOT EXISTS "maxLinkTemplate" TEXT NOT NULL DEFAULT 'https://max.ru/{phone}';
