# Automatic Document Intake

Updated: 2026-11-24. Release branch: `feature/2026-11-24`.
The previous reviewed inbox was released as `fd30e01`; this update removes its review/confirmation screen at the user's request.

## Behavior

- The inbox presents attachments as responsive document boxes (one column on mobile, multiple columns on wider screens). The separate Enquiry Details to complete panel is removed; existing Next/Submit validation remains unchanged.
- Upload multiple supported documents into the inbox on an editable Enquiry or KYC form. Up to 20 PDF/PNG/JPEG/WebP files, each up to 10 MB; existing type and file validation remain enforced.
- Files read one at a time through the existing authorized, tenant-scoped readers. Extracted values automatically fill valid, empty draft fields. No review dialog, field checkboxes or Apply button remains.
- Unknown files try the local identity reader first, then the company's existing document reader/provider if no identity is found. Filename type suggestions can be changed when incorrect.
- When a residency permit contains both QID and passport details, populate both numbers and the correct expiry for each. Printed-label results also fill the draft even without MRZ check digits. Date checks still reject invalid dates. The reader's existing serial-number exclusion is unchanged.
- The Enquiry Details step no longer duplicates company CR/proposed-company document upload controls. Company documents use the global inbox; per-person passport/QID uploads remain. Their shared reader fills both identities whenever both are supplied by extraction, and completes missing secondary expiry only when the existing secondary number matches.
- Identity files match an existing person by either identity number, then by a unique non-contradictory name. A blank key contact is the default only when no other person has been entered. Ambiguous files show an inline Assign to person selector, not a review screen. Users can explicitly choose a new supported role; roles are not guessed from passports.
- Recognized nationality values fill empty nationality fields using the target form's options. Unsupported codes/values are left for manual entry rather than creating invalid choices.
- Company documents fill supported company fields and supported named-party roles. Existing values, ownership constraints and partly completed rows are preserved. Unknown roles and invalid percentages are left for manual entry. UBO status, ownership links, risk, screening, review comments and approvals are not inferred.
- Existing values are never silently replaced. Each file shows processing state and a short note about fields left for manual entry. Failed application can retry cached extraction rather than rereading the file; failed extraction retries only that file.
- Files awaiting person assignment can automatically resume if a later company document introduces a matching person.
- Enquiry files remain staged until the normal Save/Update uploads them. KYC files attach through the existing authorized checklist uploader, and form changes still need Save Draft. Neither flow automatically submits or approves a case.

## Preserved Behavior

KYC preview/diagram rendering, PDF/DOCX templates, download services, database schema, tenant restrictions and review/approval rules are unchanged by this update. New factual data naturally appears in the usual preview/export after saving; the layout is unchanged. Individual identity and corporate-party per-row read shortcuts remain available.

No new dependency, environment variable, migration, seed or process is required. The existing tenant AI/provider policy still applies to company document reading. No extracted records are logged or stored in browser localStorage.

## Limits

- Processing is page-lifetime, not a durable server job. Keep the form open until processing finishes, then save. Reload/close and ordinary link navigation warn while items remain pending; browser Back/programmatic route changes are not fully blocked.
- Source-page references, calibrated confidence scores, field-level acceptance auditing, durable retry workers and independent OCR/provider accuracy benchmarks remain future work.
- The inbox's company extraction targets the client company. Corporate shareholder CRs retain their existing per-row reader; corporate layers/indirect ownership links remain manual.
- Existing-company enquiries do not gain ownership/management fields. Those parties are prepared in the KYC form. A contact form without a DOB field does not acquire one through extraction.
- Missing/unsupported fields and ambiguous matches remain editable in the normal form. No claim is made that every document or every field can be extracted reliably.
- Uploaded files for which extraction fails remain in the current inbox; use the normal attachment controls if retaining an unreadable file without extracting it.

## Verification

Run from the repository root:

```sh
npm run build
node frontend/scripts/check-document-intake.cjs
node frontend/scripts/check-person-document-fill.cjs
node frontend/scripts/check-document-intake-ui.cjs
node frontend/scripts/check-document-intake-integration.cjs
node frontend/scripts/check-intake-preview-preservation.cjs
node frontend/scripts/check-kyc-preview-diagram.cjs
node backend/scripts/check-document-fill.cjs
```

Browser checks use synthetic files/results and local Chrome (`CHROMIUM_PATH` overrides the default executable), at 1440, 768, 390 and 320 pixels. The actual enquiry-page integration uses mocked HTTP responses and checks both identity numbers/expiries, nationality, ID-type controls and the existing save/upload payload, with no review interaction or export call. These are not live-provider OCR accuracy tests or server-deployment evidence.

Before rollout, QA should test authorized synthetic samples on staging, ambiguous names, multiple roles for one person, blank contacts, reversed upload order, invalid dates, failed uploads, manual edits during processing, locked/review-only cases and save/refresh persistence.
