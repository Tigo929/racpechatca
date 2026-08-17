-- Себестоимость и расходы продавца для юнит-экономики. Одни на весь кабинет:
-- товар один тип (футболка с принтом), заготовка и нанесение одинаковы.
-- Тарифы площадки здесь не хранятся — читаются из API Ozon по каждому товару.

CREATE TABLE "OzonUnitEconomics" (
    "id" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "marketplaceAccountId" TEXT NOT NULL,
    "blankCost" INTEGER NOT NULL DEFAULT 260,
    "printCost" INTEGER NOT NULL DEFAULT 70,
    "packagingCost" INTEGER NOT NULL DEFAULT 0,
    "otherCost" INTEGER NOT NULL DEFAULT 0,
    "returnRateBasisPoints" INTEGER NOT NULL DEFAULT 0,
    "advertisingBasisPoints" INTEGER NOT NULL DEFAULT 0,
    "taxBasisPoints" INTEGER NOT NULL DEFAULT 600,
    "taxBase" TEXT NOT NULL DEFAULT 'income',
    "logisticsMode" TEXT NOT NULL DEFAULT 'max',
    "commissionOverrideBasisPoints" INTEGER,

    CONSTRAINT "OzonUnitEconomics_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OzonUnitEconomics_marketplaceAccountId_key"
    ON "OzonUnitEconomics"("marketplaceAccountId");

ALTER TABLE "OzonUnitEconomics"
    ADD CONSTRAINT "OzonUnitEconomics_marketplaceAccountId_fkey"
    FOREIGN KEY ("marketplaceAccountId") REFERENCES "MarketplaceAccount"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
