-- Performance indexes for OrderPhoto (most queried fields)
CREATE INDEX CONCURRENTLY IF NOT EXISTS "OrderPhoto_status_idx"
  ON "OrderPhoto"("status");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "OrderPhoto_executorId_idx"
  ON "OrderPhoto"("executorId");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "OrderPhoto_createdAt_idx"
  ON "OrderPhoto"("createdAt");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "OrderPhoto_productCategory_idx"
  ON "OrderPhoto"("productCategory");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "OrderPhoto_status_productCategory_idx"
  ON "OrderPhoto"("status", "productCategory");

-- Performance indexes for SalaryAccrual (salary FIFO lookups)
CREATE INDEX CONCURRENTLY IF NOT EXISTS "SalaryAccrual_executorId_status_idx"
  ON "SalaryAccrual"("executorId", "status");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "SalaryAccrual_orderId_status_idx"
  ON "SalaryAccrual"("orderId", "status");
