-- CreateTable
CREATE TABLE "ExpenseOrder" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "category" "EnumProductCategory" NOT NULL,
    "amount" INTEGER NOT NULL,
    "note" TEXT,
    "createdById" TEXT NOT NULL,

    CONSTRAINT "ExpenseOrder_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "ExpenseOrder" ADD CONSTRAINT "ExpenseOrder_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
