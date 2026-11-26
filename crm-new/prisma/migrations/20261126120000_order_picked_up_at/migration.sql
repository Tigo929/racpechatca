-- Клиент забрал посылку (по данным службы доставки) — для просьбы об отзыве.
ALTER TABLE "OrderPhoto" ADD COLUMN IF NOT EXISTS "pickedUpAt" TIMESTAMP(3);
