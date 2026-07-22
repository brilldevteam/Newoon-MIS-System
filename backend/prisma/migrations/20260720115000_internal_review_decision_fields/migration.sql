ALTER TABLE "KycInternalReview" ADD COLUMN "dmlroDecision" "ReviewDecision";
ALTER TABLE "KycInternalReview" ADD COLUMN "dmlroConditions" TEXT;
ALTER TABLE "KycInternalReview" ADD COLUMN "dmlroReason" TEXT;
ALTER TABLE "KycInternalReview" ADD COLUMN "mlroDecision" "ReviewDecision";
ALTER TABLE "KycInternalReview" ADD COLUMN "mlroFinalRiskClassification" "RiskClassification";
ALTER TABLE "KycInternalReview" ADD COLUMN "mlroRiskReasonCategory" "RiskOverrideReason";
ALTER TABLE "KycInternalReview" ADD COLUMN "mlroRiskExplanation" TEXT;
ALTER TABLE "KycInternalReview" ADD COLUMN "mlroConditions" TEXT;
