-- Compliance client inline edits (ClientProfileOverride), re-KYC cases (KycCase.purpose / previousKycCaseId,
-- Client.currentKycCaseId), separate QID / passport numbers and expiry dates on KYC managers, and expiry records
-- kept in step with those dates (ClientExpiryItem.sourceKey). Additive only: no existing data is changed; existing
-- combined "QID / Passport" values stay in identityNumber.

-- CreateEnum
CREATE TYPE "KycCasePurpose" AS ENUM ('ONBOARDING', 'REKYC');

-- AlterTable
ALTER TABLE "Client" ADD COLUMN     "currentKycCaseId" TEXT;

-- AlterTable
ALTER TABLE "ClientExpiryItem" ADD COLUMN     "sourceKey" TEXT;

-- AlterTable
ALTER TABLE "KycCase" ADD COLUMN     "previousKycCaseId" TEXT,
ADD COLUMN     "purpose" "KycCasePurpose" NOT NULL DEFAULT 'ONBOARDING';

-- AlterTable
ALTER TABLE "KycManager" ADD COLUMN     "passportExpiry" TIMESTAMP(3),
ADD COLUMN     "passportNumber" TEXT,
ADD COLUMN     "qidExpiry" TIMESTAMP(3),
ADD COLUMN     "qidNumber" TEXT;

-- CreateTable
CREATE TABLE "ClientProfileOverride" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "kycCaseId" TEXT NOT NULL,
    "section" TEXT NOT NULL,
    "rowId" TEXT NOT NULL DEFAULT '',
    "rowLabel" TEXT,
    "field" TEXT NOT NULL,
    "value" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientProfileOverride_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ClientProfileOverride_tenantId_idx" ON "ClientProfileOverride"("tenantId");

-- CreateIndex
CREATE INDEX "ClientProfileOverride_clientId_idx" ON "ClientProfileOverride"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "ClientProfileOverride_kycCaseId_section_rowId_field_key" ON "ClientProfileOverride"("kycCaseId", "section", "rowId", "field");

-- CreateIndex
CREATE UNIQUE INDEX "ClientExpiryItem_clientId_sourceKey_key" ON "ClientExpiryItem"("clientId", "sourceKey");

-- AddForeignKey
ALTER TABLE "ClientProfileOverride" ADD CONSTRAINT "ClientProfileOverride_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientProfileOverride" ADD CONSTRAINT "ClientProfileOverride_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientProfileOverride" ADD CONSTRAINT "ClientProfileOverride_kycCaseId_fkey" FOREIGN KEY ("kycCaseId") REFERENCES "KycCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KycCase" ADD CONSTRAINT "KycCase_previousKycCaseId_fkey" FOREIGN KEY ("previousKycCaseId") REFERENCES "KycCase"("id") ON DELETE SET NULL ON UPDATE CASCADE;

