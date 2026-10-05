# Newoon MIS Application Change Log Report

This report tracks the Newoon MIS application from the initial project commit onward. Every new feature, bug fix, UI update, workflow change, database migration, and deployment-relevant change should be added here before the work is considered complete.

## Maintenance Rules

- Keep newest entries at the top.
- Add a dated entry for every completed change set.
- Include the affected module, summary, changed files, database migrations, verification, branch, commit, and deployment notes.
- Update `CLIENT_DELIVERY_FEATURE_REGISTER.md` when a completed change adds or materially changes a client-facing feature.
- If a change is not pushed yet, write `Commit: Not pushed yet`.
- If testing could not be completed, state the reason clearly.

## Entry Template

```md
## YYYY-MM-DD - Short Change Title

Module:
- Area or workflow affected

Summary:
- What changed
- Why it changed

Changed Files:
- path/to/file

Database Changes:
- Migration file, schema change, or `None`

Verification:
- Command or manual test performed
- Result

Git:
- Branch: branch-name
- Commit: commit-hash or Not pushed yet

Deployment Notes:
- Server commands, migration requirement, or `None`
```

## 2026-10-05 - KYC DOCX/PDF Export Rebuild

Module:
- KYC Form document generation (DOCX and PDF)

Summary:
- Replaced the three diverging export implementations with one shared KYC document model rendered to DOCX (`docx` library) and PDF (HTML through a shared headless Chromium via `puppeteer-core`).
- Both downloads now mirror the in-app Know Your Customer Form preview on the Newoon letterhead: section bars and boxes, two-column field grids, shaded table headers, the Control Structure chart, and Section H grouped into AML Supervisor, DMLRO, MLRO and SEF. Uploaded file names and additional documents are no longer printed.
- The live preview's Section H is grouped the same way (frontend/src/pages/KycFormEditorPage.tsx).
- Bundled Carlito (Calibri-metric), Arimo, Noto Sans Arabic and Noto Sans Symbols 2 fonts for the PDF so it wraps like Word and no longer depends on server fonts; Arabic names render shaped and right-to-left.
- Rebuilt the ownership diagram in the style of the preview's Control Structure chart (layer rail, layer colours, Beneficial tags): vector in the PDF, ~300 dpi in Word, left-to-right for wide structures, and parties with missing or cyclic parents are shown instead of dropped. The PDF now includes the diagram.
- Fixed: the AML accuracy answer printed "No" on every DOCX (now ticked only when recorded); the PDF showed unanswered PEP/sanctions/dual-citizenship questions as "No" (now neither box is ticked); stretched signatures and stamps; invalid XML control characters corrupting DOCX files; download failures (`ERR_INVALID_CHAR`) for file names containing characters such as curly apostrophes or Arabic text; version conflicts when generating twice at once.
- Added `KYC_DOCUMENT_GENERATED` and `KYC_DOCUMENT_DOWNLOADED` audit events. PDF failures now return 503 with a clear message.
- Removed the per-request Chromium launch, the unused hand-written PNG encoder and the unused `docxtemplater` dependency.

Changed Files:
- backend/src/kyc/export/ (new: index.ts, kyc-document-model.ts, kyc-docx-renderer.ts, kyc-html-renderer.ts, kyc-pdf-renderer.ts, kyc-export-assets.ts, kyc-export-format.ts, ownership-diagram.ts)
- backend/src/kyc/kyc.service.ts, kyc.controller.ts, kyc.module.ts
- frontend/src/pages/KycFormEditorPage.tsx (Section H preview grouping)
- backend/src/kyc/kyc-docx.ts, backend/src/kyc/ownership-diagram.ts (removed)
- backend/package.json, package-lock.json
- backend/.env.example
- backend/scripts/preview-kyc-docx.cjs, render-kyc-word.ps1, render-kyc-pages.ps1
- backend/templates/README.md
- docs/kyc-export-preview/ (new standard/complex fixtures and gallery)
- docs/DEVELOPER_HANDOVER.md, docs/CHANGE_LOG_REPORT.md

Database Changes:
- None

Verification:
- `npm run build` passed.
- `node backend/scripts/preview-kyc-docx.cjs` generated standard and complex fixtures. The DOCX files were rendered in Microsoft Word and the PDFs through Chromium, and every page was inspected locally on Windows.
- Nest dependency injection of `KycService` and `KycPdfRenderer` and the UTF-8 download header were checked with a testing module.
- Not verified: Linux server PDF rendering, database-backed generation through the API, and frontend download flow end to end.

Git:
- Branch: bugfixes-2026-10-05
- Commit: Not pushed yet

Deployment Notes:
- `npm ci` (new dependencies: docx, puppeteer-core, @fontsource/carlito, @fontsource/arimo, @fontsource/noto-sans-arabic, @fontsource/noto-sans-symbols-2), then `npm run build`.
- The server needs Chrome/Chromium; set `CHROMIUM_PATH` if auto-detection fails. Optional `PDF_RENDER_CONCURRENCY` (default 2).
- No migration required.

## 2026-09-17 - Newoon AML Compass Knowledge Base

Module:
- Client documentation and support experience

Summary:
- Added a standalone knowledge base branded as Newoon AML Compass.
- Matched the supplied Wazely knowledge-base information architecture, Mona Sans typography, search-led homepage, topic cards, guide cards, article layout, and responsive behavior while applying Newoon branding.
- Added 14 practical guides across 10 topics covering the complete enquiry-to-client AML/KYC workflow.
- Added live search, topic filtering, keyboard search focus, article contents, previous/next navigation, feedback controls, and support links.

Changed Files:
- knowledge-base/index.html
- knowledge-base/article.html
- knowledge-base/styles.css
- knowledge-base/content.js
- knowledge-base/app.js
- knowledge-base/article.js
- docs/CLIENT_DELIVERY_FEATURE_REGISTER.md
- docs/CHANGE_LOG_REPORT.md

Database Changes:
- None

Verification:
- Desktop and mobile browser rendering verified.
- Search filtering and article navigation verified.
- No horizontal overflow detected at the tested mobile breakpoint.

Git:
- Branch: feat/kyc-workflow-finalization
- Commit: Not pushed yet

Deployment Notes:
- Publish the contents of `knowledge-base/` as a static site or subdirectory.

## 2026-09-17 - AML Team Final KYC and Amendment Decision

Module:
- Post-approval KYC finalization and amendment workflow

Summary:
- Added an AML Team post-approval dropdown to either use the approved KYC as the final KYC or require an amendment.
- Final confirmation locks the approved form and moves the case to `KYC_FINAL_APPROVED`.
- Amendment selection requires affected sections and a reason, increments the existing populated form version, reopens it for editing, and restarts review.
- Made this decision available to AML Team, AML Supervisor, and administrative roles, and prevented Operations from completing engagement activation before the final KYC decision.
- Improved final-decision failures so the UI displays the backend validation or connection error instead of a generic message.

Changed Files:
- backend/src/kyc/kyc.controller.ts
- backend/src/kyc/kyc.service.ts
- frontend/src/pages/KycCaseDetailsPage.tsx
- frontend/src/services/kyc-workflow.service.ts

Database Changes:
- None

Verification:
- `npm.cmd run build`
- Backend and frontend production builds completed successfully.

Git:
- Branch: feat/kyc-workflow-finalization
- Commit: Not pushed yet

Deployment Notes:
- Deploy the latest backend and frontend build. No additional migration is required for this workflow change.

## 2026-09-17 - Prevent Repeated Enquiry-to-KYC Conversion

Module:
- Enquiry status actions and KYC case creation

Summary:
- Made `CONVERTED_TO_KYC` terminal so an enquiry cannot be marked ready and converted repeatedly.
- Added a unique source-enquiry link to generated KYC cases and an atomic conversion claim to prevent duplicate cases from repeated or concurrent requests.
- Replaced conversion controls with an Open KYC Case action after conversion.
- Backfilled the earliest generated KYC case for previously converted enquiries.

Changed Files:
- backend/prisma/schema.prisma
- backend/prisma/migrations/20260917140000_link_enquiry_to_kyc_case/migration.sql
- backend/src/enquiries/enquiries.service.ts
- frontend/src/pages/EnquiryDetailsPage.tsx
- frontend/src/services/kyc-workflow.service.ts

Database Changes:
- Added nullable unique `KycCase.sourceEnquiryId` with an enquiry foreign key and existing-data backfill.

Verification:
- Prisma schema validation passed.
- Prisma Client type generation passed with `--no-engine` because the running Windows server locks the local engine DLL.
- Production backend and frontend build passed.

Git:
- Branch: feat/kyc-workflow-finalization
- Commit: Not pushed yet

Deployment Notes:
- Apply Prisma migrations before restarting the deployed application.

## 2026-09-17 - MLRO Parallel Review Queue Repair

Module:
- KYC review routing, review tasks, and role notifications

Summary:
- Corrected the direct AML Supervisor submission path so sending a case to DMLRO also creates the parallel MLRO review task and MLRO notification.
- Added tenant-scoped recovery when an MLRO loads My Review Tasks, restoring missing MLRO tasks and notifications for cases already pending with DMLRO.

Changed Files:
- backend/src/kyc/kyc.service.ts

Database Changes:
- None

Verification:
- `npm.cmd run build`
- Backend and frontend production builds completed successfully.

Git:
- Branch: feat/kyc-workflow-finalization
- Commit: Not pushed yet

Deployment Notes:
- Deploy the latest backend build and restart the application. Existing DMLRO-pending cases are repaired when the MLRO opens My Review Tasks.

## 2026-09-17 - SEF Routing, Parallel Review, and Client Activation Corrections

Module:
- Internal review workflow
- Engagement decision
- Client register

Summary:
- Kept `Send to SEF` visible for MLRO at every risk level while continuing to require SEF routing for High-risk files.
- Allowed MLRO to start and complete a reason-controlled review while DMLRO review is pending, including a parallel MLRO review task and notification.
- Added `Final approval during MLRO absence` to both DMLRO review interfaces and required a reason or conditions.
- Added Convert and activate, Reject, and On hold outcomes after the signed engagement letter is uploaded by Operations/BD.
- Restricted the Clients list to activated clients; enquiry-generated prospect records remain hidden until conversion and activation.
- Marked directly created client records as Active and included migration backfill for existing direct clients and already activated KYC clients.

Changed Files:
- `backend/prisma/schema.prisma`
- `backend/prisma/migrations/20260917130000_add_dmlro_final_approval_decision/migration.sql`
- `backend/src/clients/clients.service.ts`
- `backend/src/kyc/kyc.service.ts`
- `frontend/src/pages/InternalReviewWorkspacePage.tsx`
- `frontend/src/pages/KycCaseDetailsPage.tsx`
- `frontend/src/pages/KycFormEditorPage.tsx`
- `frontend/src/services/kyc-workflow.service.ts`
- `docs/CHANGE_LOG_REPORT.md`

Database Changes:
- Migration: `20260917130000_add_dmlro_final_approval_decision`

Verification:
- Prisma schema validation passed.
- Prisma Client generation passed.
- `npm.cmd run build` passed.

Git:
- Branch: `feat/kyc-workflow-finalization`
- Commit: Not pushed yet

Deployment Notes:
- Run `npx prisma migrate deploy --schema backend/prisma/schema.prisma` before restarting the application.

## 2026-09-17 - Compact Screening Record Header

Module:
- Individual screening records

Summary:
- Arranged Screening name, Identifier, Country, and Result in one four-column row on desktop screens.
- Retained responsive wrapping for tablet and mobile widths.

Changed Files:
- `frontend/src/pages/KycScreeningPage.tsx`
- `docs/CHANGE_LOG_REPORT.md`

Database Changes:
- None

Verification:
- `npm.cmd run build`

Git:
- Branch: `feat/production-upload-security`
- Commit: Not pushed yet

Deployment Notes:
- No database migration is required.

## 2026-09-17 - Unified CRRF Form Layout

Module:
- CRRF workspace

Summary:
- Moved the optional CRRF document uploader and uploaded-file list into the Risk Rating and Internal Comments form.
- Placed the Save CRRF action below the complete record so rating, comments, evidence, and save action read as one workflow.

Changed Files:
- `frontend/src/pages/CrrfWorkspacePage.tsx`
- `docs/CHANGE_LOG_REPORT.md`

Database Changes:
- None

Verification:
- `npm.cmd run build` passed.

Git:
- Branch: `feat/production-upload-security`
- Commit: Not pushed yet

Deployment Notes:
- No database migration is required for this layout update.

## 2026-09-17 - Screening Other-Document and Country Field Correction

Module:
- Individual screening records

Summary:
- Removed the legacy `Other relevant document type` upload block that duplicated the selectable `Other screening document` tool.
- Replaced manual-entry and screening-record country text inputs with the shared searchable country dropdown used elsewhere in the application.

Changed Files:
- `frontend/src/pages/KycScreeningPage.tsx`
- `docs/CHANGE_LOG_REPORT.md`

Database Changes:
- None

Verification:
- `npm.cmd run build` passed.

Git:
- Branch: `feat/production-upload-security`
- Commit: Not pushed yet

Deployment Notes:
- No additional migration is required for this correction.

## 2026-09-17 - Required Common Screening and Selective Individual Tools

Module:
- Screening workspace
- KYC case details

Summary:
- Added World-Check and Google to the required common Screening PDF Files section alongside NCTC, UN, OFAC, EU, and PPO List.
- Added a persistent individual screening-tool selector for NCTC, UN, OFAC, and Other.
- Individual screening records now render only selected tools, avoiding empty unused screening rows.
- Required a result and evidence for every selected individual tool, with comments required for potential or confirmed matches.
- Removed the Workflow Progress panel from KYC case details.

Changed Files:
- `backend/prisma/schema.prisma`
- `backend/prisma/migrations/20260917120000_add_screening_check_selection/migration.sql`
- `backend/src/screening/screening.service.ts`
- `frontend/src/pages/KycCaseDetailsPage.tsx`
- `frontend/src/pages/KycScreeningPage.tsx`
- `frontend/src/services/kyc-workflow.service.ts`
- `docs/CHANGE_LOG_REPORT.md`

Database Changes:
- Migration: `20260917120000_add_screening_check_selection`

Verification:
- `npx.cmd prisma validate --schema backend/prisma/schema.prisma` passed with a temporary validation URL.
- `npx.cmd prisma generate --schema backend/prisma/schema.prisma --no-engine` passed.
- `npm.cmd run build` passed.

Git:
- Branch: `feat/production-upload-security`
- Commit: Not pushed yet

Deployment Notes:
- Run `npx prisma migrate deploy --schema backend/prisma/schema.prisma` before restarting the application.

## 2026-09-17 - Screening, Review Bypass, Activation, and Amendment Workflow

Module:
- Screening
- CRRF
- Internal review
- Client activation
- KYC amendment

Summary:
- Removed the AML Supervisor accuracy-check field from the visible KYC review and generated documents.
- Exposed separate AML Supervisor, DMLRO, MLRO, and SEF review stages in the internal review workspace.
- Changed individual screening so World-Check and Google require results but no individual uploads; match comments are required for potential or confirmed matches.
- Added optional NCTC, UN, OFAC, and Other individual filters, with evidence required only when a filter is selected.
- Added the KYC number to Screening and CRRF client summaries.
- Kept CRRF supporting documents optional while retaining mandatory risk rating validation.
- Allowed MLRO review before DMLRO completion when a bypass reason is recorded, and added reason-controlled DMLRO final approval for MLRO absence.
- Made Send to SEF available for any risk level while keeping SEF mandatory for High-risk approval.
- Added the post-approval Operations workflow to upload a signed engagement letter and either activate the client or reject the engagement.
- Added an AML KYC amendment action for selecting affected sections, recording a reason, opening a new form version, and restarting review.

Changed Files:
- `backend/src/crrf/crrf.service.ts`
- `backend/src/kyc/kyc.controller.ts`
- `backend/src/kyc/kyc.service.ts`
- `backend/src/screening/screening.service.ts`
- `frontend/src/pages/CrrfWorkspacePage.tsx`
- `frontend/src/pages/InternalReviewWorkspacePage.tsx`
- `frontend/src/pages/KycCaseDetailsPage.tsx`
- `frontend/src/pages/KycFormEditorPage.tsx`
- `frontend/src/pages/KycScreeningPage.tsx`
- `frontend/src/services/kyc-workflow.service.ts`
- `docs/CHANGE_LOG_REPORT.md`

Database Changes:
- None

Verification:
- `npm.cmd run build` passed.

Git:
- Branch: `feat/production-upload-security`
- Commit: Not pushed yet

Deployment Notes:
- No database migration is required.

## 2026-09-17 - KYC Control Details and Received Document Wording

Module:
- KYC Form Builder
- Generated KYC DOCX and PDF documents

Summary:
- Replaced user-visible `Owner`, `Shareholder`, and `UBO` terminology in Section B with neutral `Party`, `Control / Interest`, and `Beneficial person` wording.
- Renamed the required-document checklist status from `Provided` to `Received` in the generated KYC document.
- Renamed `CR of legal entity shareholders` to `CR of legal entity parties` while retaining aliases for previously saved records.
- Updated percentage, structure diagram, validation, and generated-document labels to use the revised terminology consistently.

Changed Files:
- `backend/src/kyc/kyc.service.ts`
- `frontend/src/pages/KycFormEditorPage.tsx`
- `docs/CHANGE_LOG_REPORT.md`

Database Changes:
- None

Verification:
- `npm.cmd run build`

Git:
- Branch: `feat/production-upload-security`
- Commit: Not pushed yet

Deployment Notes:
- No database migration is required for this wording update.

## 2026-09-16 - KYC Number, Review Links, and Key Contact Identity Updates

Module:
- Enquiry workflow
- KYC Form Builder
- Review workspace
- Key contact identity capture

Summary:
- Updated KYC form entry links from review areas so the KYC form opens in a new browser tab.
- Replaced visible `Converted to KYC` enquiry wording with responsible-stage wording showing pending AML Supervisor handoff.
- Renamed the KYC workflow table `Case` header to `KYC Number` and displayed the generated KYC number in that column.
- Added a stored KYC case number field, migration backfill, and automatic generation in the `KYC-YYYY-0001` sequence format for both direct KYC creation and enquiry-to-KYC conversion.
- Renamed the KYC form `Reference` field to `KYC Number` and auto-populated it from the stored KYC number for both the workflow list and Section A form field.
- Marked KYC forms generated from proposed-company enquiries as preliminary proposed-company forms so they are visually distinguishable from standard KYC forms.
- Reworked key contact identity capture to support Passport and/or QID, with separate expiry dates and validation requiring either Passport or QID instead of making QID mandatory.

Changed Files:
- `backend/prisma/schema.prisma`
- `backend/prisma/migrations/20260916110000_add_kyc_case_number/migration.sql`
- `backend/src/enquiries/enquiries.service.ts`
- `backend/src/kyc/kyc.service.ts`
- `frontend/src/pages/AddEnquiryPage.tsx`
- `frontend/src/pages/EnquiryDetailsPage.tsx`
- `frontend/src/pages/EnquiryListPage.tsx`
- `frontend/src/pages/InternalReviewWorkspacePage.tsx`
- `frontend/src/pages/KycCaseDetailsPage.tsx`
- `frontend/src/pages/KycFormEditorPage.tsx`
- `frontend/src/pages/ReviewTasksPage.tsx`
- `docs/CHANGE_LOG_REPORT.md`

Database Changes:
- Migration: `20260916110000_add_kyc_case_number`

Verification:
- `npm.cmd run build` passed.
- `npx.cmd prisma generate --schema backend/prisma/schema.prisma --no-engine` passed.

Git:
- Branch: `feat/production-upload-security`
- Commit: Not pushed yet

Deployment Notes:
- Run Prisma migration deploy/generate, then backend restart and frontend rebuild.

## 2026-09-16 - Multi-File Edit Preservation Fix

Module:
- Enquiry attachments
- Multi-file upload persistence

Summary:
- Fixed enquiry edit reload so multiple uploaded files under the same attachment heading are preserved and displayed together.
- Updated attachment draft state to track saved files separately from newly selected files, preventing save/update from collapsing a multi-file group into one metadata row.
- Ensured saved attachment metadata preserves each file's storage path, MIME type, and size when editing an existing enquiry.

Changed Files:
- `frontend/src/pages/AddEnquiryPage.tsx`
- `docs/CHANGE_LOG_REPORT.md`

Database Changes:
- None

Verification:
- `npm.cmd run build` passed.

Git:
- Branch: `feat/production-upload-security`
- Commit: Not pushed yet

Deployment Notes:
- Frontend rebuild required.

## 2026-09-16 - Submission Lock and Document Group Downloads

Module:
- Enquiry workflow
- KYC preparation documents
- Attachment downloads

Summary:
- Locked Operations enquiry editing, attachment uploading, and submit-to-AML actions after submission until AML returns the enquiry to BD.
- Hid AML-only enquiry actions from Operations users, including `Return to BD`, `Mark Ready for KYC`, and KYC creation actions.
- Added status-based KYC preparation document upload/submit locks so documents cannot be re-submitted after workflow submission unless the case is returned for additional information.
- Added multi-file KYC preparation upload support so files selected under one document heading are persisted together.
- Grouped KYC preparation documents by heading on the case details page, with individual view/download actions and ZIP download for groups with multiple files.
- Added explicit legal-document download actions to avoid using preview behavior for files that should be downloaded.

Changed Files:
- `backend/src/enquiries/enquiries.service.ts`
- `backend/src/kyc/kyc.controller.ts`
- `backend/src/kyc/kyc.service.ts`
- `frontend/src/pages/EnquiryDetailsPage.tsx`
- `frontend/src/pages/KycCaseDetailsPage.tsx`
- `frontend/src/services/kyc-workflow.service.ts`
- `docs/CHANGE_LOG_REPORT.md`

Database Changes:
- None

Verification:
- `npm.cmd run build` passed.

Git:
- Branch: `feat/production-upload-security`
- Commit: Not pushed yet

Deployment Notes:
- Backend restart and frontend rebuild required.

## 2026-09-16 - Enquiry Attachment ZIP Download

Module:
- Enquiry attachment review

Summary:
- Added a backend ZIP download endpoint for enquiry attachment groups.
- Updated the enquiry details page so grouped attachment download uses a normal single-file download when one file is available and a ZIP archive when multiple files are available.

Changed Files:
- `backend/src/enquiries/enquiries.controller.ts`
- `backend/src/enquiries/enquiries.service.ts`
- `frontend/src/services/kyc-workflow.service.ts`
- `frontend/src/pages/EnquiryDetailsPage.tsx`
- `docs/CHANGE_LOG_REPORT.md`

Database Changes:
- None

Verification:
- `npm.cmd run build` passed.

Git:
- Branch: `feat/production-upload-security`
- Commit: Not pushed yet

Deployment Notes:
- Backend restart and frontend rebuild required.

## 2026-09-16 - Enquiry Notification and Attachment Review Corrections

Module:
- Enquiry workflow
- Enquiry notifications
- Enquiry attachment uploads and review

Summary:
- Routed new enquiry notifications to SEF users in addition to existing review roles.
- Changed AML return notification wording from Operations to BD.
- Added a real multi-file enquiry attachment upload endpoint so files selected together persist together instead of relying on repeated single-file uploads.
- Restricted enquiry deletion to Super Admin users only and hid the delete action for other users.
- Grouped enquiry attachments by document heading on the details page and added a Download all action per group while keeping individual view/download actions.

Changed Files:
- `backend/src/enquiries/enquiries.controller.ts`
- `backend/src/enquiries/enquiries.service.ts`
- `frontend/src/services/kyc-workflow.service.ts`
- `frontend/src/pages/EnquiryDetailsPage.tsx`
- `frontend/src/pages/EnquiryListPage.tsx`
- `docs/CHANGE_LOG_REPORT.md`

Database Changes:
- None

Verification:
- `npm.cmd run build` passed.

Git:
- Branch: `feat/production-upload-security`
- Commit: Not pushed yet

Deployment Notes:
- Backend restart and frontend rebuild required.

## 2026-09-16 - Enquiry Form Client Corrections

Module:
- Enquiry intake
- Enquiry attachments

Summary:
- Added `QFC LLC` as an available Proposed Legal Form option.
- Added an `Other` option to Requested Services with a details field that saves the typed service into the existing requested services list.
- Removed the Key Contact passport/QID upload block from the Contact tab so the attachment is captured only in the Attachments tab.
- Renamed the proposed-company attachment requirement from `Identity Proof - Director UBO` to `Identity Proof - Proposed Director`.

Changed Files:
- `frontend/src/pages/AddEnquiryPage.tsx`
- `docs/CHANGE_LOG_REPORT.md`

Database Changes:
- None

Verification:
- `npm.cmd run build` passed.

Git:
- Branch: `feat/production-upload-security`
- Commit: Not pushed yet

Deployment Notes:
- Frontend rebuild required.

## 2026-09-08 - Production Security Hardening Review

Module:
- Security
- File uploads
- Authentication and tenant isolation
- Frontend API configuration

Summary:
- Added centralized upload validation for file size, file count, extension, MIME type, binary file signatures, and executable file blocking.
- Applied upload validation to KYC legal documents, signed KYC files, enquiry attachments, Screening evidence, and CRRF document uploads.
- Restricted Screening merged/list evidence to PDF, CRRF uploads to PDF/Excel, and blocked executable/script/macro-capable file extensions.
- Added safe file response headers and `X-Content-Type-Options: nosniff` on document view/download endpoints.
- Tightened upload path containment checks so stored file paths must resolve inside the configured upload root.
- Changed the frontend API fallback to same-origin `/api` so production builds do not call hard-coded localhost endpoints when `VITE_API_URL` is missing.
- Revalidated JWT sessions against the database on every authenticated request so disabled users, changed roles, and tenant changes are not trusted from stale tokens.
- Blocked login and stale-session access for suspended users without locking out existing invited/test workflow accounts.
- Fixed the login password visibility icon so it toggles the password field correctly.
- Added a Vite development proxy for `/api` so local frontend testing reaches the backend after removing the production localhost fallback.
- Improved login failure messaging so API connectivity/proxy issues are shown separately from invalid credentials.
- Updated the seed script so existing workflow test users are reset to the displayed default test password when seeding a test environment.
- Added visible upload rule hints across KYC, Enquiry, Screening, CRRF, and signed KYC upload areas so users can see allowed file types, maximum file size, and maximum file count before uploading.
- Added frontend upload selection validation to stop unsupported formats and oversized selections before sending them to the backend.
- Added baseline security headers and production-safe CORS behavior in the backend bootstrap.
- Reviewed tenant-id request usage; ordinary KYC, Screening, CRRF, enquiry, and document paths use authenticated tenant scoping, while tenant module assignment remains restricted to `SUPER_ADMIN`.

Changed Files:
- `backend/src/common/security/upload-security.ts`
- `backend/src/auth/auth.service.ts`
- `backend/src/auth/jwt.strategy.ts`
- `backend/src/main.ts`
- `backend/src/crrf/crrf.controller.ts`
- `backend/src/crrf/crrf.service.ts`
- `backend/src/enquiries/enquiries.controller.ts`
- `backend/src/enquiries/enquiries.service.ts`
- `backend/src/kyc/kyc.controller.ts`
- `backend/src/kyc/kyc.service.ts`
- `backend/src/screening/screening.controller.ts`
- `backend/src/screening/screening.service.ts`
- `backend/prisma/seed.ts`
- `frontend/src/pages/LoginPage.tsx`
- `frontend/src/services/api.ts`
- `frontend/src/utils/upload-security.ts`
- `frontend/src/components/MultiFileUploadControl.tsx`
- `frontend/src/pages/CrrfWorkspacePage.tsx`
- `frontend/src/pages/InternalReviewWorkspacePage.tsx`
- `frontend/src/pages/KycScreeningPage.tsx`
- `frontend/vite.config.ts`
- `docs/CHANGE_LOG_REPORT.md`

Database Changes:
- None

Verification:
- `npm.cmd run build` passed.

Git:
- Branch: `feat/review-package-ui-evidence`
- Commit: Not pushed yet

Deployment Notes:
- Frontend and backend rebuild required.
- No Prisma migration required.
- Set `FRONTEND_URL` to the production application origin on the server. In production, CORS will reject browser origins not listed in `FRONTEND_URL`.
- Optional upload environment controls: `MAX_UPLOAD_FILE_SIZE_BYTES`, `MAX_UPLOAD_FILE_COUNT`, `UPLOAD_DIR`, `ENQUIRY_UPLOAD_DIR`, `SCREENING_UPLOAD_DIR`, and `CRRF_UPLOAD_DIR`.

## 2026-09-08 - Review Package Access for KYC, Screening, and CRRF

Module:
- Internal review workflow
- Screening workspace
- CRRF workflow

Summary:
- Added a Review Package panel inside the Internal Review Workspace so reviewers can open the KYC Form, Screening, and CRRF sections together from one place.
- Added the same Review Package panel to the KYC Form review screen so DMLRO, MLRO, and SEF users see the KYC Form, Screening, and CRRF together when opening a review task.
- Changed the KYC Form Review Package Screening and CRRF actions into in-page detail panels instead of redirecting reviewers away from the review screen.
- Hid the KYC form editor and document preview while the Screening or CRRF package tab is selected, giving reviewers a cleaner focused view of the selected section.
- Added file-level view actions, Screening result notes, record remarks, and CRRF internal comments to the in-page review package so reviewers can inspect evidence before approval.
- Refined the in-page Review Package UI with softer grouping, clearer active states, readable evidence rows, and result badges so DMLRO/MLRO reviewers can scan the package more comfortably.
- Added collapsible Screening record cards in the review package with Collapse all and Expand all controls so large Screening packages do not force excessive page scrolling.
- Separated Newoon brand red from semantic UI states so success/approved statuses use green, pending/in-progress statuses use amber or blue, errors remain red, and selected review package tabs no longer look like warnings.
- Updated DMLRO, MLRO, and SEF notification clicks to open the modern KYC Form Review Package screen instead of the older internal review workspace.
- Allowed DMLRO, MLRO, and SEF users to view Screening records and screening evidence after AML prepares the screening section.
- Kept Screening edit, upload, delete, save, and finalize actions limited to AML/admin roles so reviewer access is read-only.
- Updated role-based navigation so Screening appears for DMLRO, MLRO, and SEF review users.

Changed Files:
- `backend/src/screening/screening.controller.ts`
- `frontend/src/pages/InternalReviewWorkspacePage.tsx`
- `frontend/src/pages/KycFormEditorPage.tsx`
- `frontend/src/pages/KycScreeningPage.tsx`
- `frontend/src/utils/access-control.ts`
- `docs/CHANGE_LOG_REPORT.md`

Database Changes:
- None

Verification:
- `npm.cmd run build` passed.

Git:
- Branch: `feat/review-package-ui-evidence`
- Commit: Branch head after push

Deployment Notes:
- Frontend and backend rebuild required.

## 2026-09-03 - CRRF Internal Comments and Client Info Fallback

Module:
- CRRF workflow
- CRRF reporting

Summary:
- Replaced separate DMLRO and MLRO comment entry in CRRF with one internal Comments field.
- Kept CRRF comments visible and editable inside the system for internal reference.
- Removed internal CRRF comments from Excel and PDF CRRF exports.
- Improved CRRF Client Name, Client Code, CR Number, and Country display by reading linked KYC Section A data when the Client record does not contain those values.

Changed Files:
- `backend/prisma/schema.prisma`
- `backend/prisma/migrations/20260903100000_update_crrf_internal_comments/migration.sql`
- `backend/src/crrf/crrf.service.ts`
- `frontend/src/pages/CrrfListPage.tsx`
- `frontend/src/pages/CrrfWorkspacePage.tsx`
- `frontend/src/services/kyc-workflow.service.ts`
- `docs/CHANGE_LOG_REPORT.md`

Database Changes:
- Added `CrrfRecord.internalComment`.
- Migration: `20260903100000_update_crrf_internal_comments`

Verification:
- `node node_modules/prisma/build/index.js generate --schema backend/prisma/schema.prisma` passed.
- `npm.cmd run build` passed.

Git:
- Branch: `feat/crrf-workspace-reporting`
- Commit: Not pushed yet

Deployment Notes:
- Run Prisma migration deploy and regenerate Prisma client before build.

## 2026-09-02 - CRRF Workspace, Uploads, and Export

Module:
- CRRF workflow
- KYC case profile
- Compliance reporting

Summary:
- Added a CRRF workspace linked to each KYC case.
- Auto-displays Client Name, Client Code, and CR Number from the linked KYC/client profile.
- Added mandatory CRRF risk rating selection with Low, Medium, and High options.
- Added DMLRO and MLRO comment fields.
- Added multiple CRRF document uploads for PDF, XLS, and XLSX files.
- Stored uploaded CRRF files against the KYC-linked CRRF record.
- Added CRRF document view and delete actions.
- Added Excel and PDF export actions for CRRF report data, including client information, risk rating, comments, and uploaded document list.
- Added CRRF register page and sidebar menu.
- Added CRRF action button on KYC case details.

Changed Files:
- `backend/prisma/schema.prisma`
- `backend/prisma/migrations/20260902120000_add_crrf_module/migration.sql`
- `backend/src/app.module.ts`
- `backend/src/crrf/crrf.controller.ts`
- `backend/src/crrf/crrf.module.ts`
- `backend/src/crrf/crrf.service.ts`
- `frontend/src/layouts/AppLayout.tsx`
- `frontend/src/pages/CrrfListPage.tsx`
- `frontend/src/pages/CrrfWorkspacePage.tsx`
- `frontend/src/pages/KycCaseDetailsPage.tsx`
- `frontend/src/routes/router.tsx`
- `frontend/src/services/kyc-workflow.service.ts`
- `frontend/src/utils/access-control.ts`
- `docs/CHANGE_LOG_REPORT.md`

Database Changes:
- Added `CrrfRiskRating`.
- Added `CrrfRecord`.
- Added `CrrfDocument`.
- Migration: `20260902120000_add_crrf_module`

Verification:
- `node node_modules/prisma/build/index.js generate --schema backend/prisma/schema.prisma` passed.
- `npm.cmd run build` passed.

Git:
- Branch: `feat/screening-merged-evidence`
- Commit: Not pushed yet

Deployment Notes:
- Run Prisma migration deploy and regenerate Prisma client before build.

## 2026-09-02 - Screening PDF Result Tracking

Module:
- AML screening workspace

Summary:
- Renamed `Merged Screening PDF Files` to `Screening PDF Files`.
- Added result dropdowns for the case-level screening PDF tools: NCTC, UN, OFAC, EU, and PPO List.
- Added persistence for case-level screening results.
- Renamed the individual screening `Conclusion` UI label to `Result`.
- Updated finalization validation so case-level screening PDF results must be selected.

Changed Files:
- `backend/prisma/schema.prisma`
- `backend/prisma/migrations/20260902100000_add_screening_case_results/migration.sql`
- `backend/src/screening/screening.controller.ts`
- `backend/src/screening/screening.service.ts`
- `frontend/src/pages/KycScreeningPage.tsx`
- `frontend/src/services/kyc-workflow.service.ts`

Database Changes:
- Added `ScreeningCaseCheck`.
- Linked `ScreeningCaseDocument` to case-level screening checks.
- Migration: `20260902100000_add_screening_case_results`

Verification:
- `node node_modules/prisma/build/index.js generate --schema backend/prisma/schema.prisma` passed.
- `npm.cmd run build` passed.

Git:
- Branch: `feat/screening-merged-evidence`
- Commit: `02f56d1 Add screening PDF result tracking`

Deployment Notes:
- Run Prisma migration deploy and regenerate Prisma client before build.

## 2026-09-02 - Change Log Report Started

Module:
- Project documentation and release tracking

Summary:
- Created this formal change log report for the Newoon MIS application.
- Expanded the report to include historical project changes from the initial commit onward.
- Future completed application changes must be added here with date, scope, verification, and deployment notes.

Changed Files:
- `docs/CHANGE_LOG_REPORT.md`

Database Changes:
- None

Verification:
- Document created and updated in the repository.

Git:
- Branch: `feat/screening-merged-evidence`
- Commit: Not pushed yet

Deployment Notes:
- None. Documentation-only change.

## 2026-09-01 - Screening Merged Evidence and Individual Results

Module:
- AML screening workspace
- KYC Form Builder Section C

Summary:
- Added mandatory case-level merged PDF uploads for NCTC, UN, OFAC, EU, and PPO List before individual screening records can be created.
- Added individual screening result/conclusion tracking.
- Added delete option for screening entities.
- Adjusted screening finalization rules.
- Updated Section C manager/director nationality to use country names and support multiple countries.
- Updated KYC export handling for manager nationality and position values.

Changed Files:
- `backend/prisma/schema.prisma`
- `backend/prisma/migrations/20260901100000_add_screening_conclusion_and_case_documents/migration.sql`
- `backend/src/kyc/kyc.service.ts`
- `backend/src/screening/screening.controller.ts`
- `backend/src/screening/screening.service.ts`
- `frontend/src/pages/KycFormEditorPage.tsx`
- `frontend/src/pages/KycScreeningPage.tsx`
- `frontend/src/services/kyc-workflow.service.ts`

Database Changes:
- Added `ScreeningConclusionStatus`.
- Added `ScreeningRecord.conclusionStatus`.
- Added `ScreeningCaseDocument`.
- Migration: `20260901100000_add_screening_conclusion_and_case_documents`

Verification:
- Prisma client generation passed.
- `npm.cmd run build` passed.

Git:
- Branch: `feat/screening-merged-evidence`
- Commit: `44f5f4d Add screening merged evidence and conclusions`

Deployment Notes:
- Run Prisma migration deploy and regenerate Prisma client before build.

## 2026-08-31 - Screening Workspace and Screening Register

Module:
- AML screening workflow
- Screening register
- KYC case details

Summary:
- Added a screening workspace for KYC cases.
- Auto-linked screening entity options from KYC data, including client company, shareholders, UBOs, managers, and key communication person.
- Added mandatory screening checks for NCTC, UN, OFAC, EU, PPO List, World-Check, and Google.
- Added screening evidence upload, document view/delete, record save, and record finalize flows.
- Added a separate `Screening` sidebar menu and aggregate screening register page.
- Added tenant-scoped backend screening APIs.
- Fixed upload refresh behavior so selected screening results and notes do not reset to `Not checked`.
- Improved screening UI with compact expandable records, collapse/expand controls, and clearer evidence counts.

Changed Files:
- `backend/prisma/schema.prisma`
- `backend/prisma/migrations/20260827110000_add_screening_module/migration.sql`
- `backend/src/app.module.ts`
- `backend/src/screening/screening.controller.ts`
- `backend/src/screening/screening.module.ts`
- `backend/src/screening/screening.service.ts`
- `frontend/src/layouts/AppLayout.tsx`
- `frontend/src/pages/KycCaseDetailsPage.tsx`
- `frontend/src/pages/KycScreeningPage.tsx`
- `frontend/src/pages/ScreeningListPage.tsx`
- `frontend/src/routes/router.tsx`
- `frontend/src/services/kyc-workflow.service.ts`
- `frontend/src/utils/access-control.ts`

Database Changes:
- Added screening enums and screening tables.
- Migration: `20260827110000_add_screening_module`

Verification:
- `npm.cmd run build` passed.

Git:
- Branch: `screening-register`
- Commits:
  - `786df54 Add screening workflow and screening register`
  - `7ef6639 Fix screening upload state and compact records UI`

Deployment Notes:
- Run Prisma migration deploy and regenerate Prisma client before build.

## 2026-08-26 - Corporate Lookup by KYC CR Number

Module:
- Ownership/shareholder lookup
- Client linking

Summary:
- Improved corporate shareholder lookup so CR numbers saved inside existing KYC forms can be matched.
- Fixed cases where a corporate entity entered in another KYC case was not found by lookup.

Changed Files:
- `backend/src/clients/clients.service.ts`
- Related frontend ownership lookup handling in `frontend/src/pages/KycFormEditorPage.tsx`

Database Changes:
- None

Verification:
- Lookup tested against saved KYC CR numbers.

Git:
- Commit: `bf2e2a0 Match corporate lookup against KYC CR numbers`

Deployment Notes:
- Backend restart required after pull/build.

## 2026-08-25 - Dashboard, Login, Theme, and Corporate Lookup Fixes

Module:
- Dashboard UI
- Login UI
- Global typography/theme
- Ownership lookup

Summary:
- Refreshed dashboard UI with modern cards, cleaner layout, and improved visual hierarchy.
- Redesigned login screen while preserving existing credentials and login behavior.
- Applied modern application typography.
- Applied Newoon-themed color treatment with lighter red variants after review.
- Fixed corporate shareholder lookup self-match behavior so lookup does not incorrectly link to the current client being edited.

Changed Files:
- `frontend/src/pages/DashboardPage.tsx`
- `frontend/src/pages/LoginPage.tsx`
- Global styling/theme files
- Lookup-related backend/frontend files

Database Changes:
- None

Verification:
- Build and manual UI checks performed during implementation.

Git:
- Commits:
  - `3ae54bd Refresh dashboard UI`
  - `2d11f24 Refresh login theme and typography`
  - `907dab8 Fix corporate shareholder lookup self-match`

Deployment Notes:
- Frontend rebuild required.

## 2026-08-22 to 2026-08-24 - Owner Lookup and Upload Append Fixes

Module:
- KYC ownership lookup
- Multi-document uploads

Summary:
- Fixed KYC owner lookup for saved shareholders.
- Ensured repeated document uploads append new files instead of replacing previously uploaded files.
- Merged ownership diagram, multiple upload append, and lookup fixes into the main workflow.

Changed Files:
- `frontend/src/pages/KycFormEditorPage.tsx`
- `frontend/src/services/kyc-workflow.service.ts`
- `backend/src/clients/clients.service.ts`
- Related upload handling files

Database Changes:
- None

Verification:
- Manual checks for lookup and repeated uploads.

Git:
- Commits:
  - `4865d18 Append files on repeated document uploads`
  - `86d52a9 Fix KYC owner lookup for saved shareholders`
  - `cb7750f Merge pull request #21 from brilldevteam/feat/ownership-diagram-docx-polish`
  - `2802460 Merge pull request #22 from brilldevteam/feat/append-multiple-upload-files`
  - `d853091 Merge pull request #23 from brilldevteam/fix/kyc-owner-lookup-saved-shareholders`

Deployment Notes:
- Frontend and backend rebuild required.

## 2026-08-18 to 2026-08-20 - Ownership Diagram and Section B UX

Module:
- KYC Form Builder Section B
- DOCX export

Summary:
- Added and polished auto-generated ownership/shareholding diagram behavior.
- Improved DOCX ownership diagram rendering, spacing, borders, and alignment.
- Improved ownership editor UX for multi-layer structures.
- Added compact expandable ownership rows, delete icon-only action, and cleaner controls.
- Fixed initial KYC form section focus so Section A opens first instead of Section H.
- Fixed UBO badge placement and name visibility in ownership diagram.

Changed Files:
- `frontend/src/pages/KycFormEditorPage.tsx`
- `backend/src/kyc/kyc.service.ts`
- KYC document generation/template-related files

Database Changes:
- None

Verification:
- Manual checks against multi-layer ownership examples.
- DOCX export checked after diagram rendering fixes.

Git:
- Commits:
  - `5bcaca3 Fix KYC document upload duplication`
  - `939f6b1 Polish ownership diagram DOCX export`
  - `30340a8 Polish ownership diagram and editor UX`
  - `4865d18 Append files on repeated document uploads`

Deployment Notes:
- Frontend and backend rebuild required.

## 2026-08-16 to 2026-08-17 - Enquiry Attachments, Notifications, and AML Actions

Module:
- Enquiries
- Enquiry attachments
- AML/Operations notifications
- KYC conversion

Summary:
- Improved enquiry document workflow.
- Added/enhanced enquiry notification behavior.
- Refined enquiry attachment handling and AML status actions.
- Fixed KYC document upload duplication.
- Merged high-risk SEF routing, Section H review flow, and enquiry action changes.

Changed Files:
- `backend/src/enquiries/enquiries.service.ts`
- `backend/src/enquiries/enquiries.controller.ts`
- `backend/src/notifications/notifications.service.ts`
- `frontend/src/pages/AddEnquiryPage.tsx`
- `frontend/src/pages/EnquiryDetailsPage.tsx`
- `frontend/src/pages/EnquiryListPage.tsx`
- `frontend/src/pages/KycCaseDetailsPage.tsx`

Database Changes:
- None beyond existing enquiry/review migrations.

Verification:
- Manual workflow checks for enquiry attachments and status actions.

Git:
- Commits:
  - `3b7536d Improve enquiry document workflow and notifications`
  - `d5cef0b Refine enquiry attachments and AML status actions`
  - `e904258 Merge pull request #19 from brilldevteam/feat/sef-section-h-review-flow`
  - `fd86435 Merge pull request #18 from brilldevteam/feat/high-risk-sef-routing-kyc-template`
  - `38434e5 Merge pull request #17 from brilldevteam/feat/enquiry-attachments-status-actions`
  - `5bcaca3 Fix KYC document upload duplication`

Deployment Notes:
- Backend restart and frontend rebuild required.

## 2026-08-11 to 2026-08-12 - Enquiry Workflow Phase Two

Module:
- Enquiries
- Current client/proposed company/existing entity intake
- Enquiry to KYC conversion

Summary:
- Added enquiry workflow phase two UI.
- Added current client enquiry attachment defaults.
- Added enquiry attachment file actions.
- Improved enquiry phone country code input.
- Added enquiry create error diagnostics.
- Added enquiry-to-KYC conversion workflow.
- Forced standard Prisma client generation behavior.

Changed Files:
- `backend/prisma/migrations/20260811120000_enquiry_foundation/migration.sql`
- `backend/src/enquiries/*`
- `frontend/src/pages/AddEnquiryPage.tsx`
- `frontend/src/pages/EnquiryDetailsPage.tsx`
- `frontend/src/pages/EnquiryListPage.tsx`
- `frontend/src/services/kyc-workflow.service.ts`

Database Changes:
- Added enquiry foundation tables and fields.
- Migration: `20260811120000_enquiry_foundation`

Verification:
- Manual checks for enquiry creation, attachments, and conversion to KYC.

Git:
- Commits:
  - `d2364ca Add enquiry workflow phase two UI`
  - `6ca449a Fix current client enquiry attachment defaults`
  - `616249e Add enquiry attachment file actions`
  - `9326e52 Improve enquiry phone country code input`
  - `e509515 Force standard Prisma client generation`
  - `a8ae707 Improve enquiry create error diagnostics`
  - `715c9c6 Add enquiry to KYC conversion workflow`

Deployment Notes:
- Run Prisma migration deploy and regenerate Prisma client before build.

## 2026-08-03 - High-Risk SEF KYC Approval Flow

Module:
- Internal review workflow
- High-risk routing
- Section H

Summary:
- Refined high-risk routing so SEF review is included when required.
- Improved Section H and KYC approval flow behavior.
- Added manager nationality/address support.

Changed Files:
- `backend/prisma/migrations/20260803090000_manager_nationality_address_fields/migration.sql`
- `backend/src/kyc/kyc.service.ts`
- `frontend/src/pages/InternalReviewWorkspacePage.tsx`
- `frontend/src/pages/KycFormEditorPage.tsx`

Database Changes:
- Added manager nationality/address related fields.
- Migration: `20260803090000_manager_nationality_address_fields`

Verification:
- Manual workflow checks for high-risk routing.

Git:
- Commit: `4253a25 Refine high risk SEF KYC approval flow`

Deployment Notes:
- Run Prisma migration deploy and regenerate Prisma client before build.

## 2026-07-28 - SEF Section H Review Flow and KYC Upload Sync

Module:
- Section H internal review
- KYC case uploads
- KYC form checklist sync

Summary:
- Added SEF Section H review fields and flow.
- Synced case-level uploads into the KYC form document checklist.
- Continued support for high-risk approval routing.

Changed Files:
- `backend/prisma/migrations/20260728103000_sef_section_h_fields/migration.sql`
- `backend/src/kyc/kyc.service.ts`
- `frontend/src/pages/InternalReviewWorkspacePage.tsx`
- `frontend/src/pages/KycFormEditorPage.tsx`
- `frontend/src/pages/KycCaseDetailsPage.tsx`

Database Changes:
- Added SEF Section H fields.
- Migration: `20260728103000_sef_section_h_fields`

Verification:
- Manual checks for Section H and upload checklist sync.

Git:
- Commits:
  - `3b5d839 Add SEF section H review flow`
  - `c7168b9 Sync case uploads into KYC form checklist`

Deployment Notes:
- Run Prisma migration deploy and regenerate Prisma client before build.

## 2026-07-27 - Updated KYC Template and Export Save Flow

Module:
- KYC document generation
- KYC export/save workflow

Summary:
- Updated KYC template handling.
- Improved generated DOCX/PDF save flow.
- Updated export generation to align with revised client template requirements.

Changed Files:
- `backend/templates/*`
- `backend/src/kyc/kyc.service.ts`
- `frontend/src/pages/KycFormEditorPage.tsx`
- `frontend/src/services/kyc-workflow.service.ts`

Database Changes:
- None

Verification:
- Manual generated document checks.

Git:
- Commits:
  - `e17b409 Update KYC template and export save flow`
  - `0074bad Merge pull request #12 from brilldevteam/feat/updated-kyc-template-export-save`

Deployment Notes:
- Backend rebuild required for document generation changes.

## 2026-07-22 - Review Handoff, SEF Routing, and Operations Uploads

Module:
- Internal review workflow
- Review task routing
- Operations uploads

Summary:
- Improved KYC review handoff workflow.
- Fixed repeat review queue transitions.
- Allowed Operations document uploads where workflow required them.
- Improved SEF review workflow fixes.

Changed Files:
- `backend/src/kyc/kyc.service.ts`
- `frontend/src/pages/InternalReviewWorkspacePage.tsx`
- `frontend/src/pages/ReviewTasksPage.tsx`
- `frontend/src/pages/KycCaseDetailsPage.tsx`
- Upload-related frontend/backend files

Database Changes:
- Existing internal review migrations supported these changes.

Verification:
- Manual review queue and handoff checks.

Git:
- Commits:
  - `6d94df0 Improve KYC review handoff workflow`
  - `10e3388 Merge pull request #9 from brilldevteam/feat/sef-review-workflow-fixes`
  - `8960a46 Fix repeat review queue transitions`
  - `9d49cca Merge pull request #10 from brilldevteam/feat/sef-review-workflow-fixes`
  - `e3f87e7 Allow operations document uploads`
  - `ee06641 Merge pull request #11 from brilldevteam/feat/sef-review-workflow-fixes`

Deployment Notes:
- Backend and frontend rebuild required.

## 2026-07-20 - Internal Review Decision Fields and SEF Management Decision

Module:
- Internal review workflow
- MLRO/DMLRO/SEF decisions

Summary:
- Added internal review decision fields.
- Added SEF management decision support.
- Expanded internal review data model for later workflow refinements.

Changed Files:
- `backend/prisma/migrations/20260720115000_internal_review_decision_fields/migration.sql`
- `backend/prisma/migrations/20260720143000_sef_management_decision/migration.sql`
- `backend/src/kyc/kyc.service.ts`
- Internal review frontend pages

Database Changes:
- Migration: `20260720115000_internal_review_decision_fields`
- Migration: `20260720143000_sef_management_decision`

Verification:
- Manual workflow checks during later review flow implementation.

Git:
- These migrations support the July internal review workflow commits.

Deployment Notes:
- Run Prisma migration deploy and regenerate Prisma client before build.

## 2026-07-16 - Review Tasks, Notifications, Final Approval, and Document UX

Module:
- Review task workflow
- Notifications
- KYC preview/export
- Final approvals

Summary:
- Added role review task workflow.
- Added review task notifications.
- Fixed KYC preview object rendering.
- Improved KYC approval and final document workflow.

Changed Files:
- `backend/src/kyc/kyc.service.ts`
- `backend/src/notifications/*`
- `frontend/src/pages/ReviewTasksPage.tsx`
- `frontend/src/pages/InternalReviewWorkspacePage.tsx`
- `frontend/src/pages/KycFormEditorPage.tsx`
- `frontend/src/pages/KycWorkflowPage.tsx`

Database Changes:
- Used internal review workflow tables from July 15 migrations.

Verification:
- Manual role-review checks and preview/export checks.

Git:
- Commits:
  - `f73f449 Add role review task workflow`
  - `f4463d9 Merge pull request #6 from brilldevteam/feat/review-task-notifications`
  - `01d6dfa Fix KYC preview object rendering`
  - `6f82f32 Merge pull request #7 from brilldevteam/feat/review-task-notifications`
  - `223a13e Improve KYC approval and document workflow`
  - `2cb7f98 Merge pull request #8 from brilldevteam/feat/final-approval-document-ux`

Deployment Notes:
- Backend and frontend rebuild required.

## 2026-07-15 - Role-Based Workflow Access Control and Internal Review Foundation

Module:
- Role-based access
- Internal review workflow
- Signature image storage

Summary:
- Added role-based workflow access control.
- Merged latest KYC workflow changes with role access.
- Added internal review workflow data model.
- Added signature image data support.

Changed Files:
- `backend/prisma/migrations/20260715100000_internal_review_workflow/migration.sql`
- `backend/prisma/migrations/20260715113000_signature_image_data/migration.sql`
- `backend/src/kyc/kyc.service.ts`
- `frontend/src/utils/access-control.ts`
- `frontend/src/routes/router.tsx`
- `frontend/src/pages/InternalReviewWorkspacePage.tsx`
- `frontend/src/pages/ReviewTasksPage.tsx`

Database Changes:
- Migration: `20260715100000_internal_review_workflow`
- Migration: `20260715113000_signature_image_data`

Verification:
- Manual role-based workflow checks.

Git:
- Commits:
  - `e33bc98 Add role based workflow access control`
  - `dc4d7ca Merge latest KYC workflow changes with role access`

Deployment Notes:
- Run Prisma migration deploy and regenerate Prisma client before build.

## 2026-07-14 - KYC Documents, Exports, and Template Labels

Module:
- KYC form documents
- DOCX/PDF export
- KYC template labels

Summary:
- Enhanced KYC form documents and exports.
- Refined KYC document labels and template notes.
- Merged KYC document formatting and PDF improvements.

Changed Files:
- `backend/src/kyc/kyc.service.ts`
- `backend/templates/*`
- `frontend/src/pages/KycFormEditorPage.tsx`
- `frontend/src/services/kyc-workflow.service.ts`

Database Changes:
- None

Verification:
- Manual DOCX/PDF generation checks.

Git:
- Commits:
  - `dd69892 Enhance KYC form documents and exports`
  - `8f3d73e Merge pull request #4 from brilldevteam/feat/kyc-format-documents-pdf`
  - `1a0135d Refine KYC document labels and template notes`
  - `45beec6 Merge pull request #5 from brilldevteam/feat/kyc-format-documents-pdf`

Deployment Notes:
- Backend rebuild required for document generation changes.

## 2026-07-09 - Multiple Newoon Services in KYC Form

Module:
- KYC Form Builder
- Requested services

Summary:
- Added support for multiple Newoon services in the KYC form.
- Ensured KYC form and preview/export can reflect more than one requested service.

Changed Files:
- `frontend/src/pages/KycFormEditorPage.tsx`
- `backend/src/kyc/kyc.service.ts`
- `frontend/src/services/kyc-workflow.service.ts`

Database Changes:
- None

Verification:
- Manual form checks.

Git:
- Commits:
  - `3de36ec Support multiple Newoon services in KYC form`
  - `704072c Merge pull request #3 from brilldevteam/feat/searchable-kyc-dropdowns`

Deployment Notes:
- Frontend and backend rebuild required.

## 2026-07-08 - Legal Document Viewing, Delete, Multi-Upload, and Searchable Dropdowns

Module:
- Legal documents
- KYC dropdowns

Summary:
- Added legal document viewing.
- Added legal document delete action.
- Fixed KYC form exports and internal review issues.
- Added multi-document legal upload.
- Added searchable KYC dropdown overlays.

Changed Files:
- `backend/src/kyc/kyc.controller.ts`
- `backend/src/kyc/kyc.service.ts`
- `frontend/src/pages/KycCaseDetailsPage.tsx`
- `frontend/src/pages/UploadLegalDocumentsPage.tsx`
- `frontend/src/components/SearchableSelect.tsx`
- `frontend/src/pages/KycFormEditorPage.tsx`
- `frontend/src/services/kyc-workflow.service.ts`

Database Changes:
- None

Verification:
- Manual upload/view/delete checks.

Git:
- Commits:
  - `550e252 Add legal document viewing`
  - `8219255 Add legal document delete action`
  - `2159611 Fix KYC form exports and internal review`
  - `3446994 Add multi-document legal upload`
  - `c3ca945 Merge pull request #1 from brilldevteam/feat/multi-document-legal-upload`
  - `7b4b5fd Add searchable KYC dropdown overlays`
  - `9badd75 Merge pull request #2 from brilldevteam/feat/searchable-kyc-dropdowns`

Deployment Notes:
- Frontend and backend rebuild required.

## 2026-07-07 - Production Serving, KYC Template Lookup, and Upload UI

Module:
- Production frontend serving
- KYC DOCX template lookup
- Legal document upload UI
- KYC signatures

Summary:
- Configured backend to serve frontend in production.
- Fixed KYC DOCX template lookup.
- Added legal document file picker.
- Standardized upload button styling.
- Refined legal document upload layout.
- Added upload controls for KYC signatures.

Changed Files:
- `backend/src/main.ts`
- `backend/src/kyc/kyc.service.ts`
- `frontend/src/pages/UploadLegalDocumentsPage.tsx`
- `frontend/src/pages/KycFormEditorPage.tsx`

Database Changes:
- None

Verification:
- Manual production serving and upload checks.

Git:
- Commits:
  - `e2a94c8 Serve frontend from backend in production`
  - `abe134a Fix KYC DOCX template lookup`
  - `f28775e Add legal document file picker`
  - `403595e Standardize upload button style`
  - `a42c9f9 Refine legal document upload layout`
  - `0db41ea Add upload controls for KYC signatures`

Deployment Notes:
- Backend production restart required.

## 2026-07-06 - Initial Newoon MIS Foundation and KYC Form Builder

Module:
- Application foundation
- Authentication
- Multi-tenancy
- KYC intake workflow
- KYC Form Builder

Summary:
- Created the initial Newoon MIS system.
- Added SaaS-ready foundation with tenants, users, roles, modules, permissions, clients, documents, approvals, audit logs, and JWT authentication.
- Added KYC intake workflow foundation.
- Added KYC Form Builder foundation.
- Added seed/default login flow.

Changed Files:
- `backend/prisma/schema.prisma`
- `backend/prisma/migrations/20260706081917_init/migration.sql`
- `backend/prisma/migrations/20260706093000_kyc_intake_workflow/migration.sql`
- `backend/prisma/migrations/20260706120000_kyc_form_builder/migration.sql`
- `backend/src/*`
- `frontend/src/*`
- `docs/README.md`

Database Changes:
- Migration: `20260706081917_init`
- Migration: `20260706093000_kyc_intake_workflow`
- Migration: `20260706120000_kyc_form_builder`

Verification:
- Initial application setup and build workflow established.

Git:
- Commit: `15b1a82 Initial Newoon MIS system`

Deployment Notes:
- Requires dependency install, environment setup, Prisma migrate/generate, seed, backend start, and frontend dev/build setup.

## Current Migration Inventory

- `20260706081917_init`
- `20260706093000_kyc_intake_workflow`
- `20260706120000_kyc_form_builder`
- `20260715100000_internal_review_workflow`
- `20260715113000_signature_image_data`
- `20260720115000_internal_review_decision_fields`
- `20260720143000_sef_management_decision`
- `20260728103000_sef_section_h_fields`
- `20260803090000_manager_nationality_address_fields`
- `20260811120000_enquiry_foundation`
- `20260827110000_add_screening_module`
- `20260901100000_add_screening_conclusion_and_case_documents`
- `20260902100000_add_screening_case_results`
- `20260902120000_add_crrf_module`
- `20260903100000_update_crrf_internal_comments`
- `20260916110000_add_kyc_case_number`

## Current Server Deployment Command Pattern

```bash
cd /home/mis-test/htdocs/mis-test.newoon.com
git fetch origin
git checkout <branch-name>
git pull origin <branch-name>
npm install
npx prisma migrate deploy --schema backend/prisma/schema.prisma
npx prisma generate --schema backend/prisma/schema.prisma
npm run build
pm2 restart newoon-mis
pm2 save
```
