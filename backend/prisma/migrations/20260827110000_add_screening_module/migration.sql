CREATE TYPE "ScreeningEntityType" AS ENUM ('CLIENT_COMPANY', 'SHAREHOLDER', 'UBO', 'MANAGER', 'MANUAL');

CREATE TYPE "ScreeningCheckType" AS ENUM ('NCTC', 'UN', 'OFAC', 'EU', 'PPO_LIST', 'WORLD_CHECK', 'GOOGLE', 'OTHER');

CREATE TYPE "ScreeningResultStatus" AS ENUM ('NOT_CHECKED', 'CLEAR', 'POTENTIAL_MATCH', 'CONFIRMED_MATCH');

CREATE TYPE "ScreeningRecordStatus" AS ENUM ('DRAFT', 'COMPLETED');

CREATE TABLE "ScreeningRecord" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "kycCaseId" TEXT NOT NULL,
  "clientId" TEXT,
  "entityType" "ScreeningEntityType" NOT NULL,
  "entitySourceId" TEXT,
  "entityName" TEXT NOT NULL,
  "identifier" TEXT,
  "country" TEXT,
  "status" "ScreeningRecordStatus" NOT NULL DEFAULT 'DRAFT',
  "remarks" TEXT,
  "createdById" TEXT,
  "updatedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ScreeningRecord_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ScreeningCheck" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "screeningRecordId" TEXT NOT NULL,
  "checkType" "ScreeningCheckType" NOT NULL,
  "resultStatus" "ScreeningResultStatus" NOT NULL DEFAULT 'NOT_CHECKED',
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ScreeningCheck_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ScreeningDocument" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "screeningRecordId" TEXT NOT NULL,
  "screeningCheckId" TEXT,
  "documentType" TEXT NOT NULL,
  "fileName" TEXT NOT NULL,
  "storagePath" TEXT,
  "mimeType" TEXT,
  "size" INTEGER,
  "uploadedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ScreeningDocument_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ScreeningRecord_tenantId_idx" ON "ScreeningRecord"("tenantId");
CREATE INDEX "ScreeningRecord_kycCaseId_idx" ON "ScreeningRecord"("kycCaseId");
CREATE INDEX "ScreeningRecord_clientId_idx" ON "ScreeningRecord"("clientId");
CREATE INDEX "ScreeningRecord_status_idx" ON "ScreeningRecord"("status");

CREATE UNIQUE INDEX "ScreeningCheck_screeningRecordId_checkType_key" ON "ScreeningCheck"("screeningRecordId", "checkType");
CREATE INDEX "ScreeningCheck_tenantId_idx" ON "ScreeningCheck"("tenantId");
CREATE INDEX "ScreeningCheck_screeningRecordId_idx" ON "ScreeningCheck"("screeningRecordId");

CREATE INDEX "ScreeningDocument_tenantId_idx" ON "ScreeningDocument"("tenantId");
CREATE INDEX "ScreeningDocument_screeningRecordId_idx" ON "ScreeningDocument"("screeningRecordId");
CREATE INDEX "ScreeningDocument_screeningCheckId_idx" ON "ScreeningDocument"("screeningCheckId");

ALTER TABLE "ScreeningRecord" ADD CONSTRAINT "ScreeningRecord_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ScreeningRecord" ADD CONSTRAINT "ScreeningRecord_kycCaseId_fkey" FOREIGN KEY ("kycCaseId") REFERENCES "KycCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ScreeningRecord" ADD CONSTRAINT "ScreeningRecord_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ScreeningCheck" ADD CONSTRAINT "ScreeningCheck_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ScreeningCheck" ADD CONSTRAINT "ScreeningCheck_screeningRecordId_fkey" FOREIGN KEY ("screeningRecordId") REFERENCES "ScreeningRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ScreeningDocument" ADD CONSTRAINT "ScreeningDocument_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ScreeningDocument" ADD CONSTRAINT "ScreeningDocument_screeningRecordId_fkey" FOREIGN KEY ("screeningRecordId") REFERENCES "ScreeningRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ScreeningDocument" ADD CONSTRAINT "ScreeningDocument_screeningCheckId_fkey" FOREIGN KEY ("screeningCheckId") REFERENCES "ScreeningCheck"("id") ON DELETE SET NULL ON UPDATE CASCADE;
