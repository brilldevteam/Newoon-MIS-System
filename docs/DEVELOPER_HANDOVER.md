# Newoon MIS Developer Handover

## Clients Menu Removed (2026-11-10)

- **Sidebar:** the separate **Clients** item is gone. Onboarded clients are managed under **Compliance → Compliance Clients**, and new clients come in through **Enquiries**.
- **Old links:** `/clients` now redirects to `/compliance/clients`, so bookmarks keep working.
- **Still reachable but unlinked:** the client detail and edit pages (`/clients/:id`, `/clients/new`, `/clients/:id/edit`) still work, but the menu no longer links to them. The manual "Add client" form is therefore no longer in the menu.
- **Dashboard:** the "Clients" card is now "Compliance clients" (active onboarded clients). It opens Compliance Clients for every role that can see it. Its count already used `status = ACTIVE`, which matches the register's Active total.
- **Not affected:** backend endpoints, permissions and the `clients` access-control area.

## Resuming an Engagement on Hold (2026-11-10)

- **The problem:** an engagement put on hold (`CLIENT_ON_HOLD`) could not be resumed. The activation section and `completeEngagementDecision` / `uploadEngagementLetter` only accepted `KYC_FINAL_APPROVED` and `CLIENT_ACTIVATION_PENDING`.
- **The fix:** all three now also accept `CLIENT_ON_HOLD`. Operations can upload a new signed letter (earlier letters stay on file) and choose Convert, Reject or keep On hold. The case guide and activation section explain how to resume.
- **Client status on hold or reject:**
  - Holding or rejecting an engagement no longer changes a client that is already onboarded (has `activatedAt` or a `clientCode`), for example an existing client asking for new services.
  - A never-activated client stays `PROSPECT` while on hold, or becomes `REJECTED`, with `statusReason` recording why.
- **Register filter:** `COMPLIANCE_REGISTER_WHERE` (in `common/client-compliance.ts`) replaces the bare status filter. It also hides `ON_HOLD` clients that were never activated (no `activatedAt` and no code), so clients already held under the old behaviour drop out of Compliance Clients until they are converted. No data migration is needed.
- **Checks:** `check-compliance-clients.cjs` was updated.
- **Local verification:** the hold → new letter → convert flow was run through the API for both cases:
  - a never-activated client: kept out of the register while on hold, then got code CL-2026-0008 when converted;
  - an already-active client: status and code unchanged by the hold.

## Duplicate Enquiry Prevention (2026-11-10)

- **Server rule** (`backend/src/enquiries/enquiries.service.ts`): one open enquiry per company.
  - Names are compared ignoring case, spaces and punctuation, so "Nuclei W.L.L." and "nuclei wll" match.
  - Existing-company and proposed-company enquiries are checked against each other.
  - New-services enquiries are matched per client instead of by name.
  - An enquiry stays open until it is closed, or until its KYC case finishes (`CLIENT_ACTIVE`, `CLIENT_REJECTED`, `MLRO_REJECTED`, `SEF_REJECTED`).
  - Create and update both enforce it and return `409` with a plain message, for example: `An enquiry for "Nuclei" already exists: ENQ-2026-0011 (its KYC is in progress). Open ENQ-2026-0011 and continue there…`.
  - The check runs inside the enquiry-numbering advisory lock, so a double click cannot slip two copies through.
- **Live check:** `GET /api/enquiries/duplicate-check?enquiryType=&name=&clientId=&excludeId=` lets the form warn while typing. It is declared before `:id`.
- **Form** (`AddEnquiryPage.tsx`):
  - A "Possible duplicate" warning with an "Open ENQ-…" link appears, and Save/Create stay disabled while it shows.
  - A double click is ignored.
  - Once an enquiry is created, retrying after a failed attachment upload updates that same enquiry instead of creating a new one, and the error says the enquiry was saved.
  - The likely cause of the old duplicates was this case: a failed attachment upload left the form on "New Enquiry", and pressing the button again created another enquiry each time.
- **Existing duplicates** are not removed automatically. A Super Admin can delete the extra drafts from the Enquiries list (the delete is audited). Editing a remaining duplicate draft now shows the warning that names the enquiry to continue.
- **Checks:** `node backend/scripts/check-enquiry-duplicates.cjs` (mocked persistence). No migration is needed.
- **Local verification:**
  - The API refused a duplicate (`409`).
  - The form showed the warning and disabled Save for a duplicate name, and cleared it for a new name.
  - A test enquiry created before the cross-type fix was deleted from the local database.

## Step-by-Step Guidance and Plain-English Errors (2026-11-10)

- **KYC case page** (`frontend/src/components/KycCaseGuide.tsx`):
  - It replaces the one-line "Next step" banner with a progress bar: KYC preparation → DMLRO review → MLRO / SEF approval → Final KYC → Convert to client → Client active.
  - Below the bar is a "Your next step" box written for the signed-in role. The role that holds the case gets numbered steps and a button to the right page or section (`#final-kyc-decision`, `#client-activation`). Every other role sees "Nothing for you to do right now. This case is with …".
  - During AML preparation the box is a live checklist from `GET /kyc/:id/submission-readiness`, in work order: documents, KYC form Section D, screening, CRRF, then AML Supervisor comments. Each unfinished item says what is missing and links to where it is fixed.
  - "Submit to DMLRO" now always shows during preparation. It stays greyed out until everything except the comments is done. Before, it was hidden until a document was uploaded.
- **Readiness checks** (`kyc.service.ts`):
  - Each item now returns a `key` alongside its `label`.
  - Screening messages name exactly what is missing: people or companies not screened, screening lists without a result, matches without a comment, lists without evidence, and unfinished records with what each one lacks.
  - CRRF says separately whether the rating or the document is missing.
  - Section D messages say where in the form to answer.
  - Pass/fail logic is unchanged; only the messages changed.
  - Multi-issue messages are separated by newlines and rendered with `whitespace-pre-line`.
- **Submit to DMLRO page:** each checklist item has a "fix it" link and a done/needed state. The duplicate static rows were removed.
- **Enquiry page:**
  - A "Your next step" / "Where it is now" box covers draft, returned to BD, with the AML Supervisor, ready for KYC and converted.
  - "Return to BD" now needs a written reason in the status note, so Operations knows what to fix.
- **Final engagement form:** it now says whether the signed engagement letter is still required or already uploaded.
- **Checks:** `check-ownership-review.cjs` and `check-kyc-compliance.cjs` were updated for the new wording. No migration is needed.
- **Local verification:** the guide was checked in the browser at every stage, from AML preparation through Client active, as AML Supervisor and Operations, including phone width. The DMLRO, MLRO and SEF "your turn" views were not opened as those roles; they use the same code path as the views that were checked.

## Preliminary KYC Final Decision in One Step (2026-11-10)

- Before this change, **Final KYC Decision → Use Preliminary KYC as final** on an approved Preliminary (proposed-company) KYC sent the case back for a second DMLRO and MLRO approval. It also locked the form (`KycForm.status = PRELIMINARY_FINAL_REVIEW`). That lock disabled Section H for the reviewers, so those cases could not move on.
- That second round is removed. Confirming the approved Preliminary KYC as final now works like a normal KYC (`markApprovedKycFinal` in `backend/src/kyc/kyc.service.ts`):
  - The form becomes `FINAL` and locked, and the case goes straight to `KYC_FINAL_APPROVED`.
  - The first-round DMLRO and MLRO approvals stay submitted, so the activation checklist still counts them.
  - Status history and an audit entry are written.
  - The action locks the case row and refuses a repeat if the status has already changed.
- Both paths (Preliminary and normal) send one `CLIENT_READY_FOR_ACTIVATION` notification, "Final KYC approved - convert to client". It reaches Operations (and the AML/reviewer roles), and its link opens the KYC case, where Operations converts the case to a client and uploads the signed engagement letter. The legacy MLRO completion for a `PRELIMINARY_FINAL_REVIEW` form now sends this notification too.
- **Existing stuck cases:** `backend/scripts/finalize-preliminary-final-review.cjs` moves cases whose form is `PRELIMINARY_FINAL_REVIEW` and whose status is DMLRO/MLRO review pending or in progress to `KYC_FINAL_APPROVED`. It also:
  - locks the first-round DMLRO/MLRO submissions again;
  - removes the open second-round DMLRO/MLRO tasks;
  - sends the Operations notification and writes an audit entry.

  Any other case in that form state is listed and left alone. It is a dry run by default: build, then run `node --env-file=backend/.env backend/scripts/finalize-preliminary-final-review.cjs`, then rerun with `--apply` after a database backup.
- **Checks:** `node backend/scripts/check-preliminary-final.cjs` (mocked persistence). No schema migration is needed.
- **Local verification:**
  - A real local Preliminary case went from `MLRO_APPROVED` to `KYC_FINAL_APPROVED` through the API, and Operations received the unread notification linked to the case. No new DMLRO task was created.
  - The fix script was run against a local case inside a rolled-back transaction.
  - The Operations screen was not checked in the browser.

## End-to-End Check and Activation Fixes (2026-11-10)

- **Engagement letter at activation:** general KYC document uploads stay locked after submission, and Operations was never allowed to use them. The KYC page's **Submit decision** therefore failed when a letter was attached after final approval; activation only worked if the letter had been attached at the enquiry stage.
  - New `POST /api/kyc/:id/engagement-letter/upload` (multipart `files`; PDF, Word or image) for Operations, Company Admin or Super Admin.
  - It works only while the case is `KYC_FINAL_APPROVED` or `CLIENT_ACTIVATION_PENDING`, always stores the document as "Signed Engagement Letter", and audits `ENGAGEMENT_LETTER_UPLOADED`.
  - `KycCaseDetailsPage` uses it. Every other upload stays locked.
- **CR / QFC number on the register:** activation copies Section A `commercialRegistrationNo` into `Client.registrationNumber` (trimmed) when the client has none.
  - `backend/scripts/backfill-compliance-clients.cjs` has a second, re-runnable pass that fills it for existing register clients. It was applied locally to 3 clients.
- **End-to-end run (local, synthetic data):**
  - Six demo staff accounts (`demo.*@demo.newoon.invalid`, company Newoon, one per role) drove two demo clients through the whole flow:
    - enquiry → conversion → KYC form with shareholders, UBOs and officers
    - screening of every party and all lists → CRRF
    - Supervisor → DMLRO → MLRO, with four-eyes enforced → final KYC
    - engagement letter → activation
    - Compliance Clients: code, profile tabs, CRRF privacy, access rules, documents, review → risk change → DMLRO approval, screening alert open and close, expiry bands, export, notifications
  - The second client used the post-approval letter upload. Every check passed except the pre-submission readiness item for Supervisor comments, which is expected because those comments are entered at submission.
  - The demo clients `Demo Pearl Trading W.L.L.` (CL-2026-0006) and `Demo Lusail Logistics W.L.L.` (CL-2026-0007) and the demo accounts remain in the local database only.

## Mobile Layout and Installable App (PWA) (2026-11-09)

- **Mobile navigation:** below the `lg` breakpoint the sidebar is replaced by a header menu button that opens a slide-in drawer.
  - The drawer is the same `NavItems` component as the desktop sidebar (same role filtering and Compliance group) and shows the user, an **Install app** button and **Log out**.
  - It closes on navigation, Escape or a backdrop tap, and locks page scroll while open. Desktop is unchanged.
  - Pages show an amber banner when the device is offline.
- **PWA files** (in `frontend/public/`):
  - `site.webmanifest`: standalone display, scope and start URL `/`, theme `#b81f23`, any/maskable icons, shortcuts to Compliance Clients and KYC Workflow.
  - `icon-maskable-192.png` and `icon-maskable-512.png`.
  - `sw.js`: the service worker.
  - `index.html` adds iOS home-screen tags and `viewport-fit=cover`; layout padding includes `env(safe-area-inset-bottom)`.
- **Service worker** (`sw.js`), registered by `src/pwa.ts` in production builds only:
  - Navigation is network first, falling back to the cached app shell when offline.
  - Hashed `/assets/*` files are cached at first use (cache-first, capped at 120 entries).
  - Brand and icon files are served from cache and refreshed in the background.
  - It **never handles `/api`**, non-GET or cross-origin requests, so no client or KYC data is stored on the device.
  - Bump `CACHE_VERSION` to discard old caches.
  - Make sure NGINX/Cloudflare do not cache `/sw.js` for long, or updates to it will be delayed.
- **Install:** Chrome and Edge (Android/desktop) get an **Install app** button in the mobile drawer. On iPhone Safari the button explains Share → Add to Home Screen. HTTPS is required (`localhost` is exempt).
- **Same-origin CORS fix:** Vite marks the bundle `<script>`/`<link>` as `crossorigin`, so the browser sends the page's own `Origin` even for same-site requests. Previously, when the backend served `frontend/dist` and that origin was missing from `FRONTEND_URL`, the CORS check answered asset requests with 500 and the page stayed blank.
  - `main.ts` now also allows a request whose `Origin` host equals its `Host` header (`common/security/same-origin.ts`). Listed origins still work, and requests without an Origin are unchanged. Other origins, including lookalike hosts, are still refused before any handler runs.
  - Behind NGINX, keep `proxy_set_header Host $host;` so the public host reaches the backend. Without it, list the public origin in `FRONTEND_URL` as before.
  - Verify with `node backend/scripts/check-same-origin.cjs`. Locally, `http://localhost:5000` now renders, and the service worker registers there.
- **Verification (local):**
  - About 14 routes had no horizontal overflow at 375px.
  - The drawer opened, navigated and closed (Escape, backdrop).
  - Desktop sidebar unchanged.
  - Production preview: the service worker registered and controlled the page; only shell and `/assets` files were cached; nothing under `/api`; with the server stopped, the app still opened from cache.
  - All `frontend/scripts/check-*.cjs` passed.
  - Not verified: installation on a real Android or iPhone device, and behaviour behind the production proxy.

## Branding and Favicon (2026-11-09)

- Newoon Global LTD. logos supplied by the client live in `frontend/public/brand/`: `newoon-logo.png` (full logo, trimmed) and `newoon-mark.png` (the "n" globe mark, cut from the full logo for resolution).
  - The sidebar shows the full logo (the mark when the focused-workspace sidebar is collapsed).
  - The login page shows the mark on the red panel and the full logo above the form.
- Favicons and app icons in `frontend/public/` are generated from the same mark: `favicon.ico` (16/32/48), `favicon-32x32.png`, `apple-touch-icon.png`, `icon-192.png`, `icon-512.png`, with `site.webmanifest`. They are linked from `frontend/index.html`.
- Nothing is loaded from the old app.newoon.com system. Replace the files in place to update the branding.
- Scope: the client decided on 2026-11-09 not to import data from the old system, so the planned Phase 5 legacy import is dropped. `legacyClientCode` (`CL-LEG-NNNN`) is unused unless that changes.

## Compliance Client Monitoring, Phase 4 (2026-11-09)

- The client page gains three tabs:
  - **Screening**: an ongoing screening log with date, scope, lists checked, result (Pending/Clear/Review/Alert), summary and evidence files.
  - **Reviews & Risk**: periodic reviews and risk changes.
  - **Expiry**: passports, QIDs, CR, trade licence, computer card and other documents with expiry dates.
- **Header and register:** the header shows badges for a pending risk change, a review in progress and an open screening alert.
  - The register adds a "Needs attention" strip (risk approvals, open screening alerts, documents expiring within 30 days, reviews in progress). Each count is also an `attention` filter.
  - Rows show inline flags.
  - The Excel export adds latest screening, screening date, nearest expiry and pending risk change columns.
- **Risk changes** (`ClientRiskChange`):
  - A compliance editor requests the change with a proposed risk, an optional CDD type, a `RiskOverrideReason` and an explanation. Only one can be pending per client.
  - DMLRO, MLRO, Company Admin or Super Admin approve or reject it. This is checked in the service, not only by the matrix. The decider must be a different person from the requester, the row is locked during the decision, and a rejection needs a note.
  - Approval sets risk and CDD and recalculates `nextReviewDate` from `lastReviewDate` under the new risk. The requester (or a decider) can withdraw a pending change.
- **Periodic reviews** (`ClientReview`):
  - Active clients only, and one in progress at a time.
  - Completion requires a screening recorded since the review started, plus findings.
  - Outcomes are No change, Risk change requested (creates a pending risk change) and Exit recommended. Exit only records the recommendation; marking the client inactive is still a separate register action.
  - Completion sets `lastReviewDate` to now and `nextReviewDate` by the current risk. Clients with no risk level get no next review date.
- **Screening** (`ClientScreening`): Review and Alert results notify immediately. A client counts as an open screening alert until a later screening is Clear or Pending. Evidence files are `ClientDocument` rows in the system "Screening Evidence" folder (`screeningId`), validated before the screening is saved. That folder is not offered for ordinary uploads.
- **Reminders** (`ComplianceRemindersService`):
  - Runs 60 seconds after start, then every `COMPLIANCE_REMINDER_INTERVAL_HOURS` (default 6). `COMPLIANCE_REMINDERS_ENABLED=false` turns it off.
  - Notifies reviews due within 30 days or overdue, tracked documents at the 90/60/30-day and expired stages (the current stage only), and risk changes pending for more than 3 days.
  - Each milestone is claimed in `ComplianceReminder` (unique per tenant/kind/entity/milestone) together with the notification, so repeated runs and several PM2 processes notify once.
  - `POST /api/compliance/reminders/run` lets Company/Super Admin run it for their company.
- **Notifications:** new types `COMPLIANCE_*` with an optional `Notification.clientId`. They go to AML Team/Supervisor, DMLRO and MLRO; risk approval requests go to DMLRO/MLRO; expiry also goes to Operations. Clicking one opens the matching client tab.
- **API** (compliance area), all under `/api/compliance/clients/:clientId/`:
  - `GET monitoring`
  - `POST screenings` (multipart)
  - `POST risk-changes`, `POST risk-changes/:id/decision`, `POST risk-changes/:id/cancel`
  - `POST reviews`, `POST reviews/:id/complete`, `POST reviews/:id/cancel`
  - `POST expiry-items`, `PATCH expiry-items/:id`
  Every write is audited.
- **Migration:** `20261110120000_compliance_monitoring` adds the tables, enum values and the notification client column. It is applied to the local development database only. It adds enum values with `ALTER TYPE … ADD VALUE`, which needs PostgreSQL 12 or newer.
- **Verification:**
  - `node backend/scripts/check-compliance-clients.cjs` (synthetic: four-eyes approval, approval effects, review rules, screening alert notification, expiry stages, one-time reminders).
  - In the local app as Super Admin on client abc-new, I checked adding an expiry record, starting and completing a review (completion blocked until a screening was recorded), an Alert screening, requesting a risk change, the four-eyes message for the requester, the register attention strip and filter, an automatic reminder notification, and opening a notification to the right tab.
  - Not exercised in the browser: approval by a second DMLRO/MLRO account (covered only by the synthetic check), and other roles.
  - That test left a completed review, an Alert screening, a QID expiry record and a **pending** risk change on abc-new in the local database.

## Compliance Client Documents, Phase 3 (2026-11-09)

- The client page has three new tabs:
  - **CDD**: customer due diligence evidence.
  - **Monitoring**: ongoing monitoring evidence.
  - **Compliance Docs**: Policy & Procedure Manual, Training Materials, Review Reports and Meeting Minutes, plus custom folders.
- **Folders** (`ClientDocumentSection`) belong to a company and are shared by all its compliance clients. The six defaults are created on first use. Editors can add custom Compliance folders and archive them. Archived folders accept no uploads and stay visible only while they hold files. Default folders cannot be renamed or archived.
- **Files** (`ClientDocument`) belong to one client.
  - Uploads accept up to 20 files at once. Each has an optional document name (defaults to the file name) and notes.
  - Files are checked with the shared upload rules: PDF, Word, Excel or image, 10 MB, matching extension, MIME type and file signature.
  - Files are stored at `<CLIENT_DOCUMENT_UPLOAD_DIR>/<tenantId>/<clientId>/<random name>`. The default is `uploads/client-documents` under the backend working directory. Use an absolute persistent path in production and include it in backups.
- **Removal is a soft delete.** The row and file are kept, an optional reason is stored, and the file is no longer listed or served. Uploads, removals and folder changes write audit entries (`ClientDocument`, `ClientDocumentSection`). Hard-deleting a client from the Clients register cascades the document rows, but the files stay on disk.
- **API** (compliance area: view for GET, edit otherwise), all under `/api/compliance/clients/:clientId/`:
  - `GET documents`
  - `POST documents` (multipart `files`, `sectionId`, `title`, `notes`)
  - `GET documents/:id/view`
  - `POST documents/:id/delete` (`reason`)
  - `POST document-sections`
  - `PATCH document-sections/:id`
- **Migration:** `20261110090000_client_documents`, applied to the local development database only.
- **Verification:** `node backend/scripts/check-compliance-clients.cjs` (synthetic persistence: default folders, tenant/prospect scoping, upload validation, path-traversal refusal, soft delete, folder rules). In the local app against the local database, I checked upload with a generated test PDF, view, rejected HTML/fake-PDF/extra-field uploads, removal with a reason, and adding/archiving a folder. That test left one removed test document on client abc-new and one archived empty folder in the local database. The old system's Screening uploads (Clear/Review/Alert) are not included; ongoing screening is Phase 4.

## Compliance Client Profile, Phase 2 (2026-11-09)

- Sidebar: a collapsible **Compliance** group (`navItems` in `layouts/AppLayout.tsx`, `NavGroupItem`) holds **Compliance Clients**. It opens automatically on `/compliance/*` pages and is hidden when the user can see none of its items. Add later compliance pages (for example Compliance Staff) as children of that group. In the collapsed focused-workspace sidebar, children show as icons.
- `/compliance/clients/:id` (linked from the register's client name and View button) replaces the legacy client detail page. Its header shows code, status, risk, CDD, review dates, engagements and contact details.
- Tabs: Overview (register details, risk history, onboarding assessment, key contact), Company, Directors & Managers, Shareholders, Secretary, SEF, UBOs, KYC & Documents, CRRF and Engagements. The legacy "BRA Sheet" is the CRRF; there is no separate BRA category.
- `GET /api/compliance/clients/:id` (compliance view) reads company and party details from the client's profile KYC case: the latest CLIENT_ACTIVE case with a form, else the latest case with a form. It uses the new read-only `KycService.formSnapshot`, which never creates a form or KYC number, and nothing is copied into client tables. Mapping lives in `compliance-clients/compliance-client-profile.ts`.
  - UBOs use the same `beneficialOwners` merge as the KYC preview/exports.
  - Officers are grouped by position text (Secretary, SEF / Senior Executive Function, Director, managers and signatories); one person can appear in several tabs.
- CRRF rating and file names are returned only to roles with CRRF view access; CRRF reviewer comments are never returned. Document View and KYC links reuse the existing KYC endpoints, so they still require KYC access.
- Overview lets compliance editors change jurisdiction, email, phone and address through the existing audited `PATCH`. KycModule now exports KycService.
- Not yet: client-level document folders, ID expiry dates (the KYC form does not capture passport/QID expiry), editing parties, and the periodic-review workflow. These are Phases 3–4.
- Verification: build plus `node backend/scripts/check-compliance-clients.cjs` (now also checks profile mapping, profile-case choice, CRRF restriction and tenant scoping). Each tab and the document viewer were checked in the local app against the local development database with the Super Admin account. Other roles were not exercised in the browser.

## Compliance Clients Register, Phase 1 (2026-11-09)

- Ports the register part of the legacy app.newoon.com Compliance → Compliance Client module. `/compliance/clients` lists onboarded clients (ACTIVE, INACTIVE, ON_HOLD) with client code, CR/QFC number, jurisdiction, CDD type (SDD/RDD/EDD = `DueDiligenceType`), risk, status, last/next review, latest engagement and KYC case. It has search, filters, pagination, stat cards and a real `.xlsx` export (`GET /api/compliance/clients/export/excel`, capped at 5,000 rows). Users with edit access can set the CDD type and mark a client inactive (reason required) or reactivate it. Every change writes an `AuditLog` entry (`entityType` `ComplianceClient`). Clients on hold are still released only through the KYC engagement decision.
- **Schema** (`20261109100000_compliance_client_register`, then `20261109120000_client_code_format`, which turns `clientCode` into text): new nullable `Client` fields (`clientCode` unique per tenant, `jurisdiction`, `email`, `phone`, `address`, `cddType`, `riskLevel`, `lastReviewDate`, `nextReviewDate`, `activatedAt`, `statusReason`), plus a new `ClientEngagement` model (the legacy "job"), linked 1:1 to a KYC case where one exists. `Client.status` remains a string in this phase.
- **Client code format:** `CL-<activation year>-<4 digits>` (for example `CL-2026-0001`), restarting each year like KYC (`KYC-2026-0007`) and engagement (`ENG-2026-0001`) numbers. Both client codes and engagement numbers are issued as the highest existing number + 1, so deleting a record never reissues a number. Clients imported from the legacy system will keep their old number as `CL-LEG-0263` (`legacyClientCode` in `common/client-compliance.ts`). The register sorts by activation date, not by code.
- **Activation:** `CONVERT_TO_CLIENT` in `completeEngagementDecision` now also assigns the next client code (keeps an existing one), and copies risk (reclassification > internal review > CRRF) and CDD type from the case. It also sets `lastReviewDate` to now and `nextReviewDate` by risk (High 1 year, Medium 2 years, Low 3 years; `common/client-compliance.ts`), and creates an IN_PROGRESS engagement `ENG-<year>-NNNN`. Code/number conflicts retry up to three times. Clients activated before this release have no code, risk or review dates until they are imported or re-activated. The import of the 263 legacy clients is a later phase.
- **Backfill for clients activated before this release:** `backend/scripts/backfill-compliance-clients.cjs`. It is a dry run by default; `--apply` writes. Run it from the repo root after `npm run build`: `node --env-file=backend/.env backend/scripts/backfill-compliance-clients.cjs [--apply]`. It applies only to Active/Inactive/On-hold clients without a code. In activation order it assigns `CL-<year>-NNNN`, risk and CDD from the latest KYC case, activation date (the case's CLIENT_ACTIVE history, else the client's last update), last review = activation, next review by risk, contact email/phone, and an engagement for the case. It never changes status. It writes one audit entry per client (`COMPLIANCE_REGISTER_BACKFILL`) and is safe to re-run (a second run finds nothing). Back up first on any shared server. It was applied to the local development database only (5 clients, CL-2026-0001 to 0005). Clients whose case has no risk rating remain "Pending" with no review date until risk is set.
- **Manual clients:** clients created with Add Client now start as `PROSPECT` instead of `ACTIVE`. `GET /api/clients?status=ACTIVE|PROSPECT|ALL` (default ACTIVE). The Clients page has a status filter, and Create KYC Case lists all statuses so prospects can start KYC. Dashboard "Clients" still counts ACTIVE only.
- **Access:** new matrix area `compliance`. Defaults: Company Admin, AML Team, AML Supervisor, DMLRO and MLRO edit; SEF and Operations view; others none. When the matrix has already been saved, the migration inserts those same grants; adjust them afterwards in Access Control. Frontend visibility is presentation only; `RolesGuard` maps `ComplianceClientsController` to the area.
- **Dependency:** `exceljs@^4.4.0` (backend). `npm audit` reports one moderate advisory through its bundled `uuid`; the export only writes workbooks. Run `npm ci` on deploy.
- **Deploy:** back up the database, then run `npm exec -w backend -- prisma migrate deploy` before restarting, and deploy both workspaces together. Both migrations have been applied only to the local development database (`localhost/newoon_mis`), not to staging or production.
- **Verification:** run `node backend/scripts/check-compliance-clients.cjs` after building (synthetic persistence: review cycle, risk/CDD precedence, filters/tenant scoping, audited updates, xlsx round-trip, prospect intake, activation with code retry, access defaults vs migration grants). The page was also checked in a local Vite build against a synthetic mock API. Real-database behaviour, migration on staging data, concurrent activations and role access with staging accounts remain unverified.

## Self-Service Password Change (2026-11-01)

- Every authenticated role can open Change Password in the sidebar at `/account/password`. `POST /api/auth/change-password` derives the account only from its verified JWT; no target account ID is accepted. Current password, a different new password (at least 8 characters with a capital letter, a number and a symbol (maximum 72 UTF-8 bytes)), and matching confirmation are required.
- Uses existing login throttling/lockout and session-version security. Hash verification precedes an atomic compare-and-update, session-version increment, pending login-code removal and credential-free audit. Success signs the browser out and requires a fresh login. No role, tenant or workflow records are changed.
- This feature relies on the existing uncommitted login-protection/sessionVersion work in this checkout, including its migration; it cannot be deployed independently to an older schema. Preserve and review those changes separately. Verify after build with `node backend/scripts/check-self-password.cjs`; synthetic tests do not replace staging verification.

## Dashboard Reporting Accuracy (2026-10-31)

- Dashboard Clients counts ACTIVE records only, matching the existing Clients register. PROSPECT records created during intake are not activated or deleted by this fix. Tenant totals query stored tenants instead of assuming one; users without a tenant cannot request tenant-scoped metrics.
- Preparation totals include returned, legacy AML preparation and final-document/signature stages. Approval totals include pending, in-progress, information-request and intermediate approval stages. The two dashboard-linked workflow filters use the same status sets; case transitions and unfiltered lists are unchanged. Rejected/on-hold cases are outside these active/approved groups.
- Counts remain database-derived and scoped to the current tenant (Super Admin spans tenants). Enabled modules counts enabled tenant-module assignments, not the module catalog. The percentage is explicitly labelled as the approval rate among tracked preparation/review/approved cases, not a general health score. Failed summary requests show an error rather than fabricated zero totals.
- Verify after building with `node backend/scripts/check-dashboard-summary.cjs`. Checks use synthetic persistence; deployed data, real database concurrency and server behavior require separate verification. No migration, seed or data rewrite is needed.

## Login and User Administration (2026-10-29)

- Login retains its original split branding/form layout, with equally sized input/button controls and responsive spacing. Fields start empty, with no default password or public demo-account shortcuts. Email whitespace/case is normalized; invalid credentials still fail bcrypt verification. This does not reset existing accounts or remove development seed data.
- Users now supports tenant-scoped account creation, profile/role/status editing and admin password reset. Company Admin cannot assign/manage Super Admin, suspend itself, change its own roles or remove the last active company admin. Service-level role checks remain mandatory even when area permissions are configured. Writes and audits share transactions; company-admin edits lock the tenant for last-admin checks.
- Assign existing workflow roles rather than inventing new role names. Global role/module permissions remain in the existing Super-Admin-only Access Control page. No schema migration, seed, invitation email or public registration was added. Password reset does not revoke existing JWTs; suspension is checked at subsequent requests. Do not claim full session revocation.
- First Super Admin: `node --env-file=backend/.env backend/scripts/create-super-admin.cjs` from repo root in an interactive terminal. It works only when no active Super Admin exists and the email is unused. It prompts privately, creates one platform-level (no company) Super Admin and records an audit. It never touches other users; do not use the seed for this.
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
| `TRUST_PROXY` | Set behind NGINX/Cloudflare (for example `loopback` or `1`) so sign-in throttling sees real client addresses; unset when the API is reached directly |
| `LOGIN_OTP_ENABLED` | `true` requires a 6-digit email code after the password; leave `false` until SMTP works |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`, `MAIL_FROM` | Outgoing email for sign-in codes; secrets go only in `backend/.env` |
| `LOGIN_OTP_DEV_LOG` | Development only: print codes to the server log when SMTP is not configured; ignored in production |
| `VITE_API_URL` | Public browser API base; `/api` for same-origin deployment |

Vite variables are public build-time values; never store keys in `VITE_*`. Changing them requires rebuilding the frontend. Backend loads `backend/.env` from repo root or `.env` from backend working directory. Keep database backups, uploads, and secrets separate from code deployment.

## Authorization and Data Safety

Roles include Super Admin, Company Admin, Operating Team, AML Team/Supervisor, DMLRO, MLRO, SEF, Accounting Team, and HR Team. Matrix levels are `NONE`, `VIEW`, and `EDIT` across enquiries, clients, KYC, screening, CRRF, approvals, and administration. Preserve Super Admin access and configured/fallback role behavior.

The Access Control matrix decides what each role can view or edit per area (`common/guards/roles.guard.ts`); once saved it replaces an endpoint's `@Roles` list, so actions that must never be grantable (user management, review-stage decisions) also check roles in their services. Platform-wide endpoints (tenants, tenant modules, modules, permissions) are not part of the matrix and stay Super Admin only. Review approvals follow a four-eyes rule enforced in `lockReviewSubmission`: one person can submit only one stage of a case per approval round. Never include a User relation with `true` in a Prisma query that reaches an API response; use `userSummarySelect` (`common/user-summary.ts`). Tenant scoping, confidential review visibility, audits, notifications, and authorization must remain enforced on backend queries and actions. Frontend route/sidebar visibility does not secure the API. Do not rewrite applied migrations or use reset/db-push commands on shared databases without explicit authorization.

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
