-- Client allocation and the CEO role (2026-11-22, Phase 3).

-- CreateTable
CREATE TABLE "ClientAllocation" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClientAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ClientAllocation_tenantId_idx" ON "ClientAllocation"("tenantId");

-- CreateIndex
CREATE INDEX "ClientAllocation_userId_idx" ON "ClientAllocation"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ClientAllocation_clientId_userId_key" ON "ClientAllocation"("clientId", "userId");

-- AddForeignKey
ALTER TABLE "ClientAllocation" ADD CONSTRAINT "ClientAllocation_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientAllocation" ADD CONSTRAINT "ClientAllocation_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientAllocation" ADD CONSTRAINT "ClientAllocation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- CEO: read-only access to the client compliance register, KYC, CRRF, screening and enquiries.
INSERT INTO "Role" ("id", "name", "description", "createdAt", "updatedAt")
VALUES (gen_random_uuid()::text, 'CEO', 'Chief Executive Officer: read-only access to compliance clients, KYC, CRRF and screening.', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("name") DO NOTHING;

-- Where an administrator has already saved the access matrix, the new role gets the same read access it has by
-- default; administrators can change it in Access Control. Other roles are not changed.
INSERT INTO "RolePermission" ("id", "roleId", "permissionId")
SELECT gen_random_uuid()::text, r."id", p."id"
FROM "Role" r
JOIN "Permission" p ON p."key" IN ('compliance.view', 'kyc.view', 'crrf.view', 'screening.view', 'enquiries.view')
WHERE r."name" = 'CEO'
  AND EXISTS (
    SELECT 1 FROM "RolePermission" rp JOIN "Permission" c ON c."id" = rp."permissionId" WHERE c."key" = 'access-control.configured'
  )
ON CONFLICT ("roleId", "permissionId") DO NOTHING;

-- Accounting and HR may open the compliance client register, but only the clients allocated to them (and no clients at
-- all until one is allocated), so already-saved matrices get the same view access as the new defaults.
INSERT INTO "RolePermission" ("id", "roleId", "permissionId")
SELECT gen_random_uuid()::text, r."id", p."id"
FROM "Role" r
JOIN "Permission" p ON p."key" = 'compliance.view'
WHERE r."name" IN ('ACCOUNTING_TEAM', 'HR_TEAM')
  AND EXISTS (
    SELECT 1 FROM "RolePermission" rp JOIN "Permission" c ON c."id" = rp."permissionId" WHERE c."key" = 'access-control.configured'
  )
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
