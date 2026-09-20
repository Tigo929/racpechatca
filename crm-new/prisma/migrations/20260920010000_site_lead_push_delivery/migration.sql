CREATE TABLE "LeadPushDelivery" (
  "id" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "subscriptionId" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "claimedUntil" TIMESTAMP(3),
  "claimToken" TEXT,
  "sentAt" TIMESTAMP(3),
  "errorCode" TEXT,
  CONSTRAINT "LeadPushDelivery_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "LeadPushDelivery_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "PushSubscription"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "LeadPushDelivery_orderId_subscriptionId_key" ON "LeadPushDelivery"("orderId", "subscriptionId");
CREATE INDEX "LeadPushDelivery_status_nextAttemptAt_idx" ON "LeadPushDelivery"("status", "nextAttemptAt");
