# Newoon MIS Developer Handover

## Fill from a Copy on the Enquiry and KYC Forms (2026-11-24)

Requirement A03: uploading a company's CR or a person's passport / QID fills the form, including the expiry dates. Builds on the readers from Phase 2 (`DocumentReaderService`: the company's AI service when it is set up, otherwise this server) and the passport / QID reader (`IdDocumentReaderService`, machine-readable lines, always on this server). Nothing is saved by reading: values are filled in, the note says what was filled and what to check, and staff save the form as usual.

- **KYC form** (`KycFormEditorPage.tsx`):
  - **Section A**: "Fill from the Commercial Registration (CR)" fills legal name, CR number, tax number, date of incorporation, **CR expiry date** (new Section A field), country of incorporation, legal form, registered office address and license activities. Country and legal form take the matching list option (whole words only), otherwise "Other" with the text that was read. The CR is also uploaded to Section F (*Commercial Registration / CR Extract*). When the CR is read by the AI service, the people listed on it are named in the note (they are not added to Sections B / C automatically).
  - **Section F**: uploading a file to *Commercial Registration / CR Extract* also reads it into Section A, with the same note under that row.
  - **Person rows** (individual shareholders, beneficial persons, managers, key communication person): "Fill from a copy" (Passport / QID back side) fills the number, its **expiry date**, and the date of birth and name when empty, and uploads the copy to Section F (*QID / Passport copies*). Corporate shareholders get "Fill from the company's CR" (name, CR number, date of incorporation, registered address; copy to *CR of legal entity parties*).
  - **Typed values are never overwritten**: only empty fields are filled; a different typed value is listed with a "Use the document values" button.
  - **Expiry dates**: the QID / passport expiry inputs stay off the form (business decision of 2026-11-23). The values read are stored on the row as before and shown as an "On file: QID expiry ..." line under the fill bar. The CR expiry date is a Section A field but is not printed on the KYC document.
- **Enquiry form** (`AddEnquiryPage.tsx`, `PreliminaryOwnershipEditor.tsx`): an existing legal entity's CR (Details step) fills the company name and is attached under *Corporate Documents - Company*; a corporate shareholder's CR (Ownership step) fills its name, CR number, date of incorporation and country of registration and is attached with the corporate shareholder documents. The passport / QID fill on enquiry people is unchanged in behaviour and now uses the shared `DocumentFillBar` and `utils/document-fill.ts`.
- **Endpoints** (nothing stored, one file, standard document types only):
  - `POST /api/kyc/:id/form/read-document` (multipart `files`, `kind` = `COMPANY` | `PASSPORT` | `QID`): AML Team, AML Supervisor, Company Admin, Super Admin, only while the case can be edited (`requireWritableCase`: tenant scope and the preparation / returned statuses). A CR uses the **case's company** AI settings.
  - `POST /api/enquiries/company-documents/read` (multipart `files`): Operations, AML Supervisor, Company Admin, Super Admin; uses the **user's company** AI settings (a Super Admin without a company gets the server reader).
- **Client records**: `syncClientRecordsFromKyc` now copies Section A `crExpiryDate` (YYYY-MM-DD only) to the client's CR expiry and Expiry tab on activation and re-KYC approval. An empty value never clears the client's date, and a later client-page edit wins as for the other fields.
- **Wiring**: new `DocumentReaderModule` (exports both readers) imported by the compliance-clients, KYC and enquiries modules; `common/identity-reading.ts` holds the passport / QID answer shape shared by the enquiry and KYC endpoints. No migration, no new environment variables, no new packages.
- **Privacy**: with the company's AI service switched on, a CR read on the enquiry or KYC form is sent to OpenAI, as in the legal documents register. Passport / QID copies are never sent; they are always read on this server.
- **Checks**: `node backend/scripts/check-document-fill.cjs` (new: endpoints, limits, tenant scope, locked cases, reader failures) and the CR expiry case in `check-client-records.cjs`. 31 of 32 `check-*.cjs` pass after `npm run build`; `check-kyc-resubmit-tasks.cjs` fails on this branch before and after this change (its mocked transaction has no `internalReviewSubmission`). The frontend fill helpers were checked with a throw-away script (empty-only filling, "Other" for unknown legal forms, whole-word country matching such as Oman vs Romania, the QID-read-as-passport warning).
- **Not verified**: the screens in a browser against a running server (no local database was used), a real OpenAI key, real Qatari CRs and ID scans, Arabic CRs with the server reader. Test on the test server: Section A fill, Section F CR upload, a person row with a passport and with a QID back, a corporate shareholder CR, the enquiry Details and Ownership steps, and a case under DMLRO review (reading refused).
- **Deploy**: `npm run build`, restart both workspaces. No migration.

## Client Profile Rework, Phase 5: KYC Form and Export (2026-11-23)

Decisions (business, 2026-11-23): hide QID / passport expiry from the KYC and keep them in the system; per-person PEP and dual citizenship with the Section D questions kept; add the new designations and keep the older ones; keep "I hereby confirm" in the client declaration.

- **KYC form** (`KycFormEditorPage.tsx`): every person row (managers, shareholders who are individuals, beneficial persons, key communication person) has **Title** (Mr, Ms, Mrs, Dr, Sheikh, Sheikha), **Dual citizenship** (Yes / No) with **Other nationality**, and **PEP** (Yes / No) with **PEP details**. The QID expiry and passport expiry inputs are gone from the form (stored values on older KYCs are kept and still feed the client records). The position list adds Managing Director, Chairman, CEO, CFO, COO, Shareholder and UBO; Interest Holder, Beneficial Person and Compliance Officer stay. Section D keeps its two questions and shows a note when a person is marked PEP / dual citizen but the company-level answer is not Yes. The answer is **not** changed automatically, so reviewers' answers are never overwritten.
- **Storage**: manager rows are a database table, so migration `20261123100000_kyc_person_declarations` adds nullable `title`, `dualCitizenship`, `otherNationality`, `isPep`, `pepDetails` text columns to `KycManager` (additive). The other rows are JSON and need no migration.
- **Printed KYC** (`kyc-document-model.ts`, so Word, PDF and the HTML preview): the title is printed with the name in the manager, shareholder, beneficial person and key contact tables; Section D adds "PEP (by person)" and "Dual citizenship (by person)" lines **only when someone answered Yes**. A KYC without the new answers prints exactly as before. QID / passport expiry dates were never printed and still are not. The client declaration wording is unchanged.
- **Client records**: the answers flow into the person records on activation and re-KYC approval (Yes / No become booleans), and back into a re-KYC prefill (client-page edits win, untouched rows keep their own values). If the same person answered differently on two rows, **Yes wins for PEP and dual citizenship**. The designations Shareholder, UBO, CEO, CFO, COO, Managing Director and Chairman become roles.
- **Checks**: `node backend/scripts/check-kyc-person-declarations.cjs`. All 31 `check-*.cjs` pass after `npm run build`.
- **Local test** on a fresh copy of the local database: 14 end-to-end checks (new fields saved through the real form API and read back, Word file contains the title and the Section D lines, an older KYC shows nothing new, approval carries the answers into the people records) and the Phase 3 test (72) still passes; the form was opened in the browser (new fields present, no expiry inputs).
- **Not verified**: **Word itself**. Opening and rendering the DOCX in Word was not done (automation was declined and the earlier hang on this machine stands), so the Word page layout is unchecked; the same content was checked in the HTML export in Chrome and the DOCX content with XML assertions only. Per the repo rules, please open `declarations`-style samples in Word before deploying. Also not done: the live document preview inside the form editor does not show the title or per-person lines yet; the Preliminary KYC (enquiry) screens are unchanged; auto-fill from documents at the enquiry and KYC form stage (A03) was added on 2026-11-24 (see above).
- **Deploy**: back up the database; `npm exec -w backend -- prisma migrate deploy` (five migrations in all since Phase 0); restart both workspaces.

## Client Profile Rework, Phase 4: Full Client Excel Export (2026-11-23)

Requirement R07 (export includes all the details of the CIS file). **The CIS file itself has not been received**, so the columns follow the business documents; the layout is in three column lists at the top of `backend/src/compliance-clients/client-export.ts` and can be reordered or renamed there once the CIS layout is supplied.

- **Export Excel** (Compliance Clients list, `GET /compliance/clients/export/excel`, same filters as the list) now has four sheets:
  1. **Compliance Clients**: the register sheet, unchanged (same 22 columns).
  2. **Company Details**: one row per client: legal name, CR number and expiry, legal form, date / country / place of incorporation, registered office address, share capital, tax card (TIN), PO Box, telephone, email, website, nature of business, related industry, license activities, financial year end, approved auditor, services requested.
  3. **People**: one row per person with all roles in one cell: title, name, designation, key communication person, authorised signatory, shareholder %, UBO % and what it is held through, entity represented, nationality, dual citizenship and other nationality, date of birth, QID number and expiry, main passport and expiry, other passports, national address expiry, address, telephone, email, PEP and details, CR number (companies).
  4. **Legal Documents**: the register documents plus each person's QID and passports: type, nature, number, name, role, nationality / location, issue and expiry dates, days left, status (Expired / Within 30 / Within 60 days / Valid).
- **Access levels** apply per sheet: Operations gets no UBO-only people, UBO role or UBO columns; Accounting and HR (own allocated clients only) also get no passport columns or passport rows and the trimmed register sheet from Phase 3. An export with no visible clients still has all four sheets (headers only).
- **Records are created during export** for clients whose records do not exist yet (never opened since Phase 1): from the current KYC, audited as `CLIENT_RECORDS_CREATED` by the exporting user. Existing records are only read.
- **Checks**: `node backend/scripts/check-client-export.cjs` (sheet contents and levels; no database); `check-compliance-clients.cjs` updated for the new sheets. All 30 `check-*.cjs` pass after `npm run build`.
- **Local test** on a fresh copy of the local database (25 end-to-end checks): the register sheet keeps its 22 columns, 8 clients -> 8 company rows, 35 people on the client pages = 35 rows, Khalid is one row with all his roles, a document added in the register appears in the export, filters apply to every sheet, Operations / Accounting / HR / CEO levels. The Phase 3 test (72 checks) still passes. Two of the 25 fail only when the Phase 3 test has already run on the same copy (records exist, HR allocated); both pass on a clean copy.
- **Not verified**: the CIS layout (file not available); opening the workbook in Excel itself (read back with a library only); very large exports (the 5,000-client limit is unchanged; the records of clients missing them are created one at a time).
- **Deploy**: no migration and no new variables; restart both workspaces.

## Client Profile Rework, Phase 3: Access Groups, Client Allocation, CEO Role, EDD Merge (2026-11-22)

Decisions are in section F of `docs/KYC_CLIENT_PROFILE_REQUIREMENTS.md`. Visibility is enforced by the API (`backend/src/compliance-clients/client-access.ts`); the frontend only hides what the API already leaves out.

- **Access levels** (from the user's roles; the widest wins):
  - **FULL**: AML Team, AML Supervisor, DMLRO, MLRO, SEF, CEO, Company Admin, Super Admin. Every tab.
  - **OPERATIONS**: Operating Team sees every client: profile, people (without people who are only UBOs), Legal Documents with passports, Engagements, Compliance Documents and Expiry. No UBO, KYC, CRRF, Screening or EDD; no screening, risk-change or review-in-progress status; risk level and review dates are kept.
  - **ALLOCATED**: Accounting, HR and any other role: only clients allocated to them; profile, people, Legal Documents without passports (and without KYC uploads), Engagements. No risk level, CDD, review or expiry values, no KYC cases, no passports, no folders, monitoring or expiry export.
- **What is left out** (not sent): UBO roles, CRRF, internal review, risk history, KYC cases / uploads and passports as above; list counts, attention chips, risk / CDD / review / attention filters (ignored, so they cannot be used to probe), register Excel columns and ID-copy files by id follow the same level. Both `compliance/clients/:id/documents` (folders) and `/monitoring` check the level.
- **Allocation** (`ClientAllocation`, migration `20261122130000_client_allocation_ceo_role`): Company Admin, AML Supervisor, DMLRO and MLRO allocate active Accounting / HR users of the company to a client (`GET .../allocations/candidates`, `POST .../allocations`, `POST .../allocations/:id/remove`), shown in an "Allocated staff" panel on the Overview. Audited (`CLIENT_STAFF_ALLOCATED`, `CLIENT_STAFF_UNALLOCATED`). A client with no allocation is invisible to Accounting / HR.
- **CEO role**: new role (migration inserts it; `seed.ts`, user administration and the role lists know it). Read-only: compliance, KYC, CRRF, screening and enquiries View in the access matrix defaults, and on the GET endpoints of Screening and CRRF. Where the access matrix was already saved, the migration grants CEO those View permissions and gives Accounting and HR `compliance.view` (they previously had no compliance access). Change them in Access Control if needed.
- **Defaults**: Accounting and HR now have `compliance` View by default (they still see nothing until allocated); `check-compliance-clients.cjs` updated accordingly.
- **EDD**: the former Monitoring and Reviews & Risk tabs are sections of the EDD tab (EDD documents, ongoing monitoring, periodic reviews and risk, each with a plain-language description); old `?tab=monitoring` / `?tab=reviews` links and notifications open EDD.
- **Checks**: `node backend/scripts/check-client-access.cjs` (levels, tabs, scope, stripping, allocation rules). All 29 `check-*.cjs` pass after `npm run build`.
- **Local test (2026-11-22/23)** on fresh copies of the local database with synthetic Accounting, HR and CEO users (test database only): 72 end-to-end checks pass (no client before allocation, allocation by Supervisor / DMLRO / Admin only, Accounting / HR see only allocated clients and no passports, UBO, KYC, CRRF, risk or folders, Operations and CEO levels, CEO cannot write, hidden filters ignored, export columns, allocation removal takes access away at once). The 1,968-call regression against the original code shows differences only in the new `access` field, the new CEO role and test users, and Operations no longer receiving screening / risk-approval status.
- **Not verified**: on the server; Accounting / HR work with the real access matrix saved with custom grants; Word / PDF exports (unchanged). Other pages that read compliance data (dashboard, KYC screens) were not changed.
- **Deploy**: back up the database; `npm exec -w backend -- prisma migrate deploy` (four migrations in all since Phase 0); restart both workspaces. Create the CEO user in Users, then allocate Accounting / HR users to their clients.

## Client Profile Rework, Phase 2: Legal Documents Register, Document Reading, Expiry (2026-11-22)

Requirement IDs refer to `docs/KYC_CLIENT_PROFILE_REQUIREMENTS.md`.

- **Schema** (migration `20261122120000_legal_documents_ai_settings`, additive): `ClientLegalDocument` (type from the catalogue in `legal-document-catalogue.ts` or OTHER with a label, nature COMPANY / INDIVIDUAL, person, number, name, nationality / location, issue and expiry dates, file, status CURRENT / REPLACED / DELETED with reason, `replacesId`, `readMethod` MANUAL / LOCAL / AI), `TenantAiSetting` (one per company: model, encrypted key, last four characters, on / off) and notification type `COMPLIANCE_LEGAL_DOCUMENT_CHANGED`.
- **Register** (`/compliance/clients/:clientId/legal-documents`, `ClientLegalDocumentsService`): add (file upload, or a KYC upload via `kycDocumentId`), replace (old one kept as REPLACED), edit, remove (reason required, kept as DELETED), view file. QID and passports stay on the person and are listed in the same table. Files use the client-documents folder (`CLIENT_DOCUMENT_UPLOAD_DIR`).
- **Access**: reading follows compliance View. Adding, replacing, editing and removing documents, and QID / passport copy uploads (now in `ClientIdentityDocumentsController`), need compliance Edit **or** clients Edit (`LegalDocumentsAccessGuard`), so Operations can replace documents. Person and company profile edits still need compliance Edit.
- **AML notices** (L09): every add / replace / edit / remove, QID / passport copy upload and passport removal creates a `COMPLIANCE_LEGAL_DOCUMENT_CHANGED` notification for AML Team, AML Supervisor, DMLRO and MLRO (Company Admin sees all); it opens the Legal Documents tab. Every change is audited (`ClientLegalDocument`).
- **Links**: a CR document's expiry becomes the company CR expiry (and its number when none is recorded); a National Address certificate's expiry becomes the person's. Every current document with an expiry is on the Expiry tab (`legal:<id>`); the profile CR / national address dates are listed separately only while no matching register document has an expiry.
- **Document reading** (`DocumentReaderService`, `POST .../legal-documents/read`, nothing stored): with the company's AI service on, PDFs and images are sent to OpenAI (Responses API, strict JSON schema), which returns the document fields, company details and the people listed with roles. Otherwise, or if the AI call fails, the server reads the PDF text layer or OCR (English, label-based, `document-text-parser.ts`). Word / Excel files are not read. Company details and people are offered as tick boxes; ticked ones go through the normal audited profile edits (compliance Edit).
- **AI settings** (Administration > AI Document Reading, `/ai-settings`; Company Admin / Super Admin, or the administration area once the matrix is saved): key encrypted with AES-256-GCM using the new server variable **`SETTINGS_ENCRYPTION_KEY`** (see `.env.example`), never returned or logged; "Test connection" checks the key and model without sending a document. Default model `gpt-4.1-mini` (editable). The page warns that documents are sent to OpenAI while it is on.
- **Expiry** (R08, R09): filters Expired / Within 30 days / Within 60 days / All and "Download Excel" (`GET /compliance/clients/:id/expiry/export?window=`); all clients from the Compliance Clients list (`GET /compliance/clients/export/expiry?window=`). Columns: Document, Expiry Date, Days Left, Status, Holder, Holder Role, Number, Client Code, Client.
- **Overview** (R10): company profile and organisation chart from the register.
- **Checks**: `node backend/scripts/check-legal-documents.cjs` (no database, no OpenAI). All 28 `check-*.cjs` pass after `npm run build`.
- **Local test (2026-11-22)** on fresh copies of the local database: the 1,968-call regression against the original code shows no difference; 31 end-to-end checks of the new features pass (Operations add / replace / remove, SEF refused, AML notified and Operations not, CR expiry linked without duplicates, expiry exports, AI settings admin-only, key encrypted and never returned); browser: register table, add form auto-fill and suggestions, expiry filters, AI settings page. Fixed during the test: AI settings were reachable by any signed-in user while the access matrix is unsaved; CR numbers starting with letters were not read; expiry rows showed the generic type instead of the document name.
- **Not verified**: reading with a real OpenAI key (no document was sent to OpenAI), real CR / licence layouts (only a synthetic CR was used), Arabic documents locally, and the server.
- **Deploy**: set `SETTINGS_ENCRYPTION_KEY` before anyone saves a key; back up the database and uploads; `npm exec -w backend -- prisma migrate deploy`; restart both workspaces. The server must reach `api.openai.com` for AI reading.

## Client Profile Rework, Phase 1: Linked Entity and Person Records (2026-11-22)

Decision (business, 2026-11-22): after activation the client profile lives in client-level records, not as edits layered on the KYC form (replaces the 2026-11-17 overlay approach). One person = one record with any number of roles, shown on every tab that lists one of them. Field IDs refer to `docs/KYC_CLIENT_PROFILE_REQUIREMENTS.md`.

- **Schema** (migration `20261122110000_client_people_records`, additive only): `ClientEntityProfile` (1:1 with `Client`; KYC section A fields plus client-only E04 CR expiry, E06 place of incorporation, E09 share capital, E11 PO Box, E18 financial year end, E19 auditor), `ClientPerson` (individual or corporate party; adds I01 title, I09 dual citizenship + other nationality, I14 national address expiry, I18/I19 phone and email, I20 PEP + details, I12 represented entity), `ClientPersonRole` (`SHAREHOLDER`, `UBO`, `DIRECTOR`, `MANAGER`, `SECRETARY`, `SEF`, `AUTHORISED_SIGNATORY`, `KEY_CONTACT`, `CEO`, `CFO`, `COO`, `MANAGING_DIRECTOR`, `GENERAL_MANAGER`, `CHAIRMAN`, `OTHER` + title; percentage for shareholder/UBO; `viaPersonId` for a UBO held through a corporate shareholder; source KYC row), `ClientPersonPassport` (I07/I08: several passports, one "main" printed on the KYC). `ClientDocument.personId` links QID / passport copies to the person.
- **Filling the records** (`client-records.ts` pure mapping, `client-records-store.ts` database):
  - Existing clients: on first open of the client page (or first edit), from the current KYC with the older `ClientProfileOverride` edits applied (shown as "edited"). Earlier ID copies are linked by normalized name. This write happens on a GET, so the audit actor is whoever opened the page first (`CLIENT_RECORDS_CREATED`). Two first loads at once are stopped by the unique `ClientEntityProfile.clientId`.
  - New clients: on activation (Convert to client).
  - Re-KYC approval (and activation of a further KYC for an existing client): KYC values replace record values except (a) values edited on the client page after the KYC was started, (b) roles added on the client page after it was started, (c) client-only fields, (d) empty KYC values. A new passport number on the KYC is added as the main passport; the old one stays. People no longer on the KYC lose their KYC roles and are archived (`archivedAt`) when none remain. A client whose records were never created is first filled from its previous KYC.
  - Matching a KYC row to a person: QID, then passport, then CR number, then normalized name; different QID numbers are never merged.
- **Re-KYC prefill** (`formFromRecords`): sections A, B, C and E are written from the records onto the current KYC's rows (other row details kept); rows of removed roles are left out; roles added on the client page become new rows; roles that are not KYC position options are written as "Other". The approved KYC is not changed.
- **Expiry**: QID, every passport, national address certificate (`person:NATIONAL_ADDRESS:<id>`, type OTHER) and CR expiry (`entity:CR`, type CR) are kept in step. QID / passport keys are unchanged, so reminders already sent are not repeated.
- **API** (compliance Edit for writes, tenant scoped, every change audited as `ComplianceClient`): `PATCH :id/entity`, `POST :id/people`, `PATCH :id/people/:personId`, `POST|PATCH :id/people/:personId/roles[/:roleId]`, `POST .../roles/:roleId/remove`, `POST|PATCH :id/people/:personId/passports[/:passportId]`, `POST .../passports/:passportId/remove`. ID copy upload / link take `personId` (+ optional `passportId`) instead of `section` / `rowId`. **Removed:** `PATCH :id/profile`. Adding a new person whose name is already on the client is refused (add the role to that person instead).
- **Client page**: each people tab lists the people holding its roles with all their roles as badges (add / remove role, %, "held through"), the new individual fields, QID card plus one card per passport. "Add" on a tab can link someone already on the client. Company tab shows all 20 entity fields. Key communication person on Overview is the person with that role.
- **Kept**: `ClientProfileOverride` table (read only, used once to fill the records). The KYC form, KYC export and enquiry screens are unchanged (KYC-side fields are Phase 5).
- **Checks**: `node backend/scripts/check-client-records.cjs` (merging, seeding, expiry keys, re-KYC merge rules, prefill, service validation and tenant scoping, passports; in-memory, no database). `check-compliance-clients.cjs` updated. All 27 `backend/scripts/check-*.cjs` pass after `npm run build`.
- **Local test (2026-11-22)** on restored copies of the local database (the real local database was only read, by `pg_dump`):
  - Regression: the same 246 read endpoints x 8 roles (1,968 calls) on the original code and on this branch, each on its own copy of the same data: no difference outside the compliance client page.
  - Every compliance client opened on both: nothing shown before is lost. Intended differences: a person's QID / passport known from one KYC row now shows on all their tabs; a missing legal name falls back to the client name.
  - Re-KYC started on an untouched client: sections A to E identical to the original code. Rows keep their own values and stored format unless the value was changed on the client page or the row had none.
  - Re-KYC approval and client activation run through `KycService` on the test copy: KYC changes applied, later client-page edits and roles kept, people who left archived, audited; activation creates the records.
  - Access: Operations and SEF (compliance View) can read but get 403 on every write; AML and Company Admin can edit. Validation, unknown fields and cross-client person ids are refused.
  - Browser: people tabs, role badges, title edit, linking an existing person as shareholder, two passports per person, CR expiry on the Expiry tab, prefilled re-KYC in the KYC form editor.
  - Fixed during the test: a person with different passports on different KYC rows kept only one; the re-KYC prefill rewrote unchanged values and turned single-choice fields into lists; synced CR rows said "From person details".
- **Not verified**: on the server, and Word rendering (KYC export code is unchanged).
- **Deploy**: back up the database and uploads, `npm exec -w backend -- prisma migrate deploy` (applies `20261122100000_rename_cdd_folder_to_edd` and `20261122110000_client_people_records`), restart both workspaces. No data script: records fill themselves as client pages are opened.

## Client Profile Rework, Phase 0 (2026-11-22)

Business requirements are tracked field by field in `docs/KYC_CLIENT_PROFILE_REQUIREMENTS.md`. Phase 0 changes:

- **Tab order** (`/compliance/clients/:id`): Overview, Company, Shareholders, Directors & Managers, Authorised Signatory, SEF, Secretary, Legal Documents, Engagements, Compliance Documents, Expiry, UBO, KYC, CRRF, Screening, EDD, then Monitoring and Reviews & Risk (their place is still to be decided). URL keys are unchanged (`documents` = Legal Documents, `cdd` = EDD), so saved links and notification links still work.
- **Authorised Signatory** is a new tab: officers with the signatory flag or an "Authorized Signatory" position. They no longer appear on Directors & Managers unless they also hold a director or manager position.
- **KYC** is a new tab holding the KYC history and Start re-KYC, split out of the former "KYC & Documents" tab, which is now **Legal Documents**.
- **CDD renamed to EDD** on the client page. Migration `20261122100000_rename_cdd_folder_to_edd` renames the default `cdd` folder to "EDD Documents" (only where it still has the original title). The enum value and key stay `CDD` / `cdd`.
- **Status labels:** `MLRO_APPROVED`, `MLRO_APPROVED_WITH_CONDITIONS` and `SEF_APPROVED` now read "… FINAL KYC CONFIRMATION PENDING" in teal, instead of "KYC APPROVED" in green, so they are not mistaken for a final KYC. The backend already refuses client conversion before `KYC_FINAL_APPROVED`.
- **Verified:** `npm run build`. **Not verified:** in a browser (this worktree has no `.env`, and the migration is not applied to any database), or on the server.
- **Deploy:** back up the database, then `npm exec -w backend -- prisma migrate deploy`, then restart both workspaces.

## KYC Export Date from the Preliminary KYC (2026-11-19)

- **Symptom:** a KYC made from a Preliminary KYC (for example a proposed company finalised with "Use Preliminary KYC as final") downloaded with a blank "Date:" at the top and "Date: -" in Section A, although the Preliminary KYC shows its date.
- **Cause:** the export prints the KYC form's Section A `date`, an optional field that enquiry conversion never filled.
- **Fix:** `KycService.serializeForm` returns `sectionA.date` = the entered KYC date, otherwise the Preliminary KYC's completion date (`preliminaryKyc.completedAt`, date part in UTC, as the Preliminary PDF prints it). An entered date always wins. The KYC form screen shows the same date, and saving the form stores it. Nothing is written to the database on read.
- **Unchanged:** standard KYCs without a Preliminary KYC, and the client declaration (Section G) date, which stays blank when the client never completed the declaration.
- **Check:** `node backend/scripts/check-kyc-export-date.cjs` covers the fallback, an entered date winning, a standard KYC, and the HTML and DOCX outputs.
- **Not verified:** Word rendering of the DOCX (the Word automation hung on this machine), and the server. Layout is unchanged; only the date value is now filled.

## Resubmit to DMLRO "Internal server error" (2026-11-19)

- **Symptom:** after DMLRO returned a KYC file, **Resubmit KYC File to DMLRO** showed "Internal server error". Nothing was saved, so after a refresh the AML Supervisor comments box was empty again.
- **Cause:** `InternalReviewTask` is unique per `(kycCaseId, stage, status)`. `submitToAml` marked the current AML Supervisor task `COMPLETED` while the first round's `COMPLETED` Supervisor task still existed, so the database refused it (Prisma `P2002`) and the whole transaction rolled back. The other review stages already clear the old task first (`clearReviewTaskStatus` in `submitReviewAndRoute`, MLRO, SEF).
- **Fix (`backend/src/kyc/kyc.service.ts`):** clear the old task before setting the final status in:
  - `submitToAml` (`COMPLETED`);
  - `returnToBusinessDevelopment` (`RETURNED`, for a second return to BD);
  - DMLRO final approval during MLRO absence (`COMPLETED`, for each stage being completed);
  - MLRO deciding while DMLRO is unavailable (`CANCELLED`).
  Submissions, versions, status history, audit entries and notifications are unchanged; only the duplicate task row from an earlier round is removed, as the other stages already do.
- **Check:** `node backend/scripts/check-kyc-resubmit-tasks.cjs` replays submit → DMLRO return → resubmit (twice) and a second return to BD against an in-memory task table with the same unique rule. It fails with the unique-constraint error on the old code.
- **Not verified:** against a real database or on the server. Cases already stuck need no data fix; resubmitting works once this is deployed.

## Parent Companies in the Enquiry Ownership Step (2026-11-19)

- **Why:** clients with layered groups, for example a Qatar company owned by a UK company, owned by a US holding company, owned by a US parent, could record only the direct shareholder. Adding the upper companies as extra shareholders pushed the total to 200%.
- **Data shape (no migration):** a `Corporate Entity` row in `details.preliminaryKyc.shareholders` may set `parentRowId` to another company row. That row is a **parent company** and owns `ownershipPercentage` % of the company it points to. Rows without a valid parent are direct shareholders of the client company. This is the same `parentRowId` tree the full KYC form already uses, and `convertToKyc` already maps it into the KYC party tree. Older enquiries have no parent links and behave as before.
- **Shared rules:** `backend/src/common/preliminary-ownership-chain.ts` and `frontend/src/utils/preliminary-ownership-chain.ts` must stay identical apart from line 1. The check script compares them.
  - Only direct shareholders must total 100%.
  - The owners of one company (parent companies plus beneficial owners linked through it) may not exceed 100%.
  - Parent links to a missing, non-company, self or circular row are cleared on save (`preliminaryKycData`) and treated as direct everywhere else.
  - Percentages accept `50`, `50%` and `50,5`, as `ownershipPercentageValue` does.
- **Editor (`PreliminaryOwnershipEditor`):**
  - Company cards have **Add parent company** and a **Shareholder of** select. The select never offers a company's own parent companies, so cycles can't be made.
  - Cards are listed top-down with indentation.
  - Removing a company, or switching it to Person, moves its parent companies up one level instead of deleting them.
  - Beneficial owners can link through a company at any level. The form shows the indirect UBO % calculated along the chain, with a **Use** button. It's a suggestion; the saved `uboPercentage` is still entered by the user.
- **Outputs:** Section B in the live preview, `PreliminaryKycDocument` and the server PDF (`preliminary-pdf.ts`) lists the chain as 1, 1.1, 1.1.1, adds a **Shareholder of** column and shows **Total direct ownership %**.
- **Checks:**
  - `node backend/scripts/check-preliminary-ownership-chain.cjs`: helpers with frontend/backend parity, submit rules, save sanitizing and PDF HTML.
  - `node frontend/scripts/check-preliminary-ownership-chain-ui.cjs`: drives the editor at 1440px and 390px and saves screenshots to `%TEMP%/newoon-ownership-chain-preview`.
- **Not covered by automated checks:** an end-to-end enquiry → KYC conversion against a database. The conversion code path is the existing `parentRowId` mapping, now also passed through `chainParentId`.

## AML Edit Enquiry Opens Empty with "Forbidden resource" (2026-11-19)

- **Symptom:** an AML Team / AML Supervisor user opened **Edit Enquiry** on an enquiry already converted to KYC (case still in `SUPERVISOR_REVIEW_PENDING`) and got a red "Forbidden resource" banner over an empty form.
- **Cause:** `AddEnquiryPage` loaded `GET /api/clients` and `GET /api/enquiries/:id` in one `Promise.all`. `/clients` follows the `clients` area of the role matrix, and AML roles have no Clients access by default, so once the matrix is saved it returns 403. The rejected `Promise.all` dropped the enquiry too. The enquiry endpoints themselves allowed the edit.
- **Fix:** the client list is now optional on that page. If `/clients` fails, the "Current client" picker shows only the enquiry's already linked client, and the enquiry still loads and saves.
- **Rule unchanged:** AML Team / AML Supervisor may still edit an enquiry while its KYC case is in preparation (`INQUIRY_RECEIVED` … `SUPERVISOR_ADDITIONAL_INFORMATION_REQUIRED`), in `EnquiriesService.canModifyEnquiry` and the matching `utils/enquiry-edit-access.ts`. Later case stages lock it, as before. Backend authorization is unchanged.
- **Check:** `frontend/scripts/check-returned-enquiry-ui.cjs` now also opens the editor as AML Supervisor with `/clients` returning 403.

## Compliance Client Inline Editing, Re-KYC and Separate QID / Passport (2026-11-17)

Design confirmed with the user on 2026-11-17: edits are kept on the client record and never rewrite the approved KYC, re-KYC is a prefilled workflow, QID / passport are split on the client page and in the KYC form while exports keep one column, and QID / passport alerts run at 60 and 30 days.

- **Inline editing** (`/compliance/clients/:id`). Every value on Overview, Company, Directors & Managers, Shareholders, Secretary, SEF, UBOs and the key communication person has a pencil icon (`components/EditableFields.tsx`), shown to users with compliance Edit.
  - **Register values** save through the existing audited `PATCH /api/compliance/clients/:id`. It now also accepts `name`, `clientCode` (must be unique per company; letters, digits and dashes), `registrationNumber`, `country`, `industry`, and `statusReason` on its own.
  - **Risk level** has no pencil. Its "Request change" link opens Reviews & Risk, so risk still goes through the four-eyes risk-change approval. CDD type stays directly editable, as before.
  - **Latest service, review dates and the KYC assessment** are derived values and stay read-only.
  - **Company and person values** save through `PATCH /api/compliance/clients/:id/profile` (`{ section, rowId, field, value }`, compliance Edit, tenant scoped).
    - They are stored as `ClientProfileOverride` rows on the client's current KYC case and overlaid on the KYC form when the page is read (`applyOverrides` in `compliance-client-profile.ts`). The approved, locked KYC form, its revisions and its exports are not changed.
    - `PROFILE_FIELDS` is the allow-list of editable fields per section. Dates must be `YYYY-MM-DD` and percentages 0–100. Lists (nationality, position, legal form) are comma-separated.
    - Every edit writes an `AuditLog` entry (`ComplianceClient`, action `CLIENT_PROFILE_FIELD_EDITED`, from/to, person, KYC number). Edited values show an "edited" marker.
    - Officer (`KycManager`) rows get new ids when a form is saved again, so an officer edit falls back to the officer's original name when its row id no longer matches.
    - One person can be listed in several places (shareholder, director, UBO). Each row is edited separately; a shareholder marked as UBO is the same row on both tabs.
- **Current KYC and re-KYC**
  - `Client.currentKycCaseId` records the client's current KYC. It is set on activation (`CONVERT_TO_CLIENT`) and on re-KYC approval. Clients activated earlier fall back to the old rule (latest activated case with a form), so no backfill is needed.
  - **KYC & Documents → KYC history** lists every case with Current / Onboarding / Re-KYC markers. For an active client, **Start re-KYC** calls `POST /api/compliance/clients/:id/rekyc` (compliance Edit).
  - That creates a new `KycCase` with `purpose = REKYC` and `previousKycCaseId`, and a new KYC number. The form is prefilled from the current profile with client-page edits applied (`KycService.createRekycCase`): Sections A–E are copied; Section F documents, the G declaration and H review start empty, and uploaded-file names are not copied.
  - Only one re-KYC can be open per client; the client row is locked while one is created.
  - The re-KYC goes through the normal documents → AML → approvals workflow. At final approval (`afterKycFinal`) it does not wait for Operations' engagement decision and needs no engagement letter. In the same transaction:
    - it becomes the current KYC and the case moves to `CLIENT_ACTIVE`;
    - risk and CDD are taken from the approved re-KYC (reclassification > internal review > CRRF, as on activation);
    - `lastReviewDate` becomes now and `nextReviewDate` is recalculated by risk;
    - ID expiry records are synced;
    - an audit entry (`CLIENT_REKYC_COMPLETED`) and a `CLIENT_ACTIVATED` notification are written.
  - Earlier KYC cases, their documents and revisions are unchanged and stay openable. After a re-KYC is approved, the page shows the re-KYC's own values.
  - Client-page edits made on the previous KYC after the re-KYC was started are not in its prefilled form, so on approval they are carried over to the new KYC (`carryOverProfileEdits` / `carryOverOverrides`). They match the same row id, else the person's name, because manager ids change. Edits for people no longer in the form are skipped; the `CLIENT_REKYC_COMPLETED` audit records `editsCarriedOver` and `editsSkipped`.
  - While a re-KYC is open, the profile panels warn that page edits are kept but are not seen by the re-KYC reviewers.
  - Onboarding cases behave exactly as before.
- **Separate QID / passport with expiry**
  - People (shareholders, UBOs, managers, key contact) now have `qidNumber`, `qidExpiry`, `passportNumber` and `passportExpiry`; either number is enough. The KYC form editor has the four fields; Section B rows store them in JSON, managers in new `KycManager` columns.
  - `identityNumber` stays the single printed and screened value. For people with split values it is derived on save as `QID: … / Passport: …` (`common/person-identity.ts`, mirrored in `frontend/src/utils/person-identity.ts`). Corporate shareholders keep the CR number there.
  - **Existing data is not converted.** Older combined values stay in `identityNumber` and are shown as "QID / Passport (earlier entry)" on the client page and in the KYC editor until someone enters the QID or passport number.
  - The completeness message now reads "QID or passport number".
  - The enquiry's key-contact QID and passport numbers and expiry dates are now carried into Section E when the KYC case is created.
  - Exports print the derived value in the existing ID column; expiry dates are not printed.
  - **Expiry alerts:** a person's QID or passport expiry date creates or updates a `ClientExpiryItem` with a `sourceKey` (`syncIdentityExpiryItems`). This happens on every profile edit, on activation and on re-KYC approval; one record per document number, using the latest date.
    - Records whose person or document is gone are deactivated, not deleted. Manual Expiry records are untouched.
    - A synced record cannot be edited in the Expiry tab; change the date on the person instead.
    - The existing reminder sweep notifies QID and passport at 60 and 30 days and when expired (no 90-day reminder). CR and other company documents keep 90/60/30/expired. Each milestone is still claimed once in `ComplianceReminder`, and a new expiry date starts a new set.
    - The notification asks staff to upload the renewed copy (CDD tab) and update the date.
- **ID copies on each person** (`components/IdentityDocumentsBlock.tsx`):
  - Every individual's card (shareholders, UBOs, directors/managers, secretary, SEF, key contact) shows its QID copy and passport copy: the latest with View, plus "Earlier copies" as history.
  - Compliance editors can upload a new copy with "Upload new copy". The form takes the file plus the number and expiry date, prefilled with the current values.
  - **Endpoint:** `POST /api/compliance/clients/:id/identity-documents` (compliance Edit, multipart `files` = one file, `section`, `rowId`, `identityType` QID/PASSPORT, `documentNumber`, `expiryDate`).
    - The file is stored as a `ClientDocument` in the new default CDD folder **Identity Documents** (`key: identity`, created automatically for every company). It uses the same upload checks, storage, viewer and audit as other client documents.
    - The row carries `personKey` (normalized full name), `personName`, `identityType`, `documentNumber` and `documentExpiry`, so the same person listed in several roles shares the copies.
    - A new number or expiry updates the person through the audited profile edit. That keeps the Expiry record in step and restarts the 60/30-day reminders for the new date; a new document number replaces the old number's Expiry record.
  - **Card layout:** each ID section has a QID box and a passport box.
    - Each box shows a status badge (Valid, Expires in N days at 60/30 days, Expired, No expiry date) and the number and expiry with their pencils. These pencils replace the number/expiry pencils in the card's field grid.
    - It also shows the current copy (file, upload date, uploader) with View copy.
    - The button reads "Replace copy" when a copy exists (the old one moves to Earlier copies) and "Upload copy" when none does.
  - **KYC uploads for the person:** the box lists KYC legal documents that belong to the person (`kycIdentityDocumentsFor`):
    - role-based types matched to the person's roles across all tabs: Identity Proof - Director (also managers/signatories), Identity Proof - Authorized Secretary, Identity Proof - SEF, Identity Proof - UBO, and Key Contact QID / Passport attachment;
    - shared ID uploads whose file name contains at least two parts of the person's name.

    Each has View and "Use as QID" / "Use as passport". `POST /api/compliance/clients/:id/identity-documents/from-kyc` (`legalDocumentId`, `section`, `rowId`, `identityType`) reads the file through `KycService.getLegalDocumentFile` (KYC access checks) and copies it into the person's ID copies with the note "From KYC-… (type)". The KYC file is unchanged.
  - The remaining shared uploads ("QID / Passport copies", "Passport") are one bundle per KYC case for everyone. They are counted with a link to KYC & Documents.
  - A copy stored without a new number or expiry records the person's current values.
  - **Reading the number and expiry from the file** (user decision 2026-11-17: local reading only, no external AI service):
    - Choosing a file in the upload form calls `POST /api/compliance/clients/:id/identity-documents/read` (compliance Edit, multipart `files` = one file, `identityType`). Nothing is stored.
    - `IdDocumentReaderService` runs OCR locally. It reads images with `@napi-rs/canvas` (enlarged, greyscale, contrast stretch; bottom band first) and PDFs by rendering their first two pages with `pdfjs-dist`. OCR uses `tesseract.js` with the bundled English data from `@tesseract.js-data/eng`; nothing is downloaded at runtime.
    - One worker is reused and jobs are queued one at a time, with a 60-second timeout. On the test documents a read took about 0.5–2 seconds.
    - `common/mrz.ts` parses the machine-readable zone: passports (TD3) and ID cards (TD1, including the overflow rule for the 11-digit QID number on the back of the Qatar ID), with ICAO check digits.
    - Look-alike characters (O/0, I/1, S/5, B/8, Z/2, G/6) are corrected only when the check digit then matches, and such a number is reported as `CORRECTED` to be checked against the document.
    - **Form behaviour:** the number and expiry are filled in and highlighted, with a note:
      - green: confirmed by check digits;
      - amber: a value to check;
      - amber: the name on the document doesn't match the person;
      - "wrong document type" (a passport in the QID box): nothing is filled in;
      - "could not be read" (for example a QID front side, which has no machine-readable lines): manual entry.

      Staff still press Upload, and nothing is saved automatically.
    - "Use as QID / passport" on a KYC file reads the file too. It saves the number and expiry only when both pass their check digits exactly as read and the document type matches; otherwise they stay for the pencils.
    - **Dependencies added to the backend:** `tesseract.js` ^7.0.0, `@tesseract.js-data/eng` ^1.0.0 (about 11 MB of language data), `pdfjs-dist` ^6.5.438. `pdfjs-dist` needs Node 22.13 or newer; on an older Node, PDF files fall back to manual entry, while images still work. `npm ci` on the server must be able to reach the npm registry. `npm audit` shows 33 advisories in existing packages and none from these.
    - **Verified locally** with generated test documents (no real ID images): ICAO specimen passport and ID card, a QID back with an 11-digit number, a PDF scan, a tilted and blurred photo, a front-only card (nothing read), and a passport in the QID box (type warning). Not verified with real scanned Qatari IDs or passports.
  - Copies can be removed (soft delete) from the CDD tab's Identity Documents folder.
  - **Migration** `20261117120000_client_identity_documents`: additive nullable `ClientDocument` columns and an index on `(clientId, personKey)`.
  - **Verified locally** (Company Admin, CL-2026-0006):
    - upload from the Secretary card with prefilled values;
    - a renewal moved the first copy to "Earlier copies";
    - View returned the PDF;
    - the passport Expiry record moved to the new number and date;
    - the files appear in CDD → Identity Documents;
    - a copy uploaded for a shareholder also shows on the same person's director card;
    - on abc-new, the key contact's three "Key Contact QID / Passport attachment" files were listed in the box, and "Use as passport" stored one as the passport copy (View copy and Replace copy then shown);
    - synthetic checks for scoping and validation, including that only this client's KYC files in the same company can be linked.
    - Not exercised with real role-based files on a client that has directors, because none in the local database has both; that matching is covered by the rule above only.
- **Migration** `20261117100000_client_profile_rekyc_identity` is additive only:
  - `KycCasePurpose` enum;
  - nullable columns `Client.currentKycCaseId`, `ClientExpiryItem.sourceKey`, `KycCase.previousKycCaseId`, and `KycCase.purpose` (default `ONBOARDING`);
  - the four `KycManager` ID columns;
  - the `ClientProfileOverride` table;
  - a unique index on `(clientId, sourceKey)`.

  Existing rows keep their values. It has been applied to the local development database only (2026-11-17, after a `pg_dump` backup), not to staging or production. Deploy: back up the database and uploads, then `npm exec -w backend -- prisma migrate deploy`, then restart both workspaces.
- **Smaller UI changes:**
  - Expiry tab: synced rows show "From person details" instead of Edit/Archive, and the tab text explains the 60/30-day rule.
  - The case stepper of a re-KYC hides "Convert to client" and ends at "Current KYC".
- **Verification (local):**
  - `npm run build` passed.
  - `node backend/scripts/check-compliance-clients.cjs` passed. It is extended for: overlay without changing the form, officer-name fallback, ID split and earlier entry, expiry dedupe/sync/deactivation, the 60/30 rule, edit endpoint scoping/allow-list/validation/audit, edits applied to the current KYC rather than an open re-KYC, re-KYC prefill, and re-KYC versus onboarding final approval.
  - All other backend and frontend `check-*.cjs` scripts pass. The exception is `frontend/scripts/check-dashboard-ui.cjs`, which still looks for the `/clients` sidebar link removed on 2026-11-10; that is unrelated and was not changed here.
  - Word rendering of both export samples with `QID: … / Passport: …` values: the text wraps inside the existing ID column, there is no overflow, and the standard sample keeps 4 pages.
- **Browser check (local database, Company Admin, client Demo Pearl Trading W.L.L., CL-2026-0006):**
  - **Register:** the Industry edit saved and was audited with from/to; a duplicate client code was refused with the name of the client using it.
  - **Shareholders:** the individual shows split QID/passport plus the earlier combined value, and the corporate shows a CR number. Entering a QID number and expiry saved with "edited" markers and an expiry badge ("44 days left"). One Expiry record was created for the person listed as both shareholder and UBO, and the existing manual records were untouched.
  - **Reminders:** a live reminder run sent exactly one 60-day notification with the renewal wording; a second run sent none.
  - **Officers:** a director passport edit saved.
  - **Start re-KYC:** created KYC-2026-0015 (Re-KYC, from KYC-2026-0013). The form was prefilled with the page edits and the derived identity, and the declaration was empty. The history shows the in-progress banner, the old KYC stays Current, and a second start was refused.
  - **Audit:** audit rows were written for each action.
  - **Re-KYC approval end to end** (the role steps went through the app's API as the AML Supervisor, DMLRO and MLRO test accounts; the results were checked in the browser):
    - KYC-2026-0015 was prepared (document, declaration, Section H Medium/RDD, screening of all 7 parties including the derived `QID: …` / `Passport: …` IDs, CRRF), then submitted, DMLRO-approved and MLRO-approved.
    - It went straight to `CLIENT_ACTIVE` with no engagement step, and became Current.
    - The client moved High/EDD → Medium/RDD, last review became 17 Nov 2026 and next review 17 Nov 2028. No new engagement was created. A "Re-KYC approved" notification was sent.
  - **Problem found and fixed:** in that first run, page edits made while the re-KYC was open (director QID expiry and passport expiry) disappeared from the current view after approval, and their Expiry record was deactivated. The carry-over above fixes this.
  - **Fix verified with a second cycle (KYC-2026-0016):** passport number and expiry were edited on the Secretary card while the re-KYC was open (the warning showed). After approval, both are still shown as edited on the new current KYC, the Expiry record is active, and the audit shows `editsCarriedOver: 2`.
  - **Left in the local database:**
    - CL-2026-0006 has three KYCs: 0013 onboarding, then re-KYCs 0015 and 0016 (current); risk is now Medium/RDD.
    - Test edits, synced Expiry records (including one inactive passport from the first run), reminder and approval notifications, and test PDFs on the re-KYC cases.
- **Not verified:**
  - the re-KYC approval screens themselves (Section H forms) as each role in the browser; the role decisions were made through the same API those screens call;
  - SEF routing for a High-risk re-KYC;
  - roles other than Company Admin for the page edits;
  - staging and production.

## Country of Incorporation on Proposed-Company Enquiries (2026-11-15)

- **Before:** line 4 of the Preliminary KYC ("Country of incorporation") was fixed text that always printed "-". There was no field for it.
- **Now:** proposed-company enquiries have a required **Country of incorporation** field on the Details step, defaulting to Qatar because QFC, MOCI and free zones are in Qatar.
  - It is saved to `details.countryOfIncorporation` and `details.preliminaryKyc.countryOfIncorporation`.
  - It prints on line 4 in the form preview, `PreliminaryKycDocument` and `preliminary-pdf.ts`.
  - It becomes Section A `countryOfIncorporation` when the KYC case is created. Older enquiries fall back to the previous jurisdiction / head office value.
- **Older enquiries:** opening one shows Qatar when a jurisdiction is set; saving stores it.
- **Other:** no migration is needed.

## Screening Finalize Guidance and Client Declaration Text (2026-11-15)

- **Reported:** "Screening can't be closed" on Arabic Game Partners LLC (test site).
- **Cause, from the case's screening context on mis-test:**
  - All three records were fully screened (every list Clear, evidence attached, result set), but **Observation / remarks were empty and none had been finalized**; all were `DRAFT`.
  - Remarks are mandatory and the box sits at the bottom of each record. The Finalize error appeared at the top of the page.
  - ID numbers matched the KYC form.
  - No data was changed on the server.
- **Screening page** (`KycScreeningPage.tsx`):
  - Records show a "Not finalized" badge.
  - A page banner lists records still to finalize, with what to do.
  - Each open record shows a live "Before you can finalize this record" list right under its buttons, or "Everything is filled in. Click Finalize".
- **KYC checklist wording:**
  - Names with no screening record are listed separately from records that exist but are not finalized, which now read "…: add Observation / remarks, click Finalize".
  - The pass/fail rule is unchanged.
- **Client declaration:** section G of the full KYC (download, live preview, form) now opens with the client's wording: "By signing this document, I hereby confirm … on behalf of the entity set out in section A:" (`CLIENT_DECLARATION_TEXT`). The Preliminary KYC already had its own version.

## Amendment Drafts Use the Same Submission Checks (2026-11-12)

- **The gap:** a full-KYC amendment draft (`AML_REVIEW_STARTED`, form `AMENDMENT_DRAFT`, `fullKycStarted`, unlocked; for example "Open amendment" on a Preliminary-to-full KYC) could be edited by AML. However:
  - the case page showed only a generic "complete screening and CRRF" line, with no checklist;
  - `submitToAml` refused the status, so the required-details check was never reached.
- **The fix:**
  - `submitToAml` now accepts this state (`isLegacyFullKycDraft`), so it goes through the same checks: documents, required form details, Section H, screening, CRRF and comments.
  - The case page loads the checklist and shows "complete the amendment, then resubmit it to DMLRO" (`isAmlAmendmentDraft` / `canSubmitToDmlro` in `KycCaseGuide`). The Submit page labels it as a resubmission.
- **Unchanged:** normal (non-full-KYC) amendments remain unavailable to AML, as before.
- **Checks:** `check-kyc-form-required.cjs` was extended.

## Date Picker and Required Markers (2026-11-12)

- **Date picker:** `components/DatePickerPopover.tsx` replaces the browser's native date picker inside `TypedDateInput`, so every date field in the app uses it.
  - It has month and year lists (1900 to +20 years), brand-coloured selected day, outlined today, and Clear / Today buttons.
  - Keyboard: arrows move by day or week, PageUp/PageDown change month, Escape closes.
  - It closes on an outside click.
  - It renders on `<body>` and is positioned next to the field, so scrolling form panels don't clip it.
  - Typing DD/MM/YYYY still works as before.
- **Red `*`:** in `KycFormEditorPage`, any label ending in ` *` is drawn with a red star (`labelText`), matching the enquiry form.
- **Related Industry** is now required in section A (form marker and `kyc-form-completeness.ts`).

## Required KYC Form Details (2026-11-12)

- **Where it is enforced:** `backend/src/common/kyc-form-completeness.ts` lists the details a KYC form must have before the AML Supervisor can submit it to DMLRO. `assertReviewPackageReady` enforces it, so it covers both submit paths. Drafts can still be saved with gaps.
- **Required fields:**
  - A: Legal name, CR No., Date of incorporation, Country of incorporation, Legal form, Registered office address, Telephone (more than the dial code), a valid Email, Main purpose / nature of business, Related Industry, Nature of prospective service.
  - B Managers: at least one person, each with full name, position, nationality and QID/Passport No. The "Authorized signatory" tick is optional (since 2026-11-16), because some companies have no named authorized signatory.
  - C Shareholders: at least one row, each with full name, nationality/country, QID/Passport or CR number, and shareholder %. Direct shareholders must total 100%. At least one beneficial owner (UBO).
  - D: the existing PEP / sanction / dual-citizenship answers.
  - E: Full name, Position, Mobile, a valid Email.
  - G: Full name, Position, Date. The authorized signature upload is optional (since 2026-11-16), because the client's signature is often not available as a file.
  - H: the AML Supervisor's risk classification and due diligence type (added earlier).
- **Not covered:** preliminary (proposed-company) forms keep their own rules until the full KYC is started.
- **In the app:**
  - The checklist item "KYC form - required details" lists every gap by section and row in plain English. Long tables are capped at six rows plus "and N more".
  - Its button opens the first section with gaps (`section` on the readiness check).
  - The editor marks these fields with `*` and says they are required before submitting to DMLRO.
- **Checks:** `node backend/scripts/check-kyc-form-required.cjs`. `check-ownership-review.cjs` was updated. No migration is needed.
- **Local verification:** the readiness check was run against two local cases. The browser view was not re-checked, because the pane was signed in with the user's own account.

## Download Progress, User Delete and Enquiry Delete (2026-11-12)

- **Download progress:** `utils/download-progress.ts` (`trackDownload`) and `components/DownloadToast.tsx` (mounted in `AppLayout`) show a bottom-right "Preparing the KYC PDF… / Downloading …" notice, then "… downloaded". The download service functions are wrapped, so every caller gets it: `generateKycDocument`, `downloadGeneratedKycDocument`, `downloadPreliminaryKycPdf`, `exportCrrf` and `downloadKycFormRevision`. The KYC form editor's DOCX/PDF buttons and the enquiry page's Preliminary KYC PDF button also show "Preparing…" and are disabled while they work.
- **User delete:** `DELETE /api/users/:id` (Super Admin, Company Admin).
  - Only accounts with no recorded workflow work can be deleted (none of the user's enquiry/KYC/review/compliance relations).
  - Anyone with work gets a plain message to suspend the account instead, which keeps the audit trail.
  - Self, platform administrators, other companies' users and the last active Company Admin are protected.
  - The delete is audited.
  - The Users page has a red delete button with a confirmation.
- **Enquiry delete:** `DELETE /api/enquiries/:id` now also allows Operations and Company Admin. Because the access matrix can open the endpoint, the rules are enforced in `EnquiriesService.remove`:
  - Operations and Company Admin can delete only `DRAFT` or `RETURNED_TO_BD` enquiries that never produced a KYC case.
  - Super Admin can delete any enquiry, as before.
  - The list page shows the delete button only where allowed.
- **Checks:** `node backend/scripts/check-deletes.cjs` (mocked persistence). No migration is needed.

## Client Issues and KYC Format (2026-11-12)

From the client's "Issues identified" and "Format" documents.

- **MLRO can decide while the case waits for DMLRO** (for example when DMLRO is on leave).
  - `decideMlroReview` accepts a decision while the case is in `SUPERVISOR_REVIEW_COMPLETED` or `DMLRO_REVIEW_PENDING`/`IN_PROGRESS`, and re-checks that status inside the transaction.
  - It closes the open DMLRO task (`CANCELLED`), records a status-history note, and flags the MLRO submission `bypassedDmlro`. The audit entry gets `decidedWithoutDmlro`.
  - The MLRO comments count as the reason. `RETURN_TO_DMLRO` is refused in this state.
  - The MLRO may also edit their part of Section H in that state.
  - The activation checklist counts the bypass as the DMLRO step.
  - MLRO users now also receive `DMLRO_TASK_ASSIGNED` notifications.
  - Case page and guide show "MLRO Review: Decide without DMLRO"; the editor shows an explanation banner.
- **Blank H values in the download.**
  - The AML Supervisor's risk classification and due diligence type are now required before Submit to DMLRO (readiness item `internal`; `assertInternalUseReady` in `assertReviewPackageReady`).
  - The AML Supervisor date defaults to the submission date.
  - Submitted DMLRO/MLRO/SEF decisions are copied into Section H by `lockReviewSubmission`. The form's decision dropdown showed a default ("Send to MLRO") that was never saved, which printed "Decision: -".
  - Existing cases: `generateDocument` passes `reviewFallbacks` (CRRF rating, AML submission values and date, submitted decisions, whether the case went to SEF, DMLRO bypass) used only when a Section H field is empty.
- **Download layout** (`kyc-document-model.ts`):
  - Order is A → B Manager / Authorized Signatory / Directors / Secretary → C Shareholders (table, totals, **UBO List**, then **Control Structure**) → D–H.
  - Empty optional rows (DMLRO conditions/reason; MLRO risk reason category, explanation and conditions; SEF conditions) are not printed.
  - SEF prints only when the file went to SEF.
  - DMLRO decisions use the form wording ("Send to MLRO").
  - H. Internal Use Only starts on a new page (`newPage` on the section: DOCX page break, PDF `break-before: page`).
- **App:** the editor steps and live preview use the same order and letters (B = Managers, C = Shareholders). Data keys and endpoints are unchanged (`sectionB` = ownership, `sectionC` = managers). `/kyc/:id/form?section=sectionH` opens a section directly. The preliminary (proposed-company) document keeps its own layout.
- **Checks:** `node backend/scripts/check-kyc-format.cjs`. `check-ownership-review.cjs` and `check-export-shareholder-total.cjs` were updated. No migration is needed.
- **Local verification:**
  - Word-rendered and Chromium PDF samples (standard and complex) were inspected page by page.
  - A live MLRO decision on a local case waiting for DMLRO succeeded: DMLRO task `CANCELLED`, submission flagged, timeline note recorded.
  - The MLRO and AML Supervisor screens were checked in the browser.

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

## Approval Makes the KYC Final Automatically (2026-11-16)

- Before this change, after the last required approval the case sat at `MLRO_APPROVED` / `SEF_APPROVED` ("Required approvals completed - final KYC decision pending"). AML Supervisor, DMLRO or MLRO then had to click a separate final-KYC confirmation before Operations could convert the case.
- Now the last approval completes the KYC (`finalizeApprovedKyc` in `backend/src/kyc/kyc.service.ts`). The approvals that do this are MLRO Approve or Approve with conditions, DMLRO final approval during MLRO absence, and SEF Approve or Approve with conditions. In the same transaction:
  - the form becomes `FINAL` and locked;
  - the case moves to `KYC_FINAL_APPROVED`;
  - an audit entry (`KYC_MARKED_FINAL_ON_APPROVAL`) is written;
  - Operations receives "Final KYC approved - convert to client".
- Rejections, returns, information requests and Send to SEF do not make the KYC final.
- **Exception:** a Preliminary KYC for a proposed company whose full KYC has not been started still stops at the final-KYC decision, because there the choice is between "this Preliminary KYC is final" and "complete the full KYC".
- **Amendments:** later changes go through the existing amendment flow.
- **Existing cases:** cases already at `MLRO_APPROVED` / `SEF_APPROVED` before this deploy keep the manual "Confirm as final KYC" button. Confirm them once.
- **Checks:** `check-kyc-format.cjs` covers the normal case, the Preliminary exception and rejection. No migration is needed.

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

## MIS Testing Fixes (2026-11-23)

- Preliminary enquiry people (shareholders, beneficial owners, management) now have separate passport and QID numbers with expiry dates, date of birth (date of incorporation for a corporate shareholder) and PEP Yes / No. The JSON field names (`passportNumber`, `passportExpiry`, `qidNumber`, `qidExpiry`, `dateOfBirth`, `isPep`) match the KYC rows, so they carry into the KYC case on conversion (KycShareholder/KycUbo `dateOfBirth`; KycManager split IDs, expiries, DOB and PEP). `identityNumber` is still saved, derived as `QID: ... / Passport: ...`. Older enquiries with one combined number show it as QID (11 digits) or passport. No migration.
- Each person card has "Fill from a copy": `POST /api/enquiries/identity-documents/read` reads the passport / QID MRZ on the server (the same local OCR reader as the client register, now shared through `IdDocumentReaderModule`) and fills number, expiry, date of birth and an empty name. Nothing is stored by the read; the copy is added to the enquiry attachments under "Passport / QID copies". The MRZ parser now also returns the check-digit-validated date of birth.
- Jurisdiction of registration adds "Company House" and "Other" (free text); management positions add "Principal Representative" and "Other" (free text in `positionOther`, resolved into `position`). The preliminary PDF and preview show the new columns.
- Screening: one entity option per person or company. Roles are merged when any passport / QID / CR number matches (labels and spaces ignored), or by name when one side has no number. The DMLRO submission screening check uses the same matching, so one finalized screening record covers a person in every role.
- MLRO "Request additional information" now returns the file to the AML team: a form amendment is opened, an AML Supervisor task is created, the status is `MLRO_ADDITIONAL_INFORMATION_REQUIRED` and an `ADDITIONAL_INFORMATION_REQUESTED` notification is sent (previously it sent an MLRO approval notification only SEF could see and left the file locked). All three `*_ADDITIONAL_INFORMATION_REQUIRED` statuses now allow AML editing, uploads and resubmission to DMLRO; resubmission reopens locked DMLRO / MLRO / SEF reviews. Files stuck in that status before this fix (for example KYC-2026-0012) can be updated and resubmitted by AML without data changes.

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
