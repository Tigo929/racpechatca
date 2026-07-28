-- Migration: store Telegram message_id/chat_id for partner order messages
ALTER TABLE "OrderPhoto" ADD COLUMN IF NOT EXISTS "partnerTgMessageId" INTEGER;
ALTER TABLE "OrderPhoto" ADD COLUMN IF NOT EXISTS "partnerTgChatId" TEXT;