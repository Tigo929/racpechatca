CREATE TABLE "LocalAgentCredential" (
  "id" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "name" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "lastUsedAt" TIMESTAMP(3),
  CONSTRAINT "LocalAgentCredential_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "LocalAgentCredential_name_key"
  ON "LocalAgentCredential"("name");
CREATE UNIQUE INDEX "LocalAgentCredential_tokenHash_key"
  ON "LocalAgentCredential"("tokenHash");

INSERT INTO "LocalAgentCredential" (
  "id", "name", "tokenHash", "isActive"
) VALUES (
  '0216e643-8f5f-4caf-8f85-5e85807012fa',
  'owner-laptop',
  'cb84d82929e0bdc7399f6dc4f725163ba1cf9a777d1c9f0b2cd4a12aabad03b7',
  true
);
