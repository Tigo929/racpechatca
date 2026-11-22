-- Справочник пунктов выдачи Ozon для карты на сайте (OzonPointsService).
CREATE TABLE IF NOT EXISTS "OzonPickupPoint" (
    "id" INTEGER NOT NULL,
    "number" TEXT,
    "name" TEXT,
    "type" TEXT,
    "address" TEXT NOT NULL,
    "search" TEXT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "schedule" TEXT,
    "storageDays" INTEGER,
    "maxWeightG" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "OzonPickupPoint_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "OzonPickupPoint_lat_lng_idx" ON "OzonPickupPoint"("lat", "lng");
