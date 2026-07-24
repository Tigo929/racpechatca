-- CreateEnum
CREATE TYPE "EnumAvitoMessageDirection" AS ENUM ('IN', 'OUT');

-- CreateTable
CREATE TABLE "AvitoChat" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "avitoChatId" TEXT NOT NULL,
    "avitoAccountId" TEXT NOT NULL,
    "avitoItemId" TEXT,
    "itemTitle" TEXT,
    "itemUrl" TEXT,
    "itemPrice" TEXT,
    "clientAvitoId" TEXT,
    "clientName" TEXT,
    "clientProfileUrl" TEXT,
    "clientAvatarUrl" TEXT,
    "chatCreatedAt" TIMESTAMP(3),
    "lastMessageAt" TIMESTAMP(3),
    "lastMessageText" TEXT,
    "lastMessageType" TEXT,
    "lastDirection" "EnumAvitoMessageDirection",
    "orderId" TEXT,

    CONSTRAINT "AvitoChat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AvitoMessage" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "avitoMessageId" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "authorAvitoId" TEXT,
    "direction" "EnumAvitoMessageDirection" NOT NULL,
    "type" TEXT NOT NULL,
    "text" TEXT,
    "content" JSONB,
    "sentAt" TIMESTAMP(3) NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMP(3),
    "sentById" TEXT,

    CONSTRAINT "AvitoMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AvitoChat_avitoChatId_key" ON "AvitoChat"("avitoChatId");

-- CreateIndex
CREATE INDEX "AvitoChat_lastMessageAt_idx" ON "AvitoChat"("lastMessageAt");

-- CreateIndex
CREATE INDEX "AvitoChat_orderId_idx" ON "AvitoChat"("orderId");

-- CreateIndex
CREATE INDEX "AvitoChat_avitoAccountId_idx" ON "AvitoChat"("avitoAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "AvitoMessage_avitoMessageId_key" ON "AvitoMessage"("avitoMessageId");

-- CreateIndex
CREATE INDEX "AvitoMessage_chatId_sentAt_idx" ON "AvitoMessage"("chatId", "sentAt");

-- CreateIndex
CREATE INDEX "AvitoMessage_direction_isRead_idx" ON "AvitoMessage"("direction", "isRead");

-- AddForeignKey
ALTER TABLE "AvitoChat" ADD CONSTRAINT "AvitoChat_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "OrderPhoto"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AvitoMessage" ADD CONSTRAINT "AvitoMessage_chatId_fkey" FOREIGN KEY ("chatId") REFERENCES "AvitoChat"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AvitoMessage" ADD CONSTRAINT "AvitoMessage_sentById_fkey" FOREIGN KEY ("sentById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
