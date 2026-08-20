-- Условия производства по холсту: скидка и своя доставка по Москве.
-- Прайс лежит в коде — он приходит файлом; договорённости меняются
-- переговорами, поэтому им место в настройках.
ALTER TABLE "PartnerSettings" ADD COLUMN "canvasDiscountBasisPoints" INTEGER NOT NULL DEFAULT 2000;
ALTER TABLE "PartnerSettings" ADD COLUMN "canvasDeliveryCost" INTEGER NOT NULL DEFAULT 700;
ALTER TABLE "PartnerSettings" ADD COLUMN "canvasDeliveryPrice" INTEGER NOT NULL DEFAULT 800;

-- Размер и материал по прайсу. Nullable: у заведённых раньше позиций их нет,
-- и трогать их нельзя — цена там уже согласована с клиентом.
ALTER TABLE "ItemCanvas" ADD COLUMN "sizeKey" TEXT;
ALTER TABLE "ItemCanvas" ADD COLUMN "material" TEXT;

-- Своя доставка производства по Москве.
ALTER TYPE "EnumDeliveryMethod" ADD VALUE IF NOT EXISTS 'PRODUCTION_MSK';
