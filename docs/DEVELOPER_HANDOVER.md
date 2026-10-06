# Newoon MIS Developer Handover

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
