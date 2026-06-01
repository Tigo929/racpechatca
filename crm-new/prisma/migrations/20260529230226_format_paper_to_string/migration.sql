-- CreateEnum
CREATE TYPE "EnumSourceOrder" AS ENUM ('AVITO', 'OZON', 'WB', 'LOCAL');

-- CreateEnum
CREATE TYPE "EnumCommunication" AS ENUM ('AVITO', 'TELEGRAM', 'MAX', 'OZON');

-- CreateEnum
CREATE TYPE "EnumStatus" AS ENUM ('NEW', 'FOLDER_STRUCTURE_CREATED', 'PRINTED', 'READY', 'SENT', 'PAID');

-- CreateEnum
CREATE TYPE "EnumDeliveryMethod" AS ENUM ('YANDEX_PVZ', 'OZON_PVZ', 'PICKUP', 'OZON_SELLER', 'WB_SELLER');

-- CreateEnum
CREATE TYPE "EnumTypePaper" AS ENUM ('GLOSS', 'MATTE');

-- CreateTable
CREATE TABLE "OrderPhoto" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "numberOrder" TEXT NOT NULL,
    "sourceOrder" "EnumSourceOrder" NOT NULL,
    "communicationPlatform" "EnumCommunication" NOT NULL,
    "urlCommunication" TEXT NOT NULL,
    "deliveryMethod" "EnumDeliveryMethod" NOT NULL,
    "deliveryCost" INTEGER NOT NULL,
    "totalOrder" INTEGER NOT NULL,
    "note" TEXT,
    "status" "EnumStatus" NOT NULL DEFAULT 'NEW',

    CONSTRAINT "OrderPhoto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ItemPhoto" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "orderId" TEXT NOT NULL,
    "formatPaper" TEXT NOT NULL,
    "typePaper" "EnumTypePaper" NOT NULL,
    "quantity" INTEGER NOT NULL,
    "price" INTEGER NOT NULL,
    "pricePosition" INTEGER NOT NULL,

    CONSTRAINT "ItemPhoto_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OrderPhoto_numberOrder_key" ON "OrderPhoto"("numberOrder");

-- AddForeignKey
ALTER TABLE "ItemPhoto" ADD CONSTRAINT "ItemPhoto_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "OrderPhoto"("id") ON DELETE CASCADE ON UPDATE CASCADE;
