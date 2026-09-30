ALTER TABLE "KycCase" ADD COLUMN "sourceEnquiryId" TEXT;

WITH first_generated_case AS (
  SELECT DISTINCT ON (e."id")
    e."id" AS "enquiryId",
    h."kycCaseId"
  FROM "Enquiry" e
  JOIN "KycCaseStatusHistory" h
    ON h."tenantId" = e."tenantId"
   AND h."note" = CONCAT('KYC case created from enquiry ', e."enquiryCode")
  ORDER BY e."id", h."createdAt" ASC, h."id" ASC
)
UPDATE "KycCase" k
SET "sourceEnquiryId" = first_generated_case."enquiryId"
FROM first_generated_case
WHERE k."id" = first_generated_case."kycCaseId";

CREATE UNIQUE INDEX "KycCase_sourceEnquiryId_key" ON "KycCase"("sourceEnquiryId");
CREATE INDEX "KycCase_sourceEnquiryId_idx" ON "KycCase"("sourceEnquiryId");

ALTER TABLE "KycCase"
ADD CONSTRAINT "KycCase_sourceEnquiryId_fkey"
FOREIGN KEY ("sourceEnquiryId") REFERENCES "Enquiry"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
