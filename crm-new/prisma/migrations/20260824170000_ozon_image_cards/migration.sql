-- Генератор главных фото карточек Ozon.
--
-- Только новые таблицы и перечисления: ни одна существующая не трогается.
-- Пачки и карточки удаляются каскадом вместе с пачкой; шаблон удалить,
-- пока на него ссылаются карточки, нельзя намеренно — иначе исчезнет
-- история того, чем эти карточки собирали.

-- CreateEnum
CREATE TYPE "EnumCardBatchStatus" AS ENUM ('DRAFT', 'PROCESSING', 'REVIEW', 'FINALIZING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "EnumSourceAssetStatus" AS ENUM ('PENDING', 'PROCESSING', 'READY', 'ERROR');

-- CreateEnum
CREATE TYPE "EnumGeneratedCardStatus" AS ENUM ('GENERATED', 'REVIEW_REQUIRED', 'APPROVED', 'FINALIZED', 'ERROR', 'SKIPPED');

-- CreateTable
CREATE TABLE "ImageCardTemplate" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "title" TEXT NOT NULL,
    "shirtColor" TEXT NOT NULL,
    "templateFile" TEXT,
    "canvasWidth" INTEGER NOT NULL DEFAULT 0,
    "canvasHeight" INTEGER NOT NULL DEFAULT 0,
    "placementArea" JSONB NOT NULL DEFAULT '{}',
    "safeArea" JSONB,
    "version" INTEGER NOT NULL DEFAULT 1,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ImageCardTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImageCardBatch" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "title" TEXT NOT NULL,
    "status" "EnumCardBatchStatus" NOT NULL DEFAULT 'DRAFT',
    "settings" JSONB NOT NULL DEFAULT '{}',
    "createdById" TEXT,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "ImageCardBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImageCardSource" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "batchId" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "baseName" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceFile" TEXT NOT NULL,
    "rasterFile" TEXT,
    "widthPx" INTEGER NOT NULL DEFAULT 0,
    "heightPx" INTEGER NOT NULL DEFAULT 0,
    "hasAlpha" BOOLEAN NOT NULL DEFAULT false,
    "status" "EnumSourceAssetStatus" NOT NULL DEFAULT 'PENDING',
    "errorMessage" TEXT,

    CONSTRAINT "ImageCardSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImageCardGenerated" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "batchId" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "templateSnapshot" JSONB NOT NULL DEFAULT '{}',
    "shirtColor" TEXT NOT NULL,
    "status" "EnumGeneratedCardStatus" NOT NULL DEFAULT 'GENERATED',
    "transform" JSONB NOT NULL DEFAULT '{}',
    "removeWhiteBackground" BOOLEAN NOT NULL DEFAULT false,
    "previewFile" TEXT,
    "finalFile" TEXT,
    "validation" JSONB,
    "note" TEXT,

    CONSTRAINT "ImageCardGenerated_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ImageCardTemplate_active_shirtColor_idx" ON "ImageCardTemplate"("active", "shirtColor");

-- CreateIndex
CREATE INDEX "ImageCardBatch_status_idx" ON "ImageCardBatch"("status");

-- CreateIndex
CREATE INDEX "ImageCardBatch_createdAt_idx" ON "ImageCardBatch"("createdAt");

-- CreateIndex
CREATE INDEX "ImageCardSource_batchId_status_idx" ON "ImageCardSource"("batchId", "status");

-- CreateIndex
CREATE INDEX "ImageCardGenerated_batchId_status_idx" ON "ImageCardGenerated"("batchId", "status");

-- CreateIndex
CREATE INDEX "ImageCardGenerated_sourceId_idx" ON "ImageCardGenerated"("sourceId");

-- AddForeignKey
ALTER TABLE "ImageCardBatch" ADD CONSTRAINT "ImageCardBatch_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImageCardSource" ADD CONSTRAINT "ImageCardSource_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "ImageCardBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImageCardGenerated" ADD CONSTRAINT "ImageCardGenerated_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "ImageCardBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImageCardGenerated" ADD CONSTRAINT "ImageCardGenerated_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "ImageCardSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImageCardGenerated" ADD CONSTRAINT "ImageCardGenerated_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "ImageCardTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
