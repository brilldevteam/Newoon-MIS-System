# Architecture Evaluation Findings

All findings are open at the assessed commit. No application changes were made by this review. Static observations are not exploit demonstrations; reproduce only with synthetic staging tenants and approved accounts. Proposed severities support prioritization and require engineering/security-owner confirmation. Each finding needs owner, target date, fix commit, retest evidence and disposition before closure.

## Priority register

| ID | Proposed severity | Source evaluation | Workflow and QA |
|---|---|---|---|
| F-01 | High | Area grants can replace global-only role restrictions; global tenant service has no scope | WF-02, R-02/R-03, Q-03/Q-05 |
| F-02 | High | Tenant details include full user rows, including passwordHash scalar | WF-02, R-02, Q-06 |
| F-03 | High | Screening/CRRF mutations lack case-stage lock | WF-07/WF-08, R-08, Q-25 |
| F-04 | Medium | Composite autosave can persist earlier sections before later validation fails | WF-06, R-10, Q-17 |
| F-05 | High | Activation updates client separately from case/history; checklist not fully enforced here | WF-15, R-12/R-15, Q-36/Q-37 |
| F-06 | High | Cascade deletes can destroy retained revisions and review history | WF-12/WF-13, R-09, Q-33/Q-40 |
| F-07 | Medium | File/database operations are not atomic; failed operations can orphan/remove evidence | WF-06/WF-08/WF-14, R-14/R-15, Q-26 |
| F-08 | Medium | Some GET requests initialize/update persistent data | WF-02/WF-06/WF-07/WF-08, R-03, Q-04/Q-READ |
| F-09 | High review priority | Multiple workflow/policy contradictions need focused confirmation | WF-03/WF-10/WF-11/WF-13, Q-27/Q-31/Q-34/Q-41 |

## F-01 Global authorization can be widened by area configuration

Evidence: [RolesGuard](../../backend/src/common/guards/roles.guard.ts#L11) returns configured area allowance before testing required role membership. [TenantsController](../../backend/src/tenants/tenants.controller.ts) declares SUPER_ADMIN, but [TenantsService](../../backend/src/tenants/tenants.service.ts#L8) lists/finds tenants without a RequestUser filter. [AccessControlService](../../backend/src/access-control/access-control.service.ts) allows administration grants, with Company Admin administration EDIT in defaults. Methods lacking roles metadata return true before area evaluation as well (for example KYC lists/details).

Conditional reproduction: enable the access matrix, give Tenant A Company Admin administration VIEW/EDIT, call GET /api/tenants and GET /api/tenants/<Tenant-B-id>, then try POST /api/tenants on disposable data. Compare fallback mode. Expected security acceptance: tenant admin cannot enumerate or control other tenants, irrespective of generic administration grants; NONE cannot access protected module APIs merely because no roles decorator exists. Source shows a guard/service path permitting broader access; no cross-tenant live test was run.

Recommendation for approval: distinguish mandatory platform/stage roles from configurable module grants; require tenant scoping in global-capability services and explicit Super Admin checks for global actions. Do not blindly change all decorators to intersection semantics without reviewing intended access configuration. Business owner: B-02.

## F-02 Tenant details expose credential-derived data

Evidence: [TenantsService.findOne](../../backend/src/tenants/tenants.service.ts#L18) uses `include: { users: true }`. [User model](../../backend/prisma/schema.prisma#L74) contains passwordHash; there is no explicit user-field selection in this response path. [UsersService](../../backend/src/users/users.service.ts) does use an explicit safe selection, illustrating an existing pattern.

Reproduction: inspect response field names only for a synthetic tenant; confirm passwordHash is absent from all profiles, tenant details and nested responses. Do not copy hash values into evidence. Expected: public user DTO fields only, even for Super Admin. Recommendation: explicit allow-list selection/response DTO, automated recursive response-field regression. F-01 amplifies impact but is not required for this disclosure to administrators.

## F-03 Submitted supporting evidence remains mutable

Evidence: [ScreeningService.updateMergedCheck](../../backend/src/screening/screening.service.ts#L151) and record/document operations use tenant/case checks but not review-state locking. [CrrfService.saveWorkspace](../../backend/src/crrf/crrf.service.ts#L48), uploads and deletes likewise use findCase/ensureRecord; [findCase](../../backend/src/crrf/crrf.service.ts#L196) checks existence/tenant only. Controller grants permit AML writes and CRRF reviewer writes. Main form stage locks do not protect these independent endpoints.

Reproduction: submit a complete case to DMLRO, retain an AML token, PATCH common Screening result and CRRF risk, upload/remove evidence; repeat after MLRO/SEF handoff. Expected acceptance pending B-01: reject stale-stage writes or explicitly version/freeze submitted evidence. Recommendation: shared package-level state enforcement and immutable evidence snapshot references. Do not treat a read-only form editor as sufficient.

## F-04 Autosave is a sequence of commits

Evidence: [autoSaveForm](../../backend/src/kyc/kyc.service.ts#L1455) validates H up front, then awaits A, D, E, G, B, C, F and H independently. Each section can use its own transaction. A later invalid ownership layer or failure can occur after earlier company/declaration changes have committed.

Reproduction: change A legalName and supply invalid B percentages in one autosave request; compare pre/post data after 400. Expected acceptance: either atomic save/rejection or an explicit partial-result contract and UI that reports what persisted. Recommendation: prevalidate the complete payload and transactional aggregate write, with optimistic concurrency; preserve existing file semantics separately. No atomicity guarantee should be documented before a failure-injection test passes.

## F-05 Activation can produce inconsistent client and case state

Evidence: [completeEngagementDecision](../../backend/src/kyc/kyc.service.ts#L1141) checks final case status and signed-letter storagePath, then calls client.update before updateStatus. The two operations are not wrapped in one transaction here. It does not invoke the entire activation-readiness checklist as a hard gate. The signed-letter check is a metadata path check, not a filesystem read.

Reproduction: on a disposable database, fail the case status/history write after client update; check client ACTIVE while case remains final/pending. Also call the API with remaining checklist blockers and a missing file behind an existing path. Expected: one atomic lifecycle result and policy-approved mandatory evidence. Recommendation: one transaction for state/history/audit and an explicit authoritative readiness gate. Confirm requirements with B-03.

## F-06 Retention is not enforced against deletion

Evidence: [KycService.remove](../../backend/src/kyc/kyc.service.ts#L203) deletes a writable case. [ClientsService.remove](../../backend/src/clients/clients.service.ts#L251) deletes clients. [schema KycFormRevision and KycRevisionFile](../../backend/prisma/schema.prisma#L616), form/history/review relations use cascading deletes. An amendment reopens the case into a writable state, but no permanent-retention condition is checked in remove.

Reproduction: create approved Preliminary KYC, open full KYC, archive/hash records and files, then attempt case/client deletion with an authorized disposable account. Query archive/review counts afterwards. Expected under the user's stated retention requirement: original form, comments and approval history cannot be erased by ordinary application deletion. Source uses hard-delete paths and cascade relations, not a permanent archive guarantee.

Recommendation: approved retention policy, soft-delete/deletion restriction after any submission/archive, database-level retention protections and independent backup controls. Consider whether source enquiry edits/deletion may change the user-visible original; do not rely solely on the current enquiry JSON. Business/legal owner must define retention period and exceptional erasure process (B-05).

## F-07 Filesystem and database failures are not coordinated

Evidence: [CRRF upload/delete](../../backend/src/crrf/crrf.service.ts#L76) writes files before inserting rows and unlinks files before deleting rows. Similar patterns exist in Screening and legal/enquiry uploads. Revision capture skips source paths that are already absent. File bytes cannot be rolled back by a PostgreSQL transaction.

Reproduction: deny storage write permission, fail one DB insert in a multi-file upload, and fail DB deletion after unlink on a disposable storage root. Check missing references/orphans, UI errors and retry duplication. Recommendation: staged uploads, compensation/reconciliation and explicit incomplete-archive warnings; monitor free space. Recommend malware scanning as a separate unverified control, not a claimed feature.

## F-08 GET requests have side effects

Evidence: [getForm](../../backend/src/kyc/kyc.service.ts#L1440) creates a missing form and can ensure a KYC number; [Screening getContext](../../backend/src/screening/screening.service.ts#L95) ensures check records; [CRRF getWorkspace](../../backend/src/crrf/crrf.service.ts#L38) ensures a record. Access-matrix GET can seed its permission catalog. RolesGuard treats GET as view access, not write access.

Reproduction: snapshot row counts, perform each view with a VIEW-only account, compare writes and audits. Expected: explicitly approved initialization policy with no unauthorized meaningful content mutation. Recommendation: move initialization to write commands or enforce/document narrowly idempotent initialization and concurrency handling. No general HTTP cache/prefetch safety should be assumed.

## F-09 Workflow contradictions and incomplete guards

These are separately reproducible review items, not one proved production incident:

- Generic startAmendment sets AML_REVIEW_STARTED and deletes review tasks. Its fullKycStarted flag remains false for a normal standard case; legacy edit allowance requires true. The newly populated standard amendment can therefore remain locked. See [startAmendment](../../backend/src/kyc/kyc.service.ts#L1336), requireWritableForm/isLegacyFullKycDraft and frontend preparationEditable. Q-34 must test standard cases, not only Preliminary conversion.
- The DMLRO final-approval path says MLRO absence but has no absence/delegation evidence check. MLRO code contains bypass-related handling, but assertPreviousStageComplete rejects without a locked DMLRO submission first. Compare intended exceptional routing to actual behavior rather than assuming parallel review works. B-01/Q-27.
- HIGH routing checks submitted finalRiskClassification. Verify omitting that field cannot approve a case with persisted HIGH CRRF/internal risk. This is a risk hypothesis requiring Q-31, not a proven bypass.
- `confidentialCommentWhere` gives SEF all confidential types despite enum scopes named MLRO_ONLY/DMLRO_MLRO. Decide whether SEF inclusion is intended (B-04); test returned DTOs, not just UI.
- Enquiry updateStatus has explicit checks for submit/return/ready but not a complete permitted transition graph for every enum target. A caller allowed to PATCH status may reset another state using an unhandled target. Its DTO validates enum membership, not transition legality. Q-41.
- Frontend proposed-address exceptions (QFZ/MOCI) differ from assertCompletePreliminaryKyc's always-required registeredOfficeAddress. Direct API contact completeness also differs from UI. B-05/Q-10.

Recommendation: agree one explicit transition/authority specification, eliminate contradictory paths only through separately approved fixes, and add direct API contract/state tests. Do not weaken safeguards to match a permissive UI.

## Business decisions awaiting approval

| ID | Decision | Recommended default pending approval | Owner |
|---|---|---|---|
| B-01 | DMLRO substitution, parallel review, high-risk escalation, evidence editing after handoff | Sequential Supervisor-DMLRO-MLRO; SEF for persisted HIGH; formal delegation evidence; freeze submitted package | Compliance/business owner |
| B-02 | Whether matrix grants can override global/stage roles | Mandatory global/stage restriction plus tenant scope; matrix controls module access only | Security/platform owner |
| B-03 | Direct ACTIVE client create and activation checklist requirements | Define migration/import exception; normal new client follows final KYC and all mandatory readiness items | Operations/business owner |
| B-04 | Confidential scope audience, especially SEF and admins | Enumerate audiences per scope; least privilege and explicit exceptional access audit | Compliance/privacy owner |
| B-05 | Permanent history retention, exceptional erasure and required intake fields | No ordinary deletion after review; explicit server/UI-aligned field policy; do not invent missing answers | Legal/compliance/business owner |
| B-06 | Broadcast notification read state and audit coverage | Per-user acknowledgement for broadcasts; agreed audit events for critical mutations | Product/operations owner |

## Unverified operational risks

No staging deployment, restore test, dependency vulnerability scan, authentication load/rate-limit test, proxy/TLS configuration check, upload malware inspection, or real Word layout review was performed here. These are QA/operations gates, not confirmed defects. Do not attribute historical documentation's security-hardening claims to the currently assessed source without evidence.
