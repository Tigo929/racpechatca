-- Create new granular expense category enum
CREATE TYPE "EnumExpenseCategory" AS ENUM (
  'MATERIALS_PHOTO',
  'MATERIALS_TSHIRT',
  'DELIVERY_SUPPLIES',
  'EQUIPMENT',
  'MARKETING',
  'OTHER'
);

-- Add new column with default, backfill from old PHOTO/TSHIRT values, then swap
ALTER TABLE "ExpenseOrder" ADD COLUMN "category_new" "EnumExpenseCategory" NOT NULL
  DEFAULT 'OTHER'::"EnumExpenseCategory";

UPDATE "ExpenseOrder"
SET "category_new" = CASE
  WHEN "category"::text = 'PHOTO'   THEN 'MATERIALS_PHOTO'::"EnumExpenseCategory"
  WHEN "category"::text = 'TSHIRT'  THEN 'MATERIALS_TSHIRT'::"EnumExpenseCategory"
  ELSE                                    'OTHER'::"EnumExpenseCategory"
END;

ALTER TABLE "ExpenseOrder" DROP COLUMN "category";
ALTER TABLE "ExpenseOrder" RENAME COLUMN "category_new" TO "category";
ALTER TABLE "ExpenseOrder" ALTER COLUMN "category" DROP DEFAULT;
