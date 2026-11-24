# SaaS Readiness Review - 24 November 2026

## Decision

**Not yet approved for shared multi-client SaaS production.** The code has tenant identifiers, JWT authentication, role controls and company administration, but these alone do not prove tenant isolation or operational readiness. New module tiles are navigation, not paid-plan entitlements or security boundaries.

Reviewed baseline: `09e032b12e5bb64937fd434338d75242db4e996a`, plus the uncommitted module-navigation changes on `feature/saas-modules/2026-11-24`. Local Windows build and synthetic browser tests only. No production/staging database, server configuration, real documents or secrets were accessed. Pending Operations deletion work in another worktree is excluded.

This is a source-level readiness assessment and release backlog, not an exhaustive penetration test, legal opinion or production certification. The older [architecture review](../architecture-review/README.md) assesses an October commit; its findings must not be assumed current. The fresh [inventory](inventory.json) and [API appendix](TECHNICAL_APPENDIX.md) enumerate the current routes, registered controllers and schema. Static traversal has limitations; every endpoint still needs staging verification.

## Implemented Now

- Login/home redirects land on `/workspace` for authenticated users.
- Three permission-aware tiles: Enquiry, KYC, Compliance Clients. Restricted users see only permitted modules; a CRRF-only user lands on CRRF rather than an inaccessible KYC list.
- Enquiry menu: enquiry register. KYC menu: workflow, Screening, CRRF and Review Tasks, each filtered by existing permissions. Compliance menu: Compliance Clients and its existing detail screens/tabs.
- All Workspaces returns to the selector. Dashboard and authorized administration links remain available. Existing routes, bookmarks and notification links retain their targets and route guards.
- Account/profile/password controls are unchanged. No form, preview, PDF/DOCX, schema, API, dependency or workflow logic was changed.
- Tiles use existing role/access rules, not `TenantModule.isEnabled`; see S-03 before selling independently licensed modules. No fabricated counts or readiness badges are displayed.

## Priority Findings

These are source observations unless explicitly marked unverified. Severity is proposed for release planning. Owners must attach fix commits, staging evidence and disposition before closure.

| ID | Priority | Evidence and impact | Required resolution and acceptance |
|---|---|---|---|
| S-01 | High | `auth/jwt.strategy.ts:validate` reloads user status/roles/sessionVersion but does not load/check `Tenant.isActive`. `AuthService.login` loads tenant but only rejects suspended users. Tenant deactivation is therefore not an authentication kill switch. | Define Super Admin exemption, reject inactive/missing tenant for tenant accounts on login, OTP completion and every authenticated request. Test existing tokens and active Tenant B after suspending Tenant A. |
| S-02 | High design decision | `Role.name` is globally unique; `RolePermission` has no tenantId; `AccessControlService.updateRole/effectivePermissions` operate on global roles. Permissions for one role apply across companies. | Either explicitly retain platform-managed global roles or introduce tenant-scoped overrides with migration and defaults. If independent company role customization is promised, prove Tenant A changes cannot change Tenant B. Do not silently change the matrix semantics. |
| S-03 | High if modules are licensed | `TenantModulesService.assign` stores enabled flags; the current RolesGuard checks area grants, not tenant module entitlement. Source search finds module flags in administration/dashboard, not business-route guards. | Agree mapping from three workspaces to module catalog. Enforce entitlement server-side as well as in auth/UI, including file downloads and legacy routes. Disabling KYC must reject direct API calls without disabling another tenant. If all modules are always included, document that policy instead. |
| S-04 | High | Registered `SelfPasswordController` uses `SelfPasswordService.change`, which changes passwordHash but does not increment sessionVersion. `AuthService.changePassword` has separate versioned logic but is not the controller's handler. Existing JWTs can remain valid after self-service password change. | Consolidate the active path and transactional session invalidation; verify old tokens on another browser are rejected while a new login succeeds. UI local logout is insufficient. |
| S-05 | High review-package integrity | `CrrfService.saveWorkspace` calls tenant-scoped findCase/ensureRecord but no review-stage lock; findCase checks existence and tenant only. An editable area grant does not freeze submitted evidence. Screening mutations need the same complete endpoint review. | Define edits allowed by stage and version or freeze review packages. Stale AML tokens must not alter the submitted package while DMLRO/MLRO/SEF reviews it. Test uploads/deletes as well as PATCH. |
| S-06 | High retention | `KycService.remove` uses requireWritableCase and hard deletion; Prisma revisions/reviews have cascade relationships. A writable status alone is not an immutable retention policy. | Define retention, prevent ordinary erasure of submitted/approved/amended history, and test case/client/enquiry deletion paths. Reassess separately when the pending cleanup feature is included. |
| S-07 | Medium/High consistency | `autoSaveForm` performs sequential section saves. `completeEngagementDecision` updates/activates the client then separately calls updateStatus. Transactions inside helper methods do not make the whole command atomic. | Failure-injection and concurrent-request tests; choose aggregate transaction/outbox/version contract. UI must never report total failure after a partial irreversible update without disclosing the saved state. |
| S-08 | High dependency triage | Local `npm audit --omit=dev --json` reports 34 affected packages: 2 critical, 23 high, 8 moderate, 1 low. Critical package names: proxy-addr and tar. This is advisory classification, not proof of reachable exploitation; some build tooling is declared as production dependency. | Save reproducible lockfile/advisory evidence, determine runtime reachability, patch compatible versions first, test deliberate major upgrades separately. No `audit fix --force`. Audit again on the final locked release and document residual risk. |
| S-09 | High operational gate, not verified | CRRF and other evidence use filesystem storage; no live shared/object-store, encryption, off-host backup/restore, retention job, malware scanning or capacity evidence was inspected. Horizontal replicas cannot assume a shared local disk. | Approved storage architecture, per-tenant authorization/path tests, upload quarantine/scanning, disk quotas, encrypted off-host DB+file backups and a timed restore rehearsal. Archive references must recover with files. |
| S-10 | Medium scaling | LoginRateLimiter and self-password failure tracking use process-local state. Independent replicas/restarts can reset or fragment these counters. OCR/PDF jobs also need measured capacity, timeouts and back-pressure. | Shared enforcement or documented single-process limits plus ingress controls. Test parallel load, failures, retries, upload limits and resource exhaustion; define per-tenant usage limits. |
| S-11 | High assurance gate, not verified | Application tenant filters exist, but this review did not execute every endpoint with two tenants. Parent/child IDs, nested documents, exports, notifications, tasks and Super Admin cross-tenant actions need negative tests. | Execute the endpoint matrix with two synthetic tenants and each role. No data existence leaks, unscoped lists or cross-tenant writes/downloads. Scope bulk and background operations too. |

Evidence paths above are under `backend/src` unless stated otherwise. Confirmed older improvements: `RolesGuard.areaForController` excludes platform-only controllers from matrix grants; `TenantsService.findOne` uses explicit safe user selection. October F-01/F-02 descriptions must not be copied as present defects without fresh reproduction. Other historical findings remain unclosed until independently retested.

## Architecture For Rollout

Recommended first release: assisted onboarding, with one tenant per customer, controlled platform administration and no self-service billing promises. A dedicated deployment per customer can reduce cross-customer blast radius, but still needs security/backup/session controls. Decide shared deployment versus dedicated instances before implementing subscriptions or custom domains.

1. Platform operator creates tenant, initial company administrator and approved configuration through authorized administration. Do not run the development seed against client data.
2. Company administrator creates staff and assigns allowed roles within its tenant. Platform-global permission changes are not company-specific customization today.
3. Authenticated users enter the workspace selector and work through the existing Enquiry -> KYC -> review -> activation -> Compliance lifecycle. Existing workflow prerequisites remain authoritative on the backend.
4. Tenant suspension, module entitlements, session invalidation and retained-history policy must be enforced centrally before a shared SaaS launch.
5. Add operational readiness: deployment pipeline, isolated staging, migration backups, health/readiness checks, request correlation, redacted logs, monitoring/alerts, rollback and recovery runbooks.
6. Optional commercial phase after core acceptance: subscription/plan model, billing webhooks with idempotency, quotas, invitations, custom branding/domains and data export/offboarding. None is implied by this module selector.

## Release Gates And QA

- Security owner: resolve S-01/S-04 and all reachable critical/high advisories; independently retest permissions and tenant boundaries.
- Business owner: approve S-02/S-03/S-05/S-06 policy; no undocumented permission, evidence or deletion exceptions.
- QA: use two synthetic tenants, separate admin/Operations/AML/DMLRO/MLRO/SEF/read-only users. For every endpoint, check no token, wrong role, correct role, wrong tenant, child ID from another tenant and disabled tenant/module. See [endpoint matrix](ENDPOINT_QA_MATRIX.md); all staging rows are initially NOT RUN.
- Workflow QA: drafts, missing prerequisites, returns, resubmission, preliminary-to-final conversion, repeated amendments, simultaneous reviews, stale tabs and duplicate submissions. Compare original/approved forms, comments, signatures, attachments and exports before/after every handoff.
- Storage QA: invalid/oversized files, missing bytes, failed writes, failed DB inserts, traversal attempts, inaccessible renderer and restore DB+uploads together. Use synthetic documents only.
- Operations: TLS, trusted-proxy configuration, private DB/API bindings, secrets rotation, SMTP verification, scheduled backups, recovery target and documented rollback. No client rollout until restore evidence is accepted.
- Accessibility/performance: keyboard navigation, mobile menus, account controls, long names, responsive forms, measured concurrent OCR/export load and route-load budgets. Current Vite bundle remains above its 500 kB warning threshold.

## Verification And Limits

- Full `npm.cmd run build`: passed, including Prisma generation. Existing Prisma deprecation and bundle-size warnings remain.
- `node frontend/scripts/check-workspace-modules.cjs`: passed at 1440/768/390/320px, three tiles, module menus, restricted CRRF-only landing, no-access state, existing deep-link classification and no page overflow. Synthetic API adapter; no business endpoint was exercised.
- Desktop/mobile screenshots inspected. Module test artifacts are written to the OS temporary directory, not client storage.
- `npm.cmd audit --omit=dev --json`: completed with the advisory findings above; npm returns nonzero when advisories exist. No packages upgraded.
- `node backend/scripts/check-saas-readiness-observations.cjs` deliberately reproduces S-01/S-04 using compiled services, mocked persistence and synthetic credentials. Its success means those gaps were observed, not that the release passed security acceptance. No real account is changed.
- API inventory regenerated from registered source, not live requests. A static inventory and build are not tenant-isolation tests.
- Preview/export source remains untouched; no new Word/PDF visual certification is claimed.
- No shared database, application server, migration, seed, push or deployment was performed for this change.

Next implementation order: session/tenant lifecycle -> policy-approved tenant permissions and entitlements -> review/retention consistency -> storage/observability/dependency hardening -> independent staging QA -> controlled pilot. Until those gates pass, describe the product as a tenant-aware application under SaaS hardening, not fully SaaS-ready.
