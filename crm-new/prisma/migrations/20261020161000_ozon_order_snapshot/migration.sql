CREATE TABLE "OzonOrderSnapshot" (
    "cacheKey" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "response" JSONB NOT NULL,
    "refreshedAt" TIMESTAMP(3) NOT NULL,
    "staleUntil" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OzonOrderSnapshot_pkey" PRIMARY KEY ("cacheKey")
);

CREATE INDEX "OzonOrderSnapshot_clientId_idx"
    ON "OzonOrderSnapshot"("clientId");

CREATE INDEX "OzonOrderSnapshot_staleUntil_idx"
    ON "OzonOrderSnapshot"("staleUntil");
