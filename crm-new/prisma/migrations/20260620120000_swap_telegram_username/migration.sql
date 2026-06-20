-- Переходим от личного chat_id к @username: бот теперь пишет в общую группу
-- и тегает исполнителя по нику, а не шлёт личное сообщение.
ALTER TABLE "User" DROP COLUMN IF EXISTS "telegramChatId";
ALTER TABLE "User" ADD COLUMN "telegramUsername" TEXT;
