ALTER TYPE "ReviewDecision" ADD VALUE IF NOT EXISTS 'DMLRO_FINAL_APPROVE';

UPDATE "Client"
SET "status" = 'ACTIVE'
WHERE "status" = 'PROSPECT'
  AND (
    NOT EXISTS (SELECT 1 FROM "Enquiry" WHERE "Enquiry"."clientId" = "Client"."id")
    OR EXISTS (
      SELECT 1
      FROM "KycCase"
      WHERE "KycCase"."clientId" = "Client"."id"
        AND "KycCase"."status" = 'CLIENT_ACTIVE'
    )
  );
