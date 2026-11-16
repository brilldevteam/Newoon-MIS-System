# Newoon MIS Developer Handover

## Dashboard Reporting Accuracy (2026-10-31)

- Dashboard Clients counts ACTIVE records only, matching the existing Clients register. PROSPECT records created during intake are not activated or deleted by this fix. Tenant totals query stored tenants instead of assuming one; users without a tenant cannot request tenant-scoped metrics.
- Preparation totals include returned, legacy AML preparation and final-document/signature stages. Approval totals include pending, in-progress, information-request and intermediate approval stages. The two dashboard-linked workflow filters use the same status sets; case transitions and unfiltered lists are unchanged. Rejected/on-hold cases are outside these active/approved groups.
- Counts remain database-derived and scoped to the current tenant (Super Admin spans tenants). Enabled modules counts enabled tenant-module assignments, not the module catalog. The percentage is explicitly labelled as the approval rate among tracked preparation/review/approved cases, not a general health score. Failed summary requests show an error rather than fabricated zero totals.
- Verify after building with `node backend/scripts/check-dashboard-summary.cjs`. Checks use synthetic persistence; deployed data, real database concurrency and server behavior require separate verification. No migration, seed or data rewrite is needed.

## Login and User Administration (2026-10-29)

- Login retains its original split branding/form layout, with equally sized input/button controls and responsive spacing. Fields start empty, with no default password or public demo-account shortcuts. Email whitespace/case is normalized; invalid credentials still fail bcrypt verification. This does not reset existing accounts or remove development seed data.
- Users now supports tenant-scoped account creation, profile/role/status editing and admin password reset. Company Admin cannot assign/manage Super Admin, suspend itself, change its own roles or remove the last active company admin. Service-level role checks remain mandatory even when area permissions are configured. Writes and audits share transactions; company-admin edits lock the tenant for last-admin checks.
- Assign existing workflow roles rather than inventing new role names. Global role/module permissions remain in the existing Super-Admin-only Access Control page. No schema migration, seed, invitation email or public registration was added. Password reset does not revoke existing JWTs; suspension is checked at subsequent requests. Do not claim full session revocation.
- Operator recovery: `node --env-file=backend/.env backend/scripts/reset-admin-password.cjs` from repo root in an interactive terminal. It changes only an existing administrator password, prompts privately and records an audit. See [User Administration](USER_ADMINISTRATION.md) for procedures and verification commands. Deploy frontend and backend together; server credentials/data were not modified locally.

## Preliminary to Full KYC Preparation (2026-10-27)

- Choosing full KYC completion creates an archived original and opens the populated new revision at `SUPERVISOR_REVIEW_PENDING`, with a Supervisor task. Completed review tasks are retained instead of deleted. Workflow/reviewer comments, submitted review versions, signatures/stamps in the archived form, generated exports and status history are not deleted by this conversion.
- Full conversion keeps internal review comments/reasons/conditions and submitted review data while reopening the current submission. Prior approval signatures/decisions are reset in the new draft only; prior approvals remain in the archived form and review versions. Confidential notes retain their existing access restrictions.
- Existing affected drafts at `AML_REVIEW_STARTED` are editable only when `fullKycStarted`, `AMENDMENT_DRAFT` and unlocked all match. Other cases at that status remain locked. No migration or data reset is needed. Verify with `node backend/scripts/check-kyc-form-revisions.cjs` and the review-lock checks after building; real multi-user/database tests remain necessary.

## Full KYC Compliance and Final Decision (2026-10-27)

- Full KYC Section D requires explicit Yes/No answers for PEP exposure, sanction exposure and dual citizenship before Supervisor submission; Yes answers require details. Drafts remain saveable. Unanswered questions are no longer displayed as an assumed No. The same saved values feed PDF and DOCX exports.
- Preliminary KYC excludes Section D from the editor and downloads. Explicit conversion to full KYC restores it and its submission checks. No database migration is required.
- AML Supervisor, DMLRO and MLRO can confirm final KYC or request completion/amendment after the existing final approval prerequisite. Existing administrator, AML Team preliminary and SEF permissions remain unchanged. This does not permit editing submitted review fields or bypass approval stages.
- Verify with `node backend/scripts/check-kyc-compliance.cjs` after building, plus the existing ownership/review checks. These are synthetic/mocked checks; verify role-specific handoffs on staging before release.

## KYC Revision Comparison (2026-10-13)

- Feature branch: `feature/kyc-amendment-comparison/2026-10-13`. DMLRO returns to AML, final-KYC amendments, and preliminary-to-full conversion archive the current form before advancing its revision. The active form is populated from the current data; historical snapshots have no write endpoint. The existing review routing, readiness checks and authorization remain enforced.
- `KycFormRevision` stores immutable section data, declaration/signature/stamp, return reason and actor/time. `KycRevisionFile` stores independent binary copies of available preparation attachments and active signed KYC uploads. Unavailable source files cannot be recovered. Storage capacity must account for copies per revision. Original client signatures remain as copied content; reviewer signature/date/decision/comment fields are reset for the new revision and old signed uploads become inactive, so prior approvals are not carried forward. Submitted review history remains available; confidential notes are not projected into the shared snapshots.
- Case action **Form history & compare** opens `/kyc/:id/revisions`. It supports original/current or two archived revisions, field changes, added/removed parties, side-by-side previews, archived attachments and downloads. Client-section differences are shown separately from review fields. Preliminary revisions download as PDF to keep the preliminary layout; standard revisions support PDF/DOCX. Export sequence numbers and form revision numbers are distinct.
- New revision saves require the loaded `expectedVersion`; autosave carries `version`. Conditional transactional updates prevent a stale tab from writing into the next form revision. Deploy both workspaces together. Existing version > 1 forms retain the old full-form presentation through `fullKycStarted`; new preliminary amendments retain preliminary presentation unless full KYC is explicitly opened.
- Apply `20261013110000_kyc_form_revisions` only after backup, using `npm exec -w backend -- prisma migrate deploy`. Do not seed/reset. No historical forms are invented: an existing case receives its first snapshot when returned/opened for amendment. This migration has not been applied locally to the configured database.
- Verify after build: `node backend/scripts/check-kyc-form-revisions.cjs`, `node frontend/scripts/check-kyc-form-diff.cjs`, and `node frontend/scripts/check-kyc-revisions-ui.cjs`. The UI check uses synthetic API fixtures and Chromium; screenshots go to `docs/kyc-revisions-preview/`. Mocked checks are not a database integration test. Before release, test V1 -> V2 -> V3, simultaneous returns/saves, attachment deletion/replacement, cross-tenant/role access and review resubmission on a disposable/staging database with the migration applied.

## Shared Return Feedback (2026-10-13)

- The case Comments panel displays submitted review feedback (formal comments, return reasons and conditions) and formal reviewer comments to users already authorized to view that case. Submitted version history keeps earlier return feedback visible after resubmission. Legacy snapshot fields are supported; draft review submissions and confidential notes/comments are not included in this shared projection.
- New submitted snapshots explicitly retain formal comments/reason/conditions/decision even when a separate `data` payload is supplied. No migration is required. Deploy frontend and backend together. Run `node backend/scripts/check-shared-review-feedback.cjs` after building, and verify return/resubmit and confidential visibility with staging accounts.

## Preliminary Review Handoff (2026-10-13)

- Proposed-company conversion preserves the completed Preliminary KYC JSON in Section A and transfers its declaration/signature/stamp into Section G. Review uses the same preliminary document component as enquiry details, with internal reviews kept separately below it, rather than replacing it with the standard KYC layout.
- Existing first-version preliminary cases fall back to their saved source-enquiry document and declaration where KYC fields are missing. Existing populated KYC declaration fields are not overwritten. Full-KYC amendments (version 2 onward) and standard cases retain their existing previews. No migration or database reset is required. Deploy both workspaces together.
- Run `node backend/scripts/check-preliminary-review.cjs` after building for synthetic snapshot/recovery/isolation assertions. Confirm the signed preliminary document across AML Supervisor and DMLRO with authorized staging accounts; local assertions do not establish live behavior.

## Preliminary PDF Download (2026-10-13)

- Enquiry details downloads Preliminary KYC directly from `GET /api/enquiries/:id/preliminary-kyc/pdf` rather than calling browser print. It uses authorized saved enquiry data and the existing Chromium renderer with empty headers/footers. Regular KYC exports are unchanged. The frontend and backend must be deployed together; existing PDF Chromium runtime requirements apply. User-entered form dates are retained, but browser timestamps/titles are not added.

## Indirect UBO Percentage (2026-10-13)

- Corporate-linked preliminary UBOs have a separate `uboPercentage` JSON field for their effective indirect interest in the client company. `ownershipPercentage` remains their stake in the corporate shareholder. UBO previews/totals and preliminary-to-KYC transfer use `uboPercentage`; direct-shareholder percentages are unchanged. No schema migration is required.
- The effective percentage is explicitly entered, not automatically calculated. Older linked entries must have this value completed before submission; saving an incomplete draft remains allowed. Unlinked/direct UBO behavior is unchanged.

## Ownership and Review Corrections (2026-10-06)

- The DMLRO submission page has a required rich-text AML Supervisor comments field, including preliminary cases without Section H. `submit-to-aml` accepts `formalComments`, sanitizes them and stores them via the existing locked review submission/snapshot and Section H synchronization where a form exists. Screening and CRRF checks remain enforced. Deploy both workspaces together.

- CRRF file selection remains staged until Save Draft. After upload succeeds, the document list updates immediately, even if saving the record subsequently fails. Unsaved risk rating/comments are preserved instead of being replaced by persisted upload-response fields. Run `node frontend/scripts/check-crrf-save.cjs` for mocked success/failure regression checks.

- The legacy DMLRO submission page uses `GET /api/kyc/:id/submission-readiness`, with the same server Screening/CRRF checks used for submission plus uploads and Supervisor comments. Missing requirements disable submission; failed requests display errors and clear the submitting state. Submission still revalidates on the server. Deploy frontend and backend together.

- Proposed-company direct shareholder percentages must be between 0 and 100 and total 100% before advancing or submitting Preliminary KYC. The backend also checks completeness on submission. Incomplete drafts remain saveable; separately entered beneficial owners are not added to the direct shareholder total.

- Preliminary shareholders now carry stable JSON IDs and an explicit Individual/Corporate Entity type. Natural-person UBOs can select a corporate parent. The IDs, type and parent links are transferred into KYC ownership section JSON; no schema migration is required.
- Preliminary and KYC previews merge marked natural-person shareholders with separately entered UBOs and deduplicate them. Editing or removing one shareholder no longer deletes an unrelated UBO by array position. Linked UBOs are included in the KYC preview and export diagrams.
- Both supervisor submission routes (including the legacy `submit-to-aml` endpoint used by the form) require completed screening for current parties, common-list results/evidence, and a CRRF risk rating with an uploaded CRRF document. Supervisor and DMLRO submissions require nonempty comments; empty rich-text markup does not qualify.
- Review comment fields use Tiptap for bold, italic, underline, highlighting, lists and paragraphs. DOMPurify protects browser rendering; `common/review-comments.ts` sanitizes stored formal/section-H comments and parses formatting for DOCX/PDF. Do not render unsanitized comment HTML. Legacy plain text remains supported.
- Comments, reasons, conditions and explanations use full-width preview/export rows. Long full-width DOCX rows can split across pages. The existing letterhead is preserved.
- Existing corporate parties entered before type/link metadata was supported must be explicitly classified and linked by the reviewer. Existing identity values containing `+` are not silently rewritten: identity numbers remain text, preserving leading zeros and letters.
- Run `npm run build`, then `node backend/scripts/check-ownership-review.cjs` for synthetic regression checks. Run the document preview/render commands below for layout verification. Production deployment needs `npm ci` for the editor/sanitizer dependencies; do not seed or reset the database.
- Use Node.js 22.12 or newer for the current dependency set (the existing `puppeteer-core` package requires it). Recheck runtime compatibility when updating the lockfile.

Reviewed against local source on 2026-10-05. This is a technical handover, not a live deployment audit or production-readiness certification. Read `../AGENTS.md` before making changes.

## Project and Architecture

Repository: https://github.com/brilldevteam/Newoon-MIS-System

An npm workspace monorepo contains React/Vite/TypeScript frontend and NestJS/Prisma/PostgreSQL backend. Run commands from the repo root and preserve the root lockfile. At review time the branch was `bugfix-2026-10-04` and latest application commit `fe8f4d6`; recheck both rather than assuming they remain current.

The application implements enquiry/preliminary intake, clients, KYC cases/forms, legal and supporting documents, screening, CRRF risk rating, internal reviews, signed-document uploads, final decisions, amendments, timelines, notifications, audit logs, and access control. Module catalog entries do not establish that Accounting, Payroll, or Reports are complete. Read services for exact workflow prerequisites; UI labels alone are not a specification.

| Location | Responsibility |
| --- | --- |
| `frontend/src/main.tsx` | React entry point and toast provider |
| `frontend/src/routes/router.tsx` | Routes and access wrappers |
| `frontend/src/layouts/AppLayout.tsx` | Application shell |
| `frontend/src/services/api.ts` | Axios transport, bearer token, error extraction |
| `frontend/src/pages/` | Business workflow views |
| `frontend/src/pages/KycFormEditorPage.tsx` | Editor and live HTML preview |
| `backend/src/main.ts`, `backend/src/app.module.ts` | Bootstrap, modules, environment, CORS, validation |
| `backend/src/auth/` | JWT authentication |
| `backend/src/common/guards/roles.guard.ts` | Role/access-area enforcement |
| `backend/src/access-control/` | Central access matrix |
| `backend/src/kyc/kyc.service.ts` | KYC workflow; `generateDocument` versions, stores and audits exports |
| `backend/src/kyc/export/kyc-document-model.ts` | Single source of KYC export wording, sections and value rules |
| `backend/src/kyc/export/kyc-docx-renderer.ts` | Word output via the `docx` library |
| `backend/src/kyc/export/kyc-html-renderer.ts`, `kyc-pdf-renderer.ts` | PDF HTML and shared headless-Chromium renderer (Puppeteer) |
| `backend/src/kyc/export/ownership-diagram.ts` | Ownership chart as SVG (PDF) and high-resolution PNG (DOCX) |
| `backend/src/kyc/export/kyc-export-assets.ts` | Bundled fonts, trimmed letterhead artwork, signature normalisation |
| `backend/src/screening/`, `backend/src/crrf/` | Screening evidence and risk-rating records |
| `backend/prisma/schema.prisma`, `backend/prisma/migrations/` | Models, enums, applied schema history |
| `backend/prisma/seed.ts` | Development bootstrap users, roles, tenant, module catalog |
| `backend/templates/kyc-part-1-template.docx` | Letterhead/footer artwork |
| `docs/kyc-export-preview/` | Synthetic sample and export-review gallery |

Backend routes use `/api`. When `frontend/dist` exists, Nest serves static frontend assets and an SPA fallback. Development uses Vite separately. JWT is stored in browser local storage and attached by Axios; review token-storage/XSS risk during security acceptance.

## Local Setup

Install Node.js/npm and PostgreSQL and create a separate development database. There is no checked-in Node version pin; agree and document a supported version compatible with the lockfile. Word is only needed for Windows visual export QA, not server operation.

```bash
npm ci
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

On PowerShell use `npm.cmd` if npm script shims are blocked and `Copy-Item` for copying. Never overwrite existing environment files. Set a development `DATABASE_URL` and strong `JWT_SECRET`, then:

```bash
npm run prisma:generate
npm exec -w backend -- prisma migrate deploy
```

For a new disposable development database only, review `backend/prisma/seed.ts` and run `npm run seed` for demo accounts. It contains a known default password and resets passwords for several existing seeded accounts. Change demo credentials immediately. Never seed a shared server as a normal deployment step.

In separate terminals:

```bash
npm run dev:backend
npm run dev:frontend
```

Local defaults: frontend `http://localhost:5173`, API `http://localhost:5000/api`, health `http://localhost:5000/api/health`. Vite proxies `/api` to port 5000. The previously configured staging backend uses port 4000.

## Configuration and Secrets

Do not include real `.env` files in the handover or Git. Transfer secrets through an approved private channel.

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection; backend only |
| `JWT_SECRET`, `JWT_EXPIRES_IN` | JWT signing and expiry |
| `PORT` | Backend port; default 5000 |
| `FRONTEND_URL` | Comma-separated exact CORS origins |
| `NODE_ENV` | Production/development behavior |
| `UPLOAD_DIR` | Upload storage; use an absolute persistent server path |
| `SIGNED_KYC_UPLOAD_DIR` | Signed-document storage override |
| `BODY_LIMIT` | JSON/urlencoded body limit; default `10mb` |
| `CHROMIUM_PATH` | Chrome/Chromium executable for KYC PDF; auto-detected when unset |
| `PDF_RENDER_CONCURRENCY` | Maximum simultaneous PDF renders; default `2` |
| `VITE_API_URL` | Public browser API base; `/api` for same-origin deployment |

Vite variables are public build-time values; never store keys in `VITE_*`. Changing them requires rebuilding the frontend. Backend loads `backend/.env` from repo root or `.env` from backend working directory. Keep database backups, uploads, and secrets separate from code deployment.

## Authorization and Data Safety

Roles include Super Admin, Company Admin, Operating Team, AML Team/Supervisor, DMLRO, MLRO, SEF, Accounting Team, and HR Team. Matrix levels are `NONE`, `VIEW`, and `EDIT` across enquiries, clients, KYC, screening, CRRF, approvals, and administration. Preserve Super Admin access and configured/fallback role behavior.

Tenant scoping, confidential review visibility, audits, notifications, and authorization must remain enforced on backend queries and actions. Frontend route/sidebar visibility does not secure the API. Do not rewrite applied migrations or use reset/db-push commands on shared databases without explicit authorization.

## Export Pipeline and Verification

KYC downloads (DOCX and PDF) mirror the in-app "Know Your Customer Form" live preview (`LiveDocumentPreviewPanel` in `KycFormEditorPage.tsx`) placed on the Newoon letterhead. Both are rendered from one document model (`export/kyc-document-model.ts`) that holds the section content and labels, so the two formats cannot drift apart. When the preview's sections or labels change, update the model too.

- Layout: A4, 15 mm side margins, letterhead and footer artwork from `backend/templates/kyc-part-1-template.docx` at full page width; Arial (Arimo in the PDF) at the preview's sizes; brand-900 (`#792326`) section bars over bordered boxes; two-column "Label: value" grids; data tables with a shaded header row; Section H split into AML Supervisor, DMLRO, MLRO and SEF groups (the preview uses the same grouping).
- Not printed in downloads by design: uploaded file names (Section F file column, Section D supporting documents, signature file names) and the additional-documents table.
- DOCX: built with the `docx` library; sections are nested tables so the bar and box match the preview.
- PDF: HTML rendered by one long-lived headless Chromium (`puppeteer-core`, no bundled browser) with a concurrency limit, 45 s timeout and all network requests blocked; the letterhead bands are drawn in Chromium's header/footer templates. Fonts (Arimo, Carlito, Noto Sans Arabic, Noto Sans Symbols 2) are embedded from `@fontsource` packages, so output does not depend on server fonts.
- Control Structure chart: same style as the preview (client company on top, "Layer N" rail, layer colours, "Beneficial" tags); vector SVG in the PDF and a ~300 dpi PNG in the DOCX. Wide structures switch to left-to-right; parties with a missing or cyclic parent are attached to the client instead of being dropped.
- AML Supervisor comments come from the stage's formal (non-confidential) submission comment.

Servers need a working Chrome/Chromium (set `CHROMIUM_PATH` if it is not in a standard location) and the `@napi-rs/canvas` platform package. System fonts are no longer required for exports. Generate new documents after code changes; saved exports are snapshots.

```bash
npm run build -w backend
node backend/scripts/preview-kyc-docx.cjs
```

This writes two synthetic fixtures as DOCX and PDF: `standard` (holding company, single shareholder, two officers) and `complex`, which covers a multi-layer structure, long, accented and Arabic names, missing values, six managers, signatures and an SEF review. On Windows with Word installed, follow `docs/kyc-export-preview/README.md` to render page images, then open `docs/kyc-export-preview/index.html`, which compares Word and PDF pages side by side. Inspect the DOCX in Word too; page images are a QA aid, not certification. Structures with more than about 12 parties side by side are scaled down; the diagram then notes that the table below is the complete record.

## Deployment and Rollback

Previously supplied staging details: `mis-test.newoon.com`, checkout `/home/mis-test/htdocs/mis-test.newoon.com`, PM2 `newoon-mis`, port 4000, NGINX/Cloudflare. These are historical owner-supplied details, not live-verified for this handover. Confirm with the owner and `pm2 describe newoon-mis`. No checked-in PM2 ecosystem configuration establishes server setup.

Back up the database, uploads, environment configuration, and deployed Git revision. Confirm the correct checkout, approved branch, and local changes before deploying:

```bash
cd /home/mis-test/htdocs/mis-test.newoon.com
git fetch origin && git checkout bugfixes-2026-10-05 && git pull --ff-only origin bugfixes-2026-10-05 &&
npm ci &&
npm run build &&
pm2 restart newoon-mis --update-env &&
pm2 save
```

KYC export fonts are bundled, so no system font packages are required. Provision and test Chromium separately (for example `chromium` or `google-chrome-stable`). Do not run Windows Word scripts on Linux. Do not operate on other PM2 apps or restart after failed builds.

Backend `prebuild` generates Prisma Client automatically; missing generation previously caused 153 cascading TypeScript errors. Generation is not a database migration. For approved schema changes, run `npm exec -w backend -- prisma migrate deploy` after backup and before restart according to the release plan. Do not use `migrate dev`, seed, `migrate reset`, or `db push` casually on shared servers.

```bash
pm2 status
pm2 logs newoon-mis --lines 50 --nostream
curl -i http://127.0.0.1:4000/api/health
curl -i https://mis-test.newoon.com/api/health
```

Health checks do not verify database workflows, auth, or exports. Smoke-test changed features. Ensure private uploads and environment files are not public. Previously exposed credentials need owner-coordinated rotation; do not reproduce them.

Rollback requires the prior revision, a clean deployment checkout, reinstall/build, and restart after success. Schema rollback needs a separate reviewed plan; code rollback does not reverse migrations or restore deleted data.

## Known Gaps and Acceptance Checklist

- AI assistant/review features were removed. A stale AI-specific 429 fallback string remains in `frontend/src/services/api.ts`; it is not an active integration.
- Server KYC PDF failures were previously reported. The renderer was rebuilt (shared browser, concurrency limit, clearer 503 errors) but has not been verified on the target host; check server logs for `KycPdfRenderer` after deployment.
- The frontend live KYC preview is not yet driven by the shared export model and can differ in wording from the downloads.
- No test/lint scripts are defined in workspace packages. Builds alone are not regression coverage.
- The recent install reported dependency vulnerabilities. Triage current `npm audit` results; do not run forced upgrades without review.
- Obtain repo access, safe development DB, staging access, agreed tool versions, storage permissions, and defect ownership from the owner.
- Build from a fresh install; test positive/negative permissions, cross-tenant isolation, confidential reviews, workflow transitions, uploads/downloads, notifications, and audits with synthetic records.
- Review seed behavior, JWT storage, uploads, and backend authorization during security acceptance.
- Historical change reports/registers are discovery aids, not proof of deployment state.

No real credentials, client records, or secrets are included here.
