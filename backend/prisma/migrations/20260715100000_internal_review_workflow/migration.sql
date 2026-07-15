-- ExtendEnum
ALTER TYPE "KycCaseStatus" ADD VALUE 'SUPERVISOR_REVIEW_PENDING';
ALTER TYPE "KycCaseStatus" ADD VALUE 'SUPERVISOR_REVIEW_IN_PROGRESS';
ALTER TYPE "KycCaseStatus" ADD VALUE 'SUPERVISOR_ADDITIONAL_INFORMATION_REQUIRED';
ALTER TYPE "KycCaseStatus" ADD VALUE 'SUPERVISOR_REVIEW_COMPLETED';
ALTER TYPE "KycCaseStatus" ADD VALUE 'DMLRO_REVIEW_PENDING';
ALTER TYPE "KycCaseStatus" ADD VALUE 'DMLRO_REVIEW_IN_PROGRESS';
ALTER TYPE "KycCaseStatus" ADD VALUE 'DMLRO_ADDITIONAL_INFORMATION_REQUIRED';
ALTER TYPE "KycCaseStatus" ADD VALUE 'DMLRO_REVIEW_COMPLETED';
ALTER TYPE "KycCaseStatus" ADD VALUE 'MLRO_REVIEW_PENDING';
ALTER TYPE "KycCaseStatus" ADD VALUE 'MLRO_REVIEW_IN_PROGRESS';
ALTER TYPE "KycCaseStatus" ADD VALUE 'MLRO_ADDITIONAL_INFORMATION_REQUIRED';
ALTER TYPE "KycCaseStatus" ADD VALUE 'MLRO_APPROVED';
ALTER TYPE "KycCaseStatus" ADD VALUE 'MLRO_APPROVED_WITH_CONDITIONS';
ALTER TYPE "KycCaseStatus" ADD VALUE 'MLRO_REJECTED';
ALTER TYPE "KycCaseStatus" ADD VALUE 'FINAL_SIGNATURES_PENDING';
ALTER TYPE "KycCaseStatus" ADD VALUE 'FINAL_DOCUMENTS_PENDING';
ALTER TYPE "KycCaseStatus" ADD VALUE 'KYC_FINAL_APPROVED';
ALTER TYPE "KycCaseStatus" ADD VALUE 'CLIENT_ACTIVATION_PENDING';
ALTER TYPE "KycCaseStatus" ADD VALUE 'CLIENT_ACTIVE';
ALTER TYPE "KycCaseStatus" ADD VALUE 'CLIENT_REJECTED';
ALTER TYPE "KycCaseStatus" ADD VALUE 'CLIENT_ON_HOLD';

ALTER TYPE "NotificationType" ADD VALUE 'SUPERVISOR_TASK_ASSIGNED';
ALTER TYPE "NotificationType" ADD VALUE 'SUPERVISOR_REVIEW_COMPLETED';
ALTER TYPE "NotificationType" ADD VALUE 'DMLRO_TASK_ASSIGNED';
ALTER TYPE "NotificationType" ADD VALUE 'DMLRO_REVIEW_COMPLETED';
ALTER TYPE "NotificationType" ADD VALUE 'MLRO_TASK_ASSIGNED';
ALTER TYPE "NotificationType" ADD VALUE 'ADDITIONAL_INFORMATION_REQUESTED';
ALTER TYPE "NotificationType" ADD VALUE 'SIGNED_KYC_UPLOADED';
ALTER TYPE "NotificationType" ADD VALUE 'RISK_CLASSIFICATION_CHANGED';
ALTER TYPE "NotificationType" ADD VALUE 'MLRO_APPROVAL_COMPLETED';
ALTER TYPE "NotificationType" ADD VALUE 'MLRO_APPROVAL_WITH_CONDITIONS';
ALTER TYPE "NotificationType" ADD VALUE 'MLRO_REJECTION';
ALTER TYPE "NotificationType" ADD VALUE 'CLIENT_READY_FOR_ACTIVATION';
ALTER TYPE "NotificationType" ADD VALUE 'CLIENT_ACTIVATED';

-- CreateEnum
CREATE TYPE "ReviewStage" AS ENUM ('SUPERVISOR', 'DMLRO', 'MLRO');
CREATE TYPE "ReviewTaskStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'PAUSED', 'COMPLETED', 'RETURNED', 'CANCELLED');
CREATE TYPE "ReviewSubmissionStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'RETURNED', 'REOPENED');
CREATE TYPE "ReviewDecision" AS ENUM ('APPROVE', 'APPROVE_WITH_CONDITIONS', 'REJECT', 'REQUEST_ADDITIONAL_INFORMATION', 'RETURN_TO_SUPERVISOR', 'RETURN_TO_DMLRO');
CREATE TYPE "RiskOverrideReason" AS ENUM ('PEP_IDENTIFIED', 'SANCTIONS_FINDING', 'ADVERSE_MEDIA', 'OWNERSHIP_COMPLEXITY', 'COUNTRY_RISK', 'INDUSTRY_RISK', 'SOURCE_OF_FUNDS_CONCERN', 'ENHANCED_MONITORING_REQUIRED', 'PROFESSIONAL_JUDGEMENT', 'OTHER');
CREATE TYPE "SignedKycDocumentStage" AS ENUM ('DMLRO_SIGNED_KYC', 'MLRO_SIGNED_KYC', 'FINAL_SIGNED_KYC');
CREATE TYPE "ReviewCommentType" AS ENUM ('FORMAL', 'CONFIDENTIAL');
CREATE TYPE "ConfidentialVisibilityScope" AS ENUM ('SUPERVISOR_DMLRO_MLRO', 'DMLRO_MLRO', 'MLRO_ONLY');

-- CreateTable
CREATE TABLE "InternalReviewTask" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "kycCaseId" TEXT NOT NULL,
    "stage" "ReviewStage" NOT NULL,
    "status" "ReviewTaskStatus" NOT NULL DEFAULT 'PENDING',
    "assignedToId" TEXT,
    "dueDate" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdBy" TEXT NOT NULL,
    "updatedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InternalReviewTask_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InternalReviewSubmission" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "kycCaseId" TEXT NOT NULL,
    "stage" "ReviewStage" NOT NULL,
    "status" "ReviewSubmissionStatus" NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "data" JSONB NOT NULL,
    "formalComments" TEXT,
    "confidentialNotes" TEXT,
    "submittedById" TEXT,
    "submittedAt" TIMESTAMP(3),
    "isLocked" BOOLEAN NOT NULL DEFAULT false,
    "createdBy" TEXT NOT NULL,
    "updatedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InternalReviewSubmission_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InternalReviewVersion" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "kycCaseId" TEXT NOT NULL,
    "stage" "ReviewStage" NOT NULL,
    "version" INTEGER NOT NULL,
    "snapshot" JSONB NOT NULL,
    "submittedBy" TEXT,
    "submittedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InternalReviewVersion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ReviewerComment" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "kycCaseId" TEXT NOT NULL,
    "stage" "ReviewStage" NOT NULL,
    "type" "ReviewCommentType" NOT NULL,
    "visibilityScope" "ConfidentialVisibilityScope",
    "body" TEXT NOT NULL,
    "isLocked" BOOLEAN NOT NULL DEFAULT false,
    "authorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReviewerComment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SignedKycDocument" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "kycCaseId" TEXT NOT NULL,
    "reviewStage" "SignedKycDocumentStage" NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileType" TEXT,
    "fileSize" INTEGER,
    "storageKey" TEXT,
    "documentVersion" INTEGER NOT NULL DEFAULT 1,
    "signatureType" TEXT,
    "comments" TEXT,
    "activeVersion" BOOLEAN NOT NULL DEFAULT true,
    "uploadedById" TEXT,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SignedKycDocument_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RiskReclassification" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "kycCaseId" TEXT NOT NULL,
    "calculatedRisk" "RiskClassification",
    "supervisorRisk" "RiskClassification",
    "dmlroRisk" "RiskClassification",
    "previousRisk" "RiskClassification",
    "newRisk" "RiskClassification" NOT NULL,
    "reasonCategory" "RiskOverrideReason" NOT NULL,
    "explanation" TEXT NOT NULL,
    "effectiveDate" TIMESTAMP(3) NOT NULL,
    "changedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RiskReclassification_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ClientActivationChecklist" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "kycCaseId" TEXT NOT NULL,
    "checklist" JSONB NOT NULL,
    "isReady" BOOLEAN NOT NULL DEFAULT false,
    "blockingIssues" JSONB,
    "completedAt" TIMESTAMP(3),
    "createdBy" TEXT NOT NULL,
    "updatedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientActivationChecklist_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "InternalReviewTask_kycCaseId_stage_status_key" ON "InternalReviewTask"("kycCaseId", "stage", "status");
CREATE INDEX "InternalReviewTask_tenantId_idx" ON "InternalReviewTask"("tenantId");
CREATE INDEX "InternalReviewTask_kycCaseId_idx" ON "InternalReviewTask"("kycCaseId");
CREATE INDEX "InternalReviewTask_stage_idx" ON "InternalReviewTask"("stage");
CREATE INDEX "InternalReviewTask_assignedToId_idx" ON "InternalReviewTask"("assignedToId");

CREATE UNIQUE INDEX "InternalReviewSubmission_kycCaseId_stage_key" ON "InternalReviewSubmission"("kycCaseId", "stage");
CREATE INDEX "InternalReviewSubmission_tenantId_idx" ON "InternalReviewSubmission"("tenantId");
CREATE INDEX "InternalReviewSubmission_kycCaseId_idx" ON "InternalReviewSubmission"("kycCaseId");
CREATE INDEX "InternalReviewSubmission_stage_idx" ON "InternalReviewSubmission"("stage");
CREATE INDEX "InternalReviewSubmission_submittedById_idx" ON "InternalReviewSubmission"("submittedById");

CREATE UNIQUE INDEX "InternalReviewVersion_kycCaseId_stage_version_key" ON "InternalReviewVersion"("kycCaseId", "stage", "version");
CREATE INDEX "InternalReviewVersion_tenantId_idx" ON "InternalReviewVersion"("tenantId");
CREATE INDEX "InternalReviewVersion_kycCaseId_idx" ON "InternalReviewVersion"("kycCaseId");

CREATE INDEX "ReviewerComment_tenantId_idx" ON "ReviewerComment"("tenantId");
CREATE INDEX "ReviewerComment_kycCaseId_idx" ON "ReviewerComment"("kycCaseId");
CREATE INDEX "ReviewerComment_stage_idx" ON "ReviewerComment"("stage");
CREATE INDEX "ReviewerComment_type_idx" ON "ReviewerComment"("type");

CREATE UNIQUE INDEX "SignedKycDocument_kycCaseId_reviewStage_documentVersion_key" ON "SignedKycDocument"("kycCaseId", "reviewStage", "documentVersion");
CREATE INDEX "SignedKycDocument_tenantId_idx" ON "SignedKycDocument"("tenantId");
CREATE INDEX "SignedKycDocument_kycCaseId_idx" ON "SignedKycDocument"("kycCaseId");
CREATE INDEX "SignedKycDocument_reviewStage_idx" ON "SignedKycDocument"("reviewStage");

CREATE INDEX "RiskReclassification_tenantId_idx" ON "RiskReclassification"("tenantId");
CREATE INDEX "RiskReclassification_kycCaseId_idx" ON "RiskReclassification"("kycCaseId");

CREATE UNIQUE INDEX "ClientActivationChecklist_kycCaseId_key" ON "ClientActivationChecklist"("kycCaseId");
CREATE INDEX "ClientActivationChecklist_tenantId_idx" ON "ClientActivationChecklist"("tenantId");

-- AddForeignKey
ALTER TABLE "InternalReviewTask" ADD CONSTRAINT "InternalReviewTask_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InternalReviewTask" ADD CONSTRAINT "InternalReviewTask_kycCaseId_fkey" FOREIGN KEY ("kycCaseId") REFERENCES "KycCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InternalReviewTask" ADD CONSTRAINT "InternalReviewTask_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "InternalReviewSubmission" ADD CONSTRAINT "InternalReviewSubmission_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InternalReviewSubmission" ADD CONSTRAINT "InternalReviewSubmission_kycCaseId_fkey" FOREIGN KEY ("kycCaseId") REFERENCES "KycCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InternalReviewSubmission" ADD CONSTRAINT "InternalReviewSubmission_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "InternalReviewVersion" ADD CONSTRAINT "InternalReviewVersion_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InternalReviewVersion" ADD CONSTRAINT "InternalReviewVersion_kycCaseId_fkey" FOREIGN KEY ("kycCaseId") REFERENCES "KycCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ReviewerComment" ADD CONSTRAINT "ReviewerComment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReviewerComment" ADD CONSTRAINT "ReviewerComment_kycCaseId_fkey" FOREIGN KEY ("kycCaseId") REFERENCES "KycCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReviewerComment" ADD CONSTRAINT "ReviewerComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SignedKycDocument" ADD CONSTRAINT "SignedKycDocument_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SignedKycDocument" ADD CONSTRAINT "SignedKycDocument_kycCaseId_fkey" FOREIGN KEY ("kycCaseId") REFERENCES "KycCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SignedKycDocument" ADD CONSTRAINT "SignedKycDocument_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "RiskReclassification" ADD CONSTRAINT "RiskReclassification_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RiskReclassification" ADD CONSTRAINT "RiskReclassification_kycCaseId_fkey" FOREIGN KEY ("kycCaseId") REFERENCES "KycCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RiskReclassification" ADD CONSTRAINT "RiskReclassification_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ClientActivationChecklist" ADD CONSTRAINT "ClientActivationChecklist_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ClientActivationChecklist" ADD CONSTRAINT "ClientActivationChecklist_kycCaseId_fkey" FOREIGN KEY ("kycCaseId") REFERENCES "KycCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;
