-- Новая статья расходов: вознаграждение партнёру
ALTER TYPE "EnumExpenseCategory" ADD VALUE 'PARTNER_REWARD';

-- Себестоимость печати — снимок на позиции
ALTER TABLE "ItemTshirt" ADD COLUMN "thermalCost" INTEGER NOT NULL DEFAULT 70;
ALTER TABLE "ItemTshirt" ADD COLUMN "blankCost" INTEGER NOT NULL DEFAULT 260;

-- Привязка расхода к заказу (для идемпотентного авто-вознаграждения)
ALTER TABLE "ExpenseOrder" ADD COLUMN "orderId" TEXT;
ALTER TABLE "ExpenseOrder"
  ADD CONSTRAINT "ExpenseOrder_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "OrderPhoto"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "ExpenseOrder_orderId_category_idx"
  ON "ExpenseOrder"("orderId", "category");

-- Настройки расчёта с партнёром (одна строка)
CREATE TABLE "PartnerSettings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "thermalTransferCost" INTEGER NOT NULL DEFAULT 70,
    "blankTshirtCost" INTEGER NOT NULL DEFAULT 260,
    "partnerRateBasisPoints" INTEGER NOT NULL DEFAULT 3000,
    "partnerName" TEXT NOT NULL DEFAULT 'Партнёр',
    CONSTRAINT "PartnerSettings_pkey" PRIMARY KEY ("id")
);

INSERT INTO "PartnerSettings" ("id", "updatedAt")
  VALUES ('default', now());
