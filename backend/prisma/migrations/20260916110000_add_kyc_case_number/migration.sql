ALTER TABLE "KycCase" ADD COLUMN "kycNumber" TEXT;

WITH ranked_cases AS (
  SELECT
    "id",
    EXTRACT(YEAR FROM "createdAt")::INT AS "caseYear",
    ROW_NUMBER() OVER (
      PARTITION BY "tenantId", EXTRACT(YEAR FROM "createdAt")::INT
      ORDER BY "createdAt" ASC, "id" ASC
    ) AS "caseSequence"
  FROM "KycCase"
)
UPDATE "KycCase"
SET "kycNumber" = FORMAT('KYC-%s-%s', ranked_cases."caseYear", LPAD(ranked_cases."caseSequence"::TEXT, 4, '0'))
FROM ranked_cases
WHERE "KycCase"."id" = ranked_cases."id";

ALTER TABLE "KycCase" ALTER COLUMN "kycNumber" SET NOT NULL;

CREATE UNIQUE INDEX "KycCase_tenantId_kycNumber_key" ON "KycCase"("tenantId", "kycNumber");
