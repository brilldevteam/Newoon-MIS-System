-- Client-level entity and person records (2026-11-22). Additive only: existing clients are filled from their current
-- KYC (including earlier client-page edits) the first time their page is opened, or on activation / re-KYC approval.
-- CreateEnum
CREATE TYPE "ClientPartyType" AS ENUM ('INDIVIDUAL', 'CORPORATE');

-- CreateEnum
CREATE TYPE "ClientPersonRoleType" AS ENUM ('SHAREHOLDER', 'UBO', 'DIRECTOR', 'MANAGER', 'SECRETARY', 'SEF', 'AUTHORISED_SIGNATORY', 'KEY_CONTACT', 'CEO', 'CFO', 'COO', 'MANAGING_DIRECTOR', 'GENERAL_MANAGER', 'CHAIRMAN', 'OTHER');

-- AlterTable
ALTER TABLE "ClientDocument" ADD COLUMN     "personId" TEXT;

-- CreateTable
CREATE TABLE "ClientEntityProfile" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "legalName" TEXT,
    "legalForm" TEXT,
    "commercialRegistrationNo" TEXT,
    "crExpiryDate" TIMESTAMP(3),
    "dateOfIncorporation" TIMESTAMP(3),
    "countryOfIncorporation" TEXT,
    "placeOfIncorporation" TEXT,
    "registeredOfficeAddress" TEXT,
    "shareCapital" TEXT,
    "taxIdentificationNo" TEXT,
    "poBox" TEXT,
    "telephone" TEXT,
    "email" TEXT,
    "website" TEXT,
    "businessNature" TEXT,
    "relatedIndustry" TEXT,
    "licenseActivities" TEXT,
    "prospectiveServices" TEXT,
    "financialYearEnd" TEXT,
    "auditorName" TEXT,
    "sourceKycCaseId" TEXT,
    "fieldEditedAt" JSONB NOT NULL DEFAULT '{}',
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientEntityProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientPerson" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "partyType" "ClientPartyType" NOT NULL DEFAULT 'INDIVIDUAL',
    "title" TEXT,
    "fullName" TEXT NOT NULL,
    "nationality" TEXT,
    "dualCitizenship" BOOLEAN,
    "otherNationality" TEXT,
    "dateOfBirth" TIMESTAMP(3),
    "address" TEXT,
    "telephone" TEXT,
    "email" TEXT,
    "isPep" BOOLEAN,
    "pepDetails" TEXT,
    "representedEntity" TEXT,
    "qidNumber" TEXT,
    "qidExpiry" TIMESTAMP(3),
    "nationalAddressExpiry" TIMESTAMP(3),
    "registrationNumber" TEXT,
    "linkedClientName" TEXT,
    "legacyIdentity" TEXT,
    "fieldEditedAt" JSONB NOT NULL DEFAULT '{}',
    "archivedAt" TIMESTAMP(3),
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientPerson_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientPersonRole" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "role" "ClientPersonRoleType" NOT NULL,
    "title" TEXT NOT NULL DEFAULT '',
    "percentage" DECIMAL(5,2),
    "viaPersonId" TEXT,
    "sourceSection" TEXT,
    "sourceRowId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientPersonRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientPersonPassport" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "passportNumber" TEXT NOT NULL,
    "issuingCountry" TEXT,
    "expiryDate" TIMESTAMP(3),
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientPersonPassport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ClientEntityProfile_clientId_key" ON "ClientEntityProfile"("clientId");

-- CreateIndex
CREATE INDEX "ClientEntityProfile_tenantId_idx" ON "ClientEntityProfile"("tenantId");

-- CreateIndex
CREATE INDEX "ClientPerson_tenantId_idx" ON "ClientPerson"("tenantId");

-- CreateIndex
CREATE INDEX "ClientPerson_clientId_idx" ON "ClientPerson"("clientId");

-- CreateIndex
CREATE INDEX "ClientPersonRole_tenantId_idx" ON "ClientPersonRole"("tenantId");

-- CreateIndex
CREATE INDEX "ClientPersonRole_viaPersonId_idx" ON "ClientPersonRole"("viaPersonId");

-- CreateIndex
CREATE UNIQUE INDEX "ClientPersonRole_personId_role_title_key" ON "ClientPersonRole"("personId", "role", "title");

-- CreateIndex
CREATE INDEX "ClientPersonPassport_tenantId_idx" ON "ClientPersonPassport"("tenantId");

-- CreateIndex
CREATE INDEX "ClientPersonPassport_personId_idx" ON "ClientPersonPassport"("personId");

-- CreateIndex
CREATE INDEX "ClientDocument_personId_idx" ON "ClientDocument"("personId");

-- AddForeignKey
ALTER TABLE "ClientDocument" ADD CONSTRAINT "ClientDocument_personId_fkey" FOREIGN KEY ("personId") REFERENCES "ClientPerson"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientEntityProfile" ADD CONSTRAINT "ClientEntityProfile_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientEntityProfile" ADD CONSTRAINT "ClientEntityProfile_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientPerson" ADD CONSTRAINT "ClientPerson_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientPerson" ADD CONSTRAINT "ClientPerson_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientPersonRole" ADD CONSTRAINT "ClientPersonRole_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientPersonRole" ADD CONSTRAINT "ClientPersonRole_personId_fkey" FOREIGN KEY ("personId") REFERENCES "ClientPerson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientPersonRole" ADD CONSTRAINT "ClientPersonRole_viaPersonId_fkey" FOREIGN KEY ("viaPersonId") REFERENCES "ClientPerson"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientPersonPassport" ADD CONSTRAINT "ClientPersonPassport_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientPersonPassport" ADD CONSTRAINT "ClientPersonPassport_personId_fkey" FOREIGN KEY ("personId") REFERENCES "ClientPerson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

