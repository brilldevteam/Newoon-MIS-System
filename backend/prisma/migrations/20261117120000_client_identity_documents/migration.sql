-- QID / passport copies uploaded from a person's details on the compliance client page (ClientDocument rows in the
-- "Identity Documents" folder). Additive only: nullable columns and an index.

-- AlterTable
ALTER TABLE "ClientDocument" ADD COLUMN     "documentExpiry" TIMESTAMP(3),
ADD COLUMN     "documentNumber" TEXT,
ADD COLUMN     "identityType" TEXT,
ADD COLUMN     "personKey" TEXT,
ADD COLUMN     "personName" TEXT;

-- CreateIndex
CREATE INDEX "ClientDocument_clientId_personKey_idx" ON "ClientDocument"("clientId", "personKey");

