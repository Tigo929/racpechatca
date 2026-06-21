-- Per-item free (negotiated) price flag for photo/extra positions.
ALTER TABLE "ItemPhoto" ADD COLUMN "isFreePrice" BOOLEAN NOT NULL DEFAULT false;
