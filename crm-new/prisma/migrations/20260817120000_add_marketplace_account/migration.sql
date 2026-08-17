-- Кабинеты маркетплейсов, подключённые по API (первый — Ozon Seller API).
-- Ключ лежит зашифрованным: в базе видно только зашифрованный apiKeySecret
-- и хвост apiKeyHint для интерфейса.

CREATE TYPE "EnumMarketplace" AS ENUM ('OZON', 'WB', 'YANDEX');

CREATE TABLE "MarketplaceAccount" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "marketplace" "EnumMarketplace" NOT NULL,
    "title" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "apiKeySecret" TEXT NOT NULL,
    "apiKeyHint" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastCheckAt" TIMESTAMP(3),
    "lastCheckOk" BOOLEAN,
    "lastCheckError" TEXT,
    "lastCheckInfo" JSONB,

    CONSTRAINT "MarketplaceAccount_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MarketplaceAccount_marketplace_externalId_key"
    ON "MarketplaceAccount"("marketplace", "externalId");

CREATE INDEX "MarketplaceAccount_marketplace_isActive_idx"
    ON "MarketplaceAccount"("marketplace", "isActive");
