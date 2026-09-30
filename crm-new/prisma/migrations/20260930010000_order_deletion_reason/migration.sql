-- Почему заявку удалили.
--
-- Отдельная таблица, а не поле у заказа: заказ удаляется физически, вместе
-- с позициями и начислениями, и запись о причине обязана его пережить.
-- Поэтому здесь лежит снимок — номер, источник, статус, сумма: после
-- удаления связать причину будет уже не с чем.
--
-- Автор без внешнего ключа на пользователя намеренно: увольнение сотрудника
-- не должно ни стирать историю, ни блокировать удаление его учётной записи.
CREATE TABLE IF NOT EXISTS "OrderDeletion" (
    "id"                TEXT NOT NULL,
    "deletedAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reason"            TEXT NOT NULL,
    "deletedById"       TEXT,
    "deletedByName"     TEXT,
    "orderId"           TEXT NOT NULL,
    "numberOrder"       TEXT NOT NULL,
    "status"            TEXT NOT NULL,
    "sourceOrder"       TEXT NOT NULL,
    "productCategory"   TEXT NOT NULL,
    "totalOrder"        INTEGER NOT NULL DEFAULT 0,
    "orderCreatedAt"    TIMESTAMP(3),
    CONSTRAINT "OrderDeletion_pkey" PRIMARY KEY ("id")
);

-- Под будущую статистику: «за период», «по источникам», «по статусам».
CREATE INDEX IF NOT EXISTS "OrderDeletion_deletedAt_idx" ON "OrderDeletion"("deletedAt");
CREATE INDEX IF NOT EXISTS "OrderDeletion_sourceOrder_idx" ON "OrderDeletion"("sourceOrder");
