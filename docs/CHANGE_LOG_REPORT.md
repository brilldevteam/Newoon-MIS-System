# Newoon MIS Application Change Log Report

This report tracks the Newoon MIS application from the initial project commit onward. Every new feature, bug fix, UI update, workflow change, database migration, and deployment-relevant change should be added here before the work is considered complete.

## Maintenance Rules

- Keep newest entries at the top.
- Add a dated entry for every completed change set.
- Include the affected module, summary, changed files, database migrations, verification, branch, commit, and deployment notes.
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
