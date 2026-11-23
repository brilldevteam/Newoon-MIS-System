-- The client page's CDD tab is now called EDD (business request 2026-11-22). Default folders cannot be renamed in
-- the application, so rename the default "cdd" folder here. Only rows still carrying the original wording change.
UPDATE "ClientDocumentSection"
SET "title" = 'EDD Documents',
    "description" = 'Enhanced due diligence evidence for this client.',
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "key" = 'cdd'
  AND "isSystem" = true
  AND "title" = 'CDD Documents';
