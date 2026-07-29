CREATE TABLE IF NOT EXISTS "GulianOutbox" (
  "id"             TEXT NOT NULL,
  "eventId"        TEXT NOT NULL,
  "eventType"      TEXT NOT NULL DEFAULT 'order.upsert',
  "aggregateId"    TEXT NOT NULL,
  "externalOrderId" TEXT NOT NULL,
  "sourceRevision" INTEGER NOT NULL,
  "payloadJson"    JSONB NOT NULL,
  "status"         TEXT NOT NULL DEFAULT 'pending',
  "attempts"       INTEGER NOT NULL DEFAULT 0,
  "nextAttemptAt"  TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastAttemptAt"  TIMESTAMPTZ(3),
  "deliveredAt"    TIMESTAMPTZ(3),
  "lastError"      TEXT,
  "responseCode"   INTEGER,
  "responseBody"   TEXT,
  "createdAt"      TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GulianOutbox_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "GulianOutbox_eventId_key" ON "GulianOutbox"("eventId");
CREATE INDEX IF NOT EXISTS "GulianOutbox_status_next_idx" ON "GulianOutbox"("status","nextAttemptAt");
CREATE INDEX IF NOT EXISTS "GulianOutbox_aggregateId_idx" ON "GulianOutbox"("aggregateId");