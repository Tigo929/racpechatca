-- Согласование печати: шаблоны мокапов и версии согласований.
--
-- Ничего существующего не трогаем: только две новые таблицы и два
-- перечисления. Связь с заказом каскадная — удалили заказ, ушли и его
-- согласования; автор ставится в NULL, чтобы удаление сотрудника не
-- уносило историю макетов.

-- CreateEnum
CREATE TYPE "EnumApprovalSide" AS ENUM ('FRONT', 'BACK');

-- CreateEnum
CREATE TYPE "EnumApprovalStatus" AS ENUM ('DRAFT', 'READY', 'SENT', 'APPROVED', 'CHANGES_REQUESTED');

-- CreateTable
CREATE TABLE "MockupTemplate" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "key" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "garmentType" TEXT NOT NULL DEFAULT 'tshirt',
    "color" TEXT NOT NULL,
    "side" "EnumApprovalSide" NOT NULL,
    "imageFile" TEXT,
    "imageWidth" INTEGER,
    "imageHeight" INTEGER,
    "printAreaX" INTEGER NOT NULL DEFAULT 0,
    "printAreaY" INTEGER NOT NULL DEFAULT 0,
    "printAreaWidth" INTEGER NOT NULL DEFAULT 0,
    "printAreaHeight" INTEGER NOT NULL DEFAULT 0,
    "printAreaWidthMm" INTEGER NOT NULL DEFAULT 400,
    "printAreaHeightMm" INTEGER NOT NULL DEFAULT 500,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "MockupTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrintApproval" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "orderId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "status" "EnumApprovalStatus" NOT NULL DEFAULT 'DRAFT',
    "shirtColor" TEXT NOT NULL,
    "shirtSize" "EnumTshirtSize" NOT NULL,
    "comment" TEXT,
    "sides" JSONB NOT NULL DEFAULT '{}',
    "previewFile" TEXT,
    "finalizedAt" TIMESTAMP(3),
    "createdById" TEXT,

    CONSTRAINT "PrintApproval_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MockupTemplate_key_key" ON "MockupTemplate"("key");

-- CreateIndex
CREATE INDEX "MockupTemplate_isActive_sortOrder_idx" ON "MockupTemplate"("isActive", "sortOrder");

-- CreateIndex
CREATE INDEX "PrintApproval_orderId_idx" ON "PrintApproval"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "PrintApproval_orderId_version_key" ON "PrintApproval"("orderId", "version");

-- AddForeignKey
ALTER TABLE "PrintApproval" ADD CONSTRAINT "PrintApproval_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "OrderPhoto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrintApproval" ADD CONSTRAINT "PrintApproval_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Четыре стартовых шаблона: чёрная и белая футболка, перед и спина.
-- Фотографии не заводим — их загружает администратор в настройках, там же
-- задаётся зона печати. Пока imageFile пуст, шаблон в редакторе недоступен.
INSERT INTO "MockupTemplate" ("id", "updatedAt", "key", "title", "color", "side", "sortOrder")
VALUES
  (gen_random_uuid(), CURRENT_TIMESTAMP, 'tshirt_black_front', 'Футболка чёрная — лицевая', 'Чёрный', 'FRONT', 10),
  (gen_random_uuid(), CURRENT_TIMESTAMP, 'tshirt_black_back',  'Футболка чёрная — спина',   'Чёрный', 'BACK',  20),
  (gen_random_uuid(), CURRENT_TIMESTAMP, 'tshirt_white_front', 'Футболка белая — лицевая',  'Белый',  'FRONT', 30),
  (gen_random_uuid(), CURRENT_TIMESTAMP, 'tshirt_white_back',  'Футболка белая — спина',    'Белый',  'BACK',  40)
ON CONFLICT ("key") DO NOTHING;
