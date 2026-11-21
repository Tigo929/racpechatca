-- Ozon Доставка для бизнеса: пункт выдачи и получатель в заказе,
-- отправление Ozon по заказу, цена «ПВЗ Ozon» для клиента.
-- Идемпотентно: миграцию применяет контейнер при старте.

ALTER TABLE "OrderPhoto" ADD COLUMN IF NOT EXISTS "pickupPointId" TEXT;
ALTER TABLE "OrderPhoto" ADD COLUMN IF NOT EXISTS "pickupPointNumber" TEXT;
ALTER TABLE "OrderPhoto" ADD COLUMN IF NOT EXISTS "pickupPointAddress" TEXT;
ALTER TABLE "OrderPhoto" ADD COLUMN IF NOT EXISTS "pickupPointSchedule" TEXT;
ALTER TABLE "OrderPhoto" ADD COLUMN IF NOT EXISTS "recipientName" TEXT;
ALTER TABLE "OrderPhoto" ADD COLUMN IF NOT EXISTS "recipientPhone" TEXT;

ALTER TABLE "PartnerSettings" ADD COLUMN IF NOT EXISTS "deliveryPriceOzonPvz" INTEGER NOT NULL DEFAULT 300;

CREATE TABLE IF NOT EXISTS "OzonShipment" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "orderId" TEXT NOT NULL,
    "requestId" SERIAL NOT NULL,
    "ozonOrderNumber" TEXT,
    "postingNumber" TEXT,
    "status" TEXT NOT NULL DEFAULT 'CREATED',
    "ozonStatus" TEXT,
    "ozonStatusAt" TIMESTAMP(3),
    "weightG" INTEGER NOT NULL,
    "lengthMm" INTEGER NOT NULL,
    "widthMm" INTEGER NOT NULL,
    "heightMm" INTEGER NOT NULL,
    "declaredValue" INTEGER NOT NULL,
    "estimatedCost" INTEGER,
    "estimatedInsurance" INTEGER,
    "estimatedDays" INTEGER,
    "actualCost" INTEGER,
    "createdById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "shippedAt" TIMESTAMP(3),
    "arrivedAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "returnedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "lastSyncedAt" TIMESTAMP(3),
    "ownerRemindedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "raw" JSONB,
    CONSTRAINT "OzonShipment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "OzonShipment_orderId_key" ON "OzonShipment"("orderId");
CREATE UNIQUE INDEX IF NOT EXISTS "OzonShipment_requestId_key" ON "OzonShipment"("requestId");
CREATE UNIQUE INDEX IF NOT EXISTS "OzonShipment_postingNumber_key" ON "OzonShipment"("postingNumber");
CREATE INDEX IF NOT EXISTS "OzonShipment_status_idx" ON "OzonShipment"("status");

DO $$ BEGIN
    ALTER TABLE "OzonShipment" ADD CONSTRAINT "OzonShipment_orderId_fkey"
        FOREIGN KEY ("orderId") REFERENCES "OrderPhoto"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
