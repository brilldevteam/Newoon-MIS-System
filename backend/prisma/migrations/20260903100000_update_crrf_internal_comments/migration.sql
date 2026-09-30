ALTER TABLE "CrrfRecord" ADD COLUMN "internalComment" TEXT;

UPDATE "CrrfRecord"
SET "internalComment" = TRIM(BOTH E'\n' FROM CONCAT_WS(E'\n\n', NULLIF("dmlroComment", ''), NULLIF("mlroComment", '')))
WHERE "internalComment" IS NULL
  AND (NULLIF("dmlroComment", '') IS NOT NULL OR NULLIF("mlroComment", '') IS NOT NULL);
