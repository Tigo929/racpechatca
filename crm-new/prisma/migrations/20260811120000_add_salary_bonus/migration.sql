-- Ручная премия сотруднику: обычное начисление, но вне заказа.
-- Поэтому orderId становится необязательным, а у начисления появляется
-- описание (за что) и автор (кто начислил).
ALTER TYPE "EnumAccrualKind" ADD VALUE IF NOT EXISTS 'BONUS';

ALTER TABLE "SalaryAccrual" ALTER COLUMN "orderId" DROP NOT NULL;

ALTER TABLE "SalaryAccrual" ADD COLUMN IF NOT EXISTS "note" TEXT;
ALTER TABLE "SalaryAccrual" ADD COLUMN IF NOT EXISTS "createdById" TEXT;
