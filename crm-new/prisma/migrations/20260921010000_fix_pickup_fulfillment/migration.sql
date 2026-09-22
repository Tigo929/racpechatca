-- A pickup cannot have a client shipment. Preserve all financial amounts and
-- the old transition history; append a trace of this corrective transition.
WITH repaired AS (
  UPDATE "OrderPhoto"
  SET "status" = 'READY', "statusChangedAt" = CURRENT_TIMESTAMP,
      "shipmentRemindersSent" = 0, "updatedAt" = CURRENT_TIMESTAMP
  WHERE "deliveryMethod" = 'PICKUP' AND "status" = 'SHIPMENT_CREATED'
  RETURNING "id"
)
INSERT INTO "StatusHistory" ("id", "orderId", "fromStatus", "toStatus", "changedBy", "createdAt")
SELECT gen_random_uuid()::text, "id", 'SHIPMENT_CREATED', 'READY',
       'system:pickup-fulfillment-fix', CURRENT_TIMESTAMP FROM repaired;
