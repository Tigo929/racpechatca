-- Очередь уведомлений о заявках с сайта в Telegram.
--
-- Зачем: Telegram с боевого сервера доступен только через посредника, и когда
-- тот перестаёт отвечать, уведомление уходило в лог и терялось навсегда.
-- Теперь текст лежит в базе рядом с заказом и уходит, как только канал
-- отвечает.
--
-- Идемпотентно: миграцию применяет контейнер при старте, и повторный запуск
-- на уже обновлённой базе не должен падать.

CREATE TABLE IF NOT EXISTS "LeadTelegramDelivery" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "numberOrder" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "claimedUntil" TIMESTAMP(3),
    "claimToken" TEXT,
    "sentAt" TIMESTAMP(3),
    "lastError" TEXT,

    CONSTRAINT "LeadTelegramDelivery_pkey" PRIMARY KEY ("id")
);

-- Одно уведомление на заказ: сайт досылает недоставленную заявку по кругу.
CREATE UNIQUE INDEX IF NOT EXISTS "LeadTelegramDelivery_orderId_key"
    ON "LeadTelegramDelivery"("orderId");

-- По этому индексу воркер забирает очередную строку.
CREATE INDEX IF NOT EXISTS "LeadTelegramDelivery_status_nextAttemptAt_idx"
    ON "LeadTelegramDelivery"("status", "nextAttemptAt");
