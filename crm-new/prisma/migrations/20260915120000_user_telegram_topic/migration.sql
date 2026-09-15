-- id темы Telegram у исполнителя: при назначении заказа бот пишет в эту тему.
ALTER TABLE "User" ADD COLUMN "telegramTopicId" INTEGER;
