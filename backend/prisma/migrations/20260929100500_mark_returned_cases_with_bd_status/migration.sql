UPDATE "KycCase" AS k
SET "status" = 'RETURNED_TO_BD'
FROM "Enquiry" AS e
WHERE k."sourceEnquiryId" = e."id"
  AND e."status" = 'RETURNED_TO_BD'
  AND k."status" = 'SUPERVISOR_ADDITIONAL_INFORMATION_REQUIRED';
