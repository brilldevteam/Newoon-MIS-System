# Independent QA Handover

## Entry criteria and evidence

Run only in an approved staging/disposable environment. Record frontend/backend Git commit, build identifier, Node/PostgreSQL/Chromium/Word versions, migration status and browser before testing. Use database plus uploads backup; prove restore before destructive/failure-injection tests. Never use seed/reset on a shared system: the existing seed changes account passwords. Do not attach tokens, password hashes, secrets or real customer data to tickets.

Status at handover: all staging scenarios and endpoint matrix rows are NOT RUN. Local synthetic checks are recorded separately in VERIFICATION.md and do not convert these rows to PASS. Acceptance rules R-* are the intended invariants; known gaps F-* may currently fail. Business questions B-* must be resolved before disputed expected outcomes are signed off.

Create an evidence row for every execution: test ID, endpoint ID(s), fixture ID, actor role/tenant, pre-state, exact synthetic input, expected status/body/state, actual result, redacted request/response, UI screenshot where relevant, read-only DB delta, audit/history/notification delta, timestamp, tester and defect link. Mark PASS/FAIL/BLOCKED/NOT RUN, never infer success from HTTP 200 alone.

## Synthetic fixtures and roles

| Fixture | Data | Purpose |
|---|---|---|
| T-A and T-B | Separate synthetic tenants, one case/client each and distinct IDs | Cross-tenant positive/negative tests |
| A-* and B-* | One ACTIVE user per role in each tenant, one SUSPENDED user; platform Super Admin separate | No shared tokens between role tests |
| P-01 | Proposed company, individual shareholder 50%, corporate shareholder 50%, linked individual UBO with separately entered effective 50% | Preliminary, indirect ownership and conversion |
| K-01 | Existing legal entity, two root corporate shareholders 50/50, long names, management, optional blank contact identity/email, saved Section D answers | Standard KYC and total/export correctness |
| K-02 | Deep/wide ownership tree, 12+ parties, long/Arabic names, multiple managers, signatures/stamp | Print readability, pagination, parsing and limits |
| E-01 | Synthetic PDF/XLS/XLSX/images/Word within allowed limits; empty, oversize and renamed invalid files | Upload validation/failure paths |
| R-01 | Case progressing through V1/V2/V3 with distinct comments and attachment hashes | History/return/concurrency |

Role matrix: Operations tests WF-03/04/15; AML Team/Supervisor tests WF-05 to WF-09 and reopened drafts; DMLRO tests WF-10; MLRO/SEF tests WF-11; each authorized final-decision role tests WF-12. Company Admin is tenant-scoped; Super Admin has explicit platform exceptions. Accounting/HR test permitted views and denied decisions. Repeat security tests with access matrix unconfigured, configured NONE, VIEW, EDIT and a multi-role account. Do not infer that a fallback role list remains mandatory when matrix grants are configured (F-01).

## Reusable endpoint procedures

**Q-API** applies to every row in ENDPOINT_QA_MATRIX.md. Read its controller contract and resolved service logic; construct one valid synthetic request, record success body/content type and state delta. Then send no token, malformed/expired token, suspended-user token, wrong-role token, VIEW token for a command, and Tenant B token with Tenant A path/body IDs. Expect 401 for invalid session, 403 or intentionally scoped 404 for denied resources, and no unauthorized DB/file/history changes. Public login/health are explicit auth exceptions. Do not require public health to reject no-token calls; verify no sensitive internals instead. DTO unknown fields should fail only where runtime DTO validation applies; Record bodies need explicit service-contract tests.

**Q-NEG** for each command: missing required data, bad enum/date/number, empty rich text, unknown/cross-tenant linked IDs, invalid state and already-completed action. Capture exact errors; ensure no partial updates, approvals or success notification. Known partial behavior must be logged as a defect, not accepted merely because the UI reports failure.

**Q-RACE** for state-changing commands: send the same action twice, double-click, retry after a simulated lost response, and race two roles on one case. Expect one valid transition or a documented idempotent result; no duplicate case/revision/version/notification, illegal state, missing history or silent lost edit. File-upload retry semantics must be explicitly reviewed rather than assumed idempotent.

**Q-READ** for all GETs: compare before/after DB/files, test URL guessing, cache headers, attachment disposition/content type and response-field privacy. For initialization GETs, test VIEW mode and concurrent first reads; document any authorized initialization and flag unexpected writes. JSON success is not necessarily read-only.

## Scenario acceptance matrix

Use the ordered action in each row with the relevant fixture. The required UI/API/database outcome is a test oracle; a known finding means the observed implementation may currently fail it.

| ID | Workflow/rules | Steps | Expected outcome and evidence |
|---|---|---|---|
| Q-01 | WF-01 R-01 | Login valid/invalid email/password; inspect login audit | Valid token/public user only; invalid 401; no password/hash in response |
| Q-02 | WF-01 R-01 | Use expired token; suspend user/change roles after login; retry | Current-user state enforced on next protected request; no stale elevated role |
| Q-03 | WF-02 R-02/R-03 F-01 | Company Admin A calls tenants B/global APIs with configured administration VIEW/EDIT | No unintended cross-tenant read/write; test both matrix modes and log actual response |
| Q-04 | WF-02 R-03 F-08 | Set module NONE; call undecorated GET lists/details; compare VIEW initialization | Direct API honors agreed area boundary; record initialization changes |
| Q-05 | WF-02 R-03 | Change seven access levels; try modifying Super Admin; test mixed roles | Valid catalog levels persist; Super Admin cannot be locked out; effective grants match policy |
| Q-06 | WF-02 R-02 F-02 | Inspect nested tenant/user/profile JSON field names | No passwordHash/token/secret fields; retain only redacted structural evidence |
| Q-07 | WF-03 R-04 | Save incomplete draft, reload, complete required intake fields | Draft survives; complete input persists; required error appears before submission |
| Q-08 | WF-03/04 R-05 | Try 130% and 99% direct totals, then 100%; enter corporate-linked effective UBO % | Invalid submission rejected server-side; UBO not added to direct total; valid 100 accepted |
| Q-09 | WF-04 R-04 | Fill only contact Name/Mobile/Position, omit email/nationality/document/passport/QID; proceed/save/reload | Contact step accepts, no unwanted required markers; filled values retained; direct API policy separately checked |
| Q-10 | WF-03/04 R-04 F-09 | Call API directly without UI-required contact fields; compare QFZ/MOCI blank address | Server/UI agree with approved B-05; discrepancies become tickets |
| Q-11 | WF-04 R-07/R-14 | Save Preliminary, download PDF and inspect all pages | Saved declaration/signature/stamp present; no Section D; no browser print timestamp/title |
| Q-12 | WF-05 R-02 | Convert READY_FOR_KYC, then retry concurrently; try before READY and wrong tenant | Exactly one source-linked case; state/history correct; invalid attempts no mutation |
| Q-13 | WF-05 B-03 | Create client/case directly and inspect initial statuses | Document approved direct-entry exception; no unnoticed activation bypass |
| Q-14 | WF-06 R-05 | Add nested parties, corporate parent links, marked individual UBO, invalid parent | Preview includes correct UBOs; invalid links/layer totals rejected; root total not double-counted |
| Q-15 | WF-06 R-07 | Open full KYC Section D blank; choose No/Yes with details; save/reload/export | No assumed No; explicit values survive; submission blocks missing answers/Yes details |
| Q-16 | WF-06 R-10 | Open two tabs; return creates new revision; save old expectedVersion | Old tab rejected; current revision/content unchanged by rejected request |
| Q-17 | WF-06 R-10 F-04 | Change A plus invalid B in one autosave; inject late section failure | No silently partial save under approved contract; record actual DB changes and error |
| Q-18 | WF-07 R-06 | Screen each dropdown party once; select Google No negative news once; save/reload/finalize | Single selection persists; completed entities not offered redundantly; no missing-party false completion |
| Q-19 | WF-07 R-06 | Omit common evidence/result; add potential match without notes; add new owner after screening | Submission blocked until every current party and required result/evidence are complete |
| Q-20 | WF-08 R-06 | Upload CRRF, immediately observe list; save valid risk; retry with missing risk/file | Immediate visible document; unsaved comments retained on failure; valid risk/file persists |
| Q-21 | WF-09 R-06/R-07 | Remove Screening/CRRF/full compliance/comment in turn; use legacy and current submit APIs | Checklist matches authoritative rejection; no state advancement or stuck submitting UI |
| Q-22 | WF-09/10 R-08 | Submit Supervisor, keep old editor and enquiry URLs open; edit via UI/direct API | AML/Operations cannot change submitted preparation; DMLRO can edit own active stage |
| Q-23 | WF-12 R-07/R-09 | Approve P-01; choose Full KYC required; edit A-G/D and save | New editable full draft; original Preliminary unchanged; prior signatures not new approvals |
| Q-24 | WF-14 R-14 | Export K-01 with 50/50 roots and nested owner; compare saved totals | 100% root total in PDF and DOCX; nested percent not added |
| Q-25 | WF-07/08 R-08 F-03 | After DMLRO/MLRO/SEF handoff, PATCH Screening/CRRF and delete/upload evidence | Frozen submitted package or approved versioned change; no silent alteration of reviewed evidence |
| Q-26 | WF-06/08/14 R-14/R-15 F-07 | Upload invalid MIME/signature/size; deny filesystem; fail DB write/delete after file action | Clear error, safe paths, no dangling/missing evidence; compensating behavior recorded |
| Q-27 | WF-10/11 R-11 B-01 | Attempt DMLRO absence approval; attempt MLRO before DMLRO; check tasks/history | Behavior matches signed-off substitution/parallel policy; reason alone not assumed delegation |
| Q-28 | WF-14 R-14 | Render/print K-02 DOCX in Word and PDF at normal size, inspect every page | Legible ownership, no overlap/clipping; consistent fonts/tables/letterhead; actual images not filenames |
| Q-29 | WF-10/11 R-08/R-15 | DMLRO sends to MLRO then tries draft/section H; MLRO sends SEF then edits; double-submit | Prior reviewer read-only; no partial save followed by misleading error; one transition/audit set |
| Q-30 | WF-10/12 R-09/R-13 | Return with formatted reason; inspect AML view, resubmit twice | Return reason visible to authorized roles; formal formatting retained; all prior versions recoverable |
| Q-31 | WF-11 R-11 F-09 | Persist HIGH risk; omit submitted finalRiskClassification and attempt approval | Cannot bypass SEF using omitted/stale risk; risk history explains changes |
| Q-32 | WF-11 R-13 B-04 | Post confidential note per scope; query every role including SEF/admin and case JSON | Only approved scope audience sees note; formal feedback shared without confidential fields |
| Q-33 | WF-12 R-09 F-06 | Hash original form/files/comments/review versions; full conversion then repeated return | Original bytes/data/history retained; completed approval evidence remains; no reapproval implied |
| Q-34 | WF-13 R-09 F-09 | Approve a standard non-Preliminary KYC; request amendment and open as AML | Populated standard draft editable; no lost tasks/comments/history; log locked-state defect if reproduced |
| Q-35 | WF-13/14 R-09/R-14 | Download archived V1/V2 plus current V3; replace/delete current attachment | Archives retain independent available bytes and correct form/export revision; missing source reported |
| Q-36 | WF-15 R-12 | Finalize, omit signed engagement/checklist item, then activate/hold/reject with reason | Approved prerequisites enforced; client/case lifecycle consistent; history and notification correct |
| Q-37 | WF-15 R-15 F-05 | Inject case/history failure after client update on disposable DB | Rollback or controlled compensation; never ACTIVE client with failed activation silently |
| Q-38 | WF-16 R-02/R-15 B-06 | Two users receive broadcast; one marks read/all; inspect second user and tenant | Per approved acknowledgement policy; no cross-tenant/read leakage; bounded list behavior understood |
| Q-39 | WF-16 R-15 | Complete each critical command; compare actor/time/status/audit/notification records | Expected records exist exactly once; no sensitive payload logging; identify unlogged mutations |
| Q-40 | WF-12/13 R-09 F-06 | Try deleting source enquiry, case and client after archived approval on disposable fixture | Retention policy enforced; original/comments/history survive ordinary deletion attempts |
| Q-41 | WF-03 R-03 F-09 | Enumerate invalid source/target status combinations using PATCH status as each role | Only approved graph transitions succeed; enum membership alone cannot reset locks |
| Q-42 | Operations gate | Restart application; verify private storage permissions, local/public health, failed Chromium case | Safe errors, no public uploads/env, services recover; health not mistaken for workflow readiness |
| Q-43 | Operations gate | Back up DB/uploads, restore to isolated target, compare R-01 hashes and statuses | Demonstrated restore with recorded duration and integrity; approved migration rollback procedure |
| Q-44 | Performance gate | Owner-approved concurrent users/uploads/PDF generation and large register datasets | Agreed response-time/error/queue limits met; no memory exhaustion, lost changes or unreadable reports |

## Execution order and release gates

First agree B-* decisions and reproduce high findings with synthetic data. Then execute security/tenant tests, complete standard and Preliminary journeys, alternate return/reject/conditional paths, conversion/amendments, exports, and finally failure-injection/load/restore. Every registered operation gets a Q-API evidence row; aggregate journey tests do not excuse untested legacy endpoints.

Proposed release gates: zero open Critical/High defects; Medium risks individually dispositioned by the accountable owner; all mandatory journeys and role/tenant tests PASS; no data/history loss; Word/PDF visual checks complete; deployed commit/migrations match QA evidence; backup restore and rollback demonstrated. QA independently retests fixes. Business owner approves policy; engineering approves technical corrections; operations approves recoverability; release owner signs go/no-go. No signatures or approvals are assumed.

Severity guidance: Critical = demonstrated uncontrolled cross-tenant/credential exposure or unrecoverable major data loss; High = authorization bypass, invalid approval/activation or history/evidence loss; Medium = bounded inconsistency, recoverable failure or operational risk; Low = presentation issue without decision/data impact. Security/privacy owner decides final severity from reproduced impact.

## Defect and signoff templates

Defect record: ID; linked F/Q/API/WF/R; environment/commit; synthetic fixture; role/tenant; preconditions; steps/input; expected vs actual; redacted response and DB/file diff; severity; owner; fix commit; retest result; residual risk.

Signoff record: business-rule approval (owner/date/evidence); engineering finding disposition; QA matrix pass/fail/blocked counts; operations restore/deploy evidence; release-owner go/no-go and accepted risks. All fields remain pending until completed by the responsible people.
