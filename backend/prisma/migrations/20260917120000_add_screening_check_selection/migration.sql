ALTER TABLE "ScreeningCheck" ADD COLUMN "isSelected" BOOLEAN NOT NULL DEFAULT false;

UPDATE "ScreeningCheck"
SET "isSelected" = true
WHERE "resultStatus" <> 'NOT_CHECKED'
   OR EXISTS (
     SELECT 1
     FROM "ScreeningDocument"
     WHERE "ScreeningDocument"."screeningCheckId" = "ScreeningCheck"."id"
   );
