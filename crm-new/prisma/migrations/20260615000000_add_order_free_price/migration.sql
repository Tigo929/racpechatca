-- Свободная (договорная) цена заказа: количество не умножается на цену.
ALTER TABLE "OrderPhoto" ADD COLUMN "isFreePrice" BOOLEAN NOT NULL DEFAULT false;
