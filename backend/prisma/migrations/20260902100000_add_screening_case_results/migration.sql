CREATE TABLE "ScreeningCaseCheck" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "kycCaseId" TEXT NOT NULL,
  "checkType" "ScreeningCheckType" NOT NULL,
  "resultStatus" "ScreeningResultStatus" NOT NULL DEFAULT 'NOT_CHECKED',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ScreeningCaseCheck_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "ScreeningCaseDocument" ADD COLUMN "screeningCaseCheckId" TEXT;

CREATE UNIQUE INDEX "ScreeningCaseCheck_kycCaseId_checkType_key" ON "ScreeningCaseCheck"("kycCaseId", "checkType");
CREATE INDEX "ScreeningCaseCheck_tenantId_idx" ON "ScreeningCaseCheck"("tenantId");
CREATE INDEX "ScreeningCaseCheck_kycCaseId_idx" ON "ScreeningCaseCheck"("kycCaseId");
CREATE INDEX "ScreeningCaseDocument_screeningCaseCheckId_idx" ON "ScreeningCaseDocument"("screeningCaseCheckId");

ALTER TABLE "ScreeningCaseCheck" ADD CONSTRAINT "ScreeningCaseCheck_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ScreeningCaseCheck" ADD CONSTRAINT "ScreeningCaseCheck_kycCaseId_fkey" FOREIGN KEY ("kycCaseId") REFERENCES "KycCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ScreeningCaseDocument" ADD CONSTRAINT "ScreeningCaseDocument_screeningCaseCheckId_fkey" FOREIGN KEY ("screeningCaseCheckId") REFERENCES "ScreeningCaseCheck"("id") ON DELETE SET NULL ON UPDATE CASCADE;
