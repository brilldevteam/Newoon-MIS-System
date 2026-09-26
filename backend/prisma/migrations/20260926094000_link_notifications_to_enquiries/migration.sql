ALTER TABLE "Notification" ADD COLUMN IF NOT EXISTS "enquiryId" TEXT;
CREATE INDEX IF NOT EXISTS "Notification_enquiryId_idx" ON "Notification"("enquiryId");
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_enquiryId_fkey" FOREIGN KEY ("enquiryId") REFERENCES "Enquiry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
