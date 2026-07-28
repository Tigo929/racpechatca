-- «Старший дня» по отгрузкам: ссылка на пользователя, которого тегаем в плане
-- дня, чтобы он оформил поставки по готовым фотозаказам. SetNull: удаление
-- пользователя обнуляет флаг, но строку состояния не рушит.
ALTER TABLE "AppState" ADD COLUMN "shipmentLeadUserId" TEXT;

ALTER TABLE "AppState" ADD CONSTRAINT "AppState_shipmentLeadUserId_fkey"
  FOREIGN KEY ("shipmentLeadUserId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
