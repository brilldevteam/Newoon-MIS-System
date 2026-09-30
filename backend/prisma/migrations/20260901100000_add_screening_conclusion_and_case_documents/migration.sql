CREATE TYPE "ScreeningConclusionStatus" AS ENUM ('CLEAR', 'NOT_CLEAR', 'NO_SANCTION_FOUND', 'SANCTION_FOUND');

ALTER TABLE "ScreeningRecord" ADD COLUMN "conclusionStatus" "ScreeningConclusionStatus";

CREATE TABLE "ScreeningCaseDocument" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "kycCaseId" TEXT NOT NULL,
  "checkType" "ScreeningCheckType" NOT NULL,
  "documentType" TEXT NOT NULL,
  "fileName" TEXT NOT NULL,
  "storagePath" TEXT,
  "mimeType" TEXT,
  "size" INTEGER,
  "uploadedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ScreeningCaseDocument_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ScreeningCaseDocument_tenantId_idx" ON "ScreeningCaseDocument"("tenantId");
CREATE INDEX "ScreeningCaseDocument_kycCaseId_idx" ON "ScreeningCaseDocument"("kycCaseId");
CREATE INDEX "ScreeningCaseDocument_checkType_idx" ON "ScreeningCaseDocument"("checkType");

ALTER TABLE "ScreeningCaseDocument" ADD CONSTRAINT "ScreeningCaseDocument_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ScreeningCaseDocument" ADD CONSTRAINT "ScreeningCaseDocument_kycCaseId_fkey" FOREIGN KEY ("kycCaseId") REFERENCES "KycCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;
