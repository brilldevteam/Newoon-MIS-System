CREATE TYPE "EnquiryType" AS ENUM (
  'EXISTING_LEGAL_ENTITY',
  'PROPOSED_COMPANY',
  'CURRENT_CLIENT_NEW_SERVICES'
);

CREATE TYPE "EnquiryStatus" AS ENUM (
  'DRAFT',
  'SUBMITTED_TO_AML_SUPERVISOR',
  'RETURNED_TO_BD',
  'READY_FOR_KYC',
  'CONVERTED_TO_KYC',
  'CLOSED'
);

CREATE TABLE "Enquiry" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "enquiryCode" TEXT NOT NULL,
  "enquiryType" "EnquiryType" NOT NULL,
  "status" "EnquiryStatus" NOT NULL DEFAULT 'DRAFT',
  "clientId" TEXT,
  "companyName" TEXT,
  "proposedCompanyName" TEXT,
  "requestedServices" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "keyContactName" TEXT,
  "keyContactEmail" TEXT,
  "keyContactPhone" TEXT,
  "keyContactPosition" TEXT,
  "headOfficeCountry" TEXT,
  "branchCountry" TEXT,
  "areaOfOperation" TEXT,
  "details" JSONB,
  "notes" TEXT,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Enquiry_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EnquiryAttachment" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "enquiryId" TEXT NOT NULL,
  "documentType" TEXT NOT NULL,
  "fileName" TEXT NOT NULL,
  "storagePath" TEXT,
  "mimeType" TEXT,
  "size" INTEGER,
  "createdBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EnquiryAttachment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EnquiryComment" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "enquiryId" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "authorId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EnquiryComment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EnquiryStatusHistory" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "enquiryId" TEXT NOT NULL,
  "fromStatus" "EnquiryStatus",
  "toStatus" "EnquiryStatus" NOT NULL,
  "note" TEXT,
  "changedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EnquiryStatusHistory_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Enquiry_tenantId_enquiryCode_key" ON "Enquiry"("tenantId", "enquiryCode");
CREATE INDEX "Enquiry_tenantId_idx" ON "Enquiry"("tenantId");
CREATE INDEX "Enquiry_clientId_idx" ON "Enquiry"("clientId");
CREATE INDEX "Enquiry_status_idx" ON "Enquiry"("status");
CREATE INDEX "Enquiry_enquiryType_idx" ON "Enquiry"("enquiryType");

CREATE INDEX "EnquiryAttachment_tenantId_idx" ON "EnquiryAttachment"("tenantId");
CREATE INDEX "EnquiryAttachment_enquiryId_idx" ON "EnquiryAttachment"("enquiryId");

CREATE INDEX "EnquiryComment_tenantId_idx" ON "EnquiryComment"("tenantId");
CREATE INDEX "EnquiryComment_enquiryId_idx" ON "EnquiryComment"("enquiryId");
CREATE INDEX "EnquiryComment_authorId_idx" ON "EnquiryComment"("authorId");

CREATE INDEX "EnquiryStatusHistory_tenantId_idx" ON "EnquiryStatusHistory"("tenantId");
CREATE INDEX "EnquiryStatusHistory_enquiryId_idx" ON "EnquiryStatusHistory"("enquiryId");
CREATE INDEX "EnquiryStatusHistory_toStatus_idx" ON "EnquiryStatusHistory"("toStatus");
CREATE INDEX "EnquiryStatusHistory_changedById_idx" ON "EnquiryStatusHistory"("changedById");

ALTER TABLE "Enquiry" ADD CONSTRAINT "Enquiry_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Enquiry" ADD CONSTRAINT "Enquiry_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Enquiry" ADD CONSTRAINT "Enquiry_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "EnquiryAttachment" ADD CONSTRAINT "EnquiryAttachment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EnquiryAttachment" ADD CONSTRAINT "EnquiryAttachment_enquiryId_fkey" FOREIGN KEY ("enquiryId") REFERENCES "Enquiry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "EnquiryComment" ADD CONSTRAINT "EnquiryComment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EnquiryComment" ADD CONSTRAINT "EnquiryComment_enquiryId_fkey" FOREIGN KEY ("enquiryId") REFERENCES "Enquiry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EnquiryComment" ADD CONSTRAINT "EnquiryComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "EnquiryStatusHistory" ADD CONSTRAINT "EnquiryStatusHistory_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EnquiryStatusHistory" ADD CONSTRAINT "EnquiryStatusHistory_enquiryId_fkey" FOREIGN KEY ("enquiryId") REFERENCES "Enquiry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EnquiryStatusHistory" ADD CONSTRAINT "EnquiryStatusHistory_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
