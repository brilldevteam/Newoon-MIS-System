-- CreateEnum
CREATE TYPE "KycFormSectionKey" AS ENUM ('GENERAL_COMPANY', 'OWNERSHIP', 'MANAGEMENT', 'COMPLIANCE_RISK', 'COMMUNICATION_PERSON', 'REQUIRED_DOCUMENTS', 'CLIENT_DECLARATION');

-- CreateEnum
CREATE TYPE "KycGeneratedDocumentType" AS ENUM ('DOCX', 'PDF');

-- CreateEnum
CREATE TYPE "RiskClassification" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "DueDiligenceType" AS ENUM ('SIMPLIFIED', 'REGULAR', 'ENHANCED');

-- CreateTable
CREATE TABLE "KycForm" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "kycCaseId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "isLocked" BOOLEAN NOT NULL DEFAULT false,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdBy" TEXT NOT NULL,
    "updatedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KycForm_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KycSectionData" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "kycCaseId" TEXT NOT NULL,
    "kycFormId" TEXT NOT NULL,
    "sectionKey" "KycFormSectionKey" NOT NULL,
    "data" JSONB NOT NULL,
    "createdBy" TEXT NOT NULL,
    "updatedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KycSectionData_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KycShareholder" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "kycCaseId" TEXT NOT NULL,
    "kycFormId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "nationality" TEXT,
    "dateOfBirth" TIMESTAMP(3),
    "identityNumber" TEXT,
    "ownershipPercentage" DECIMAL(5,2),
    "residenceAddress" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdBy" TEXT NOT NULL,
    "updatedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KycShareholder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KycUbo" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "kycCaseId" TEXT NOT NULL,
    "kycFormId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "nationality" TEXT,
    "dateOfBirth" TIMESTAMP(3),
    "identityNumber" TEXT,
    "ownershipPercentage" DECIMAL(5,2),
    "residenceAddress" TEXT,
    "notes" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdBy" TEXT NOT NULL,
    "updatedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KycUbo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KycManager" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "kycCaseId" TEXT NOT NULL,
    "kycFormId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "entityName" TEXT,
    "nationalityAndAddress" TEXT,
    "dateOfBirth" TIMESTAMP(3),
    "identityNumber" TEXT,
    "position" TEXT,
    "isAuthorizedSignatory" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdBy" TEXT NOT NULL,
    "updatedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KycManager_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KycRequiredDocument" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "kycCaseId" TEXT NOT NULL,
    "kycFormId" TEXT NOT NULL,
    "documentType" TEXT NOT NULL,
    "isRequired" BOOLEAN NOT NULL DEFAULT true,
    "isProvided" BOOLEAN NOT NULL DEFAULT false,
    "fileName" TEXT,
    "storagePath" TEXT,
    "mimeType" TEXT,
    "size" INTEGER,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdBy" TEXT NOT NULL,
    "updatedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KycRequiredDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KycInternalReview" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "kycCaseId" TEXT NOT NULL,
    "kycFormId" TEXT NOT NULL,
    "amlAccuracyChecked" BOOLEAN NOT NULL DEFAULT false,
    "amlClarificationFindings" TEXT,
    "riskClassification" "RiskClassification",
    "dueDiligenceType" "DueDiligenceType",
    "amlName" TEXT,
    "amlSignatureFileName" TEXT,
    "amlDate" TIMESTAMP(3),
    "dmlroName" TEXT,
    "dmlroSignatureFileName" TEXT,
    "dmlroDate" TIMESTAMP(3),
    "dmlroComments" TEXT,
    "mlroName" TEXT,
    "mlroSignatureFileName" TEXT,
    "mlroDate" TIMESTAMP(3),
    "mlroComments" TEXT,
    "createdBy" TEXT NOT NULL,
    "updatedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KycInternalReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KycGeneratedDocument" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "kycCaseId" TEXT NOT NULL,
    "kycFormId" TEXT NOT NULL,
    "documentType" "KycGeneratedDocumentType" NOT NULL,
    "version" INTEGER NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "content" BYTEA NOT NULL,
    "createdBy" TEXT NOT NULL,
    "updatedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KycGeneratedDocument_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "KycForm_kycCaseId_key" ON "KycForm"("kycCaseId");
CREATE INDEX "KycForm_tenantId_idx" ON "KycForm"("tenantId");
CREATE INDEX "KycForm_kycCaseId_idx" ON "KycForm"("kycCaseId");
CREATE UNIQUE INDEX "KycSectionData_kycFormId_sectionKey_key" ON "KycSectionData"("kycFormId", "sectionKey");
CREATE INDEX "KycSectionData_tenantId_idx" ON "KycSectionData"("tenantId");
CREATE INDEX "KycSectionData_kycCaseId_idx" ON "KycSectionData"("kycCaseId");
CREATE INDEX "KycShareholder_tenantId_idx" ON "KycShareholder"("tenantId");
CREATE INDEX "KycShareholder_kycCaseId_idx" ON "KycShareholder"("kycCaseId");
CREATE INDEX "KycShareholder_kycFormId_idx" ON "KycShareholder"("kycFormId");
CREATE INDEX "KycUbo_tenantId_idx" ON "KycUbo"("tenantId");
CREATE INDEX "KycUbo_kycCaseId_idx" ON "KycUbo"("kycCaseId");
CREATE INDEX "KycUbo_kycFormId_idx" ON "KycUbo"("kycFormId");
CREATE INDEX "KycManager_tenantId_idx" ON "KycManager"("tenantId");
CREATE INDEX "KycManager_kycCaseId_idx" ON "KycManager"("kycCaseId");
CREATE INDEX "KycManager_kycFormId_idx" ON "KycManager"("kycFormId");
CREATE INDEX "KycRequiredDocument_tenantId_idx" ON "KycRequiredDocument"("tenantId");
CREATE INDEX "KycRequiredDocument_kycCaseId_idx" ON "KycRequiredDocument"("kycCaseId");
CREATE INDEX "KycRequiredDocument_kycFormId_idx" ON "KycRequiredDocument"("kycFormId");
CREATE UNIQUE INDEX "KycInternalReview_kycCaseId_key" ON "KycInternalReview"("kycCaseId");
CREATE UNIQUE INDEX "KycInternalReview_kycFormId_key" ON "KycInternalReview"("kycFormId");
CREATE INDEX "KycInternalReview_tenantId_idx" ON "KycInternalReview"("tenantId");
CREATE UNIQUE INDEX "KycGeneratedDocument_kycFormId_documentType_version_key" ON "KycGeneratedDocument"("kycFormId", "documentType", "version");
CREATE INDEX "KycGeneratedDocument_tenantId_idx" ON "KycGeneratedDocument"("tenantId");
CREATE INDEX "KycGeneratedDocument_kycCaseId_idx" ON "KycGeneratedDocument"("kycCaseId");

-- AddForeignKey
ALTER TABLE "KycForm" ADD CONSTRAINT "KycForm_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "KycForm" ADD CONSTRAINT "KycForm_kycCaseId_fkey" FOREIGN KEY ("kycCaseId") REFERENCES "KycCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "KycForm" ADD CONSTRAINT "KycForm_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "KycForm" ADD CONSTRAINT "KycForm_updatedBy_fkey" FOREIGN KEY ("updatedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "KycSectionData" ADD CONSTRAINT "KycSectionData_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "KycSectionData" ADD CONSTRAINT "KycSectionData_kycCaseId_fkey" FOREIGN KEY ("kycCaseId") REFERENCES "KycCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "KycSectionData" ADD CONSTRAINT "KycSectionData_kycFormId_fkey" FOREIGN KEY ("kycFormId") REFERENCES "KycForm"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "KycShareholder" ADD CONSTRAINT "KycShareholder_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "KycShareholder" ADD CONSTRAINT "KycShareholder_kycCaseId_fkey" FOREIGN KEY ("kycCaseId") REFERENCES "KycCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "KycShareholder" ADD CONSTRAINT "KycShareholder_kycFormId_fkey" FOREIGN KEY ("kycFormId") REFERENCES "KycForm"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "KycUbo" ADD CONSTRAINT "KycUbo_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "KycUbo" ADD CONSTRAINT "KycUbo_kycCaseId_fkey" FOREIGN KEY ("kycCaseId") REFERENCES "KycCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "KycUbo" ADD CONSTRAINT "KycUbo_kycFormId_fkey" FOREIGN KEY ("kycFormId") REFERENCES "KycForm"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "KycManager" ADD CONSTRAINT "KycManager_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "KycManager" ADD CONSTRAINT "KycManager_kycCaseId_fkey" FOREIGN KEY ("kycCaseId") REFERENCES "KycCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "KycManager" ADD CONSTRAINT "KycManager_kycFormId_fkey" FOREIGN KEY ("kycFormId") REFERENCES "KycForm"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "KycRequiredDocument" ADD CONSTRAINT "KycRequiredDocument_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "KycRequiredDocument" ADD CONSTRAINT "KycRequiredDocument_kycCaseId_fkey" FOREIGN KEY ("kycCaseId") REFERENCES "KycCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "KycRequiredDocument" ADD CONSTRAINT "KycRequiredDocument_kycFormId_fkey" FOREIGN KEY ("kycFormId") REFERENCES "KycForm"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "KycInternalReview" ADD CONSTRAINT "KycInternalReview_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "KycInternalReview" ADD CONSTRAINT "KycInternalReview_kycCaseId_fkey" FOREIGN KEY ("kycCaseId") REFERENCES "KycCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "KycInternalReview" ADD CONSTRAINT "KycInternalReview_kycFormId_fkey" FOREIGN KEY ("kycFormId") REFERENCES "KycForm"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "KycGeneratedDocument" ADD CONSTRAINT "KycGeneratedDocument_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "KycGeneratedDocument" ADD CONSTRAINT "KycGeneratedDocument_kycCaseId_fkey" FOREIGN KEY ("kycCaseId") REFERENCES "KycCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "KycGeneratedDocument" ADD CONSTRAINT "KycGeneratedDocument_kycFormId_fkey" FOREIGN KEY ("kycFormId") REFERENCES "KycForm"("id") ON DELETE CASCADE ON UPDATE CASCADE;
