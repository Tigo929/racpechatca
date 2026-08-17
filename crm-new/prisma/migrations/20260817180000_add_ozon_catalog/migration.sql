-- Каталог Ozon: принты (карточки товара «Футболка»), их варианты цвет×размер
-- и константы категории, общие на весь кабинет.

CREATE TYPE "EnumOzonSyncStatus" AS ENUM ('DRAFT', 'QUEUED', 'SENT', 'OK', 'ERROR');

CREATE TABLE "OzonCatalogTemplate" (
    "id" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "marketplaceAccountId" TEXT NOT NULL,
    "descriptionCategoryId" INTEGER NOT NULL DEFAULT 200000933,
    "typeId" INTEGER NOT NULL DEFAULT 93244,
    "vatRate" TEXT NOT NULL DEFAULT 'Не облагается',
    "needsMarkingCode" BOOLEAN NOT NULL DEFAULT false,
    "brandLabel" TEXT NOT NULL DEFAULT 'Нет бренда',
    "brandDictionaryValueId" INTEGER NOT NULL DEFAULT 126745801,
    "countryLabel" TEXT,
    "countryDictionaryValueId" INTEGER,
    "materialLabel" TEXT DEFAULT 'Хлопок',
    "materialDictionaryValueId" INTEGER DEFAULT 62174,
    "materialComposition" TEXT DEFAULT '100% Хлопок',
    "styleLabel" TEXT DEFAULT 'Повседневный',
    "styleDictionaryValueId" INTEGER DEFAULT 29802,
    "seasonLabel" TEXT DEFAULT 'На любой сезон',
    "seasonDictionaryValueId" INTEGER DEFAULT 30937,
    "careInstructions" TEXT,
    "sleeveLabel" TEXT,
    "sleeveDictionaryValueId" INTEGER,
    "necklineLabel" TEXT,
    "necklineDictionaryValueId" INTEGER,
    "packageTypeLabel" TEXT DEFAULT 'Пакет',
    "packageTypeDictionaryValueId" INTEGER DEFAULT 44412,
    "tnvedLabel" TEXT DEFAULT 'Майки, фуфайки с рукавами и прочие нательные фуфайки трикотажные, из хлопчатобумажной пряжи',
    "tnvedDictionaryValueId" INTEGER DEFAULT 971398495,
    "sizeDimensions" JSONB NOT NULL,

    CONSTRAINT "OzonCatalogTemplate_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OzonCatalogTemplate_marketplaceAccountId_key"
    ON "OzonCatalogTemplate"("marketplaceAccountId");

ALTER TABLE "OzonCatalogTemplate"
    ADD CONSTRAINT "OzonCatalogTemplate_marketplaceAccountId_fkey"
    FOREIGN KEY ("marketplaceAccountId") REFERENCES "MarketplaceAccount"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "OzonPrint" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "marketplaceAccountId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "hashtags" TEXT,
    "mainPhotoUrl" TEXT NOT NULL,
    "extraPhotoUrls" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "price" INTEGER NOT NULL,
    "oldPrice" INTEGER,
    "gender" "EnumTshirtGender" NOT NULL DEFAULT 'UNISEX',
    "patternTags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "unionKey" TEXT NOT NULL,
    "status" "EnumOzonSyncStatus" NOT NULL DEFAULT 'DRAFT',
    "lastError" TEXT,

    CONSTRAINT "OzonPrint_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OzonPrint_unionKey_key" ON "OzonPrint"("unionKey");
CREATE INDEX "OzonPrint_marketplaceAccountId_status_idx"
    ON "OzonPrint"("marketplaceAccountId", "status");

ALTER TABLE "OzonPrint"
    ADD CONSTRAINT "OzonPrint_marketplaceAccountId_fkey"
    FOREIGN KEY ("marketplaceAccountId") REFERENCES "MarketplaceAccount"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "OzonVariant" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "printId" TEXT NOT NULL,
    "colorLabel" TEXT NOT NULL,
    "colorDictionaryValueId" INTEGER NOT NULL,
    "size" "EnumTshirtSize" NOT NULL,
    "offerId" TEXT NOT NULL,
    "priceOverride" INTEGER,
    "status" "EnumOzonSyncStatus" NOT NULL DEFAULT 'DRAFT',
    "ozonProductId" BIGINT,
    "ozonSku" BIGINT,
    "lastError" TEXT,

    CONSTRAINT "OzonVariant_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OzonVariant_offerId_key" ON "OzonVariant"("offerId");
CREATE UNIQUE INDEX "OzonVariant_printId_colorLabel_size_key"
    ON "OzonVariant"("printId", "colorLabel", "size");
CREATE INDEX "OzonVariant_printId_idx" ON "OzonVariant"("printId");

ALTER TABLE "OzonVariant"
    ADD CONSTRAINT "OzonVariant_printId_fkey"
    FOREIGN KEY ("printId") REFERENCES "OzonPrint"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "OzonImportBatch" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "marketplaceAccountId" TEXT NOT NULL,
    "ozonTaskId" TEXT NOT NULL,
    "variantIds" TEXT[] NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'polling',

    CONSTRAINT "OzonImportBatch_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "OzonImportBatch_status_idx" ON "OzonImportBatch"("status");
