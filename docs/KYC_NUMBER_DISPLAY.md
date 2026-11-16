# KYC Number Display

Preliminary preview and PDF show the assigned KYC number beside the date. Enquiry previews/downloads read the linked case; before case creation the header says Not assigned. No number is allocated just to print an enquiry.

Current KYC serialization uses the case number for preliminary data and Section A reference. Direct KYC downloads invoke the existing missing-reference backfill, just as opening the form already did. Both PDF and DOCX use that reference. Archived preliminary exports use the archived number or archived Section A reference, never overwrite the original snapshot, and never substitute the current amended content.

No migration or numbering algorithm change. Existing downloaded/generated files are not rewritten: generate a fresh download after deploying. Verify after build with `node backend/scripts/check-preliminary-number.cjs` and `node backend/scripts/check-preliminary-review.cjs`. Synthetic HTML/PDF and DOCX-package checks do not establish Word layout quality or live database behavior.
