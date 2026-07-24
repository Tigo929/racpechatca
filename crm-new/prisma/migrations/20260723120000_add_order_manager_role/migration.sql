-- Новая роль: менеджер по оформлению заказов.
-- Значение добавляется, но НЕ используется в этой же миграции (это требование
-- PostgreSQL для ALTER TYPE ... ADD VALUE внутри транзакции).
ALTER TYPE "EnumRole" ADD VALUE 'ORDER_MANAGER';

-- Ставка премии за разработку дизайна (сотые процента), только у менеджера.
ALTER TABLE "User" ADD COLUMN "designRateBasisPoints" INTEGER;

-- Стоимость «разработка дизайна» по заказу (входит в чек, база премии менеджера)
-- и кто оформил заказ (для начисления зарплаты менеджеру по оформлению).
ALTER TABLE "OrderPhoto" ADD COLUMN "designDevelopmentCost" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "OrderPhoto" ADD COLUMN "processedById" TEXT;
ALTER TABLE "OrderPhoto"
  ADD CONSTRAINT "OrderPhoto_processedById_fkey"
  FOREIGN KEY ("processedById") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "OrderPhoto_processedById_idx" ON "OrderPhoto"("processedById");

-- Тип начисления: исполнителю за производство или менеджеру за оформление.
CREATE TYPE "EnumAccrualKind" AS ENUM ('EXECUTOR', 'MANAGER');

-- Начисление получает тип и (для менеджера) базу/ставку премии за дизайн.
ALTER TABLE "SalaryAccrual" ADD COLUMN "kind" "EnumAccrualKind" NOT NULL DEFAULT 'EXECUTOR';
ALTER TABLE "SalaryAccrual" ADD COLUMN "designBase" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "SalaryAccrual" ADD COLUMN "designRateBasisPoints" INTEGER NOT NULL DEFAULT 0;
CREATE INDEX "SalaryAccrual_orderId_kind_idx" ON "SalaryAccrual"("orderId", "kind");
