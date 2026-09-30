CREATE TYPE "CrrfRiskRating" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

CREATE TABLE "CrrfRecord" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "kycCaseId" TEXT NOT NULL,
  "riskRating" "CrrfRiskRating",
  "dmlroComment" TEXT,
  "mlroComment" TEXT,
  "createdById" TEXT,
  "updatedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CrrfRecord_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CrrfDocument" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "crrfRecordId" TEXT NOT NULL,
  "fileName" TEXT NOT NULL,
  "storagePath" TEXT,
  "mimeType" TEXT,
  "size" INTEGER,
  "uploadedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CrrfDocument_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CrrfRecord_kycCaseId_key" ON "CrrfRecord"("kycCaseId");
CREATE INDEX "CrrfRecord_tenantId_idx" ON "CrrfRecord"("tenantId");
CREATE INDEX "CrrfRecord_kycCaseId_idx" ON "CrrfRecord"("kycCaseId");
CREATE INDEX "CrrfRecord_riskRating_idx" ON "CrrfRecord"("riskRating");
CREATE INDEX "CrrfDocument_tenantId_idx" ON "CrrfDocument"("tenantId");
CREATE INDEX "CrrfDocument_crrfRecordId_idx" ON "CrrfDocument"("crrfRecordId");

ALTER TABLE "CrrfRecord" ADD CONSTRAINT "CrrfRecord_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CrrfRecord" ADD CONSTRAINT "CrrfRecord_kycCaseId_fkey" FOREIGN KEY ("kycCaseId") REFERENCES "KycCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CrrfDocument" ADD CONSTRAINT "CrrfDocument_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CrrfDocument" ADD CONSTRAINT "CrrfDocument_crrfRecordId_fkey" FOREIGN KEY ("crrfRecordId") REFERENCES "CrrfRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;
