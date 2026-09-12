-- Базовые объекты эпохи `prisma db push` (до 13.06.2026).
--
-- До миграции 20260613000000_salary_architecture схема боевой базы менялась
-- командой `db push`, без файлов миграций: таблицы User и ItemTshirt, шесть
-- перечислений и ряд колонок появились в базе, но в истории миграций их нет.
-- Из-за этого пустую базу нельзя было собрать из репозитория — уже вторая
-- миграция падала на «relation "User" does not exist».
--
-- Эта миграция восстанавливает ровно недостающее, по фактической боевой схеме
-- (pg_dump копии базы 11.09.2026) и только в том виде, в каком объекты
-- существовали ДО последующих миграций: колонки, которые добавляют более
-- поздние миграции (isActive, rateBasisPoints, clientItem, thermalCost …),
-- здесь намеренно отсутствуют — иначе эти миграции упали бы на пустой базе.
--
-- Все операторы идемпотентны: на боевой базе, где объекты уже есть, миграция
-- ничего не меняет и просто фиксируется в _prisma_migrations. Порядок имени
-- (20260601) ставит её между первой миграцией и salary_architecture, чтобы
-- User существовал к моменту, когда на него впервые ссылаются.
--
-- Две миграции 20260531222621_add_yandex_request_id и
-- 20260531224724_add_delivery_info применены на бою тогда же, но их файлов
-- нет ни в одном коммите; следов их объектов в текущей схеме тоже нет
-- (`db push` их удалил). Восстанавливать их SQL не из чего — см. заметки в
-- их каталогах.

-- ── Перечисления ────────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE "EnumRole" AS ENUM ('ADMIN', 'EXECUTOR');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "EnumProductCategory" AS ENUM ('PHOTO', 'TSHIRT');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "EnumTshirtSize" AS ENUM ('XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "EnumTshirtGender" AS ENUM ('UNISEX', 'MALE', 'FEMALE', 'KIDS');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "EnumPrintLocation" AS ENUM ('FRONT', 'BACK', 'FRONT_BACK', 'SLEEVE_LEFT', 'SLEEVE_RIGHT', 'FULL', 'BY_TZ');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "EnumPrintType" AS ENUM ('DTF', 'DTG', 'SILK', 'SUBLIMATION');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Статусы, появившиеся через db push: заявка и «выполнен».
ALTER TYPE "EnumStatus" ADD VALUE IF NOT EXISTS 'LEAD';
ALTER TYPE "EnumStatus" ADD VALUE IF NOT EXISTS 'DONE' AFTER 'READY';

-- ── OrderPhoto: колонки эпохи db push ───────────────────────────────────────
-- Категория товара, срок и срочность появились в базе без миграций;
-- индекс по productCategory (20260619100000_add_indexes) их уже ждёт.
ALTER TABLE "OrderPhoto"
  ADD COLUMN IF NOT EXISTS "productCategory" "EnumProductCategory" NOT NULL DEFAULT 'PHOTO',
  ADD COLUMN IF NOT EXISTS "deadline"        TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "isUrgent"        BOOLEAN NOT NULL DEFAULT false;

-- ── User ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "User" (
    "id"        TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "username"  TEXT NOT NULL,
    "password"  TEXT NOT NULL,
    "role"      "EnumRole" NOT NULL DEFAULT 'EXECUTOR',

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "User_username_key" ON "User"("username");

-- ── ItemTshirt ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "ItemTshirt" (
    "id"            TEXT NOT NULL,
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"     TIMESTAMP(3) NOT NULL,
    "orderId"       TEXT NOT NULL,
    "color"         TEXT NOT NULL,
    "size"          "EnumTshirtSize" NOT NULL,
    "gender"        "EnumTshirtGender" NOT NULL DEFAULT 'UNISEX',
    "printLocation" "EnumPrintLocation" NOT NULL,
    "printType"     "EnumPrintType" NOT NULL DEFAULT 'DTF',
    "quantity"      INTEGER NOT NULL,
    "price"         INTEGER NOT NULL,
    "pricePosition" INTEGER NOT NULL,
    "designCost"    INTEGER NOT NULL DEFAULT 0,
    "designUrl"     TEXT,
    "designNote"    TEXT,

    CONSTRAINT "ItemTshirt_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ItemTshirt_orderId_fkey') THEN
    ALTER TABLE "ItemTshirt"
      ADD CONSTRAINT "ItemTshirt_orderId_fkey"
      FOREIGN KEY ("orderId") REFERENCES "OrderPhoto"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
