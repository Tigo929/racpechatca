-- Черновик сообщения клиенту в Telegram.
--
-- Менеджер просит подготовить текст, а живой аккаунт кладёт его в поле
-- ввода чата — НЕ отправляя. Отправит человек сам, когда клиент ответит.
-- Состояние живёт здесь, а не в воркере: перезапуск контейнера не должен
-- ни терять просьбу, ни выполнять её дважды.
ALTER TABLE "OrderPhoto"
    ADD COLUMN IF NOT EXISTS "clientDraftRequestedAt" TIMESTAMP(3),
    ADD COLUMN IF NOT EXISTS "clientDraftText" TEXT,
    ADD COLUMN IF NOT EXISTS "clientDraftAt" TIMESTAMP(3),
    ADD COLUMN IF NOT EXISTS "clientDraftStatus" TEXT;

-- Под выборку очереди: «просили, но ещё не положили».
CREATE INDEX IF NOT EXISTS "OrderPhoto_clientDraft_idx"
    ON "OrderPhoto"("clientDraftRequestedAt")
    WHERE "clientDraftRequestedAt" IS NOT NULL AND "clientDraftAt" IS NULL;
