-- Ответ клиента на приветствие и счёт, который уходит сам.
--
-- Заявка с сайта здоровается автоматически, но дальше всё делал человек:
-- прочитать ответ, отправить подтверждение с суммой, перевести заявку
-- в заказ. Эти колонки хранят состояние той же цепочки, выполненной
-- системой: что ответил клиент, признали ли ответ согласием и чем
-- закончилась отправка счёта.
--
-- IF NOT EXISTS — чтобы повторный прогон на живой базе не падал.
ALTER TABLE "OrderPhoto" ADD COLUMN IF NOT EXISTS "clientReplyText" TEXT;
ALTER TABLE "OrderPhoto" ADD COLUMN IF NOT EXISTS "clientReplyAt" TIMESTAMP(3);
ALTER TABLE "OrderPhoto" ADD COLUMN IF NOT EXISTS "clientConfirmedAt" TIMESTAMP(3);
ALTER TABLE "OrderPhoto" ADD COLUMN IF NOT EXISTS "invoiceSentAt" TIMESTAMP(3);
ALTER TABLE "OrderPhoto" ADD COLUMN IF NOT EXISTS "invoiceStatus" TEXT;

-- Очередь «кому ещё не писали»: заявки, которым поздоровались и ждут ответа.
CREATE INDEX IF NOT EXISTS "OrderPhoto_reply_wait_idx"
  ON "OrderPhoto" ("clientGreetedAt", "clientReplyAt", "status");

-- Очередь счетов: согласие получено, счёт ещё не ушёл.
CREATE INDEX IF NOT EXISTS "OrderPhoto_invoice_queue_idx"
  ON "OrderPhoto" ("clientConfirmedAt", "invoiceSentAt");
