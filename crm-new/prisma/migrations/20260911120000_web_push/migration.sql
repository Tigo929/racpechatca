-- Web Push: подписки браузеров и VAPID-ключи (генерируются бэкендом).
CREATE TABLE "PushSubscription" (
    "id" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PushSubscription_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PushSubscription_endpoint_key" ON "PushSubscription"("endpoint");
CREATE INDEX "PushSubscription_userId_idx" ON "PushSubscription"("userId");

CREATE TABLE "PushConfig" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "vapidPublicKey" TEXT NOT NULL,
    "vapidPrivateKey" TEXT NOT NULL,
    "vapidSubject" TEXT NOT NULL DEFAULT 'mailto:admin@raspechatkaa.ru',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PushConfig_pkey" PRIMARY KEY ("id")
);
