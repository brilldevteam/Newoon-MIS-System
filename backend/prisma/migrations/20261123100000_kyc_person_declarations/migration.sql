-- Per-person title, dual citizenship and PEP answers on KYC manager rows (2026-11-23, Phase 5). Additive only;
-- shareholders, beneficial owners and the key contact keep these in their JSON rows.
ALTER TABLE "KycManager" ADD COLUMN "title" TEXT,
ADD COLUMN "dualCitizenship" TEXT,
ADD COLUMN "otherNationality" TEXT,
ADD COLUMN "isPep" TEXT,
ADD COLUMN "pepDetails" TEXT;
