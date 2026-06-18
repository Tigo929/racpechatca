-- Отметка «клиент оставил отзыв» (вручную в списке заказов).
ALTER TABLE "OrderPhoto" ADD COLUMN "clientReviewLeft" BOOLEAN NOT NULL DEFAULT false;
