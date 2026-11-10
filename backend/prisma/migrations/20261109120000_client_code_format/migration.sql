-- Client codes become text in the KYC/engagement style: CL-<activation year>-<4 digits>.
-- Any numeric code already assigned is converted using the client's activation (or creation) year.
DROP INDEX IF EXISTS "Client_tenantId_clientCode_key";

ALTER TABLE "Client"
  ALTER COLUMN "clientCode" TYPE TEXT
  USING CASE
    WHEN "clientCode" IS NULL THEN NULL
    ELSE 'CL-' || to_char(COALESCE("activatedAt", "createdAt"), 'YYYY') || '-' || lpad("clientCode"::text, 4, '0')
  END;

CREATE UNIQUE INDEX "Client_tenantId_clientCode_key" ON "Client"("tenantId", "clientCode");
