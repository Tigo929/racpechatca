-- Отметка «оператор отправил клиенту запрос отзыва» (кнопкой в Telegram): когда
-- и кто нажал. Отдельно от clientReviewLeft (клиент оставил отзыв).
ALTER TABLE "OrderPhoto" ADD COLUMN "reviewRequestSentAt" TIMESTAMP(3);
ALTER TABLE "OrderPhoto" ADD COLUMN "reviewRequestSentBy" TEXT;
