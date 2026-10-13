ALTER TABLE "KycForm" ADD COLUMN "fullKycStarted" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "KycGeneratedDocument" ADD COLUMN "formRevision" INTEGER;
-- Older versions used version > 1 to switch preliminary cases to the full form.
UPDATE "KycForm" SET "fullKycStarted" = true WHERE "version" > 1;

CREATE TABLE "KycFormRevision" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "kycFormId" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "snapshot" JSONB NOT NULL,
  "reason" TEXT NOT NULL,
  "createdBy" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "KycFormRevision_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "KycFormRevision_kycFormId_fkey" FOREIGN KEY ("kycFormId") REFERENCES "KycForm"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "KycFormRevision_kycFormId_version_key" ON "KycFormRevision"("kycFormId", "version");
CREATE INDEX "KycFormRevision_tenantId_kycFormId_idx" ON "KycFormRevision"("tenantId", "kycFormId");

CREATE TABLE "KycRevisionFile" (
  "id" TEXT NOT NULL,
  "revisionId" TEXT NOT NULL,
  "sourceDocumentId" TEXT NOT NULL,
  "fileName" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "content" BYTEA NOT NULL,
  CONSTRAINT "KycRevisionFile_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "KycRevisionFile_revisionId_fkey" FOREIGN KEY ("revisionId") REFERENCES "KycFormRevision"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "KycRevisionFile_revisionId_idx" ON "KycRevisionFile"("revisionId");
