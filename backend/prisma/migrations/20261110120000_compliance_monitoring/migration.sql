-- CreateEnum
CREATE TYPE "ClientScreeningResult" AS ENUM ('PENDING', 'CLEAR', 'REVIEW', 'ALERT');

-- CreateEnum
CREATE TYPE "ClientRiskChangeStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ClientReviewStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ClientReviewOutcome" AS ENUM ('NO_CHANGE', 'RISK_CHANGE_REQUESTED', 'EXIT_RECOMMENDED');

-- CreateEnum
CREATE TYPE "ClientExpiryDocumentType" AS ENUM ('PASSPORT', 'QID', 'CR', 'TRADE_LICENSE', 'COMPUTER_CARD', 'OTHER');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'COMPLIANCE_RISK_CHANGE_REQUESTED';
ALTER TYPE "NotificationType" ADD VALUE 'COMPLIANCE_RISK_CHANGE_DECIDED';
ALTER TYPE "NotificationType" ADD VALUE 'COMPLIANCE_REVIEW_DUE';
ALTER TYPE "NotificationType" ADD VALUE 'COMPLIANCE_DOCUMENT_EXPIRING';
ALTER TYPE "NotificationType" ADD VALUE 'COMPLIANCE_SCREENING_ALERT';

-- AlterEnum
ALTER TYPE "ClientDocumentCategory" ADD VALUE 'SCREENING';

-- AlterTable
ALTER TABLE "ClientDocument" ADD COLUMN     "screeningId" TEXT;

-- AlterTable
ALTER TABLE "Notification" ADD COLUMN     "clientId" TEXT;

-- CreateTable
CREATE TABLE "ClientScreening" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "reviewId" TEXT,
    "screenedAt" TIMESTAMP(3) NOT NULL,
    "scope" TEXT,
    "listsChecked" TEXT[],
    "result" "ClientScreeningResult" NOT NULL,
    "summary" TEXT NOT NULL,
    "performedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientScreening_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientRiskChange" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "previousRisk" "RiskClassification",
    "proposedRisk" "RiskClassification" NOT NULL,
    "previousCdd" "DueDiligenceType",
    "proposedCdd" "DueDiligenceType",
    "reasonCategory" "RiskOverrideReason" NOT NULL,
    "explanation" TEXT NOT NULL,
    "status" "ClientRiskChangeStatus" NOT NULL DEFAULT 'PENDING',
    "requestedById" TEXT,
    "decidedById" TEXT,
    "decisionNote" TEXT,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientRiskChange_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientReview" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "status" "ClientReviewStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "dueDate" TIMESTAMP(3),
    "riskAtStart" "RiskClassification",
    "outcome" "ClientReviewOutcome",
    "findings" TEXT,
    "riskChangeId" TEXT,
    "startedById" TEXT,
    "completedById" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientExpiryItem" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "documentType" "ClientExpiryDocumentType" NOT NULL,
    "documentLabel" TEXT,
    "holderName" TEXT NOT NULL,
    "holderRole" TEXT,
    "documentNumber" TEXT,
    "expiryDate" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientExpiryItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ComplianceReminder" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "milestone" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ComplianceReminder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ClientScreening_tenantId_idx" ON "ClientScreening"("tenantId");

-- CreateIndex
CREATE INDEX "ClientScreening_clientId_screenedAt_idx" ON "ClientScreening"("clientId", "screenedAt");

-- CreateIndex
CREATE INDEX "ClientRiskChange_tenantId_status_idx" ON "ClientRiskChange"("tenantId", "status");

-- CreateIndex
CREATE INDEX "ClientRiskChange_clientId_idx" ON "ClientRiskChange"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "ClientReview_riskChangeId_key" ON "ClientReview"("riskChangeId");

-- CreateIndex
CREATE INDEX "ClientReview_tenantId_status_idx" ON "ClientReview"("tenantId", "status");

-- CreateIndex
CREATE INDEX "ClientReview_clientId_idx" ON "ClientReview"("clientId");

-- CreateIndex
CREATE INDEX "ClientExpiryItem_tenantId_expiryDate_idx" ON "ClientExpiryItem"("tenantId", "expiryDate");

-- CreateIndex
CREATE INDEX "ClientExpiryItem_clientId_idx" ON "ClientExpiryItem"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "ComplianceReminder_tenantId_kind_entityId_milestone_key" ON "ComplianceReminder"("tenantId", "kind", "entityId", "milestone");

-- CreateIndex
CREATE INDEX "ClientDocument_screeningId_idx" ON "ClientDocument"("screeningId");

-- CreateIndex
CREATE INDEX "Notification_clientId_idx" ON "Notification"("clientId");

-- AddForeignKey
ALTER TABLE "ClientDocument" ADD CONSTRAINT "ClientDocument_screeningId_fkey" FOREIGN KEY ("screeningId") REFERENCES "ClientScreening"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientScreening" ADD CONSTRAINT "ClientScreening_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientScreening" ADD CONSTRAINT "ClientScreening_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientScreening" ADD CONSTRAINT "ClientScreening_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "ClientReview"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientScreening" ADD CONSTRAINT "ClientScreening_performedById_fkey" FOREIGN KEY ("performedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientRiskChange" ADD CONSTRAINT "ClientRiskChange_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientRiskChange" ADD CONSTRAINT "ClientRiskChange_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientRiskChange" ADD CONSTRAINT "ClientRiskChange_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientRiskChange" ADD CONSTRAINT "ClientRiskChange_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientReview" ADD CONSTRAINT "ClientReview_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientReview" ADD CONSTRAINT "ClientReview_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientReview" ADD CONSTRAINT "ClientReview_riskChangeId_fkey" FOREIGN KEY ("riskChangeId") REFERENCES "ClientRiskChange"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientReview" ADD CONSTRAINT "ClientReview_startedById_fkey" FOREIGN KEY ("startedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientReview" ADD CONSTRAINT "ClientReview_completedById_fkey" FOREIGN KEY ("completedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientExpiryItem" ADD CONSTRAINT "ClientExpiryItem_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientExpiryItem" ADD CONSTRAINT "ClientExpiryItem_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComplianceReminder" ADD CONSTRAINT "ComplianceReminder_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

