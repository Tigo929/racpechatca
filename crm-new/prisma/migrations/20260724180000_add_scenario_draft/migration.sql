-- Черновик оформления заказа прямо на заявке.
-- scenarioKey — какой продукт ведёт менеджер, scenarioAnswers — что уже
-- выяснено у клиента. Оба поля необязательные: старые заказы оформлялись без
-- сценария, и переписывать их нечем и незачем.
ALTER TABLE "OrderPhoto" ADD COLUMN "scenarioKey" TEXT;
ALTER TABLE "OrderPhoto" ADD COLUMN "scenarioAnswers" JSONB;
