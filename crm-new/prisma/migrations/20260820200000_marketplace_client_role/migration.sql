-- Внешний продавец: пользуется только разделом «Маркетплейсы» и только своими
-- кабинетами. Это не сотрудник, а клиент сервиса.
ALTER TYPE "EnumRole" ADD VALUE IF NOT EXISTS 'MARKETPLACE_CLIENT';

-- Чей кабинет. Пусто у заведённых раньше — они принадлежат владельцу.
-- Каскад по владельцу: удалили внешнего продавца — уходят и его доступы,
-- чтобы чужой ключ не остался в базе без хозяина.
ALTER TABLE "MarketplaceAccount" ADD COLUMN "ownerId" TEXT;
ALTER TABLE "MarketplaceAccount"
  ADD CONSTRAINT "MarketplaceAccount_ownerId_fkey"
  FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "MarketplaceAccount_ownerId_idx" ON "MarketplaceAccount"("ownerId");
