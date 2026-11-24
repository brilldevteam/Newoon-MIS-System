# Document Intake and Review

Date: 2026-11-24. Release branch: `feature/2026-11-24` (developed as `feature/document-intake-review/2026-11-24`).
Source baseline: document-autofill `28e0003`, with the preceding local KYC-preview UI update retained.

## Delivered Scope

- One multi-file inbox on editable Enquiries and the editable KYC builder.
- Up to 20 PDF/PNG/JPEG/WebP files, each up to 10 MB. Duplicate file selections are ignored in the current inbox.
- Sequential asynchronous reading through the existing authenticated, tenant-scoped readers. Individual failures do not discard other results. Each failed file can be retried or removed.
- Filename-based type suggestions are editable. Detect type first tries the existing local identity reader; recognized identity files do not go to the company reader/provider. If no identity can be read, it tries company extraction under the existing tenant provider policy. This is a suggestion, not a reliable document classifier.
- Source-file preview alongside editable suggestions; on narrow screens the source preview collapses. Sources are linked at file level, not invented page numbers.
- Explicit field selection; conflicting values start unchecked. Person rows and their roles start unchecked. Matching people are identified for review; the existing merge helper only fills empty fields and adds confirmed roles.
- Passport/QID results require an explicit existing-person or new-role selection. Users can explicitly create a shareholder, beneficial-owner row, director or manager where the form supports it; partly completed rows are preserved and duplicate identities in the selected list are refused. Percentages and ownership links are not invented. No automatic UBO designation, screening conclusion, risk rating, review comment or approval is generated.
- Date, option, file and individual percentage checks; existing ownership-total rules remain enforced by the normal workflow.
- Stale field/person reviews are refused rather than applied over a changed form.
- Enquiry checklist uses the existing step-validation function, not a new set of mandatory rules.
- Enquiry files are staged with the draft and uploaded by the existing Save action. KYC files attach through the existing checklist uploader on confirmation; form values still require Save Draft. Generic company documents default to Other supporting document, not a completed CR requirement.

## Preservation Boundary

The inbox does not change the approved KYC preview renderer, diagram renderer, download services, PDF/DOCX templates, Prisma schema, approval rules or backend authorization. Confirmed factual changes naturally appear in the normal preview/export when saved; their layout is unchanged.

No new dependency, environment variable, migration, seed or PM2 process is needed. Existing readers may use the tenant's configured external AI provider; the inbox does not bypass that policy or provider quota. No extracted contents are logged or put into browser localStorage. Object URLs are revoked on closing review.

## Current Limits / Follow-on Work

- This first release is a page-lifetime queue, not a persistent server worker. Keep the page open until review/application is complete. Reload/close and ordinary link navigation warn while unprocessed items remain; browser Back and programmatic route changes are not fully blocked. Successful readings not yet applied do not survive leaving the page.
- Source page/bounding-box references, calibrated confidence scores, field-level acceptance audit records, durable restartable jobs and independent extraction-accuracy benchmarking remain follow-on work. Existing save/upload audits remain in force.
- The underlying reader supports the fields in its current contract. Missing phone/email, unclear nationality, indirect ownership links, UBO confirmation, contact assignment and unsupported details are entered manually. Existing-company enquiries do not acquire new ownership/management fields; those people are prepared in the KYC builder.
- Company suggestions in the inbox target the client company's record. Corporate shareholder CRs can still be read with their existing per-row shortcut; the inbox does not infer which corporate ownership layer a document belongs to.
- Original per-field read shortcuts remain available. This release adds the reviewed inbox without silently changing their previous behavior.
- No staging/server deployment, real-document provider test or Word/PDF layout certification is implied by local synthetic checks.

## Checks

Run from the repository root after installing the locked dependencies:

```sh
npm run build
node frontend/scripts/check-document-intake.cjs
node frontend/scripts/check-document-intake-ui.cjs
node frontend/scripts/check-document-intake-integration.cjs
node frontend/scripts/check-intake-preview-preservation.cjs
node frontend/scripts/check-kyc-preview-diagram.cjs
node backend/scripts/check-document-fill.cjs
```

The browser scripts use synthetic documents/results and a local Chrome install (`CHROMIUM_PATH` overrides its path). Screenshots go to the OS temporary directory. Browser checks cover 1440, 768, 390 and 320 pixels, staging-before-apply, protected conflicts, explicit person selection, one active read at a time and individual retry. The integration check runs the actual enquiry page and API wrappers with mocked HTTP responses, creates a reviewed director, inspects the save/upload payload and verifies the unrelated company/contact remain unchanged.

Before rollout, QA must also test the actual authenticated pages on staging with provider-approved synthetic samples: proposed/existing company, amended/locked/review-only cases, a large ownership tree, long multilingual names, quota/timeouts, unsuccessful attachment upload, changed targets during review and save/refresh persistence. No production client files are required for these checks.
