-- Migration: salary_architecture
-- Adds executor assignment, per-user salary rates, and full accrual/payment tracking.
-- SAFE: adds nullable columns and new tables, then hardens financial constraints.
-- Apply: prisma migrate deploy  OR  psql ... < migration.sql

-- ── 1. New columns on "User" ──────────────────────────────────────────────────

ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT true;

DO $$
DECLARE
  reset_existing_rates BOOLEAN := false;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'User'
      AND column_name = 'rateBasisPoints'
  ) THEN
    ALTER TABLE "User" ADD COLUMN "rateBasisPoints" INTEGER;
  ELSE
    SELECT is_nullable = 'NO' OR column_default IS NOT NULL
      INTO reset_existing_rates
    FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'User'
      AND column_name = 'rateBasisPoints';

    ALTER TABLE "User"
      ALTER COLUMN "rateBasisPoints" DROP DEFAULT,
      ALTER COLUMN "rateBasisPoints" DROP NOT NULL;

    IF reset_existing_rates THEN
      UPDATE "User"
      SET "rateBasisPoints" = NULL
      WHERE "role" = 'EXECUTOR';
    END IF;
  END IF;
END $$;

DO $$
BEGIN
  ALTER TABLE "User"
    ADD CONSTRAINT "User_rate_basis_points_range"
    CHECK ("rateBasisPoints" IS NULL OR (
      "rateBasisPoints" >= 0 AND "rateBasisPoints" <= 10000
    ));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ── 2. New columns on "OrderPhoto" ───────────────────────────────────────────

ALTER TABLE "OrderPhoto"
  ADD COLUMN IF NOT EXISTS "executorId"   TEXT,
  ADD COLUMN IF NOT EXISTS "completedAt"  TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "clientPaidAt" TIMESTAMP(3);

DO $$
BEGIN
  ALTER TABLE "OrderPhoto"
    ADD CONSTRAINT "OrderPhoto_executorId_fkey"
    FOREIGN KEY ("executorId") REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ── 3. New enum values for "EnumStatus" ──────────────────────────────────────
-- PostgreSQL does not support IF NOT EXISTS for ALTER TYPE ADD VALUE yet (< 14).
-- Wrap in DO blocks to skip if the value already exists.

DO $$ BEGIN
  ALTER TYPE "EnumStatus" ADD VALUE 'READY_FOR_REVIEW';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE "EnumStatus" ADD VALUE 'COMPLETED';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE "EnumStatus" ADD VALUE 'CANCELLED';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── 4. New enum "EnumAccrualStatus" ──────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE "EnumAccrualStatus" AS ENUM (
    'PENDING', 'PARTIALLY_PAID', 'PAID', 'SETTLED', 'REVERSED'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── 5. New table: "SalaryAccrual" ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "SalaryAccrual" (
  "id"              TEXT          NOT NULL,
  "createdAt"       TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "orderId"         TEXT          NOT NULL,
  "executorId"      TEXT          NOT NULL,
  "salaryBase"      INTEGER       NOT NULL,
  "rateBasisPoints" INTEGER       NOT NULL,
  "salaryAmount"    INTEGER       NOT NULL,
  "status"          "EnumAccrualStatus" NOT NULL DEFAULT 'PENDING',
  "paidAmount"      INTEGER       NOT NULL DEFAULT 0,
  CONSTRAINT "SalaryAccrual_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SalaryAccrual_orderId_fkey"
    FOREIGN KEY ("orderId") REFERENCES "OrderPhoto"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "SalaryAccrual_executorId_fkey"
    FOREIGN KEY ("executorId") REFERENCES "User"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE
);

ALTER TABLE "SalaryAccrual"
  DROP CONSTRAINT IF EXISTS "SalaryAccrual_orderId_key";

CREATE UNIQUE INDEX IF NOT EXISTS "SalaryAccrual_orderId_active_unique"
ON "SalaryAccrual" ("orderId")
WHERE "status" != 'REVERSED';

DO $$
BEGIN
  ALTER TABLE "SalaryAccrual"
    ADD CONSTRAINT "SalaryAccrual_salary_base_non_negative"
    CHECK ("salaryBase" >= 0);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "SalaryAccrual"
    ADD CONSTRAINT "SalaryAccrual_salary_amount_non_negative"
    CHECK ("salaryAmount" >= 0);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "SalaryAccrual"
    ADD CONSTRAINT "SalaryAccrual_paid_amount_range"
    CHECK ("paidAmount" >= 0 AND "paidAmount" <= "salaryAmount");
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ── 6. New table: "SalaryPayment" ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "SalaryPayment" (
  "id"         TEXT          NOT NULL,
  "createdAt"  TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"  TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "executorId" TEXT          NOT NULL,
  "paidById"   TEXT          NOT NULL,
  "amount"     INTEGER       NOT NULL,
  "note"       TEXT,
  CONSTRAINT "SalaryPayment_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SalaryPayment_executorId_fkey"
    FOREIGN KEY ("executorId") REFERENCES "User"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "SalaryPayment_paidById_fkey"
    FOREIGN KEY ("paidById") REFERENCES "User"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE
);

ALTER TABLE "SalaryPayment"
  ADD COLUMN IF NOT EXISTS "paidById" TEXT;

ALTER TABLE "SalaryPayment"
  ALTER COLUMN "paidById" SET NOT NULL;

DO $$
BEGIN
  ALTER TABLE "SalaryPayment"
    ADD CONSTRAINT "SalaryPayment_paidById_fkey"
    FOREIGN KEY ("paidById") REFERENCES "User"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "SalaryPayment"
    ADD CONSTRAINT "SalaryPayment_amount_positive"
    CHECK ("amount" > 0);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ── 7. New table: "PaymentAccrualLink" ───────────────────────────────────────

CREATE TABLE IF NOT EXISTS "PaymentAccrualLink" (
  "id"        TEXT          NOT NULL,
  "createdAt" TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "paymentId" TEXT          NOT NULL,
  "accrualId" TEXT          NOT NULL,
  "amount"    INTEGER       NOT NULL,
  CONSTRAINT "PaymentAccrualLink_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PaymentAccrualLink_paymentId_accrualId_key" UNIQUE ("paymentId", "accrualId"),
  CONSTRAINT "PaymentAccrualLink_paymentId_fkey"
    FOREIGN KEY ("paymentId") REFERENCES "SalaryPayment"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "PaymentAccrualLink_accrualId_fkey"
    FOREIGN KEY ("accrualId") REFERENCES "SalaryAccrual"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE
);

DO $$
BEGIN
  ALTER TABLE "PaymentAccrualLink"
    ADD CONSTRAINT "PaymentAccrualLink_amount_positive"
    CHECK ("amount" > 0);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ── 8. New table: "StatusHistory" ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "StatusHistory" (
  "id"         TEXT          NOT NULL,
  "createdAt"  TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "orderId"    TEXT          NOT NULL,
  "fromStatus" TEXT,
  "toStatus"   TEXT          NOT NULL,
  "changedBy"  TEXT          NOT NULL,
  CONSTRAINT "StatusHistory_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "StatusHistory_orderId_fkey"
    FOREIGN KEY ("orderId") REFERENCES "OrderPhoto"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

-- ── 9. New table: "OrderAssignment" ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "OrderAssignment" (
  "id"         TEXT          NOT NULL,
  "createdAt"  TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "orderId"    TEXT          NOT NULL,
  "executorId" TEXT          NOT NULL,
  "assignedBy" TEXT          NOT NULL,
  "note"       TEXT,
  CONSTRAINT "OrderAssignment_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "OrderAssignment_orderId_fkey"
    FOREIGN KEY ("orderId") REFERENCES "OrderPhoto"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

-- ── 10. New table: "UserRateHistory" ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "UserRateHistory" (
  "id"                 TEXT          NOT NULL,
  "createdAt"          TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "userId"             TEXT          NOT NULL,
  "oldRateBasisPoints" INTEGER,
  "newRateBasisPoints" INTEGER       NOT NULL,
  "changedBy"          TEXT          NOT NULL,
  CONSTRAINT "UserRateHistory_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "UserRateHistory_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);
