-- Legal documents register, the company's AI service settings and the AML notice for legal document changes
-- (2026-11-22, Phase 2). Additive only.
-- CreateEnum
CREATE TYPE "ClientLegalDocumentNature" AS ENUM ('COMPANY', 'INDIVIDUAL');

-- CreateEnum
CREATE TYPE "ClientLegalDocumentStatus" AS ENUM ('CURRENT', 'REPLACED', 'DELETED');

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'COMPLIANCE_LEGAL_DOCUMENT_CHANGED';

-- CreateTable
CREATE TABLE "ClientLegalDocument" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "typeKey" TEXT NOT NULL,
    "typeLabel" TEXT NOT NULL,
    "nature" "ClientLegalDocumentNature" NOT NULL,
    "personId" TEXT,
    "documentNumber" TEXT,
    "holderName" TEXT NOT NULL,
    "location" TEXT,
    "issueDate" TIMESTAMP(3),
    "expiryDate" TIMESTAMP(3),
    "notes" TEXT,
    "fileName" TEXT,
    "storagePath" TEXT,
    "mimeType" TEXT,
    "size" INTEGER,
    "status" "ClientLegalDocumentStatus" NOT NULL DEFAULT 'CURRENT',
    "replacesId" TEXT,
    "sourceKycDocumentId" TEXT,
    "readMethod" TEXT,
    "statusReason" TEXT,
    "statusChangedAt" TIMESTAMP(3),
    "statusChangedById" TEXT,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientLegalDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenantAiSetting" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'OPENAI',
    "model" TEXT NOT NULL,
    "apiKeyEncrypted" TEXT NOT NULL,
    "apiKeyLast4" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TenantAiSetting_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ClientLegalDocument_replacesId_key" ON "ClientLegalDocument"("replacesId");

-- CreateIndex
CREATE INDEX "ClientLegalDocument_tenantId_idx" ON "ClientLegalDocument"("tenantId");

-- CreateIndex
CREATE INDEX "ClientLegalDocument_clientId_status_idx" ON "ClientLegalDocument"("clientId", "status");

-- CreateIndex
CREATE INDEX "ClientLegalDocument_personId_idx" ON "ClientLegalDocument"("personId");

-- CreateIndex
CREATE UNIQUE INDEX "TenantAiSetting_tenantId_key" ON "TenantAiSetting"("tenantId");

-- AddForeignKey
ALTER TABLE "ClientLegalDocument" ADD CONSTRAINT "ClientLegalDocument_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientLegalDocument" ADD CONSTRAINT "ClientLegalDocument_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientLegalDocument" ADD CONSTRAINT "ClientLegalDocument_personId_fkey" FOREIGN KEY ("personId") REFERENCES "ClientPerson"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientLegalDocument" ADD CONSTRAINT "ClientLegalDocument_replacesId_fkey" FOREIGN KEY ("replacesId") REFERENCES "ClientLegalDocument"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantAiSetting" ADD CONSTRAINT "TenantAiSetting_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

