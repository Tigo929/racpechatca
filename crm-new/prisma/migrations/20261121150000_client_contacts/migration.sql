-- Контакты клиентов: остаются, даже когда заказ удалён.
-- Заполняются приложением из заказов и корзины при старте и дальше по ходу
-- работы. Идемпотентно: миграцию применяет контейнер при старте.

CREATE TABLE IF NOT EXISTS "ClientContact" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "identityKey" TEXT NOT NULL,
    "name" TEXT,
    "phone" TEXT,
    "telegram" TEXT,
    "maxContact" TEXT,
    "email" TEXT,
    "contactUrl" TEXT,
    "channel" TEXT,
    "lastSource" TEXT,
    "firstOrderAt" TIMESTAMP(3),
    "lastOrderAt" TIMESTAMP(3),
    "marketingConsent" BOOLEAN NOT NULL DEFAULT false,
    "marketingConsentAt" TIMESTAMP(3),
    "marketingConsentSource" TEXT,
    "unsubscribedAt" TIMESTAMP(3),
    "ownerNote" TEXT,
    CONSTRAINT "ClientContact_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ClientContact_identityKey_key" ON "ClientContact"("identityKey");
CREATE INDEX IF NOT EXISTS "ClientContact_lastOrderAt_idx" ON "ClientContact"("lastOrderAt");
CREATE INDEX IF NOT EXISTS "ClientContact_marketingConsent_idx" ON "ClientContact"("marketingConsent");

CREATE TABLE IF NOT EXISTS "ClientContactOrder" (
    "orderId" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "contactId" TEXT NOT NULL,
    "numberOrder" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "sourceOrder" TEXT NOT NULL,
    "productCategory" TEXT NOT NULL,
    "totalOrder" INTEGER NOT NULL DEFAULT 0,
    "orderCreatedAt" TIMESTAMP(3) NOT NULL,
    "deleted" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "ClientContactOrder_pkey" PRIMARY KEY ("orderId")
);

CREATE INDEX IF NOT EXISTS "ClientContactOrder_contactId_idx" ON "ClientContactOrder"("contactId");

DO $$ BEGIN
    ALTER TABLE "ClientContactOrder" ADD CONSTRAINT "ClientContactOrder_contactId_fkey"
        FOREIGN KEY ("contactId") REFERENCES "ClientContact"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
