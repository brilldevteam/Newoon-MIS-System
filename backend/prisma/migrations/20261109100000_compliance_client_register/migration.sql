-- CreateEnum
CREATE TYPE "ClientJurisdiction" AS ENUM ('QFC', 'MOCI', 'QFZ', 'OTHER');

-- CreateEnum
CREATE TYPE "ClientEngagementStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- AlterTable
ALTER TABLE "Client" ADD COLUMN     "activatedAt" TIMESTAMP(3),
ADD COLUMN     "address" TEXT,
ADD COLUMN     "cddType" "DueDiligenceType",
ADD COLUMN     "clientCode" INTEGER,
ADD COLUMN     "email" TEXT,
ADD COLUMN     "jurisdiction" "ClientJurisdiction",
ADD COLUMN     "lastReviewDate" TIMESTAMP(3),
ADD COLUMN     "nextReviewDate" TIMESTAMP(3),
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "riskLevel" "RiskClassification",
ADD COLUMN     "statusReason" TEXT;

-- CreateTable
CREATE TABLE "ClientEngagement" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "kycCaseId" TEXT,
    "engagementNumber" TEXT NOT NULL,
    "serviceName" TEXT NOT NULL,
    "description" TEXT,
    "status" "ClientEngagementStatus" NOT NULL DEFAULT 'PENDING',
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientEngagement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ClientEngagement_kycCaseId_key" ON "ClientEngagement"("kycCaseId");

-- CreateIndex
CREATE INDEX "ClientEngagement_tenantId_idx" ON "ClientEngagement"("tenantId");

-- CreateIndex
CREATE INDEX "ClientEngagement_clientId_idx" ON "ClientEngagement"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "ClientEngagement_tenantId_engagementNumber_key" ON "ClientEngagement"("tenantId", "engagementNumber");

-- CreateIndex
CREATE INDEX "Client_tenantId_status_idx" ON "Client"("tenantId", "status");

-- CreateIndex
CREATE INDEX "Client_nextReviewDate_idx" ON "Client"("nextReviewDate");

-- CreateIndex
CREATE UNIQUE INDEX "Client_tenantId_clientCode_key" ON "Client"("tenantId", "clientCode");

-- AddForeignKey
ALTER TABLE "ClientEngagement" ADD CONSTRAINT "ClientEngagement_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientEngagement" ADD CONSTRAINT "ClientEngagement_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientEngagement" ADD CONSTRAINT "ClientEngagement_kycCaseId_fkey" FOREIGN KEY ("kycCaseId") REFERENCES "KycCase"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientEngagement" ADD CONSTRAINT "ClientEngagement_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Access-control catalog for the new Compliance Clients area. When the role matrix has already been saved,
-- grant the same defaults the code uses for unconfigured installations; administrators can change them afterwards.
INSERT INTO "Permission" ("id", "key", "description", "createdAt", "updatedAt")
VALUES
  (md5(random()::text || clock_timestamp()::text)::uuid::text, 'compliance.view', 'View Compliance Clients', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (md5(random()::text || clock_timestamp()::text)::uuid::text, 'compliance.edit', 'Edit Compliance Clients', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;

INSERT INTO "RolePermission" ("id", "roleId", "permissionId")
SELECT md5(random()::text || clock_timestamp()::text || r."id" || p."id")::uuid::text, r."id", p."id"
FROM (VALUES
  ('COMPANY_ADMIN', 'compliance.view'), ('COMPANY_ADMIN', 'compliance.edit'),
  ('AML_TEAM', 'compliance.view'), ('AML_TEAM', 'compliance.edit'),
  ('AML_SUPERVISOR', 'compliance.view'), ('AML_SUPERVISOR', 'compliance.edit'),
  ('DMLRO', 'compliance.view'), ('DMLRO', 'compliance.edit'),
  ('MLRO', 'compliance.view'), ('MLRO', 'compliance.edit'),
  ('SEF', 'compliance.view'),
  ('OPERATING_TEAM', 'compliance.view')
) AS grants("roleName", "permissionKey")
JOIN "Role" r ON r."name" = grants."roleName"
JOIN "Permission" p ON p."key" = grants."permissionKey"
WHERE EXISTS (
  SELECT 1 FROM "RolePermission" rp
  JOIN "Permission" marker ON marker."id" = rp."permissionId"
  WHERE marker."key" = 'access-control.configured'
)
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
