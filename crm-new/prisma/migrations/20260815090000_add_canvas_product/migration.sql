ALTER TYPE "EnumProductCategory" ADD VALUE IF NOT EXISTS 'CANVAS';

ALTER TYPE "EnumExpenseCategory" ADD VALUE IF NOT EXISTS 'CANVAS_CONTRACTOR';

CREATE TABLE IF NOT EXISTS "ItemCanvas" (
  "id" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "orderId" TEXT NOT NULL,
  "formatCanvas" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL,
  "clientPrice" INTEGER NOT NULL,
  "contractorPrice" INTEGER NOT NULL,
  "pricePosition" INTEGER NOT NULL,
  "contractorCostPosition" INTEGER NOT NULL,
  "profitPosition" INTEGER NOT NULL,

  CONSTRAINT "ItemCanvas_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ItemCanvas_orderId_idx" ON "ItemCanvas"("orderId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ItemCanvas_orderId_fkey'
  ) THEN
    ALTER TABLE "ItemCanvas"
      ADD CONSTRAINT "ItemCanvas_orderId_fkey"
      FOREIGN KEY ("orderId")
      REFERENCES "OrderPhoto"("id")
      ON DELETE CASCADE
      ON UPDATE CASCADE;
  END IF;
END $$;
