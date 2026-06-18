-- Склад футболок: остатки по размеру×цвету + журнал списаний по заказам.

CREATE TABLE "TshirtStock" (
    "id" TEXT NOT NULL,
    "size" "EnumTshirtSize" NOT NULL,
    "color" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TshirtStock_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TshirtStock_size_color_key" ON "TshirtStock"("size", "color");

CREATE TABLE "StockMovement" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "orderId" TEXT NOT NULL,
    "size" "EnumTshirtSize" NOT NULL,
    "color" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    CONSTRAINT "StockMovement_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "StockMovement_orderId_idx" ON "StockMovement"("orderId");

ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_orderId_fkey"
    FOREIGN KEY ("orderId") REFERENCES "OrderPhoto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Стартовые 12 строк (6 размеров S..3XL × 2 цвета) с нулевым остатком.
INSERT INTO "TshirtStock" ("id", "size", "color", "quantity", "updatedAt") VALUES
  (gen_random_uuid()::text, 'S',    'Белый',  0, now()),
  (gen_random_uuid()::text, 'S',    'Чёрный', 0, now()),
  (gen_random_uuid()::text, 'M',    'Белый',  0, now()),
  (gen_random_uuid()::text, 'M',    'Чёрный', 0, now()),
  (gen_random_uuid()::text, 'L',    'Белый',  0, now()),
  (gen_random_uuid()::text, 'L',    'Чёрный', 0, now()),
  (gen_random_uuid()::text, 'XL',   'Белый',  0, now()),
  (gen_random_uuid()::text, 'XL',   'Чёрный', 0, now()),
  (gen_random_uuid()::text, 'XXL',  'Белый',  0, now()),
  (gen_random_uuid()::text, 'XXL',  'Чёрный', 0, now()),
  (gen_random_uuid()::text, 'XXXL', 'Белый',  0, now()),
  (gen_random_uuid()::text, 'XXXL', 'Чёрный', 0, now());
