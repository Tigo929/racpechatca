ALTER TABLE "OrderPhoto"
ADD COLUMN IF NOT EXISTS "techSpecPhotoPaths" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

UPDATE "OrderPhoto"
SET "techSpecPhotoPaths" = ARRAY["techSpecPhotoPath"]
WHERE "techSpecPhotoPath" IS NOT NULL
  AND COALESCE(array_length("techSpecPhotoPaths", 1), 0) = 0;
