CREATE TYPE "ApprovalDeliveryStatus" AS ENUM ('PENDING', 'SENDING', 'SENT', 'FAILED', 'UNKNOWN');
CREATE TABLE "ApprovalTelegramDelivery" (
  "id" TEXT NOT NULL,
  "approvalId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "requestedById" TEXT NOT NULL,
  "recipient" TEXT NOT NULL,
  "caption" TEXT NOT NULL,
  "image" BYTEA NOT NULL,
  "finalizedAt" TIMESTAMP(3) NOT NULL,
  "status" "ApprovalDeliveryStatus" NOT NULL DEFAULT 'PENDING',
  "claimToken" TEXT,
  "claimedAt" TIMESTAMP(3),
  "sentAt" TIMESTAMP(3),
  "messageId" INTEGER,
  "errorCode" TEXT,
  CONSTRAINT "ApprovalTelegramDelivery_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ApprovalTelegramDelivery_approvalId_fkey" FOREIGN KEY ("approvalId") REFERENCES "PrintApproval"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ApprovalTelegramDelivery_approvalId_key" ON "ApprovalTelegramDelivery"("approvalId");
CREATE UNIQUE INDEX "ApprovalTelegramDelivery_claimToken_key" ON "ApprovalTelegramDelivery"("claimToken");
CREATE INDEX "ApprovalTelegramDelivery_status_createdAt_idx" ON "ApprovalTelegramDelivery"("status", "createdAt");
