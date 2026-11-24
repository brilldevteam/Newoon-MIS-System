# Technical Workflow and API Appendix

Baseline `09e032b12e5bb64937fd434338d75242db4e996a` on `feature/saas-modules/2026-11-24`. Review date 2026-11-24. Uncommitted working-tree changes present: true.

Coverage: 30 registered controllers, 182 HTTP operations, 36 frontend routes, 65 database models, 39 enums. Resolved from AppModule imports and module controllers; no application startup or database access.

## How to interpret this inventory

This is a source-derived contract index, not an OpenAPI specification or proof that every endpoint passed QA. IDs are stable method/path hashes. DTO decorators describe input validation; generic bodies and output contracts depend on service checks. QA must capture redacted staging response contracts.

Roles are fallback decorators, not an unconditional allow-list. Configured area grants can replace them. Before configuration, compliance endpoints without role metadata follow area defaults. Platform-only controllers remain role-restricted. JWT validates user status/roles/session version, but not tenant activation. Service checks still apply. Audit the current RolesGuard, not the October review's description.

Global errors: {statusCode,timestamp,path,error}. Candidate failures include 400 validation/state, 401 session, 403 access, 404 scoped resource, 413/415 upload limits/types where enforced, 500 database/unhandled errors and 503 renderer. Exact behavior requires endpoint tests.

GET classification follows same-service calls and detected Prisma writes, not arbitrary dependency injection or runtime dispatch. It is not a proof of purity. Filesystem/database writes are not one transaction; detected audit calls do not prove complete coverage. Default success statuses follow Nest unless overridden; binary responses follow controllers.

The historical [workflows](../architecture-review/WORKFLOWS.md), [findings](../architecture-review/FINDINGS.md) and [QA checklist](../architecture-review/QA_HANDOVER.md) are references, not current validation. Read the November SaaS assessment for rechecked findings.

## Frontend entry points

| ID | Route | Page or redirect | Inherited presentation guard | Evidence |
|---|---|---|---|---|
| UI-C42C80AA | `/login` | `<LoginPage />` | `No explicit wrapper here` | [frontend/src/routes/router.tsx:42](../../frontend/src/routes/router.tsx#L42) |
| UI-42099B4A | `/` | `<HomeRedirect />` | `<ProtectedRoute />` | [frontend/src/routes/router.tsx:50](../../frontend/src/routes/router.tsx#L50) |
| UI-8AF22C44 | `/workspace` | `<WorkspaceHomePage />` | `<ProtectedRoute />` | [frontend/src/routes/router.tsx:51](../../frontend/src/routes/router.tsx#L51) |
| UI-28BD26B4 | `/access-denied` | `<AccessDeniedPage />` | `<ProtectedRoute />` | [frontend/src/routes/router.tsx:52](../../frontend/src/routes/router.tsx#L52) |
| UI-5EC026C5 | `/dashboard` | `<DashboardPage />` | `<ProtectedRoute />` | [frontend/src/routes/router.tsx:53](../../frontend/src/routes/router.tsx#L53) |
| UI-08225346 | `/account/password` | `<ChangePasswordPage />` | `<ProtectedRoute />` | [frontend/src/routes/router.tsx:54](../../frontend/src/routes/router.tsx#L54) |
| UI-D48BBA30 | `/account/profile` | `<MyProfilePage />` | `<ProtectedRoute />` | [frontend/src/routes/router.tsx:55](../../frontend/src/routes/router.tsx#L55) |
| UI-60DE948F | `/enquiries` | `<EnquiryListPage />` | `<ProtectedRoute />; <RequireAccess area="enquiries" fallbackRoles={workflowRoles.enquiries} />` | [frontend/src/routes/router.tsx:58](../../frontend/src/routes/router.tsx#L58) |
| UI-5AAA1184 | `/enquiries/:id` | `<EnquiryDetailsPage />` | `<ProtectedRoute />; <RequireAccess area="enquiries" fallbackRoles={workflowRoles.enquiryView} />` | [frontend/src/routes/router.tsx:62](../../frontend/src/routes/router.tsx#L62) |
| UI-5E733969 | `/enquiries/new` | `<AddEnquiryPage />` | `<ProtectedRoute />; <RequireAccess area="enquiries" write fallbackRoles={workflowRoles.clientIntake} />` | [frontend/src/routes/router.tsx:66](../../frontend/src/routes/router.tsx#L66) |
| UI-08D99489 | `/enquiries/:id/edit` | `<AddEnquiryPage />` | `<ProtectedRoute />; <RequireAccess area="enquiries" write fallbackRoles={workflowRoles.enquiryEditing} />` | [frontend/src/routes/router.tsx:70](../../frontend/src/routes/router.tsx#L70) |
| UI-4072F695 | `/clients` | `<Navigate to="/compliance/clients" replace />` | `<ProtectedRoute />; <RequireAccess area="clients" fallbackRoles={workflowRoles.clientIntake} />` | [frontend/src/routes/router.tsx:76](../../frontend/src/routes/router.tsx#L76) |
| UI-A690ED0A | `/clients/:id` | `<ClientDetailsPage />` | `<ProtectedRoute />; <RequireAccess area="clients" fallbackRoles={workflowRoles.clientIntake} />` | [frontend/src/routes/router.tsx:77](../../frontend/src/routes/router.tsx#L77) |
| UI-2727DF55 | `/clients/new` | `<AddClientPage />` | `<ProtectedRoute />; <RequireAccess area="clients" write fallbackRoles={workflowRoles.clientIntake} />` | [frontend/src/routes/router.tsx:83](../../frontend/src/routes/router.tsx#L83) |
| UI-8B9693F8 | `/clients/:id/edit` | `<AddClientPage />` | `<ProtectedRoute />; <RequireAccess area="clients" write fallbackRoles={workflowRoles.clientIntake} />` | [frontend/src/routes/router.tsx:84](../../frontend/src/routes/router.tsx#L84) |
| UI-617803FA | `/compliance/clients` | `<ComplianceClientListPage />` | `<ProtectedRoute />; <RequireAccess area="compliance" fallbackRoles={workflowRoles.complianceView} />` | [frontend/src/routes/router.tsx:90](../../frontend/src/routes/router.tsx#L90) |
| UI-CA7DB596 | `/compliance/clients/:id` | `<ComplianceClientDetailsPage />` | `<ProtectedRoute />; <RequireAccess area="compliance" fallbackRoles={workflowRoles.complianceView} />` | [frontend/src/routes/router.tsx:91](../../frontend/src/routes/router.tsx#L91) |
| UI-FC3EDF4F | `/tenants` | `<TenantsPage />` | `<ProtectedRoute />; <RequireRoles roles={workflowRoles.admin} />` | [frontend/src/routes/router.tsx:97](../../frontend/src/routes/router.tsx#L97) |
| UI-17B09069 | `/modules` | `<ModulesPage />` | `<ProtectedRoute />; <RequireRoles roles={workflowRoles.admin} />` | [frontend/src/routes/router.tsx:98](../../frontend/src/routes/router.tsx#L98) |
| UI-E6EF7307 | `/users` | `<UsersPage />` | `<ProtectedRoute />; <RequireAccess area="administration" fallbackRoles={workflowRoles.userAdmin} />` | [frontend/src/routes/router.tsx:104](../../frontend/src/routes/router.tsx#L104) |
| UI-0DE764FF | `/settings/ai-document-reading` | `<AiDocumentReadingPage />` | `<ProtectedRoute />; <RequireAccess area="administration" fallbackRoles={workflowRoles.userAdmin} />` | [frontend/src/routes/router.tsx:105](../../frontend/src/routes/router.tsx#L105) |
| UI-753D9E1F | `/access-control` | `<AccessControlPage />` | `<ProtectedRoute />; <RequireRoles roles={workflowRoles.admin} />` | [frontend/src/routes/router.tsx:110](../../frontend/src/routes/router.tsx#L110) |
| UI-513452A7 | `/kyc-workflow` | `<KycWorkflowPage />` | `<ProtectedRoute />; <RequireAccess area="kyc" fallbackRoles={[...workflowRoles.caseCreation, ...workflowRoles.kycPreparation, ...workflowRoles.reviewTasks]} />` | [frontend/src/routes/router.tsx:115](../../frontend/src/routes/router.tsx#L115) |
| UI-45500B06 | `/kyc/:id` | `<KycCaseDetailsPage />` | `<ProtectedRoute />; <RequireAccess area="kyc" fallbackRoles={[...workflowRoles.caseCreation, ...workflowRoles.kycPreparation, ...workflowRoles.reviewTasks]} />` | [frontend/src/routes/router.tsx:116](../../frontend/src/routes/router.tsx#L116) |
| UI-1E7757AB | `/kyc/new` | `<CreateKycCasePage />` | `<ProtectedRoute />; <RequireAccess area="kyc" write fallbackRoles={workflowRoles.caseCreation} />` | [frontend/src/routes/router.tsx:122](../../frontend/src/routes/router.tsx#L122) |
| UI-029A4677 | `/kyc/:id/edit` | `<CreateKycCasePage />` | `<ProtectedRoute />; <RequireAccess area="kyc" write fallbackRoles={workflowRoles.caseCreation} />` | [frontend/src/routes/router.tsx:123](../../frontend/src/routes/router.tsx#L123) |
| UI-D918C14E | `/kyc/:id/form` | `<KycFormEditorPage />` | `<ProtectedRoute />; <RequireAccess area="kyc" write fallbackRoles={workflowRoles.kycFormBuilder} />` | [frontend/src/routes/router.tsx:129](../../frontend/src/routes/router.tsx#L129) |
| UI-5BC25A17 | `/kyc/:id/submit` | `<SubmitToAmlPage />` | `<ProtectedRoute />; <RequireAccess area="kyc" write fallbackRoles={workflowRoles.kycFormBuilder} />` | [frontend/src/routes/router.tsx:130](../../frontend/src/routes/router.tsx#L130) |
| UI-27E491D3 | `/kyc/:id/revisions` | `<KycFormRevisionsPage />` | `<ProtectedRoute />; <RequireAccess area="kyc" fallbackRoles={workflowRoles.kycFormBuilder} />` | [frontend/src/routes/router.tsx:135](../../frontend/src/routes/router.tsx#L135) |
| UI-E06B4F54 | `/kyc/:id/documents` | `<UploadLegalDocumentsPage />` | `<ProtectedRoute />; <RequireAccess area="kyc" write fallbackRoles={workflowRoles.documentUpload} />` | [frontend/src/routes/router.tsx:139](../../frontend/src/routes/router.tsx#L139) |
| UI-48A0907A | `/screening` | `<ScreeningListPage />` | `<ProtectedRoute />; <RequireAccess area="screening" fallbackRoles={workflowRoles.screening} />` | [frontend/src/routes/router.tsx:144](../../frontend/src/routes/router.tsx#L144) |
| UI-94160747 | `/kyc/:id/screening` | `<KycScreeningPage />` | `<ProtectedRoute />; <RequireAccess area="screening" fallbackRoles={workflowRoles.screening} />` | [frontend/src/routes/router.tsx:145](../../frontend/src/routes/router.tsx#L145) |
| UI-F47950FD | `/crrf` | `<CrrfListPage />` | `<ProtectedRoute />; <RequireAccess area="crrf" fallbackRoles={workflowRoles.crrf} />` | [frontend/src/routes/router.tsx:151](../../frontend/src/routes/router.tsx#L151) |
| UI-0027B296 | `/kyc/:id/crrf` | `<CrrfWorkspacePage />` | `<ProtectedRoute />; <RequireAccess area="crrf" fallbackRoles={workflowRoles.crrf} />` | [frontend/src/routes/router.tsx:152](../../frontend/src/routes/router.tsx#L152) |
| UI-A5908753 | `/kyc/:id/internal-review` | `<InternalReviewWorkspacePage />` | `<ProtectedRoute />; <RequireAccess area="approvals" fallbackRoles={workflowRoles.reviewTasks} />` | [frontend/src/routes/router.tsx:158](../../frontend/src/routes/router.tsx#L158) |
| UI-2063ABE2 | `/review-tasks` | `<ReviewTasksPage />` | `<ProtectedRoute />; <RequireAccess area="approvals" fallbackRoles={workflowRoles.reviewTasks} />` | [frontend/src/routes/router.tsx:164](../../frontend/src/routes/router.tsx#L164) |

## API operation index

| ID | Method and path | Handler | Classification |
|---|---|---|---|
| [API-877BF8E4](#api-877bf8e4) | `GET /api/access-control` | AccessControlController.matrix | GET WITH SIDE EFFECTS |
| [API-812E3C7B](#api-812e3c7b) | `GET /api/access-control/me` | AccessControlController.mine | Read candidate (static scan only) |
| [API-8B7FA898](#api-8b7fa898) | `PUT /api/access-control/roles/:roleName` | AccessControlController.update | Command (may mutate) |
| [API-7D927E0D](#api-7d927e0d) | `GET /api/ai-settings` | AiSettingsController.get | Read candidate (static scan only) |
| [API-90603F00](#api-90603f00) | `PUT /api/ai-settings` | AiSettingsController.save | Command (may mutate) |
| [API-B6167AE7](#api-b6167ae7) | `POST /api/ai-settings/remove` | AiSettingsController.remove | Command (may mutate) |
| [API-E1602C00](#api-e1602c00) | `POST /api/ai-settings/test` | AiSettingsController.test | Command (may mutate) |
| [API-EBFCDF2C](#api-ebfcdf2c) | `GET /api/approvals` | ApprovalsController.findAll | Read candidate (static scan only) |
| [API-1AB8DBCE](#api-1ab8dbce) | `GET /api/audit-logs` | AuditLogsController.findAll | Read candidate (static scan only) |
| [API-26C3CE1C](#api-26c3ce1c) | `POST /api/auth/change-password` | SelfPasswordController.change | Command (may mutate) |
| [API-4B243C69](#api-4b243c69) | `POST /api/auth/login` | AuthController.login | Command (may mutate) |
| [API-451962BF](#api-451962bf) | `POST /api/auth/login/resend` | AuthController.resendLoginCode | Command (may mutate) |
| [API-DFE7B758](#api-dfe7b758) | `POST /api/auth/login/verify` | AuthController.verifyLoginCode | Command (may mutate) |
| [API-56B94144](#api-56b94144) | `GET /api/auth/me` | AuthController.me | Read candidate (static scan only) |
| [API-29253DE6](#api-29253de6) | `GET /api/auth/profile` | SelfProfileController.get | Read candidate (static scan only) |
| [API-65BE6F70](#api-65be6f70) | `PATCH /api/auth/profile` | SelfProfileController.update | Command (may mutate) |
| [API-7FD503B4](#api-7fd503b4) | `GET /api/clients` | ClientsController.findAll | Read candidate (static scan only) |
| [API-BABA0CF1](#api-baba0cf1) | `POST /api/clients` | ClientsController.create | Command (may mutate) |
| [API-5B6DA8D0](#api-5b6da8d0) | `DELETE /api/clients/:id` | ClientsController.remove | Command (may mutate) |
| [API-90F59AA9](#api-90f59aa9) | `GET /api/clients/:id` | ClientsController.findOne | Read candidate (static scan only) |
| [API-9AB9DDF9](#api-9ab9ddf9) | `PATCH /api/clients/:id` | ClientsController.update | Command (may mutate) |
| [API-EC99E535](#api-ec99e535) | `GET /api/clients/match` | ClientsController.match | Read candidate (static scan only) |
| [API-49E4FF5D](#api-49e4ff5d) | `GET /api/compliance/clients` | ComplianceClientsController.list | Read candidate (static scan only) |
| [API-8C237A3B](#api-8c237a3b) | `POST /api/compliance/clients/:clientId/document-sections` | ComplianceDocumentsController.createSection | Command (may mutate) |
| [API-9D33917C](#api-9d33917c) | `PATCH /api/compliance/clients/:clientId/document-sections/:sectionId` | ComplianceDocumentsController.updateSection | Command (may mutate) |
| [API-061670A7](#api-061670a7) | `GET /api/compliance/clients/:clientId/documents` | ComplianceDocumentsController.list | GET WITH SIDE EFFECTS |
| [API-7E1DED97](#api-7e1ded97) | `POST /api/compliance/clients/:clientId/documents` | ComplianceDocumentsController.upload | Command (may mutate) |
| [API-868988B0](#api-868988b0) | `POST /api/compliance/clients/:clientId/documents/:documentId/delete` | ComplianceDocumentsController.remove | Command (may mutate) |
| [API-BBF5FD78](#api-bbf5fd78) | `GET /api/compliance/clients/:clientId/documents/:documentId/view` | ComplianceDocumentsController.view | Read candidate (static scan only) |
| [API-6D33C2A7](#api-6d33c2a7) | `POST /api/compliance/clients/:clientId/expiry-items` | ComplianceMonitoringController.createExpiryItem | Command (may mutate) |
| [API-67C0F784](#api-67c0f784) | `PATCH /api/compliance/clients/:clientId/expiry-items/:itemId` | ComplianceMonitoringController.updateExpiryItem | Command (may mutate) |
| [API-1005F7B7](#api-1005f7b7) | `GET /api/compliance/clients/:clientId/legal-documents` | ClientLegalDocumentsController.list | Read candidate (static scan only) |
| [API-ED14C09D](#api-ed14c09d) | `POST /api/compliance/clients/:clientId/legal-documents` | ClientLegalDocumentsController.create | Command (may mutate) |
| [API-8CF9E540](#api-8cf9e540) | `PATCH /api/compliance/clients/:clientId/legal-documents/:documentId` | ClientLegalDocumentsController.update | Command (may mutate) |
| [API-51C110E4](#api-51c110e4) | `POST /api/compliance/clients/:clientId/legal-documents/:documentId/remove` | ClientLegalDocumentsController.remove | Command (may mutate) |
| [API-396FCEA2](#api-396fcea2) | `GET /api/compliance/clients/:clientId/legal-documents/:documentId/view` | ClientLegalDocumentsController.view | Read candidate (static scan only) |
| [API-033706F5](#api-033706f5) | `POST /api/compliance/clients/:clientId/legal-documents/read` | ClientLegalDocumentsController.read | Command (may mutate) |
| [API-ED4F91AE](#api-ed4f91ae) | `GET /api/compliance/clients/:clientId/monitoring` | ComplianceMonitoringController.overview | Read candidate (static scan only) |
| [API-42FDCCAA](#api-42fdccaa) | `POST /api/compliance/clients/:clientId/reviews` | ComplianceMonitoringController.startReview | Command (may mutate) |
| [API-1D0B8A5A](#api-1d0b8a5a) | `POST /api/compliance/clients/:clientId/reviews/:reviewId/cancel` | ComplianceMonitoringController.cancelReview | Command (may mutate) |
| [API-25663815](#api-25663815) | `POST /api/compliance/clients/:clientId/reviews/:reviewId/complete` | ComplianceMonitoringController.completeReview | Command (may mutate) |
| [API-980D1672](#api-980d1672) | `POST /api/compliance/clients/:clientId/risk-changes` | ComplianceMonitoringController.requestRiskChange | Command (may mutate) |
| [API-F0AF4B90](#api-f0af4b90) | `POST /api/compliance/clients/:clientId/risk-changes/:changeId/cancel` | ComplianceMonitoringController.cancelRiskChange | Command (may mutate) |
| [API-C87B8B6F](#api-c87b8b6f) | `POST /api/compliance/clients/:clientId/risk-changes/:changeId/decision` | ComplianceMonitoringController.decideRiskChange | Command (may mutate) |
| [API-6A9CBA9F](#api-6a9cba9f) | `POST /api/compliance/clients/:clientId/screenings` | ComplianceMonitoringController.createScreening | Command (may mutate) |
| [API-01C15240](#api-01c15240) | `GET /api/compliance/clients/:id` | ComplianceClientsController.findOne | Read candidate (static scan only) |
| [API-447EAA42](#api-447eaa42) | `PATCH /api/compliance/clients/:id` | ComplianceClientsController.update | Command (may mutate) |
| [API-ED210531](#api-ed210531) | `POST /api/compliance/clients/:id/allocations` | ComplianceClientsController.allocate | Command (may mutate) |
| [API-3E5FDDBB](#api-3e5fddbb) | `POST /api/compliance/clients/:id/allocations/:allocationId/remove` | ComplianceClientsController.removeAllocation | Command (may mutate) |
| [API-CA1F5A28](#api-ca1f5a28) | `GET /api/compliance/clients/:id/allocations/candidates` | ComplianceClientsController.allocationCandidates | Read candidate (static scan only) |
| [API-B8D88BE6](#api-b8d88be6) | `PATCH /api/compliance/clients/:id/entity` | ComplianceClientsController.updateEntityField | Command (may mutate) |
| [API-182BA90B](#api-182ba90b) | `GET /api/compliance/clients/:id/expiry/export` | ComplianceClientsController.exportClientExpiry | Read candidate (static scan only) |
| [API-EA955808](#api-ea955808) | `POST /api/compliance/clients/:id/identity-documents` | ClientIdentityDocumentsController.uploadIdentityDocument | Command (may mutate) |
| [API-5E9698D8](#api-5e9698d8) | `POST /api/compliance/clients/:id/identity-documents/from-kyc` | ClientIdentityDocumentsController.linkKycIdentityDocument | Command (may mutate) |
| [API-14F71EF3](#api-14f71ef3) | `POST /api/compliance/clients/:id/identity-documents/read` | ClientIdentityDocumentsController.readIdentityDocument | Command (may mutate) |
| [API-26BEC7B1](#api-26bec7b1) | `POST /api/compliance/clients/:id/people` | ComplianceClientsController.addPerson | Command (may mutate) |
| [API-E9B4137B](#api-e9b4137b) | `PATCH /api/compliance/clients/:id/people/:personId` | ComplianceClientsController.updatePersonField | Command (may mutate) |
| [API-5B2B2CC6](#api-5b2b2cc6) | `POST /api/compliance/clients/:id/people/:personId/passports` | ComplianceClientsController.addPassport | Command (may mutate) |
| [API-5D294F92](#api-5d294f92) | `PATCH /api/compliance/clients/:id/people/:personId/passports/:passportId` | ComplianceClientsController.updatePassport | Command (may mutate) |
| [API-96FAFA9D](#api-96fafa9d) | `POST /api/compliance/clients/:id/people/:personId/passports/:passportId/remove` | ComplianceClientsController.removePassport | Command (may mutate) |
| [API-857786E4](#api-857786e4) | `POST /api/compliance/clients/:id/people/:personId/roles` | ComplianceClientsController.addRole | Command (may mutate) |
| [API-EF87BF51](#api-ef87bf51) | `PATCH /api/compliance/clients/:id/people/:personId/roles/:roleId` | ComplianceClientsController.updateRole | Command (may mutate) |
| [API-B08DF12B](#api-b08df12b) | `POST /api/compliance/clients/:id/people/:personId/roles/:roleId/remove` | ComplianceClientsController.removeRole | Command (may mutate) |
| [API-717D99CE](#api-717d99ce) | `POST /api/compliance/clients/:id/rekyc` | ComplianceClientsController.startRekyc | Command (may mutate) |
| [API-34675EA2](#api-34675ea2) | `GET /api/compliance/clients/export/excel` | ComplianceClientsController.exportExcel | Read candidate (static scan only) |
| [API-4AAC9231](#api-4aac9231) | `GET /api/compliance/clients/export/expiry` | ComplianceClientsController.exportExpiry | Read candidate (static scan only) |
| [API-7CCA1951](#api-7cca1951) | `POST /api/compliance/reminders/run` | ComplianceRemindersController.run | Command (may mutate) |
| [API-126A3D33](#api-126a3d33) | `GET /api/crrf` | CrrfListController.listRecords | Read candidate (static scan only) |
| [API-49780112](#api-49780112) | `GET /api/dashboard/summary` | DashboardController.summary | Read candidate (static scan only) |
| [API-5B2BF5E4](#api-5b2bf5e4) | `GET /api/documents` | DocumentsController.findAll | Read candidate (static scan only) |
| [API-FFC0C4D5](#api-ffc0c4d5) | `GET /api/enquiries` | EnquiriesController.findAll | Read candidate (static scan only) |
| [API-2A03FCD2](#api-2a03fcd2) | `POST /api/enquiries` | EnquiriesController.create | Command (may mutate) |
| [API-62F96B16](#api-62f96b16) | `DELETE /api/enquiries/:id` | EnquiriesController.remove | Command (may mutate) |
| [API-45584D11](#api-45584d11) | `GET /api/enquiries/:id` | EnquiriesController.findOne | Read candidate (static scan only) |
| [API-AA5ECB01](#api-aa5ecb01) | `PATCH /api/enquiries/:id` | EnquiriesController.update | Command (may mutate) |
| [API-4E2DD820](#api-4e2dd820) | `GET /api/enquiries/:id/attachments/:attachmentId/view` | EnquiriesController.viewAttachment | Read candidate (static scan only) |
| [API-0296575E](#api-0296575e) | `GET /api/enquiries/:id/attachments/download-group` | EnquiriesController.downloadAttachmentGroup | Read candidate (static scan only) |
| [API-DB8CC420](#api-db8cc420) | `POST /api/enquiries/:id/attachments/upload` | EnquiriesController.uploadAttachmentFile | Command (may mutate) |
| [API-3509838E](#api-3509838e) | `POST /api/enquiries/:id/attachments/upload-many` | EnquiriesController.uploadAttachmentFiles | Command (may mutate) |
| [API-838B7EDE](#api-838b7ede) | `POST /api/enquiries/:id/comments` | EnquiriesController.addComment | Command (may mutate) |
| [API-AAC19E27](#api-aac19e27) | `POST /api/enquiries/:id/convert-to-kyc` | EnquiriesController.convertToKyc | Command (may mutate) |
| [API-5586363A](#api-5586363a) | `GET /api/enquiries/:id/preliminary-kyc` | EnquiriesController.getPreliminaryKyc | Read candidate (static scan only) |
| [API-7A2D0CDF](#api-7a2d0cdf) | `PATCH /api/enquiries/:id/preliminary-kyc` | EnquiriesController.savePreliminaryKyc | Command (may mutate) |
| [API-8C410B0C](#api-8c410b0c) | `POST /api/enquiries/:id/preliminary-kyc/complete` | EnquiriesController.completePreliminaryKyc | Command (may mutate) |
| [API-3A245610](#api-3a245610) | `GET /api/enquiries/:id/preliminary-kyc/pdf` | EnquiriesController.downloadPreliminaryPdf | Read candidate (static scan only) |
| [API-F4305601](#api-f4305601) | `PATCH /api/enquiries/:id/status` | EnquiriesController.updateStatus | Command (may mutate) |
| [API-B6E04457](#api-b6e04457) | `POST /api/enquiries/company-documents/read` | EnquiriesController.readCompanyDocument | Command (may mutate) |
| [API-4B16817C](#api-4b16817c) | `GET /api/enquiries/duplicate-check` | EnquiriesController.duplicateCheck | Read candidate (static scan only) |
| [API-3D6499D5](#api-3d6499d5) | `POST /api/enquiries/identity-documents/read` | EnquiriesController.readIdentityDocument | Command (may mutate) |
| [API-69E2E58A](#api-69e2e58a) | `GET /api/health` | AppController.health | Read candidate (static scan only) |
| [API-3FD10834](#api-3fd10834) | `GET /api/kyc` | KycController.findAll | Read candidate (static scan only) |
| [API-F3EDD356](#api-f3edd356) | `POST /api/kyc` | KycController.create | Command (may mutate) |
| [API-BF74970E](#api-bf74970e) | `DELETE /api/kyc/:id` | KycController.remove | Command (may mutate) |
| [API-157E465A](#api-157e465a) | `GET /api/kyc/:id` | KycController.findOne | Read candidate (static scan only) |
| [API-8FD7BC30](#api-8fd7bc30) | `PATCH /api/kyc/:id` | KycController.update | Command (may mutate) |
| [API-07738DF5](#api-07738df5) | `GET /api/kyc/:id/activation-readiness` | KycController.activationReadiness | GET WITH SIDE EFFECTS |
| [API-AF4E1C0A](#api-af4e1c0a) | `POST /api/kyc/:id/amendments` | KycController.startAmendment | Command (may mutate) |
| [API-7B6EA1C6](#api-7b6ea1c6) | `POST /api/kyc/:id/comments` | KycController.addComment | Command (may mutate) |
| [API-C8A169F1](#api-c8a169f1) | `POST /api/kyc/:id/engagement-decision` | KycController.completeEngagementDecision | Command (may mutate) |
| [API-728450A0](#api-728450a0) | `POST /api/kyc/:id/engagement-letter/upload` | KycController.uploadEngagementLetter | Command (may mutate) |
| [API-B62F552C](#api-b62f552c) | `POST /api/kyc/:id/final-kyc-decision` | KycController.completeFinalKycDecision | Command (may mutate) |
| [API-0AED223E](#api-0aed223e) | `GET /api/kyc/:id/form` | KycController.getForm | GET WITH SIDE EFFECTS |
| [API-BC473411](#api-bc473411) | `POST /api/kyc/:id/form` | KycController.createForm | Command (may mutate) |
| [API-A3C714C0](#api-a3c714c0) | `PATCH /api/kyc/:id/form/autosave` | KycController.autoSaveForm | Command (may mutate) |
| [API-490F75DE](#api-490f75de) | `POST /api/kyc/:id/form/generate-docx` | KycController.generateDocx | Command (may mutate) |
| [API-DD13B530](#api-dd13b530) | `POST /api/kyc/:id/form/generate-pdf` | KycController.generatePdf | Command (may mutate) |
| [API-78F4A26B](#api-78f4a26b) | `GET /api/kyc/:id/form/generated-documents/:documentId/download` | KycController.downloadGeneratedDocument | GET WITH SIDE EFFECTS |
| [API-D17BA785](#api-d17ba785) | `POST /api/kyc/:id/form/read-document` | KycController.readFormDocument | Command (may mutate) |
| [API-5242388D](#api-5242388d) | `GET /api/kyc/:id/form/revisions` | KycController.getFormRevisions | GET WITH SIDE EFFECTS |
| [API-1CF5873D](#api-1cf5873d) | `GET /api/kyc/:id/form/revisions/:revisionId` | KycController.getFormRevision | GET WITH SIDE EFFECTS |
| [API-401ED459](#api-401ed459) | `GET /api/kyc/:id/form/revisions/:revisionId/download` | KycController.downloadFormRevision | GET WITH SIDE EFFECTS |
| [API-EBFAE586](#api-ebfae586) | `GET /api/kyc/:id/form/revisions/:revisionId/files/:fileId` | KycController.downloadRevisionFile | GET WITH SIDE EFFECTS |
| [API-A221380A](#api-a221380a) | `PATCH /api/kyc/:id/form/section-a` | KycController.saveSectionA | Command (may mutate) |
| [API-6DF83F11](#api-6df83f11) | `PATCH /api/kyc/:id/form/section-b` | KycController.saveSectionB | Command (may mutate) |
| [API-6FCEF8D0](#api-6fcef8d0) | `PATCH /api/kyc/:id/form/section-c` | KycController.saveSectionC | Command (may mutate) |
| [API-95E0B5BF](#api-95e0b5bf) | `PATCH /api/kyc/:id/form/section-d` | KycController.saveSectionD | Command (may mutate) |
| [API-F0C2E965](#api-f0c2e965) | `PATCH /api/kyc/:id/form/section-e` | KycController.saveSectionE | Command (may mutate) |
| [API-70638C15](#api-70638c15) | `PATCH /api/kyc/:id/form/section-f` | KycController.saveSectionF | Command (may mutate) |
| [API-5EFC49C1](#api-5efc49c1) | `PATCH /api/kyc/:id/form/section-g` | KycController.saveSectionG | Command (may mutate) |
| [API-76C06151](#api-76c06151) | `PATCH /api/kyc/:id/form/section-h` | KycController.saveSectionH | Command (may mutate) |
| [API-8FFFD545](#api-8fffd545) | `GET /api/kyc/:id/internal-reviews` | KycController.getInternalReviewWorkspace | GET WITH SIDE EFFECTS |
| [API-BAA9C4BA](#api-baa9c4ba) | `POST /api/kyc/:id/internal-reviews/:stage/comments` | KycController.addReviewerComment | Command (may mutate) |
| [API-CE158663](#api-ce158663) | `PATCH /api/kyc/:id/internal-reviews/:stage/draft` | KycController.saveInternalReviewDraft | Command (may mutate) |
| [API-FAD85287](#api-fad85287) | `POST /api/kyc/:id/internal-reviews/:stage/start` | KycController.startInternalReview | Command (may mutate) |
| [API-C65454C8](#api-c65454c8) | `POST /api/kyc/:id/internal-reviews/dmlro/submit` | KycController.submitDmlroReview | Command (may mutate) |
| [API-3D4B2E9E](#api-3d4b2e9e) | `POST /api/kyc/:id/internal-reviews/mlro/decision` | KycController.decideMlroReview | Command (may mutate) |
| [API-B3555C2D](#api-b3555c2d) | `POST /api/kyc/:id/internal-reviews/sef/decision` | KycController.decideSefReview | Command (may mutate) |
| [API-0725331B](#api-0725331b) | `POST /api/kyc/:id/internal-reviews/signed-documents` | KycController.uploadSignedKycDocument | Command (may mutate) |
| [API-A4FB20A5](#api-a4fb20a5) | `POST /api/kyc/:id/internal-reviews/signed-documents/upload` | KycController.uploadSignedKycDocumentFile | Command (may mutate) |
| [API-C8B81FCD](#api-c8b81fcd) | `POST /api/kyc/:id/internal-reviews/supervisor/submit` | KycController.submitSupervisorReview | Command (may mutate) |
| [API-D8647DF4](#api-d8647df4) | `POST /api/kyc/:id/legal-documents` | KycController.uploadLegalDocument | Command (may mutate) |
| [API-0A70F34F](#api-0a70f34f) | `DELETE /api/kyc/:id/legal-documents/:documentId` | KycController.deleteLegalDocument | Command (may mutate) |
| [API-60800880](#api-60800880) | `GET /api/kyc/:id/legal-documents/:documentId/view` | KycController.viewLegalDocument | Read candidate (static scan only) |
| [API-A7A89B73](#api-a7a89b73) | `GET /api/kyc/:id/legal-documents/download-group` | KycController.downloadLegalDocumentGroup | Read candidate (static scan only) |
| [API-E82679AC](#api-e82679ac) | `POST /api/kyc/:id/legal-documents/upload` | KycController.uploadLegalDocumentFile | Command (may mutate) |
| [API-31BB8A09](#api-31bb8a09) | `POST /api/kyc/:id/legal-documents/upload-many` | KycController.uploadLegalDocumentFiles | Command (may mutate) |
| [API-36DE4573](#api-36de4573) | `PATCH /api/kyc/:id/proposal-status` | KycController.updateProposalStatus | Command (may mutate) |
| [API-6F5C31D7](#api-6f5c31d7) | `POST /api/kyc/:id/return-to-bd` | KycController.returnToBusinessDevelopment | Command (may mutate) |
| [API-6B7FFB1E](#api-6b7ffb1e) | `PATCH /api/kyc/:id/service` | KycController.assignService | Command (may mutate) |
| [API-379F818E](#api-379f818e) | `POST /api/kyc/:id/start-aml-review` | KycController.startAmlReview | Command (may mutate) |
| [API-86FF54AD](#api-86ff54ad) | `GET /api/kyc/:id/submission-readiness` | KycController.submissionReadiness | Read candidate (static scan only) |
| [API-D128107A](#api-d128107a) | `POST /api/kyc/:id/submit-to-aml` | KycController.submitToAml | Command (may mutate) |
| [API-2F3919F3](#api-2f3919f3) | `GET /api/kyc/:id/timeline` | KycController.getTimeline | Read candidate (static scan only) |
| [API-081C6E9B](#api-081c6e9b) | `GET /api/kyc/:kycCaseId/crrf` | CrrfController.getWorkspace | GET WITH SIDE EFFECTS |
| [API-5458803A](#api-5458803a) | `PATCH /api/kyc/:kycCaseId/crrf` | CrrfController.saveWorkspace | Command (may mutate) |
| [API-C0EBB861](#api-c0ebb861) | `DELETE /api/kyc/:kycCaseId/crrf/documents/:documentId` | CrrfController.deleteDocument | Command (may mutate) |
| [API-E5D21E74](#api-e5d21e74) | `GET /api/kyc/:kycCaseId/crrf/documents/:documentId/view` | CrrfController.viewDocument | Read candidate (static scan only) |
| [API-DDD625EB](#api-ddd625eb) | `POST /api/kyc/:kycCaseId/crrf/documents/upload` | CrrfController.uploadDocuments | Command (may mutate) |
| [API-961FF538](#api-961ff538) | `GET /api/kyc/:kycCaseId/crrf/export/excel` | CrrfController.exportExcel | GET WITH SIDE EFFECTS |
| [API-D3607C55](#api-d3607c55) | `GET /api/kyc/:kycCaseId/crrf/export/pdf` | CrrfController.exportPdf | GET WITH SIDE EFFECTS |
| [API-40B72B78](#api-40b72b78) | `GET /api/kyc/:kycCaseId/screening/context` | ScreeningController.getContext | GET WITH SIDE EFFECTS |
| [API-815BC666](#api-815bc666) | `DELETE /api/kyc/:kycCaseId/screening/documents/:documentId` | ScreeningController.deleteDocument | Command (may mutate) |
| [API-9B18C607](#api-9b18c607) | `GET /api/kyc/:kycCaseId/screening/documents/:documentId/view` | ScreeningController.viewDocument | Read candidate (static scan only) |
| [API-CFC8A791](#api-cfc8a791) | `PATCH /api/kyc/:kycCaseId/screening/merged-checks/:checkType` | ScreeningController.updateMergedCheck | Command (may mutate) |
| [API-BB9F5AB9](#api-bb9f5ab9) | `DELETE /api/kyc/:kycCaseId/screening/merged-documents/:documentId` | ScreeningController.deleteMergedDocument | Command (may mutate) |
| [API-0D8258E5](#api-0d8258e5) | `GET /api/kyc/:kycCaseId/screening/merged-documents/:documentId/view` | ScreeningController.viewMergedDocument | Read candidate (static scan only) |
| [API-1A5E5ED2](#api-1a5e5ed2) | `POST /api/kyc/:kycCaseId/screening/merged-documents/upload` | ScreeningController.uploadMergedDocuments | Command (may mutate) |
| [API-73AAC1D8](#api-73aac1d8) | `POST /api/kyc/:kycCaseId/screening/records` | ScreeningController.createRecord | Command (may mutate) |
| [API-E8226A18](#api-e8226a18) | `DELETE /api/kyc/:kycCaseId/screening/records/:recordId` | ScreeningController.deleteRecord | Command (may mutate) |
| [API-42B70497](#api-42b70497) | `PATCH /api/kyc/:kycCaseId/screening/records/:recordId` | ScreeningController.updateRecord | Command (may mutate) |
| [API-E325C8CB](#api-e325c8cb) | `POST /api/kyc/:kycCaseId/screening/records/:recordId/complete` | ScreeningController.completeRecord | Command (may mutate) |
| [API-5898413C](#api-5898413c) | `POST /api/kyc/:kycCaseId/screening/records/:recordId/documents/upload` | ScreeningController.uploadDocuments | Command (may mutate) |
| [API-BD67B8EC](#api-bd67b8ec) | `GET /api/kyc/aml/notifications` | KycController.getPendingAmlNotifications | Read candidate (static scan only) |
| [API-81BAF9B4](#api-81baf9b4) | `GET /api/kyc/review/tasks` | KycController.getMyReviewTasks | Read candidate (static scan only) |
| [API-6FD57A81](#api-6fd57a81) | `GET /api/modules` | ModulesController.findAll | Read candidate (static scan only) |
| [API-C3DF3359](#api-c3df3359) | `GET /api/notifications` | NotificationsController.findAll | Read candidate (static scan only) |
| [API-65B6D065](#api-65b6d065) | `PATCH /api/notifications/:id/read` | NotificationsController.markRead | Command (may mutate) |
| [API-FA599A44](#api-fa599a44) | `PATCH /api/notifications/read-all` | NotificationsController.markAllRead | Command (may mutate) |
| [API-AAF14881](#api-aaf14881) | `GET /api/permissions` | PermissionsController.findAll | Read candidate (static scan only) |
| [API-E6508535](#api-e6508535) | `GET /api/roles` | RolesController.findAll | Read candidate (static scan only) |
| [API-FAD10027](#api-fad10027) | `GET /api/screening` | ScreeningListController.listRecords | Read candidate (static scan only) |
| [API-5ADDCCFF](#api-5addccff) | `PUT /api/tenant-modules` | TenantModulesController.assign | Command (may mutate) |
| [API-AF74D957](#api-af74d957) | `GET /api/tenant-modules/:tenantId` | TenantModulesController.findByTenant | Read candidate (static scan only) |
| [API-3F8FA46B](#api-3f8fa46b) | `GET /api/tenants` | TenantsController.findAll | Read candidate (static scan only) |
| [API-B00A1FCA](#api-b00a1fca) | `POST /api/tenants` | TenantsController.create | Command (may mutate) |
| [API-96DAF7CF](#api-96daf7cf) | `GET /api/tenants/:id` | TenantsController.findOne | Read candidate (static scan only) |
| [API-55FFF749](#api-55fff749) | `GET /api/users` | UsersController.findAll | Read candidate (static scan only) |
| [API-0598E5EB](#api-0598e5eb) | `POST /api/users` | UsersController.create | Command (may mutate) |
| [API-DCE136B1](#api-dce136b1) | `DELETE /api/users/:id` | UsersController.remove | Command (may mutate) |
| [API-08AE14DF](#api-08ae14df) | `PATCH /api/users/:id` | UsersController.update | Command (may mutate) |
| [API-6D874D05](#api-6d874d05) | `POST /api/users/:id/reset-password` | UsersController.resetPassword | Command (may mutate) |
| [API-95D8FFEA](#api-95d8ffea) | `GET /api/users/options` | UsersController.options | Read candidate (static scan only) |

## API-877BF8E4

**GET /api/access-control** - AccessControlController.matrix

- Entry/auth: AuthGuard('jwt'); RolesGuard; fallback roles: SUPER_ADMIN.
- Inputs: none.
- Output: JSON returned from delegated service; inferred fields in linked implementation. Inferred by TypeScript; no explicit response DTO.
- Behavior: GET WITH SIDE EFFECTS; detected reachable writes: permission.createMany.
- Tenant/role/state/validation helper candidates: none detected; inspect implementation before acceptance.
- Error branch candidates: none explicitly thrown in resolved methods; global errors still apply.
- Evidence: [backend/src/access-control/access-control.controller.ts:14](../../backend/src/access-control/access-control.controller.ts#L14).
- Logic chain: AccessControlService.getMatrix [backend/src/access-control/access-control.service.ts:40](../../backend/src/access-control/access-control.service.ts#L40); AccessControlService.ensureCatalog [backend/src/access-control/access-control.service.ts:126](../../backend/src/access-control/access-control.service.ts#L126); AccessControlService.isConfigured [backend/src/access-control/access-control.service.ts:161](../../backend/src/access-control/access-control.service.ts#L161); AccessControlService.levelFor [backend/src/access-control/access-control.service.ts:166](../../backend/src/access-control/access-control.service.ts#L166).
- QA: apply Q-API for this ID and its workflow-specific cases; store status/body/DB diff with secrets removed.
- DTO field-access candidates: none resolved. These span reachable helpers and may include fields of internally composed DTOs; they are not a mandatory field list or complete wire schema. Match to the entry DTO and workflow before constructing requests.

## API-812E3C7B

**GET /api/access-control/me** - AccessControlController.mine

- Entry/auth: AuthGuard('jwt'); RolesGuard; fallback roles: none declared; authenticated-only when JWT applies.
- Inputs: `@CurrentUser() user: RequestUser`.
- Output: JSON returned from delegated service; inferred fields in linked implementation. Inferred by TypeScript; no explicit response DTO.
- Behavior: Read candidate (static scan only); detected reachable writes: none detected.
- Tenant/role/state/validation helper candidates: none detected; inspect implementation before acceptance.
- Error branch candidates: none explicitly thrown in resolved methods; global errors still apply.
- Evidence: [backend/src/access-control/access-control.controller.ts:20](../../backend/src/access-control/access-control.controller.ts#L20).
- Logic chain: AccessControlService.effectivePermissions [backend/src/access-control/access-control.service.ts:96](../../backend/src/access-control/access-control.service.ts#L96); AccessControlService.isConfigured [backend/src/access-control/access-control.service.ts:161](../../backend/src/access-control/access-control.service.ts#L161).
- QA: apply Q-API for this ID and its workflow-specific cases; store status/body/DB diff with secrets removed.
- DTO field-access candidates: none resolved. These span reachable helpers and may include fields of internally composed DTOs; they are not a mandatory field list or complete wire schema. Match to the entry DTO and workflow before constructing requests.

## API-8B7FA898

**PUT /api/access-control/roles/:roleName** - AccessControlController.update

- Entry/auth: AuthGuard('jwt'); RolesGuard; fallback roles: SUPER_ADMIN.
- Inputs: `@Param('roleName') roleName: string`; `@Body() body: { levels?: Record<string, AccessLevel> }`.
- Output: JSON returned from delegated service; inferred fields in linked implementation. Inferred by TypeScript; no explicit response DTO.
- Behavior: Command (may mutate); detected reachable writes: rolePermission.deleteMany, rolePermission.createMany, permission.createMany, rolePermission.create.
- Tenant/role/state/validation helper candidates: none detected; inspect implementation before acceptance.
- Error branch candidates: BadRequestException: 'Super Admin access is fixed to prevent an administrative lockout.'); BadRequestException: 'Role not found.'); BadRequestException: `Invalid access level for ${area.label}.`).
- Evidence: [backend/src/access-control/access-control.controller.ts:25](../../backend/src/access-control/access-control.controller.ts#L25).
- Logic chain: AccessControlService.updateRole [backend/src/access-control/access-control.service.ts:61](../../backend/src/access-control/access-control.service.ts#L61); AccessControlService.ensureCatalog [backend/src/access-control/access-control.service.ts:126](../../backend/src/access-control/access-control.service.ts#L126); AccessControlService.bootstrapDefaults [backend/src/access-control/access-control.service.ts:139](../../backend/src/access-control/access-control.service.ts#L139); AccessControlService.getMatrix [backend/src/access-control/access-control.service.ts:40](../../backend/src/access-control/access-control.service.ts#L40); AccessControlService.isConfigured [backend/src/access-control/access-control.service.ts:161](../../backend/src/access-control/access-control.service.ts#L161); AccessControlService.levelFor [backend/src/access-control/access-control.service.ts:166](../../backend/src/access-control/access-control.service.ts#L166).
- QA: apply Q-API for this ID and its workflow-specific cases; store status/body/DB diff with secrets removed.
- DTO field-access candidates: none resolved. These span reachable helpers and may include fields of internally composed DTOs; they are not a mandatory field list or complete wire schema. Match to the entry DTO and workflow before constructing requests.

## API-7D927E0D

**GET /api/ai-settings** - AiSettingsController.get

- Entry/auth: AuthGuard('jwt'); RolesGuard; fallback roles: SUPER_ADMIN, COMPANY_ADMIN.
- Inputs: `@CurrentUser() user: RequestUser`.
- Output: JSON returned from delegated service; inferred fields in linked implementation. Inferred by TypeScript; no explicit response DTO.
- Behavior: Read candidate (static scan only); detected reachable writes: none detected.
- Tenant/role/state/validation helper candidates: tenantOf.
- Error branch candidates: ForbiddenException: 'AI settings belong to a company. Sign in with a company account.').
- Evidence: [backend/src/ai-settings/ai-settings.controller.ts:34](../../backend/src/ai-settings/ai-settings.controller.ts#L34).
- Logic chain: AiSettingsService.get [backend/src/ai-settings/ai-settings.service.ts:23](../../backend/src/ai-settings/ai-settings.service.ts#L23); AiSettingsService.tenantOf [backend/src/ai-settings/ai-settings.service.ts:123](../../backend/src/ai-settings/ai-settings.service.ts#L123); AiSettingsService.view [backend/src/ai-settings/ai-settings.service.ts:104](../../backend/src/ai-settings/ai-settings.service.ts#L104).
- QA: apply Q-API for this ID and its workflow-specific cases; store status/body/DB diff with secrets removed.
- DTO field-access candidates: none resolved. These span reachable helpers and may include fields of internally composed DTOs; they are not a mandatory field list or complete wire schema. Match to the entry DTO and workflow before constructing requests.

## API-90603F00

**PUT /api/ai-settings** - AiSettingsController.save

- Entry/auth: AuthGuard('jwt'); RolesGuard; fallback roles: SUPER_ADMIN, COMPANY_ADMIN.
- Inputs: `@CurrentUser() user: RequestUser`; `@Body() dto: SaveAiSettingsDto`.
- Output: JSON returned from delegated service; inferred fields in linked implementation. Inferred by TypeScript; no explicit response DTO.
- Behavior: Command (may mutate); detected reachable writes: tenantAiSetting.update, tenantAiSetting.create, auditLog.create.
- Tenant/role/state/validation helper candidates: tenantOf.
- Error branch candidates: BadRequestException: 'Enter the OpenAI API key.'); BadRequestException: 'This does not look like an OpenAI API key (it starts with "sk-").'); BadRequestException: 'The server cannot store keys yet: SETTINGS_ENCRYPTION_KEY must be set on the server first.'); ForbiddenException: 'AI settings belong to a company. Sign in with a company account.'); BadRequestException: 'Enter a model name such as gpt-4.1-mini.').
- Evidence: [backend/src/ai-settings/ai-settings.controller.ts:39](../../backend/src/ai-settings/ai-settings.controller.ts#L39).
- Logic chain: AiSettingsService.save [backend/src/ai-settings/ai-settings.service.ts:29](../../backend/src/ai-settings/ai-settings.service.ts#L29); AiSettingsService.tenantOf [backend/src/ai-settings/ai-settings.service.ts:123](../../backend/src/ai-settings/ai-settings.service.ts#L123); AiSettingsService.modelValue [backend/src/ai-settings/ai-settings.service.ts:117](../../backend/src/ai-settings/ai-settings.service.ts#L117); AiSettingsService.audit [backend/src/ai-settings/ai-settings.service.ts:128](../../backend/src/ai-settings/ai-settings.service.ts#L128); AiSettingsService.view [backend/src/ai-settings/ai-settings.service.ts:104](../../backend/src/ai-settings/ai-settings.service.ts#L104).
- QA: apply Q-API for this ID and its workflow-specific cases; store status/body/DB diff with secrets removed.
- DTO field-access candidates: none resolved. These span reachable helpers and may include fields of internally composed DTOs; they are not a mandatory field list or complete wire schema. Match to the entry DTO and workflow before constructing requests.

## API-B6167AE7

**POST /api/ai-settings/remove** - AiSettingsController.remove

- Entry/auth: AuthGuard('jwt'); RolesGuard; fallback roles: SUPER_ADMIN, COMPANY_ADMIN.
- Inputs: `@CurrentUser() user: RequestUser`.
- Output: JSON returned from delegated service; inferred fields in linked implementation. Inferred by TypeScript; no explicit response DTO.
- Behavior: Command (may mutate); detected reachable writes: tenantAiSetting.delete, auditLog.create.
- Tenant/role/state/validation helper candidates: tenantOf.
- Error branch candidates: ForbiddenException: 'AI settings belong to a company. Sign in with a company account.').
- Evidence: [backend/src/ai-settings/ai-settings.controller.ts:49](../../backend/src/ai-settings/ai-settings.controller.ts#L49).
- Logic chain: AiSettingsService.remove [backend/src/ai-settings/ai-settings.service.ts:57](../../backend/src/ai-settings/ai-settings.service.ts#L57); AiSettingsService.tenantOf [backend/src/ai-settings/ai-settings.service.ts:123](../../backend/src/ai-settings/ai-settings.service.ts#L123); AiSettingsService.view [backend/src/ai-settings/ai-settings.service.ts:104](../../backend/src/ai-settings/ai-settings.service.ts#L104); AiSettingsService.audit [backend/src/ai-settings/ai-settings.service.ts:128](../../backend/src/ai-settings/ai-settings.service.ts#L128).
- QA: apply Q-API for this ID and its workflow-specific cases; store status/body/DB diff with secrets removed.
- DTO field-access candidates: none resolved. These span reachable helpers and may include fields of internally composed DTOs; they are not a mandatory field list or complete wire schema. Match to the entry DTO and workflow before constructing requests.

## API-E1602C00

**POST /api/ai-settings/test** - AiSettingsController.test

- Entry/auth: AuthGuard('jwt'); RolesGuard; fallback roles: SUPER_ADMIN, COMPANY_ADMIN.
- Inputs: `@CurrentUser() user: RequestUser`.
- Output: JSON returned from delegated service; inferred fields in linked implementation. Inferred by TypeScript; no explicit response DTO.
- Behavior: Command (may mutate); detected reachable writes: none detected.
- Tenant/role/state/validation helper candidates: tenantOf.
- Error branch candidates: ForbiddenException: 'AI settings belong to a company. Sign in with a company account.').
- Evidence: [backend/src/ai-settings/ai-settings.controller.ts:44](../../backend/src/ai-settings/ai-settings.controller.ts#L44).
- Logic chain: AiSettingsService.test [backend/src/ai-settings/ai-settings.service.ts:69](../../backend/src/ai-settings/ai-settings.service.ts#L69); AiSettingsService.credentialsFor [backend/src/ai-settings/ai-settings.service.ts:93](../../backend/src/ai-settings/ai-settings.service.ts#L93); AiSettingsService.tenantOf [backend/src/ai-settings/ai-settings.service.ts:123](../../backend/src/ai-settings/ai-settings.service.ts#L123).
- QA: apply Q-API for this ID and its workflow-specific cases; store status/body/DB diff with secrets removed.
- DTO field-access candidates: none resolved. These span reachable helpers and may include fields of internally composed DTOs; they are not a mandatory field list or complete wire schema. Match to the entry DTO and workflow before constructing requests.

## API-EBFCDF2C

**GET /api/approvals** - ApprovalsController.findAll

- Entry/auth: AuthGuard('jwt'); fallback roles: none declared; authenticated-only when JWT applies.
- Inputs: `@CurrentUser() user: RequestUser`.
- Output: JSON returned from delegated service; inferred fields in linked implementation. Inferred by TypeScript; no explicit response DTO.
- Behavior: Read candidate (static scan only); detected reachable writes: none detected.
- Tenant/role/state/validation helper candidates: none detected; inspect implementation before acceptance.
- Error branch candidates: none explicitly thrown in resolved methods; global errors still apply.
- Evidence: [backend/src/approvals/approvals.controller.ts:12](../../backend/src/approvals/approvals.controller.ts#L12).
- Logic chain: ApprovalsService.findAll [backend/src/approvals/approvals.service.ts:9](../../backend/src/approvals/approvals.service.ts#L9).
- QA: apply Q-API for this ID and its workflow-specific cases; store status/body/DB diff with secrets removed.
- DTO field-access candidates: none resolved. These span reachable helpers and may include fields of internally composed DTOs; they are not a mandatory field list or complete wire schema. Match to the entry DTO and workflow before constructing requests.

## API-1AB8DBCE

**GET /api/audit-logs** - AuditLogsController.findAll

- Entry/auth: AuthGuard('jwt'); RolesGuard; fallback roles: SUPER_ADMIN.
- Inputs: `@CurrentUser() user: RequestUser`.
- Output: JSON returned from delegated service; inferred fields in linked implementation. Inferred by TypeScript; no explicit response DTO.
- Behavior: Read candidate (static scan only); detected reachable writes: none detected.
- Tenant/role/state/validation helper candidates: none detected; inspect implementation before acceptance.
- Error branch candidates: none explicitly thrown in resolved methods; global errors still apply.
- Evidence: [backend/src/audit-logs/audit-logs.controller.ts:14](../../backend/src/audit-logs/audit-logs.controller.ts#L14).
- Logic chain: AuditLogsService.findAll [backend/src/audit-logs/audit-logs.service.ts:11](../../backend/src/audit-logs/audit-logs.service.ts#L11).
- QA: apply Q-API for this ID and its workflow-specific cases; store status/body/DB diff with secrets removed.
- DTO field-access candidates: none resolved. These span reachable helpers and may include fields of internally composed DTOs; they are not a mandatory field list or complete wire schema. Match to the entry DTO and workflow before constructing requests.

## API-26C3CE1C

**POST /api/auth/change-password** - SelfPasswordController.change

- Entry/auth: AuthGuard('jwt'); fallback roles: none declared; authenticated-only when JWT applies.
- Inputs: `@CurrentUser() user: RequestUser`; `@Body() dto: ChangePasswordDto`.
- Output: JSON returned from delegated service; inferred fields in linked implementation. Inferred by TypeScript; no explicit response DTO.
- Behavior: Command (may mutate); detected reachable writes: user.updateMany, auditLog.create.
- Tenant/role/state/validation helper candidates: none detected; inspect implementation before acceptance.
- Error branch candidates: BadRequestException: 'Too many attempts. Try again in 15 minutes.'); BadRequestException: 'New passwords do not match.'); BadRequestException: policyError); UnauthorizedException: 'Invalid session'); BadRequestException: 'Current password is incorrect.'); BadRequestException: 'Choose a different new password.'); BadRequestException: 'Account changed. Sign in again before retrying.').
- Evidence: [backend/src/auth/self-password.controller.ts:45](../../backend/src/auth/self-password.controller.ts#L45).
- Logic chain: SelfPasswordService.change [backend/src/auth/self-password.controller.ts:15](../../backend/src/auth/self-password.controller.ts#L15).
- QA: apply Q-API for this ID and its workflow-specific cases; store status/body/DB diff with secrets removed.
- DTO field-access candidates: confirmPassword, currentPassword, newPassword. These span reachable helpers and may include fields of internally composed DTOs; they are not a mandatory field list or complete wire schema. Match to the entry DTO and workflow before constructing requests.

## API-4B243C69

**POST /api/auth/login** - AuthController.login

- Entry/auth: No controller/method guard detected (public); fallback roles: none declared; authenticated-only when JWT applies.
- Inputs: `@Body() dto: LoginDto`; `@Req() request: Request`.
- Output: JSON returned from delegated service; inferred fields in linked implementation. Inferred by TypeScript; no explicit response DTO.
- Behavior: Command (may mutate); detected reachable writes: user.update, auditLog.create, loginChallenge.deleteMany, loginChallenge.create, loginChallenge.update, loginChallenge.delete.
- Tenant/role/state/validation helper candidates: assertNotLocked.
- Error branch candidates: UnauthorizedException: INVALID_LOGIN); UnauthorizedException: 'User account is not active'); HttpException: `Too many sign-in attempts from this network. Try again in ${Math.ceil(wait / 60)} minute(s).`, HttpStatus.TOO_MANY_REQUESTS); HttpException: `Too many failed sign-in attempts. Try again in ${minutes} minute${minutes === 1 ? '' : 's'}, or ask an administrator to reset your password.`, HttpStatus.TOO_MANY_REQUESTS); ServiceUnavailableException: 'Sign-in codes cannot be sent right now. Contact your administrator.'); ServiceUnavailableException: 'We could not send the sign-in code. Try again in a moment or contact your administrator.').
- Evidence: [backend/src/auth/auth.controller.ts:15](../../backend/src/auth/auth.controller.ts#L15).
- Logic chain: AuthService.login [backend/src/auth/auth.service.ts:54](../../backend/src/auth/auth.service.ts#L54); AuthService.throttle [backend/src/auth/auth.service.ts:256](../../backend/src/auth/auth.service.ts#L256); AuthService.timingHash [backend/src/auth/auth.service.ts:278](../../backend/src/auth/auth.service.ts#L278); AuthService.assertNotLocked [backend/src/auth/auth.service.ts:235](../../backend/src/auth/auth.service.ts#L235); AuthService.registerFailure [backend/src/auth/auth.service.ts:242](../../backend/src/auth/auth.service.ts#L242); AuthService.otpEnabled [backend/src/auth/auth.service.ts:50](../../backend/src/auth/auth.service.ts#L50); AuthService.completeLogin [backend/src/auth/auth.service.ts:220](../../backend/src/auth/auth.service.ts#L220); AuthService.toPublicUser [backend/src/auth/auth.service.ts:283](../../backend/src/auth/auth.service.ts#L283); AuthService.startCodeChallenge [backend/src/auth/auth.service.ts:168](../../backend/src/auth/auth.service.ts#L168); AuthService.newCode [backend/src/auth/auth.service.ts:263](../../backend/src/auth/auth.service.ts#L263); AuthService.hashCode [backend/src/auth/auth.service.ts:268](../../backend/src/auth/auth.service.ts#L268); AuthService.deliverCode [backend/src/auth/auth.service.ts:182](../../backend/src/auth/auth.service.ts#L182); AuthService.challengeResponse [backend/src/auth/auth.service.ts:202](../../backend/src/auth/auth.service.ts#L202).
- QA: apply Q-API for this ID and its workflow-specific cases; store status/body/DB diff with secrets removed.
- DTO field-access candidates: email, password. These span reachable helpers and may include fields of internally composed DTOs; they are not a mandatory field list or complete wire schema. Match to the entry DTO and workflow before constructing requests.

## API-451962BF

**POST /api/auth/login/resend** - AuthController.resendLoginCode

- Entry/auth: No controller/method guard detected (public); fallback roles: none declared; authenticated-only when JWT applies.
- Inputs: `@Body() dto: ResendLoginCodeDto`; `@Req() request: Request`.
- Output: JSON returned from delegated service; inferred fields in linked implementation. Inferred by TypeScript; no explicit response DTO.
- Behavior: Command (may mutate); detected reachable writes: loginChallenge.update, loginChallenge.delete.
- Tenant/role/state/validation helper candidates: none detected; inspect implementation before acceptance.
- Error branch candidates: HttpException: `Wait ${waitSeconds} seconds before requesting a new code.`, HttpStatus.TOO_MANY_REQUESTS); HttpException: 'Too many codes requested. Sign in again.', HttpStatus.TOO_MANY_REQUESTS); HttpException: `Too many sign-in attempts from this network. Try again in ${Math.ceil(wait / 60)} minute(s).`, HttpStatus.TOO_MANY_REQUESTS); UnauthorizedException: 'This sign-in code has expired. Sign in again.'); ServiceUnavailableException: 'Sign-in codes cannot be sent right now. Contact your administrator.'); ServiceUnavailableException: 'We could not send the sign-in code. Try again in a moment or contact your administrator.').
- Evidence: [backend/src/auth/auth.controller.ts:28](../../backend/src/auth/auth.controller.ts#L28).
- Logic chain: AuthService.resendLoginCode [backend/src/auth/auth.service.ts:108](../../backend/src/auth/auth.service.ts#L108); AuthService.throttle [backend/src/auth/auth.service.ts:256](../../backend/src/auth/auth.service.ts#L256); AuthService.activeChallenge [backend/src/auth/auth.service.ts:212](../../backend/src/auth/auth.service.ts#L212); AuthService.newCode [backend/src/auth/auth.service.ts:263](../../backend/src/auth/auth.service.ts#L263); AuthService.hashCode [backend/src/auth/auth.service.ts:268](../../backend/src/auth/auth.service.ts#L268); AuthService.deliverCode [backend/src/auth/auth.service.ts:182](../../backend/src/auth/auth.service.ts#L182); AuthService.challengeResponse [backend/src/auth/auth.service.ts:202](../../backend/src/auth/auth.service.ts#L202).
- QA: apply Q-API for this ID and its workflow-specific cases; store status/body/DB diff with secrets removed.
- DTO field-access candidates: challengeId. These span reachable helpers and may include fields of internally composed DTOs; they are not a mandatory field list or complete wire schema. Match to the entry DTO and workflow before constructing requests.

## API-DFE7B758

**POST /api/auth/login/verify** - AuthController.verifyLoginCode

- Entry/auth: No controller/method guard detected (public); fallback roles: none declared; authenticated-only when JWT applies.
- Inputs: `@Body() dto: VerifyLoginCodeDto`; `@Req() request: Request`.
- Output: JSON returned from delegated service; inferred fields in linked implementation. Inferred by TypeScript; no explicit response DTO.
- Behavior: Command (may mutate); detected reachable writes: loginChallenge.update, loginChallenge.updateMany, user.update, auditLog.create.
- Tenant/role/state/validation helper candidates: assertNotLocked.
- Error branch candidates: UnauthorizedException: 'Too many incorrect codes. Sign in again to receive a new code.'); UnauthorizedException: left > 0 ? `Incorrect code. ${left} attempt${left === 1 ? '' : 's'} left.` : 'Too many incorrect codes. Sign in again to receive a new code.'); UnauthorizedException: 'This sign-in code has expired. Sign in again.'); UnauthorizedException: 'User account is not active'); HttpException: `Too many sign-in attempts from this network. Try again in ${Math.ceil(wait / 60)} minute(s).`, HttpStatus.TOO_MANY_REQUESTS); HttpException: `Too many failed sign-in attempts. Try again in ${minutes} minute${minutes === 1 ? '' : 's'}, or ask an administrator to reset your password.`, HttpStatus.TOO_MANY_REQUESTS).
- Evidence: [backend/src/auth/auth.controller.ts:22](../../backend/src/auth/auth.controller.ts#L22).
- Logic chain: AuthService.verifyLoginCode [backend/src/auth/auth.service.ts:80](../../backend/src/auth/auth.service.ts#L80); AuthService.throttle [backend/src/auth/auth.service.ts:256](../../backend/src/auth/auth.service.ts#L256); AuthService.activeChallenge [backend/src/auth/auth.service.ts:212](../../backend/src/auth/auth.service.ts#L212); AuthService.assertNotLocked [backend/src/auth/auth.service.ts:235](../../backend/src/auth/auth.service.ts#L235); AuthService.codeMatches [backend/src/auth/auth.service.ts:272](../../backend/src/auth/auth.service.ts#L272); AuthService.hashCode [backend/src/auth/auth.service.ts:268](../../backend/src/auth/auth.service.ts#L268); AuthService.registerFailure [backend/src/auth/auth.service.ts:242](../../backend/src/auth/auth.service.ts#L242); AuthService.completeLogin [backend/src/auth/auth.service.ts:220](../../backend/src/auth/auth.service.ts#L220); AuthService.otpEnabled [backend/src/auth/auth.service.ts:50](../../backend/src/auth/auth.service.ts#L50); AuthService.toPublicUser [backend/src/auth/auth.service.ts:283](../../backend/src/auth/auth.service.ts#L283).
- QA: apply Q-API for this ID and its workflow-specific cases; store status/body/DB diff with secrets removed.
- DTO field-access candidates: challengeId, code. These span reachable helpers and may include fields of internally composed DTOs; they are not a mandatory field list or complete wire schema. Match to the entry DTO and workflow before constructing requests.

## API-56B94144

**GET /api/auth/me** - AuthController.me

- Entry/auth: AuthGuard('jwt'); fallback roles: none declared; authenticated-only when JWT applies.
- Inputs: `@CurrentUser() user: RequestUser`.
- Output: JSON returned from delegated service; inferred fields in linked implementation. Inferred by TypeScript; no explicit response DTO.
- Behavior: Read candidate (static scan only); detected reachable writes: none detected.
- Tenant/role/state/validation helper candidates: none detected; inspect implementation before acceptance.
- Error branch candidates: none explicitly thrown in resolved methods; global errors still apply.
- Evidence: [backend/src/auth/auth.controller.ts:34](../../backend/src/auth/auth.controller.ts#L34).
- Logic chain: AuthService.currentUser [backend/src/auth/auth.service.ts:134](../../backend/src/auth/auth.service.ts#L134); AuthService.toPublicUser [backend/src/auth/auth.service.ts:283](../../backend/src/auth/auth.service.ts#L283).
- QA: apply Q-API for this ID and its workflow-specific cases; store status/body/DB diff with secrets removed.
- DTO field-access candidates: none resolved. These span reachable helpers and may include fields of internally composed DTOs; they are not a mandatory field list or complete wire schema. Match to the entry DTO and workflow before constructing requests.

## API-29253DE6

**GET /api/auth/profile** - SelfProfileController.get

- Entry/auth: AuthGuard('jwt'); fallback roles: none declared; authenticated-only when JWT applies.
- Inputs: `@CurrentUser() user: RequestUser`.
- Output: JSON returned from delegated service; inferred fields in linked implementation. Inferred by TypeScript; no explicit response DTO.
- Behavior: Read candidate (static scan only); detected reachable writes: none detected.
- Tenant/role/state/validation helper candidates: none detected; inspect implementation before acceptance.
- Error branch candidates: none explicitly thrown in resolved methods; global errors still apply.
- Evidence: [backend/src/auth/self-profile.controller.ts:56](../../backend/src/auth/self-profile.controller.ts#L56).
- Logic chain: SelfProfileService.get [backend/src/auth/self-profile.controller.ts:20](../../backend/src/auth/self-profile.controller.ts#L20).
- QA: apply Q-API for this ID and its workflow-specific cases; store status/body/DB diff with secrets removed.
- DTO field-access candidates: none resolved. These span reachable helpers and may include fields of internally composed DTOs; they are not a mandatory field list or complete wire schema. Match to the entry DTO and workflow before constructing requests.

## API-65BE6F70

**PATCH /api/auth/profile** - SelfProfileController.update

- Entry/auth: AuthGuard('jwt'); fallback roles: none declared; authenticated-only when JWT applies.
- Inputs: `@CurrentUser() user: RequestUser`; `@Body() dto: UpdateSelfProfileDto`.
- Output: JSON returned from delegated service; inferred fields in linked implementation. Inferred by TypeScript; no explicit response DTO.
- Behavior: Command (may mutate); detected reachable writes: user.update, userProfile.upsert, auditLog.create.
- Tenant/role/state/validation helper candidates: none detected; inspect implementation before acceptance.
- Error branch candidates: BadRequestException: 'First and last name are required.'); BadRequestException: 'Use a PNG profile picture.'); BadRequestException: 'Invalid or oversized picture.'); BadRequestException: 'Unable to read profile picture.').
- Evidence: [backend/src/auth/self-profile.controller.ts:57](../../backend/src/auth/self-profile.controller.ts#L57).
- Logic chain: SelfProfileService.update [backend/src/auth/self-profile.controller.ts:26](../../backend/src/auth/self-profile.controller.ts#L26); SelfProfileService.get [backend/src/auth/self-profile.controller.ts:20](../../backend/src/auth/self-profile.controller.ts#L20).
- QA: apply Q-API for this ID and its workflow-specific cases; store status/body/DB diff with secrets removed.
- DTO field-access candidates: avatarDataUrl, bio, firstName, lastName. These span reachable helpers and may include fields of internally composed DTOs; they are not a mandatory field list or complete wire schema. Match to the entry DTO and workflow before constructing requests.

## API-7FD503B4

**GET /api/clients** - ClientsController.findAll

- Entry/auth: AuthGuard('jwt'); RolesGuard; fallback roles: none declared; authenticated-only when JWT applies.
- Inputs: `@CurrentUser() user: RequestUser`; `@Query('status') status?: string`.
- Output: JSON returned from delegated service; inferred fields in linked implementation. Inferred by TypeScript; no explicit response DTO.
- Behavior: Read candidate (static scan only); detected reachable writes: none detected.
- Tenant/role/state/validation helper candidates: tenantWhere.
- Error branch candidates: BadRequestException: 'Invalid client status filter.'); ForbiddenException: 'Super admin must act within a tenant for this operation'); ForbiddenException: 'User is not assigned to a tenant').
- Evidence: [backend/src/clients/clients.controller.ts:23](../../backend/src/clients/clients.controller.ts#L23).
- Logic chain: ClientsService.findAll [backend/src/clients/clients.service.ts:39](../../backend/src/clients/clients.service.ts#L39); ClientsService.tenantWhere [backend/src/clients/clients.service.ts:277](../../backend/src/clients/clients.service.ts#L277); ClientsService.getTenantId [backend/src/clients/clients.service.ts:281](../../backend/src/clients/clients.service.ts#L281).
- QA: apply Q-API for this ID and its workflow-specific cases; store status/body/DB diff with secrets removed.
- DTO field-access candidates: none resolved. These span reachable helpers and may include fields of internally composed DTOs; they are not a mandatory field list or complete wire schema. Match to the entry DTO and workflow before constructing requests.

## API-BABA0CF1

**POST /api/clients** - ClientsController.create

- Entry/auth: AuthGuard('jwt'); RolesGuard; fallback roles: OPERATING_TEAM, COMPANY_ADMIN.
- Inputs: `@CurrentUser() user: RequestUser`; `@Body() dto: CreateClientDto`.
- Output: JSON returned from delegated service; inferred fields in linked implementation. Inferred by TypeScript; no explicit response DTO.
- Behavior: Command (may mutate); detected reachable writes: client.create.
- Tenant/role/state/validation helper candidates: none detected; inspect implementation before acceptance.
- Error branch candidates: ForbiddenException: 'Super admin must act within a tenant for this operation'); ForbiddenException: 'User is not assigned to a tenant').
- Evidence: [backend/src/clients/clients.controller.ts:17](../../backend/src/clients/clients.controller.ts#L17).
- Logic chain: ClientsService.create [backend/src/clients/clients.service.ts:11](../../backend/src/clients/clients.service.ts#L11); ClientsService.getTenantId [backend/src/clients/clients.service.ts:281](../../backend/src/clients/clients.service.ts#L281).
- QA: apply Q-API for this ID and its workflow-specific cases; store status/body/DB diff with secrets removed.
- DTO field-access candidates: contacts, country, industry, name, registrationNumber. These span reachable helpers and may include fields of internally composed DTOs; they are not a mandatory field list or complete wire schema. Match to the entry DTO and workflow before constructing requests.

## API-5B6DA8D0

**DELETE /api/clients/:id** - ClientsController.remove

- Entry/auth: AuthGuard('jwt'); RolesGuard; fallback roles: OPERATING_TEAM, COMPANY_ADMIN, SUPER_ADMIN.
- Inputs: `@CurrentUser() user: RequestUser`; `@Param('id') id: string`.
- Output: JSON returned from delegated service; inferred fields in linked implementation. Inferred by TypeScript; no explicit response DTO.
- Behavior: Command (may mutate); detected reachable writes: auditLog.create, client.delete.
- Tenant/role/state/validation helper candidates: tenantWhere.
- Error branch candidates: NotFoundException: 'Client not found'); ForbiddenException: 'Super admin must act within a tenant for this operation'); ForbiddenException: 'User is not assigned to a tenant').
- Evidence: [backend/src/clients/clients.controller.ts:51](../../backend/src/clients/clients.controller.ts#L51).
- Logic chain: ClientsService.remove [backend/src/clients/clients.service.ts:257](../../backend/src/clients/clients.service.ts#L257); ClientsService.findOne [backend/src/clients/clients.service.ts:58](../../backend/src/clients/clients.service.ts#L58); ClientsService.tenantWhere [backend/src/clients/clients.service.ts:277](../../backend/src/clients/clients.service.ts#L277); ClientsService.getTenantId [backend/src/clients/clients.service.ts:281](../../backend/src/clients/clients.service.ts#L281).
- QA: apply Q-API for this ID and its workflow-specific cases; store status/body/DB diff with secrets removed.
- DTO field-access candidates: none resolved. These span reachable helpers and may include fields of internally composed DTOs; they are not a mandatory field list or complete wire schema. Match to the entry DTO and workflow before constructing requests.

## API-90F59AA9

**GET /api/clients/:id** - ClientsController.findOne

- Entry/auth: AuthGuard('jwt'); RolesGuard; fallback roles: none declared; authenticated-only when JWT applies.
- Inputs: `@CurrentUser() user: RequestUser`; `@Param('id') id: string`.
- Output: JSON returned from delegated service; inferred fields in linked implementation. Inferred by TypeScript; no explicit response DTO.
- Behavior: Read candidate (static scan only); detected reachable writes: none detected.
- Tenant/role/state/validation helper candidates: tenantWhere.
- Error branch candidates: NotFoundException: 'Client not found'); ForbiddenException: 'Super admin must act within a tenant for this operation'); ForbiddenException: 'User is not assigned to a tenant').
- Evidence: [backend/src/clients/clients.controller.ts:40](../../backend/src/clients/clients.controller.ts#L40).
- Logic chain: ClientsService.findOne [backend/src/clients/clients.service.ts:58](../../backend/src/clients/clients.service.ts#L58); ClientsService.tenantWhere [backend/src/clients/clients.service.ts:277](../../backend/src/clients/clients.service.ts#L277); ClientsService.getTenantId [backend/src/clients/clients.service.ts:281](../../backend/src/clients/clients.service.ts#L281).
- QA: apply Q-API for this ID and its workflow-specific cases; store status/body/DB diff with secrets removed.
- DTO field-access candidates: none resolved. These span reachable helpers and may include fields of internally composed DTOs; they are not a mandatory field list or complete wire schema. Match to the entry DTO and workflow before constructing requests.

## API-9AB9DDF9

**PATCH /api/clients/:id** - ClientsController.update

- Entry/auth: AuthGuard('jwt'); RolesGuard; fallback roles: OPERATING_TEAM, COMPANY_ADMIN, SUPER_ADMIN.
- Inputs: `@CurrentUser() user: RequestUser`; `@Param('id') id: string`; `@Body() dto: UpdateClientDto`.
- Output: JSON returned from delegated service; inferred fields in linked implementation. Inferred by TypeScript; no explicit response DTO.
- Behavior: Command (may mutate); detected reachable writes: clientContact.deleteMany, client.update.
- Tenant/role/state/validation helper candidates: tenantWhere.
- Error branch candidates: NotFoundException: 'Client not found'); ForbiddenException: 'Super admin must act within a tenant for this operation'); ForbiddenException: 'User is not assigned to a tenant').
- Evidence: [backend/src/clients/clients.controller.ts:45](../../backend/src/clients/clients.controller.ts#L45).
- Logic chain: ClientsService.update [backend/src/clients/clients.service.ts:213](../../backend/src/clients/clients.service.ts#L213); ClientsService.findOne [backend/src/clients/clients.service.ts:58](../../backend/src/clients/clients.service.ts#L58); ClientsService.tenantWhere [backend/src/clients/clients.service.ts:277](../../backend/src/clients/clients.service.ts#L277); ClientsService.getTenantId [backend/src/clients/clients.service.ts:281](../../backend/src/clients/clients.service.ts#L281).
- QA: apply Q-API for this ID and its workflow-specific cases; store status/body/DB diff with secrets removed.
- DTO field-access candidates: contacts, country, industry, name, registrationNumber. These span reachable helpers and may include fields of internally composed DTOs; they are not a mandatory field list or complete wire schema. Match to the entry DTO and workflow before constructing requests.

## API-EC99E535

**GET /api/clients/match** - ClientsController.match

- Entry/auth: AuthGuard('jwt'); RolesGuard; fallback roles: none declared; authenticated-only when JWT applies.
- Inputs: `@CurrentUser() user: RequestUser`; `@Query('type') type: string`; `@Query('identifier') identifier: string`; `@Query('excludeClientId') excludeClientId?: string`.
- Output: JSON returned from delegated service; inferred fields in linked implementation. Inferred by TypeScript; no explicit response DTO.
- Behavior: Read candidate (static scan only); detected reachable writes: none detected.
- Tenant/role/state/validation helper candidates: tenantWhere.
- Error branch candidates: ForbiddenException: 'Super admin must act within a tenant for this operation'); ForbiddenException: 'User is not assigned to a tenant').
- Evidence: [backend/src/clients/clients.controller.ts:29](../../backend/src/clients/clients.controller.ts#L29).
- Logic chain: ClientsService.matchByIdentifier [backend/src/clients/clients.service.ts:82](../../backend/src/clients/clients.service.ts#L82); ClientsService.normalizedIdentifier [backend/src/clients/clients.service.ts:305](../../backend/src/clients/clients.service.ts#L305); ClientsService.tenantWhere [backend/src/clients/clients.service.ts:277](../../backend/src/clients/clients.service.ts#L277); ClientsService.getTenantId [backend/src/clients/clients.service.ts:281](../../backend/src/clients/clients.service.ts#L281); ClientsService.clientMatch [backend/src/clients/clients.service.ts:293](../../backend/src/clients/clients.service.ts#L293); ClientsService.matchClientRegistrationByNormalizedValue [backend/src/clients/clients.service.ts:121](../../backend/src/clients/clients.service.ts#L121); ClientsService.matchKycCompanyRegistration [backend/src/clients/clients.service.ts:136](../../backend/src/clients/clients.service.ts#L136); ClientsService.recordValue [backend/src/clients/clients.service.ts:312](../../backend/src/clients/clients.service.ts#L312); ClientsService.matchKycOwnerByIdentifier [backend/src/clients/clients.service.ts:157](../../backend/src/clients/clients.service.ts#L157); ClientsService.matchKycOwnerByNormalizedValue [backend/src/clients/clients.service.ts:193](../../backend/src/clients/clients.service.ts#L193).
- QA: apply Q-API for this ID and its workflow-specific cases; store status/body/DB diff with secrets removed.
- DTO field-access candidates: none resolved. These span reachable helpers and may include fields of internally composed DTOs; they are not a mandatory field list or complete wire schema. Match to the entry DTO and workflow before constructing requests.

## API-49E4FF5D

**GET /api/compliance/clients** - ComplianceClientsController.list

- Entry/auth: AuthGuard('jwt'); RolesGuard; fallback roles: none declared; authenticated-only when JWT applies.
- Inputs: `@CurrentUser() user: RequestUser`; `@Query() query: ComplianceClientQuery`.
- Output: JSON returned from delegated service; inferred fields in linked implementation. Inferred by TypeScript; no explicit response DTO.
- Behavior: Read candidate (static scan only); detected reachable writes: none detected.
- Tenant/role/state/validation helper candidates: tenantWhere, enumValue.
- Error branch candidates: BadRequestException: 'Invalid status filter.'); BadRequestException: 'Invalid review filter.'); BadRequestException: 'Invalid attention filter.'); ForbiddenException: 'User is not assigned to a tenant'); BadRequestException: `Invalid ${label} filter.`).
- Evidence: [backend/src/compliance-clients/compliance-clients.controller.ts:17](../../backend/src/compliance-clients/compliance-clients.controller.ts#L17).
- Logic chain: ComplianceClientsService.list [backend/src/compliance-clients/compliance-clients.service.ts:802](../../backend/src/compliance-clients/compliance-clients.service.ts#L802); ComplianceClientsService.buildWhere [backend/src/compliance-clients/compliance-clients.service.ts:1156](../../backend/src/compliance-clients/compliance-clients.service.ts#L1156); ComplianceClientsService.tenantWhere [backend/src/compliance-clients/compliance-clients.service.ts:1284](../../backend/src/compliance-clients/compliance-clients.service.ts#L1284); ComplianceClientsService.optionalText [backend/src/compliance-clients/compliance-clients.service.ts:1279](../../backend/src/compliance-clients/compliance-clients.service.ts#L1279); ComplianceClientsService.enumValue [backend/src/compliance-clients/compliance-clients.service.ts:1268](../../backend/src/compliance-clients/compliance-clients.service.ts#L1268); ComplianceClientsService.screeningAlertClientIds [backend/src/compliance-clients/compliance-clients.service.ts:1139](../../backend/src/compliance-clients/compliance-clients.service.ts#L1139); ComplianceClientsService.boundedInt [backend/src/compliance-clients/compliance-clients.service.ts:1273](../../backend/src/compliance-clients/compliance-clients.service.ts#L1273); ComplianceClientsService.stats [backend/src/compliance-clients/compliance-clients.service.ts:1100](../../backend/src/compliance-clients/compliance-clients.service.ts#L1100); ComplianceClientsService.forAccess [backend/src/compliance-clients/compliance-clients.service.ts:224](../../backend/src/compliance-clients/compliance-clients.service.ts#L224); ComplianceClientsService.toListItem [backend/src/compliance-clients/compliance-clients.service.ts:1223](../../backend/src/compliance-clients/compliance-clients.service.ts#L1223).
- QA: apply Q-API for this ID and its workflow-specific cases; store status/body/DB diff with secrets removed.
- DTO field-access candidates: none resolved. These span reachable helpers and may include fields of internally composed DTOs; they are not a mandatory field list or complete wire schema. Match to the entry DTO and workflow before constructing requests.

## API-8C237A3B

**POST /api/compliance/clients/:clientId/document-sections** - ComplianceDocumentsController.createSection

- Entry/auth: AuthGuard('jwt'); RolesGuard; fallback roles: none declared; authenticated-only when JWT applies.
- Inputs: `@CurrentUser() user: RequestUser`; `@Param('clientId') clientId: string`; `@Body() dto: CreateDocumentSectionDto`.
- Output: JSON returned from delegated service; inferred fields in linked implementation. Inferred by TypeScript; no explicit response DTO.
- Behavior: Command (may mutate); detected reachable writes: clientDocumentSection.create, auditLog.create, clientDocumentSection.createMany.
- Tenant/role/state/validation helper candidates: tenantWhere.
- Error branch candidates: BadRequestException: 'Enter a folder name.'); BadRequestException: `A folder named "${duplicate.title}" already exists.`); NotFoundException: 'Compliance client not found'); ForbiddenException: 'User is not assigned to a tenant').
- Evidence: [backend/src/compliance-clients/compliance-documents.controller.ts:49](../../backend/src/compliance-clients/compliance-documents.controller.ts#L49).
- Logic chain: ComplianceDocumentsService.createSection [backend/src/compliance-clients/compliance-documents.service.ts:219](../../backend/src/compliance-clients/compliance-documents.service.ts#L219); ComplianceDocumentsService.findClient [backend/src/compliance-clients/compliance-documents.service.ts:280](../../backend/src/compliance-clients/compliance-documents.service.ts#L280); ComplianceDocumentsService.tenantWhere [backend/src/compliance-clients/compliance-documents.service.ts:290](../../backend/src/compliance-clients/compliance-documents.service.ts#L290); ComplianceDocumentsService.optionalText [backend/src/compliance-clients/compliance-documents.service.ts:311](../../backend/src/compliance-clients/compliance-documents.service.ts#L311); ComplianceDocumentsService.ensureDefaultSections [backend/src/compliance-clients/compliance-documents.service.ts:273](../../backend/src/compliance-clients/compliance-documents.service.ts#L273).
- QA: apply Q-API for this ID and its workflow-specific cases; store status/body/DB diff with secrets removed.
- DTO field-access candidates: none resolved. These span reachable helpers and may include fields of internally composed DTOs; they are not a mandatory field list or complete wire schema. Match to the entry DTO and workflow before constructing requests.

## API-9D33917C

**PATCH /api/compliance/clients/:clientId/document-sections/:sectionId** - ComplianceDocumentsController.updateSection

- Entry/auth: AuthGuard('jwt'); RolesGuard; fallback roles: none declared; authenticated-only when JWT applies.
- Inputs: `@CurrentUser() user: RequestUser`; `@Param('clientId') clientId: string`; `@Param('sectionId') sectionId: string`; `@Body() dto: UpdateDocumentSectionDto`.
- Output: JSON returned from delegated service; inferred fields in linked implementation. Inferred by TypeScript; no explicit response DTO.
- Behavior: Command (may mutate); detected reachable writes: clientDocumentSection.update, auditLog.create.
- Tenant/role/state/validation helper candidates: tenantWhere.
- Error branch candidates: NotFoundException: 'Document folder not found.'); BadRequestException: 'Default folders cannot be renamed or archived.'); BadRequestException: 'Enter a folder name.'); BadRequestException: `A folder named "${duplicate.title}" already exists.`); NotFoundException: 'Compliance client not found'); ForbiddenException: 'User is not assigned to a tenant').
- Evidence: [backend/src/compliance-clients/compliance-documents.controller.ts:54](../../backend/src/compliance-clients/compliance-documents.controller.ts#L54).
- Logic chain: ComplianceDocumentsService.updateSection [backend/src/compliance-clients/compliance-documents.service.ts:247](../../backend/src/compliance-clients/compliance-documents.service.ts#L247); ComplianceDocumentsService.findClient [backend/src/compliance-clients/compliance-documents.service.ts:280](../../backend/src/compliance-clients/compliance-documents.service.ts#L280); ComplianceDocumentsService.tenantWhere [backend/src/compliance-clients/compliance-documents.service.ts:290](../../backend/src/compliance-clients/compliance-documents.service.ts#L290); ComplianceDocumentsService.optionalText [backend/src/compliance-clients/compliance-documents.service.ts:311](../../backend/src/compliance-clients/compliance-documents.service.ts#L311).
- QA: apply Q-API for this ID and its workflow-specific cases; store status/body/DB diff with secrets removed.
- DTO field-access candidates: none resolved. These span reachable helpers and may include fields of internally composed DTOs; they are not a mandatory field list or complete wire schema. Match to the entry DTO and workflow before constructing requests.

## API-061670A7

**GET /api/compliance/clients/:clientId/documents** - ComplianceDocumentsController.list

- Entry/auth: AuthGuard('jwt'); RolesGuard; fallback roles: none declared; authenticated-only when JWT applies.
- Inputs: `@CurrentUser() user: RequestUser`; `@Param('clientId') clientId: string`.
- Output: JSON returned from delegated service; inferred fields in linked implementation. Inferred by TypeScript; no explicit response DTO.
- Behavior: GET WITH SIDE EFFECTS; detected reachable writes: clientDocumentSection.createMany.
- Tenant/role/state/validation helper candidates: tenantWhere.
- Error branch candidates: NotFoundException: 'Compliance client not found'); ForbiddenException: 'User is not assigned to a tenant').
- Evidence: [backend/src/compliance-clients/compliance-documents.controller.ts:18](../../backend/src/compliance-clients/compliance-documents.controller.ts#L18).
- Logic chain: ComplianceDocumentsService.listClientDocuments [backend/src/compliance-clients/compliance-documents.service.ts:59](../../backend/src/compliance-clients/compliance-documents.service.ts#L59); ComplianceDocumentsService.findClient [backend/src/compliance-clients/compliance-documents.service.ts:280](../../backend/src/compliance-clients/compliance-documents.service.ts#L280); ComplianceDocumentsService.tenantWhere [backend/src/compliance-clients/compliance-documents.service.ts:290](../../backend/src/compliance-clients/compliance-documents.service.ts#L290); ComplianceDocumentsService.ensureDefaultSections [backend/src/compliance-clients/compliance-documents.service.ts:273](../../backend/src/compliance-clients/compliance-documents.service.ts#L273).
- QA: apply Q-API for this ID and its workflow-specific cases; store status/body/DB diff with secrets removed.
- DTO field-access candidates: none resolved. These span reachable helpers and may include fields of internally composed DTOs; they are not a mandatory field list or complete wire schema. Match to the entry DTO and workflow before constructing requests.

## API-7E1DED97

**POST /api/compliance/clients/:clientId/documents** - ComplianceDocumentsController.upload

- Entry/auth: AuthGuard('jwt'); RolesGuard; fallback roles: none declared; authenticated-only when JWT applies.
- Inputs: `@CurrentUser() user: RequestUser`; `@Param('clientId') clientId: string`; `@Body() dto: UploadClientDocumentDto`; `@UploadedFiles() files: UploadedClientFile[]`.
- Output: JSON returned from delegated service; inferred fields in linked implementation. Inferred by TypeScript; no explicit response DTO.
- Behavior: Command (may mutate); detected reachable writes: clientDocument.create, auditLog.create, clientDocumentSection.createMany.
- Tenant/role/state/validation helper candidates: tenantWhere.
- Error branch candidates: BadRequestException: 'Choose the folder for this document.'); NotFoundException: 'Document folder not found.'); BadRequestException: 'This folder is archived. Choose an active folder.'); BadRequestException: 'Add screening evidence through a screening record.'); NotFoundException: 'Compliance client not found'); ForbiddenException: 'User is not assigned to a tenant'); BadRequestException: 'Select at least one file to upload.').
- Evidence: [backend/src/compliance-clients/compliance-documents.controller.ts:23](../../backend/src/compliance-clients/compliance-documents.controller.ts#L23).
- Logic chain: ComplianceDocumentsService.upload [backend/src/compliance-clients/compliance-documents.service.ts:85](../../backend/src/compliance-clients/compliance-documents.service.ts#L85); ComplianceDocumentsService.findClient [backend/src/compliance-clients/compliance-documents.service.ts:280](../../backend/src/compliance-clients/compliance-documents.service.ts#L280); ComplianceDocumentsService.tenantWhere [backend/src/compliance-clients/compliance-documents.service.ts:290](../../backend/src/compliance-clients/compliance-documents.service.ts#L290); ComplianceDocumentsService.optionalText [backend/src/compliance-clients/compliance-documents.service.ts:311](../../backend/src/compliance-clients/compliance-documents.service.ts#L311); ComplianceDocumentsService.storeFiles [backend/src/compliance-clients/compliance-documents.service.ts:101](../../backend/src/compliance-clients/compliance-documents.service.ts#L101); ComplianceDocumentsService.uploadRoot [backend/src/compliance-clients/compliance-documents.service.ts:296](../../backend/src/compliance-clients/compliance-documents.service.ts#L296); ComplianceDocumentsService.safeFileName [backend/src/compliance-clients/compliance-documents.service.ts:306](../../backend/src/compliance-clients/compliance-documents.service.ts#L306); ComplianceDocumentsService.listClientDocuments [backend/src/compliance-clients/compliance-documents.service.ts:59](../../backend/src/compliance-clients/compliance-documents.service.ts#L59); ComplianceDocumentsService.ensureDefaultSections [backend/src/compliance-clients/compliance-documents.service.ts:273](../../backend/src/compliance-clients/compliance-documents.service.ts#L273).
- QA: apply Q-API for this ID and its workflow-specific cases; store status/body/DB diff with secrets removed.
- DTO field-access candidates: none resolved. These span reachable helpers and may include fields of internally composed DTOs; they are not a mandatory field list or complete wire schema. Match to the entry DTO and workflow before constructing requests.

## API-868988B0

**POST /api/compliance/clients/:clientId/documents/:documentId/delete** - ComplianceDocumentsController.remove

- Entry/auth: AuthGuard('jwt'); RolesGuard; fallback roles: none declared; authenticated-only when JWT applies.
- Inputs: `@CurrentUser() user: RequestUser`; `@Param('clientId') clientId: string`; `@Param('documentId') documentId: string`; `@Body() dto: DeleteClientDocumentDto`.
- Output: JSON returned from delegated service; inferred fields in linked implementation. Inferred by TypeScript; no explicit response DTO.
- Behavior: Command (may mutate); detected reachable writes: clientDocument.update, auditLog.create, clientDocumentSection.createMany.
- Tenant/role/state/validation helper candidates: tenantWhere.
- Error branch candidates: NotFoundException: 'Document not found.'); NotFoundException: 'Compliance client not found'); ForbiddenException: 'User is not assigned to a tenant').
- Evidence: [backend/src/compliance-clients/compliance-documents.controller.ts:44](../../backend/src/compliance-clients/compliance-documents.controller.ts#L44).
- Logic chain: ComplianceDocumentsService.remove [backend/src/compliance-clients/compliance-documents.service.ts:194](../../backend/src/compliance-clients/compliance-documents.service.ts#L194); ComplianceDocumentsService.findClient [backend/src/compliance-clients/compliance-documents.service.ts:280](../../backend/src/compliance-clients/compliance-documents.service.ts#L280); ComplianceDocumentsService.tenantWhere [backend/src/compliance-clients/compliance-documents.service.ts:290](../../backend/src/compliance-clients/compliance-documents.service.ts#L290); ComplianceDocumentsService.optionalText [backend/src/compliance-clients/compliance-documents.service.ts:311](../../backend/src/compliance-clients/compliance-documents.service.ts#L311); ComplianceDocumentsService.listClientDocuments [backend/src/compliance-clients/compliance-documents.service.ts:59](../../backend/src/compliance-clients/compliance-documents.service.ts#L59); ComplianceDocumentsService.ensureDefaultSections [backend/src/compliance-clients/compliance-documents.service.ts:273](../../backend/src/compliance-clients/compliance-documents.service.ts#L273).
- QA: apply Q-API for this ID and its workflow-specific cases; store status/body/DB diff with secrets removed.
- DTO field-access candidates: none resolved. These span reachable helpers and may include fields of internally composed DTOs; they are not a mandatory field list or complete wire schema. Match to the entry DTO and workflow before constructing requests.

## API-BBF5FD78

**GET /api/compliance/clients/:clientId/documents/:documentId/view** - ComplianceDocumentsController.view

- Entry/auth: AuthGuard('jwt'); RolesGuard; fallback roles: none declared; authenticated-only when JWT applies.
- Inputs: `@CurrentUser() user: RequestUser`; `@Param('clientId') clientId: string`; `@Param('documentId') documentId: string`; `@Res() response: Response`.
- Output: Response.send binary/HTML; see controller MIME and Content-Disposition. Inferred by TypeScript; no explicit response DTO.
- Behavior: Read candidate (static scan only); detected reachable writes: none detected.
- Tenant/role/state/validation helper candidates: tenantWhere.
- Error branch candidates: NotFoundException: 'Document not found.'); NotFoundException: 'The document file is missing from storage.'); NotFoundException: 'Compliance client not found'); ForbiddenException: 'User is not assigned to a tenant').
- Evidence: [backend/src/compliance-clients/compliance-documents.controller.ts:34](../../backend/src/compliance-clients/compliance-documents.controller.ts#L34).
- Logic chain: ComplianceDocumentsService.getFile [backend/src/compliance-clients/compliance-documents.service.ts:175](../../backend/src/compliance-clients/compliance-documents.service.ts#L175); ComplianceDocumentsService.findClient [backend/src/compliance-clients/compliance-documents.service.ts:280](../../backend/src/compliance-clients/compliance-documents.service.ts#L280); ComplianceDocumentsService.tenantWhere [backend/src/compliance-clients/compliance-documents.service.ts:290](../../backend/src/compliance-clients/compliance-documents.service.ts#L290); ComplianceDocumentsService.resolvePath [backend/src/compliance-clients/compliance-documents.service.ts:300](../../backend/src/compliance-clients/compliance-documents.service.ts#L300); ComplianceDocumentsService.uploadRoot [backend/src/compliance-clients/compliance-documents.service.ts:296](../../backend/src/compliance-clients/compliance-documents.service.ts#L296).
- QA: apply Q-API for this ID and its workflow-specific cases; store status/body/DB diff with secrets removed.
- DTO field-access candidates: none resolved. These span reachable helpers and may include fields of internally composed DTOs; they are not a mandatory field list or complete wire schema. Match to the entry DTO and workflow before constructing requests.

## API-6D33C2A7

**POST /api/compliance/clients/:clientId/expiry-items** - ComplianceMonitoringController.createExpiryItem

- Entry/auth: AuthGuard('jwt'); RolesGuard; fallback roles: none declared; authenticated-only when JWT applies.
- Inputs: `@CurrentUser() user: RequestUser`; `@Param('clientId') clientId: string`; `@Body() dto: SaveExpiryItemDto`.
- Output: JSON returned from delegated service; inferred fields in linked implementation. Inferred by TypeScript; no explicit response DTO.
- Behavior: Command (may mutate); detected reachable writes: clientExpiryItem.update, clientExpiryItem.create, auditLog.create.
- Tenant/role/state/validation helper candidates: tenantWhere, requiredText.
- Error branch candidates: BadRequestException: 'Name the document type.'); NotFoundException: 'Expiry record not found.'); BadRequestException: `This date comes from ${existing.holderName}'s QID / passport on the client profile. Change it there with the pencil icon.`); NotFoundException: 'Compliance client not found'); ForbiddenException: 'User is not assigned to a tenant'); BadRequestException: `${label} is not a valid date.`); BadRequestException: message).
- Evidence: [backend/src/compliance-clients/compliance-monitoring.controller.ts:61](../../backend/src/compliance-clients/compliance-monitoring.controller.ts#L61).
- Logic chain: ComplianceMonitoringService.saveExpiryItem [backend/src/compliance-clients/compliance-monitoring.service.ts:239](../../backend/src/compliance-clients/compliance-monitoring.service.ts#L239); ComplianceMonitoringService.findClient [backend/src/compliance-clients/compliance-monitoring.service.ts:314](../../backend/src/compliance-clients/compliance-monitoring.service.ts#L314); ComplianceMonitoringService.tenantWhere [backend/src/compliance-clients/compliance-monitoring.service.ts:323](../../backend/src/compliance-clients/compliance-monitoring.service.ts#L323); ComplianceMonitoringService.date [backend/src/compliance-clients/compliance-monitoring.service.ts:333](../../backend/src/compliance-clients/compliance-monitoring.service.ts#L333); ComplianceMonitoringService.optionalText [backend/src/compliance-clients/compliance-monitoring.service.ts:351](../../backend/src/compliance-clients/compliance-monitoring.service.ts#L351); ComplianceMonitoringService.requiredText [backend/src/compliance-clients/compliance-monitoring.service.ts:345](../../backend/src/compliance-clients/compliance-monitoring.service.ts#L345); ComplianceMonitoringService.audit [backend/src/compliance-clients/compliance-monitoring.service.ts:310](../../backend/src/compliance-clients/compliance-monitoring.service.ts#L310); ComplianceMonitoringService.overview [backend/src/compliance-clients/compliance-monitoring.service.ts:24](../../backend/src/compliance-clients/compliance-monitoring.service.ts#L24); ComplianceMonitoringService.canDecideRisk [backend/src/compliance-clients/compliance-monitoring.service.ts:273](../../backend/src/compliance-clients/compliance-monitoring.service.ts#L273).
- QA: apply Q-API for this ID and its workflow-specific cases; store status/body/DB diff with secrets removed.
- DTO field-access candidates: documentLabel, documentNumber, documentType, expiryDate, holderName, holderRole, isActive, notes. These span reachable helpers and may include fields of internally composed DTOs; they are not a mandatory field list or complete wire schema. Match to the entry DTO and workflow before constructing requests.

## API-67C0F784

**PATCH /api/compliance/clients/:clientId/expiry-items/:itemId** - ComplianceMonitoringController.updateExpiryItem

- Entry/auth: AuthGuard('jwt'); RolesGuard; fallback roles: none declared; authenticated-only when JWT applies.
- Inputs: `@CurrentUser() user: RequestUser`; `@Param('clientId') clientId: string`; `@Param('itemId') itemId: string`; `@Body() dto: SaveExpiryItemDto`.
- Output: JSON returned from delegated service; inferred fields in linked implementation. Inferred by TypeScript; no explicit response DTO.
- Behavior: Command (may mutate); detected reachable writes: clientExpiryItem.update, clientExpiryItem.create, auditLog.create.
- Tenant/role/state/validation helper candidates: tenantWhere, requiredText.
- Error branch candidates: BadRequestException: 'Name the document type.'); NotFoundException: 'Expiry record not found.'); BadRequestException: `This date comes from ${existing.holderName}'s QID / passport on the client profile. Change it there with the pencil icon.`); NotFoundException: 'Compliance client not found'); ForbiddenException: 'User is not assigned to a tenant'); BadRequestException: `${label} is not a valid date.`); BadRequestException: message).
- Evidence: [backend/src/compliance-clients/compliance-monitoring.controller.ts:66](../../backend/src/compliance-clients/compliance-monitoring.controller.ts#L66).
- Logic chain: ComplianceMonitoringService.saveExpiryItem [backend/src/compliance-clients/compliance-monitoring.service.ts:239](../../backend/src/compliance-clients/compliance-monitoring.service.ts#L239); ComplianceMonitoringService.findClient [backend/src/compliance-clients/compliance-monitoring.service.ts:314](../../backend/src/compliance-clients/compliance-monitoring.service.ts#L314); ComplianceMonitoringService.tenantWhere [backend/src/compliance-clients/compliance-monitoring.service.ts:323](../../backend/src/compliance-clients/compliance-monitoring.service.ts#L323); ComplianceMonitoringService.date [backend/src/compliance-clients/compliance-monitoring.service.ts:333](../../backend/src/compliance-clients/compliance-monitoring.service.ts#L333); ComplianceMonitoringService.optionalText [backend/src/compliance-clients/compliance-monitoring.service.ts:351](../../backend/src/compliance-clients/compliance-monitoring.service.ts#L351); ComplianceMonitoringService.requiredText [backend/src/compliance-clients/compliance-monitoring.service.ts:345](../../backend/src/compliance-clients/compliance-monitoring.service.ts#L345); ComplianceMonitoringService.audit [backend/src/compliance-clients/compliance-monitoring.service.ts:310](../../backend/src/compliance-clients/compliance-monitoring.service.ts#L310); ComplianceMonitoringService.overview [backend/src/compliance-clients/compliance-monitoring.service.ts:24](../../backend/src/compliance-clients/compliance-monitoring.service.ts#L24); ComplianceMonitoringService.canDecideRisk [backend/src/compliance-clients/compliance-monitoring.service.ts:273](../../backend/src/compliance-clients/compliance-monitoring.service.ts#L273).
- QA: apply Q-API for this ID and its workflow-specific cases; store status/body/DB diff with secrets removed.
- DTO field-access candidates: documentLabel, documentNumber, documentType, expiryDate, holderName, holderRole, isActive, notes. These span reachable helpers and may include fields of internally composed DTOs; they are not a mandatory field list or complete wire schema. Match to the entry DTO and workflow before constructing requests.

## API-1005F7B7

**GET /api/compliance/clients/:clientId/legal-documents** - ClientLegalDocumentsController.list

- Entry/auth: AuthGuard('jwt'); LegalDocumentsAccessGuard; fallback roles: none declared; authenticated-only when JWT applies.
- Inputs: `@CurrentUser() user: RequestUser`; `@Param('clientId') clientId: string`.
- Output: JSON returned from delegated service; inferred fields in linked implementation. Inferred by TypeScript; no explicit response DTO.
- Behavior: Read candidate (static scan only); detected reachable writes: none detected.
- Tenant/role/state/validation helper candidates: none detected; inspect implementation before acceptance.
- Error branch candidates: ForbiddenException: 'User is not assigned to a tenant'); NotFoundException: 'Compliance client not found').
- Evidence: [backend/src/compliance-clients/client-legal-documents.controller.ts:34](../../backend/src/compliance-clients/client-legal-documents.controller.ts#L34).
- Logic chain: ClientLegalDocumentsService.list [backend/src/compliance-clients/client-legal-documents.service.ts:39](../../backend/src/compliance-clients/client-legal-documents.service.ts#L39); ClientLegalDocumentsService.findClient [backend/src/compliance-clients/client-legal-documents.service.ts:306](../../backend/src/compliance-clients/client-legal-documents.service.ts#L306).
- QA: apply Q-API for this ID and its workflow-specific cases; store status/body/DB diff with secrets removed.
- DTO field-access candidates: none resolved. These span reachable helpers and may include fields of internally composed DTOs; they are not a mandatory field list or complete wire schema. Match to the entry DTO and workflow before constructing requests.

## API-ED14C09D

**POST /api/compliance/clients/:clientId/legal-documents** - ClientLegalDocumentsController.create

- Entry/auth: AuthGuard('jwt'); LegalDocumentsAccessGuard; fallback roles: none declared; authenticated-only when JWT applies.
- Inputs: `@CurrentUser() user: RequestUser`; `@Param('clientId') clientId: string`; `@Body() dto: CreateLegalDocumentDto`; `@UploadedFiles() files: UploadedClientFile[]`.
- Output: JSON returned from delegated service; inferred fields in linked implementation. Inferred by TypeScript; no explicit response DTO.
- Behavior: Command (may mutate); detected reachable writes: clientLegalDocument.update, clientLegalDocument.create, clientEntityProfile.update, clientPerson.update, auditLog.create.
- Tenant/role/state/validation helper candidates: none detected; inspect implementation before acceptance.
- Error branch candidates: BadRequestException: 'Choose the document type.'); BadRequestException: 'QID and passport copies are added on the person (ID documents), so they stay linked to the person.'); BadRequestException: 'Enter the document name.'); BadRequestException: 'KYC documents are not available.'); NotFoundException: 'KYC document not found for this client.'); BadRequestException: 'Select one file: the copy of the document.'); BadRequestException: 'The document being replaced is no longer current. Refresh the page.'); ForbiddenException: 'User is not assigned to a tenant'); NotFoundException: 'Compliance client not found'); BadRequestException: 'Choose the person this document belongs to.'); BadRequestException: 'This person is no longer on the client profile. Refresh the page.'); BadRequestException: 'The expiry date is before the issue date.'); BadRequestException: `Enter the ${label} as YYYY-MM-DD.`).
- Evidence: [backend/src/compliance-clients/client-legal-documents.controller.ts:47](../../backend/src/compliance-clients/client-legal-documents.controller.ts#L47).
- Logic chain: ClientLegalDocumentsService.create [backend/src/compliance-clients/client-legal-documents.service.ts:107](../../backend/src/compliance-clients/client-legal-documents.service.ts#L107); ClientLegalDocumentsService.findClient [backend/src/compliance-clients/client-legal-documents.service.ts:306](../../backend/src/compliance-clients/client-legal-documents.service.ts#L306); ClientLegalDocumentsService.text [backend/src/compliance-clients/client-legal-documents.service.ts:295](../../backend/src/compliance-clients/client-legal-documents.service.ts#L295); ClientLegalDocumentsService.values [backend/src/compliance-clients/client-legal-documents.service.ts:244](../../backend/src/compliance-clients/client-legal-documents.service.ts#L244); ClientLegalDocumentsService.date [backend/src/compliance-clients/client-legal-documents.service.ts:269](../../backend/src/compliance-clients/client-legal-documents.service.ts#L269); ClientLegalDocumentsService.applyToProfile [backend/src/compliance-clients/client-legal-documents.service.ts:212](../../backend/src/compliance-clients/client-legal-documents.service.ts#L212); ClientLegalDocumentsService.audit [backend/src/compliance-clients/client-legal-documents.service.ts:300](../../backend/src/compliance-clients/client-legal-documents.service.ts#L300); ClientLegalDocumentsService.describe [backend/src/compliance-clients/client-legal-documents.service.ts:282](../../backend/src/compliance-clients/client-legal-documents.service.ts#L282); ClientLegalDocumentsService.actor [backend/src/compliance-clients/client-legal-documents.service.ts:286](../../backend/src/compliance-clients/client-legal-documents.service.ts#L286); ClientLegalDocumentsService.list [backend/src/compliance-clients/client-legal-documents.service.ts:39](../../backend/src/compliance-clients/client-legal-documents.service.ts#L39).
- QA: apply Q-API for this ID and its workflow-specific cases; store status/body/DB diff with secrets removed.
- DTO field-access candidates: documentNumber, expiryDate, holderName, issueDate, kycDocumentId, location, nature, notes, personId, readMethod, replacesId, typeKey, typeLabel. These span reachable helpers and may include fields of internally composed DTOs; they are not a mandatory field list or complete wire schema. Match to the entry DTO and workflow before constructing requests.

## API-8CF9E540

**PATCH /api/compliance/clients/:clientId/legal-documents/:documentId** - ClientLegalDocumentsController.update

- Entry/auth: AuthGuard('jwt'); LegalDocumentsAccessGuard; fallback roles: none declared; authenticated-only when JWT applies.
- Inputs: `@CurrentUser() user: RequestUser`; `@Param('clientId') clientId: string`; `@Param('documentId') documentId: string`; `@Body() dto: LegalDocumentFieldsDto`.
- Output: JSON returned from delegated service; inferred fields in linked implementation. Inferred by TypeScript; no explicit response DTO.
- Behavior: Command (may mutate); detected reachable writes: clientLegalDocument.update, clientEntityProfile.update, clientPerson.update, auditLog.create.
- Tenant/role/state/validation helper candidates: none detected; inspect implementation before acceptance.
- Error branch candidates: ForbiddenException: 'User is not assigned to a tenant'); NotFoundException: 'Compliance client not found'); NotFoundException: 'This document is no longer current. Refresh the page.'); BadRequestException: 'Choose the person this document belongs to.'); BadRequestException: 'This person is no longer on the client profile. Refresh the page.'); BadRequestException: 'The expiry date is before the issue date.'); BadRequestException: `Enter the ${label} as YYYY-MM-DD.`).
- Evidence: [backend/src/compliance-clients/client-legal-documents.controller.ts:53](../../backend/src/compliance-clients/client-legal-documents.controller.ts#L53).
- Logic chain: ClientLegalDocumentsService.update [backend/src/compliance-clients/client-legal-documents.service.ts:165](../../backend/src/compliance-clients/client-legal-documents.service.ts#L165); ClientLegalDocumentsService.findClient [backend/src/compliance-clients/client-legal-documents.service.ts:306](../../backend/src/compliance-clients/client-legal-documents.service.ts#L306); ClientLegalDocumentsService.current [backend/src/compliance-clients/client-legal-documents.service.ts:276](../../backend/src/compliance-clients/client-legal-documents.service.ts#L276); ClientLegalDocumentsService.values [backend/src/compliance-clients/client-legal-documents.service.ts:244](../../backend/src/compliance-clients/client-legal-documents.service.ts#L244); ClientLegalDocumentsService.text [backend/src/compliance-clients/client-legal-documents.service.ts:295](../../backend/src/compliance-clients/client-legal-documents.service.ts#L295); ClientLegalDocumentsService.date [backend/src/compliance-clients/client-legal-documents.service.ts:269](../../backend/src/compliance-clients/client-legal-documents.service.ts#L269); ClientLegalDocumentsService.shown [backend/src/compliance-clients/client-legal-documents.service.ts:290](../../backend/src/compliance-clients/client-legal-documents.service.ts#L290); ClientLegalDocumentsService.list [backend/src/compliance-clients/client-legal-documents.service.ts:39](../../backend/src/compliance-clients/client-legal-documents.service.ts#L39); ClientLegalDocumentsService.applyToProfile [backend/src/compliance-clients/client-legal-documents.service.ts:212](../../backend/src/compliance-clients/client-legal-documents.service.ts#L212); ClientLegalDocumentsService.audit [backend/src/compliance-clients/client-legal-documents.service.ts:300](../../backend/src/compliance-clients/client-legal-documents.service.ts#L300); ClientLegalDocumentsService.describe [backend/src/compliance-clients/client-legal-documents.service.ts:282](../../backend/src/compliance-clients/client-legal-documents.service.ts#L282); ClientLegalDocumentsService.actor [backend/src/compliance-clients/client-legal-documents.service.ts:286](../../backend/src/compliance-clients/client-legal-documents.service.ts#L286).
- QA: apply Q-API for this ID and its workflow-specific cases; store status/body/DB diff with secrets removed.
- DTO field-access candidates: documentNumber, expiryDate, holderName, issueDate, location, notes, personId. These span reachable helpers and may include fields of internally composed DTOs; they are not a mandatory field list or complete wire schema. Match to the entry DTO and workflow before constructing requests.

## API-51C110E4

**POST /api/compliance/clients/:clientId/legal-documents/:documentId/remove** - ClientLegalDocumentsController.remove

- Entry/auth: AuthGuard('jwt'); LegalDocumentsAccessGuard; fallback roles: none declared; authenticated-only when JWT applies.
- Inputs: `@CurrentUser() user: RequestUser`; `@Param('clientId') clientId: string`; `@Param('documentId') documentId: string`; `@Body() dto: RemoveLegalDocumentDto`.
- Output: JSON returned from delegated service; inferred fields in linked implementation. Inferred by TypeScript; no explicit response DTO.
- Behavior: Command (may mutate); detected reachable writes: clientLegalDocument.update, auditLog.create.
- Tenant/role/state/validation helper candidates: none detected; inspect implementation before acceptance.
- Error branch candidates: BadRequestException: 'Give the reason for removing the document.'); ForbiddenException: 'User is not assigned to a tenant'); NotFoundException: 'Compliance client not found'); NotFoundException: 'This document is no longer current. Refresh the page.').
- Evidence: [backend/src/compliance-clients/client-legal-documents.controller.ts:58](../../backend/src/compliance-clients/client-legal-documents.controller.ts#L58).
- Logic chain: ClientLegalDocumentsService.remove [backend/src/compliance-clients/client-legal-documents.service.ts:185](../../backend/src/compliance-clients/client-legal-documents.service.ts#L185); ClientLegalDocumentsService.findClient [backend/src/compliance-clients/client-legal-documents.service.ts:306](../../backend/src/compliance-clients/client-legal-documents.service.ts#L306); ClientLegalDocumentsService.current [backend/src/compliance-clients/client-legal-documents.service.ts:276](../../backend/src/compliance-clients/client-legal-documents.service.ts#L276); ClientLegalDocumentsService.text [backend/src/compliance-clients/client-legal-documents.service.ts:295](../../backend/src/compliance-clients/client-legal-documents.service.ts#L295); ClientLegalDocumentsService.audit [backend/src/compliance-clients/client-legal-documents.service.ts:300](../../backend/src/compliance-clients/client-legal-documents.service.ts#L300); ClientLegalDocumentsService.describe [backend/src/compliance-clients/client-legal-documents.service.ts:282](../../backend/src/compliance-clients/client-legal-documents.service.ts#L282); ClientLegalDocumentsService.actor [backend/src/compliance-clients/client-legal-documents.service.ts:286](../../backend/src/compliance-clients/client-legal-documents.service.ts#L286); ClientLegalDocumentsService.list [backend/src/compliance-clients/client-legal-documents.service.ts:39](../../backend/src/compliance-clients/client-legal-documents.service.ts#L39).
- QA: apply Q-API for this ID and its workflow-specific cases; store status/body/DB diff with secrets removed.
- DTO field-access candidates: none resolved. These span reachable helpers and may include fields of internally composed DTOs; they are not a mandatory field list or complete wire schema. Match to the entry DTO and workflow before constructing requests.

## API-396FCEA2

**GET /api/compliance/clients/:clientId/legal-documents/:documentId/view** - ClientLegalDocumentsController.view

- Entry/auth: AuthGuard('jwt'); LegalDocumentsAccessGuard; fallback roles: none declared; authenticated-only when JWT applies.
- Inputs: `@CurrentUser() user: RequestUser`; `@Param('clientId') clientId: string`; `@Param('documentId') documentId: string`; `@Res() response: Response`.
- Output: Response.send binary/HTML; see controller MIME and Content-Disposition. Inferred by TypeScript; no explicit response DTO.
- Behavior: Read candidate (static scan only); detected reachable writes: none detected.
- Tenant/role/state/validation helper candidates: none detected; inspect implementation before acceptance.
- Error branch candidates: NotFoundException: 'Document not found.'); NotFoundException: 'The document file is missing from storage.'); ForbiddenException: 'User is not assigned to a tenant'); NotFoundException: 'Compliance client not found').
- Evidence: [backend/src/compliance-clients/client-legal-documents.controller.ts:63](../../backend/src/compliance-clients/client-legal-documents.controller.ts#L63).
- Logic chain: ClientLegalDocumentsService.getFile [backend/src/compliance-clients/client-legal-documents.service.ts:202](../../backend/src/compliance-clients/client-legal-documents.service.ts#L202); ClientLegalDocumentsService.findClient [backend/src/compliance-clients/client-legal-documents.service.ts:306](../../backend/src/compliance-clients/client-legal-documents.service.ts#L306).
- QA: apply Q-API for this ID and its workflow-specific cases; store status/body/DB diff with secrets removed.
- DTO field-access candidates: none resolved. These span reachable helpers and may include fields of internally composed DTOs; they are not a mandatory field list or complete wire schema. Match to the entry DTO and workflow before constructing requests.

## API-033706F5

**POST /api/compliance/clients/:clientId/legal-documents/read** - ClientLegalDocumentsController.read

- Entry/auth: AuthGuard('jwt'); LegalDocumentsAccessGuard; fallback roles: none declared; authenticated-only when JWT applies.
- Inputs: `@CurrentUser() user: RequestUser`; `@Param('clientId') clientId: string`; `@Body() dto: ReadLegalDocumentDto`; `@UploadedFiles() files: UploadedClientFile[]`.
- Output: JSON returned from delegated service; inferred fields in linked implementation. Inferred by TypeScript; no explicit response DTO.
- Behavior: Command (may mutate); detected reachable writes: none detected.
- Tenant/role/state/validation helper candidates: none detected; inspect implementation before acceptance.
- Error branch candidates: BadRequestException: 'Select one file to read.'); BadRequestException: 'Choose the document type.'); ForbiddenException: 'User is not assigned to a tenant'); NotFoundException: 'Compliance client not found').
- Evidence: [backend/src/compliance-clients/client-legal-documents.controller.ts:40](../../backend/src/compliance-clients/client-legal-documents.controller.ts#L40).
- Logic chain: ClientLegalDocumentsService.read [backend/src/compliance-clients/client-legal-documents.service.ts:99](../../backend/src/compliance-clients/client-legal-documents.service.ts#L99); ClientLegalDocumentsService.findClient [backend/src/compliance-clients/client-legal-documents.service.ts:306](../../backend/src/compliance-clients/client-legal-documents.service.ts#L306).
- QA: apply Q-API for this ID and its workflow-specific cases; store status/body/DB diff with secrets removed.
- DTO field-access candidates: none resolved. These span reachable helpers and may include fields of internally composed DTOs; they are not a mandatory field list or complete wire schema. Match to the entry DTO and workflow before constructing requests.

## API-ED4F91AE

**GET /api/compliance/clients/:clientId/monitoring** - ComplianceMonitoringController.overview

- Entry/auth: AuthGuard('jwt'); RolesGuard; fallback roles: none declared; authenticated-only when JWT applies.
- Inputs: `@CurrentUser() user: RequestUser`; `@Param('clientId') clientId: string`.
- Output: JSON returned from delegated service; inferred fields in linked implementation. Inferred by TypeScript; no explicit response DTO.
- Behavior: Read candidate (static scan only); detected reachable writes: none detected.
- Tenant/role/state/validation helper candidates: tenantWhere.
- Error branch candidates: NotFoundException: 'Compliance client not found'); ForbiddenException: 'User is not assigned to a tenant').
- Evidence: [backend/src/compliance-clients/compliance-monitoring.controller.ts:20](../../backend/src/compliance-clients/compliance-monitoring.controller.ts#L20).
- Logic chain: ComplianceMonitoringService.overview [backend/src/compliance-clients/compliance-monitoring.service.ts:24](../../backend/src/compliance-clients/compliance-monitoring.service.ts#L24); ComplianceMonitoringService.findClient [backend/src/compliance-clients/compliance-monitoring.service.ts:314](../../backend/src/compliance-clients/compliance-monitoring.service.ts#L314); ComplianceMonitoringService.tenantWhere [backend/src/compliance-clients/compliance-monitoring.service.ts:323](../../backend/src/compliance-clients/compliance-monitoring.service.ts#L323); ComplianceMonitoringService.canDecideRisk [backend/src/compliance-clients/compliance-monitoring.service.ts:273](../../backend/src/compliance-clients/compliance-monitoring.service.ts#L273).
- QA: apply Q-API for this ID and its workflow-specific cases; store status/body/DB diff with secrets removed.
- DTO field-access candidates: none resolved. These span reachable helpers and may include fields of internally composed DTOs; they are not a mandatory field list or complete wire schema. Match to the entry DTO and workflow before constructing requests.

## API-42FDCCAA

**POST /api/compliance/clients/:clientId/reviews** - ComplianceMonitoringController.startReview

- Entry/auth: AuthGuard('jwt'); RolesGuard; fallback roles: none declared; authenticated-only when JWT applies.
- Inputs: `@CurrentUser() user: RequestUser`; `@Param('clientId') clientId: string`.
- Output: JSON returned from delegated service; inferred fields in linked implementation. Inferred by TypeScript; no explicit response DTO.
- Behavior: Command (may mutate); detected reachable writes: clientReview.create, auditLog.create.
- Tenant/role/state/validation helper candidates: tenantWhere.
- Error branch candidates: BadRequestException: 'Periodic reviews are started for active clients only.'); BadRequestException: 'A review is already in progress for this client.'); NotFoundException: 'Compliance client not found'); ForbiddenException: 'User is not assigned to a tenant').
- Evidence: [backend/src/compliance-clients/compliance-monitoring.controller.ts:46](../../backend/src/compliance-clients/compliance-monitoring.controller.ts#L46).
- Logic chain: ComplianceMonitoringService.startReview [backend/src/compliance-clients/compliance-monitoring.service.ts:172](../../backend/src/compliance-clients/compliance-monitoring.service.ts#L172); ComplianceMonitoringService.findClient [backend/src/compliance-clients/compliance-monitoring.service.ts:314](../../backend/src/compliance-clients/compliance-monitoring.service.ts#L314); ComplianceMonitoringService.tenantWhere [backend/src/compliance-clients/compliance-monitoring.service.ts:323](../../backend/src/compliance-clients/compliance-monitoring.service.ts#L323); ComplianceMonitoringService.audit [backend/src/compliance-clients/compliance-monitoring.service.ts:310](../../backend/src/compliance-clients/compliance-monitoring.service.ts#L310); ComplianceMonitoringService.overview [backend/src/compliance-clients/compliance-monitoring.service.ts:24](../../backend/src/compliance-clients/compliance-monitoring.service.ts#L24); ComplianceMonitoringService.canDecideRisk [backend/src/compliance-clients/compliance-monitoring.service.ts:273](../../backend/src/compliance-clients/compliance-monitoring.service.ts#L273).
- QA: apply Q-API for this ID and its workflow-specific cases; store status/body/DB diff with secrets removed.
- DTO field-access candidates: none resolved. These span reachable helpers and may include fields of internally composed DTOs; they are not a mandatory field list or complete wire schema. Match to the entry DTO and workflow before constructing requests.

## API-1D0B8A5A

**POST /api/compliance/clients/:clientId/reviews/:reviewId/cancel** - ComplianceMonitoringController.cancelReview

- Entry/auth: AuthGuard('jwt'); RolesGuard; fallback roles: none declared; authenticated-only when JWT applies.
- Inputs: `@CurrentUser() user: RequestUser`; `@Param('clientId') clientId: string`; `@Param('reviewId') reviewId: string`; `@Body() dto: CancelDto`.
- Output: JSON returned from delegated service; inferred fields in linked implementation. Inferred by TypeScript; no explicit response DTO.
- Behavior: Command (may mutate); detected reachable writes: clientReview.update, auditLog.create.
- Tenant/role/state/validation helper candidates: tenantWhere, requiredText.
- Error branch candidates: NotFoundException: 'Review not found.'); BadRequestException: 'This review is no longer in progress.'); NotFoundException: 'Compliance client not found'); ForbiddenException: 'User is not assigned to a tenant'); BadRequestException: message).
- Evidence: [backend/src/compliance-clients/compliance-monitoring.controller.ts:56](../../backend/src/compliance-clients/compliance-monitoring.controller.ts#L56).
- Logic chain: ComplianceMonitoringService.cancelReview [backend/src/compliance-clients/compliance-monitoring.service.ts:224](../../backend/src/compliance-clients/compliance-monitoring.service.ts#L224); ComplianceMonitoringService.findClient [backend/src/compliance-clients/compliance-monitoring.service.ts:314](../../backend/src/compliance-clients/compliance-monitoring.service.ts#L314); ComplianceMonitoringService.tenantWhere [backend/src/compliance-clients/compliance-monitoring.service.ts:323](../../backend/src/compliance-clients/compliance-monitoring.service.ts#L323); ComplianceMonitoringService.requiredText [backend/src/compliance-clients/compliance-monitoring.service.ts:345](../../backend/src/compliance-clients/compliance-monitoring.service.ts#L345); ComplianceMonitoringService.optionalText [backend/src/compliance-clients/compliance-monitoring.service.ts:351](../../backend/src/compliance-clients/compliance-monitoring.service.ts#L351); ComplianceMonitoringService.audit [backend/src/compliance-clients/compliance-monitoring.service.ts:310](../../backend/src/compliance-clients/compliance-monitoring.service.ts#L310); ComplianceMonitoringService.overview [backend/src/compliance-clients/compliance-monitoring.service.ts:24](../../backend/src/compliance-clients/compliance-monitoring.service.ts#L24); ComplianceMonitoringService.canDecideRisk [backend/src/compliance-clients/compliance-monitoring.service.ts:273](../../backend/src/compliance-clients/compliance-monitoring.service.ts#L273).
- QA: apply Q-API for this ID and its workflow-specific cases; store status/body/DB diff with secrets removed.
- DTO field-access candidates: none resolved. These span reachable helpers and may include fields of internally composed DTOs; they are not a mandatory field list or complete wire schema. Match to the entry DTO and workflow before constructing requests.

## API-25663815

**POST /api/compliance/clients/:clientId/reviews/:reviewId/complete** - ComplianceMonitoringController.completeReview

- Entry/auth: AuthGuard('jwt'); RolesGuard; fallback roles: none declared; authenticated-only when JWT applies.
- Inputs: `@CurrentUser() user: RequestUser`; `@Param('clientId') clientId: string`; `@Param('reviewId') reviewId: string`; `@Body() dto: CompleteReviewDto`.
- Output: JSON returned from delegated service; inferred fields in linked implementation. Inferred by TypeScript; no explicit response DTO.
- Behavior: Command (may mutate); detected reachable writes: clientReview.update, client.update, clientRiskChange.create, auditLog.create, notification.create.
- Tenant/role/state/validation helper candidates: tenantWhere, requiredText.
- Error branch candidates: NotFoundException: 'Review not found.'); BadRequestException: 'This review is no longer in progress.'); BadRequestException: 'Record a screening for this client before completing the review.'); BadRequestException: 'Choose the proposed risk, a reason and an explanation for the risk change.'); NotFoundException: 'Compliance client not found'); ForbiddenException: 'User is not assigned to a tenant'); BadRequestException: message); BadRequestException: 'The proposed risk and CDD type match the current values.'); BadRequestException: 'A risk change is already awaiting approval for this client.').
- Evidence: [backend/src/compliance-clients/compliance-monitoring.controller.ts:51](../../backend/src/compliance-clients/compliance-monitoring.controller.ts#L51).
- Logic chain: ComplianceMonitoringService.completeReview [backend/src/compliance-clients/compliance-monitoring.service.ts:187](../../backend/src/compliance-clients/compliance-monitoring.service.ts#L187); ComplianceMonitoringService.findClient [backend/src/compliance-clients/compliance-monitoring.service.ts:314](../../backend/src/compliance-clients/compliance-monitoring.service.ts#L314); ComplianceMonitoringService.tenantWhere [backend/src/compliance-clients/compliance-monitoring.service.ts:323](../../backend/src/compliance-clients/compliance-monitoring.service.ts#L323); ComplianceMonitoringService.requiredText [backend/src/compliance-clients/compliance-monitoring.service.ts:345](../../backend/src/compliance-clients/compliance-monitoring.service.ts#L345); ComplianceMonitoringService.optionalText [backend/src/compliance-clients/compliance-monitoring.service.ts:351](../../backend/src/compliance-clients/compliance-monitoring.service.ts#L351); ComplianceMonitoringService.createRiskChange [backend/src/compliance-clients/compliance-monitoring.service.ts:277](../../backend/src/compliance-clients/compliance-monitoring.service.ts#L277); ComplianceMonitoringService.audit [backend/src/compliance-clients/compliance-monitoring.service.ts:310](../../backend/src/compliance-clients/compliance-monitoring.service.ts#L310); ComplianceMonitoringService.notify [backend/src/compliance-clients/compliance-monitoring.service.ts:306](../../backend/src/compliance-clients/compliance-monitoring.service.ts#L306); ComplianceMonitoringService.clientLabel [backend/src/compliance-clients/compliance-monitoring.service.ts:329](../../backend/src/compliance-clients/compliance-monitoring.service.ts#L329); ComplianceMonitoringService.overview [backend/src/compliance-clients/compliance-monitoring.service.ts:24](../../backend/src/compliance-clients/compliance-monitoring.service.ts#L24); ComplianceMonitoringService.canDecideRisk [backend/src/compliance-clients/compliance-monitoring.service.ts:273](../../backend/src/compliance-clients/compliance-monitoring.service.ts#L273).
- QA: apply Q-API for this ID and its workflow-specific cases; store status/body/DB diff with secrets removed.
- DTO field-access candidates: explanation, findings, outcome, proposedCdd, proposedRisk, reasonCategory. These span reachable helpers and may include fields of internally composed DTOs; they are not a mandatory field list or complete wire schema. Match to the entry DTO and workflow before constructing requests.

## API-980D1672

**POST /api/compliance/clients/:clientId/risk-changes** - ComplianceMonitoringController.requestRiskChange

- Entry/auth: AuthGuard('jwt'); RolesGuard; fallback roles: none declared; authenticated-only when JWT applies.
- Inputs: `@CurrentUser() user: RequestUser`; `@Param('clientId') clientId: string`; `@Body() dto: RequestRiskChangeDto`.
- Output: JSON returned from delegated service; inferred fields in linked implementation. Inferred by TypeScript; no explicit response DTO.
- Behavior: Command (may mutate); detected reachable writes: clientRiskChange.create, auditLog.create, notification.create.
- Tenant/role/state/validation helper candidates: tenantWhere, requiredText.
- Error branch candidates: NotFoundException: 'Compliance client not found'); ForbiddenException: 'User is not assigned to a tenant'); BadRequestException: 'The proposed risk and CDD type match the current values.'); BadRequestException: 'A risk change is already awaiting approval for this client.'); BadRequestException: message).
- Evidence: [backend/src/compliance-clients/compliance-monitoring.controller.ts:31](../../backend/src/compliance-clients/compliance-monitoring.controller.ts#L31).
- Logic chain: ComplianceMonitoringService.requestRiskChange [backend/src/compliance-clients/compliance-monitoring.service.ts:109](../../backend/src/compliance-clients/compliance-monitoring.service.ts#L109); ComplianceMonitoringService.findClient [backend/src/compliance-clients/compliance-monitoring.service.ts:314](../../backend/src/compliance-clients/compliance-monitoring.service.ts#L314); ComplianceMonitoringService.tenantWhere [backend/src/compliance-clients/compliance-monitoring.service.ts:323](../../backend/src/compliance-clients/compliance-monitoring.service.ts#L323); ComplianceMonitoringService.createRiskChange [backend/src/compliance-clients/compliance-monitoring.service.ts:277](../../backend/src/compliance-clients/compliance-monitoring.service.ts#L277); ComplianceMonitoringService.requiredText [backend/src/compliance-clients/compliance-monitoring.service.ts:345](../../backend/src/compliance-clients/compliance-monitoring.service.ts#L345); ComplianceMonitoringService.optionalText [backend/src/compliance-clients/compliance-monitoring.service.ts:351](../../backend/src/compliance-clients/compliance-monitoring.service.ts#L351); ComplianceMonitoringService.audit [backend/src/compliance-clients/compliance-monitoring.service.ts:310](../../backend/src/compliance-clients/compliance-monitoring.service.ts#L310); ComplianceMonitoringService.notify [backend/src/compliance-clients/compliance-monitoring.service.ts:306](../../backend/src/compliance-clients/compliance-monitoring.service.ts#L306); ComplianceMonitoringService.clientLabel [backend/src/compliance-clients/compliance-monitoring.service.ts:329](../../backend/src/compliance-clients/compliance-monitoring.service.ts#L329); ComplianceMonitoringService.overview [backend/src/compliance-clients/compliance-monitoring.service.ts:24](../../backend/src/compliance-clients/compliance-monitoring.service.ts#L24); ComplianceMonitoringService.canDecideRisk [backend/src/compliance-clients/compliance-monitoring.service.ts:273](../../backend/src/compliance-clients/compliance-monitoring.service.ts#L273).
- QA: apply Q-API for this ID and its workflow-specific cases; store status/body/DB diff with secrets removed.
- DTO field-access candidates: explanation, proposedCdd, proposedRisk, reasonCategory. These span reachable helpers and may include fields of internally composed DTOs; they are not a mandatory field list or complete wire schema. Match to the entry DTO and workflow before constructing requests.

## API-F0AF4B90

**POST /api/compliance/clients/:clientId/risk-changes/:changeId/cancel** - ComplianceMonitoringController.cancelRiskChange

- Entry/auth: AuthGuard('jwt'); RolesGuard; fallback roles: none declared; authenticated-only when JWT applies.
- Inputs: `@CurrentUser() user: RequestUser`; `@Param('clientId') clientId: string`; `@Param('changeId') changeId: string`.
- Output: JSON returned from delegated service; inferred fields in linked implementation. Inferred by TypeScript; no explicit response DTO.
- Behavior: Command (may mutate); detected reachable writes: clientRiskChange.update, auditLog.create.
- Tenant/role/state/validation helper candidates: tenantWhere.
- Error branch candidates: NotFoundException: 'Risk change not found.'); BadRequestException: 'Only a pending risk change can be withdrawn.'); ForbiddenException: 'Only the requester can withdraw this risk change.'); NotFoundException: 'Compliance client not found'); ForbiddenException: 'User is not assigned to a tenant').
- Evidence: [backend/src/compliance-clients/compliance-monitoring.controller.ts:41](../../backend/src/compliance-clients/compliance-monitoring.controller.ts#L41).
- Logic chain: ComplianceMonitoringService.cancelRiskChange [backend/src/compliance-clients/compliance-monitoring.service.ts:157](../../backend/src/compliance-clients/compliance-monitoring.service.ts#L157); ComplianceMonitoringService.findClient [backend/src/compliance-clients/compliance-monitoring.service.ts:314](../../backend/src/compliance-clients/compliance-monitoring.service.ts#L314); ComplianceMonitoringService.tenantWhere [backend/src/compliance-clients/compliance-monitoring.service.ts:323](../../backend/src/compliance-clients/compliance-monitoring.service.ts#L323); ComplianceMonitoringService.canDecideRisk [backend/src/compliance-clients/compliance-monitoring.service.ts:273](../../backend/src/compliance-clients/compliance-monitoring.service.ts#L273); ComplianceMonitoringService.audit [backend/src/compliance-clients/compliance-monitoring.service.ts:310](../../backend/src/compliance-clients/compliance-monitoring.service.ts#L310); ComplianceMonitoringService.overview [backend/src/compliance-clients/compliance-monitoring.service.ts:24](../../backend/src/compliance-clients/compliance-monitoring.service.ts#L24).
- QA: apply Q-API for this ID and its workflow-specific cases; store status/body/DB diff with secrets removed.
- DTO field-access candidates: none resolved. These span reachable helpers and may include fields of internally composed DTOs; they are not a mandatory field list or complete wire schema. Match to the entry DTO and workflow before constructing requests.

## API-C87B8B6F

**POST /api/compliance/clients/:clientId/risk-changes/:changeId/decision** - ComplianceMonitoringController.decideRiskChange

- Entry/auth: AuthGuard('jwt'); RolesGuard; fallback roles: none declared; authenticated-only when JWT applies.
- Inputs: `@CurrentUser() user: RequestUser`; `@Param('clientId') clientId: string`; `@Param('changeId') changeId: string`; `@Body() dto: DecideRiskChangeDto`.
- Output: JSON returned from delegated service; inferred fields in linked implementation. Inferred by TypeScript; no explicit response DTO.
- Behavior: Command (may mutate); detected reachable writes: clientRiskChange.update, client.update, auditLog.create, notification.create.
- Tenant/role/state/validation helper candidates: tenantWhere.
- Error branch candidates: ForbiddenException: 'Only the DMLRO or MLRO can approve or reject a risk change.'); NotFoundException: 'Risk change not found.'); BadRequestException: 'This risk change has already been decided.'); ForbiddenException: 'A risk change must be approved by someone other than the person who requested it.'); BadRequestException: 'Give a reason for rejecting the risk change.'); NotFoundException: 'Compliance client not found'); ForbiddenException: 'User is not assigned to a tenant').
- Evidence: [backend/src/compliance-clients/compliance-monitoring.controller.ts:36](../../backend/src/compliance-clients/compliance-monitoring.controller.ts#L36).
- Logic chain: ComplianceMonitoringService.decideRiskChange [backend/src/compliance-clients/compliance-monitoring.service.ts:115](../../backend/src/compliance-clients/compliance-monitoring.service.ts#L115); ComplianceMonitoringService.canDecideRisk [backend/src/compliance-clients/compliance-monitoring.service.ts:273](../../backend/src/compliance-clients/compliance-monitoring.service.ts#L273); ComplianceMonitoringService.findClient [backend/src/compliance-clients/compliance-monitoring.service.ts:314](../../backend/src/compliance-clients/compliance-monitoring.service.ts#L314); ComplianceMonitoringService.tenantWhere [backend/src/compliance-clients/compliance-monitoring.service.ts:323](../../backend/src/compliance-clients/compliance-monitoring.service.ts#L323); ComplianceMonitoringService.optionalText [backend/src/compliance-clients/compliance-monitoring.service.ts:351](../../backend/src/compliance-clients/compliance-monitoring.service.ts#L351); ComplianceMonitoringService.audit [backend/src/compliance-clients/compliance-monitoring.service.ts:310](../../backend/src/compliance-clients/compliance-monitoring.service.ts#L310); ComplianceMonitoringService.notify [backend/src/compliance-clients/compliance-monitoring.service.ts:306](../../backend/src/compliance-clients/compliance-monitoring.service.ts#L306); ComplianceMonitoringService.clientLabel [backend/src/compliance-clients/compliance-monitoring.service.ts:329](../../backend/src/compliance-clients/compliance-monitoring.service.ts#L329); ComplianceMonitoringService.overview [backend/src/compliance-clients/compliance-monitoring.service.ts:24](../../backend/src/compliance-clients/compliance-monitoring.service.ts#L24).
- QA: apply Q-API for this ID and its workflow-specific cases; store status/body/DB diff with secrets removed.
- DTO field-access candidates: decision, note. These span reachable helpers and may include fields of internally composed DTOs; they are not a mandatory field list or complete wire schema. Match to the entry DTO and workflow before constructing requests.

## API-6A9CBA9F

**POST /api/compliance/clients/:clientId/screenings** - ComplianceMonitoringController.createScreening

- Entry/auth: AuthGuard('jwt'); RolesGuard; fallback roles: none declared; authenticated-only when JWT applies.
- Inputs: `@CurrentUser() user: RequestUser`; `@Param('clientId') clientId: string`; `@Body() dto: CreateScreeningDto`; `@UploadedFiles() files: UploadedClientFile[]`.
- Output: JSON returned from delegated service; inferred fields in linked implementation. Inferred by TypeScript; no explicit response DTO.
- Behavior: Command (may mutate); detected reachable writes: clientScreening.create, auditLog.create, notification.create.
- Tenant/role/state/validation helper candidates: tenantWhere, requiredText.
- Error branch candidates: BadRequestException: 'The selected review is not open.'); NotFoundException: 'Compliance client not found'); ForbiddenException: 'User is not assigned to a tenant'); BadRequestException: `${label} cannot be in the future.`); BadRequestException: `${label} is not a valid date.`); BadRequestException: message).
- Evidence: [backend/src/compliance-clients/compliance-monitoring.controller.ts:25](../../backend/src/compliance-clients/compliance-monitoring.controller.ts#L25).
- Logic chain: ComplianceMonitoringService.createScreening [backend/src/compliance-clients/compliance-monitoring.service.ts:64](../../backend/src/compliance-clients/compliance-monitoring.service.ts#L64); ComplianceMonitoringService.findClient [backend/src/compliance-clients/compliance-monitoring.service.ts:314](../../backend/src/compliance-clients/compliance-monitoring.service.ts#L314); ComplianceMonitoringService.tenantWhere [backend/src/compliance-clients/compliance-monitoring.service.ts:323](../../backend/src/compliance-clients/compliance-monitoring.service.ts#L323); ComplianceMonitoringService.pastOrTodayDate [backend/src/compliance-clients/compliance-monitoring.service.ts:339](../../backend/src/compliance-clients/compliance-monitoring.service.ts#L339); ComplianceMonitoringService.date [backend/src/compliance-clients/compliance-monitoring.service.ts:333](../../backend/src/compliance-clients/compliance-monitoring.service.ts#L333); ComplianceMonitoringService.requiredText [backend/src/compliance-clients/compliance-monitoring.service.ts:345](../../backend/src/compliance-clients/compliance-monitoring.service.ts#L345); ComplianceMonitoringService.optionalText [backend/src/compliance-clients/compliance-monitoring.service.ts:351](../../backend/src/compliance-clients/compliance-monitoring.service.ts#L351); ComplianceMonitoringService.audit [backend/src/compliance-clients/compliance-monitoring.service.ts:310](../../backend/src/compliance-clients/compliance-monitoring.service.ts#L310); ComplianceMonitoringService.notify [backend/src/compliance-clients/compliance-monitoring.service.ts:306](../../backend/src/compliance-clients/compliance-monitoring.service.ts#L306); ComplianceMonitoringService.clientLabel [backend/src/compliance-clients/compliance-monitoring.service.ts:329](../../backend/src/compliance-clients/compliance-monitoring.service.ts#L329); ComplianceMonitoringService.overview [backend/src/compliance-clients/compliance-monitoring.service.ts:24](../../backend/src/compliance-clients/compliance-monitoring.service.ts#L24); ComplianceMonitoringService.canDecideRisk [backend/src/compliance-clients/compliance-monitoring.service.ts:273](../../backend/src/compliance-clients/compliance-monitoring.service.ts#L273).
- QA: apply Q-API for this ID and its workflow-specific cases; store status/body/DB diff with secrets removed.
- DTO field-access candidates: listsChecked, result, reviewId, scope, screenedAt, summary. These span reachable helpers and may include fields of internally composed DTOs; they are not a mandatory field list or complete wire schema. Match to the entry DTO and workflow before constructing requests.

## API-01C15240

**GET /api/compliance/clients/:id** - ComplianceClientsController.findOne

- Entry/auth: AuthGuard('jwt'); RolesGuard; fallback roles: none declared; authenticated-only when JWT applies.
- Inputs: `@CurrentUser() user: RequestUser`; `@Param('id') id: string`.
- Output: JSON returned from delegated service; inferred fields in linked implementation. Inferred by TypeScript; no explicit response DTO.
- Behavior: Read candidate (static scan only); detected reachable writes: none detected.
- Tenant/role/state/validation helper candidates: tenantWhere.
- Error branch candidates: NotFoundException: 'Compliance client not found'); ForbiddenException: 'User is not assigned to a tenant').
- Evidence: [backend/src/compliance-clients/compliance-clients.controller.ts:48](../../backend/src/compliance-clients/compliance-clients.controller.ts#L48).
- Logic chain: ComplianceClientsService.findOne [backend/src/compliance-clients/compliance-clients.service.ts:93](../../backend/src/compliance-clients/compliance-clients.service.ts#L93); ComplianceClientsService.tenantWhere [backend/src/compliance-clients/compliance-clients.service.ts:1284](../../backend/src/compliance-clients/compliance-clients.service.ts#L1284); ComplianceClientsService.pickProfileCase [backend/src/compliance-clients/compliance-clients.service.ts:293](../../backend/src/compliance-clients/compliance-clients.service.ts#L293); ComplianceClientsService.ensureRecords [backend/src/compliance-clients/compliance-clients.service.ts:311](../../backend/src/compliance-clients/compliance-clients.service.ts#L311); ComplianceClientsService.profileOverrides [backend/src/compliance-clients/compliance-clients.service.ts:300](../../backend/src/compliance-clients/compliance-clients.service.ts#L300); ComplianceClientsService.canView [backend/src/compliance-clients/compliance-clients.service.ts:1094](../../backend/src/compliance-clients/compliance-clients.service.ts#L1094); ComplianceClientsService.toListItem [backend/src/compliance-clients/compliance-clients.service.ts:1223](../../backend/src/compliance-clients/compliance-clients.service.ts#L1223); ComplianceClientsService.allocationList [backend/src/compliance-clients/compliance-clients.service.ts:235](../../backend/src/compliance-clients/compliance-clients.service.ts#L235); ComplianceClientsService.forAccess [backend/src/compliance-clients/compliance-clients.service.ts:224](../../backend/src/compliance-clients/compliance-clients.service.ts#L224); ComplianceClientsService.detailForAccess [backend/src/compliance-clients/compliance-clients.service.ts:192](../../backend/src/compliance-clients/compliance-clients.service.ts#L192).
- QA: apply Q-API for this ID and its workflow-specific cases; store status/body/DB diff with secrets removed.
- DTO field-access candidates: none resolved. These span reachable helpers and may include fields of internally composed DTOs; they are not a mandatory field list or complete wire schema. Match to the entry DTO and workflow before constructing requests.

## API-447EAA42

**PATCH /api/compliance/clients/:id** - ComplianceClientsController.update

- Entry/auth: AuthGuard('jwt'); RolesGuard; fallback roles: none declared; authenticated-only when JWT applies.
- Inputs: `@CurrentUser() user: RequestUser`; `@Param('id') id: string`; `@Body() dto: UpdateComplianceClientDto`.
- Output: JSON returned from delegated service; inferred fields in linked implementation. Inferred by TypeScript; no explicit response DTO.
- Behavior: Command (may mutate); detected reachable writes: client.update, auditLog.create.
- Tenant/role/state/validation helper candidates: tenantWhere.
- Error branch candidates: NotFoundException: 'Compliance client not found'); BadRequestException: 'The client name cannot be empty.'); BadRequestException: 'Enter a client code such as CL-2026-0001 (letters, digits and dashes).'); BadRequestException: 'Provide a reason when marking a client inactive.'); BadRequestException: 'Only inactive clients can be reactivated here. Clients on hold are released through their KYC engagement decision.'); BadRequestException: `Client code ${data.clientCode} is already used by ${taken.name}.`); ForbiddenException: 'User is not assigned to a tenant').
- Evidence: [backend/src/compliance-clients/compliance-clients.controller.ts:53](../../backend/src/compliance-clients/compliance-clients.controller.ts#L53).
- Logic chain: ComplianceClientsService.update [backend/src/compliance-clients/compliance-clients.service.ts:828](../../backend/src/compliance-clients/compliance-clients.service.ts#L828); ComplianceClientsService.tenantWhere [backend/src/compliance-clients/compliance-clients.service.ts:1284](../../backend/src/compliance-clients/compliance-clients.service.ts#L1284); ComplianceClientsService.optionalText [backend/src/compliance-clients/compliance-clients.service.ts:1279](../../backend/src/compliance-clients/compliance-clients.service.ts#L1279); ComplianceClientsService.findListItem [backend/src/compliance-clients/compliance-clients.service.ts:1150](../../backend/src/compliance-clients/compliance-clients.service.ts#L1150); ComplianceClientsService.toListItem [backend/src/compliance-clients/compliance-clients.service.ts:1223](../../backend/src/compliance-clients/compliance-clients.service.ts#L1223).
- QA: apply Q-API for this ID and its workflow-specific cases; store status/body/DB diff with secrets removed.
- DTO field-access candidates: address, cddType, clientCode, country, email, industry, jurisdiction, name, phone, registrationNumber, status, statusReason. These span reachable helpers and may include fields of internally composed DTOs; they are not a mandatory field list or complete wire schema. Match to the entry DTO and workflow before constructing requests.

## API-ED210531

**POST /api/compliance/clients/:id/allocations** - ComplianceClientsController.allocate

- Entry/auth: AuthGuard('jwt'); RolesGuard; fallback roles: none declared; authenticated-only when JWT applies.
- Inputs: `@CurrentUser() user: RequestUser`; `@Param('id') id: string`; `@Body() dto: AllocateStaffDto`.
- Output: JSON returned from delegated service; inferred fields in linked implementation. Inferred by TypeScript; no explicit response DTO.
- Behavior: Command (may mutate); detected reachable writes: clientAllocation.create, auditLog.create.
- Tenant/role/state/validation helper candidates: assertAllocationManager, tenantWhere.
- Error branch candidates: BadRequestException: 'Choose an active user of this company.'); BadRequestException: 'This user is already allocated to the client.'); ForbiddenException: 'Only Company Admin, AML Supervisor, DMLRO or MLRO allocate clients to staff.'); NotFoundException: 'Compliance client not found'); ForbiddenException: 'User is not assigned to a tenant').
- Evidence: [backend/src/compliance-clients/compliance-clients.controller.ts:120](../../backend/src/compliance-clients/compliance-clients.controller.ts#L120).
- Logic chain: ComplianceClientsService.allocate [backend/src/compliance-clients/compliance-clients.service.ts:265](../../backend/src/compliance-clients/compliance-clients.service.ts#L265); ComplianceClientsService.assertAllocationManager [backend/src/compliance-clients/compliance-clients.service.ts:243](../../backend/src/compliance-clients/compliance-clients.service.ts#L243); ComplianceClientsService.editableClient [backend/src/compliance-clients/compliance-clients.service.ts:332](../../backend/src/compliance-clients/compliance-clients.service.ts#L332); ComplianceClientsService.tenantWhere [backend/src/compliance-clients/compliance-clients.service.ts:1284](../../backend/src/compliance-clients/compliance-clients.service.ts#L1284); ComplianceClientsService.ensureRecords [backend/src/compliance-clients/compliance-clients.service.ts:311](../../backend/src/compliance-clients/compliance-clients.service.ts#L311); ComplianceClientsService.profileOverrides [backend/src/compliance-clients/compliance-clients.service.ts:300](../../backend/src/compliance-clients/compliance-clients.service.ts#L300); ComplianceClientsService.pickProfileCase [backend/src/compliance-clients/compliance-clients.service.ts:293](../../backend/src/compliance-clients/compliance-clients.service.ts#L293); ComplianceClientsService.recordAudit [backend/src/compliance-clients/compliance-clients.service.ts:353](../../backend/src/compliance-clients/compliance-clients.service.ts#L353); ComplianceClientsService.findOne [backend/src/compliance-clients/compliance-clients.service.ts:93](../../backend/src/compliance-clients/compliance-clients.service.ts#L93); ComplianceClientsService.canView [backend/src/compliance-clients/compliance-clients.service.ts:1094](../../backend/src/compliance-clients/compliance-clients.service.ts#L1094); ComplianceClientsService.toListItem [backend/src/compliance-clients/compliance-clients.service.ts:1223](../../backend/src/compliance-clients/compliance-clients.service.ts#L1223); ComplianceClientsService.allocationList [backend/src/compliance-clients/compliance-clients.service.ts:235](../../backend/src/compliance-clients/compliance-clients.service.ts#L235); ComplianceClientsService.forAccess [backend/src/compliance-clients/compliance-clients.service.ts:224](../../backend/src/compliance-clients/compliance-clients.service.ts#L224); ComplianceClientsService.detailForAccess [backend/src/compliance-clients/compliance-clients.service.ts:192](../../backend/src/compliance-clients/compliance-clients.service.ts#L192).
- QA: apply Q-API for this ID and its workflow-specific cases; store status/body/DB diff with secrets removed.
- DTO field-access candidates: none resolved. These span reachable helpers and may include fields of internally composed DTOs; they are not a mandatory field list or complete wire schema. Match to the entry DTO and workflow before constructing requests.

## API-3E5FDDBB

**POST /api/compliance/clients/:id/allocations/:allocationId/remove** - ComplianceClientsController.removeAllocation

- Entry/auth: AuthGuard('jwt'); RolesGuard; fallback roles: none declared; authenticated-only when JWT applies.
- Inputs: `@CurrentUser() user: RequestUser`; `@Param('id') id: string`; `@Param('allocationId') allocationId: string`.
- Output: JSON returned from delegated service; inferred fields in linked implementation. Inferred by TypeScript; no explicit response DTO.
- Behavior: Command (may mutate); detected reachable writes: clientAllocation.delete, auditLog.create.
- Tenant/role/state/validation helper candidates: assertAllocationManager, tenantWhere.
- Error branch candidates: NotFoundException: 'This allocation no longer exists. Refresh the page.'); ForbiddenException: 'Only Company Admin, AML Supervisor, DMLRO or MLRO allocate clients to staff.'); NotFoundException: 'Compliance client not found'); ForbiddenException: 'User is not assigned to a tenant').
- Evidence: [backend/src/compliance-clients/compliance-clients.controller.ts:125](../../backend/src/compliance-clients/compliance-clients.controller.ts#L125).
- Logic chain: ComplianceClientsService.removeAllocation [backend/src/compliance-clients/compliance-clients.service.ts:279](../../backend/src/compliance-clients/compliance-clients.service.ts#L279); ComplianceClientsService.assertAllocationManager [backend/src/compliance-clients/compliance-clients.service.ts:243](../../backend/src/compliance-clients/compliance-clients.service.ts#L243); ComplianceClientsService.editableClient [backend/src/compliance-clients/compliance-clients.service.ts:332](../../backend/src/compliance-clients/compliance-clients.service.ts#L332); ComplianceClientsService.tenantWhere [backend/src/compliance-clients/compliance-clients.service.ts:1284](../../backend/src/compliance-clients/compliance-clients.service.ts#L1284); ComplianceClientsService.ensureRecords [backend/src/compliance-clients/compliance-clients.service.ts:311](../../backend/src/compliance-clients/compliance-clients.service.ts#L311); ComplianceClientsService.profileOverrides [backend/src/compliance-clients/compliance-clients.service.ts:300](../../backend/src/compliance-clients/compliance-clients.service.ts#L300); ComplianceClientsService.pickProfileCase [backend/src/compliance-clients/compliance-clients.service.ts:293](../../backend/src/compliance-clients/compliance-clients.service.ts#L293); ComplianceClientsService.recordAudit [backend/src/compliance-clients/compliance-clients.service.ts:353](../../backend/src/compliance-clients/compliance-clients.service.ts#L353); ComplianceClientsService.findOne [backend/src/compliance-clients/compliance-clients.service.ts:93](../../backend/src/compliance-clients/compliance-clients.service.ts#L93); ComplianceClientsService.canView [backend/src/compliance-clients/compliance-clients.service.ts:1094](../../backend/src/compliance-clients/compliance-clients.service.ts#L1094); ComplianceClientsService.toListItem [backend/src/compliance-clients/compliance-clients.service.ts:1223](../../backend/src/compliance-clients/compliance-clients.service.ts#L1223); ComplianceClientsService.allocationList [backend/src/compliance-clients/compliance-clients.service.ts:235](../../backend/src/compliance-clients/compliance-clients.service.ts#L235); ComplianceClientsService.forAccess [backend/src/compliance-clients/compliance-clients.service.ts:224](../../backend/src/compliance-clients/compliance-clients.service.ts#L224); ComplianceClientsService.detailForAccess [backend/src/compliance-clients/compliance-clients.service.ts:192](../../backend/src/compliance-clients/compliance-clients.service.ts#L192).
- QA: apply Q-API for this ID and its workflow-specific cases; store status/body/DB diff with secrets removed.
- DTO field-access candidates: none resolved. These span reachable helpers and may include fields of internally composed DTOs; they are not a mandatory field list or complete wire schema. Match to the entry DTO and workflow before constructing requests.

## API-CA1F5A28

**GET /api/compliance/clients/:id/allocations/candidates** - ComplianceClientsController.allocationCandidates

- Entry/auth: AuthGuard('jwt'); RolesGuard; fallback roles: none declared; authenticated-only when JWT applies.
- Inputs: `@CurrentUser() user: RequestUser`; `@Param('id') id: string`.
- Output: JSON returned from delegated service; inferred fields in linked implementation. Inferred by TypeScript; no explicit response DTO.
- Behavior: Read candidate (static scan only); detected reachable writes: none detected.
- Tenant/role/state/validation helper candidates: assertAllocationManager, tenantWhere.
- Error branch candidates: ForbiddenException: 'Only Company Admin, AML Supervisor, DMLRO or MLRO allocate clients to staff.'); NotFoundException: 'Compliance client not found'); ForbiddenException: 'User is not assigned to a tenant').
- Evidence: [backend/src/compliance-clients/compliance-clients.controller.ts:115](../../backend/src/compliance-clients/compliance-clients.controller.ts#L115).
- Logic chain: ComplianceClientsService.allocationCandidates [backend/src/compliance-clients/compliance-clients.service.ts:250](../../backend/src/compliance-clients/compliance-clients.service.ts#L250); ComplianceClientsService.assertAllocationManager [backend/src/compliance-clients/compliance-clients.service.ts:243](../../backend/src/compliance-clients/compliance-clients.service.ts#L243); ComplianceClientsService.editableClient [backend/src/compliance-clients/compliance-clients.service.ts:332](../../backend/src/compliance-clients/compliance-clients.service.ts#L332); ComplianceClientsService.tenantWhere [backend/src/compliance-clients/compliance-clients.service.ts:1284](../../backend/src/compliance-clients/compliance-clients.service.ts#L1284); ComplianceClientsService.ensureRecords [backend/src/compliance-clients/compliance-clients.service.ts:311](../../backend/src/compliance-clients/compliance-clients.service.ts#L311); ComplianceClientsService.profileOverrides [backend/src/compliance-clients/compliance-clients.service.ts:300](../../backend/src/compliance-clients/compliance-clients.service.ts#L300); ComplianceClientsService.pickProfileCase [backend/src/compliance-clients/compliance-clients.service.ts:293](../../backend/src/compliance-clients/compliance-clients.service.ts#L293).
- QA: apply Q-API for this ID and its workflow-specific cases; store status/body/DB diff with secrets removed.
- DTO field-access candidates: none resolved. These span reachable helpers and may include fields of internally composed DTOs; they are not a mandatory field list or complete wire schema. Match to the entry DTO and workflow before constructing requests.

## API-B8D88BE6

**PATCH /api/compliance/clients/:id/entity** - ComplianceClientsController.updateEntityField

- Entry/auth: AuthGuard('jwt'); RolesGuard; fallback roles: none declared; authenticated-only when JWT applies.
- Inputs: `@CurrentUser() user: RequestUser`; `@Param('id') id: string`; `@Body() dto: UpdateRecordFieldDto`.
- Output: JSON returned from delegated service; inferred fields in linked implementation. Inferred by TypeScript; no explicit response DTO.
- Behavior: Command (may mutate); detected reachable writes: clientEntityProfile.update, auditLog.create.
- Tenant/role/state/validation helper candidates: tenantWhere.
- Error branch candidates: BadRequestException: 'This detail cannot be edited here.'); BadRequestException: 'The legal name cannot be empty.'); NotFoundException: 'Compliance client not found'); ForbiddenException: 'User is not assigned to a tenant'); BadRequestException: 'Choose Yes or No.'); BadRequestException: `Choose a title: ${PERSON_TITLES.join(', ')}.`); BadRequestException: 'Enter the date as YYYY-MM-DD.'); BadRequestException: 'Enter a valid email address.'); BadRequestException: 'Enter a percentage between 0 and 100.'); BadRequestException: 'This value is too long.').
- Evidence: [backend/src/compliance-clients/compliance-clients.controller.ts:60](../../backend/src/compliance-clients/compliance-clients.controller.ts#L60).
- Logic chain: ComplianceClientsService.updateEntityField [backend/src/compliance-clients/compliance-clients.service.ts:387](../../backend/src/compliance-clients/compliance-clients.service.ts#L387); ComplianceClientsService.editableClient [backend/src/compliance-clients/compliance-clients.service.ts:332](../../backend/src/compliance-clients/compliance-clients.service.ts#L332); ComplianceClientsService.tenantWhere [backend/src/compliance-clients/compliance-clients.service.ts:1284](../../backend/src/compliance-clients/compliance-clients.service.ts#L1284); ComplianceClientsService.ensureRecords [backend/src/compliance-clients/compliance-clients.service.ts:311](../../backend/src/compliance-clients/compliance-clients.service.ts#L311); ComplianceClientsService.profileOverrides [backend/src/compliance-clients/compliance-clients.service.ts:300](../../backend/src/compliance-clients/compliance-clients.service.ts#L300); ComplianceClientsService.pickProfileCase [backend/src/compliance-clients/compliance-clients.service.ts:293](../../backend/src/compliance-clients/compliance-clients.service.ts#L293); ComplianceClientsService.recordValue [backend/src/compliance-clients/compliance-clients.service.ts:360](../../backend/src/compliance-clients/compliance-clients.service.ts#L360); ComplianceClientsService.profileValue [backend/src/compliance-clients/compliance-clients.service.ts:785](../../backend/src/compliance-clients/compliance-clients.service.ts#L785); ComplianceClientsService.shownValue [backend/src/compliance-clients/compliance-clients.service.ts:379](../../backend/src/compliance-clients/compliance-clients.service.ts#L379); ComplianceClientsService.findOne [backend/src/compliance-clients/compliance-clients.service.ts:93](../../backend/src/compliance-clients/compliance-clients.service.ts#L93); ComplianceClientsService.canView [backend/src/compliance-clients/compliance-clients.service.ts:1094](../../backend/src/compliance-clients/compliance-clients.service.ts#L1094); ComplianceClientsService.toListItem [backend/src/compliance-clients/compliance-clients.service.ts:1223](../../backend/src/compliance-clients/compliance-clients.service.ts#L1223); ComplianceClientsService.allocationList [backend/src/compliance-clients/compliance-clients.service.ts:235](../../backend/src/compliance-clients/compliance-clients.service.ts#L235); ComplianceClientsService.forAccess [backend/src/compliance-clients/compliance-clients.service.ts:224](../../backend/src/compliance-clients/compliance-clients.service.ts#L224); ComplianceClientsService.detailForAccess [backend/src/compliance-clients/compliance-clients.service.ts:192](../../backend/src/compliance-clients/compliance-clients.service.ts#L192); ComplianceClientsService.recordAudit [backend/src/compliance-clients/compliance-clients.service.ts:353](../../backend/src/compliance-clients/compliance-clients.service.ts#L353).
- QA: apply Q-API for this ID and its workflow-specific cases; store status/body/DB diff with secrets removed.
- DTO field-access candidates: field, value. These span reachable helpers and may include fields of internally composed DTOs; they are not a mandatory field list or complete wire schema. Match to the entry DTO and workflow before constructing requests.

## API-182BA90B

**GET /api/compliance/clients/:id/expiry/export** - ComplianceClientsController.exportClientExpiry

- Entry/auth: AuthGuard('jwt'); RolesGuard; fallback roles: none declared; authenticated-only when JWT applies.
- Inputs: `@CurrentUser() user: RequestUser`; `@Param('id') id: string`; `@Query('window') window: string \| undefined`; `@Res() response: Response`.
- Output: Response.send binary/HTML; see controller MIME and Content-Disposition. Inferred by TypeScript; no explicit response DTO.
- Behavior: Read candidate (static scan only); detected reachable writes: none detected.
- Tenant/role/state/validation helper candidates: tenantWhere.
- Error branch candidates: NotFoundException: 'Compliance client not found'); ForbiddenException: 'User is not assigned to a tenant').
- Evidence: [backend/src/compliance-clients/compliance-clients.controller.ts:40](../../backend/src/compliance-clients/compliance-clients.controller.ts#L40).
- Logic chain: ComplianceClientsService.exportExpiry [backend/src/compliance-clients/compliance-clients.service.ts:1032](../../backend/src/compliance-clients/compliance-clients.service.ts#L1032); ComplianceClientsService.tenantWhere [backend/src/compliance-clients/compliance-clients.service.ts:1284](../../backend/src/compliance-clients/compliance-clients.service.ts#L1284).
- QA: apply Q-API for this ID and its workflow-specific cases; store status/body/DB diff with secrets removed.
- DTO field-access candidates: none resolved. These span reachable helpers and may include fields of internally composed DTOs; they are not a mandatory field list or complete wire schema. Match to the entry DTO and workflow before constructing requests.

## API-EA955808

**POST /api/compliance/clients/:id/identity-documents** - ClientIdentityDocumentsController.uploadIdentityDocument

- Entry/auth: AuthGuard('jwt'); LegalDocumentsAccessGuard; fallback roles: none declared; authenticated-only when JWT applies.
- Inputs: `@CurrentUser() user: RequestUser`; `@Param('id') id: string`; `@Body() body: UploadIdentityDocumentDto`; `@UploadedFiles() files: UploadedClientFile[]`.
- Output: JSON returned from delegated service; inferred fields in linked implementation. Inferred by TypeScript; no explicit response DTO.
- Behavior: Command (may mutate); detected reachable writes: clientPerson.update, auditLog.create, clientPersonPassport.updateMany, clientPersonPassport.update, clientPersonPassport.create.
- Tenant/role/state/validation helper candidates: tenantWhere.
- Error branch candidates: BadRequestException: 'Document uploads are not available.'); BadRequestException: 'Choose QID or passport.'); BadRequestException: 'Select one file: the copy of the QID or passport.'); BadRequestException: 'QID and passport copies apply to individuals.'); NotFoundException: 'This passport is no longer listed. Refresh the page.'); NotFoundException: 'Compliance client not found'); ForbiddenException: 'User is not assigned to a tenant'); NotFoundException: 'This person is no longer on the client profile. Refresh the page.'); BadRequestException: 'Enter the date as YYYY-MM-DD.'); BadRequestException: 'Enter a valid email address.'); BadRequestException: 'Enter a percentage between 0 and 100.'); BadRequestException: 'This value is too long.'); BadRequestException: 'This detail cannot be edited here.'); BadRequestException: 'QID, title, PEP and similar details apply to individuals. Use the CR number for a corporate party.'); BadRequestException: 'The name cannot be empty.'); BadRequestException: 'Choose Yes or No.'); BadRequestException: `Choose a title: ${PERSON_TITLES.join(', ')}.`); BadRequestException: 'Enter the passport number.'); BadRequestException: 'Passports apply to individuals.'); BadRequestException: 'This passport is already listed for the person.').
- Evidence: [backend/src/compliance-clients/client-identity-documents.controller.ts:21](../../backend/src/compliance-clients/client-identity-documents.controller.ts#L21).
- Logic chain: ComplianceClientsService.uploadIdentityDocument [backend/src/compliance-clients/compliance-clients.service.ts:630](../../backend/src/compliance-clients/compliance-clients.service.ts#L630); ComplianceClientsService.editableClient [backend/src/compliance-clients/compliance-clients.service.ts:332](../../backend/src/compliance-clients/compliance-clients.service.ts#L332); ComplianceClientsService.tenantWhere [backend/src/compliance-clients/compliance-clients.service.ts:1284](../../backend/src/compliance-clients/compliance-clients.service.ts#L1284); ComplianceClientsService.ensureRecords [backend/src/compliance-clients/compliance-clients.service.ts:311](../../backend/src/compliance-clients/compliance-clients.service.ts#L311); ComplianceClientsService.profileOverrides [backend/src/compliance-clients/compliance-clients.service.ts:300](../../backend/src/compliance-clients/compliance-clients.service.ts#L300); ComplianceClientsService.pickProfileCase [backend/src/compliance-clients/compliance-clients.service.ts:293](../../backend/src/compliance-clients/compliance-clients.service.ts#L293); ComplianceClientsService.personOf [backend/src/compliance-clients/compliance-clients.service.ts:345](../../backend/src/compliance-clients/compliance-clients.service.ts#L345); ComplianceClientsService.optionalText [backend/src/compliance-clients/compliance-clients.service.ts:1279](../../backend/src/compliance-clients/compliance-clients.service.ts#L1279); ComplianceClientsService.profileValue [backend/src/compliance-clients/compliance-clients.service.ts:785](../../backend/src/compliance-clients/compliance-clients.service.ts#L785); ComplianceClientsService.applyPersonField [backend/src/compliance-clients/compliance-clients.service.ts:414](../../backend/src/compliance-clients/compliance-clients.service.ts#L414); ComplianceClientsService.recordValue [backend/src/compliance-clients/compliance-clients.service.ts:360](../../backend/src/compliance-clients/compliance-clients.service.ts#L360); ComplianceClientsService.shownValue [backend/src/compliance-clients/compliance-clients.service.ts:379](../../backend/src/compliance-clients/compliance-clients.service.ts#L379); ComplianceClientsService.recordAudit [backend/src/compliance-clients/compliance-clients.service.ts:353](../../backend/src/compliance-clients/compliance-clients.service.ts#L353); ComplianceClientsService.applyPassportField [backend/src/compliance-clients/compliance-clients.service.ts:575](../../backend/src/compliance-clients/compliance-clients.service.ts#L575); ComplianceClientsService.createPassport [backend/src/compliance-clients/compliance-clients.service.ts:547](../../backend/src/compliance-clients/compliance-clients.service.ts#L547); ComplianceClientsService.findOne [backend/src/compliance-clients/compliance-clients.service.ts:93](../../backend/src/compliance-clients/compliance-clients.service.ts#L93); ComplianceClientsService.canView [backend/src/compliance-clients/compliance-clients.service.ts:1094](../../backend/src/compliance-clients/compliance-clients.service.ts#L1094); ComplianceClientsService.toListItem [backend/src/compliance-clients/compliance-clients.service.ts:1223](../../backend/src/compliance-clients/compliance-clients.service.ts#L1223); ComplianceClientsService.allocationList [backend/src/compliance-clients/compliance-clients.service.ts:235](../../backend/src/compliance-clients/compliance-clients.service.ts#L235); ComplianceClientsService.forAccess [backend/src/compliance-clients/compliance-clients.service.ts:224](../../backend/src/compliance-clients/compliance-clients.service.ts#L224); ComplianceClientsService.detailForAccess [backend/src/compliance-clients/compliance-clients.service.ts:192](../../backend/src/compliance-clients/compliance-clients.service.ts#L192).
- QA: apply Q-API for this ID and its workflow-specific cases; store status/body/DB diff with secrets removed.
- DTO field-access candidates: expiryDate, issuingCountry, passportNumber. These span reachable helpers and may include fields of internally composed DTOs; they are not a mandatory field list or complete wire schema. Match to the entry DTO and workflow before constructing requests.

## API-5E9698D8

**POST /api/compliance/clients/:id/identity-documents/from-kyc** - ClientIdentityDocumentsController.linkKycIdentityDocument

- Entry/auth: AuthGuard('jwt'); LegalDocumentsAccessGuard; fallback roles: none declared; authenticated-only when JWT applies.
- Inputs: `@CurrentUser() user: RequestUser`; `@Param('id') id: string`; `@Body() dto: LinkKycIdentityDocumentDto`.
- Output: JSON returned from delegated service; inferred fields in linked implementation. Inferred by TypeScript; no explicit response DTO.
- Behavior: Command (may mutate); detected reachable writes: clientPerson.update, auditLog.create, clientPersonPassport.updateMany, clientPersonPassport.update, clientPersonPassport.create.
- Tenant/role/state/validation helper candidates: tenantWhere.
- Error branch candidates: BadRequestException: 'KYC documents are not available.'); NotFoundException: 'Compliance client not found'); NotFoundException: 'KYC document not found for this client.'); ForbiddenException: 'User is not assigned to a tenant'); BadRequestException: 'Document uploads are not available.'); BadRequestException: 'Choose QID or passport.'); BadRequestException: 'Select one file: the copy of the QID or passport.'); BadRequestException: 'QID and passport copies apply to individuals.'); NotFoundException: 'This passport is no longer listed. Refresh the page.'); NotFoundException: 'This person is no longer on the client profile. Refresh the page.'); BadRequestException: 'Enter the date as YYYY-MM-DD.'); BadRequestException: 'Enter a valid email address.'); BadRequestException: 'Enter a percentage between 0 and 100.'); BadRequestException: 'This value is too long.'); BadRequestException: 'This detail cannot be edited here.'); BadRequestException: 'QID, title, PEP and similar details apply to individuals. Use the CR number for a corporate party.'); BadRequestException: 'The name cannot be empty.'); BadRequestException: 'Choose Yes or No.'); BadRequestException: `Choose a title: ${PERSON_TITLES.join(', ')}.`); BadRequestException: 'Enter the passport number.'); BadRequestException: 'Passports apply to individuals.'); BadRequestException: 'This passport is already listed for the person.').
- Evidence: [backend/src/compliance-clients/client-identity-documents.controller.ts:40](../../backend/src/compliance-clients/client-identity-documents.controller.ts#L40).
- Logic chain: ComplianceClientsService.linkKycIdentityDocument [backend/src/compliance-clients/compliance-clients.service.ts:679](../../backend/src/compliance-clients/compliance-clients.service.ts#L679); ComplianceClientsService.tenantWhere [backend/src/compliance-clients/compliance-clients.service.ts:1284](../../backend/src/compliance-clients/compliance-clients.service.ts#L1284); ComplianceClientsService.optionalText [backend/src/compliance-clients/compliance-clients.service.ts:1279](../../backend/src/compliance-clients/compliance-clients.service.ts#L1279); ComplianceClientsService.readSafely [backend/src/compliance-clients/compliance-clients.service.ts:751](../../backend/src/compliance-clients/compliance-clients.service.ts#L751); ComplianceClientsService.typeMatches [backend/src/compliance-clients/compliance-clients.service.ts:762](../../backend/src/compliance-clients/compliance-clients.service.ts#L762); ComplianceClientsService.uploadIdentityDocument [backend/src/compliance-clients/compliance-clients.service.ts:630](../../backend/src/compliance-clients/compliance-clients.service.ts#L630); ComplianceClientsService.editableClient [backend/src/compliance-clients/compliance-clients.service.ts:332](../../backend/src/compliance-clients/compliance-clients.service.ts#L332); ComplianceClientsService.ensureRecords [backend/src/compliance-clients/compliance-clients.service.ts:311](../../backend/src/compliance-clients/compliance-clients.service.ts#L311); ComplianceClientsService.profileOverrides [backend/src/compliance-clients/compliance-clients.service.ts:300](../../backend/src/compliance-clients/compliance-clients.service.ts#L300); ComplianceClientsService.pickProfileCase [backend/src/compliance-clients/compliance-clients.service.ts:293](../../backend/src/compliance-clients/compliance-clients.service.ts#L293); ComplianceClientsService.personOf [backend/src/compliance-clients/compliance-clients.service.ts:345](../../backend/src/compliance-clients/compliance-clients.service.ts#L345); ComplianceClientsService.profileValue [backend/src/compliance-clients/compliance-clients.service.ts:785](../../backend/src/compliance-clients/compliance-clients.service.ts#L785); ComplianceClientsService.applyPersonField [backend/src/compliance-clients/compliance-clients.service.ts:414](../../backend/src/compliance-clients/compliance-clients.service.ts#L414); ComplianceClientsService.recordValue [backend/src/compliance-clients/compliance-clients.service.ts:360](../../backend/src/compliance-clients/compliance-clients.service.ts#L360); ComplianceClientsService.shownValue [backend/src/compliance-clients/compliance-clients.service.ts:379](../../backend/src/compliance-clients/compliance-clients.service.ts#L379); ComplianceClientsService.recordAudit [backend/src/compliance-clients/compliance-clients.service.ts:353](../../backend/src/compliance-clients/compliance-clients.service.ts#L353); ComplianceClientsService.applyPassportField [backend/src/compliance-clients/compliance-clients.service.ts:575](../../backend/src/compliance-clients/compliance-clients.service.ts#L575); ComplianceClientsService.createPassport [backend/src/compliance-clients/compliance-clients.service.ts:547](../../backend/src/compliance-clients/compliance-clients.service.ts#L547); ComplianceClientsService.findOne [backend/src/compliance-clients/compliance-clients.service.ts:93](../../backend/src/compliance-clients/compliance-clients.service.ts#L93); ComplianceClientsService.canView [backend/src/compliance-clients/compliance-clients.service.ts:1094](../../backend/src/compliance-clients/compliance-clients.service.ts#L1094); ComplianceClientsService.toListItem [backend/src/compliance-clients/compliance-clients.service.ts:1223](../../backend/src/compliance-clients/compliance-clients.service.ts#L1223); ComplianceClientsService.allocationList [backend/src/compliance-clients/compliance-clients.service.ts:235](../../backend/src/compliance-clients/compliance-clients.service.ts#L235); ComplianceClientsService.forAccess [backend/src/compliance-clients/compliance-clients.service.ts:224](../../backend/src/compliance-clients/compliance-clients.service.ts#L224); ComplianceClientsService.detailForAccess [backend/src/compliance-clients/compliance-clients.service.ts:192](../../backend/src/compliance-clients/compliance-clients.service.ts#L192).
- QA: apply Q-API for this ID and its workflow-specific cases; store status/body/DB diff with secrets removed.
- DTO field-access candidates: expiryDate, issuingCountry, passportNumber. These span reachable helpers and may include fields of internally composed DTOs; they are not a mandatory field list or complete wire schema. Match to the entry DTO and workflow before constructing requests.

## API-14F71EF3

**POST /api/compliance/clients/:id/identity-documents/read** - ClientIdentityDocumentsController.readIdentityDocument

- Entry/auth: AuthGuard('jwt'); LegalDocumentsAccessGuard; fallback roles: none declared; authenticated-only when JWT applies.
- Inputs: `@CurrentUser() user: RequestUser`; `@Param('id') id: string`; `@Body() dto: ReadIdentityDocumentDto`; `@UploadedFiles() files: UploadedClientFile[]`.
- Output: JSON returned from delegated service; inferred fields in linked implementation. Inferred by TypeScript; no explicit response DTO.
- Behavior: Command (may mutate); detected reachable writes: none detected.
- Tenant/role/state/validation helper candidates: tenantWhere.
- Error branch candidates: NotFoundException: 'Compliance client not found'); BadRequestException: 'Select one file to read.'); ForbiddenException: 'User is not assigned to a tenant').
- Evidence: [backend/src/compliance-clients/client-identity-documents.controller.ts:33](../../backend/src/compliance-clients/client-identity-documents.controller.ts#L33).
- Logic chain: ComplianceClientsService.readIdentityDocument [backend/src/compliance-clients/compliance-clients.service.ts:708](../../backend/src/compliance-clients/compliance-clients.service.ts#L708); ComplianceClientsService.tenantWhere [backend/src/compliance-clients/compliance-clients.service.ts:1284](../../backend/src/compliance-clients/compliance-clients.service.ts#L1284); ComplianceClientsService.readSafely [backend/src/compliance-clients/compliance-clients.service.ts:751](../../backend/src/compliance-clients/compliance-clients.service.ts#L751); ComplianceClientsService.typeMatches [backend/src/compliance-clients/compliance-clients.service.ts:762](../../backend/src/compliance-clients/compliance-clients.service.ts#L762).
- QA: apply Q-API for this ID and its workflow-specific cases; store status/body/DB diff with secrets removed.
- DTO field-access candidates: none resolved. These span reachable helpers and may include fields of internally composed DTOs; they are not a mandatory field list or complete wire schema. Match to the entry DTO and workflow before constructing requests.

## API-26BEC7B1

**POST /api/compliance/clients/:id/people** - ComplianceClientsController.addPerson

- Entry/auth: AuthGuard('jwt'); RolesGuard; fallback roles: none declared; authenticated-only when JWT applies.
- Inputs: `@CurrentUser() user: RequestUser`; `@Param('id') id: string`; `@Body() dto: CreatePersonDto`.
- Output: JSON returned from delegated service; inferred fields in linked implementation. Inferred by TypeScript; no explicit response DTO.
- Behavior: Command (may mutate); detected reachable writes: clientPerson.create, auditLog.create.
- Tenant/role/state/validation helper candidates: tenantWhere, enumValue.
- Error branch candidates: BadRequestException: 'Enter the name.'); BadRequestException: `${fullName} is already on this client. Add the role to that person instead, so the same person is linked on every tab.`); NotFoundException: 'Compliance client not found'); ForbiddenException: 'User is not assigned to a tenant'); BadRequestException: `Invalid ${label} filter.`); BadRequestException: `A company can be ${CORPORATE_ROLES.map((item) => ROLE_LABELS[item]).join(', ')}. ${ROLE_LABELS[role]} applies to individuals.`); BadRequestException: 'Enter the position for "Other".'); BadRequestException: 'Enter the date as YYYY-MM-DD.'); BadRequestException: 'Enter a valid email address.'); BadRequestException: 'Enter a percentage between 0 and 100.'); BadRequestException: 'This value is too long.').
- Evidence: [backend/src/compliance-clients/compliance-clients.controller.ts:65](../../backend/src/compliance-clients/compliance-clients.controller.ts#L65).
- Logic chain: ComplianceClientsService.addPerson [backend/src/compliance-clients/compliance-clients.service.ts:455](../../backend/src/compliance-clients/compliance-clients.service.ts#L455); ComplianceClientsService.editableClient [backend/src/compliance-clients/compliance-clients.service.ts:332](../../backend/src/compliance-clients/compliance-clients.service.ts#L332); ComplianceClientsService.tenantWhere [backend/src/compliance-clients/compliance-clients.service.ts:1284](../../backend/src/compliance-clients/compliance-clients.service.ts#L1284); ComplianceClientsService.ensureRecords [backend/src/compliance-clients/compliance-clients.service.ts:311](../../backend/src/compliance-clients/compliance-clients.service.ts#L311); ComplianceClientsService.profileOverrides [backend/src/compliance-clients/compliance-clients.service.ts:300](../../backend/src/compliance-clients/compliance-clients.service.ts#L300); ComplianceClientsService.pickProfileCase [backend/src/compliance-clients/compliance-clients.service.ts:293](../../backend/src/compliance-clients/compliance-clients.service.ts#L293); ComplianceClientsService.optionalText [backend/src/compliance-clients/compliance-clients.service.ts:1279](../../backend/src/compliance-clients/compliance-clients.service.ts#L1279); ComplianceClientsService.enumValue [backend/src/compliance-clients/compliance-clients.service.ts:1268](../../backend/src/compliance-clients/compliance-clients.service.ts#L1268); ComplianceClientsService.roleInput [backend/src/compliance-clients/compliance-clients.service.ts:435](../../backend/src/compliance-clients/compliance-clients.service.ts#L435); ComplianceClientsService.profileValue [backend/src/compliance-clients/compliance-clients.service.ts:785](../../backend/src/compliance-clients/compliance-clients.service.ts#L785); ComplianceClientsService.recordAudit [backend/src/compliance-clients/compliance-clients.service.ts:353](../../backend/src/compliance-clients/compliance-clients.service.ts#L353); ComplianceClientsService.findOne [backend/src/compliance-clients/compliance-clients.service.ts:93](../../backend/src/compliance-clients/compliance-clients.service.ts#L93); ComplianceClientsService.canView [backend/src/compliance-clients/compliance-clients.service.ts:1094](../../backend/src/compliance-clients/compliance-clients.service.ts#L1094); ComplianceClientsService.toListItem [backend/src/compliance-clients/compliance-clients.service.ts:1223](../../backend/src/compliance-clients/compliance-clients.service.ts#L1223); ComplianceClientsService.allocationList [backend/src/compliance-clients/compliance-clients.service.ts:235](../../backend/src/compliance-clients/compliance-clients.service.ts#L235); ComplianceClientsService.forAccess [backend/src/compliance-clients/compliance-clients.service.ts:224](../../backend/src/compliance-clients/compliance-clients.service.ts#L224); ComplianceClientsService.detailForAccess [backend/src/compliance-clients/compliance-clients.service.ts:192](../../backend/src/compliance-clients/compliance-clients.service.ts#L192).
- QA: apply Q-API for this ID and its workflow-specific cases; store status/body/DB diff with secrets removed.
- DTO field-access candidates: fullName, partyType, role. These span reachable helpers and may include fields of internally composed DTOs; they are not a mandatory field list or complete wire schema. Match to the entry DTO and workflow before constructing requests.

## API-E9B4137B

**PATCH /api/compliance/clients/:id/people/:personId** - ComplianceClientsController.updatePersonField

- Entry/auth: AuthGuard('jwt'); RolesGuard; fallback roles: none declared; authenticated-only when JWT applies.
- Inputs: `@CurrentUser() user: RequestUser`; `@Param('id') id: string`; `@Param('personId') personId: string`; `@Body() dto: UpdateRecordFieldDto`.
- Output: JSON returned from delegated service; inferred fields in linked implementation. Inferred by TypeScript; no explicit response DTO.
- Behavior: Command (may mutate); detected reachable writes: clientPerson.update, auditLog.create.
- Tenant/role/state/validation helper candidates: tenantWhere.
- Error branch candidates: NotFoundException: 'Compliance client not found'); ForbiddenException: 'User is not assigned to a tenant'); BadRequestException: 'This detail cannot be edited here.'); BadRequestException: 'QID, title, PEP and similar details apply to individuals. Use the CR number for a corporate party.'); BadRequestException: 'The name cannot be empty.'); NotFoundException: 'This person is no longer on the client profile. Refresh the page.'); BadRequestException: 'Choose Yes or No.'); BadRequestException: `Choose a title: ${PERSON_TITLES.join(', ')}.`); BadRequestException: 'Enter the date as YYYY-MM-DD.'); BadRequestException: 'Enter a valid email address.'); BadRequestException: 'Enter a percentage between 0 and 100.'); BadRequestException: 'This value is too long.').
- Evidence: [backend/src/compliance-clients/compliance-clients.controller.ts:70](../../backend/src/compliance-clients/compliance-clients.controller.ts#L70).
- Logic chain: ComplianceClientsService.updatePersonField [backend/src/compliance-clients/compliance-clients.service.ts:408](../../backend/src/compliance-clients/compliance-clients.service.ts#L408); ComplianceClientsService.editableClient [backend/src/compliance-clients/compliance-clients.service.ts:332](../../backend/src/compliance-clients/compliance-clients.service.ts#L332); ComplianceClientsService.tenantWhere [backend/src/compliance-clients/compliance-clients.service.ts:1284](../../backend/src/compliance-clients/compliance-clients.service.ts#L1284); ComplianceClientsService.ensureRecords [backend/src/compliance-clients/compliance-clients.service.ts:311](../../backend/src/compliance-clients/compliance-clients.service.ts#L311); ComplianceClientsService.profileOverrides [backend/src/compliance-clients/compliance-clients.service.ts:300](../../backend/src/compliance-clients/compliance-clients.service.ts#L300); ComplianceClientsService.pickProfileCase [backend/src/compliance-clients/compliance-clients.service.ts:293](../../backend/src/compliance-clients/compliance-clients.service.ts#L293); ComplianceClientsService.applyPersonField [backend/src/compliance-clients/compliance-clients.service.ts:414](../../backend/src/compliance-clients/compliance-clients.service.ts#L414); ComplianceClientsService.personOf [backend/src/compliance-clients/compliance-clients.service.ts:345](../../backend/src/compliance-clients/compliance-clients.service.ts#L345); ComplianceClientsService.recordValue [backend/src/compliance-clients/compliance-clients.service.ts:360](../../backend/src/compliance-clients/compliance-clients.service.ts#L360); ComplianceClientsService.profileValue [backend/src/compliance-clients/compliance-clients.service.ts:785](../../backend/src/compliance-clients/compliance-clients.service.ts#L785); ComplianceClientsService.shownValue [backend/src/compliance-clients/compliance-clients.service.ts:379](../../backend/src/compliance-clients/compliance-clients.service.ts#L379); ComplianceClientsService.recordAudit [backend/src/compliance-clients/compliance-clients.service.ts:353](../../backend/src/compliance-clients/compliance-clients.service.ts#L353); ComplianceClientsService.findOne [backend/src/compliance-clients/compliance-clients.service.ts:93](../../backend/src/compliance-clients/compliance-clients.service.ts#L93); ComplianceClientsService.canView [backend/src/compliance-clients/compliance-clients.service.ts:1094](../../backend/src/compliance-clients/compliance-clients.service.ts#L1094); ComplianceClientsService.toListItem [backend/src/compliance-clients/compliance-clients.service.ts:1223](../../backend/src/compliance-clients/compliance-clients.service.ts#L1223); ComplianceClientsService.allocationList [backend/src/compliance-clients/compliance-clients.service.ts:235](../../backend/src/compliance-clients/compliance-clients.service.ts#L235); ComplianceClientsService.forAccess [backend/src/compliance-clients/compliance-clients.service.ts:224](../../backend/src/compliance-clients/compliance-clients.service.ts#L224); ComplianceClientsService.detailForAccess [backend/src/compliance-clients/compliance-clients.service.ts:192](../../backend/src/compliance-clients/compliance-clients.service.ts#L192).
- QA: apply Q-API for this ID and its workflow-specific cases; store status/body/DB diff with secrets removed.
- DTO field-access candidates: field, value. These span reachable helpers and may include fields of internally composed DTOs; they are not a mandatory field list or complete wire schema. Match to the entry DTO and workflow before constructing requests.

## API-5B2B2CC6

**POST /api/compliance/clients/:id/people/:personId/passports** - ComplianceClientsController.addPassport

- Entry/auth: AuthGuard('jwt'); RolesGuard; fallback roles: none declared; authenticated-only when JWT applies.
- Inputs: `@CurrentUser() user: RequestUser`; `@Param('id') id: string`; `@Param('personId') personId: string`; `@Body() dto: PassportDto`.
- Output: JSON returned from delegated service; inferred fields in linked implementation. Inferred by TypeScript; no explicit response DTO.
- Behavior: Command (may mutate); detected reachable writes: clientPersonPassport.create, auditLog.create.
- Tenant/role/state/validation helper candidates: tenantWhere.
- Error branch candidates: NotFoundException: 'Compliance client not found'); ForbiddenException: 'User is not assigned to a tenant'); BadRequestException: 'Passports apply to individuals.'); BadRequestException: 'Enter the passport number.'); BadRequestException: 'This passport is already listed for the person.'); NotFoundException: 'This person is no longer on the client profile. Refresh the page.'); BadRequestException: 'Enter the date as YYYY-MM-DD.'); BadRequestException: 'Enter a valid email address.'); BadRequestException: 'Enter a percentage between 0 and 100.'); BadRequestException: 'This value is too long.').
- Evidence: [backend/src/compliance-clients/compliance-clients.controller.ts:95](../../backend/src/compliance-clients/compliance-clients.controller.ts#L95).
- Logic chain: ComplianceClientsService.addPassport [backend/src/compliance-clients/compliance-clients.service.ts:541](../../backend/src/compliance-clients/compliance-clients.service.ts#L541); ComplianceClientsService.editableClient [backend/src/compliance-clients/compliance-clients.service.ts:332](../../backend/src/compliance-clients/compliance-clients.service.ts#L332); ComplianceClientsService.tenantWhere [backend/src/compliance-clients/compliance-clients.service.ts:1284](../../backend/src/compliance-clients/compliance-clients.service.ts#L1284); ComplianceClientsService.ensureRecords [backend/src/compliance-clients/compliance-clients.service.ts:311](../../backend/src/compliance-clients/compliance-clients.service.ts#L311); ComplianceClientsService.profileOverrides [backend/src/compliance-clients/compliance-clients.service.ts:300](../../backend/src/compliance-clients/compliance-clients.service.ts#L300); ComplianceClientsService.pickProfileCase [backend/src/compliance-clients/compliance-clients.service.ts:293](../../backend/src/compliance-clients/compliance-clients.service.ts#L293); ComplianceClientsService.createPassport [backend/src/compliance-clients/compliance-clients.service.ts:547](../../backend/src/compliance-clients/compliance-clients.service.ts#L547); ComplianceClientsService.personOf [backend/src/compliance-clients/compliance-clients.service.ts:345](../../backend/src/compliance-clients/compliance-clients.service.ts#L345); ComplianceClientsService.optionalText [backend/src/compliance-clients/compliance-clients.service.ts:1279](../../backend/src/compliance-clients/compliance-clients.service.ts#L1279); ComplianceClientsService.profileValue [backend/src/compliance-clients/compliance-clients.service.ts:785](../../backend/src/compliance-clients/compliance-clients.service.ts#L785); ComplianceClientsService.recordAudit [backend/src/compliance-clients/compliance-clients.service.ts:353](../../backend/src/compliance-clients/compliance-clients.service.ts#L353); ComplianceClientsService.findOne [backend/src/compliance-clients/compliance-clients.service.ts:93](../../backend/src/compliance-clients/compliance-clients.service.ts#L93); ComplianceClientsService.canView [backend/src/compliance-clients/compliance-clients.service.ts:1094](../../backend/src/compliance-clients/compliance-clients.service.ts#L1094); ComplianceClientsService.toListItem [backend/src/compliance-clients/compliance-clients.service.ts:1223](../../backend/src/compliance-clients/compliance-clients.service.ts#L1223); ComplianceClientsService.allocationList [backend/src/compliance-clients/compliance-clients.service.ts:235](../../backend/src/compliance-clients/compliance-clients.service.ts#L235); ComplianceClientsService.forAccess [backend/src/compliance-clients/compliance-clients.service.ts:224](../../backend/src/compliance-clients/compliance-clients.service.ts#L224); ComplianceClientsService.detailForAccess [backend/src/compliance-clients/compliance-clients.service.ts:192](../../backend/src/compliance-clients/compliance-clients.service.ts#L192).
- QA: apply Q-API for this ID and its workflow-specific cases; store status/body/DB diff with secrets removed.
- DTO field-access candidates: expiryDate, issuingCountry, passportNumber. These span reachable helpers and may include fields of internally composed DTOs; they are not a mandatory field list or complete wire schema. Match to the entry DTO and workflow before constructing requests.

## API-5D294F92

**PATCH /api/compliance/clients/:id/people/:personId/passports/:passportId** - ComplianceClientsController.updatePassport

- Entry/auth: AuthGuard('jwt'); RolesGuard; fallback roles: none declared; authenticated-only when JWT applies.
- Inputs: `@CurrentUser() user: RequestUser`; `@Param('id') id: string`; `@Param('personId') personId: string`; `@Param('passportId') passportId: string`; `@Body() dto: UpdateRecordFieldDto`.
- Output: JSON returned from delegated service; inferred fields in linked implementation. Inferred by TypeScript; no explicit response DTO.
- Behavior: Command (may mutate); detected reachable writes: clientPersonPassport.updateMany, clientPersonPassport.update, clientPerson.update, auditLog.create.
- Tenant/role/state/validation helper candidates: tenantWhere.
- Error branch candidates: NotFoundException: 'Compliance client not found'); ForbiddenException: 'User is not assigned to a tenant'); NotFoundException: 'This passport is no longer listed. Refresh the page.'); BadRequestException: 'Enter the passport number.'); BadRequestException: 'This detail cannot be edited here.'); NotFoundException: 'This person is no longer on the client profile. Refresh the page.'); BadRequestException: 'Enter the date as YYYY-MM-DD.'); BadRequestException: 'Enter a valid email address.'); BadRequestException: 'Enter a percentage between 0 and 100.'); BadRequestException: 'This value is too long.').
- Evidence: [backend/src/compliance-clients/compliance-clients.controller.ts:100](../../backend/src/compliance-clients/compliance-clients.controller.ts#L100).
- Logic chain: ComplianceClientsService.updatePassport [backend/src/compliance-clients/compliance-clients.service.ts:569](../../backend/src/compliance-clients/compliance-clients.service.ts#L569); ComplianceClientsService.editableClient [backend/src/compliance-clients/compliance-clients.service.ts:332](../../backend/src/compliance-clients/compliance-clients.service.ts#L332); ComplianceClientsService.tenantWhere [backend/src/compliance-clients/compliance-clients.service.ts:1284](../../backend/src/compliance-clients/compliance-clients.service.ts#L1284); ComplianceClientsService.ensureRecords [backend/src/compliance-clients/compliance-clients.service.ts:311](../../backend/src/compliance-clients/compliance-clients.service.ts#L311); ComplianceClientsService.profileOverrides [backend/src/compliance-clients/compliance-clients.service.ts:300](../../backend/src/compliance-clients/compliance-clients.service.ts#L300); ComplianceClientsService.pickProfileCase [backend/src/compliance-clients/compliance-clients.service.ts:293](../../backend/src/compliance-clients/compliance-clients.service.ts#L293); ComplianceClientsService.applyPassportField [backend/src/compliance-clients/compliance-clients.service.ts:575](../../backend/src/compliance-clients/compliance-clients.service.ts#L575); ComplianceClientsService.personOf [backend/src/compliance-clients/compliance-clients.service.ts:345](../../backend/src/compliance-clients/compliance-clients.service.ts#L345); ComplianceClientsService.optionalText [backend/src/compliance-clients/compliance-clients.service.ts:1279](../../backend/src/compliance-clients/compliance-clients.service.ts#L1279); ComplianceClientsService.profileValue [backend/src/compliance-clients/compliance-clients.service.ts:785](../../backend/src/compliance-clients/compliance-clients.service.ts#L785); ComplianceClientsService.recordAudit [backend/src/compliance-clients/compliance-clients.service.ts:353](../../backend/src/compliance-clients/compliance-clients.service.ts#L353); ComplianceClientsService.findOne [backend/src/compliance-clients/compliance-clients.service.ts:93](../../backend/src/compliance-clients/compliance-clients.service.ts#L93); ComplianceClientsService.canView [backend/src/compliance-clients/compliance-clients.service.ts:1094](../../backend/src/compliance-clients/compliance-clients.service.ts#L1094); ComplianceClientsService.toListItem [backend/src/compliance-clients/compliance-clients.service.ts:1223](../../backend/src/compliance-clients/compliance-clients.service.ts#L1223); ComplianceClientsService.allocationList [backend/src/compliance-clients/compliance-clients.service.ts:235](../../backend/src/compliance-clients/compliance-clients.service.ts#L235); ComplianceClientsService.forAccess [backend/src/compliance-clients/compliance-clients.service.ts:224](../../backend/src/compliance-clients/compliance-clients.service.ts#L224); ComplianceClientsService.detailForAccess [backend/src/compliance-clients/compliance-clients.service.ts:192](../../backend/src/compliance-clients/compliance-clients.service.ts#L192).
- QA: apply Q-API for this ID and its workflow-specific cases; store status/body/DB diff with secrets removed.
- DTO field-access candidates: field, value. These span reachable helpers and may include fields of internally composed DTOs; they are not a mandatory field list or complete wire schema. Match to the entry DTO and workflow before constructing requests.

## API-96FAFA9D

**POST /api/compliance/clients/:id/people/:personId/passports/:passportId/remove** - ComplianceClientsController.removePassport

- Entry/auth: AuthGuard('jwt'); RolesGuard; fallback roles: none declared; authenticated-only when JWT applies.
- Inputs: `@CurrentUser() user: RequestUser`; `@Param('id') id: string`; `@Param('personId') personId: string`; `@Param('passportId') passportId: string`; `@Body() dto: RemoveRecordDto`.
- Output: JSON returned from delegated service; inferred fields in linked implementation. Inferred by TypeScript; no explicit response DTO.
- Behavior: Command (may mutate); detected reachable writes: clientPersonPassport.delete, clientPersonPassport.update, auditLog.create.
- Tenant/role/state/validation helper candidates: tenantWhere.
- Error branch candidates: NotFoundException: 'This passport is no longer listed. Refresh the page.'); NotFoundException: 'Compliance client not found'); ForbiddenException: 'User is not assigned to a tenant'); NotFoundException: 'This person is no longer on the client profile. Refresh the page.').
- Evidence: [backend/src/compliance-clients/compliance-clients.controller.ts:107](../../backend/src/compliance-clients/compliance-clients.controller.ts#L107).
- Logic chain: ComplianceClientsService.removePassport [backend/src/compliance-clients/compliance-clients.service.ts:608](../../backend/src/compliance-clients/compliance-clients.service.ts#L608); ComplianceClientsService.editableClient [backend/src/compliance-clients/compliance-clients.service.ts:332](../../backend/src/compliance-clients/compliance-clients.service.ts#L332); ComplianceClientsService.tenantWhere [backend/src/compliance-clients/compliance-clients.service.ts:1284](../../backend/src/compliance-clients/compliance-clients.service.ts#L1284); ComplianceClientsService.ensureRecords [backend/src/compliance-clients/compliance-clients.service.ts:311](../../backend/src/compliance-clients/compliance-clients.service.ts#L311); ComplianceClientsService.profileOverrides [backend/src/compliance-clients/compliance-clients.service.ts:300](../../backend/src/compliance-clients/compliance-clients.service.ts#L300); ComplianceClientsService.pickProfileCase [backend/src/compliance-clients/compliance-clients.service.ts:293](../../backend/src/compliance-clients/compliance-clients.service.ts#L293); ComplianceClientsService.personOf [backend/src/compliance-clients/compliance-clients.service.ts:345](../../backend/src/compliance-clients/compliance-clients.service.ts#L345); ComplianceClientsService.recordAudit [backend/src/compliance-clients/compliance-clients.service.ts:353](../../backend/src/compliance-clients/compliance-clients.service.ts#L353); ComplianceClientsService.optionalText [backend/src/compliance-clients/compliance-clients.service.ts:1279](../../backend/src/compliance-clients/compliance-clients.service.ts#L1279); ComplianceClientsService.findOne [backend/src/compliance-clients/compliance-clients.service.ts:93](../../backend/src/compliance-clients/compliance-clients.service.ts#L93); ComplianceClientsService.canView [backend/src/compliance-clients/compliance-clients.service.ts:1094](../../backend/src/compliance-clients/compliance-clients.service.ts#L1094); ComplianceClientsService.toListItem [backend/src/compliance-clients/compliance-clients.service.ts:1223](../../backend/src/compliance-clients/compliance-clients.service.ts#L1223); ComplianceClientsService.allocationList [backend/src/compliance-clients/compliance-clients.service.ts:235](../../backend/src/compliance-clients/compliance-clients.service.ts#L235); ComplianceClientsService.forAccess [backend/src/compliance-clients/compliance-clients.service.ts:224](../../backend/src/compliance-clients/compliance-clients.service.ts#L224); ComplianceClientsService.detailForAccess [backend/src/compliance-clients/compliance-clients.service.ts:192](../../backend/src/compliance-clients/compliance-clients.service.ts#L192).
- QA: apply Q-API for this ID and its workflow-specific cases; store status/body/DB diff with secrets removed.
- DTO field-access candidates: reason. These span reachable helpers and may include fields of internally composed DTOs; they are not a mandatory field list or complete wire schema. Match to the entry DTO and workflow before constructing requests.

## API-857786E4

**POST /api/compliance/clients/:id/people/:personId/roles** - ComplianceClientsController.addRole

- Entry/auth: AuthGuard('jwt'); RolesGuard; fallback roles: none declared; authenticated-only when JWT applies.
- Inputs: `@CurrentUser() user: RequestUser`; `@Param('id') id: string`; `@Param('personId') personId: string`; `@Body() dto: AddRoleDto`.
- Output: JSON returned from delegated service; inferred fields in linked implementation. Inferred by TypeScript; no explicit response DTO.
- Behavior: Command (may mutate); detected reachable writes: clientPersonRole.create, auditLog.create.
- Tenant/role/state/validation helper candidates: tenantWhere, enumValue.
- Error branch candidates: BadRequestException: `${person.fullName} already has this role.`); BadRequestException: 'A company cannot hold itself.'); NotFoundException: 'Compliance client not found'); ForbiddenException: 'User is not assigned to a tenant'); NotFoundException: 'This person is no longer on the client profile. Refresh the page.'); BadRequestException: `Invalid ${label} filter.`); BadRequestException: `A company can be ${CORPORATE_ROLES.map((item) => ROLE_LABELS[item]).join(', ')}. ${ROLE_LABELS[role]} applies to individuals.`); BadRequestException: 'Enter the position for "Other".'); BadRequestException: 'Enter the date as YYYY-MM-DD.'); BadRequestException: 'Enter a valid email address.'); BadRequestException: 'Enter a percentage between 0 and 100.'); BadRequestException: 'This value is too long.'); BadRequestException: 'Only a UBO can be held through a company.'); BadRequestException: 'Choose a corporate shareholder of this client.').
- Evidence: [backend/src/compliance-clients/compliance-clients.controller.ts:75](../../backend/src/compliance-clients/compliance-clients.controller.ts#L75).
- Logic chain: ComplianceClientsService.addRole [backend/src/compliance-clients/compliance-clients.service.ts:480](../../backend/src/compliance-clients/compliance-clients.service.ts#L480); ComplianceClientsService.editableClient [backend/src/compliance-clients/compliance-clients.service.ts:332](../../backend/src/compliance-clients/compliance-clients.service.ts#L332); ComplianceClientsService.tenantWhere [backend/src/compliance-clients/compliance-clients.service.ts:1284](../../backend/src/compliance-clients/compliance-clients.service.ts#L1284); ComplianceClientsService.ensureRecords [backend/src/compliance-clients/compliance-clients.service.ts:311](../../backend/src/compliance-clients/compliance-clients.service.ts#L311); ComplianceClientsService.profileOverrides [backend/src/compliance-clients/compliance-clients.service.ts:300](../../backend/src/compliance-clients/compliance-clients.service.ts#L300); ComplianceClientsService.pickProfileCase [backend/src/compliance-clients/compliance-clients.service.ts:293](../../backend/src/compliance-clients/compliance-clients.service.ts#L293); ComplianceClientsService.personOf [backend/src/compliance-clients/compliance-clients.service.ts:345](../../backend/src/compliance-clients/compliance-clients.service.ts#L345); ComplianceClientsService.enumValue [backend/src/compliance-clients/compliance-clients.service.ts:1268](../../backend/src/compliance-clients/compliance-clients.service.ts#L1268); ComplianceClientsService.roleInput [backend/src/compliance-clients/compliance-clients.service.ts:435](../../backend/src/compliance-clients/compliance-clients.service.ts#L435); ComplianceClientsService.optionalText [backend/src/compliance-clients/compliance-clients.service.ts:1279](../../backend/src/compliance-clients/compliance-clients.service.ts#L1279); ComplianceClientsService.profileValue [backend/src/compliance-clients/compliance-clients.service.ts:785](../../backend/src/compliance-clients/compliance-clients.service.ts#L785); ComplianceClientsService.viaPerson [backend/src/compliance-clients/compliance-clients.service.ts:445](../../backend/src/compliance-clients/compliance-clients.service.ts#L445); ComplianceClientsService.recordAudit [backend/src/compliance-clients/compliance-clients.service.ts:353](../../backend/src/compliance-clients/compliance-clients.service.ts#L353); ComplianceClientsService.findOne [backend/src/compliance-clients/compliance-clients.service.ts:93](../../backend/src/compliance-clients/compliance-clients.service.ts#L93); ComplianceClientsService.canView [backend/src/compliance-clients/compliance-clients.service.ts:1094](../../backend/src/compliance-clients/compliance-clients.service.ts#L1094); ComplianceClientsService.toListItem [backend/src/compliance-clients/compliance-clients.service.ts:1223](../../backend/src/compliance-clients/compliance-clients.service.ts#L1223); ComplianceClientsService.allocationList [backend/src/compliance-clients/compliance-clients.service.ts:235](../../backend/src/compliance-clients/compliance-clients.service.ts#L235); ComplianceClientsService.forAccess [backend/src/compliance-clients/compliance-clients.service.ts:224](../../backend/src/compliance-clients/compliance-clients.service.ts#L224); ComplianceClientsService.detailForAccess [backend/src/compliance-clients/compliance-clients.service.ts:192](../../backend/src/compliance-clients/compliance-clients.service.ts#L192).
- QA: apply Q-API for this ID and its workflow-specific cases; store status/body/DB diff with secrets removed.
- DTO field-access candidates: role, viaPersonId. These span reachable helpers and may include fields of internally composed DTOs; they are not a mandatory field list or complete wire schema. Match to the entry DTO and workflow before constructing requests.

## API-EF87BF51

**PATCH /api/compliance/clients/:id/people/:personId/roles/:roleId** - ComplianceClientsController.updateRole

- Entry/auth: AuthGuard('jwt'); RolesGuard; fallback roles: none declared; authenticated-only when JWT applies.
- Inputs: `@CurrentUser() user: RequestUser`; `@Param('id') id: string`; `@Param('personId') personId: string`; `@Param('roleId') roleId: string`; `@Body() dto: UpdateRoleDto`.
- Output: JSON returned from delegated service; inferred fields in linked implementation. Inferred by TypeScript; no explicit response DTO.
- Behavior: Command (may mutate); detected reachable writes: clientPersonRole.update, auditLog.create.
- Tenant/role/state/validation helper candidates: tenantWhere.
- Error branch candidates: NotFoundException: 'This role is no longer on the client profile. Refresh the page.'); BadRequestException: 'Only shareholders and UBOs have a percentage.'); NotFoundException: 'Compliance client not found'); ForbiddenException: 'User is not assigned to a tenant'); NotFoundException: 'This person is no longer on the client profile. Refresh the page.'); BadRequestException: 'Enter the date as YYYY-MM-DD.'); BadRequestException: 'Enter a valid email address.'); BadRequestException: 'Enter a percentage between 0 and 100.'); BadRequestException: 'This value is too long.'); BadRequestException: 'Only a UBO can be held through a company.'); BadRequestException: 'Choose a corporate shareholder of this client.').
- Evidence: [backend/src/compliance-clients/compliance-clients.controller.ts:80](../../backend/src/compliance-clients/compliance-clients.controller.ts#L80).
- Logic chain: ComplianceClientsService.updateRole [backend/src/compliance-clients/compliance-clients.service.ts:496](../../backend/src/compliance-clients/compliance-clients.service.ts#L496); ComplianceClientsService.editableClient [backend/src/compliance-clients/compliance-clients.service.ts:332](../../backend/src/compliance-clients/compliance-clients.service.ts#L332); ComplianceClientsService.tenantWhere [backend/src/compliance-clients/compliance-clients.service.ts:1284](../../backend/src/compliance-clients/compliance-clients.service.ts#L1284); ComplianceClientsService.ensureRecords [backend/src/compliance-clients/compliance-clients.service.ts:311](../../backend/src/compliance-clients/compliance-clients.service.ts#L311); ComplianceClientsService.profileOverrides [backend/src/compliance-clients/compliance-clients.service.ts:300](../../backend/src/compliance-clients/compliance-clients.service.ts#L300); ComplianceClientsService.pickProfileCase [backend/src/compliance-clients/compliance-clients.service.ts:293](../../backend/src/compliance-clients/compliance-clients.service.ts#L293); ComplianceClientsService.personOf [backend/src/compliance-clients/compliance-clients.service.ts:345](../../backend/src/compliance-clients/compliance-clients.service.ts#L345); ComplianceClientsService.profileValue [backend/src/compliance-clients/compliance-clients.service.ts:785](../../backend/src/compliance-clients/compliance-clients.service.ts#L785); ComplianceClientsService.viaPerson [backend/src/compliance-clients/compliance-clients.service.ts:445](../../backend/src/compliance-clients/compliance-clients.service.ts#L445); ComplianceClientsService.findOne [backend/src/compliance-clients/compliance-clients.service.ts:93](../../backend/src/compliance-clients/compliance-clients.service.ts#L93); ComplianceClientsService.canView [backend/src/compliance-clients/compliance-clients.service.ts:1094](../../backend/src/compliance-clients/compliance-clients.service.ts#L1094); ComplianceClientsService.toListItem [backend/src/compliance-clients/compliance-clients.service.ts:1223](../../backend/src/compliance-clients/compliance-clients.service.ts#L1223); ComplianceClientsService.allocationList [backend/src/compliance-clients/compliance-clients.service.ts:235](../../backend/src/compliance-clients/compliance-clients.service.ts#L235); ComplianceClientsService.forAccess [backend/src/compliance-clients/compliance-clients.service.ts:224](../../backend/src/compliance-clients/compliance-clients.service.ts#L224); ComplianceClientsService.detailForAccess [backend/src/compliance-clients/compliance-clients.service.ts:192](../../backend/src/compliance-clients/compliance-clients.service.ts#L192); ComplianceClientsService.recordAudit [backend/src/compliance-clients/compliance-clients.service.ts:353](../../backend/src/compliance-clients/compliance-clients.service.ts#L353).
- QA: apply Q-API for this ID and its workflow-specific cases; store status/body/DB diff with secrets removed.
- DTO field-access candidates: percentage, viaPersonId. These span reachable helpers and may include fields of internally composed DTOs; they are not a mandatory field list or complete wire schema. Match to the entry DTO and workflow before constructing requests.

## API-B08DF12B

**POST /api/compliance/clients/:id/people/:personId/roles/:roleId/remove** - ComplianceClientsController.removeRole

- Entry/auth: AuthGuard('jwt'); RolesGuard; fallback roles: none declared; authenticated-only when JWT applies.
- Inputs: `@CurrentUser() user: RequestUser`; `@Param('id') id: string`; `@Param('personId') personId: string`; `@Param('roleId') roleId: string`; `@Body() dto: RemoveRecordDto`.
- Output: JSON returned from delegated service; inferred fields in linked implementation. Inferred by TypeScript; no explicit response DTO.
- Behavior: Command (may mutate); detected reachable writes: clientPersonRole.delete, clientPerson.update, auditLog.create.
- Tenant/role/state/validation helper candidates: tenantWhere.
- Error branch candidates: NotFoundException: 'This role is no longer on the client profile. Refresh the page.'); NotFoundException: 'Compliance client not found'); ForbiddenException: 'User is not assigned to a tenant'); NotFoundException: 'This person is no longer on the client profile. Refresh the page.').
- Evidence: [backend/src/compliance-clients/compliance-clients.controller.ts:88](../../backend/src/compliance-clients/compliance-clients.controller.ts#L88).
- Logic chain: ComplianceClientsService.removeRole [backend/src/compliance-clients/compliance-clients.service.ts:523](../../backend/src/compliance-clients/compliance-clients.service.ts#L523); ComplianceClientsService.editableClient [backend/src/compliance-clients/compliance-clients.service.ts:332](../../backend/src/compliance-clients/compliance-clients.service.ts#L332); ComplianceClientsService.tenantWhere [backend/src/compliance-clients/compliance-clients.service.ts:1284](../../backend/src/compliance-clients/compliance-clients.service.ts#L1284); ComplianceClientsService.ensureRecords [backend/src/compliance-clients/compliance-clients.service.ts:311](../../backend/src/compliance-clients/compliance-clients.service.ts#L311); ComplianceClientsService.profileOverrides [backend/src/compliance-clients/compliance-clients.service.ts:300](../../backend/src/compliance-clients/compliance-clients.service.ts#L300); ComplianceClientsService.pickProfileCase [backend/src/compliance-clients/compliance-clients.service.ts:293](../../backend/src/compliance-clients/compliance-clients.service.ts#L293); ComplianceClientsService.personOf [backend/src/compliance-clients/compliance-clients.service.ts:345](../../backend/src/compliance-clients/compliance-clients.service.ts#L345); ComplianceClientsService.recordAudit [backend/src/compliance-clients/compliance-clients.service.ts:353](../../backend/src/compliance-clients/compliance-clients.service.ts#L353); ComplianceClientsService.optionalText [backend/src/compliance-clients/compliance-clients.service.ts:1279](../../backend/src/compliance-clients/compliance-clients.service.ts#L1279); ComplianceClientsService.findOne [backend/src/compliance-clients/compliance-clients.service.ts:93](../../backend/src/compliance-clients/compliance-clients.service.ts#L93); ComplianceClientsService.canView [backend/src/compliance-clients/compliance-clients.service.ts:1094](../../backend/src/compliance-clients/compliance-clients.service.ts#L1094); ComplianceClientsService.toListItem [backend/src/compliance-clients/compliance-clients.service.ts:1223](../../backend/src/compliance-clients/compliance-clients.service.ts#L1223); ComplianceClientsService.allocationList [backend/src/compliance-clients/compliance-clients.service.ts:235](../../backend/src/compliance-clients/compliance-clients.service.ts#L235); ComplianceClientsService.forAccess [backend/src/compliance-clients/compliance-clients.service.ts:224](../../backend/src/compliance-clients/compliance-clients.service.ts#L224); ComplianceClientsService.detailForAccess [backend/src/compliance-clients/compliance-clients.service.ts:192](../../backend/src/compliance-clients/compliance-clients.service.ts#L192).
- QA: apply Q-API for this ID and its workflow-specific cases; store status/body/DB diff with secrets removed.
- DTO field-access candidates: reason. These span reachable helpers and may include fields of internally composed DTOs; they are not a mandatory field list or complete wire schema. Match to the entry DTO and workflow before constructing requests.

## API-717D99CE

**POST /api/compliance/clients/:id/rekyc** - ComplianceClientsController.startRekyc

- Entry/auth: AuthGuard('jwt'); RolesGuard; fallback roles: none declared; authenticated-only when JWT applies.
- Inputs: `@CurrentUser() user: RequestUser`; `@Param('id') id: string`.
- Output: JSON returned from delegated service; inferred fields in linked implementation. Inferred by TypeScript; no explicit response DTO.
- Behavior: Command (may mutate); detected reachable writes: none detected.
- Tenant/role/state/validation helper candidates: tenantWhere.
- Error branch candidates: BadRequestException: 'Re-KYC is not available.'); BadRequestException: 'Only active clients can start a re-KYC.'); BadRequestException: 'This client has no KYC form to take the details from yet.'); NotFoundException: 'Compliance client not found'); ForbiddenException: 'User is not assigned to a tenant').
- Evidence: [backend/src/compliance-clients/compliance-clients.controller.ts:131](../../backend/src/compliance-clients/compliance-clients.controller.ts#L131).
- Logic chain: ComplianceClientsService.startRekyc [backend/src/compliance-clients/compliance-clients.service.ts:768](../../backend/src/compliance-clients/compliance-clients.service.ts#L768); ComplianceClientsService.editableClient [backend/src/compliance-clients/compliance-clients.service.ts:332](../../backend/src/compliance-clients/compliance-clients.service.ts#L332); ComplianceClientsService.tenantWhere [backend/src/compliance-clients/compliance-clients.service.ts:1284](../../backend/src/compliance-clients/compliance-clients.service.ts#L1284); ComplianceClientsService.ensureRecords [backend/src/compliance-clients/compliance-clients.service.ts:311](../../backend/src/compliance-clients/compliance-clients.service.ts#L311); ComplianceClientsService.profileOverrides [backend/src/compliance-clients/compliance-clients.service.ts:300](../../backend/src/compliance-clients/compliance-clients.service.ts#L300); ComplianceClientsService.pickProfileCase [backend/src/compliance-clients/compliance-clients.service.ts:293](../../backend/src/compliance-clients/compliance-clients.service.ts#L293).
- QA: apply Q-API for this ID and its workflow-specific cases; store status/body/DB diff with secrets removed.
- DTO field-access candidates: none resolved. These span reachable helpers and may include fields of internally composed DTOs; they are not a mandatory field list or complete wire schema. Match to the entry DTO and workflow before constructing requests.

## API-34675EA2

**GET /api/compliance/clients/export/excel** - ComplianceClientsController.exportExcel

- Entry/auth: AuthGuard('jwt'); RolesGuard; fallback roles: none declared; authenticated-only when JWT applies.
- Inputs: `@CurrentUser() user: RequestUser`; `@Query() query: ComplianceClientQuery`; `@Res() response: Response`.
- Output: Response.send binary/HTML; see controller MIME and Content-Disposition. Inferred by TypeScript; no explicit response DTO.
- Behavior: Read candidate (static scan only); detected reachable writes: none detected.
- Tenant/role/state/validation helper candidates: tenantWhere, enumValue.
- Error branch candidates: BadRequestException: 'Invalid status filter.'); BadRequestException: 'Invalid review filter.'); BadRequestException: 'Invalid attention filter.'); ForbiddenException: 'User is not assigned to a tenant'); BadRequestException: `Invalid ${label} filter.`).
- Evidence: [backend/src/compliance-clients/compliance-clients.controller.ts:22](../../backend/src/compliance-clients/compliance-clients.controller.ts#L22).
- Logic chain: ComplianceClientsService.exportExcel [backend/src/compliance-clients/compliance-clients.service.ts:899](../../backend/src/compliance-clients/compliance-clients.service.ts#L899); ComplianceClientsService.buildWhere [backend/src/compliance-clients/compliance-clients.service.ts:1156](../../backend/src/compliance-clients/compliance-clients.service.ts#L1156); ComplianceClientsService.tenantWhere [backend/src/compliance-clients/compliance-clients.service.ts:1284](../../backend/src/compliance-clients/compliance-clients.service.ts#L1284); ComplianceClientsService.optionalText [backend/src/compliance-clients/compliance-clients.service.ts:1279](../../backend/src/compliance-clients/compliance-clients.service.ts#L1279); ComplianceClientsService.enumValue [backend/src/compliance-clients/compliance-clients.service.ts:1268](../../backend/src/compliance-clients/compliance-clients.service.ts#L1268); ComplianceClientsService.screeningAlertClientIds [backend/src/compliance-clients/compliance-clients.service.ts:1139](../../backend/src/compliance-clients/compliance-clients.service.ts#L1139); ComplianceClientsService.addDetailSheets [backend/src/compliance-clients/compliance-clients.service.ts:993](../../backend/src/compliance-clients/compliance-clients.service.ts#L993); ComplianceClientsService.ensureRecords [backend/src/compliance-clients/compliance-clients.service.ts:311](../../backend/src/compliance-clients/compliance-clients.service.ts#L311); ComplianceClientsService.profileOverrides [backend/src/compliance-clients/compliance-clients.service.ts:300](../../backend/src/compliance-clients/compliance-clients.service.ts#L300); ComplianceClientsService.pickProfileCase [backend/src/compliance-clients/compliance-clients.service.ts:293](../../backend/src/compliance-clients/compliance-clients.service.ts#L293); ComplianceClientsService.forAccess [backend/src/compliance-clients/compliance-clients.service.ts:224](../../backend/src/compliance-clients/compliance-clients.service.ts#L224); ComplianceClientsService.toListItem [backend/src/compliance-clients/compliance-clients.service.ts:1223](../../backend/src/compliance-clients/compliance-clients.service.ts#L1223); ComplianceClientsService.cddLabel [backend/src/compliance-clients/compliance-clients.service.ts:1264](../../backend/src/compliance-clients/compliance-clients.service.ts#L1264).
- QA: apply Q-API for this ID and its workflow-specific cases; store status/body/DB diff with secrets removed.
- DTO field-access candidates: none resolved. These span reachable helpers and may include fields of internally composed DTOs; they are not a mandatory field list or complete wire schema. Match to the entry DTO and workflow before constructing requests.

## API-4AAC9231

**GET /api/compliance/clients/export/expiry** - ComplianceClientsController.exportExpiry

- Entry/auth: AuthGuard('jwt'); RolesGuard; fallback roles: none declared; authenticated-only when JWT applies.
- Inputs: `@CurrentUser() user: RequestUser`; `@Query('window') window: string \| undefined`; `@Res() response: Response`.
- Output: Response.send binary/HTML; see controller MIME and Content-Disposition. Inferred by TypeScript; no explicit response DTO.
- Behavior: Read candidate (static scan only); detected reachable writes: none detected.
- Tenant/role/state/validation helper candidates: tenantWhere.
- Error branch candidates: NotFoundException: 'Compliance client not found'); ForbiddenException: 'User is not assigned to a tenant').
- Evidence: [backend/src/compliance-clients/compliance-clients.controller.ts:32](../../backend/src/compliance-clients/compliance-clients.controller.ts#L32).
- Logic chain: ComplianceClientsService.exportExpiry [backend/src/compliance-clients/compliance-clients.service.ts:1032](../../backend/src/compliance-clients/compliance-clients.service.ts#L1032); ComplianceClientsService.tenantWhere [backend/src/compliance-clients/compliance-clients.service.ts:1284](../../backend/src/compliance-clients/compliance-clients.service.ts#L1284).
- QA: apply Q-API for this ID and its workflow-specific cases; store status/body/DB diff with secrets removed.
- DTO field-access candidates: none resolved. These span reachable helpers and may include fields of internally composed DTOs; they are not a mandatory field list or complete wire schema. Match to the entry DTO and workflow before constructing requests.

## API-7CCA1951

**POST /api/compliance/reminders/run** - ComplianceRemindersController.run

- Entry/auth: AuthGuard('jwt'); RolesGuard; fallback roles: none declared; authenticated-only when JWT applies.
- Inputs: `@CurrentUser() user: RequestUser`.
- Output: JSON returned from delegated service; inferred fields in linked implementation. Inferred by TypeScript; no explicit response DTO.
- Behavior: Command (may mutate); detected reachable writes: complianceReminder.create, notification.create.
- Tenant/role/state/validation helper candidates: none detected; inspect implementation before acceptance.
- Error branch candidates: none explicitly thrown in resolved methods; global errors still apply.
- Evidence: [backend/src/compliance-clients/compliance-monitoring.controller.ts:78](../../backend/src/compliance-clients/compliance-monitoring.controller.ts#L78).
- Logic chain: ComplianceRemindersService.sweep [backend/src/compliance-clients/compliance-reminders.service.ts:45](../../backend/src/compliance-clients/compliance-reminders.service.ts#L45); ComplianceRemindersService.remind [backend/src/compliance-clients/compliance-reminders.service.ts:105](../../backend/src/compliance-clients/compliance-reminders.service.ts#L105).
- QA: apply Q-API for this ID and its workflow-specific cases; store status/body/DB diff with secrets removed.
- DTO field-access candidates: none resolved. These span reachable helpers and may include fields of internally composed DTOs; they are not a mandatory field list or complete wire schema. Match to the entry DTO and workflow before constructing requests.

## API-126A3D33

**GET /api/crrf** - CrrfListController.listRecords

- Entry/auth: AuthGuard('jwt'); RolesGuard; fallback roles: AML_TEAM, AML_SUPERVISOR, DMLRO, MLRO, SEF, CEO, COMPANY_ADMIN, SUPER_ADMIN.
- Inputs: `@CurrentUser() user: RequestUser`.
- Output: JSON returned from delegated service; inferred fields in linked implementation. Inferred by TypeScript; no explicit response DTO.
- Behavior: Read candidate (static scan only); detected reachable writes: none detected.
- Tenant/role/state/validation helper candidates: recordTenantWhere.
- Error branch candidates: ForbiddenException: 'User is not assigned to a tenant.').
- Evidence: [backend/src/crrf/crrf.controller.ts:85](../../backend/src/crrf/crrf.controller.ts#L85).
- Logic chain: CrrfService.listRecords [backend/src/crrf/crrf.service.ts:16](../../backend/src/crrf/crrf.service.ts#L16); CrrfService.recordTenantWhere [backend/src/crrf/crrf.service.ts:258](../../backend/src/crrf/crrf.service.ts#L258); CrrfService.getTenantId [backend/src/crrf/crrf.service.ts:266](../../backend/src/crrf/crrf.service.ts#L266); CrrfService.clientInfo [backend/src/crrf/crrf.service.ts:227](../../backend/src/crrf/crrf.service.ts#L227); CrrfService.generalCompanySection [backend/src/crrf/crrf.service.ts:243](../../backend/src/crrf/crrf.service.ts#L243); CrrfService.isRecord [backend/src/crrf/crrf.service.ts:337](../../backend/src/crrf/crrf.service.ts#L337); CrrfService.stringValue [backend/src/crrf/crrf.service.ts:327](../../backend/src/crrf/crrf.service.ts#L327).
- QA: apply Q-API for this ID and its workflow-specific cases; store status/body/DB diff with secrets removed.
- DTO field-access candidates: none resolved. These span reachable helpers and may include fields of internally composed DTOs; they are not a mandatory field list or complete wire schema. Match to the entry DTO and workflow before constructing requests.

## API-49780112

**GET /api/dashboard/summary** - DashboardController.summary

- Entry/auth: AuthGuard('jwt'); fallback roles: none declared; authenticated-only when JWT applies.
- Inputs: `@CurrentUser() user: RequestUser`.
- Output: JSON returned from delegated service; inferred fields in linked implementation. Inferred by TypeScript; no explicit response DTO.
- Behavior: Read candidate (static scan only); detected reachable writes: none detected.
- Tenant/role/state/validation helper candidates: none detected; inspect implementation before acceptance.
- Error branch candidates: ForbiddenException: 'User is not assigned to a tenant').
- Evidence: [backend/src/dashboard/dashboard.controller.ts:12](../../backend/src/dashboard/dashboard.controller.ts#L12).
- Logic chain: DashboardService.summary [backend/src/dashboard/dashboard.service.ts:10](../../backend/src/dashboard/dashboard.service.ts#L10).
- QA: apply Q-API for this ID and its workflow-specific cases; store status/body/DB diff with secrets removed.
- DTO field-access candidates: none resolved. These span reachable helpers and may include fields of internally composed DTOs; they are not a mandatory field list or complete wire schema. Match to the entry DTO and workflow before constructing requests.

## API-5B2BF5E4

**GET /api/documents** - DocumentsController.findAll

- Entry/auth: AuthGuard('jwt'); fallback roles: none declared; authenticated-only when JWT applies.
- Inputs: `@CurrentUser() user: RequestUser`.
- Output: JSON returned from delegated service; inferred fields in linked implementation. Inferred by TypeScript; no explicit response DTO.
- Behavior: Read candidate (static scan only); detected reachable writes: none detected.
- Tenant/role/state/validation helper candidates: none detected; inspect implementation before acceptance.
- Error branch candidates: none explicitly thrown in resolved methods; global errors still apply.
- Evidence: [backend/src/documents/documents.controller.ts:12](../../backend/src/documents/documents.controller.ts#L12).
- Logic chain: DocumentsService.findAll [backend/src/documents/documents.service.ts:9](../../backend/src/documents/documents.service.ts#L9).
- QA: apply Q-API for this ID and its workflow-specific cases; store status/body/DB diff with secrets removed.
- DTO field-access candidates: none resolved. These span reachable helpers and may include fields of internally composed DTOs; they are not a mandatory field list or complete wire schema. Match to the entry DTO and workflow before constructing requests.

## API-FFC0C4D5

**GET /api/enquiries** - EnquiriesController.findAll

- Entry/auth: AuthGuard('jwt'); RolesGuard; fallback roles: OPERATING_TEAM, AML_TEAM, AML_SUPERVISOR, DMLRO, MLRO, SEF, CEO, ACCOUNTING_TEAM, HR_TEAM, COMPANY_ADMIN, SUPER_ADMIN.
- Inputs: `@CurrentUser() user: RequestUser`.
- Output: JSON returned from delegated service; inferred fields in linked implementation. Inferred by TypeScript; no explicit response DTO.
- Behavior: Read candidate (static scan only); detected reachable writes: none detected.
- Tenant/role/state/validation helper candidates: tenantWhere.
- Error branch candidates: ForbiddenException: 'Super admin must act within a tenant for this operation'); ForbiddenException: 'User is not assigned to a tenant').
- Evidence: [backend/src/enquiries/enquiries.controller.ts:25](../../backend/src/enquiries/enquiries.controller.ts#L25).
- Logic chain: EnquiriesService.findAll [backend/src/enquiries/enquiries.service.ts:185](../../backend/src/enquiries/enquiries.service.ts#L185); EnquiriesService.tenantWhere [backend/src/enquiries/enquiries.service.ts:1009](../../backend/src/enquiries/enquiries.service.ts#L1009); EnquiriesService.getTenantId [backend/src/enquiries/enquiries.service.ts:1013](../../backend/src/enquiries/enquiries.service.ts#L1013).
- QA: apply Q-API for this ID and its workflow-specific cases; store status/body/DB diff with secrets removed.
- DTO field-access candidates: none resolved. These span reachable helpers and may include fields of internally composed DTOs; they are not a mandatory field list or complete wire schema. Match to the entry DTO and workflow before constructing requests.

## API-2A03FCD2

**POST /api/enquiries** - EnquiriesController.create

- Entry/auth: AuthGuard('jwt'); RolesGuard; fallback roles: OPERATING_TEAM, COMPANY_ADMIN, SUPER_ADMIN.
- Inputs: `@CurrentUser() user: RequestUser`; `@Body() dto: CreateEnquiryDto`.
- Output: JSON returned from delegated service; inferred fields in linked implementation. Inferred by TypeScript; no explicit response DTO.
- Behavior: Command (may mutate); detected reachable writes: enquiry.create, enquiryStatusHistory.create, notification.createMany.
- Tenant/role/state/validation helper candidates: assertClientTenant, tenantWhere, assertNoOpenDuplicate.
- Error branch candidates: ServiceUnavailableException: ; ForbiddenException: 'Super admin must act within a tenant for this operation'); ForbiddenException: 'User is not assigned to a tenant'); NotFoundException: 'Client not found for this enquiry'); ConflictException: this.duplicateMessage(duplicate)); NotFoundException: 'Enquiry not found').
- Evidence: [backend/src/enquiries/enquiries.controller.ts:19](../../backend/src/enquiries/enquiries.controller.ts#L19).
- Logic chain: EnquiriesService.create [backend/src/enquiries/enquiries.service.ts:88](../../backend/src/enquiries/enquiries.service.ts#L88); EnquiriesService.getTenantId [backend/src/enquiries/enquiries.service.ts:1013](../../backend/src/enquiries/enquiries.service.ts#L1013); EnquiriesService.assertClientTenant [backend/src/enquiries/enquiries.service.ts:990](../../backend/src/enquiries/enquiries.service.ts#L990); EnquiriesService.tenantWhere [backend/src/enquiries/enquiries.service.ts:1009](../../backend/src/enquiries/enquiries.service.ts#L1009); EnquiriesService.nextEnquiryCode [backend/src/enquiries/enquiries.service.ts:956](../../backend/src/enquiries/enquiries.service.ts#L956); EnquiriesService.lockEnquiryRegister [backend/src/enquiries/enquiries.service.ts:951](../../backend/src/enquiries/enquiries.service.ts#L951); EnquiriesService.assertNoOpenDuplicate [backend/src/enquiries/enquiries.service.ts:895](../../backend/src/enquiries/enquiries.service.ts#L895); EnquiriesService.openDuplicate [backend/src/enquiries/enquiries.service.ts:907](../../backend/src/enquiries/enquiries.service.ts#L907); EnquiriesService.duplicateMessage [backend/src/enquiries/enquiries.service.ts:946](../../backend/src/enquiries/enquiries.service.ts#L946); EnquiriesService.jsonValue [backend/src/enquiries/enquiries.service.ts:1001](../../backend/src/enquiries/enquiries.service.ts#L1001); EnquiriesService.enquiryDisplayName [backend/src/enquiries/enquiries.service.ts:1176](../../backend/src/enquiries/enquiries.service.ts#L1176); EnquiriesService.findOne [backend/src/enquiries/enquiries.service.ts:199](../../backend/src/enquiries/enquiries.service.ts#L199); EnquiriesService.logCreateFailure [backend/src/enquiries/enquiries.service.ts:1158](../../backend/src/enquiries/enquiries.service.ts#L1158); EnquiriesService.enquiryCreateDatabaseException [backend/src/enquiries/enquiries.service.ts:1234](../../backend/src/enquiries/enquiries.service.ts#L1234).
- QA: apply Q-API for this ID and its workflow-specific cases; store status/body/DB diff with secrets removed.
- DTO field-access candidates: areaOfOperation, attachments, branchCountry, clientId, companyName, details, enquiryType, headOfficeCountry, keyContactEmail, keyContactName, keyContactPhone, keyContactPosition, notes, proposedCompanyName, requestedServices. These span reachable helpers and may include fields of internally composed DTOs; they are not a mandatory field list or complete wire schema. Match to the entry DTO and workflow before constructing requests.

## API-62F96B16

**DELETE /api/enquiries/:id** - EnquiriesController.remove

- Entry/auth: AuthGuard('jwt'); RolesGuard; fallback roles: SUPER_ADMIN, COMPANY_ADMIN, OPERATING_TEAM.
- Inputs: `@CurrentUser() user: RequestUser`; `@Param('id') id: string`.
- Output: JSON returned from delegated service; inferred fields in linked implementation. Inferred by TypeScript; no explicit response DTO.
- Behavior: Command (may mutate); detected reachable writes: auditLog.create, enquiry.delete.
- Tenant/role/state/validation helper candidates: tenantWhere, hasAnyRole.
- Error branch candidates: ForbiddenException: 'Only Operations or an administrator can delete enquiries.'); BadRequestException: `${existing.enquiryCode} cannot be deleted: it has already been sent to AML${kycCases ? ' and has a KYC case' : ''}. Only draft or returned enquiries can be deleted.`); NotFoundException: 'Enquiry not found'); ForbiddenException: 'Super admin must act within a tenant for this operation'); ForbiddenException: 'User is not assigned to a tenant').
- Evidence: [backend/src/enquiries/enquiries.controller.ts:171](../../backend/src/enquiries/enquiries.controller.ts#L171).
- Logic chain: EnquiriesService.remove [backend/src/enquiries/enquiries.service.ts:850](../../backend/src/enquiries/enquiries.service.ts#L850); EnquiriesService.findOne [backend/src/enquiries/enquiries.service.ts:199](../../backend/src/enquiries/enquiries.service.ts#L199); EnquiriesService.tenantWhere [backend/src/enquiries/enquiries.service.ts:1009](../../backend/src/enquiries/enquiries.service.ts#L1009); EnquiriesService.getTenantId [backend/src/enquiries/enquiries.service.ts:1013](../../backend/src/enquiries/enquiries.service.ts#L1013); EnquiriesService.hasAnyRole [backend/src/enquiries/enquiries.service.ts:1146](../../backend/src/enquiries/enquiries.service.ts#L1146); EnquiriesService.removeEnquiryAttachmentDirectory [backend/src/enquiries/enquiries.service.ts:1371](../../backend/src/enquiries/enquiries.service.ts#L1371); EnquiriesService.enquiryAttachmentUploadRoot [backend/src/enquiries/enquiries.service.ts:1150](../../backend/src/enquiries/enquiries.service.ts#L1150).
- QA: apply Q-API for this ID and its workflow-specific cases; store status/body/DB diff with secrets removed.
- DTO field-access candidates: none resolved. These span reachable helpers and may include fields of internally composed DTOs; they are not a mandatory field list or complete wire schema. Match to the entry DTO and workflow before constructing requests.

## API-45584D11

**GET /api/enquiries/:id** - EnquiriesController.findOne

- Entry/auth: AuthGuard('jwt'); RolesGuard; fallback roles: OPERATING_TEAM, AML_TEAM, AML_SUPERVISOR, DMLRO, MLRO, SEF, CEO, ACCOUNTING_TEAM, HR_TEAM, COMPANY_ADMIN, SUPER_ADMIN.
- Inputs: `@CurrentUser() user: RequestUser`; `@Param('id') id: string`.
- Output: JSON returned from delegated service; inferred fields in linked implementation. Inferred by TypeScript; no explicit response DTO.
- Behavior: Read candidate (static scan only); detected reachable writes: none detected.
- Tenant/role/state/validation helper candidates: tenantWhere.
- Error branch candidates: NotFoundException: 'Enquiry not found'); ForbiddenException: 'Super admin must act within a tenant for this operation'); ForbiddenException: 'User is not assigned to a tenant').
- Evidence: [backend/src/enquiries/enquiries.controller.ts:68](../../backend/src/enquiries/enquiries.controller.ts#L68).
- Logic chain: EnquiriesService.findOne [backend/src/enquiries/enquiries.service.ts:199](../../backend/src/enquiries/enquiries.service.ts#L199); EnquiriesService.tenantWhere [backend/src/enquiries/enquiries.service.ts:1009](../../backend/src/enquiries/enquiries.service.ts#L1009); EnquiriesService.getTenantId [backend/src/enquiries/enquiries.service.ts:1013](../../backend/src/enquiries/enquiries.service.ts#L1013).
- QA: apply Q-API for this ID and its workflow-specific cases; store status/body/DB diff with secrets removed.
- DTO field-access candidates: none resolved. These span reachable helpers and may include fields of internally composed DTOs; they are not a mandatory field list or complete wire schema. Match to the entry DTO and workflow before constructing requests.

## API-AA5ECB01

**PATCH /api/enquiries/:id** - EnquiriesController.update

- Entry/auth: AuthGuard('jwt'); RolesGuard; fallback roles: OPERATING_TEAM, AML_SUPERVISOR, COMPANY_ADMIN, SUPER_ADMIN.
- Inputs: `@CurrentUser() user: RequestUser`; `@Param('id') id: string`; `@Body() dto: UpdateEnquiryDto`.
- Output: JSON returned from delegated service; inferred fields in linked implementation. Inferred by TypeScript; no explicit response DTO.
- Behavior: Command (may mutate); detected reachable writes: enquiryAttachment.deleteMany, enquiry.update.
- Tenant/role/state/validation helper candidates: tenantWhere, canModifyEnquiry, hasAnyRole, assertClientTenant, assertNoOpenDuplicate.
- Error branch candidates: BadRequestException: 'This enquiry has already been submitted. It can be edited again only after AML returns it to BD.'); NotFoundException: 'Enquiry not found'); ForbiddenException: 'Super admin must act within a tenant for this operation'); ForbiddenException: 'User is not assigned to a tenant'); NotFoundException: 'Client not found for this enquiry'); ConflictException: this.duplicateMessage(duplicate)).
- Evidence: [backend/src/enquiries/enquiries.controller.ts:74](../../backend/src/enquiries/enquiries.controller.ts#L74).
- Logic chain: EnquiriesService.update [backend/src/enquiries/enquiries.service.ts:219](../../backend/src/enquiries/enquiries.service.ts#L219); EnquiriesService.findOne [backend/src/enquiries/enquiries.service.ts:199](../../backend/src/enquiries/enquiries.service.ts#L199); EnquiriesService.tenantWhere [backend/src/enquiries/enquiries.service.ts:1009](../../backend/src/enquiries/enquiries.service.ts#L1009); EnquiriesService.getTenantId [backend/src/enquiries/enquiries.service.ts:1013](../../backend/src/enquiries/enquiries.service.ts#L1013); EnquiriesService.canModifyEnquiry [backend/src/enquiries/enquiries.service.ts:1025](../../backend/src/enquiries/enquiries.service.ts#L1025); EnquiriesService.hasAnyRole [backend/src/enquiries/enquiries.service.ts:1146](../../backend/src/enquiries/enquiries.service.ts#L1146); EnquiriesService.assertClientTenant [backend/src/enquiries/enquiries.service.ts:990](../../backend/src/enquiries/enquiries.service.ts#L990); EnquiriesService.lockEnquiryRegister [backend/src/enquiries/enquiries.service.ts:951](../../backend/src/enquiries/enquiries.service.ts#L951); EnquiriesService.assertNoOpenDuplicate [backend/src/enquiries/enquiries.service.ts:895](../../backend/src/enquiries/enquiries.service.ts#L895); EnquiriesService.openDuplicate [backend/src/enquiries/enquiries.service.ts:907](../../backend/src/enquiries/enquiries.service.ts#L907); EnquiriesService.duplicateMessage [backend/src/enquiries/enquiries.service.ts:946](../../backend/src/enquiries/enquiries.service.ts#L946); EnquiriesService.jsonValue [backend/src/enquiries/enquiries.service.ts:1001](../../backend/src/enquiries/enquiries.service.ts#L1001); EnquiriesService.objectValue [backend/src/enquiries/enquiries.service.ts:1184](../../backend/src/enquiries/enquiries.service.ts#L1184).
- QA: apply Q-API for this ID and its workflow-specific cases; store status/body/DB diff with secrets removed.
- DTO field-access candidates: areaOfOperation, attachments, branchCountry, clientId, companyName, details, enquiryType, headOfficeCountry, keyContactEmail, keyContactName, keyContactPhone, keyContactPosition, notes, proposedCompanyName, requestedServices. These span reachable helpers and may include fields of internally composed DTOs; they are not a mandatory field list or complete wire schema. Match to the entry DTO and workflow before constructing requests.

## API-4E2DD820

**GET /api/enquiries/:id/attachments/:attachmentId/view** - EnquiriesController.viewAttachment

- Entry/auth: AuthGuard('jwt'); RolesGuard; fallback roles: none declared; authenticated-only when JWT applies.
- Inputs: `@CurrentUser() user: RequestUser`; `@Param('id') id: string`; `@Param('attachmentId') attachmentId: string`; `@Res() response: Response`.
- Output: Response.send binary/HTML; see controller MIME and Content-Disposition. Inferred by TypeScript; no explicit response DTO.
- Behavior: Read candidate (static scan only); detected reachable writes: none detected.
- Tenant/role/state/validation helper candidates: tenantWhere.
- Error branch candidates: NotFoundException: 'Enquiry attachment not found'); NotFoundException: 'Uploaded file is not available for this attachment'); NotFoundException: 'Enquiry not found'); ForbiddenException: 'Super admin must act within a tenant for this operation'); ForbiddenException: 'User is not assigned to a tenant').
- Evidence: [backend/src/enquiries/enquiries.controller.ts:142](../../backend/src/enquiries/enquiries.controller.ts#L142).
- Logic chain: EnquiriesService.getAttachmentFile [backend/src/enquiries/enquiries.service.ts:788](../../backend/src/enquiries/enquiries.service.ts#L788); EnquiriesService.findOne [backend/src/enquiries/enquiries.service.ts:199](../../backend/src/enquiries/enquiries.service.ts#L199); EnquiriesService.tenantWhere [backend/src/enquiries/enquiries.service.ts:1009](../../backend/src/enquiries/enquiries.service.ts#L1009); EnquiriesService.getTenantId [backend/src/enquiries/enquiries.service.ts:1013](../../backend/src/enquiries/enquiries.service.ts#L1013); EnquiriesService.resolveEnquiryAttachmentPath [backend/src/enquiries/enquiries.service.ts:1303](../../backend/src/enquiries/enquiries.service.ts#L1303); EnquiriesService.enquiryAttachmentUploadRoot [backend/src/enquiries/enquiries.service.ts:1150](../../backend/src/enquiries/enquiries.service.ts#L1150).
- QA: apply Q-API for this ID and its workflow-specific cases; store status/body/DB diff with secrets removed.
- DTO field-access candidates: none resolved. These span reachable helpers and may include fields of internally composed DTOs; they are not a mandatory field list or complete wire schema. Match to the entry DTO and workflow before constructing requests.

## API-0296575E

**GET /api/enquiries/:id/attachments/download-group** - EnquiriesController.downloadAttachmentGroup

- Entry/auth: AuthGuard('jwt'); RolesGuard; fallback roles: none declared; authenticated-only when JWT applies.
- Inputs: `@CurrentUser() user: RequestUser`; `@Param('id') id: string`; `@Query('documentType') documentType: string`; `@Res() response: Response`.
- Output: Response.send binary/HTML; see controller MIME and Content-Disposition. Inferred by TypeScript; no explicit response DTO.
- Behavior: Read candidate (static scan only); detected reachable writes: none detected.
- Tenant/role/state/validation helper candidates: tenantWhere.
- Error branch candidates: BadRequestException: 'Document type is required'); NotFoundException: 'No uploaded files are available for this attachment group'); NotFoundException: 'Uploaded files are not available for this attachment group'); NotFoundException: 'Enquiry not found'); ForbiddenException: 'Super admin must act within a tenant for this operation'); ForbiddenException: 'User is not assigned to a tenant').
- Evidence: [backend/src/enquiries/enquiries.controller.ts:156](../../backend/src/enquiries/enquiries.controller.ts#L156).
- Logic chain: EnquiriesService.getAttachmentGroupZip [backend/src/enquiries/enquiries.service.ts:813](../../backend/src/enquiries/enquiries.service.ts#L813); EnquiriesService.findOne [backend/src/enquiries/enquiries.service.ts:199](../../backend/src/enquiries/enquiries.service.ts#L199); EnquiriesService.tenantWhere [backend/src/enquiries/enquiries.service.ts:1009](../../backend/src/enquiries/enquiries.service.ts#L1009); EnquiriesService.getTenantId [backend/src/enquiries/enquiries.service.ts:1013](../../backend/src/enquiries/enquiries.service.ts#L1013); EnquiriesService.resolveEnquiryAttachmentPath [backend/src/enquiries/enquiries.service.ts:1303](../../backend/src/enquiries/enquiries.service.ts#L1303); EnquiriesService.enquiryAttachmentUploadRoot [backend/src/enquiries/enquiries.service.ts:1150](../../backend/src/enquiries/enquiries.service.ts#L1150); EnquiriesService.uniqueArchiveFileName [backend/src/enquiries/enquiries.service.ts:1349](../../backend/src/enquiries/enquiries.service.ts#L1349); EnquiriesService.safeFileName [backend/src/enquiries/enquiries.service.ts:1340](../../backend/src/enquiries/enquiries.service.ts#L1340).
- QA: apply Q-API for this ID and its workflow-specific cases; store status/body/DB diff with secrets removed.
- DTO field-access candidates: none resolved. These span reachable helpers and may include fields of internally composed DTOs; they are not a mandatory field list or complete wire schema. Match to the entry DTO and workflow before constructing requests.

## API-DB8CC420

**POST /api/enquiries/:id/attachments/upload** - EnquiriesController.uploadAttachmentFile

- Entry/auth: AuthGuard('jwt'); RolesGuard; fallback roles: OPERATING_TEAM, AML_SUPERVISOR, COMPANY_ADMIN, SUPER_ADMIN.
- Inputs: `@CurrentUser() user: RequestUser`; `@Param('id') id: string`; `@Body('documentType') documentType: string`; `@UploadedFile() file: { originalname: string; mimetype?: string; size: number; buffer?: Buffer }`.
- Output: JSON returned from delegated service; inferred fields in linked implementation. Inferred by TypeScript; no explicit response DTO.
- Behavior: Command (may mutate); detected reachable writes: enquiryAttachment.createMany.
- Tenant/role/state/validation helper candidates: tenantWhere, canModifyEnquiry, hasAnyRole.
- Error branch candidates: BadRequestException: 'Document type is required'); BadRequestException: 'Upload enquiry attachment files'); BadRequestException: 'This enquiry has already been submitted. Uploads are enabled again only after AML returns it to BD.'); NotFoundException: 'Enquiry not found'); ForbiddenException: 'Super admin must act within a tenant for this operation'); ForbiddenException: 'User is not assigned to a tenant').
- Evidence: [backend/src/enquiries/enquiries.controller.ts:92](../../backend/src/enquiries/enquiries.controller.ts#L92).
- Logic chain: EnquiriesService.uploadAttachmentFile [backend/src/enquiries/enquiries.service.ts:697](../../backend/src/enquiries/enquiries.service.ts#L697); EnquiriesService.uploadAttachmentFiles [backend/src/enquiries/enquiries.service.ts:741](../../backend/src/enquiries/enquiries.service.ts#L741); EnquiriesService.findOne [backend/src/enquiries/enquiries.service.ts:199](../../backend/src/enquiries/enquiries.service.ts#L199); EnquiriesService.tenantWhere [backend/src/enquiries/enquiries.service.ts:1009](../../backend/src/enquiries/enquiries.service.ts#L1009); EnquiriesService.getTenantId [backend/src/enquiries/enquiries.service.ts:1013](../../backend/src/enquiries/enquiries.service.ts#L1013); EnquiriesService.canModifyEnquiry [backend/src/enquiries/enquiries.service.ts:1025](../../backend/src/enquiries/enquiries.service.ts#L1025); EnquiriesService.hasAnyRole [backend/src/enquiries/enquiries.service.ts:1146](../../backend/src/enquiries/enquiries.service.ts#L1146); EnquiriesService.enquiryAttachmentUploadRoot [backend/src/enquiries/enquiries.service.ts:1150](../../backend/src/enquiries/enquiries.service.ts#L1150); EnquiriesService.safeFileName [backend/src/enquiries/enquiries.service.ts:1340](../../backend/src/enquiries/enquiries.service.ts#L1340).
- QA: apply Q-API for this ID and its workflow-specific cases; store status/body/DB diff with secrets removed.
- DTO field-access candidates: none resolved. These span reachable helpers and may include fields of internally composed DTOs; they are not a mandatory field list or complete wire schema. Match to the entry DTO and workflow before constructing requests.

## API-3509838E

**POST /api/enquiries/:id/attachments/upload-many** - EnquiriesController.uploadAttachmentFiles

- Entry/auth: AuthGuard('jwt'); RolesGuard; fallback roles: OPERATING_TEAM, AML_SUPERVISOR, COMPANY_ADMIN, SUPER_ADMIN.
- Inputs: `@CurrentUser() user: RequestUser`; `@Param('id') id: string`; `@Body('documentType') documentType: string`; `@UploadedFiles() files: Array<{ originalname: string; mimetype?: string; size: number; buffer?: Buffer }>`.
- Output: JSON returned from delegated service; inferred fields in linked implementation. Inferred by TypeScript; no explicit response DTO.
- Behavior: Command (may mutate); detected reachable writes: enquiryAttachment.createMany.
- Tenant/role/state/validation helper candidates: tenantWhere, canModifyEnquiry, hasAnyRole.
- Error branch candidates: BadRequestException: 'Document type is required'); BadRequestException: 'Upload enquiry attachment files'); BadRequestException: 'This enquiry has already been submitted. Uploads are enabled again only after AML returns it to BD.'); NotFoundException: 'Enquiry not found'); ForbiddenException: 'Super admin must act within a tenant for this operation'); ForbiddenException: 'User is not assigned to a tenant').
- Evidence: [backend/src/enquiries/enquiries.controller.ts:130](../../backend/src/enquiries/enquiries.controller.ts#L130).
- Logic chain: EnquiriesService.uploadAttachmentFiles [backend/src/enquiries/enquiries.service.ts:741](../../backend/src/enquiries/enquiries.service.ts#L741); EnquiriesService.findOne [backend/src/enquiries/enquiries.service.ts:199](../../backend/src/enquiries/enquiries.service.ts#L199); EnquiriesService.tenantWhere [backend/src/enquiries/enquiries.service.ts:1009](../../backend/src/enquiries/enquiries.service.ts#L1009); EnquiriesService.getTenantId [backend/src/enquiries/enquiries.service.ts:1013](../../backend/src/enquiries/enquiries.service.ts#L1013); EnquiriesService.canModifyEnquiry [backend/src/enquiries/enquiries.service.ts:1025](../../backend/src/enquiries/enquiries.service.ts#L1025); EnquiriesService.hasAnyRole [backend/src/enquiries/enquiries.service.ts:1146](../../backend/src/enquiries/enquiries.service.ts#L1146); EnquiriesService.enquiryAttachmentUploadRoot [backend/src/enquiries/enquiries.service.ts:1150](../../backend/src/enquiries/enquiries.service.ts#L1150); EnquiriesService.safeFileName [backend/src/enquiries/enquiries.service.ts:1340](../../backend/src/enquiries/enquiries.service.ts#L1340).
- QA: apply Q-API for this ID and its workflow-specific cases; store status/body/DB diff with secrets removed.
- DTO field-access candidates: none resolved. These span reachable helpers and may include fields of internally composed DTOs; they are not a mandatory field list or complete wire schema. Match to the entry DTO and workflow before constructing requests.

## API-838B7EDE

**POST /api/enquiries/:id/comments** - EnquiriesController.addComment

- Entry/auth: AuthGuard('jwt'); RolesGuard; fallback roles: OPERATING_TEAM, AML_TEAM, AML_SUPERVISOR, COMPANY_ADMIN, SUPER_ADMIN.
- Inputs: `@CurrentUser() user: RequestUser`; `@Param('id') id: string`; `@Body() dto: AddEnquiryCommentDto`.
- Output: JSON returned from delegated service; inferred fields in linked implementation. Inferred by TypeScript; no explicit response DTO.
- Behavior: Command (may mutate); detected reachable writes: enquiryComment.create.
- Tenant/role/state/validation helper candidates: tenantWhere.
- Error branch candidates: NotFoundException: 'Enquiry not found'); ForbiddenException: 'Super admin must act within a tenant for this operation'); ForbiddenException: 'User is not assigned to a tenant').
- Evidence: [backend/src/enquiries/enquiries.controller.ts:86](../../backend/src/enquiries/enquiries.controller.ts#L86).
- Logic chain: EnquiriesService.addComment [backend/src/enquiries/enquiries.service.ts:380](../../backend/src/enquiries/enquiries.service.ts#L380); EnquiriesService.findOne [backend/src/enquiries/enquiries.service.ts:199](../../backend/src/enquiries/enquiries.service.ts#L199); EnquiriesService.tenantWhere [backend/src/enquiries/enquiries.service.ts:1009](../../backend/src/enquiries/enquiries.service.ts#L1009); EnquiriesService.getTenantId [backend/src/enquiries/enquiries.service.ts:1013](../../backend/src/enquiries/enquiries.service.ts#L1013).
- QA: apply Q-API for this ID and its workflow-specific cases; store status/body/DB diff with secrets removed.
- DTO field-access candidates: body. These span reachable helpers and may include fields of internally composed DTOs; they are not a mandatory field list or complete wire schema. Match to the entry DTO and workflow before constructing requests.

## API-AAC19E27

**POST /api/enquiries/:id/convert-to-kyc** - EnquiriesController.convertToKyc

- Entry/auth: AuthGuard('jwt'); RolesGuard; fallback roles: AML_SUPERVISOR, COMPANY_ADMIN, SUPER_ADMIN.
- Inputs: `@CurrentUser() user: RequestUser`; `@Param('id') id: string`.
- Output: JSON returned from delegated service; inferred fields in linked implementation. Inferred by TypeScript; no explicit response DTO.
- Behavior: Command (may mutate); detected reachable writes: enquiry.updateMany, kycCase.update, kycCaseStatusHistory.create, client.create, clientService.upsert, kycCase.create, legalDocument.createMany, kycForm.create, kycShareholder.createMany, kycUbo.createMany, kycManager.createMany, kycSectionData.createMany, kycRequiredDocument.createMany, workflowComment.create, enquiry.update, enquiryStatusHistory.create.
- Tenant/role/state/validation helper candidates: tenantWhere, requiredDocumentRows, requiredJsonValue.
- Error branch candidates: BadRequestException: 'Unable to create KYC case from this enquiry. Confirm the latest database migrations are applied and try again.'); BadRequestException: 'Unable to create KYC case from this enquiry. Check the server log for the exact conversion error.'); BadRequestException: 'This enquiry has already been converted to a KYC case.'); BadRequestException: 'Mark the enquiry as ready for KYC before creating the KYC case.'); BadRequestException: 'This enquiry is no longer ready to resume its KYC case.'); NotFoundException: 'Enquiry not found'); ForbiddenException: 'Super admin must act within a tenant for this operation'); ForbiddenException: 'User is not assigned to a tenant'); BadRequestException: 'Ownership percentage must be a number between 0 and 100.').
- Evidence: [backend/src/enquiries/enquiries.controller.ts:62](../../backend/src/enquiries/enquiries.controller.ts#L62).
- Logic chain: EnquiriesService.convertToKyc [backend/src/enquiries/enquiries.service.ts:395](../../backend/src/enquiries/enquiries.service.ts#L395); EnquiriesService.convertToKycUnsafe [backend/src/enquiries/enquiries.service.ts:411](../../backend/src/enquiries/enquiries.service.ts#L411); EnquiriesService.findOne [backend/src/enquiries/enquiries.service.ts:199](../../backend/src/enquiries/enquiries.service.ts#L199); EnquiriesService.tenantWhere [backend/src/enquiries/enquiries.service.ts:1009](../../backend/src/enquiries/enquiries.service.ts#L1009); EnquiriesService.getTenantId [backend/src/enquiries/enquiries.service.ts:1013](../../backend/src/enquiries/enquiries.service.ts#L1013); EnquiriesService.enquiryDisplayName [backend/src/enquiries/enquiries.service.ts:1176](../../backend/src/enquiries/enquiries.service.ts#L1176); EnquiriesService.objectValue [backend/src/enquiries/enquiries.service.ts:1184](../../backend/src/enquiries/enquiries.service.ts#L1184); EnquiriesService.optionalText [backend/src/enquiries/enquiries.service.ts:1192](../../backend/src/enquiries/enquiries.service.ts#L1192); EnquiriesService.serviceDisplayName [backend/src/enquiries/enquiries.service.ts:1180](../../backend/src/enquiries/enquiries.service.ts#L1180); EnquiriesService.nextKycNumber [backend/src/enquiries/enquiries.service.ts:977](../../backend/src/enquiries/enquiries.service.ts#L977); EnquiriesService.copyEnquiryAttachmentToLegalDocuments [backend/src/enquiries/enquiries.service.ts:1322](../../backend/src/enquiries/enquiries.service.ts#L1322); EnquiriesService.resolveEnquiryAttachmentPath [backend/src/enquiries/enquiries.service.ts:1303](../../backend/src/enquiries/enquiries.service.ts#L1303); EnquiriesService.enquiryAttachmentUploadRoot [backend/src/enquiries/enquiries.service.ts:1150](../../backend/src/enquiries/enquiries.service.ts#L1150); EnquiriesService.legalDocumentUploadRoot [backend/src/enquiries/enquiries.service.ts:1154](../../backend/src/enquiries/enquiries.service.ts#L1154); EnquiriesService.safeFileName [backend/src/enquiries/enquiries.service.ts:1340](../../backend/src/enquiries/enquiries.service.ts#L1340); EnquiriesService.asArray [backend/src/enquiries/enquiries.service.ts:1188](../../backend/src/enquiries/enquiries.service.ts#L1188); EnquiriesService.ownershipPercentageValue [backend/src/enquiries/enquiries.service.ts:1196](../../backend/src/enquiries/enquiries.service.ts#L1196); EnquiriesService.preliminaryDate [backend/src/enquiries/enquiries.service.ts:1094](../../backend/src/enquiries/enquiries.service.ts#L1094); EnquiriesService.enquirySectionA [backend/src/enquiries/enquiries.service.ts:1213](../../backend/src/enquiries/enquiries.service.ts#L1213); EnquiriesService.enquirySectionE [backend/src/enquiries/enquiries.service.ts:1258](../../backend/src/enquiries/enquiries.service.ts#L1258); EnquiriesService.requiredDocumentRows [backend/src/enquiries/enquiries.service.ts:1274](../../backend/src/enquiries/enquiries.service.ts#L1274); EnquiriesService.isSameDocumentType [backend/src/enquiries/enquiries.service.ts:1296](../../backend/src/enquiries/enquiries.service.ts#L1296); EnquiriesService.requiredJsonValue [backend/src/enquiries/enquiries.service.ts:1005](../../backend/src/enquiries/enquiries.service.ts#L1005); EnquiriesService.logConvertFailure [backend/src/enquiries/enquiries.service.ts:1166](../../backend/src/enquiries/enquiries.service.ts#L1166).
- QA: apply Q-API for this ID and its workflow-specific cases; store status/body/DB diff with secrets removed.
- DTO field-access candidates: none resolved. These span reachable helpers and may include fields of internally composed DTOs; they are not a mandatory field list or complete wire schema. Match to the entry DTO and workflow before constructing requests.

## API-5586363A

**GET /api/enquiries/:id/preliminary-kyc** - EnquiriesController.getPreliminaryKyc

- Entry/auth: AuthGuard('jwt'); RolesGuard; fallback roles: none declared; authenticated-only when JWT applies.
- Inputs: `@CurrentUser() user: RequestUser`; `@Param('id') id: string`.
- Output: JSON returned from delegated service; inferred fields in linked implementation. Inferred by TypeScript; no explicit response DTO.
- Behavior: Read candidate (static scan only); detected reachable writes: none detected.
- Tenant/role/state/validation helper candidates: tenantWhere, assertProposedCompanyEnquiry.
- Error branch candidates: NotFoundException: 'Enquiry not found'); ForbiddenException: 'Super admin must act within a tenant for this operation'); ForbiddenException: 'User is not assigned to a tenant'); BadRequestException: 'Preliminary KYC is available only for Proposed Company - No Legal Status Yet enquiries.').
- Evidence: [backend/src/enquiries/enquiries.controller.ts:104](../../backend/src/enquiries/enquiries.controller.ts#L104).
- Logic chain: EnquiriesService.getPreliminaryKyc [backend/src/enquiries/enquiries.service.ts:707](../../backend/src/enquiries/enquiries.service.ts#L707); EnquiriesService.findOne [backend/src/enquiries/enquiries.service.ts:199](../../backend/src/enquiries/enquiries.service.ts#L199); EnquiriesService.tenantWhere [backend/src/enquiries/enquiries.service.ts:1009](../../backend/src/enquiries/enquiries.service.ts#L1009); EnquiriesService.getTenantId [backend/src/enquiries/enquiries.service.ts:1013](../../backend/src/enquiries/enquiries.service.ts#L1013); EnquiriesService.assertProposedCompanyEnquiry [backend/src/enquiries/enquiries.service.ts:1042](../../backend/src/enquiries/enquiries.service.ts#L1042); EnquiriesService.objectValue [backend/src/enquiries/enquiries.service.ts:1184](../../backend/src/enquiries/enquiries.service.ts#L1184); EnquiriesService.optionalText [backend/src/enquiries/enquiries.service.ts:1192](../../backend/src/enquiries/enquiries.service.ts#L1192).
- QA: apply Q-API for this ID and its workflow-specific cases; store status/body/DB diff with secrets removed.
- DTO field-access candidates: none resolved. These span reachable helpers and may include fields of internally composed DTOs; they are not a mandatory field list or complete wire schema. Match to the entry DTO and workflow before constructing requests.

## API-7A2D0CDF

**PATCH /api/enquiries/:id/preliminary-kyc** - EnquiriesController.savePreliminaryKyc

- Entry/auth: AuthGuard('jwt'); RolesGuard; fallback roles: OPERATING_TEAM, AML_TEAM, AML_SUPERVISOR, COMPANY_ADMIN, SUPER_ADMIN.
- Inputs: `@CurrentUser() user: RequestUser`; `@Param('id') id: string`; `@Body() dto: Record<string, unknown>`.
- Output: JSON returned from delegated service; inferred fields in linked implementation. Inferred by TypeScript; no explicit response DTO.
- Behavior: Command (may mutate); detected reachable writes: enquiry.update.
- Tenant/role/state/validation helper candidates: tenantWhere, assertProposedCompanyEnquiry, canModifyEnquiry, hasAnyRole, requiredJsonValue.
- Error branch candidates: BadRequestException: 'The Preliminary KYC form is locked after the enquiry is submitted. AML must return the enquiry before it can be edited.'); NotFoundException: 'Enquiry not found'); ForbiddenException: 'Super admin must act within a tenant for this operation'); ForbiddenException: 'User is not assigned to a tenant'); BadRequestException: 'Preliminary KYC is available only for Proposed Company - No Legal Status Yet enquiries.').
- Evidence: [backend/src/enquiries/enquiries.controller.ts:118](../../backend/src/enquiries/enquiries.controller.ts#L118).
- Logic chain: EnquiriesService.savePreliminaryKyc [backend/src/enquiries/enquiries.service.ts:716](../../backend/src/enquiries/enquiries.service.ts#L716); EnquiriesService.findOne [backend/src/enquiries/enquiries.service.ts:199](../../backend/src/enquiries/enquiries.service.ts#L199); EnquiriesService.tenantWhere [backend/src/enquiries/enquiries.service.ts:1009](../../backend/src/enquiries/enquiries.service.ts#L1009); EnquiriesService.getTenantId [backend/src/enquiries/enquiries.service.ts:1013](../../backend/src/enquiries/enquiries.service.ts#L1013); EnquiriesService.assertProposedCompanyEnquiry [backend/src/enquiries/enquiries.service.ts:1042](../../backend/src/enquiries/enquiries.service.ts#L1042); EnquiriesService.canModifyEnquiry [backend/src/enquiries/enquiries.service.ts:1025](../../backend/src/enquiries/enquiries.service.ts#L1025); EnquiriesService.hasAnyRole [backend/src/enquiries/enquiries.service.ts:1146](../../backend/src/enquiries/enquiries.service.ts#L1146); EnquiriesService.preliminaryKycData [backend/src/enquiries/enquiries.service.ts:1048](../../backend/src/enquiries/enquiries.service.ts#L1048); EnquiriesService.objectValue [backend/src/enquiries/enquiries.service.ts:1184](../../backend/src/enquiries/enquiries.service.ts#L1184); EnquiriesService.optionalText [backend/src/enquiries/enquiries.service.ts:1192](../../backend/src/enquiries/enquiries.service.ts#L1192); EnquiriesService.asArray [backend/src/enquiries/enquiries.service.ts:1188](../../backend/src/enquiries/enquiries.service.ts#L1188); EnquiriesService.preliminaryPersonFields [backend/src/enquiries/enquiries.service.ts:1103](../../backend/src/enquiries/enquiries.service.ts#L1103); EnquiriesService.requiredJsonValue [backend/src/enquiries/enquiries.service.ts:1005](../../backend/src/enquiries/enquiries.service.ts#L1005); EnquiriesService.getPreliminaryKyc [backend/src/enquiries/enquiries.service.ts:707](../../backend/src/enquiries/enquiries.service.ts#L707).
- QA: apply Q-API for this ID and its workflow-specific cases; store status/body/DB diff with secrets removed.
- DTO field-access candidates: businessActivity, companyName, contact, countryOfIncorporation, declaration, documents, expectedBusiness, jurisdiction, management, proposedLegalForm, registeredOfficeAddress, shareholders, sourceOfFunds, ubos. These span reachable helpers and may include fields of internally composed DTOs; they are not a mandatory field list or complete wire schema. Match to the entry DTO and workflow before constructing requests.

## API-8C410B0C

**POST /api/enquiries/:id/preliminary-kyc/complete** - EnquiriesController.completePreliminaryKyc

- Entry/auth: AuthGuard('jwt'); RolesGuard; fallback roles: OPERATING_TEAM, COMPANY_ADMIN, SUPER_ADMIN.
- Inputs: `@CurrentUser() user: RequestUser`; `@Param('id') id: string`; `@Body() dto: Record<string, unknown>`.
- Output: JSON returned from delegated service; inferred fields in linked implementation. Inferred by TypeScript; no explicit response DTO.
- Behavior: Command (may mutate); detected reachable writes: enquiry.update.
- Tenant/role/state/validation helper candidates: tenantWhere, assertProposedCompanyEnquiry, canModifyEnquiry, hasAnyRole, requiredJsonValue, assertCompletePreliminaryKyc.
- Error branch candidates: BadRequestException: 'The Preliminary KYC form is locked after the enquiry is submitted. AML must return the enquiry before it can be edited.'); NotFoundException: 'Enquiry not found'); ForbiddenException: 'Super admin must act within a tenant for this operation'); ForbiddenException: 'User is not assigned to a tenant'); BadRequestException: 'Preliminary KYC is available only for Proposed Company - No Legal Status Yet enquiries.'); BadRequestException: 'Complete all Preliminary KYC company details before submitting the enquiry.'); BadRequestException: 'Add at least one proposed shareholder with name and ownership percentage.'); BadRequestException: `Direct shareholder ownership must total 100%. Current total: ${total.toFixed(2)}%.`); BadRequestException: `Owners of ${overOwned.name} add up to ${overOwned.total.toFixed(2)}%. The owners of one company cannot exceed 100%.`); BadRequestException: 'Enter a UBO percentage for each beneficial owner linked to a corporate shareholder.'); BadRequestException: 'Add at least one proposed management or control person with name and position.'); BadRequestException: 'Confirm at least one required Preliminary KYC document is available.'); BadRequestException: 'Ownership percentage must be a number between 0 and 100.').
- Evidence: [backend/src/enquiries/enquiries.controller.ts:124](../../backend/src/enquiries/enquiries.controller.ts#L124).
- Logic chain: EnquiriesService.completePreliminaryKyc [backend/src/enquiries/enquiries.service.ts:730](../../backend/src/enquiries/enquiries.service.ts#L730); EnquiriesService.savePreliminaryKyc [backend/src/enquiries/enquiries.service.ts:716](../../backend/src/enquiries/enquiries.service.ts#L716); EnquiriesService.findOne [backend/src/enquiries/enquiries.service.ts:199](../../backend/src/enquiries/enquiries.service.ts#L199); EnquiriesService.tenantWhere [backend/src/enquiries/enquiries.service.ts:1009](../../backend/src/enquiries/enquiries.service.ts#L1009); EnquiriesService.getTenantId [backend/src/enquiries/enquiries.service.ts:1013](../../backend/src/enquiries/enquiries.service.ts#L1013); EnquiriesService.assertProposedCompanyEnquiry [backend/src/enquiries/enquiries.service.ts:1042](../../backend/src/enquiries/enquiries.service.ts#L1042); EnquiriesService.canModifyEnquiry [backend/src/enquiries/enquiries.service.ts:1025](../../backend/src/enquiries/enquiries.service.ts#L1025); EnquiriesService.hasAnyRole [backend/src/enquiries/enquiries.service.ts:1146](../../backend/src/enquiries/enquiries.service.ts#L1146); EnquiriesService.preliminaryKycData [backend/src/enquiries/enquiries.service.ts:1048](../../backend/src/enquiries/enquiries.service.ts#L1048); EnquiriesService.objectValue [backend/src/enquiries/enquiries.service.ts:1184](../../backend/src/enquiries/enquiries.service.ts#L1184); EnquiriesService.optionalText [backend/src/enquiries/enquiries.service.ts:1192](../../backend/src/enquiries/enquiries.service.ts#L1192); EnquiriesService.asArray [backend/src/enquiries/enquiries.service.ts:1188](../../backend/src/enquiries/enquiries.service.ts#L1188); EnquiriesService.preliminaryPersonFields [backend/src/enquiries/enquiries.service.ts:1103](../../backend/src/enquiries/enquiries.service.ts#L1103); EnquiriesService.requiredJsonValue [backend/src/enquiries/enquiries.service.ts:1005](../../backend/src/enquiries/enquiries.service.ts#L1005); EnquiriesService.getPreliminaryKyc [backend/src/enquiries/enquiries.service.ts:707](../../backend/src/enquiries/enquiries.service.ts#L707); EnquiriesService.assertCompletePreliminaryKyc [backend/src/enquiries/enquiries.service.ts:1112](../../backend/src/enquiries/enquiries.service.ts#L1112); EnquiriesService.ownershipPercentageValue [backend/src/enquiries/enquiries.service.ts:1196](../../backend/src/enquiries/enquiries.service.ts#L1196).
- QA: apply Q-API for this ID and its workflow-specific cases; store status/body/DB diff with secrets removed.
- DTO field-access candidates: businessActivity, companyName, contact, countryOfIncorporation, declaration, documents, expectedBusiness, jurisdiction, management, proposedLegalForm, registeredOfficeAddress, shareholders, sourceOfFunds, ubos. These span reachable helpers and may include fields of internally composed DTOs; they are not a mandatory field list or complete wire schema. Match to the entry DTO and workflow before constructing requests.

## API-3A245610

**GET /api/enquiries/:id/preliminary-kyc/pdf** - EnquiriesController.downloadPreliminaryPdf

- Entry/auth: AuthGuard('jwt'); RolesGuard; fallback roles: none declared; authenticated-only when JWT applies.
- Inputs: `@CurrentUser() user: RequestUser`; `@Param('id') id: string`; `@Res() response: Response`.
- Output: Response.send binary/HTML; see controller MIME and Content-Disposition. Inferred by TypeScript; no explicit response DTO.
- Behavior: Read candidate (static scan only); detected reachable writes: none detected.
- Tenant/role/state/validation helper candidates: tenantWhere, assertProposedCompanyEnquiry.
- Error branch candidates: BadRequestException: 'No Preliminary KYC form is available to download.'); NotFoundException: 'Enquiry not found'); ForbiddenException: 'Super admin must act within a tenant for this operation'); ForbiddenException: 'User is not assigned to a tenant'); BadRequestException: 'Preliminary KYC is available only for Proposed Company - No Legal Status Yet enquiries.').
- Evidence: [backend/src/enquiries/enquiries.controller.ts:109](../../backend/src/enquiries/enquiries.controller.ts#L109).
- Logic chain: EnquiriesService.downloadPreliminaryPdf [backend/src/enquiries/enquiries.service.ts:82](../../backend/src/enquiries/enquiries.service.ts#L82); EnquiriesService.getPreliminaryKyc [backend/src/enquiries/enquiries.service.ts:707](../../backend/src/enquiries/enquiries.service.ts#L707); EnquiriesService.findOne [backend/src/enquiries/enquiries.service.ts:199](../../backend/src/enquiries/enquiries.service.ts#L199); EnquiriesService.tenantWhere [backend/src/enquiries/enquiries.service.ts:1009](../../backend/src/enquiries/enquiries.service.ts#L1009); EnquiriesService.getTenantId [backend/src/enquiries/enquiries.service.ts:1013](../../backend/src/enquiries/enquiries.service.ts#L1013); EnquiriesService.assertProposedCompanyEnquiry [backend/src/enquiries/enquiries.service.ts:1042](../../backend/src/enquiries/enquiries.service.ts#L1042); EnquiriesService.objectValue [backend/src/enquiries/enquiries.service.ts:1184](../../backend/src/enquiries/enquiries.service.ts#L1184); EnquiriesService.optionalText [backend/src/enquiries/enquiries.service.ts:1192](../../backend/src/enquiries/enquiries.service.ts#L1192).
- QA: apply Q-API for this ID and its workflow-specific cases; store status/body/DB diff with secrets removed.
- DTO field-access candidates: none resolved. These span reachable helpers and may include fields of internally composed DTOs; they are not a mandatory field list or complete wire schema. Match to the entry DTO and workflow before constructing requests.

## API-F4305601

**PATCH /api/enquiries/:id/status** - EnquiriesController.updateStatus

- Entry/auth: AuthGuard('jwt'); RolesGuard; fallback roles: OPERATING_TEAM, AML_SUPERVISOR, COMPANY_ADMIN, SUPER_ADMIN.
- Inputs: `@CurrentUser() user: RequestUser`; `@Param('id') id: string`; `@Body() dto: UpdateEnquiryStatusDto`.
- Output: JSON returned from delegated service; inferred fields in linked implementation. Inferred by TypeScript; no explicit response DTO.
- Behavior: Command (may mutate); detected reachable writes: enquiry.update, enquiryStatusHistory.create, notification.createMany.
- Tenant/role/state/validation helper candidates: tenantWhere, assertCompletePreliminaryKyc, hasAnyRole.
- Error branch candidates: BadRequestException: 'This enquiry has already been converted to KYC and its status cannot be changed.'); BadRequestException: 'This enquiry has already been submitted to AML Supervisor.'); ForbiddenException: 'Only AML reviewers can return an enquiry to BD.'); ForbiddenException: 'Only AML reviewers can mark an enquiry ready for KYC.'); NotFoundException: 'Enquiry not found'); ForbiddenException: 'Super admin must act within a tenant for this operation'); ForbiddenException: 'User is not assigned to a tenant'); BadRequestException: 'Complete all Preliminary KYC company details before submitting the enquiry.'); BadRequestException: 'Add at least one proposed shareholder with name and ownership percentage.'); BadRequestException: `Direct shareholder ownership must total 100%. Current total: ${total.toFixed(2)}%.`); BadRequestException: `Owners of ${overOwned.name} add up to ${overOwned.total.toFixed(2)}%. The owners of one company cannot exceed 100%.`); BadRequestException: 'Enter a UBO percentage for each beneficial owner linked to a corporate shareholder.'); BadRequestException: 'Add at least one proposed management or control person with name and position.'); BadRequestException: 'Confirm at least one required Preliminary KYC document is available.'); BadRequestException: 'Ownership percentage must be a number between 0 and 100.').
- Evidence: [backend/src/enquiries/enquiries.controller.ts:80](../../backend/src/enquiries/enquiries.controller.ts#L80).
- Logic chain: EnquiriesService.updateStatus [backend/src/enquiries/enquiries.service.ts:286](../../backend/src/enquiries/enquiries.service.ts#L286); EnquiriesService.findOne [backend/src/enquiries/enquiries.service.ts:199](../../backend/src/enquiries/enquiries.service.ts#L199); EnquiriesService.tenantWhere [backend/src/enquiries/enquiries.service.ts:1009](../../backend/src/enquiries/enquiries.service.ts#L1009); EnquiriesService.getTenantId [backend/src/enquiries/enquiries.service.ts:1013](../../backend/src/enquiries/enquiries.service.ts#L1013); EnquiriesService.assertCompletePreliminaryKyc [backend/src/enquiries/enquiries.service.ts:1112](../../backend/src/enquiries/enquiries.service.ts#L1112); EnquiriesService.optionalText [backend/src/enquiries/enquiries.service.ts:1192](../../backend/src/enquiries/enquiries.service.ts#L1192); EnquiriesService.asArray [backend/src/enquiries/enquiries.service.ts:1188](../../backend/src/enquiries/enquiries.service.ts#L1188); EnquiriesService.ownershipPercentageValue [backend/src/enquiries/enquiries.service.ts:1196](../../backend/src/enquiries/enquiries.service.ts#L1196); EnquiriesService.objectValue [backend/src/enquiries/enquiries.service.ts:1184](../../backend/src/enquiries/enquiries.service.ts#L1184); EnquiriesService.enquiryDisplayName [backend/src/enquiries/enquiries.service.ts:1176](../../backend/src/enquiries/enquiries.service.ts#L1176); EnquiriesService.hasAnyRole [backend/src/enquiries/enquiries.service.ts:1146](../../backend/src/enquiries/enquiries.service.ts#L1146).
- QA: apply Q-API for this ID and its workflow-specific cases; store status/body/DB diff with secrets removed.
- DTO field-access candidates: note, status. These span reachable helpers and may include fields of internally composed DTOs; they are not a mandatory field list or complete wire schema. Match to the entry DTO and workflow before constructing requests.

## API-B6E04457

**POST /api/enquiries/company-documents/read** - EnquiriesController.readCompanyDocument

- Entry/auth: AuthGuard('jwt'); RolesGuard; fallback roles: OPERATING_TEAM, AML_SUPERVISOR, COMPANY_ADMIN, SUPER_ADMIN.
- Inputs: `@CurrentUser() user: RequestUser`; `@UploadedFiles() files: Array<{ originalname: string; mimetype: string; size: number; buffer: Buffer }>`.
- Output: JSON returned from delegated service; inferred fields in linked implementation. Inferred by TypeScript; no explicit response DTO.
- Behavior: Command (may mutate); detected reachable writes: none detected.
- Tenant/role/state/validation helper candidates: none detected; inspect implementation before acceptance.
- Error branch candidates: BadRequestException: 'Select one file to read.'); BadRequestException: 'Document reading is not available.').
- Evidence: [backend/src/enquiries/enquiries.controller.ts:55](../../backend/src/enquiries/enquiries.controller.ts#L55).
- Logic chain: EnquiriesService.readCompanyDocument [backend/src/enquiries/enquiries.service.ts:75](../../backend/src/enquiries/enquiries.service.ts#L75).
- QA: apply Q-API for this ID and its workflow-specific cases; store status/body/DB diff with secrets removed.
- DTO field-access candidates: none resolved. These span reachable helpers and may include fields of internally composed DTOs; they are not a mandatory field list or complete wire schema. Match to the entry DTO and workflow before constructing requests.

## API-4B16817C

**GET /api/enquiries/duplicate-check** - EnquiriesController.duplicateCheck

- Entry/auth: AuthGuard('jwt'); RolesGuard; fallback roles: OPERATING_TEAM, AML_SUPERVISOR, COMPANY_ADMIN, SUPER_ADMIN.
- Inputs: `@CurrentUser() user: RequestUser`; `@Query('enquiryType') enquiryType?: string`; `@Query('name') name?: string`; `@Query('clientId') clientId?: string`; `@Query('excludeId') excludeId?: string`.
- Output: JSON returned from delegated service; inferred fields in linked implementation. Inferred by TypeScript; no explicit response DTO.
- Behavior: Read candidate (static scan only); detected reachable writes: none detected.
- Tenant/role/state/validation helper candidates: none detected; inspect implementation before acceptance.
- Error branch candidates: ForbiddenException: 'Super admin must act within a tenant for this operation'); ForbiddenException: 'User is not assigned to a tenant').
- Evidence: [backend/src/enquiries/enquiries.controller.ts:32](../../backend/src/enquiries/enquiries.controller.ts#L32).
- Logic chain: EnquiriesService.findOpenDuplicate [backend/src/enquiries/enquiries.service.ts:882](../../backend/src/enquiries/enquiries.service.ts#L882); EnquiriesService.getTenantId [backend/src/enquiries/enquiries.service.ts:1013](../../backend/src/enquiries/enquiries.service.ts#L1013); EnquiriesService.openDuplicate [backend/src/enquiries/enquiries.service.ts:907](../../backend/src/enquiries/enquiries.service.ts#L907); EnquiriesService.duplicateMessage [backend/src/enquiries/enquiries.service.ts:946](../../backend/src/enquiries/enquiries.service.ts#L946).
- QA: apply Q-API for this ID and its workflow-specific cases; store status/body/DB diff with secrets removed.
- DTO field-access candidates: none resolved. These span reachable helpers and may include fields of internally composed DTOs; they are not a mandatory field list or complete wire schema. Match to the entry DTO and workflow before constructing requests.

## API-3D6499D5

**POST /api/enquiries/identity-documents/read** - EnquiriesController.readIdentityDocument

- Entry/auth: AuthGuard('jwt'); RolesGuard; fallback roles: OPERATING_TEAM, AML_SUPERVISOR, COMPANY_ADMIN, SUPER_ADMIN.
- Inputs: `@Body('identityType') identityType: string \| undefined`; `@UploadedFiles() files: Array<{ originalname: string; mimetype: string; size: number; buffer: Buffer }>`.
- Output: JSON returned from delegated service; inferred fields in linked implementation. Inferred by TypeScript; no explicit response DTO.
- Behavior: Command (may mutate); detected reachable writes: none detected.
- Tenant/role/state/validation helper candidates: none detected; inspect implementation before acceptance.
- Error branch candidates: BadRequestException: 'Select one file to read.').
- Evidence: [backend/src/enquiries/enquiries.controller.ts:46](../../backend/src/enquiries/enquiries.controller.ts#L46).
- Logic chain: EnquiriesService.readIdentityDocument [backend/src/enquiries/enquiries.service.ts:58](../../backend/src/enquiries/enquiries.service.ts#L58).
- QA: apply Q-API for this ID and its workflow-specific cases; store status/body/DB diff with secrets removed.
- DTO field-access candidates: none resolved. These span reachable helpers and may include fields of internally composed DTOs; they are not a mandatory field list or complete wire schema. Match to the entry DTO and workflow before constructing requests.

## API-69E2E58A

**GET /api/health** - AppController.health

- Entry/auth: No controller/method guard detected (public); fallback roles: none declared; authenticated-only when JWT applies.
- Inputs: none.
- Output: JSON returned from delegated service; inferred fields in linked implementation. Inferred by TypeScript; no explicit response DTO.
- Behavior: Read candidate (static scan only); detected reachable writes: none detected.
- Tenant/role/state/validation helper candidates: none detected; inspect implementation before acceptance.
- Error branch candidates: none explicitly thrown in resolved methods; global errors still apply.
- Evidence: [backend/src/app.controller.ts:5](../../backend/src/app.controller.ts#L5).
- Logic chain: Controller-only implementation.
- QA: apply Q-API for this ID and its workflow-specific cases; store status/body/DB diff with secrets removed.
- DTO field-access candidates: none resolved. These span reachable helpers and may include fields of internally composed DTOs; they are not a mandatory field list or complete wire schema. Match to the entry DTO and workflow before constructing requests.

## API-3FD10834

**GET /api/kyc** - KycController.findAll

- Entry/auth: AuthGuard('jwt'); RolesGuard; fallback roles: none declared; authenticated-only when JWT applies.
- Inputs: `@CurrentUser() user: RequestUser`.
- Output: JSON returned from delegated service; inferred fields in linked implementation. Inferred by TypeScript; no explicit response DTO.
- Behavior: Read candidate (static scan only); detected reachable writes: none detected.
- Tenant/role/state/validation helper candidates: tenantWhere.
- Error branch candidates: ForbiddenException: 'User is not assigned to a tenant').
- Evidence: [backend/src/kyc/kyc.controller.ts:24](../../backend/src/kyc/kyc.controller.ts#L24).
- Logic chain: KycService.findAll [backend/src/kyc/kyc.service.ts:136](../../backend/src/kyc/kyc.service.ts#L136); KycService.tenantWhere [backend/src/kyc/kyc.service.ts:2922](../../backend/src/kyc/kyc.service.ts#L2922); KycService.getTenantId [backend/src/kyc/kyc.service.ts:2947](../../backend/src/kyc/kyc.service.ts#L2947); KycService.caseInclude [backend/src/kyc/kyc.service.ts:4020](../../backend/src/kyc/kyc.service.ts#L4020); KycService.withKycNumber [backend/src/kyc/kyc.service.ts:3978](../../backend/src/kyc/kyc.service.ts#L3978); KycService.generatedKycNumber [backend/src/kyc/kyc.service.ts:3962](../../backend/src/kyc/kyc.service.ts#L3962).
- QA: apply Q-API for this ID and its workflow-specific cases; store status/body/DB diff with secrets removed.
- DTO field-access candidates: none resolved. These span reachable helpers and may include fields of internally composed DTOs; they are not a mandatory field list or complete wire schema. Match to the entry DTO and workflow before constructing requests.

## API-F3EDD356

**POST /api/kyc** - KycController.create

- Entry/auth: AuthGuard('jwt'); RolesGuard; fallback roles: OPERATING_TEAM, COMPANY_ADMIN.
- Inputs: `@CurrentUser() user: RequestUser`; `@Body() dto: CreateKycCaseDto`.
- Output: JSON returned from delegated service; inferred fields in linked implementation. Inferred by TypeScript; no explicit response DTO.
- Behavior: Command (may mutate); detected reachable writes: clientService.upsert, kycCase.create, kycCaseStatusHistory.create.
- Tenant/role/state/validation helper candidates: none detected; inspect implementation before acceptance.
- Error branch candidates: NotFoundException: 'Client not found'); ForbiddenException: 'User is not assigned to a tenant').
- Evidence: [backend/src/kyc/kyc.controller.ts:29](../../backend/src/kyc/kyc.controller.ts#L29).
- Logic chain: KycService.create [backend/src/kyc/kyc.service.ts:185](../../backend/src/kyc/kyc.service.ts#L185); KycService.getTenantId [backend/src/kyc/kyc.service.ts:2947](../../backend/src/kyc/kyc.service.ts#L2947); KycService.nextKycNumber [backend/src/kyc/kyc.service.ts:2926](../../backend/src/kyc/kyc.service.ts#L2926); KycService.caseInclude [backend/src/kyc/kyc.service.ts:4020](../../backend/src/kyc/kyc.service.ts#L4020).
- QA: apply Q-API for this ID and its workflow-specific cases; store status/body/DB diff with secrets removed.
- DTO field-access candidates: clientId, serviceName, title. These span reachable helpers and may include fields of internally composed DTOs; they are not a mandatory field list or complete wire schema. Match to the entry DTO and workflow before constructing requests.

## API-BF74970E

**DELETE /api/kyc/:id** - KycController.remove

- Entry/auth: AuthGuard('jwt'); RolesGuard; fallback roles: COMPANY_ADMIN, SUPER_ADMIN.
- Inputs: `@CurrentUser() user: RequestUser`; `@Param('id') id: string`.
- Output: JSON returned from delegated service; inferred fields in linked implementation. Inferred by TypeScript; no explicit response DTO.
- Behavior: Command (may mutate); detected reachable writes: auditLog.create, kycCase.delete.
- Tenant/role/state/validation helper candidates: requireWritableCase, tenantWhere, isLegacyFullKycDraft, formTenantWhere.
- Error branch candidates: NotFoundException: 'KYC case not found'); BadRequestException: 'KYC preparation is locked while the case is under DMLRO, MLRO, or SEF review. It can be edited again only after DMLRO returns it to the AML Supervisor.'); ForbiddenException: 'User is not assigned to a tenant').
- Evidence: [backend/src/kyc/kyc.controller.ts:58](../../backend/src/kyc/kyc.controller.ts#L58).
- Logic chain: KycService.remove [backend/src/kyc/kyc.service.ts:276](../../backend/src/kyc/kyc.service.ts#L276); KycService.requireWritableCase [backend/src/kyc/kyc.service.ts:2819](../../backend/src/kyc/kyc.service.ts#L2819); KycService.tenantWhere [backend/src/kyc/kyc.service.ts:2922](../../backend/src/kyc/kyc.service.ts#L2922); KycService.getTenantId [backend/src/kyc/kyc.service.ts:2947](../../backend/src/kyc/kyc.service.ts#L2947); KycService.isPreparationEditableStatus [backend/src/kyc/kyc.service.ts:2841](../../backend/src/kyc/kyc.service.ts#L2841); KycService.isLegacyFullKycDraft [backend/src/kyc/kyc.service.ts:2835](../../backend/src/kyc/kyc.service.ts#L2835); KycService.formTenantWhere [backend/src/kyc/kyc.service.ts:2939](../../backend/src/kyc/kyc.service.ts#L2939).
- QA: apply Q-API for this ID and its workflow-specific cases; store status/body/DB diff with secrets removed.
- DTO field-access candidates: none resolved. These span reachable helpers and may include fields of internally composed DTOs; they are not a mandatory field list or complete wire schema. Match to the entry DTO and workflow before constructing requests.

## API-157E465A

**GET /api/kyc/:id** - KycController.findOne

- Entry/auth: AuthGuard('jwt'); RolesGuard; fallback roles: none declared; authenticated-only when JWT applies.
- Inputs: `@CurrentUser() user: RequestUser`; `@Param('id') id: string`.
- Output: JSON returned from delegated service; inferred fields in linked implementation. Inferred by TypeScript; no explicit response DTO.
- Behavior: Read candidate (static scan only); detected reachable writes: none detected.
- Tenant/role/state/validation helper candidates: tenantWhere.
- Error branch candidates: NotFoundException: 'KYC case not found'); ForbiddenException: 'User is not assigned to a tenant').
- Evidence: [backend/src/kyc/kyc.controller.ts:47](../../backend/src/kyc/kyc.controller.ts#L47).
- Logic chain: KycService.findOne [backend/src/kyc/kyc.service.ts:148](../../backend/src/kyc/kyc.service.ts#L148); KycService.tenantWhere [backend/src/kyc/kyc.service.ts:2922](../../backend/src/kyc/kyc.service.ts#L2922); KycService.getTenantId [backend/src/kyc/kyc.service.ts:2947](../../backend/src/kyc/kyc.service.ts#L2947); KycService.caseInclude [backend/src/kyc/kyc.service.ts:4020](../../backend/src/kyc/kyc.service.ts#L4020); KycService.withKycNumber [backend/src/kyc/kyc.service.ts:3978](../../backend/src/kyc/kyc.service.ts#L3978); KycService.generatedKycNumber [backend/src/kyc/kyc.service.ts:3962](../../backend/src/kyc/kyc.service.ts#L3962).
- QA: apply Q-API for this ID and its workflow-specific cases; store status/body/DB diff with secrets removed.
- DTO field-access candidates: none resolved. These span reachable helpers and may include fields of internally composed DTOs; they are not a mandatory field list or complete wire schema. Match to the entry DTO and workflow before constructing requests.

## API-8FD7BC30

**PATCH /api/kyc/:id** - KycController.update

- Entry/auth: AuthGuard('jwt'); RolesGuard; fallback roles: COMPANY_ADMIN, SUPER_ADMIN.
- Inputs: `@CurrentUser() user: RequestUser`; `@Param('id') id: string`; `@Body() dto: UpdateKycCaseDto`.
- Output: JSON returned from delegated service; inferred fields in linked implementation. Inferred by TypeScript; no explicit response DTO.
- Behavior: Command (may mutate); detected reachable writes: clientService.upsert, kycCase.update.
- Tenant/role/state/validation helper candidates: requireWritableCase, tenantWhere, isLegacyFullKycDraft, formTenantWhere.
- Error branch candidates: NotFoundException: 'Client not found'); NotFoundException: 'KYC case not found'); BadRequestException: 'KYC preparation is locked while the case is under DMLRO, MLRO, or SEF review. It can be edited again only after DMLRO returns it to the AML Supervisor.'); ForbiddenException: 'User is not assigned to a tenant').
- Evidence: [backend/src/kyc/kyc.controller.ts:52](../../backend/src/kyc/kyc.controller.ts#L52).
- Logic chain: KycService.update [backend/src/kyc/kyc.service.ts:237](../../backend/src/kyc/kyc.service.ts#L237); KycService.requireWritableCase [backend/src/kyc/kyc.service.ts:2819](../../backend/src/kyc/kyc.service.ts#L2819); KycService.tenantWhere [backend/src/kyc/kyc.service.ts:2922](../../backend/src/kyc/kyc.service.ts#L2922); KycService.getTenantId [backend/src/kyc/kyc.service.ts:2947](../../backend/src/kyc/kyc.service.ts#L2947); KycService.isPreparationEditableStatus [backend/src/kyc/kyc.service.ts:2841](../../backend/src/kyc/kyc.service.ts#L2841); KycService.isLegacyFullKycDraft [backend/src/kyc/kyc.service.ts:2835](../../backend/src/kyc/kyc.service.ts#L2835); KycService.formTenantWhere [backend/src/kyc/kyc.service.ts:2939](../../backend/src/kyc/kyc.service.ts#L2939); KycService.caseInclude [backend/src/kyc/kyc.service.ts:4020](../../backend/src/kyc/kyc.service.ts#L4020).
- QA: apply Q-API for this ID and its workflow-specific cases; store status/body/DB diff with secrets removed.
- DTO field-access candidates: clientId, serviceName, title. These span reachable helpers and may include fields of internally composed DTOs; they are not a mandatory field list or complete wire schema. Match to the entry DTO and workflow before constructing requests.

## API-07738DF5

**GET /api/kyc/:id/activation-readiness** - KycController.activationReadiness

- Entry/auth: AuthGuard('jwt'); RolesGuard; fallback roles: none declared; authenticated-only when JWT applies.
- Inputs: `@CurrentUser() user: RequestUser`; `@Param('id') id: string`.
- Output: JSON returned from delegated service; inferred fields in linked implementation. Inferred by TypeScript; no explicit response DTO.
- Behavior: GET WITH SIDE EFFECTS; detected reachable writes: clientActivationChecklist.upsert.
- Tenant/role/state/validation helper candidates: tenantWhere.
- Error branch candidates: NotFoundException: 'KYC case not found'); ForbiddenException: 'User is not assigned to a tenant').
- Evidence: [backend/src/kyc/kyc.controller.ts:392](../../backend/src/kyc/kyc.controller.ts#L392).
- Logic chain: KycService.recalculateActivationReadiness [backend/src/kyc/kyc.service.ts:1266](../../backend/src/kyc/kyc.service.ts#L1266); KycService.tenantWhere [backend/src/kyc/kyc.service.ts:2922](../../backend/src/kyc/kyc.service.ts#L2922); KycService.getTenantId [backend/src/kyc/kyc.service.ts:2947](../../backend/src/kyc/kyc.service.ts#L2947); KycService.activationChecklistItems [backend/src/kyc/kyc.service.ts:3614](../../backend/src/kyc/kyc.service.ts#L3614); KycService.jsonValue [backend/src/kyc/kyc.service.ts:3872](../../backend/src/kyc/kyc.service.ts#L3872).
- QA: apply Q-API for this ID and its workflow-specific cases; store status/body/DB diff with secrets removed.
- DTO field-access candidates: none resolved. These span reachable helpers and may include fields of internally composed DTOs; they are not a mandatory field list or complete wire schema. Match to the entry DTO and workflow before constructing requests.

## API-AF4E1C0A

**POST /api/kyc/:id/amendments** - KycController.startAmendment

- Entry/auth: AuthGuard('jwt'); RolesGuard; fallback roles: AML_SUPERVISOR, AML_TEAM, DMLRO, MLRO, SEF, COMPANY_ADMIN, SUPER_ADMIN.
- Inputs: `@CurrentUser() user: RequestUser`; `@Param('id') id: string`; `@Body() dto: Record<string, unknown>`.
- Output: JSON returned from delegated service; inferred fields in linked implementation. Inferred by TypeScript; no explicit response DTO.
- Behavior: Command (may mutate); detected reachable writes: internalReviewSubmission.updateMany, internalReviewTask.deleteMany, workflowComment.create, kycFormRevision.create, kycRevisionFile.create, kycSectionData.upsert, kycForm.update, kycInternalReview.updateMany, signedKycDocument.updateMany, auditLog.create, kycCase.update, kycCaseStatusHistory.create.
- Tenant/role/state/validation helper candidates: tenantWhere, assertFinalApprovalReceived, hasAnyRole.
- Error branch candidates: ForbiddenException: 'The final KYC decision must be completed by the approving MLRO or SEF role.'); BadRequestException: 'Select at least one KYC section to amend.'); BadRequestException: 'Provide the amendment reason.'); NotFoundException: 'KYC case not found'); ForbiddenException: 'User is not assigned to a tenant'); BadRequestException: 'The final KYC decision is available only after all required approvals are completed.'); BadRequestException: 'The case changed during this action. Refresh before trying again.'); BadRequestException: 'Create the KYC form before opening an amendment.').
- Evidence: [backend/src/kyc/kyc.controller.ts:425](../../backend/src/kyc/kyc.controller.ts#L425).
- Logic chain: KycService.startAmendment [backend/src/kyc/kyc.service.ts:1597](../../backend/src/kyc/kyc.service.ts#L1597); KycService.findOne [backend/src/kyc/kyc.service.ts:148](../../backend/src/kyc/kyc.service.ts#L148); KycService.tenantWhere [backend/src/kyc/kyc.service.ts:2922](../../backend/src/kyc/kyc.service.ts#L2922); KycService.getTenantId [backend/src/kyc/kyc.service.ts:2947](../../backend/src/kyc/kyc.service.ts#L2947); KycService.caseInclude [backend/src/kyc/kyc.service.ts:4020](../../backend/src/kyc/kyc.service.ts#L4020); KycService.withKycNumber [backend/src/kyc/kyc.service.ts:3978](../../backend/src/kyc/kyc.service.ts#L3978); KycService.generatedKycNumber [backend/src/kyc/kyc.service.ts:3962](../../backend/src/kyc/kyc.service.ts#L3962); KycService.assertFinalApprovalReceived [backend/src/kyc/kyc.service.ts:1826](../../backend/src/kyc/kyc.service.ts#L1826); KycService.hasAnyRole [backend/src/kyc/kyc.service.ts:2959](../../backend/src/kyc/kyc.service.ts#L2959); KycService.optionalText [backend/src/kyc/kyc.service.ts:3838](../../backend/src/kyc/kyc.service.ts#L3838); KycService.text [backend/src/kyc/kyc.service.ts:3885](../../backend/src/kyc/kyc.service.ts#L3885); KycService.beginFormAmendment [backend/src/kyc/kyc.service.ts:1472](../../backend/src/kyc/kyc.service.ts#L1472); KycService.formInclude [backend/src/kyc/kyc.service.ts:2597](../../backend/src/kyc/kyc.service.ts#L2597); KycService.serializeForm [backend/src/kyc/kyc.service.ts:2534](../../backend/src/kyc/kyc.service.ts#L2534); KycService.sectionRows [backend/src/kyc/kyc.service.ts:2625](../../backend/src/kyc/kyc.service.ts#L2625); KycService.asArray [backend/src/kyc/kyc.service.ts:3823](../../backend/src/kyc/kyc.service.ts#L3823); KycService.sectionFWithCaseDocuments [backend/src/kyc/kyc.service.ts:2630](../../backend/src/kyc/kyc.service.ts#L2630); KycService.dedupeRequiredDocumentRows [backend/src/kyc/kyc.service.ts:2712](../../backend/src/kyc/kyc.service.ts#L2712); KycService.documentMatchText [backend/src/kyc/kyc.service.ts:2809](../../backend/src/kyc/kyc.service.ts#L2809); KycService.documentFileNames [backend/src/kyc/kyc.service.ts:2773](../../backend/src/kyc/kyc.service.ts#L2773); KycService.isRequiredDocumentMatch [backend/src/kyc/kyc.service.ts:2788](../../backend/src/kyc/kyc.service.ts#L2788); KycService.dedupeAdditionalDocumentRows [backend/src/kyc/kyc.service.ts:2754](../../backend/src/kyc/kyc.service.ts#L2754); KycService.jsonValue [backend/src/kyc/kyc.service.ts:3872](../../backend/src/kyc/kyc.service.ts#L3872); KycService.resolveLegalDocumentPath [backend/src/kyc/kyc.service.ts:3913](../../backend/src/kyc/kyc.service.ts#L3913); KycService.legalDocumentUploadRoot [backend/src/kyc/kyc.service.ts:3905](../../backend/src/kyc/kyc.service.ts#L3905); KycService.signedKycDocumentUploadRoot [backend/src/kyc/kyc.service.ts:3909](../../backend/src/kyc/kyc.service.ts#L3909); KycService.audit [backend/src/kyc/kyc.service.ts:3485](../../backend/src/kyc/kyc.service.ts#L3485); KycService.recordStatus [backend/src/kyc/kyc.service.ts:3461](../../backend/src/kyc/kyc.service.ts#L3461).
- QA: apply Q-API for this ID and its workflow-specific cases; store status/body/DB diff with secrets removed.
- DTO field-access candidates: reason, sections. These span reachable helpers and may include fields of internally composed DTOs; they are not a mandatory field list or complete wire schema. Match to the entry DTO and workflow before constructing requests.

## API-7B6EA1C6

**POST /api/kyc/:id/comments** - KycController.addComment

- Entry/auth: AuthGuard('jwt'); RolesGuard; fallback roles: none declared; authenticated-only when JWT applies.
- Inputs: `@CurrentUser() user: RequestUser`; `@Param('id') id: string`; `@Body() dto: AddWorkflowCommentDto`.
- Output: JSON returned from delegated service; inferred fields in linked implementation. Inferred by TypeScript; no explicit response DTO.
- Behavior: Command (may mutate); detected reachable writes: workflowComment.create.
- Tenant/role/state/validation helper candidates: tenantWhere.
- Error branch candidates: NotFoundException: 'KYC case not found'); ForbiddenException: 'User is not assigned to a tenant').
- Evidence: [backend/src/kyc/kyc.controller.ts:397](../../backend/src/kyc/kyc.controller.ts#L397).
- Logic chain: KycService.addComment [backend/src/kyc/kyc.service.ts:1305](../../backend/src/kyc/kyc.service.ts#L1305); KycService.findOne [backend/src/kyc/kyc.service.ts:148](../../backend/src/kyc/kyc.service.ts#L148); KycService.tenantWhere [backend/src/kyc/kyc.service.ts:2922](../../backend/src/kyc/kyc.service.ts#L2922); KycService.getTenantId [backend/src/kyc/kyc.service.ts:2947](../../backend/src/kyc/kyc.service.ts#L2947); KycService.caseInclude [backend/src/kyc/kyc.service.ts:4020](../../backend/src/kyc/kyc.service.ts#L4020); KycService.withKycNumber [backend/src/kyc/kyc.service.ts:3978](../../backend/src/kyc/kyc.service.ts#L3978); KycService.generatedKycNumber [backend/src/kyc/kyc.service.ts:3962](../../backend/src/kyc/kyc.service.ts#L3962).
- QA: apply Q-API for this ID and its workflow-specific cases; store status/body/DB diff with secrets removed.
- DTO field-access candidates: body. These span reachable helpers and may include fields of internally composed DTOs; they are not a mandatory field list or complete wire schema. Match to the entry DTO and workflow before constructing requests.

## API-C8A169F1

**POST /api/kyc/:id/engagement-decision** - KycController.completeEngagementDecision

- Entry/auth: AuthGuard('jwt'); RolesGuard; fallback roles: OPERATING_TEAM, COMPANY_ADMIN, SUPER_ADMIN.
- Inputs: `@CurrentUser() user: RequestUser`; `@Param('id') id: string`; `@Body() dto: Record<string, unknown>`.
- Output: JSON returned from delegated service; inferred fields in linked implementation. Inferred by TypeScript; no explicit response DTO.
- Behavior: Command (may mutate); detected reachable writes: client.update, clientEngagement.update, clientEngagement.create, auditLog.create, kycCase.update, kycCaseStatusHistory.create.
- Tenant/role/state/validation helper candidates: tenantWhere, enumValue.
- Error branch candidates: BadRequestException: 'The KYC file must receive final approval before the engagement decision.'); BadRequestException: 'Upload the signed engagement letter before completing the engagement decision.'); BadRequestException: 'Provide a reason for rejecting or placing the engagement on hold.'); NotFoundException: 'KYC case not found'); ForbiddenException: 'User is not assigned to a tenant'); BadRequestException: `${label} must be one of ${allowed.join(', ')}`).
- Evidence: [backend/src/kyc/kyc.controller.ts:413](../../backend/src/kyc/kyc.controller.ts#L413).
- Logic chain: KycService.completeEngagementDecision [backend/src/kyc/kyc.service.ts:1320](../../backend/src/kyc/kyc.service.ts#L1320); KycService.findOne [backend/src/kyc/kyc.service.ts:148](../../backend/src/kyc/kyc.service.ts#L148); KycService.tenantWhere [backend/src/kyc/kyc.service.ts:2922](../../backend/src/kyc/kyc.service.ts#L2922); KycService.getTenantId [backend/src/kyc/kyc.service.ts:2947](../../backend/src/kyc/kyc.service.ts#L2947); KycService.caseInclude [backend/src/kyc/kyc.service.ts:4020](../../backend/src/kyc/kyc.service.ts#L4020); KycService.withKycNumber [backend/src/kyc/kyc.service.ts:3978](../../backend/src/kyc/kyc.service.ts#L3978); KycService.generatedKycNumber [backend/src/kyc/kyc.service.ts:3962](../../backend/src/kyc/kyc.service.ts#L3962); KycService.enumValue [backend/src/kyc/kyc.service.ts:3815](../../backend/src/kyc/kyc.service.ts#L3815); KycService.optionalText [backend/src/kyc/kyc.service.ts:3838](../../backend/src/kyc/kyc.service.ts#L3838); KycService.text [backend/src/kyc/kyc.service.ts:3885](../../backend/src/kyc/kyc.service.ts#L3885); KycService.activateComplianceClient [backend/src/kyc/kyc.service.ts:1369](../../backend/src/kyc/kyc.service.ts#L1369); KycService.syncClientRecords [backend/src/kyc/kyc.service.ts:1708](../../backend/src/kyc/kyc.service.ts#L1708); KycService.formInclude [backend/src/kyc/kyc.service.ts:2597](../../backend/src/kyc/kyc.service.ts#L2597); KycService.serializeForm [backend/src/kyc/kyc.service.ts:2534](../../backend/src/kyc/kyc.service.ts#L2534); KycService.sectionRows [backend/src/kyc/kyc.service.ts:2625](../../backend/src/kyc/kyc.service.ts#L2625); KycService.asArray [backend/src/kyc/kyc.service.ts:3823](../../backend/src/kyc/kyc.service.ts#L3823); KycService.sectionFWithCaseDocuments [backend/src/kyc/kyc.service.ts:2630](../../backend/src/kyc/kyc.service.ts#L2630); KycService.dedupeRequiredDocumentRows [backend/src/kyc/kyc.service.ts:2712](../../backend/src/kyc/kyc.service.ts#L2712); KycService.documentMatchText [backend/src/kyc/kyc.service.ts:2809](../../backend/src/kyc/kyc.service.ts#L2809); KycService.documentFileNames [backend/src/kyc/kyc.service.ts:2773](../../backend/src/kyc/kyc.service.ts#L2773); KycService.isRequiredDocumentMatch [backend/src/kyc/kyc.service.ts:2788](../../backend/src/kyc/kyc.service.ts#L2788); KycService.dedupeAdditionalDocumentRows [backend/src/kyc/kyc.service.ts:2754](../../backend/src/kyc/kyc.service.ts#L2754); KycService.audit [backend/src/kyc/kyc.service.ts:3485](../../backend/src/kyc/kyc.service.ts#L3485); KycService.jsonValue [backend/src/kyc/kyc.service.ts:3872](../../backend/src/kyc/kyc.service.ts#L3872); KycService.updateStatus [backend/src/kyc/kyc.service.ts:2881](../../backend/src/kyc/kyc.service.ts#L2881).
- QA: apply Q-API for this ID and its workflow-specific cases; store status/body/DB diff with secrets removed.
- DTO field-access candidates: decision, reason. These span reachable helpers and may include fields of internally composed DTOs; they are not a mandatory field list or complete wire schema. Match to the entry DTO and workflow before constructing requests.

## API-728450A0

**POST /api/kyc/:id/engagement-letter/upload** - KycController.uploadEngagementLetter

- Entry/auth: AuthGuard('jwt'); RolesGuard; fallback roles: OPERATING_TEAM, COMPANY_ADMIN, SUPER_ADMIN.
- Inputs: `@CurrentUser() user: RequestUser`; `@Param('id') id: string`; `@UploadedFiles() files: Array<{ originalname: string; mimetype?: string; size: number; buffer?: Buffer }>`.
- Output: JSON returned from delegated service; inferred fields in linked implementation. Inferred by TypeScript; no explicit response DTO.
- Behavior: Command (may mutate); detected reachable writes: legalDocument.create, auditLog.create.
- Tenant/role/state/validation helper candidates: hasAnyRole, tenantWhere.
- Error branch candidates: ForbiddenException: 'Only the Operations team or an administrator can upload the signed engagement letter.'); BadRequestException: 'Select the signed engagement letter to upload.'); NotFoundException: 'KYC case not found'); BadRequestException: 'The signed engagement letter can be uploaded once the KYC has final approval, or while the engagement is on hold.'); ForbiddenException: 'User is not assigned to a tenant').
- Evidence: [backend/src/kyc/kyc.controller.ts:402](../../backend/src/kyc/kyc.controller.ts#L402).
- Logic chain: KycService.uploadEngagementLetter [backend/src/kyc/kyc.service.ts:392](../../backend/src/kyc/kyc.service.ts#L392); KycService.hasAnyRole [backend/src/kyc/kyc.service.ts:2959](../../backend/src/kyc/kyc.service.ts#L2959); KycService.tenantWhere [backend/src/kyc/kyc.service.ts:2922](../../backend/src/kyc/kyc.service.ts#L2922); KycService.getTenantId [backend/src/kyc/kyc.service.ts:2947](../../backend/src/kyc/kyc.service.ts#L2947); KycService.legalDocumentUploadRoot [backend/src/kyc/kyc.service.ts:3905](../../backend/src/kyc/kyc.service.ts#L3905); KycService.safeFileName [backend/src/kyc/kyc.service.ts:3985](../../backend/src/kyc/kyc.service.ts#L3985); KycService.audit [backend/src/kyc/kyc.service.ts:3485](../../backend/src/kyc/kyc.service.ts#L3485); KycService.jsonValue [backend/src/kyc/kyc.service.ts:3872](../../backend/src/kyc/kyc.service.ts#L3872); KycService.caseInclude [backend/src/kyc/kyc.service.ts:4020](../../backend/src/kyc/kyc.service.ts#L4020).
- QA: apply Q-API for this ID and its workflow-specific cases; store status/body/DB diff with secrets removed.
- DTO field-access candidates: none resolved. These span reachable helpers and may include fields of internally composed DTOs; they are not a mandatory field list or complete wire schema. Match to the entry DTO and workflow before constructing requests.

## API-B62F552C

**POST /api/kyc/:id/final-kyc-decision** - KycController.completeFinalKycDecision

- Entry/auth: AuthGuard('jwt'); RolesGuard; fallback roles: AML_SUPERVISOR, AML_TEAM, DMLRO, MLRO, SEF, COMPANY_ADMIN, SUPER_ADMIN.
- Inputs: `@CurrentUser() user: RequestUser`; `@Param('id') id: string`; `@Body() dto: Record<string, unknown>`.
- Output: JSON returned from delegated service; inferred fields in linked implementation. Inferred by TypeScript; no explicit response DTO.
- Behavior: Command (may mutate); detected reachable writes: internalReviewSubmission.updateMany, internalReviewTask.upsert, workflowComment.create, kycFormRevision.create, kycRevisionFile.create, kycSectionData.upsert, kycForm.update, kycInternalReview.updateMany, signedKycDocument.updateMany, auditLog.create, kycCase.update, kycCaseStatusHistory.create, kycForm.updateMany, notification.create, client.update, internalReviewTask.deleteMany.
- Tenant/role/state/validation helper candidates: enumValue, tenantWhere, assertFinalApprovalReceived, hasAnyRole.
- Error branch candidates: ForbiddenException: 'Only AML Supervisor, DMLRO or MLRO can decide whether the approved Preliminary KYC is final.'); ForbiddenException: 'The final KYC decision must be completed by the approving MLRO or SEF role.'); BadRequestException: `${label} must be one of ${allowed.join(', ')}`); NotFoundException: 'KYC case not found'); ForbiddenException: 'User is not assigned to a tenant'); BadRequestException: 'The final KYC decision is available only after all required approvals are completed.'); BadRequestException: 'The case changed during this action. Refresh before trying again.'); BadRequestException: 'Create the KYC form before opening an amendment.'); BadRequestException: 'Select at least one KYC section to amend.'); BadRequestException: 'Provide the amendment reason.').
- Evidence: [backend/src/kyc/kyc.controller.ts:419](../../backend/src/kyc/kyc.controller.ts#L419).
- Logic chain: KycService.completeFinalKycDecision [backend/src/kyc/kyc.service.ts:1445](../../backend/src/kyc/kyc.service.ts#L1445); KycService.enumValue [backend/src/kyc/kyc.service.ts:3815](../../backend/src/kyc/kyc.service.ts#L3815); KycService.findOne [backend/src/kyc/kyc.service.ts:148](../../backend/src/kyc/kyc.service.ts#L148); KycService.tenantWhere [backend/src/kyc/kyc.service.ts:2922](../../backend/src/kyc/kyc.service.ts#L2922); KycService.getTenantId [backend/src/kyc/kyc.service.ts:2947](../../backend/src/kyc/kyc.service.ts#L2947); KycService.caseInclude [backend/src/kyc/kyc.service.ts:4020](../../backend/src/kyc/kyc.service.ts#L4020); KycService.withKycNumber [backend/src/kyc/kyc.service.ts:3978](../../backend/src/kyc/kyc.service.ts#L3978); KycService.generatedKycNumber [backend/src/kyc/kyc.service.ts:3962](../../backend/src/kyc/kyc.service.ts#L3962); KycService.isPreliminaryProposedCompanyCase [backend/src/kyc/kyc.service.ts:1820](../../backend/src/kyc/kyc.service.ts#L1820); KycService.assertFinalApprovalReceived [backend/src/kyc/kyc.service.ts:1826](../../backend/src/kyc/kyc.service.ts#L1826); KycService.hasAnyRole [backend/src/kyc/kyc.service.ts:2959](../../backend/src/kyc/kyc.service.ts#L2959); KycService.startPreliminaryFullKyc [backend/src/kyc/kyc.service.ts:1804](../../backend/src/kyc/kyc.service.ts#L1804); KycService.optionalText [backend/src/kyc/kyc.service.ts:3838](../../backend/src/kyc/kyc.service.ts#L3838); KycService.text [backend/src/kyc/kyc.service.ts:3885](../../backend/src/kyc/kyc.service.ts#L3885); KycService.beginFormAmendment [backend/src/kyc/kyc.service.ts:1472](../../backend/src/kyc/kyc.service.ts#L1472); KycService.formInclude [backend/src/kyc/kyc.service.ts:2597](../../backend/src/kyc/kyc.service.ts#L2597); KycService.serializeForm [backend/src/kyc/kyc.service.ts:2534](../../backend/src/kyc/kyc.service.ts#L2534); KycService.sectionRows [backend/src/kyc/kyc.service.ts:2625](../../backend/src/kyc/kyc.service.ts#L2625); KycService.asArray [backend/src/kyc/kyc.service.ts:3823](../../backend/src/kyc/kyc.service.ts#L3823); KycService.sectionFWithCaseDocuments [backend/src/kyc/kyc.service.ts:2630](../../backend/src/kyc/kyc.service.ts#L2630); KycService.dedupeRequiredDocumentRows [backend/src/kyc/kyc.service.ts:2712](../../backend/src/kyc/kyc.service.ts#L2712); KycService.documentMatchText [backend/src/kyc/kyc.service.ts:2809](../../backend/src/kyc/kyc.service.ts#L2809); KycService.documentFileNames [backend/src/kyc/kyc.service.ts:2773](../../backend/src/kyc/kyc.service.ts#L2773); KycService.isRequiredDocumentMatch [backend/src/kyc/kyc.service.ts:2788](../../backend/src/kyc/kyc.service.ts#L2788); KycService.dedupeAdditionalDocumentRows [backend/src/kyc/kyc.service.ts:2754](../../backend/src/kyc/kyc.service.ts#L2754); KycService.jsonValue [backend/src/kyc/kyc.service.ts:3872](../../backend/src/kyc/kyc.service.ts#L3872); KycService.resolveLegalDocumentPath [backend/src/kyc/kyc.service.ts:3913](../../backend/src/kyc/kyc.service.ts#L3913); KycService.legalDocumentUploadRoot [backend/src/kyc/kyc.service.ts:3905](../../backend/src/kyc/kyc.service.ts#L3905); KycService.signedKycDocumentUploadRoot [backend/src/kyc/kyc.service.ts:3909](../../backend/src/kyc/kyc.service.ts#L3909); KycService.audit [backend/src/kyc/kyc.service.ts:3485](../../backend/src/kyc/kyc.service.ts#L3485); KycService.recordStatus [backend/src/kyc/kyc.service.ts:3461](../../backend/src/kyc/kyc.service.ts#L3461); KycService.routePreliminaryFinalKycForApproval [backend/src/kyc/kyc.service.ts:1627](../../backend/src/kyc/kyc.service.ts#L1627); KycService.markApprovedKycFinal [backend/src/kyc/kyc.service.ts:1631](../../backend/src/kyc/kyc.service.ts#L1631); KycService.afterKycFinal [backend/src/kyc/kyc.service.ts:1675](../../backend/src/kyc/kyc.service.ts#L1675); KycService.notifyReadyForClientConversion [backend/src/kyc/kyc.service.ts:1796](../../backend/src/kyc/kyc.service.ts#L1796); KycService.createNotification [backend/src/kyc/kyc.service.ts:3498](../../backend/src/kyc/kyc.service.ts#L3498); KycService.completeRekyc [backend/src/kyc/kyc.service.ts:1681](../../backend/src/kyc/kyc.service.ts#L1681); KycService.syncClientRecords [backend/src/kyc/kyc.service.ts:1708](../../backend/src/kyc/kyc.service.ts#L1708); KycService.startAmendment [backend/src/kyc/kyc.service.ts:1597](../../backend/src/kyc/kyc.service.ts#L1597).
- QA: apply Q-API for this ID and its workflow-specific cases; store status/body/DB diff with secrets removed.
- DTO field-access candidates: decision, reason, sections. These span reachable helpers and may include fields of internally composed DTOs; they are not a mandatory field list or complete wire schema. Match to the entry DTO and workflow before constructing requests.

## API-0AED223E

**GET /api/kyc/:id/form** - KycController.getForm

- Entry/auth: AuthGuard('jwt'); RolesGuard; fallback roles: AML_TEAM, AML_SUPERVISOR, DMLRO, MLRO, SEF, COMPANY_ADMIN, SUPER_ADMIN.
- Inputs: `@CurrentUser() user: RequestUser`; `@Param('id') id: string`.
- Output: JSON returned from delegated service; inferred fields in linked implementation. Inferred by TypeScript; no explicit response DTO.
- Behavior: GET WITH SIDE EFFECTS; detected reachable writes: kycSectionData.update, kycSectionData.create, kycForm.upsert.
- Tenant/role/state/validation helper candidates: tenantWhere.
- Error branch candidates: NotFoundException: 'KYC case not found'); ForbiddenException: 'User is not assigned to a tenant').
- Evidence: [backend/src/kyc/kyc.controller.ts:70](../../backend/src/kyc/kyc.controller.ts#L70).
- Logic chain: KycService.getForm [backend/src/kyc/kyc.service.ts:1874](../../backend/src/kyc/kyc.service.ts#L1874); KycService.findOne [backend/src/kyc/kyc.service.ts:148](../../backend/src/kyc/kyc.service.ts#L148); KycService.tenantWhere [backend/src/kyc/kyc.service.ts:2922](../../backend/src/kyc/kyc.service.ts#L2922); KycService.getTenantId [backend/src/kyc/kyc.service.ts:2947](../../backend/src/kyc/kyc.service.ts#L2947); KycService.caseInclude [backend/src/kyc/kyc.service.ts:4020](../../backend/src/kyc/kyc.service.ts#L4020); KycService.withKycNumber [backend/src/kyc/kyc.service.ts:3978](../../backend/src/kyc/kyc.service.ts#L3978); KycService.generatedKycNumber [backend/src/kyc/kyc.service.ts:3962](../../backend/src/kyc/kyc.service.ts#L3962); KycService.formInclude [backend/src/kyc/kyc.service.ts:2597](../../backend/src/kyc/kyc.service.ts#L2597); KycService.serializeForm [backend/src/kyc/kyc.service.ts:2534](../../backend/src/kyc/kyc.service.ts#L2534); KycService.sectionRows [backend/src/kyc/kyc.service.ts:2625](../../backend/src/kyc/kyc.service.ts#L2625); KycService.asArray [backend/src/kyc/kyc.service.ts:3823](../../backend/src/kyc/kyc.service.ts#L3823); KycService.text [backend/src/kyc/kyc.service.ts:3885](../../backend/src/kyc/kyc.service.ts#L3885); KycService.sectionFWithCaseDocuments [backend/src/kyc/kyc.service.ts:2630](../../backend/src/kyc/kyc.service.ts#L2630); KycService.dedupeRequiredDocumentRows [backend/src/kyc/kyc.service.ts:2712](../../backend/src/kyc/kyc.service.ts#L2712); KycService.optionalText [backend/src/kyc/kyc.service.ts:3838](../../backend/src/kyc/kyc.service.ts#L3838); KycService.documentMatchText [backend/src/kyc/kyc.service.ts:2809](../../backend/src/kyc/kyc.service.ts#L2809); KycService.documentFileNames [backend/src/kyc/kyc.service.ts:2773](../../backend/src/kyc/kyc.service.ts#L2773); KycService.isRequiredDocumentMatch [backend/src/kyc/kyc.service.ts:2788](../../backend/src/kyc/kyc.service.ts#L2788); KycService.dedupeAdditionalDocumentRows [backend/src/kyc/kyc.service.ts:2754](../../backend/src/kyc/kyc.service.ts#L2754); KycService.ensureKycNumber [backend/src/kyc/kyc.service.ts:3932](../../backend/src/kyc/kyc.service.ts#L3932); KycService.jsonValue [backend/src/kyc/kyc.service.ts:3872](../../backend/src/kyc/kyc.service.ts#L3872); KycService.createForm [backend/src/kyc/kyc.service.ts:1851](../../backend/src/kyc/kyc.service.ts#L1851).
- QA: apply Q-API for this ID and its workflow-specific cases; store status/body/DB diff with secrets removed.
- DTO field-access candidates: none resolved. These span reachable helpers and may include fields of internally composed DTOs; they are not a mandatory field list or complete wire schema. Match to the entry DTO and workflow before constructing requests.

## API-BC473411

**POST /api/kyc/:id/form** - KycController.createForm

- Entry/auth: AuthGuard('jwt'); RolesGuard; fallback roles: AML_TEAM, AML_SUPERVISOR, DMLRO, MLRO, SEF, COMPANY_ADMIN, SUPER_ADMIN.
- Inputs: `@CurrentUser() user: RequestUser`; `@Param('id') id: string`.
- Output: JSON returned from delegated service; inferred fields in linked implementation. Inferred by TypeScript; no explicit response DTO.
- Behavior: Command (may mutate); detected reachable writes: kycForm.upsert.
- Tenant/role/state/validation helper candidates: tenantWhere.
- Error branch candidates: NotFoundException: 'KYC case not found'); ForbiddenException: 'User is not assigned to a tenant').
- Evidence: [backend/src/kyc/kyc.controller.ts:64](../../backend/src/kyc/kyc.controller.ts#L64).
- Logic chain: KycService.createForm [backend/src/kyc/kyc.service.ts:1851](../../backend/src/kyc/kyc.service.ts#L1851); KycService.findOne [backend/src/kyc/kyc.service.ts:148](../../backend/src/kyc/kyc.service.ts#L148); KycService.tenantWhere [backend/src/kyc/kyc.service.ts:2922](../../backend/src/kyc/kyc.service.ts#L2922); KycService.getTenantId [backend/src/kyc/kyc.service.ts:2947](../../backend/src/kyc/kyc.service.ts#L2947); KycService.caseInclude [backend/src/kyc/kyc.service.ts:4020](../../backend/src/kyc/kyc.service.ts#L4020); KycService.withKycNumber [backend/src/kyc/kyc.service.ts:3978](../../backend/src/kyc/kyc.service.ts#L3978); KycService.generatedKycNumber [backend/src/kyc/kyc.service.ts:3962](../../backend/src/kyc/kyc.service.ts#L3962); KycService.formInclude [backend/src/kyc/kyc.service.ts:2597](../../backend/src/kyc/kyc.service.ts#L2597).
- QA: apply Q-API for this ID and its workflow-specific cases; store status/body/DB diff with secrets removed.
- DTO field-access candidates: none resolved. These span reachable helpers and may include fields of internally composed DTOs; they are not a mandatory field list or complete wire schema. Match to the entry DTO and workflow before constructing requests.

## API-A3C714C0

**PATCH /api/kyc/:id/form/autosave** - KycController.autoSaveForm

- Entry/auth: AuthGuard('jwt'); RolesGuard; fallback roles: AML_TEAM, AML_SUPERVISOR, DMLRO, MLRO, SEF, COMPANY_ADMIN, SUPER_ADMIN.
- Inputs: `@CurrentUser() user: RequestUser`; `@Param('id') id: string`; `@Body() dto: Record<string, unknown>`.
- Output: JSON returned from delegated service; inferred fields in linked implementation. Inferred by TypeScript; no explicit response DTO.
- Behavior: Command (may mutate); detected reachable writes: kycSectionData.upsert, kycForm.update, kycForm.upsert, kycSectionData.update, kycSectionData.create, kycShareholder.deleteMany, kycUbo.deleteMany, kycShareholder.createMany, kycUbo.createMany, kycManager.deleteMany, kycManager.createMany, kycRequiredDocument.deleteMany, kycRequiredDocument.createMany, legalDocument.create, kycCase.update, kycCaseStatusHistory.create, kycInternalReview.upsert.
- Tenant/role/state/validation helper candidates: assertFormReviewEditable, tenantWhere, hasAnyRole, assertStageRole, requireWritableCase, isLegacyFullKycDraft, formTenantWhere, assertReviewStageActive, assertEditableReview, requireWritableForm, numberValue, requiredText, enumValue.
- Error branch candidates: ForbiddenException: 'Administrator access required'); BadRequestException: `${this.stageLabel(stage)} editing is locked while the case is with another review stage.`); NotFoundException: 'KYC case not found'); ForbiddenException: 'User is not assigned to a tenant'); ForbiddenException: `You cannot edit the ${this.stageLabel(stage)} review`); BadRequestException: 'KYC preparation is locked while the case is under DMLRO, MLRO, or SEF review. It can be edited again only after DMLRO returns it to the AML Supervisor.'); BadRequestException: `${this.stageLabel(stage)} does not have an active review task for this case.`); BadRequestException: `${this.stageLabel(stage)} review is locked after submission`); ForbiddenException: 'You do not have permission to edit this KYC form section'); BadRequestException: 'KYC preparation is locked while the case is under review. It can be edited again only after DMLRO returns it to the AML Supervisor.'); BadRequestException: 'KYC form is locked'); BadRequestException: 'This form revision has changed. Refresh the page before saving your amendment.'); BadRequestException: 'KYC form is locked. Create a new version before editing.'); BadRequestException: 'Link each indirect beneficial owner to a corporate shareholder in this form.'); BadRequestException: 'Interest percentage cannot exceed 100% within the same control layer'); BadRequestException: 'Percentage fields must be numeric'); BadRequestException: `${label} is required`); BadRequestException: 'Invalid date value'); BadRequestException: `${label} must be one of ${allowed.join(', ')}`).
- Evidence: [backend/src/kyc/kyc.controller.ts:76](../../backend/src/kyc/kyc.controller.ts#L76).
- Logic chain: KycService.autoSaveForm [backend/src/kyc/kyc.service.ts:1889](../../backend/src/kyc/kyc.service.ts#L1889); KycService.assertFormReviewEditable [backend/src/kyc/kyc.service.ts:3669](../../backend/src/kyc/kyc.service.ts#L3669); KycService.findOne [backend/src/kyc/kyc.service.ts:148](../../backend/src/kyc/kyc.service.ts#L148); KycService.tenantWhere [backend/src/kyc/kyc.service.ts:2922](../../backend/src/kyc/kyc.service.ts#L2922); KycService.getTenantId [backend/src/kyc/kyc.service.ts:2947](../../backend/src/kyc/kyc.service.ts#L2947); KycService.caseInclude [backend/src/kyc/kyc.service.ts:4020](../../backend/src/kyc/kyc.service.ts#L4020); KycService.withKycNumber [backend/src/kyc/kyc.service.ts:3978](../../backend/src/kyc/kyc.service.ts#L3978); KycService.generatedKycNumber [backend/src/kyc/kyc.service.ts:3962](../../backend/src/kyc/kyc.service.ts#L3962); KycService.hasAnyRole [backend/src/kyc/kyc.service.ts:2959](../../backend/src/kyc/kyc.service.ts#L2959); KycService.assertStageRole [backend/src/kyc/kyc.service.ts:2963](../../backend/src/kyc/kyc.service.ts#L2963); KycService.stageLabel [backend/src/kyc/kyc.service.ts:2976](../../backend/src/kyc/kyc.service.ts#L2976); KycService.requireWritableCase [backend/src/kyc/kyc.service.ts:2819](../../backend/src/kyc/kyc.service.ts#L2819); KycService.isPreparationEditableStatus [backend/src/kyc/kyc.service.ts:2841](../../backend/src/kyc/kyc.service.ts#L2841); KycService.isLegacyFullKycDraft [backend/src/kyc/kyc.service.ts:2835](../../backend/src/kyc/kyc.service.ts#L2835); KycService.formTenantWhere [backend/src/kyc/kyc.service.ts:2939](../../backend/src/kyc/kyc.service.ts#L2939); KycService.isDmlroStageStatus [backend/src/kyc/kyc.service.ts:2982](../../backend/src/kyc/kyc.service.ts#L2982); KycService.stageStatus [backend/src/kyc/kyc.service.ts:2987](../../backend/src/kyc/kyc.service.ts#L2987); KycService.assertReviewStageActive [backend/src/kyc/kyc.service.ts:3040](../../backend/src/kyc/kyc.service.ts#L3040); KycService.assertEditableReview [backend/src/kyc/kyc.service.ts:3030](../../backend/src/kyc/kyc.service.ts#L3030); KycService.saveSectionData [backend/src/kyc/kyc.service.ts:2448](../../backend/src/kyc/kyc.service.ts#L2448); KycService.requireWritableForm [backend/src/kyc/kyc.service.ts:2477](../../backend/src/kyc/kyc.service.ts#L2477); KycService.createForm [backend/src/kyc/kyc.service.ts:1851](../../backend/src/kyc/kyc.service.ts#L1851); KycService.formInclude [backend/src/kyc/kyc.service.ts:2597](../../backend/src/kyc/kyc.service.ts#L2597); KycService.jsonValue [backend/src/kyc/kyc.service.ts:3872](../../backend/src/kyc/kyc.service.ts#L3872); KycService.getForm [backend/src/kyc/kyc.service.ts:1874](../../backend/src/kyc/kyc.service.ts#L1874); KycService.serializeForm [backend/src/kyc/kyc.service.ts:2534](../../backend/src/kyc/kyc.service.ts#L2534); KycService.sectionRows [backend/src/kyc/kyc.service.ts:2625](../../backend/src/kyc/kyc.service.ts#L2625); KycService.asArray [backend/src/kyc/kyc.service.ts:3823](../../backend/src/kyc/kyc.service.ts#L3823); KycService.text [backend/src/kyc/kyc.service.ts:3885](../../backend/src/kyc/kyc.service.ts#L3885); KycService.sectionFWithCaseDocuments [backend/src/kyc/kyc.service.ts:2630](../../backend/src/kyc/kyc.service.ts#L2630); KycService.dedupeRequiredDocumentRows [backend/src/kyc/kyc.service.ts:2712](../../backend/src/kyc/kyc.service.ts#L2712); KycService.optionalText [backend/src/kyc/kyc.service.ts:3838](../../backend/src/kyc/kyc.service.ts#L3838); KycService.documentMatchText [backend/src/kyc/kyc.service.ts:2809](../../backend/src/kyc/kyc.service.ts#L2809); KycService.documentFileNames [backend/src/kyc/kyc.service.ts:2773](../../backend/src/kyc/kyc.service.ts#L2773); KycService.isRequiredDocumentMatch [backend/src/kyc/kyc.service.ts:2788](../../backend/src/kyc/kyc.service.ts#L2788); KycService.dedupeAdditionalDocumentRows [backend/src/kyc/kyc.service.ts:2754](../../backend/src/kyc/kyc.service.ts#L2754); KycService.ensureKycNumber [backend/src/kyc/kyc.service.ts:3932](../../backend/src/kyc/kyc.service.ts#L3932); KycService.saveOwnership [backend/src/kyc/kyc.service.ts:1925](../../backend/src/kyc/kyc.service.ts#L1925); KycService.hasRowValue [backend/src/kyc/kyc.service.ts:3827](../../backend/src/kyc/kyc.service.ts#L3827); KycService.numberValue [backend/src/kyc/kyc.service.ts:3858](../../backend/src/kyc/kyc.service.ts#L3858); KycService.writeOwnershipRows [backend/src/kyc/kyc.service.ts:2012](../../backend/src/kyc/kyc.service.ts#L2012); KycService.requiredText [backend/src/kyc/kyc.service.ts:3831](../../backend/src/kyc/kyc.service.ts#L3831); KycService.optionText [backend/src/kyc/kyc.service.ts:3893](../../backend/src/kyc/kyc.service.ts#L3893); KycService.dateValue [backend/src/kyc/kyc.service.ts:3847](../../backend/src/kyc/kyc.service.ts#L3847); KycService.decimalValue [backend/src/kyc/kyc.service.ts:3867](../../backend/src/kyc/kyc.service.ts#L3867); KycService.saveManagers [backend/src/kyc/kyc.service.ts:1983](../../backend/src/kyc/kyc.service.ts#L1983); KycService.writeManagerRows [backend/src/kyc/kyc.service.ts:2053](../../backend/src/kyc/kyc.service.ts#L2053); KycService.saveRequiredDocuments [backend/src/kyc/kyc.service.ts:2086](../../backend/src/kyc/kyc.service.ts#L2086); KycService.syncRequiredDocumentsToLegalDocuments [backend/src/kyc/kyc.service.ts:2146](../../backend/src/kyc/kyc.service.ts#L2146); KycService.legalDocumentSyncKey [backend/src/kyc/kyc.service.ts:4016](../../backend/src/kyc/kyc.service.ts#L4016); KycService.markDocumentsUploadedFromSectionF [backend/src/kyc/kyc.service.ts:2206](../../backend/src/kyc/kyc.service.ts#L2206); KycService.saveInternalReview [backend/src/kyc/kyc.service.ts:2250](../../backend/src/kyc/kyc.service.ts#L2250); KycService.internalReviewAllowedRoles [backend/src/kyc/kyc.service.ts:3692](../../backend/src/kyc/kyc.service.ts#L3692); KycService.internalReviewData [backend/src/kyc/kyc.service.ts:3701](../../backend/src/kyc/kyc.service.ts#L3701); KycService.enumValue [backend/src/kyc/kyc.service.ts:3815](../../backend/src/kyc/kyc.service.ts#L3815).
- QA: apply Q-API for this ID and its workflow-specific cases; store status/body/DB diff with secrets removed.
- DTO field-access candidates: additionalDocuments, amlAccuracyChecked, amlClarificationFindings, amlDate, amlName, amlSignatureDataUrl, amlSignatureFileName, dmlroComments, dmlroConditions, dmlroDate, dmlroDecision, dmlroName, dmlroReason, dmlroRiskClassification, dmlroSignatureDataUrl, dmlroSignatureFileName, documents, dueDiligenceType, expectedVersion, managers, mlroComments, mlroConditions, mlroDate, mlroDecision, mlroFinalRiskClassification, mlroName, mlroRiskExplanation, mlroRiskReasonCategory, mlroSignatureDataUrl, mlroSignatureFileName, reviewPart, riskClassification, sefComments, sefConditions, sefDate, sefDecision, sefName, sefSignatureDataUrl, sefSignatureFileName, shareholders, uboDifferentFromShareholders, uboGroupStructureNotes, ubos, uploadedFilesNote. These span reachable helpers and may include fields of internally composed DTOs; they are not a mandatory field list or complete wire schema. Match to the entry DTO and workflow before constructing requests.

## API-490F75DE

**POST /api/kyc/:id/form/generate-docx** - KycController.generateDocx

- Entry/auth: AuthGuard('jwt'); RolesGuard; fallback roles: AML_TEAM, AML_SUPERVISOR, DMLRO, MLRO, SEF, COMPANY_ADMIN, SUPER_ADMIN.
- Inputs: `@CurrentUser() user: RequestUser`; `@Param('id') id: string`.
- Output: JSON returned from delegated service; inferred fields in linked implementation. Inferred by TypeScript; no explicit response DTO.
- Behavior: Command (may mutate); detected reachable writes: kycGeneratedDocument.create, kycSectionData.update, kycSectionData.create, kycForm.upsert, auditLog.create.
- Tenant/role/state/validation helper candidates: formTenantWhere, tenantWhere.
- Error branch candidates: InternalServerErrorException: 'Unable to store the generated KYC document'); ForbiddenException: 'User is not assigned to a tenant'); NotFoundException: 'KYC case not found').
- Evidence: [backend/src/kyc/kyc.controller.ts:162](../../backend/src/kyc/kyc.controller.ts#L162).
- Logic chain: KycService.generateDocument [backend/src/kyc/kyc.service.ts:2277](../../backend/src/kyc/kyc.service.ts#L2277); KycService.ensureKycNumber [backend/src/kyc/kyc.service.ts:3932](../../backend/src/kyc/kyc.service.ts#L3932); KycService.generatedKycNumber [backend/src/kyc/kyc.service.ts:3962](../../backend/src/kyc/kyc.service.ts#L3962); KycService.jsonValue [backend/src/kyc/kyc.service.ts:3872](../../backend/src/kyc/kyc.service.ts#L3872); KycService.formInclude [backend/src/kyc/kyc.service.ts:2597](../../backend/src/kyc/kyc.service.ts#L2597); KycService.getFormRecord [backend/src/kyc/kyc.service.ts:2520](../../backend/src/kyc/kyc.service.ts#L2520); KycService.formTenantWhere [backend/src/kyc/kyc.service.ts:2939](../../backend/src/kyc/kyc.service.ts#L2939); KycService.getTenantId [backend/src/kyc/kyc.service.ts:2947](../../backend/src/kyc/kyc.service.ts#L2947); KycService.createForm [backend/src/kyc/kyc.service.ts:1851](../../backend/src/kyc/kyc.service.ts#L1851); KycService.findOne [backend/src/kyc/kyc.service.ts:148](../../backend/src/kyc/kyc.service.ts#L148); KycService.tenantWhere [backend/src/kyc/kyc.service.ts:2922](../../backend/src/kyc/kyc.service.ts#L2922); KycService.caseInclude [backend/src/kyc/kyc.service.ts:4020](../../backend/src/kyc/kyc.service.ts#L4020); KycService.withKycNumber [backend/src/kyc/kyc.service.ts:3978](../../backend/src/kyc/kyc.service.ts#L3978); KycService.text [backend/src/kyc/kyc.service.ts:3885](../../backend/src/kyc/kyc.service.ts#L3885); KycService.serializeForm [backend/src/kyc/kyc.service.ts:2534](../../backend/src/kyc/kyc.service.ts#L2534); KycService.sectionRows [backend/src/kyc/kyc.service.ts:2625](../../backend/src/kyc/kyc.service.ts#L2625); KycService.asArray [backend/src/kyc/kyc.service.ts:3823](../../backend/src/kyc/kyc.service.ts#L3823); KycService.sectionFWithCaseDocuments [backend/src/kyc/kyc.service.ts:2630](../../backend/src/kyc/kyc.service.ts#L2630); KycService.dedupeRequiredDocumentRows [backend/src/kyc/kyc.service.ts:2712](../../backend/src/kyc/kyc.service.ts#L2712); KycService.optionalText [backend/src/kyc/kyc.service.ts:3838](../../backend/src/kyc/kyc.service.ts#L3838); KycService.documentMatchText [backend/src/kyc/kyc.service.ts:2809](../../backend/src/kyc/kyc.service.ts#L2809); KycService.documentFileNames [backend/src/kyc/kyc.service.ts:2773](../../backend/src/kyc/kyc.service.ts#L2773); KycService.isRequiredDocumentMatch [backend/src/kyc/kyc.service.ts:2788](../../backend/src/kyc/kyc.service.ts#L2788); KycService.dedupeAdditionalDocumentRows [backend/src/kyc/kyc.service.ts:2754](../../backend/src/kyc/kyc.service.ts#L2754); KycService.safeFileName [backend/src/kyc/kyc.service.ts:3985](../../backend/src/kyc/kyc.service.ts#L3985); KycService.nextGeneratedVersion [backend/src/kyc/kyc.service.ts:3876](../../backend/src/kyc/kyc.service.ts#L3876); KycService.audit [backend/src/kyc/kyc.service.ts:3485](../../backend/src/kyc/kyc.service.ts#L3485).
- QA: apply Q-API for this ID and its workflow-specific cases; store status/body/DB diff with secrets removed.
- DTO field-access candidates: none resolved. These span reachable helpers and may include fields of internally composed DTOs; they are not a mandatory field list or complete wire schema. Match to the entry DTO and workflow before constructing requests.

## API-DD13B530

**POST /api/kyc/:id/form/generate-pdf** - KycController.generatePdf

- Entry/auth: AuthGuard('jwt'); RolesGuard; fallback roles: AML_TEAM, AML_SUPERVISOR, DMLRO, MLRO, SEF, COMPANY_ADMIN, SUPER_ADMIN.
- Inputs: `@CurrentUser() user: RequestUser`; `@Param('id') id: string`.
- Output: JSON returned from delegated service; inferred fields in linked implementation. Inferred by TypeScript; no explicit response DTO.
- Behavior: Command (may mutate); detected reachable writes: kycGeneratedDocument.create, kycSectionData.update, kycSectionData.create, kycForm.upsert, auditLog.create.
- Tenant/role/state/validation helper candidates: formTenantWhere, tenantWhere.
- Error branch candidates: InternalServerErrorException: 'Unable to store the generated KYC document'); ForbiddenException: 'User is not assigned to a tenant'); NotFoundException: 'KYC case not found').
- Evidence: [backend/src/kyc/kyc.controller.ts:168](../../backend/src/kyc/kyc.controller.ts#L168).
- Logic chain: KycService.generateDocument [backend/src/kyc/kyc.service.ts:2277](../../backend/src/kyc/kyc.service.ts#L2277); KycService.ensureKycNumber [backend/src/kyc/kyc.service.ts:3932](../../backend/src/kyc/kyc.service.ts#L3932); KycService.generatedKycNumber [backend/src/kyc/kyc.service.ts:3962](../../backend/src/kyc/kyc.service.ts#L3962); KycService.jsonValue [backend/src/kyc/kyc.service.ts:3872](../../backend/src/kyc/kyc.service.ts#L3872); KycService.formInclude [backend/src/kyc/kyc.service.ts:2597](../../backend/src/kyc/kyc.service.ts#L2597); KycService.getFormRecord [backend/src/kyc/kyc.service.ts:2520](../../backend/src/kyc/kyc.service.ts#L2520); KycService.formTenantWhere [backend/src/kyc/kyc.service.ts:2939](../../backend/src/kyc/kyc.service.ts#L2939); KycService.getTenantId [backend/src/kyc/kyc.service.ts:2947](../../backend/src/kyc/kyc.service.ts#L2947); KycService.createForm [backend/src/kyc/kyc.service.ts:1851](../../backend/src/kyc/kyc.service.ts#L1851); KycService.findOne [backend/src/kyc/kyc.service.ts:148](../../backend/src/kyc/kyc.service.ts#L148); KycService.tenantWhere [backend/src/kyc/kyc.service.ts:2922](../../backend/src/kyc/kyc.service.ts#L2922); KycService.caseInclude [backend/src/kyc/kyc.service.ts:4020](../../backend/src/kyc/kyc.service.ts#L4020); KycService.withKycNumber [backend/src/kyc/kyc.service.ts:3978](../../backend/src/kyc/kyc.service.ts#L3978); KycService.text [backend/src/kyc/kyc.service.ts:3885](../../backend/src/kyc/kyc.service.ts#L3885); KycService.serializeForm [backend/src/kyc/kyc.service.ts:2534](../../backend/src/kyc/kyc.service.ts#L2534); KycService.sectionRows [backend/src/kyc/kyc.service.ts:2625](../../backend/src/kyc/kyc.service.ts#L2625); KycService.asArray [backend/src/kyc/kyc.service.ts:3823](../../backend/src/kyc/kyc.service.ts#L3823); KycService.sectionFWithCaseDocuments [backend/src/kyc/kyc.service.ts:2630](../../backend/src/kyc/kyc.service.ts#L2630); KycService.dedupeRequiredDocumentRows [backend/src/kyc/kyc.service.ts:2712](../../backend/src/kyc/kyc.service.ts#L2712); KycService.optionalText [backend/src/kyc/kyc.service.ts:3838](../../backend/src/kyc/kyc.service.ts#L3838); KycService.documentMatchText [backend/src/kyc/kyc.service.ts:2809](../../backend/src/kyc/kyc.service.ts#L2809); KycService.documentFileNames [backend/src/kyc/kyc.service.ts:2773](../../backend/src/kyc/kyc.service.ts#L2773); KycService.isRequiredDocumentMatch [backend/src/kyc/kyc.service.ts:2788](../../backend/src/kyc/kyc.service.ts#L2788); KycService.dedupeAdditionalDocumentRows [backend/src/kyc/kyc.service.ts:2754](../../backend/src/kyc/kyc.service.ts#L2754); KycService.safeFileName [backend/src/kyc/kyc.service.ts:3985](../../backend/src/kyc/kyc.service.ts#L3985); KycService.nextGeneratedVersion [backend/src/kyc/kyc.service.ts:3876](../../backend/src/kyc/kyc.service.ts#L3876); KycService.audit [backend/src/kyc/kyc.service.ts:3485](../../backend/src/kyc/kyc.service.ts#L3485).
- QA: apply Q-API for this ID and its workflow-specific cases; store status/body/DB diff with secrets removed.
- DTO field-access candidates: none resolved. These span reachable helpers and may include fields of internally composed DTOs; they are not a mandatory field list or complete wire schema. Match to the entry DTO and workflow before constructing requests.

## API-78F4A26B

**GET /api/kyc/:id/form/generated-documents/:documentId/download** - KycController.downloadGeneratedDocument

- Entry/auth: AuthGuard('jwt'); RolesGuard; fallback roles: AML_TEAM, AML_SUPERVISOR, DMLRO, MLRO, SEF, COMPANY_ADMIN, SUPER_ADMIN.
- Inputs: `@CurrentUser() user: RequestUser`; `@Param('id') id: string`; `@Param('documentId') documentId: string`; `@Res() response: Response`.
- Output: Response.send binary/HTML; see controller MIME and Content-Disposition. Inferred by TypeScript; no explicit response DTO.
- Behavior: GET WITH SIDE EFFECTS; detected reachable writes: auditLog.create.
- Tenant/role/state/validation helper candidates: tenantWhere.
- Error branch candidates: NotFoundException: 'Generated document not found'); NotFoundException: 'KYC case not found'); ForbiddenException: 'User is not assigned to a tenant').
- Evidence: [backend/src/kyc/kyc.controller.ts:174](../../backend/src/kyc/kyc.controller.ts#L174).
- Logic chain: KycService.downloadGeneratedDocument [backend/src/kyc/kyc.service.ts:2351](../../backend/src/kyc/kyc.service.ts#L2351); KycService.findOne [backend/src/kyc/kyc.service.ts:148](../../backend/src/kyc/kyc.service.ts#L148); KycService.tenantWhere [backend/src/kyc/kyc.service.ts:2922](../../backend/src/kyc/kyc.service.ts#L2922); KycService.getTenantId [backend/src/kyc/kyc.service.ts:2947](../../backend/src/kyc/kyc.service.ts#L2947); KycService.caseInclude [backend/src/kyc/kyc.service.ts:4020](../../backend/src/kyc/kyc.service.ts#L4020); KycService.withKycNumber [backend/src/kyc/kyc.service.ts:3978](../../backend/src/kyc/kyc.service.ts#L3978); KycService.generatedKycNumber [backend/src/kyc/kyc.service.ts:3962](../../backend/src/kyc/kyc.service.ts#L3962); KycService.generatedTenantWhere [backend/src/kyc/kyc.service.ts:2943](../../backend/src/kyc/kyc.service.ts#L2943); KycService.audit [backend/src/kyc/kyc.service.ts:3485](../../backend/src/kyc/kyc.service.ts#L3485); KycService.jsonValue [backend/src/kyc/kyc.service.ts:3872](../../backend/src/kyc/kyc.service.ts#L3872).
- QA: apply Q-API for this ID and its workflow-specific cases; store status/body/DB diff with secrets removed.
- DTO field-access candidates: none resolved. These span reachable helpers and may include fields of internally composed DTOs; they are not a mandatory field list or complete wire schema. Match to the entry DTO and workflow before constructing requests.

## API-D17BA785

**POST /api/kyc/:id/form/read-document** - KycController.readFormDocument

- Entry/auth: AuthGuard('jwt'); RolesGuard; fallback roles: AML_TEAM, AML_SUPERVISOR, COMPANY_ADMIN, SUPER_ADMIN.
- Inputs: `@CurrentUser() user: RequestUser`; `@Param('id') id: string`; `@Body('kind') kind: string \| undefined`; `@UploadedFiles() files: Array<{ originalname: string; mimetype?: string; size: number; buffer: Buffer }>`; `@Body('legalDocumentId') legalDocumentId: string \| undefined`.
- Output: JSON returned from delegated service; inferred fields in linked implementation. Inferred by TypeScript; no explicit response DTO.
- Behavior: Command (may mutate); detected reachable writes: none detected.
- Tenant/role/state/validation helper candidates: requireWritableCase, tenantWhere, isLegacyFullKycDraft, formTenantWhere.
- Error branch candidates: BadRequestException: 'Select one file to read.'); BadRequestException: 'Document reading is not available.'); BadRequestException: 'Choose what to read: COMPANY, PASSPORT or QID.'); NotFoundException: 'KYC case not found'); BadRequestException: 'KYC preparation is locked while the case is under DMLRO, MLRO, or SEF review. It can be edited again only after DMLRO returns it to the AML Supervisor.'); ForbiddenException: 'User is not assigned to a tenant'); NotFoundException: 'Uploaded document not found'); NotFoundException: 'Uploaded file is not available for this document').
- Evidence: [backend/src/kyc/kyc.controller.ts:230](../../backend/src/kyc/kyc.controller.ts#L230).
- Logic chain: KycService.readFormDocument [backend/src/kyc/kyc.service.ts:102](../../backend/src/kyc/kyc.service.ts#L102); KycService.requireWritableCase [backend/src/kyc/kyc.service.ts:2819](../../backend/src/kyc/kyc.service.ts#L2819); KycService.tenantWhere [backend/src/kyc/kyc.service.ts:2922](../../backend/src/kyc/kyc.service.ts#L2922); KycService.getTenantId [backend/src/kyc/kyc.service.ts:2947](../../backend/src/kyc/kyc.service.ts#L2947); KycService.isPreparationEditableStatus [backend/src/kyc/kyc.service.ts:2841](../../backend/src/kyc/kyc.service.ts#L2841); KycService.isLegacyFullKycDraft [backend/src/kyc/kyc.service.ts:2835](../../backend/src/kyc/kyc.service.ts#L2835); KycService.formTenantWhere [backend/src/kyc/kyc.service.ts:2939](../../backend/src/kyc/kyc.service.ts#L2939); KycService.getLegalDocumentFile [backend/src/kyc/kyc.service.ts:554](../../backend/src/kyc/kyc.service.ts#L554); KycService.findOne [backend/src/kyc/kyc.service.ts:148](../../backend/src/kyc/kyc.service.ts#L148); KycService.caseInclude [backend/src/kyc/kyc.service.ts:4020](../../backend/src/kyc/kyc.service.ts#L4020); KycService.withKycNumber [backend/src/kyc/kyc.service.ts:3978](../../backend/src/kyc/kyc.service.ts#L3978); KycService.generatedKycNumber [backend/src/kyc/kyc.service.ts:3962](../../backend/src/kyc/kyc.service.ts#L3962); KycService.resolveLegalDocumentPath [backend/src/kyc/kyc.service.ts:3913](../../backend/src/kyc/kyc.service.ts#L3913); KycService.legalDocumentUploadRoot [backend/src/kyc/kyc.service.ts:3905](../../backend/src/kyc/kyc.service.ts#L3905).
- QA: apply Q-API for this ID and its workflow-specific cases; store status/body/DB diff with secrets removed.
- DTO field-access candidates: none resolved. These span reachable helpers and may include fields of internally composed DTOs; they are not a mandatory field list or complete wire schema. Match to the entry DTO and workflow before constructing requests.

## API-5242388D

**GET /api/kyc/:id/form/revisions** - KycController.getFormRevisions

- Entry/auth: AuthGuard('jwt'); RolesGuard; fallback roles: AML_TEAM, AML_SUPERVISOR, DMLRO, MLRO, SEF, COMPANY_ADMIN, SUPER_ADMIN.
- Inputs: `@CurrentUser() user: RequestUser`; `@Param('id') id: string`.
- Output: JSON returned from delegated service; inferred fields in linked implementation. Inferred by TypeScript; no explicit response DTO.
- Behavior: GET WITH SIDE EFFECTS; detected reachable writes: kycForm.upsert.
- Tenant/role/state/validation helper candidates: formTenantWhere, tenantWhere.
- Error branch candidates: ForbiddenException: 'User is not assigned to a tenant'); NotFoundException: 'KYC case not found').
- Evidence: [backend/src/kyc/kyc.controller.ts:82](../../backend/src/kyc/kyc.controller.ts#L82).
- Logic chain: KycService.getFormRevisions [backend/src/kyc/kyc.service.ts:1555](../../backend/src/kyc/kyc.service.ts#L1555); KycService.getFormRecord [backend/src/kyc/kyc.service.ts:2520](../../backend/src/kyc/kyc.service.ts#L2520); KycService.formTenantWhere [backend/src/kyc/kyc.service.ts:2939](../../backend/src/kyc/kyc.service.ts#L2939); KycService.getTenantId [backend/src/kyc/kyc.service.ts:2947](../../backend/src/kyc/kyc.service.ts#L2947); KycService.formInclude [backend/src/kyc/kyc.service.ts:2597](../../backend/src/kyc/kyc.service.ts#L2597); KycService.createForm [backend/src/kyc/kyc.service.ts:1851](../../backend/src/kyc/kyc.service.ts#L1851); KycService.findOne [backend/src/kyc/kyc.service.ts:148](../../backend/src/kyc/kyc.service.ts#L148); KycService.tenantWhere [backend/src/kyc/kyc.service.ts:2922](../../backend/src/kyc/kyc.service.ts#L2922); KycService.caseInclude [backend/src/kyc/kyc.service.ts:4020](../../backend/src/kyc/kyc.service.ts#L4020); KycService.withKycNumber [backend/src/kyc/kyc.service.ts:3978](../../backend/src/kyc/kyc.service.ts#L3978); KycService.generatedKycNumber [backend/src/kyc/kyc.service.ts:3962](../../backend/src/kyc/kyc.service.ts#L3962).
- QA: apply Q-API for this ID and its workflow-specific cases; store status/body/DB diff with secrets removed.
- DTO field-access candidates: none resolved. These span reachable helpers and may include fields of internally composed DTOs; they are not a mandatory field list or complete wire schema. Match to the entry DTO and workflow before constructing requests.

## API-1CF5873D

**GET /api/kyc/:id/form/revisions/:revisionId** - KycController.getFormRevision

- Entry/auth: AuthGuard('jwt'); RolesGuard; fallback roles: AML_TEAM, AML_SUPERVISOR, DMLRO, MLRO, SEF, COMPANY_ADMIN, SUPER_ADMIN.
- Inputs: `@CurrentUser() user: RequestUser`; `@Param('id') id: string`; `@Param('revisionId') revisionId: string`.
- Output: JSON returned from delegated service; inferred fields in linked implementation. Inferred by TypeScript; no explicit response DTO.
- Behavior: GET WITH SIDE EFFECTS; detected reachable writes: kycForm.upsert.
- Tenant/role/state/validation helper candidates: formTenantWhere, tenantWhere.
- Error branch candidates: NotFoundException: 'KYC form revision not found'); ForbiddenException: 'User is not assigned to a tenant'); NotFoundException: 'KYC case not found').
- Evidence: [backend/src/kyc/kyc.controller.ts:88](../../backend/src/kyc/kyc.controller.ts#L88).
- Logic chain: KycService.getFormRevision [backend/src/kyc/kyc.service.ts:1563](../../backend/src/kyc/kyc.service.ts#L1563); KycService.getFormRecord [backend/src/kyc/kyc.service.ts:2520](../../backend/src/kyc/kyc.service.ts#L2520); KycService.formTenantWhere [backend/src/kyc/kyc.service.ts:2939](../../backend/src/kyc/kyc.service.ts#L2939); KycService.getTenantId [backend/src/kyc/kyc.service.ts:2947](../../backend/src/kyc/kyc.service.ts#L2947); KycService.formInclude [backend/src/kyc/kyc.service.ts:2597](../../backend/src/kyc/kyc.service.ts#L2597); KycService.createForm [backend/src/kyc/kyc.service.ts:1851](../../backend/src/kyc/kyc.service.ts#L1851); KycService.findOne [backend/src/kyc/kyc.service.ts:148](../../backend/src/kyc/kyc.service.ts#L148); KycService.tenantWhere [backend/src/kyc/kyc.service.ts:2922](../../backend/src/kyc/kyc.service.ts#L2922); KycService.caseInclude [backend/src/kyc/kyc.service.ts:4020](../../backend/src/kyc/kyc.service.ts#L4020); KycService.withKycNumber [backend/src/kyc/kyc.service.ts:3978](../../backend/src/kyc/kyc.service.ts#L3978); KycService.generatedKycNumber [backend/src/kyc/kyc.service.ts:3962](../../backend/src/kyc/kyc.service.ts#L3962).
- QA: apply Q-API for this ID and its workflow-specific cases; store status/body/DB diff with secrets removed.
- DTO field-access candidates: none resolved. These span reachable helpers and may include fields of internally composed DTOs; they are not a mandatory field list or complete wire schema. Match to the entry DTO and workflow before constructing requests.

## API-401ED459

**GET /api/kyc/:id/form/revisions/:revisionId/download** - KycController.downloadFormRevision

- Entry/auth: AuthGuard('jwt'); RolesGuard; fallback roles: AML_TEAM, AML_SUPERVISOR, DMLRO, MLRO, SEF, COMPANY_ADMIN, SUPER_ADMIN.
- Inputs: `@CurrentUser() user: RequestUser`; `@Param('id') id: string`; `@Param('revisionId') revisionId: string`; `@Query('type') type: string`; `@Res() res: Response`.
- Output: Response.send binary/HTML; see controller MIME and Content-Disposition. Inferred by TypeScript; no explicit response DTO.
- Behavior: GET WITH SIDE EFFECTS; detected reachable writes: kycForm.upsert, auditLog.create.
- Tenant/role/state/validation helper candidates: formTenantWhere, tenantWhere.
- Error branch candidates: BadRequestException: 'Download preliminary revisions as PDF to preserve their original layout.'); NotFoundException: 'KYC form revision not found'); ForbiddenException: 'User is not assigned to a tenant'); NotFoundException: 'KYC case not found').
- Evidence: [backend/src/kyc/kyc.controller.ts:94](../../backend/src/kyc/kyc.controller.ts#L94).
- Logic chain: KycService.downloadFormRevision [backend/src/kyc/kyc.service.ts:1580](../../backend/src/kyc/kyc.service.ts#L1580); KycService.getFormRevision [backend/src/kyc/kyc.service.ts:1563](../../backend/src/kyc/kyc.service.ts#L1563); KycService.getFormRecord [backend/src/kyc/kyc.service.ts:2520](../../backend/src/kyc/kyc.service.ts#L2520); KycService.formTenantWhere [backend/src/kyc/kyc.service.ts:2939](../../backend/src/kyc/kyc.service.ts#L2939); KycService.getTenantId [backend/src/kyc/kyc.service.ts:2947](../../backend/src/kyc/kyc.service.ts#L2947); KycService.formInclude [backend/src/kyc/kyc.service.ts:2597](../../backend/src/kyc/kyc.service.ts#L2597); KycService.createForm [backend/src/kyc/kyc.service.ts:1851](../../backend/src/kyc/kyc.service.ts#L1851); KycService.findOne [backend/src/kyc/kyc.service.ts:148](../../backend/src/kyc/kyc.service.ts#L148); KycService.tenantWhere [backend/src/kyc/kyc.service.ts:2922](../../backend/src/kyc/kyc.service.ts#L2922); KycService.caseInclude [backend/src/kyc/kyc.service.ts:4020](../../backend/src/kyc/kyc.service.ts#L4020); KycService.withKycNumber [backend/src/kyc/kyc.service.ts:3978](../../backend/src/kyc/kyc.service.ts#L3978); KycService.generatedKycNumber [backend/src/kyc/kyc.service.ts:3962](../../backend/src/kyc/kyc.service.ts#L3962); KycService.audit [backend/src/kyc/kyc.service.ts:3485](../../backend/src/kyc/kyc.service.ts#L3485); KycService.jsonValue [backend/src/kyc/kyc.service.ts:3872](../../backend/src/kyc/kyc.service.ts#L3872).
- QA: apply Q-API for this ID and its workflow-specific cases; store status/body/DB diff with secrets removed.
- DTO field-access candidates: none resolved. These span reachable helpers and may include fields of internally composed DTOs; they are not a mandatory field list or complete wire schema. Match to the entry DTO and workflow before constructing requests.

## API-EBFAE586

**GET /api/kyc/:id/form/revisions/:revisionId/files/:fileId** - KycController.downloadRevisionFile

- Entry/auth: AuthGuard('jwt'); RolesGuard; fallback roles: AML_TEAM, AML_SUPERVISOR, DMLRO, MLRO, SEF, COMPANY_ADMIN, SUPER_ADMIN.
- Inputs: `@CurrentUser() user: RequestUser`; `@Param('id') id: string`; `@Param('revisionId') revisionId: string`; `@Param('fileId') fileId: string`; `@Res() res: Response`.
- Output: Response.send binary/HTML; see controller MIME and Content-Disposition. Inferred by TypeScript; no explicit response DTO.
- Behavior: GET WITH SIDE EFFECTS; detected reachable writes: kycForm.upsert.
- Tenant/role/state/validation helper candidates: formTenantWhere, tenantWhere.
- Error branch candidates: NotFoundException: 'Archived attachment not found'); NotFoundException: 'KYC form revision not found'); ForbiddenException: 'User is not assigned to a tenant'); NotFoundException: 'KYC case not found').
- Evidence: [backend/src/kyc/kyc.controller.ts:104](../../backend/src/kyc/kyc.controller.ts#L104).
- Logic chain: KycService.downloadRevisionFile [backend/src/kyc/kyc.service.ts:1573](../../backend/src/kyc/kyc.service.ts#L1573); KycService.getFormRevision [backend/src/kyc/kyc.service.ts:1563](../../backend/src/kyc/kyc.service.ts#L1563); KycService.getFormRecord [backend/src/kyc/kyc.service.ts:2520](../../backend/src/kyc/kyc.service.ts#L2520); KycService.formTenantWhere [backend/src/kyc/kyc.service.ts:2939](../../backend/src/kyc/kyc.service.ts#L2939); KycService.getTenantId [backend/src/kyc/kyc.service.ts:2947](../../backend/src/kyc/kyc.service.ts#L2947); KycService.formInclude [backend/src/kyc/kyc.service.ts:2597](../../backend/src/kyc/kyc.service.ts#L2597); KycService.createForm [backend/src/kyc/kyc.service.ts:1851](../../backend/src/kyc/kyc.service.ts#L1851); KycService.findOne [backend/src/kyc/kyc.service.ts:148](../../backend/src/kyc/kyc.service.ts#L148); KycService.tenantWhere [backend/src/kyc/kyc.service.ts:2922](../../backend/src/kyc/kyc.service.ts#L2922); KycService.caseInclude [backend/src/kyc/kyc.service.ts:4020](../../backend/src/kyc/kyc.service.ts#L4020); KycService.withKycNumber [backend/src/kyc/kyc.service.ts:3978](../../backend/src/kyc/kyc.service.ts#L3978); KycService.generatedKycNumber [backend/src/kyc/kyc.service.ts:3962](../../backend/src/kyc/kyc.service.ts#L3962).
- QA: apply Q-API for this ID and its workflow-specific cases; store status/body/DB diff with secrets removed.
- DTO field-access candidates: none resolved. These span reachable helpers and may include fields of internally composed DTOs; they are not a mandatory field list or complete wire schema. Match to the entry DTO and workflow before constructing requests.

## API-A221380A

**PATCH /api/kyc/:id/form/section-a** - KycController.saveSectionA

- Entry/auth: AuthGuard('jwt'); RolesGuard; fallback roles: AML_TEAM, AML_SUPERVISOR, COMPANY_ADMIN, SUPER_ADMIN.
- Inputs: `@CurrentUser() user: RequestUser`; `@Param('id') id: string`; `@Body() dto: Record<string, unknown>`.
- Output: JSON returned from delegated service; inferred fields in linked implementation. Inferred by TypeScript; no explicit response DTO.
- Behavior: Command (may mutate); detected reachable writes: kycSectionData.upsert, kycForm.update, kycForm.upsert, kycSectionData.update, kycSectionData.create.
- Tenant/role/state/validation helper candidates: validateEmail, requireWritableForm, hasAnyRole, tenantWhere, isLegacyFullKycDraft, formTenantWhere.
- Error branch candidates: BadRequestException: 'Provide a valid email address'); ForbiddenException: 'You do not have permission to edit this KYC form section'); NotFoundException: 'KYC case not found'); BadRequestException: 'KYC preparation is locked while the case is under review. It can be edited again only after DMLRO returns it to the AML Supervisor.'); BadRequestException: 'KYC form is locked'); BadRequestException: 'This form revision has changed. Refresh the page before saving your amendment.'); BadRequestException: 'KYC form is locked. Create a new version before editing.'); ForbiddenException: 'User is not assigned to a tenant').
- Evidence: [backend/src/kyc/kyc.controller.ts:114](../../backend/src/kyc/kyc.controller.ts#L114).
- Logic chain: KycService.saveSectionA [backend/src/kyc/kyc.service.ts:1907](../../backend/src/kyc/kyc.service.ts#L1907); KycService.validateEmail [backend/src/kyc/kyc.service.ts:3808](../../backend/src/kyc/kyc.service.ts#L3808); KycService.saveSectionData [backend/src/kyc/kyc.service.ts:2448](../../backend/src/kyc/kyc.service.ts#L2448); KycService.requireWritableForm [backend/src/kyc/kyc.service.ts:2477](../../backend/src/kyc/kyc.service.ts#L2477); KycService.hasAnyRole [backend/src/kyc/kyc.service.ts:2959](../../backend/src/kyc/kyc.service.ts#L2959); KycService.tenantWhere [backend/src/kyc/kyc.service.ts:2922](../../backend/src/kyc/kyc.service.ts#L2922); KycService.getTenantId [backend/src/kyc/kyc.service.ts:2947](../../backend/src/kyc/kyc.service.ts#L2947); KycService.isPreparationEditableStatus [backend/src/kyc/kyc.service.ts:2841](../../backend/src/kyc/kyc.service.ts#L2841); KycService.isLegacyFullKycDraft [backend/src/kyc/kyc.service.ts:2835](../../backend/src/kyc/kyc.service.ts#L2835); KycService.formTenantWhere [backend/src/kyc/kyc.service.ts:2939](../../backend/src/kyc/kyc.service.ts#L2939); KycService.createForm [backend/src/kyc/kyc.service.ts:1851](../../backend/src/kyc/kyc.service.ts#L1851); KycService.findOne [backend/src/kyc/kyc.service.ts:148](../../backend/src/kyc/kyc.service.ts#L148); KycService.caseInclude [backend/src/kyc/kyc.service.ts:4020](../../backend/src/kyc/kyc.service.ts#L4020); KycService.withKycNumber [backend/src/kyc/kyc.service.ts:3978](../../backend/src/kyc/kyc.service.ts#L3978); KycService.generatedKycNumber [backend/src/kyc/kyc.service.ts:3962](../../backend/src/kyc/kyc.service.ts#L3962); KycService.formInclude [backend/src/kyc/kyc.service.ts:2597](../../backend/src/kyc/kyc.service.ts#L2597); KycService.jsonValue [backend/src/kyc/kyc.service.ts:3872](../../backend/src/kyc/kyc.service.ts#L3872); KycService.getForm [backend/src/kyc/kyc.service.ts:1874](../../backend/src/kyc/kyc.service.ts#L1874); KycService.serializeForm [backend/src/kyc/kyc.service.ts:2534](../../backend/src/kyc/kyc.service.ts#L2534); KycService.sectionRows [backend/src/kyc/kyc.service.ts:2625](../../backend/src/kyc/kyc.service.ts#L2625); KycService.asArray [backend/src/kyc/kyc.service.ts:3823](../../backend/src/kyc/kyc.service.ts#L3823); KycService.text [backend/src/kyc/kyc.service.ts:3885](../../backend/src/kyc/kyc.service.ts#L3885); KycService.sectionFWithCaseDocuments [backend/src/kyc/kyc.service.ts:2630](../../backend/src/kyc/kyc.service.ts#L2630); KycService.dedupeRequiredDocumentRows [backend/src/kyc/kyc.service.ts:2712](../../backend/src/kyc/kyc.service.ts#L2712); KycService.optionalText [backend/src/kyc/kyc.service.ts:3838](../../backend/src/kyc/kyc.service.ts#L3838); KycService.documentMatchText [backend/src/kyc/kyc.service.ts:2809](../../backend/src/kyc/kyc.service.ts#L2809); KycService.documentFileNames [backend/src/kyc/kyc.service.ts:2773](../../backend/src/kyc/kyc.service.ts#L2773); KycService.isRequiredDocumentMatch [backend/src/kyc/kyc.service.ts:2788](../../backend/src/kyc/kyc.service.ts#L2788); KycService.dedupeAdditionalDocumentRows [backend/src/kyc/kyc.service.ts:2754](../../backend/src/kyc/kyc.service.ts#L2754); KycService.ensureKycNumber [backend/src/kyc/kyc.service.ts:3932](../../backend/src/kyc/kyc.service.ts#L3932).
- QA: apply Q-API for this ID and its workflow-specific cases; store status/body/DB diff with secrets removed.
- DTO field-access candidates: email. These span reachable helpers and may include fields of internally composed DTOs; they are not a mandatory field list or complete wire schema. Match to the entry DTO and workflow before constructing requests.

## API-6DF83F11

**PATCH /api/kyc/:id/form/section-b** - KycController.saveSectionB

- Entry/auth: AuthGuard('jwt'); RolesGuard; fallback roles: AML_TEAM, AML_SUPERVISOR, COMPANY_ADMIN, SUPER_ADMIN.
- Inputs: `@CurrentUser() user: RequestUser`; `@Param('id') id: string`; `@Body() dto: Record<string, unknown>`.
- Output: JSON returned from delegated service; inferred fields in linked implementation. Inferred by TypeScript; no explicit response DTO.
- Behavior: Command (may mutate); detected reachable writes: kycShareholder.deleteMany, kycUbo.deleteMany, kycSectionData.upsert, kycForm.update, kycForm.upsert, kycShareholder.createMany, kycUbo.createMany, kycSectionData.update, kycSectionData.create.
- Tenant/role/state/validation helper candidates: requireWritableForm, hasAnyRole, tenantWhere, isLegacyFullKycDraft, formTenantWhere, numberValue, requiredText.
- Error branch candidates: BadRequestException: 'Link each indirect beneficial owner to a corporate shareholder in this form.'); BadRequestException: 'Interest percentage cannot exceed 100% within the same control layer'); ForbiddenException: 'You do not have permission to edit this KYC form section'); NotFoundException: 'KYC case not found'); BadRequestException: 'KYC preparation is locked while the case is under review. It can be edited again only after DMLRO returns it to the AML Supervisor.'); BadRequestException: 'KYC form is locked'); BadRequestException: 'This form revision has changed. Refresh the page before saving your amendment.'); BadRequestException: 'KYC form is locked. Create a new version before editing.'); ForbiddenException: 'User is not assigned to a tenant'); BadRequestException: 'Percentage fields must be numeric'); BadRequestException: `${label} is required`); BadRequestException: 'Invalid date value').
- Evidence: [backend/src/kyc/kyc.controller.ts:120](../../backend/src/kyc/kyc.controller.ts#L120).
- Logic chain: KycService.saveOwnership [backend/src/kyc/kyc.service.ts:1925](../../backend/src/kyc/kyc.service.ts#L1925); KycService.requireWritableForm [backend/src/kyc/kyc.service.ts:2477](../../backend/src/kyc/kyc.service.ts#L2477); KycService.hasAnyRole [backend/src/kyc/kyc.service.ts:2959](../../backend/src/kyc/kyc.service.ts#L2959); KycService.tenantWhere [backend/src/kyc/kyc.service.ts:2922](../../backend/src/kyc/kyc.service.ts#L2922); KycService.getTenantId [backend/src/kyc/kyc.service.ts:2947](../../backend/src/kyc/kyc.service.ts#L2947); KycService.isPreparationEditableStatus [backend/src/kyc/kyc.service.ts:2841](../../backend/src/kyc/kyc.service.ts#L2841); KycService.isLegacyFullKycDraft [backend/src/kyc/kyc.service.ts:2835](../../backend/src/kyc/kyc.service.ts#L2835); KycService.formTenantWhere [backend/src/kyc/kyc.service.ts:2939](../../backend/src/kyc/kyc.service.ts#L2939); KycService.createForm [backend/src/kyc/kyc.service.ts:1851](../../backend/src/kyc/kyc.service.ts#L1851); KycService.findOne [backend/src/kyc/kyc.service.ts:148](../../backend/src/kyc/kyc.service.ts#L148); KycService.caseInclude [backend/src/kyc/kyc.service.ts:4020](../../backend/src/kyc/kyc.service.ts#L4020); KycService.withKycNumber [backend/src/kyc/kyc.service.ts:3978](../../backend/src/kyc/kyc.service.ts#L3978); KycService.generatedKycNumber [backend/src/kyc/kyc.service.ts:3962](../../backend/src/kyc/kyc.service.ts#L3962); KycService.formInclude [backend/src/kyc/kyc.service.ts:2597](../../backend/src/kyc/kyc.service.ts#L2597); KycService.asArray [backend/src/kyc/kyc.service.ts:3823](../../backend/src/kyc/kyc.service.ts#L3823); KycService.hasRowValue [backend/src/kyc/kyc.service.ts:3827](../../backend/src/kyc/kyc.service.ts#L3827); KycService.numberValue [backend/src/kyc/kyc.service.ts:3858](../../backend/src/kyc/kyc.service.ts#L3858); KycService.text [backend/src/kyc/kyc.service.ts:3885](../../backend/src/kyc/kyc.service.ts#L3885); KycService.jsonValue [backend/src/kyc/kyc.service.ts:3872](../../backend/src/kyc/kyc.service.ts#L3872); KycService.writeOwnershipRows [backend/src/kyc/kyc.service.ts:2012](../../backend/src/kyc/kyc.service.ts#L2012); KycService.requiredText [backend/src/kyc/kyc.service.ts:3831](../../backend/src/kyc/kyc.service.ts#L3831); KycService.optionText [backend/src/kyc/kyc.service.ts:3893](../../backend/src/kyc/kyc.service.ts#L3893); KycService.dateValue [backend/src/kyc/kyc.service.ts:3847](../../backend/src/kyc/kyc.service.ts#L3847); KycService.optionalText [backend/src/kyc/kyc.service.ts:3838](../../backend/src/kyc/kyc.service.ts#L3838); KycService.decimalValue [backend/src/kyc/kyc.service.ts:3867](../../backend/src/kyc/kyc.service.ts#L3867); KycService.getForm [backend/src/kyc/kyc.service.ts:1874](../../backend/src/kyc/kyc.service.ts#L1874); KycService.serializeForm [backend/src/kyc/kyc.service.ts:2534](../../backend/src/kyc/kyc.service.ts#L2534); KycService.sectionRows [backend/src/kyc/kyc.service.ts:2625](../../backend/src/kyc/kyc.service.ts#L2625); KycService.sectionFWithCaseDocuments [backend/src/kyc/kyc.service.ts:2630](../../backend/src/kyc/kyc.service.ts#L2630); KycService.dedupeRequiredDocumentRows [backend/src/kyc/kyc.service.ts:2712](../../backend/src/kyc/kyc.service.ts#L2712); KycService.documentMatchText [backend/src/kyc/kyc.service.ts:2809](../../backend/src/kyc/kyc.service.ts#L2809); KycService.documentFileNames [backend/src/kyc/kyc.service.ts:2773](../../backend/src/kyc/kyc.service.ts#L2773); KycService.isRequiredDocumentMatch [backend/src/kyc/kyc.service.ts:2788](../../backend/src/kyc/kyc.service.ts#L2788); KycService.dedupeAdditionalDocumentRows [backend/src/kyc/kyc.service.ts:2754](../../backend/src/kyc/kyc.service.ts#L2754); KycService.ensureKycNumber [backend/src/kyc/kyc.service.ts:3932](../../backend/src/kyc/kyc.service.ts#L3932).
- QA: apply Q-API for this ID and its workflow-specific cases; store status/body/DB diff with secrets removed.
- DTO field-access candidates: expectedVersion, shareholders, uboDifferentFromShareholders, uboGroupStructureNotes, ubos. These span reachable helpers and may include fields of internally composed DTOs; they are not a mandatory field list or complete wire schema. Match to the entry DTO and workflow before constructing requests.

## API-6FCEF8D0

**PATCH /api/kyc/:id/form/section-c** - KycController.saveSectionC

- Entry/auth: AuthGuard('jwt'); RolesGuard; fallback roles: AML_TEAM, AML_SUPERVISOR, COMPANY_ADMIN, SUPER_ADMIN.
- Inputs: `@CurrentUser() user: RequestUser`; `@Param('id') id: string`; `@Body() dto: Record<string, unknown>`.
- Output: JSON returned from delegated service; inferred fields in linked implementation. Inferred by TypeScript; no explicit response DTO.
- Behavior: Command (may mutate); detected reachable writes: kycManager.deleteMany, kycSectionData.upsert, kycForm.update, kycForm.upsert, kycManager.createMany, kycSectionData.update, kycSectionData.create.
- Tenant/role/state/validation helper candidates: requireWritableForm, hasAnyRole, tenantWhere, isLegacyFullKycDraft, formTenantWhere, requiredText.
- Error branch candidates: ForbiddenException: 'You do not have permission to edit this KYC form section'); NotFoundException: 'KYC case not found'); BadRequestException: 'KYC preparation is locked while the case is under review. It can be edited again only after DMLRO returns it to the AML Supervisor.'); BadRequestException: 'KYC form is locked'); BadRequestException: 'This form revision has changed. Refresh the page before saving your amendment.'); BadRequestException: 'KYC form is locked. Create a new version before editing.'); ForbiddenException: 'User is not assigned to a tenant'); BadRequestException: `${label} is required`); BadRequestException: 'Invalid date value').
- Evidence: [backend/src/kyc/kyc.controller.ts:126](../../backend/src/kyc/kyc.controller.ts#L126).
- Logic chain: KycService.saveManagers [backend/src/kyc/kyc.service.ts:1983](../../backend/src/kyc/kyc.service.ts#L1983); KycService.requireWritableForm [backend/src/kyc/kyc.service.ts:2477](../../backend/src/kyc/kyc.service.ts#L2477); KycService.hasAnyRole [backend/src/kyc/kyc.service.ts:2959](../../backend/src/kyc/kyc.service.ts#L2959); KycService.tenantWhere [backend/src/kyc/kyc.service.ts:2922](../../backend/src/kyc/kyc.service.ts#L2922); KycService.getTenantId [backend/src/kyc/kyc.service.ts:2947](../../backend/src/kyc/kyc.service.ts#L2947); KycService.isPreparationEditableStatus [backend/src/kyc/kyc.service.ts:2841](../../backend/src/kyc/kyc.service.ts#L2841); KycService.isLegacyFullKycDraft [backend/src/kyc/kyc.service.ts:2835](../../backend/src/kyc/kyc.service.ts#L2835); KycService.formTenantWhere [backend/src/kyc/kyc.service.ts:2939](../../backend/src/kyc/kyc.service.ts#L2939); KycService.createForm [backend/src/kyc/kyc.service.ts:1851](../../backend/src/kyc/kyc.service.ts#L1851); KycService.findOne [backend/src/kyc/kyc.service.ts:148](../../backend/src/kyc/kyc.service.ts#L148); KycService.caseInclude [backend/src/kyc/kyc.service.ts:4020](../../backend/src/kyc/kyc.service.ts#L4020); KycService.withKycNumber [backend/src/kyc/kyc.service.ts:3978](../../backend/src/kyc/kyc.service.ts#L3978); KycService.generatedKycNumber [backend/src/kyc/kyc.service.ts:3962](../../backend/src/kyc/kyc.service.ts#L3962); KycService.formInclude [backend/src/kyc/kyc.service.ts:2597](../../backend/src/kyc/kyc.service.ts#L2597); KycService.asArray [backend/src/kyc/kyc.service.ts:3823](../../backend/src/kyc/kyc.service.ts#L3823); KycService.hasRowValue [backend/src/kyc/kyc.service.ts:3827](../../backend/src/kyc/kyc.service.ts#L3827); KycService.jsonValue [backend/src/kyc/kyc.service.ts:3872](../../backend/src/kyc/kyc.service.ts#L3872); KycService.writeManagerRows [backend/src/kyc/kyc.service.ts:2053](../../backend/src/kyc/kyc.service.ts#L2053); KycService.requiredText [backend/src/kyc/kyc.service.ts:3831](../../backend/src/kyc/kyc.service.ts#L3831); KycService.optionalText [backend/src/kyc/kyc.service.ts:3838](../../backend/src/kyc/kyc.service.ts#L3838); KycService.text [backend/src/kyc/kyc.service.ts:3885](../../backend/src/kyc/kyc.service.ts#L3885); KycService.dateValue [backend/src/kyc/kyc.service.ts:3847](../../backend/src/kyc/kyc.service.ts#L3847); KycService.optionText [backend/src/kyc/kyc.service.ts:3893](../../backend/src/kyc/kyc.service.ts#L3893); KycService.getForm [backend/src/kyc/kyc.service.ts:1874](../../backend/src/kyc/kyc.service.ts#L1874); KycService.serializeForm [backend/src/kyc/kyc.service.ts:2534](../../backend/src/kyc/kyc.service.ts#L2534); KycService.sectionRows [backend/src/kyc/kyc.service.ts:2625](../../backend/src/kyc/kyc.service.ts#L2625); KycService.sectionFWithCaseDocuments [backend/src/kyc/kyc.service.ts:2630](../../backend/src/kyc/kyc.service.ts#L2630); KycService.dedupeRequiredDocumentRows [backend/src/kyc/kyc.service.ts:2712](../../backend/src/kyc/kyc.service.ts#L2712); KycService.documentMatchText [backend/src/kyc/kyc.service.ts:2809](../../backend/src/kyc/kyc.service.ts#L2809); KycService.documentFileNames [backend/src/kyc/kyc.service.ts:2773](../../backend/src/kyc/kyc.service.ts#L2773); KycService.isRequiredDocumentMatch [backend/src/kyc/kyc.service.ts:2788](../../backend/src/kyc/kyc.service.ts#L2788); KycService.dedupeAdditionalDocumentRows [backend/src/kyc/kyc.service.ts:2754](../../backend/src/kyc/kyc.service.ts#L2754); KycService.ensureKycNumber [backend/src/kyc/kyc.service.ts:3932](../../backend/src/kyc/kyc.service.ts#L3932).
- QA: apply Q-API for this ID and its workflow-specific cases; store status/body/DB diff with secrets removed.
- DTO field-access candidates: expectedVersion, managers. These span reachable helpers and may include fields of internally composed DTOs; they are not a mandatory field list or complete wire schema. Match to the entry DTO and workflow before constructing requests.

## API-95E0B5BF

**PATCH /api/kyc/:id/form/section-d** - KycController.saveSectionD

- Entry/auth: AuthGuard('jwt'); RolesGuard; fallback roles: AML_TEAM, AML_SUPERVISOR, COMPANY_ADMIN, SUPER_ADMIN.
- Inputs: `@CurrentUser() user: RequestUser`; `@Param('id') id: string`; `@Body() dto: Record<string, unknown>`.
- Output: JSON returned from delegated service; inferred fields in linked implementation. Inferred by TypeScript; no explicit response DTO.
- Behavior: Command (may mutate); detected reachable writes: kycSectionData.upsert, kycForm.update, kycForm.upsert, kycSectionData.update, kycSectionData.create.
- Tenant/role/state/validation helper candidates: requireWritableForm, hasAnyRole, tenantWhere, isLegacyFullKycDraft, formTenantWhere.
- Error branch candidates: ForbiddenException: 'You do not have permission to edit this KYC form section'); NotFoundException: 'KYC case not found'); BadRequestException: 'KYC preparation is locked while the case is under review. It can be edited again only after DMLRO returns it to the AML Supervisor.'); BadRequestException: 'KYC form is locked'); BadRequestException: 'This form revision has changed. Refresh the page before saving your amendment.'); BadRequestException: 'KYC form is locked. Create a new version before editing.'); ForbiddenException: 'User is not assigned to a tenant').
- Evidence: [backend/src/kyc/kyc.controller.ts:132](../../backend/src/kyc/kyc.controller.ts#L132).
- Logic chain: KycService.saveSectionD [backend/src/kyc/kyc.service.ts:1912](../../backend/src/kyc/kyc.service.ts#L1912); KycService.saveSectionData [backend/src/kyc/kyc.service.ts:2448](../../backend/src/kyc/kyc.service.ts#L2448); KycService.requireWritableForm [backend/src/kyc/kyc.service.ts:2477](../../backend/src/kyc/kyc.service.ts#L2477); KycService.hasAnyRole [backend/src/kyc/kyc.service.ts:2959](../../backend/src/kyc/kyc.service.ts#L2959); KycService.tenantWhere [backend/src/kyc/kyc.service.ts:2922](../../backend/src/kyc/kyc.service.ts#L2922); KycService.getTenantId [backend/src/kyc/kyc.service.ts:2947](../../backend/src/kyc/kyc.service.ts#L2947); KycService.isPreparationEditableStatus [backend/src/kyc/kyc.service.ts:2841](../../backend/src/kyc/kyc.service.ts#L2841); KycService.isLegacyFullKycDraft [backend/src/kyc/kyc.service.ts:2835](../../backend/src/kyc/kyc.service.ts#L2835); KycService.formTenantWhere [backend/src/kyc/kyc.service.ts:2939](../../backend/src/kyc/kyc.service.ts#L2939); KycService.createForm [backend/src/kyc/kyc.service.ts:1851](../../backend/src/kyc/kyc.service.ts#L1851); KycService.findOne [backend/src/kyc/kyc.service.ts:148](../../backend/src/kyc/kyc.service.ts#L148); KycService.caseInclude [backend/src/kyc/kyc.service.ts:4020](../../backend/src/kyc/kyc.service.ts#L4020); KycService.withKycNumber [backend/src/kyc/kyc.service.ts:3978](../../backend/src/kyc/kyc.service.ts#L3978); KycService.generatedKycNumber [backend/src/kyc/kyc.service.ts:3962](../../backend/src/kyc/kyc.service.ts#L3962); KycService.formInclude [backend/src/kyc/kyc.service.ts:2597](../../backend/src/kyc/kyc.service.ts#L2597); KycService.jsonValue [backend/src/kyc/kyc.service.ts:3872](../../backend/src/kyc/kyc.service.ts#L3872); KycService.getForm [backend/src/kyc/kyc.service.ts:1874](../../backend/src/kyc/kyc.service.ts#L1874); KycService.serializeForm [backend/src/kyc/kyc.service.ts:2534](../../backend/src/kyc/kyc.service.ts#L2534); KycService.sectionRows [backend/src/kyc/kyc.service.ts:2625](../../backend/src/kyc/kyc.service.ts#L2625); KycService.asArray [backend/src/kyc/kyc.service.ts:3823](../../backend/src/kyc/kyc.service.ts#L3823); KycService.text [backend/src/kyc/kyc.service.ts:3885](../../backend/src/kyc/kyc.service.ts#L3885); KycService.sectionFWithCaseDocuments [backend/src/kyc/kyc.service.ts:2630](../../backend/src/kyc/kyc.service.ts#L2630); KycService.dedupeRequiredDocumentRows [backend/src/kyc/kyc.service.ts:2712](../../backend/src/kyc/kyc.service.ts#L2712); KycService.optionalText [backend/src/kyc/kyc.service.ts:3838](../../backend/src/kyc/kyc.service.ts#L3838); KycService.documentMatchText [backend/src/kyc/kyc.service.ts:2809](../../backend/src/kyc/kyc.service.ts#L2809); KycService.documentFileNames [backend/src/kyc/kyc.service.ts:2773](../../backend/src/kyc/kyc.service.ts#L2773); KycService.isRequiredDocumentMatch [backend/src/kyc/kyc.service.ts:2788](../../backend/src/kyc/kyc.service.ts#L2788); KycService.dedupeAdditionalDocumentRows [backend/src/kyc/kyc.service.ts:2754](../../backend/src/kyc/kyc.service.ts#L2754); KycService.ensureKycNumber [backend/src/kyc/kyc.service.ts:3932](../../backend/src/kyc/kyc.service.ts#L3932).
- QA: apply Q-API for this ID and its workflow-specific cases; store status/body/DB diff with secrets removed.
- DTO field-access candidates: none resolved. These span reachable helpers and may include fields of internally composed DTOs; they are not a mandatory field list or complete wire schema. Match to the entry DTO and workflow before constructing requests.

## API-F0C2E965

**PATCH /api/kyc/:id/form/section-e** - KycController.saveSectionE

- Entry/auth: AuthGuard('jwt'); RolesGuard; fallback roles: AML_TEAM, AML_SUPERVISOR, COMPANY_ADMIN, SUPER_ADMIN.
- Inputs: `@CurrentUser() user: RequestUser`; `@Param('id') id: string`; `@Body() dto: Record<string, unknown>`.
- Output: JSON returned from delegated service; inferred fields in linked implementation. Inferred by TypeScript; no explicit response DTO.
- Behavior: Command (may mutate); detected reachable writes: kycSectionData.upsert, kycForm.update, kycForm.upsert, kycSectionData.update, kycSectionData.create.
- Tenant/role/state/validation helper candidates: validateEmail, requireWritableForm, hasAnyRole, tenantWhere, isLegacyFullKycDraft, formTenantWhere.
- Error branch candidates: BadRequestException: 'Provide a valid email address'); ForbiddenException: 'You do not have permission to edit this KYC form section'); NotFoundException: 'KYC case not found'); BadRequestException: 'KYC preparation is locked while the case is under review. It can be edited again only after DMLRO returns it to the AML Supervisor.'); BadRequestException: 'KYC form is locked'); BadRequestException: 'This form revision has changed. Refresh the page before saving your amendment.'); BadRequestException: 'KYC form is locked. Create a new version before editing.'); ForbiddenException: 'User is not assigned to a tenant').
- Evidence: [backend/src/kyc/kyc.controller.ts:138](../../backend/src/kyc/kyc.controller.ts#L138).
- Logic chain: KycService.saveSectionE [backend/src/kyc/kyc.service.ts:1916](../../backend/src/kyc/kyc.service.ts#L1916); KycService.validateEmail [backend/src/kyc/kyc.service.ts:3808](../../backend/src/kyc/kyc.service.ts#L3808); KycService.saveSectionData [backend/src/kyc/kyc.service.ts:2448](../../backend/src/kyc/kyc.service.ts#L2448); KycService.requireWritableForm [backend/src/kyc/kyc.service.ts:2477](../../backend/src/kyc/kyc.service.ts#L2477); KycService.hasAnyRole [backend/src/kyc/kyc.service.ts:2959](../../backend/src/kyc/kyc.service.ts#L2959); KycService.tenantWhere [backend/src/kyc/kyc.service.ts:2922](../../backend/src/kyc/kyc.service.ts#L2922); KycService.getTenantId [backend/src/kyc/kyc.service.ts:2947](../../backend/src/kyc/kyc.service.ts#L2947); KycService.isPreparationEditableStatus [backend/src/kyc/kyc.service.ts:2841](../../backend/src/kyc/kyc.service.ts#L2841); KycService.isLegacyFullKycDraft [backend/src/kyc/kyc.service.ts:2835](../../backend/src/kyc/kyc.service.ts#L2835); KycService.formTenantWhere [backend/src/kyc/kyc.service.ts:2939](../../backend/src/kyc/kyc.service.ts#L2939); KycService.createForm [backend/src/kyc/kyc.service.ts:1851](../../backend/src/kyc/kyc.service.ts#L1851); KycService.findOne [backend/src/kyc/kyc.service.ts:148](../../backend/src/kyc/kyc.service.ts#L148); KycService.caseInclude [backend/src/kyc/kyc.service.ts:4020](../../backend/src/kyc/kyc.service.ts#L4020); KycService.withKycNumber [backend/src/kyc/kyc.service.ts:3978](../../backend/src/kyc/kyc.service.ts#L3978); KycService.generatedKycNumber [backend/src/kyc/kyc.service.ts:3962](../../backend/src/kyc/kyc.service.ts#L3962); KycService.formInclude [backend/src/kyc/kyc.service.ts:2597](../../backend/src/kyc/kyc.service.ts#L2597); KycService.jsonValue [backend/src/kyc/kyc.service.ts:3872](../../backend/src/kyc/kyc.service.ts#L3872); KycService.getForm [backend/src/kyc/kyc.service.ts:1874](../../backend/src/kyc/kyc.service.ts#L1874); KycService.serializeForm [backend/src/kyc/kyc.service.ts:2534](../../backend/src/kyc/kyc.service.ts#L2534); KycService.sectionRows [backend/src/kyc/kyc.service.ts:2625](../../backend/src/kyc/kyc.service.ts#L2625); KycService.asArray [backend/src/kyc/kyc.service.ts:3823](../../backend/src/kyc/kyc.service.ts#L3823); KycService.text [backend/src/kyc/kyc.service.ts:3885](../../backend/src/kyc/kyc.service.ts#L3885); KycService.sectionFWithCaseDocuments [backend/src/kyc/kyc.service.ts:2630](../../backend/src/kyc/kyc.service.ts#L2630); KycService.dedupeRequiredDocumentRows [backend/src/kyc/kyc.service.ts:2712](../../backend/src/kyc/kyc.service.ts#L2712); KycService.optionalText [backend/src/kyc/kyc.service.ts:3838](../../backend/src/kyc/kyc.service.ts#L3838); KycService.documentMatchText [backend/src/kyc/kyc.service.ts:2809](../../backend/src/kyc/kyc.service.ts#L2809); KycService.documentFileNames [backend/src/kyc/kyc.service.ts:2773](../../backend/src/kyc/kyc.service.ts#L2773); KycService.isRequiredDocumentMatch [backend/src/kyc/kyc.service.ts:2788](../../backend/src/kyc/kyc.service.ts#L2788); KycService.dedupeAdditionalDocumentRows [backend/src/kyc/kyc.service.ts:2754](../../backend/src/kyc/kyc.service.ts#L2754); KycService.ensureKycNumber [backend/src/kyc/kyc.service.ts:3932](../../backend/src/kyc/kyc.service.ts#L3932).
- QA: apply Q-API for this ID and its workflow-specific cases; store status/body/DB diff with secrets removed.
- DTO field-access candidates: email. These span reachable helpers and may include fields of internally composed DTOs; they are not a mandatory field list or complete wire schema. Match to the entry DTO and workflow before constructing requests.

## API-70638C15

**PATCH /api/kyc/:id/form/section-f** - KycController.saveSectionF

- Entry/auth: AuthGuard('jwt'); RolesGuard; fallback roles: AML_TEAM, AML_SUPERVISOR, COMPANY_ADMIN, SUPER_ADMIN.
- Inputs: `@CurrentUser() user: RequestUser`; `@Param('id') id: string`; `@Body() dto: Record<string, unknown>`.
- Output: JSON returned from delegated service; inferred fields in linked implementation. Inferred by TypeScript; no explicit response DTO.
- Behavior: Command (may mutate); detected reachable writes: kycRequiredDocument.deleteMany, kycRequiredDocument.createMany, kycSectionData.upsert, kycForm.update, kycForm.upsert, legalDocument.create, kycCase.update, kycCaseStatusHistory.create, kycSectionData.update, kycSectionData.create.
- Tenant/role/state/validation helper candidates: requireWritableForm, hasAnyRole, tenantWhere, isLegacyFullKycDraft, formTenantWhere, requiredText.
- Error branch candidates: ForbiddenException: 'You do not have permission to edit this KYC form section'); NotFoundException: 'KYC case not found'); BadRequestException: 'KYC preparation is locked while the case is under review. It can be edited again only after DMLRO returns it to the AML Supervisor.'); BadRequestException: 'KYC form is locked'); BadRequestException: 'This form revision has changed. Refresh the page before saving your amendment.'); BadRequestException: 'KYC form is locked. Create a new version before editing.'); ForbiddenException: 'User is not assigned to a tenant'); BadRequestException: `${label} is required`).
- Evidence: [backend/src/kyc/kyc.controller.ts:144](../../backend/src/kyc/kyc.controller.ts#L144).
- Logic chain: KycService.saveRequiredDocuments [backend/src/kyc/kyc.service.ts:2086](../../backend/src/kyc/kyc.service.ts#L2086); KycService.requireWritableForm [backend/src/kyc/kyc.service.ts:2477](../../backend/src/kyc/kyc.service.ts#L2477); KycService.hasAnyRole [backend/src/kyc/kyc.service.ts:2959](../../backend/src/kyc/kyc.service.ts#L2959); KycService.tenantWhere [backend/src/kyc/kyc.service.ts:2922](../../backend/src/kyc/kyc.service.ts#L2922); KycService.getTenantId [backend/src/kyc/kyc.service.ts:2947](../../backend/src/kyc/kyc.service.ts#L2947); KycService.isPreparationEditableStatus [backend/src/kyc/kyc.service.ts:2841](../../backend/src/kyc/kyc.service.ts#L2841); KycService.isLegacyFullKycDraft [backend/src/kyc/kyc.service.ts:2835](../../backend/src/kyc/kyc.service.ts#L2835); KycService.formTenantWhere [backend/src/kyc/kyc.service.ts:2939](../../backend/src/kyc/kyc.service.ts#L2939); KycService.createForm [backend/src/kyc/kyc.service.ts:1851](../../backend/src/kyc/kyc.service.ts#L1851); KycService.findOne [backend/src/kyc/kyc.service.ts:148](../../backend/src/kyc/kyc.service.ts#L148); KycService.caseInclude [backend/src/kyc/kyc.service.ts:4020](../../backend/src/kyc/kyc.service.ts#L4020); KycService.withKycNumber [backend/src/kyc/kyc.service.ts:3978](../../backend/src/kyc/kyc.service.ts#L3978); KycService.generatedKycNumber [backend/src/kyc/kyc.service.ts:3962](../../backend/src/kyc/kyc.service.ts#L3962); KycService.formInclude [backend/src/kyc/kyc.service.ts:2597](../../backend/src/kyc/kyc.service.ts#L2597); KycService.dedupeRequiredDocumentRows [backend/src/kyc/kyc.service.ts:2712](../../backend/src/kyc/kyc.service.ts#L2712); KycService.optionalText [backend/src/kyc/kyc.service.ts:3838](../../backend/src/kyc/kyc.service.ts#L3838); KycService.text [backend/src/kyc/kyc.service.ts:3885](../../backend/src/kyc/kyc.service.ts#L3885); KycService.documentMatchText [backend/src/kyc/kyc.service.ts:2809](../../backend/src/kyc/kyc.service.ts#L2809); KycService.documentFileNames [backend/src/kyc/kyc.service.ts:2773](../../backend/src/kyc/kyc.service.ts#L2773); KycService.asArray [backend/src/kyc/kyc.service.ts:3823](../../backend/src/kyc/kyc.service.ts#L3823); KycService.hasRowValue [backend/src/kyc/kyc.service.ts:3827](../../backend/src/kyc/kyc.service.ts#L3827); KycService.dedupeAdditionalDocumentRows [backend/src/kyc/kyc.service.ts:2754](../../backend/src/kyc/kyc.service.ts#L2754); KycService.requiredText [backend/src/kyc/kyc.service.ts:3831](../../backend/src/kyc/kyc.service.ts#L3831); KycService.syncRequiredDocumentsToLegalDocuments [backend/src/kyc/kyc.service.ts:2146](../../backend/src/kyc/kyc.service.ts#L2146); KycService.legalDocumentSyncKey [backend/src/kyc/kyc.service.ts:4016](../../backend/src/kyc/kyc.service.ts#L4016); KycService.jsonValue [backend/src/kyc/kyc.service.ts:3872](../../backend/src/kyc/kyc.service.ts#L3872); KycService.markDocumentsUploadedFromSectionF [backend/src/kyc/kyc.service.ts:2206](../../backend/src/kyc/kyc.service.ts#L2206); KycService.getForm [backend/src/kyc/kyc.service.ts:1874](../../backend/src/kyc/kyc.service.ts#L1874); KycService.serializeForm [backend/src/kyc/kyc.service.ts:2534](../../backend/src/kyc/kyc.service.ts#L2534); KycService.sectionRows [backend/src/kyc/kyc.service.ts:2625](../../backend/src/kyc/kyc.service.ts#L2625); KycService.sectionFWithCaseDocuments [backend/src/kyc/kyc.service.ts:2630](../../backend/src/kyc/kyc.service.ts#L2630); KycService.isRequiredDocumentMatch [backend/src/kyc/kyc.service.ts:2788](../../backend/src/kyc/kyc.service.ts#L2788); KycService.ensureKycNumber [backend/src/kyc/kyc.service.ts:3932](../../backend/src/kyc/kyc.service.ts#L3932).
- QA: apply Q-API for this ID and its workflow-specific cases; store status/body/DB diff with secrets removed.
- DTO field-access candidates: additionalDocuments, documents, expectedVersion, uploadedFilesNote. These span reachable helpers and may include fields of internally composed DTOs; they are not a mandatory field list or complete wire schema. Match to the entry DTO and workflow before constructing requests.

## API-5EFC49C1

**PATCH /api/kyc/:id/form/section-g** - KycController.saveSectionG

- Entry/auth: AuthGuard('jwt'); RolesGuard; fallback roles: AML_TEAM, AML_SUPERVISOR, COMPANY_ADMIN, SUPER_ADMIN.
- Inputs: `@CurrentUser() user: RequestUser`; `@Param('id') id: string`; `@Body() dto: Record<string, unknown>`.
- Output: JSON returned from delegated service; inferred fields in linked implementation. Inferred by TypeScript; no explicit response DTO.
- Behavior: Command (may mutate); detected reachable writes: kycSectionData.upsert, kycForm.update, kycForm.upsert, kycSectionData.update, kycSectionData.create.
- Tenant/role/state/validation helper candidates: requireWritableForm, hasAnyRole, tenantWhere, isLegacyFullKycDraft, formTenantWhere.
- Error branch candidates: ForbiddenException: 'You do not have permission to edit this KYC form section'); NotFoundException: 'KYC case not found'); BadRequestException: 'KYC preparation is locked while the case is under review. It can be edited again only after DMLRO returns it to the AML Supervisor.'); BadRequestException: 'KYC form is locked'); BadRequestException: 'This form revision has changed. Refresh the page before saving your amendment.'); BadRequestException: 'KYC form is locked. Create a new version before editing.'); ForbiddenException: 'User is not assigned to a tenant').
- Evidence: [backend/src/kyc/kyc.controller.ts:150](../../backend/src/kyc/kyc.controller.ts#L150).
- Logic chain: KycService.saveSectionG [backend/src/kyc/kyc.service.ts:1921](../../backend/src/kyc/kyc.service.ts#L1921); KycService.saveSectionData [backend/src/kyc/kyc.service.ts:2448](../../backend/src/kyc/kyc.service.ts#L2448); KycService.requireWritableForm [backend/src/kyc/kyc.service.ts:2477](../../backend/src/kyc/kyc.service.ts#L2477); KycService.hasAnyRole [backend/src/kyc/kyc.service.ts:2959](../../backend/src/kyc/kyc.service.ts#L2959); KycService.tenantWhere [backend/src/kyc/kyc.service.ts:2922](../../backend/src/kyc/kyc.service.ts#L2922); KycService.getTenantId [backend/src/kyc/kyc.service.ts:2947](../../backend/src/kyc/kyc.service.ts#L2947); KycService.isPreparationEditableStatus [backend/src/kyc/kyc.service.ts:2841](../../backend/src/kyc/kyc.service.ts#L2841); KycService.isLegacyFullKycDraft [backend/src/kyc/kyc.service.ts:2835](../../backend/src/kyc/kyc.service.ts#L2835); KycService.formTenantWhere [backend/src/kyc/kyc.service.ts:2939](../../backend/src/kyc/kyc.service.ts#L2939); KycService.createForm [backend/src/kyc/kyc.service.ts:1851](../../backend/src/kyc/kyc.service.ts#L1851); KycService.findOne [backend/src/kyc/kyc.service.ts:148](../../backend/src/kyc/kyc.service.ts#L148); KycService.caseInclude [backend/src/kyc/kyc.service.ts:4020](../../backend/src/kyc/kyc.service.ts#L4020); KycService.withKycNumber [backend/src/kyc/kyc.service.ts:3978](../../backend/src/kyc/kyc.service.ts#L3978); KycService.generatedKycNumber [backend/src/kyc/kyc.service.ts:3962](../../backend/src/kyc/kyc.service.ts#L3962); KycService.formInclude [backend/src/kyc/kyc.service.ts:2597](../../backend/src/kyc/kyc.service.ts#L2597); KycService.jsonValue [backend/src/kyc/kyc.service.ts:3872](../../backend/src/kyc/kyc.service.ts#L3872); KycService.getForm [backend/src/kyc/kyc.service.ts:1874](../../backend/src/kyc/kyc.service.ts#L1874); KycService.serializeForm [backend/src/kyc/kyc.service.ts:2534](../../backend/src/kyc/kyc.service.ts#L2534); KycService.sectionRows [backend/src/kyc/kyc.service.ts:2625](../../backend/src/kyc/kyc.service.ts#L2625); KycService.asArray [backend/src/kyc/kyc.service.ts:3823](../../backend/src/kyc/kyc.service.ts#L3823); KycService.text [backend/src/kyc/kyc.service.ts:3885](../../backend/src/kyc/kyc.service.ts#L3885); KycService.sectionFWithCaseDocuments [backend/src/kyc/kyc.service.ts:2630](../../backend/src/kyc/kyc.service.ts#L2630); KycService.dedupeRequiredDocumentRows [backend/src/kyc/kyc.service.ts:2712](../../backend/src/kyc/kyc.service.ts#L2712); KycService.optionalText [backend/src/kyc/kyc.service.ts:3838](../../backend/src/kyc/kyc.service.ts#L3838); KycService.documentMatchText [backend/src/kyc/kyc.service.ts:2809](../../backend/src/kyc/kyc.service.ts#L2809); KycService.documentFileNames [backend/src/kyc/kyc.service.ts:2773](../../backend/src/kyc/kyc.service.ts#L2773); KycService.isRequiredDocumentMatch [backend/src/kyc/kyc.service.ts:2788](../../backend/src/kyc/kyc.service.ts#L2788); KycService.dedupeAdditionalDocumentRows [backend/src/kyc/kyc.service.ts:2754](../../backend/src/kyc/kyc.service.ts#L2754); KycService.ensureKycNumber [backend/src/kyc/kyc.service.ts:3932](../../backend/src/kyc/kyc.service.ts#L3932).
- QA: apply Q-API for this ID and its workflow-specific cases; store status/body/DB diff with secrets removed.
- DTO field-access candidates: none resolved. These span reachable helpers and may include fields of internally composed DTOs; they are not a mandatory field list or complete wire schema. Match to the entry DTO and workflow before constructing requests.

## API-76C06151

**PATCH /api/kyc/:id/form/section-h** - KycController.saveSectionH

- Entry/auth: AuthGuard('jwt'); RolesGuard; fallback roles: AML_TEAM, AML_SUPERVISOR, DMLRO, MLRO, SEF, COMPANY_ADMIN, SUPER_ADMIN.
- Inputs: `@CurrentUser() user: RequestUser`; `@Param('id') id: string`; `@Body() dto: Record<string, unknown>`.
- Output: JSON returned from delegated service; inferred fields in linked implementation. Inferred by TypeScript; no explicit response DTO.
- Behavior: Command (may mutate); detected reachable writes: kycInternalReview.upsert, kycForm.update, kycForm.upsert, kycSectionData.update, kycSectionData.create.
- Tenant/role/state/validation helper candidates: assertFormReviewEditable, tenantWhere, hasAnyRole, assertStageRole, requireWritableCase, isLegacyFullKycDraft, formTenantWhere, assertReviewStageActive, assertEditableReview, requireWritableForm, enumValue.
- Error branch candidates: ForbiddenException: 'Administrator access required'); BadRequestException: `${this.stageLabel(stage)} editing is locked while the case is with another review stage.`); NotFoundException: 'KYC case not found'); ForbiddenException: 'User is not assigned to a tenant'); ForbiddenException: `You cannot edit the ${this.stageLabel(stage)} review`); BadRequestException: 'KYC preparation is locked while the case is under DMLRO, MLRO, or SEF review. It can be edited again only after DMLRO returns it to the AML Supervisor.'); BadRequestException: `${this.stageLabel(stage)} does not have an active review task for this case.`); BadRequestException: `${this.stageLabel(stage)} review is locked after submission`); ForbiddenException: 'You do not have permission to edit this KYC form section'); BadRequestException: 'KYC preparation is locked while the case is under review. It can be edited again only after DMLRO returns it to the AML Supervisor.'); BadRequestException: 'KYC form is locked'); BadRequestException: 'This form revision has changed. Refresh the page before saving your amendment.'); BadRequestException: 'KYC form is locked. Create a new version before editing.'); BadRequestException: `${label} must be one of ${allowed.join(', ')}`); BadRequestException: 'Invalid date value').
- Evidence: [backend/src/kyc/kyc.controller.ts:156](../../backend/src/kyc/kyc.controller.ts#L156).
- Logic chain: KycService.saveInternalReview [backend/src/kyc/kyc.service.ts:2250](../../backend/src/kyc/kyc.service.ts#L2250); KycService.assertFormReviewEditable [backend/src/kyc/kyc.service.ts:3669](../../backend/src/kyc/kyc.service.ts#L3669); KycService.findOne [backend/src/kyc/kyc.service.ts:148](../../backend/src/kyc/kyc.service.ts#L148); KycService.tenantWhere [backend/src/kyc/kyc.service.ts:2922](../../backend/src/kyc/kyc.service.ts#L2922); KycService.getTenantId [backend/src/kyc/kyc.service.ts:2947](../../backend/src/kyc/kyc.service.ts#L2947); KycService.caseInclude [backend/src/kyc/kyc.service.ts:4020](../../backend/src/kyc/kyc.service.ts#L4020); KycService.withKycNumber [backend/src/kyc/kyc.service.ts:3978](../../backend/src/kyc/kyc.service.ts#L3978); KycService.generatedKycNumber [backend/src/kyc/kyc.service.ts:3962](../../backend/src/kyc/kyc.service.ts#L3962); KycService.hasAnyRole [backend/src/kyc/kyc.service.ts:2959](../../backend/src/kyc/kyc.service.ts#L2959); KycService.assertStageRole [backend/src/kyc/kyc.service.ts:2963](../../backend/src/kyc/kyc.service.ts#L2963); KycService.stageLabel [backend/src/kyc/kyc.service.ts:2976](../../backend/src/kyc/kyc.service.ts#L2976); KycService.requireWritableCase [backend/src/kyc/kyc.service.ts:2819](../../backend/src/kyc/kyc.service.ts#L2819); KycService.isPreparationEditableStatus [backend/src/kyc/kyc.service.ts:2841](../../backend/src/kyc/kyc.service.ts#L2841); KycService.isLegacyFullKycDraft [backend/src/kyc/kyc.service.ts:2835](../../backend/src/kyc/kyc.service.ts#L2835); KycService.formTenantWhere [backend/src/kyc/kyc.service.ts:2939](../../backend/src/kyc/kyc.service.ts#L2939); KycService.isDmlroStageStatus [backend/src/kyc/kyc.service.ts:2982](../../backend/src/kyc/kyc.service.ts#L2982); KycService.stageStatus [backend/src/kyc/kyc.service.ts:2987](../../backend/src/kyc/kyc.service.ts#L2987); KycService.assertReviewStageActive [backend/src/kyc/kyc.service.ts:3040](../../backend/src/kyc/kyc.service.ts#L3040); KycService.assertEditableReview [backend/src/kyc/kyc.service.ts:3030](../../backend/src/kyc/kyc.service.ts#L3030); KycService.internalReviewAllowedRoles [backend/src/kyc/kyc.service.ts:3692](../../backend/src/kyc/kyc.service.ts#L3692); KycService.requireWritableForm [backend/src/kyc/kyc.service.ts:2477](../../backend/src/kyc/kyc.service.ts#L2477); KycService.createForm [backend/src/kyc/kyc.service.ts:1851](../../backend/src/kyc/kyc.service.ts#L1851); KycService.formInclude [backend/src/kyc/kyc.service.ts:2597](../../backend/src/kyc/kyc.service.ts#L2597); KycService.internalReviewData [backend/src/kyc/kyc.service.ts:3701](../../backend/src/kyc/kyc.service.ts#L3701); KycService.enumValue [backend/src/kyc/kyc.service.ts:3815](../../backend/src/kyc/kyc.service.ts#L3815); KycService.optionalText [backend/src/kyc/kyc.service.ts:3838](../../backend/src/kyc/kyc.service.ts#L3838); KycService.text [backend/src/kyc/kyc.service.ts:3885](../../backend/src/kyc/kyc.service.ts#L3885); KycService.dateValue [backend/src/kyc/kyc.service.ts:3847](../../backend/src/kyc/kyc.service.ts#L3847); KycService.getForm [backend/src/kyc/kyc.service.ts:1874](../../backend/src/kyc/kyc.service.ts#L1874); KycService.serializeForm [backend/src/kyc/kyc.service.ts:2534](../../backend/src/kyc/kyc.service.ts#L2534); KycService.sectionRows [backend/src/kyc/kyc.service.ts:2625](../../backend/src/kyc/kyc.service.ts#L2625); KycService.asArray [backend/src/kyc/kyc.service.ts:3823](../../backend/src/kyc/kyc.service.ts#L3823); KycService.sectionFWithCaseDocuments [backend/src/kyc/kyc.service.ts:2630](../../backend/src/kyc/kyc.service.ts#L2630); KycService.dedupeRequiredDocumentRows [backend/src/kyc/kyc.service.ts:2712](../../backend/src/kyc/kyc.service.ts#L2712); KycService.documentMatchText [backend/src/kyc/kyc.service.ts:2809](../../backend/src/kyc/kyc.service.ts#L2809); KycService.documentFileNames [backend/src/kyc/kyc.service.ts:2773](../../backend/src/kyc/kyc.service.ts#L2773); KycService.isRequiredDocumentMatch [backend/src/kyc/kyc.service.ts:2788](../../backend/src/kyc/kyc.service.ts#L2788); KycService.dedupeAdditionalDocumentRows [backend/src/kyc/kyc.service.ts:2754](../../backend/src/kyc/kyc.service.ts#L2754); KycService.ensureKycNumber [backend/src/kyc/kyc.service.ts:3932](../../backend/src/kyc/kyc.service.ts#L3932); KycService.jsonValue [backend/src/kyc/kyc.service.ts:3872](../../backend/src/kyc/kyc.service.ts#L3872).
- QA: apply Q-API for this ID and its workflow-specific cases; store status/body/DB diff with secrets removed.
- DTO field-access candidates: amlAccuracyChecked, amlClarificationFindings, amlDate, amlName, amlSignatureDataUrl, amlSignatureFileName, dmlroComments, dmlroConditions, dmlroDate, dmlroDecision, dmlroName, dmlroReason, dmlroRiskClassification, dmlroSignatureDataUrl, dmlroSignatureFileName, dueDiligenceType, expectedVersion, mlroComments, mlroConditions, mlroDate, mlroDecision, mlroFinalRiskClassification, mlroName, mlroRiskExplanation, mlroRiskReasonCategory, mlroSignatureDataUrl, mlroSignatureFileName, reviewPart, riskClassification, sefComments, sefConditions, sefDate, sefDecision, sefName, sefSignatureDataUrl, sefSignatureFileName. These span reachable helpers and may include fields of internally composed DTOs; they are not a mandatory field list or complete wire schema. Match to the entry DTO and workflow before constructing requests.

## API-8FFFD545

**GET /api/kyc/:id/internal-reviews** - KycController.getInternalReviewWorkspace

- Entry/auth: AuthGuard('jwt'); RolesGuard; fallback roles: none declared; authenticated-only when JWT applies.
- Inputs: `@CurrentUser() user: RequestUser`; `@Param('id') id: string`.
- Output: JSON returned from delegated service; inferred fields in linked implementation. Inferred by TypeScript; no explicit response DTO.
- Behavior: GET WITH SIDE EFFECTS; detected reachable writes: clientActivationChecklist.upsert.
- Tenant/role/state/validation helper candidates: tenantWhere, hasAnyRole.
- Error branch candidates: NotFoundException: 'KYC case not found'); ForbiddenException: 'User is not assigned to a tenant').
- Evidence: [backend/src/kyc/kyc.controller.ts:317](../../backend/src/kyc/kyc.controller.ts#L317).
- Logic chain: KycService.getInternalReviewWorkspace [backend/src/kyc/kyc.service.ts:831](../../backend/src/kyc/kyc.service.ts#L831); KycService.findOne [backend/src/kyc/kyc.service.ts:148](../../backend/src/kyc/kyc.service.ts#L148); KycService.tenantWhere [backend/src/kyc/kyc.service.ts:2922](../../backend/src/kyc/kyc.service.ts#L2922); KycService.getTenantId [backend/src/kyc/kyc.service.ts:2947](../../backend/src/kyc/kyc.service.ts#L2947); KycService.caseInclude [backend/src/kyc/kyc.service.ts:4020](../../backend/src/kyc/kyc.service.ts#L4020); KycService.withKycNumber [backend/src/kyc/kyc.service.ts:3978](../../backend/src/kyc/kyc.service.ts#L3978); KycService.generatedKycNumber [backend/src/kyc/kyc.service.ts:3962](../../backend/src/kyc/kyc.service.ts#L3962); KycService.confidentialCommentWhere [backend/src/kyc/kyc.service.ts:3603](../../backend/src/kyc/kyc.service.ts#L3603); KycService.hasAnyRole [backend/src/kyc/kyc.service.ts:2959](../../backend/src/kyc/kyc.service.ts#L2959); KycService.recalculateActivationReadiness [backend/src/kyc/kyc.service.ts:1266](../../backend/src/kyc/kyc.service.ts#L1266); KycService.activationChecklistItems [backend/src/kyc/kyc.service.ts:3614](../../backend/src/kyc/kyc.service.ts#L3614); KycService.jsonValue [backend/src/kyc/kyc.service.ts:3872](../../backend/src/kyc/kyc.service.ts#L3872).
- QA: apply Q-API for this ID and its workflow-specific cases; store status/body/DB diff with secrets removed.
- DTO field-access candidates: none resolved. These span reachable helpers and may include fields of internally composed DTOs; they are not a mandatory field list or complete wire schema. Match to the entry DTO and workflow before constructing requests.

## API-BAA9C4BA

**POST /api/kyc/:id/internal-reviews/:stage/comments** - KycController.addReviewerComment

- Entry/auth: AuthGuard('jwt'); RolesGuard; fallback roles: AML_SUPERVISOR, AML_TEAM, DMLRO, MLRO, SEF, COMPANY_ADMIN, SUPER_ADMIN.
- Inputs: `@CurrentUser() user: RequestUser`; `@Param('id') id: string`; `@Param('stage') stage: ReviewStage`; `@Body() dto: Record<string, unknown>`.
- Output: JSON returned from delegated service; inferred fields in linked implementation. Inferred by TypeScript; no explicit response DTO.
- Behavior: Command (may mutate); detected reachable writes: reviewerComment.create, auditLog.create.
- Tenant/role/state/validation helper candidates: tenantWhere, enumValue, hasAnyRole, requiredText.
- Error branch candidates: ForbiddenException: 'You cannot create confidential reviewer comments'); NotFoundException: 'KYC case not found'); ForbiddenException: 'User is not assigned to a tenant'); BadRequestException: `${label} must be one of ${allowed.join(', ')}`); BadRequestException: `${label} is required`).
- Evidence: [backend/src/kyc/kyc.controller.ts:363](../../backend/src/kyc/kyc.controller.ts#L363).
- Logic chain: KycService.addReviewerComment [backend/src/kyc/kyc.service.ts:1157](../../backend/src/kyc/kyc.service.ts#L1157); KycService.findOne [backend/src/kyc/kyc.service.ts:148](../../backend/src/kyc/kyc.service.ts#L148); KycService.tenantWhere [backend/src/kyc/kyc.service.ts:2922](../../backend/src/kyc/kyc.service.ts#L2922); KycService.getTenantId [backend/src/kyc/kyc.service.ts:2947](../../backend/src/kyc/kyc.service.ts#L2947); KycService.caseInclude [backend/src/kyc/kyc.service.ts:4020](../../backend/src/kyc/kyc.service.ts#L4020); KycService.withKycNumber [backend/src/kyc/kyc.service.ts:3978](../../backend/src/kyc/kyc.service.ts#L3978); KycService.generatedKycNumber [backend/src/kyc/kyc.service.ts:3962](../../backend/src/kyc/kyc.service.ts#L3962); KycService.enumValue [backend/src/kyc/kyc.service.ts:3815](../../backend/src/kyc/kyc.service.ts#L3815); KycService.hasAnyRole [backend/src/kyc/kyc.service.ts:2959](../../backend/src/kyc/kyc.service.ts#L2959); KycService.requiredText [backend/src/kyc/kyc.service.ts:3831](../../backend/src/kyc/kyc.service.ts#L3831); KycService.jsonValue [backend/src/kyc/kyc.service.ts:3872](../../backend/src/kyc/kyc.service.ts#L3872).
- QA: apply Q-API for this ID and its workflow-specific cases; store status/body/DB diff with secrets removed.
- DTO field-access candidates: body, type, visibilityScope. These span reachable helpers and may include fields of internally composed DTOs; they are not a mandatory field list or complete wire schema. Match to the entry DTO and workflow before constructing requests.

## API-CE158663

**PATCH /api/kyc/:id/internal-reviews/:stage/draft** - KycController.saveInternalReviewDraft

- Entry/auth: AuthGuard('jwt'); RolesGuard; fallback roles: AML_SUPERVISOR, AML_TEAM, DMLRO, MLRO, SEF, COMPANY_ADMIN, SUPER_ADMIN.
- Inputs: `@CurrentUser() user: RequestUser`; `@Param('id') id: string`; `@Param('stage') stage: ReviewStage`; `@Body() dto: Record<string, unknown>`.
- Output: JSON returned from delegated service; inferred fields in linked implementation. Inferred by TypeScript; no explicit response DTO.
- Behavior: Command (may mutate); detected reachable writes: internalReviewSubmission.upsert.
- Tenant/role/state/validation helper candidates: assertStageRole, hasAnyRole, tenantWhere, assertReviewStageActive, assertEditableReview.
- Error branch candidates: BadRequestException: 'Review editing is locked while the case is with another review stage.'); ForbiddenException: `You cannot edit the ${this.stageLabel(stage)} review`); NotFoundException: 'KYC case not found'); ForbiddenException: 'User is not assigned to a tenant'); BadRequestException: `${this.stageLabel(stage)} does not have an active review task for this case.`); BadRequestException: `${this.stageLabel(stage)} review is locked after submission`).
- Evidence: [backend/src/kyc/kyc.controller.ts:328](../../backend/src/kyc/kyc.controller.ts#L328).
- Logic chain: KycService.saveReviewDraft [backend/src/kyc/kyc.service.ts:900](../../backend/src/kyc/kyc.service.ts#L900); KycService.assertStageRole [backend/src/kyc/kyc.service.ts:2963](../../backend/src/kyc/kyc.service.ts#L2963); KycService.hasAnyRole [backend/src/kyc/kyc.service.ts:2959](../../backend/src/kyc/kyc.service.ts#L2959); KycService.stageLabel [backend/src/kyc/kyc.service.ts:2976](../../backend/src/kyc/kyc.service.ts#L2976); KycService.findOne [backend/src/kyc/kyc.service.ts:148](../../backend/src/kyc/kyc.service.ts#L148); KycService.tenantWhere [backend/src/kyc/kyc.service.ts:2922](../../backend/src/kyc/kyc.service.ts#L2922); KycService.getTenantId [backend/src/kyc/kyc.service.ts:2947](../../backend/src/kyc/kyc.service.ts#L2947); KycService.caseInclude [backend/src/kyc/kyc.service.ts:4020](../../backend/src/kyc/kyc.service.ts#L4020); KycService.withKycNumber [backend/src/kyc/kyc.service.ts:3978](../../backend/src/kyc/kyc.service.ts#L3978); KycService.generatedKycNumber [backend/src/kyc/kyc.service.ts:3962](../../backend/src/kyc/kyc.service.ts#L3962); KycService.stageStatus [backend/src/kyc/kyc.service.ts:2987](../../backend/src/kyc/kyc.service.ts#L2987); KycService.assertReviewStageActive [backend/src/kyc/kyc.service.ts:3040](../../backend/src/kyc/kyc.service.ts#L3040); KycService.assertEditableReview [backend/src/kyc/kyc.service.ts:3030](../../backend/src/kyc/kyc.service.ts#L3030); KycService.jsonValue [backend/src/kyc/kyc.service.ts:3872](../../backend/src/kyc/kyc.service.ts#L3872); KycService.optionalText [backend/src/kyc/kyc.service.ts:3838](../../backend/src/kyc/kyc.service.ts#L3838); KycService.text [backend/src/kyc/kyc.service.ts:3885](../../backend/src/kyc/kyc.service.ts#L3885).
- QA: apply Q-API for this ID and its workflow-specific cases; store status/body/DB diff with secrets removed.
- DTO field-access candidates: confidentialNotes, data, formalComments. These span reachable helpers and may include fields of internally composed DTOs; they are not a mandatory field list or complete wire schema. Match to the entry DTO and workflow before constructing requests.

## API-FAD85287

**POST /api/kyc/:id/internal-reviews/:stage/start** - KycController.startInternalReview

- Entry/auth: AuthGuard('jwt'); RolesGuard; fallback roles: AML_SUPERVISOR, AML_TEAM, DMLRO, MLRO, SEF, COMPANY_ADMIN, SUPER_ADMIN.
- Inputs: `@CurrentUser() user: RequestUser`; `@Param('id') id: string`; `@Param('stage') stage: ReviewStage`.
- Output: JSON returned from delegated service; inferred fields in linked implementation. Inferred by TypeScript; no explicit response DTO.
- Behavior: Command (may mutate); detected reachable writes: internalReviewTask.upsert, kycCase.update, kycCaseStatusHistory.create, auditLog.create.
- Tenant/role/state/validation helper candidates: assertStageRole, hasAnyRole, tenantWhere, assertPreviousStageComplete.
- Error branch candidates: BadRequestException: `${this.stageLabel(stage)} is not the active review stage for this case.`); ForbiddenException: `You cannot edit the ${this.stageLabel(stage)} review`); NotFoundException: 'KYC case not found'); ForbiddenException: 'User is not assigned to a tenant'); BadRequestException: `${this.stageLabel(previous)} review must be submitted first`).
- Evidence: [backend/src/kyc/kyc.controller.ts:322](../../backend/src/kyc/kyc.controller.ts#L322).
- Logic chain: KycService.startReviewStage [backend/src/kyc/kyc.service.ts:869](../../backend/src/kyc/kyc.service.ts#L869); KycService.assertStageRole [backend/src/kyc/kyc.service.ts:2963](../../backend/src/kyc/kyc.service.ts#L2963); KycService.hasAnyRole [backend/src/kyc/kyc.service.ts:2959](../../backend/src/kyc/kyc.service.ts#L2959); KycService.stageLabel [backend/src/kyc/kyc.service.ts:2976](../../backend/src/kyc/kyc.service.ts#L2976); KycService.findOne [backend/src/kyc/kyc.service.ts:148](../../backend/src/kyc/kyc.service.ts#L148); KycService.tenantWhere [backend/src/kyc/kyc.service.ts:2922](../../backend/src/kyc/kyc.service.ts#L2922); KycService.getTenantId [backend/src/kyc/kyc.service.ts:2947](../../backend/src/kyc/kyc.service.ts#L2947); KycService.caseInclude [backend/src/kyc/kyc.service.ts:4020](../../backend/src/kyc/kyc.service.ts#L4020); KycService.withKycNumber [backend/src/kyc/kyc.service.ts:3978](../../backend/src/kyc/kyc.service.ts#L3978); KycService.generatedKycNumber [backend/src/kyc/kyc.service.ts:3962](../../backend/src/kyc/kyc.service.ts#L3962); KycService.assertPreviousStageComplete [backend/src/kyc/kyc.service.ts:3018](../../backend/src/kyc/kyc.service.ts#L3018); KycService.stageStatus [backend/src/kyc/kyc.service.ts:2987](../../backend/src/kyc/kyc.service.ts#L2987); KycService.recordStatus [backend/src/kyc/kyc.service.ts:3461](../../backend/src/kyc/kyc.service.ts#L3461); KycService.audit [backend/src/kyc/kyc.service.ts:3485](../../backend/src/kyc/kyc.service.ts#L3485); KycService.jsonValue [backend/src/kyc/kyc.service.ts:3872](../../backend/src/kyc/kyc.service.ts#L3872).
- QA: apply Q-API for this ID and its workflow-specific cases; store status/body/DB diff with secrets removed.
- DTO field-access candidates: none resolved. These span reachable helpers and may include fields of internally composed DTOs; they are not a mandatory field list or complete wire schema. Match to the entry DTO and workflow before constructing requests.

## API-C65454C8

**POST /api/kyc/:id/internal-reviews/dmlro/submit** - KycController.submitDmlroReview

- Entry/auth: AuthGuard('jwt'); RolesGuard; fallback roles: DMLRO, COMPANY_ADMIN, SUPER_ADMIN.
- Inputs: `@CurrentUser() user: RequestUser`; `@Param('id') id: string`; `@Body() dto: Record<string, unknown>`.
- Output: JSON returned from delegated service; inferred fields in linked implementation. Inferred by TypeScript; no explicit response DTO.
- Behavior: Command (may mutate); detected reachable writes: internalReviewTask.updateMany, internalReviewSubmission.updateMany, internalReviewTask.upsert, internalReviewSubmission.upsert, internalReviewVersion.create, reviewerComment.updateMany, kycInternalReview.upsert, internalReviewTask.deleteMany, kycCase.update, kycCaseStatusHistory.create, auditLog.create, notification.create, kycForm.update, client.update, clientActivationChecklist.upsert, kycFormRevision.create, kycRevisionFile.create, kycSectionData.upsert, kycInternalReview.updateMany, signedKycDocument.updateMany.
- Tenant/role/state/validation helper candidates: assertStageRole, hasAnyRole, assertReviewStageActive, enumValue, tenantWhere, assertPreviousStageComplete, assertEditableReview, assertReviewPackageReady, assertComplianceReady, assertInternalUseReady, assertScreeningReady, assertCrrfReady.
- Error branch candidates: BadRequestException: 'Add DMLRO comments before submitting the review.'); BadRequestException: 'Provide DMLRO comments, reason, or conditions for this decision'); ForbiddenException: `You cannot edit the ${this.stageLabel(stage)} review`); BadRequestException: `${this.stageLabel(stage)} does not have an active review task for this case.`); BadRequestException: `${label} must be one of ${allowed.join(', ')}`); InternalServerErrorException: 'Unable to resubmit this KYC file to MLRO. The review queue was refreshed; NotFoundException: 'KYC case not found'); ForbiddenException: 'User is not assigned to a tenant'); BadRequestException: `${this.stageLabel(previous)} review must be submitted first`); BadRequestException: `${this.stageLabel(stage)} review is locked after submission`); BadRequestException: `Complete the required KYC form details before submitting to DMLRO.\n${kycFormCompletenessMessage(formIssues)}`); BadRequestException: error); BadRequestException: `Open the KYC form, go to H. Internal Use Only and choose the ${missing.join(' and the ')}, then save.`); BadRequestException: issues.join('\n')); ForbiddenException: ; BadRequestException: 'The case changed during this action. Refresh before trying again.'); BadRequestException: 'Create the KYC form before opening an amendment.').
- Evidence: [backend/src/kyc/kyc.controller.ts:345](../../backend/src/kyc/kyc.controller.ts#L345).
- Logic chain: KycService.submitDmlroReview [backend/src/kyc/kyc.service.ts:937](../../backend/src/kyc/kyc.service.ts#L937); KycService.assertStageRole [backend/src/kyc/kyc.service.ts:2963](../../backend/src/kyc/kyc.service.ts#L2963); KycService.hasAnyRole [backend/src/kyc/kyc.service.ts:2959](../../backend/src/kyc/kyc.service.ts#L2959); KycService.stageLabel [backend/src/kyc/kyc.service.ts:2976](../../backend/src/kyc/kyc.service.ts#L2976); KycService.assertReviewStageActive [backend/src/kyc/kyc.service.ts:3040](../../backend/src/kyc/kyc.service.ts#L3040); KycService.enumValue [backend/src/kyc/kyc.service.ts:3815](../../backend/src/kyc/kyc.service.ts#L3815); KycService.optionalText [backend/src/kyc/kyc.service.ts:3838](../../backend/src/kyc/kyc.service.ts#L3838); KycService.text [backend/src/kyc/kyc.service.ts:3885](../../backend/src/kyc/kyc.service.ts#L3885); KycService.submitReviewAndRoute [backend/src/kyc/kyc.service.ts:3073](../../backend/src/kyc/kyc.service.ts#L3073); KycService.findOne [backend/src/kyc/kyc.service.ts:148](../../backend/src/kyc/kyc.service.ts#L148); KycService.tenantWhere [backend/src/kyc/kyc.service.ts:2922](../../backend/src/kyc/kyc.service.ts#L2922); KycService.getTenantId [backend/src/kyc/kyc.service.ts:2947](../../backend/src/kyc/kyc.service.ts#L2947); KycService.caseInclude [backend/src/kyc/kyc.service.ts:4020](../../backend/src/kyc/kyc.service.ts#L4020); KycService.withKycNumber [backend/src/kyc/kyc.service.ts:3978](../../backend/src/kyc/kyc.service.ts#L3978); KycService.generatedKycNumber [backend/src/kyc/kyc.service.ts:3962](../../backend/src/kyc/kyc.service.ts#L3962); KycService.assertPreviousStageComplete [backend/src/kyc/kyc.service.ts:3018](../../backend/src/kyc/kyc.service.ts#L3018); KycService.assertEditableReview [backend/src/kyc/kyc.service.ts:3030](../../backend/src/kyc/kyc.service.ts#L3030); KycService.assertReviewPackageReady [backend/src/kyc/kyc.service.ts:3111](../../backend/src/kyc/kyc.service.ts#L3111); KycService.formCompletenessIssues [backend/src/kyc/kyc.service.ts:3120](../../backend/src/kyc/kyc.service.ts#L3120); KycService.formInclude [backend/src/kyc/kyc.service.ts:2597](../../backend/src/kyc/kyc.service.ts#L2597); KycService.serializeForm [backend/src/kyc/kyc.service.ts:2534](../../backend/src/kyc/kyc.service.ts#L2534); KycService.sectionRows [backend/src/kyc/kyc.service.ts:2625](../../backend/src/kyc/kyc.service.ts#L2625); KycService.asArray [backend/src/kyc/kyc.service.ts:3823](../../backend/src/kyc/kyc.service.ts#L3823); KycService.sectionFWithCaseDocuments [backend/src/kyc/kyc.service.ts:2630](../../backend/src/kyc/kyc.service.ts#L2630); KycService.dedupeRequiredDocumentRows [backend/src/kyc/kyc.service.ts:2712](../../backend/src/kyc/kyc.service.ts#L2712); KycService.documentMatchText [backend/src/kyc/kyc.service.ts:2809](../../backend/src/kyc/kyc.service.ts#L2809); KycService.documentFileNames [backend/src/kyc/kyc.service.ts:2773](../../backend/src/kyc/kyc.service.ts#L2773); KycService.isRequiredDocumentMatch [backend/src/kyc/kyc.service.ts:2788](../../backend/src/kyc/kyc.service.ts#L2788); KycService.dedupeAdditionalDocumentRows [backend/src/kyc/kyc.service.ts:2754](../../backend/src/kyc/kyc.service.ts#L2754); KycService.assertComplianceReady [backend/src/kyc/kyc.service.ts:3133](../../backend/src/kyc/kyc.service.ts#L3133); KycService.assertInternalUseReady [backend/src/kyc/kyc.service.ts:3127](../../backend/src/kyc/kyc.service.ts#L3127); KycService.assertScreeningReady [backend/src/kyc/kyc.service.ts:3142](../../backend/src/kyc/kyc.service.ts#L3142); KycService.assertCrrfReady [backend/src/kyc/kyc.service.ts:3202](../../backend/src/kyc/kyc.service.ts#L3202); KycService.lockReviewSubmission [backend/src/kyc/kyc.service.ts:3289](../../backend/src/kyc/kyc.service.ts#L3289); KycService.jsonValue [backend/src/kyc/kyc.service.ts:3872](../../backend/src/kyc/kyc.service.ts#L3872); KycService.clearReviewTaskStatus [backend/src/kyc/kyc.service.ts:3067](../../backend/src/kyc/kyc.service.ts#L3067); KycService.recordStatus [backend/src/kyc/kyc.service.ts:3461](../../backend/src/kyc/kyc.service.ts#L3461); KycService.stageStatus [backend/src/kyc/kyc.service.ts:2987](../../backend/src/kyc/kyc.service.ts#L2987); KycService.audit [backend/src/kyc/kyc.service.ts:3485](../../backend/src/kyc/kyc.service.ts#L3485); KycService.createNotification [backend/src/kyc/kyc.service.ts:3498](../../backend/src/kyc/kyc.service.ts#L3498); KycService.finalizeApprovedKyc [backend/src/kyc/kyc.service.ts:1654](../../backend/src/kyc/kyc.service.ts#L1654); KycService.afterKycFinal [backend/src/kyc/kyc.service.ts:1675](../../backend/src/kyc/kyc.service.ts#L1675); KycService.notifyReadyForClientConversion [backend/src/kyc/kyc.service.ts:1796](../../backend/src/kyc/kyc.service.ts#L1796); KycService.completeRekyc [backend/src/kyc/kyc.service.ts:1681](../../backend/src/kyc/kyc.service.ts#L1681); KycService.syncClientRecords [backend/src/kyc/kyc.service.ts:1708](../../backend/src/kyc/kyc.service.ts#L1708); KycService.upsertActivationChecklist [backend/src/kyc/kyc.service.ts:3644](../../backend/src/kyc/kyc.service.ts#L3644); KycService.activationChecklistItems [backend/src/kyc/kyc.service.ts:3614](../../backend/src/kyc/kyc.service.ts#L3614); KycService.returnDmlroReviewToSupervisor [backend/src/kyc/kyc.service.ts:3215](../../backend/src/kyc/kyc.service.ts#L3215); KycService.saveReturnedReviewSubmission [backend/src/kyc/kyc.service.ts:3400](../../backend/src/kyc/kyc.service.ts#L3400); KycService.beginFormAmendment [backend/src/kyc/kyc.service.ts:1472](../../backend/src/kyc/kyc.service.ts#L1472); KycService.resolveLegalDocumentPath [backend/src/kyc/kyc.service.ts:3913](../../backend/src/kyc/kyc.service.ts#L3913); KycService.legalDocumentUploadRoot [backend/src/kyc/kyc.service.ts:3905](../../backend/src/kyc/kyc.service.ts#L3905); KycService.signedKycDocumentUploadRoot [backend/src/kyc/kyc.service.ts:3909](../../backend/src/kyc/kyc.service.ts#L3909).
- QA: apply Q-API for this ID and its workflow-specific cases; store status/body/DB diff with secrets removed.
- DTO field-access candidates: conditions, confidentialNotes, data, decision, formalComments, reason. These span reachable helpers and may include fields of internally composed DTOs; they are not a mandatory field list or complete wire schema. Match to the entry DTO and workflow before constructing requests.

## API-3D4B2E9E

**POST /api/kyc/:id/internal-reviews/mlro/decision** - KycController.decideMlroReview

- Entry/auth: AuthGuard('jwt'); RolesGuard; fallback roles: MLRO, COMPANY_ADMIN, SUPER_ADMIN.
- Inputs: `@CurrentUser() user: RequestUser`; `@Param('id') id: string`; `@Body() dto: Record<string, unknown>`.
- Output: JSON returned from delegated service; inferred fields in linked implementation. Inferred by TypeScript; no explicit response DTO.
- Behavior: Command (may mutate); detected reachable writes: internalReviewTask.updateMany, internalReviewTask.upsert, internalReviewSubmission.updateMany, internalReviewTask.deleteMany, kycCase.update, kycCaseStatusHistory.create, internalReviewSubmission.upsert, internalReviewVersion.create, reviewerComment.updateMany, kycInternalReview.upsert, kycFormRevision.create, kycRevisionFile.create, kycSectionData.upsert, kycForm.update, kycInternalReview.updateMany, signedKycDocument.updateMany, auditLog.create, notification.create, client.update, riskReclassification.create, clientActivationChecklist.upsert.
- Tenant/role/state/validation helper candidates: assertStageRole, hasAnyRole, enumValue, tenantWhere, assertReviewStageActive, assertPreviousStageComplete, requiredText.
- Error branch candidates: BadRequestException: 'The case is already with DMLRO.'); BadRequestException: 'Provide a reason or conditions for this MLRO decision'); BadRequestException: 'DMLRO has not reviewed this case yet. Add your MLRO comments explaining the decision before submitting.'); BadRequestException: 'Risk classification changes require an explanation'); BadRequestException: 'High-risk KYC files must be sent to SEF for management decision before final approval.'); BadRequestException: 'The case changed during this action. Refresh before trying again.'); InternalServerErrorException: 'Unable to send KYC file to SEF. Confirm the latest database migrations are applied and try again.'); ForbiddenException: `You cannot edit the ${this.stageLabel(stage)} review`); BadRequestException: `${label} must be one of ${allowed.join(', ')}`); NotFoundException: 'KYC case not found'); ForbiddenException: 'User is not assigned to a tenant'); BadRequestException: `${this.stageLabel(stage)} does not have an active review task for this case.`); BadRequestException: `${this.stageLabel(previous)} review must be submitted first`); ForbiddenException: ; BadRequestException: 'Create the KYC form before opening an amendment.'); BadRequestException: `${label} is required`); BadRequestException: 'Invalid date value').
- Evidence: [backend/src/kyc/kyc.controller.ts:351](../../backend/src/kyc/kyc.controller.ts#L351).
- Logic chain: KycService.decideMlroReview [backend/src/kyc/kyc.service.ts:984](../../backend/src/kyc/kyc.service.ts#L984); KycService.assertStageRole [backend/src/kyc/kyc.service.ts:2963](../../backend/src/kyc/kyc.service.ts#L2963); KycService.hasAnyRole [backend/src/kyc/kyc.service.ts:2959](../../backend/src/kyc/kyc.service.ts#L2959); KycService.stageLabel [backend/src/kyc/kyc.service.ts:2976](../../backend/src/kyc/kyc.service.ts#L2976); KycService.enumValue [backend/src/kyc/kyc.service.ts:3815](../../backend/src/kyc/kyc.service.ts#L3815); KycService.findOne [backend/src/kyc/kyc.service.ts:148](../../backend/src/kyc/kyc.service.ts#L148); KycService.tenantWhere [backend/src/kyc/kyc.service.ts:2922](../../backend/src/kyc/kyc.service.ts#L2922); KycService.getTenantId [backend/src/kyc/kyc.service.ts:2947](../../backend/src/kyc/kyc.service.ts#L2947); KycService.caseInclude [backend/src/kyc/kyc.service.ts:4020](../../backend/src/kyc/kyc.service.ts#L4020); KycService.withKycNumber [backend/src/kyc/kyc.service.ts:3978](../../backend/src/kyc/kyc.service.ts#L3978); KycService.generatedKycNumber [backend/src/kyc/kyc.service.ts:3962](../../backend/src/kyc/kyc.service.ts#L3962); KycService.isDmlroStageStatus [backend/src/kyc/kyc.service.ts:2982](../../backend/src/kyc/kyc.service.ts#L2982); KycService.assertReviewStageActive [backend/src/kyc/kyc.service.ts:3040](../../backend/src/kyc/kyc.service.ts#L3040); KycService.assertPreviousStageComplete [backend/src/kyc/kyc.service.ts:3018](../../backend/src/kyc/kyc.service.ts#L3018); KycService.optionalText [backend/src/kyc/kyc.service.ts:3838](../../backend/src/kyc/kyc.service.ts#L3838); KycService.text [backend/src/kyc/kyc.service.ts:3885](../../backend/src/kyc/kyc.service.ts#L3885); KycService.clearReviewTaskStatus [backend/src/kyc/kyc.service.ts:3067](../../backend/src/kyc/kyc.service.ts#L3067); KycService.recordStatus [backend/src/kyc/kyc.service.ts:3461](../../backend/src/kyc/kyc.service.ts#L3461); KycService.lockReviewSubmission [backend/src/kyc/kyc.service.ts:3289](../../backend/src/kyc/kyc.service.ts#L3289); KycService.jsonValue [backend/src/kyc/kyc.service.ts:3872](../../backend/src/kyc/kyc.service.ts#L3872); KycService.returnMlroRequestToAml [backend/src/kyc/kyc.service.ts:3265](../../backend/src/kyc/kyc.service.ts#L3265); KycService.beginFormAmendment [backend/src/kyc/kyc.service.ts:1472](../../backend/src/kyc/kyc.service.ts#L1472); KycService.formInclude [backend/src/kyc/kyc.service.ts:2597](../../backend/src/kyc/kyc.service.ts#L2597); KycService.serializeForm [backend/src/kyc/kyc.service.ts:2534](../../backend/src/kyc/kyc.service.ts#L2534); KycService.sectionRows [backend/src/kyc/kyc.service.ts:2625](../../backend/src/kyc/kyc.service.ts#L2625); KycService.asArray [backend/src/kyc/kyc.service.ts:3823](../../backend/src/kyc/kyc.service.ts#L3823); KycService.sectionFWithCaseDocuments [backend/src/kyc/kyc.service.ts:2630](../../backend/src/kyc/kyc.service.ts#L2630); KycService.dedupeRequiredDocumentRows [backend/src/kyc/kyc.service.ts:2712](../../backend/src/kyc/kyc.service.ts#L2712); KycService.documentMatchText [backend/src/kyc/kyc.service.ts:2809](../../backend/src/kyc/kyc.service.ts#L2809); KycService.documentFileNames [backend/src/kyc/kyc.service.ts:2773](../../backend/src/kyc/kyc.service.ts#L2773); KycService.isRequiredDocumentMatch [backend/src/kyc/kyc.service.ts:2788](../../backend/src/kyc/kyc.service.ts#L2788); KycService.dedupeAdditionalDocumentRows [backend/src/kyc/kyc.service.ts:2754](../../backend/src/kyc/kyc.service.ts#L2754); KycService.resolveLegalDocumentPath [backend/src/kyc/kyc.service.ts:3913](../../backend/src/kyc/kyc.service.ts#L3913); KycService.legalDocumentUploadRoot [backend/src/kyc/kyc.service.ts:3905](../../backend/src/kyc/kyc.service.ts#L3905); KycService.signedKycDocumentUploadRoot [backend/src/kyc/kyc.service.ts:3909](../../backend/src/kyc/kyc.service.ts#L3909); KycService.audit [backend/src/kyc/kyc.service.ts:3485](../../backend/src/kyc/kyc.service.ts#L3485); KycService.createNotification [backend/src/kyc/kyc.service.ts:3498](../../backend/src/kyc/kyc.service.ts#L3498); KycService.mlroDecisionStatus [backend/src/kyc/kyc.service.ts:3510](../../backend/src/kyc/kyc.service.ts#L3510); KycService.mlroStatusNote [backend/src/kyc/kyc.service.ts:3525](../../backend/src/kyc/kyc.service.ts#L3525); KycService.finalizeApprovedKyc [backend/src/kyc/kyc.service.ts:1654](../../backend/src/kyc/kyc.service.ts#L1654); KycService.afterKycFinal [backend/src/kyc/kyc.service.ts:1675](../../backend/src/kyc/kyc.service.ts#L1675); KycService.notifyReadyForClientConversion [backend/src/kyc/kyc.service.ts:1796](../../backend/src/kyc/kyc.service.ts#L1796); KycService.completeRekyc [backend/src/kyc/kyc.service.ts:1681](../../backend/src/kyc/kyc.service.ts#L1681); KycService.syncClientRecords [backend/src/kyc/kyc.service.ts:1708](../../backend/src/kyc/kyc.service.ts#L1708); KycService.saveRiskReclassification [backend/src/kyc/kyc.service.ts:3580](../../backend/src/kyc/kyc.service.ts#L3580); KycService.requiredText [backend/src/kyc/kyc.service.ts:3831](../../backend/src/kyc/kyc.service.ts#L3831); KycService.dateValue [backend/src/kyc/kyc.service.ts:3847](../../backend/src/kyc/kyc.service.ts#L3847); KycService.mlroNotificationType [backend/src/kyc/kyc.service.ts:3519](../../backend/src/kyc/kyc.service.ts#L3519); KycService.mlroNotificationTitle [backend/src/kyc/kyc.service.ts:3534](../../backend/src/kyc/kyc.service.ts#L3534); KycService.mlroNotificationMessage [backend/src/kyc/kyc.service.ts:3542](../../backend/src/kyc/kyc.service.ts#L3542); KycService.upsertActivationChecklist [backend/src/kyc/kyc.service.ts:3644](../../backend/src/kyc/kyc.service.ts#L3644); KycService.activationChecklistItems [backend/src/kyc/kyc.service.ts:3614](../../backend/src/kyc/kyc.service.ts#L3614).
- QA: apply Q-API for this ID and its workflow-specific cases; store status/body/DB diff with secrets removed.
- DTO field-access candidates: conditions, confidentialNotes, data, decision, finalRiskClassification, formalComments, previousRiskClassification, reason, riskEffectiveDate, riskExplanation, riskReasonCategory. These span reachable helpers and may include fields of internally composed DTOs; they are not a mandatory field list or complete wire schema. Match to the entry DTO and workflow before constructing requests.

## API-B3555C2D

**POST /api/kyc/:id/internal-reviews/sef/decision** - KycController.decideSefReview

- Entry/auth: AuthGuard('jwt'); RolesGuard; fallback roles: SEF, COMPANY_ADMIN, SUPER_ADMIN.
- Inputs: `@CurrentUser() user: RequestUser`; `@Param('id') id: string`; `@Body() dto: Record<string, unknown>`.
- Output: JSON returned from delegated service; inferred fields in linked implementation. Inferred by TypeScript; no explicit response DTO.
- Behavior: Command (may mutate); detected reachable writes: internalReviewSubmission.updateMany, internalReviewTask.upsert, internalReviewTask.updateMany, internalReviewSubmission.upsert, internalReviewVersion.create, reviewerComment.updateMany, kycInternalReview.upsert, kycCase.update, kycCaseStatusHistory.create, internalReviewTask.deleteMany, notification.create, auditLog.create, kycForm.update, client.update, clientActivationChecklist.upsert.
- Tenant/role/state/validation helper candidates: assertStageRole, hasAnyRole, assertReviewStageActive, enumValue, tenantWhere, assertPreviousStageComplete.
- Error branch candidates: BadRequestException: 'Provide SEF reason or conditions for this decision'); ForbiddenException: `You cannot edit the ${this.stageLabel(stage)} review`); BadRequestException: `${this.stageLabel(stage)} does not have an active review task for this case.`); BadRequestException: `${label} must be one of ${allowed.join(', ')}`); NotFoundException: 'KYC case not found'); ForbiddenException: 'User is not assigned to a tenant'); BadRequestException: `${this.stageLabel(previous)} review must be submitted first`); ForbiddenException: .
- Evidence: [backend/src/kyc/kyc.controller.ts:357](../../backend/src/kyc/kyc.controller.ts#L357).
- Logic chain: KycService.decideSefReview [backend/src/kyc/kyc.service.ts:1117](../../backend/src/kyc/kyc.service.ts#L1117); KycService.assertStageRole [backend/src/kyc/kyc.service.ts:2963](../../backend/src/kyc/kyc.service.ts#L2963); KycService.hasAnyRole [backend/src/kyc/kyc.service.ts:2959](../../backend/src/kyc/kyc.service.ts#L2959); KycService.stageLabel [backend/src/kyc/kyc.service.ts:2976](../../backend/src/kyc/kyc.service.ts#L2976); KycService.assertReviewStageActive [backend/src/kyc/kyc.service.ts:3040](../../backend/src/kyc/kyc.service.ts#L3040); KycService.enumValue [backend/src/kyc/kyc.service.ts:3815](../../backend/src/kyc/kyc.service.ts#L3815); KycService.findOne [backend/src/kyc/kyc.service.ts:148](../../backend/src/kyc/kyc.service.ts#L148); KycService.tenantWhere [backend/src/kyc/kyc.service.ts:2922](../../backend/src/kyc/kyc.service.ts#L2922); KycService.getTenantId [backend/src/kyc/kyc.service.ts:2947](../../backend/src/kyc/kyc.service.ts#L2947); KycService.caseInclude [backend/src/kyc/kyc.service.ts:4020](../../backend/src/kyc/kyc.service.ts#L4020); KycService.withKycNumber [backend/src/kyc/kyc.service.ts:3978](../../backend/src/kyc/kyc.service.ts#L3978); KycService.generatedKycNumber [backend/src/kyc/kyc.service.ts:3962](../../backend/src/kyc/kyc.service.ts#L3962); KycService.assertPreviousStageComplete [backend/src/kyc/kyc.service.ts:3018](../../backend/src/kyc/kyc.service.ts#L3018); KycService.lockReviewSubmission [backend/src/kyc/kyc.service.ts:3289](../../backend/src/kyc/kyc.service.ts#L3289); KycService.jsonValue [backend/src/kyc/kyc.service.ts:3872](../../backend/src/kyc/kyc.service.ts#L3872); KycService.optionalText [backend/src/kyc/kyc.service.ts:3838](../../backend/src/kyc/kyc.service.ts#L3838); KycService.text [backend/src/kyc/kyc.service.ts:3885](../../backend/src/kyc/kyc.service.ts#L3885); KycService.recordStatus [backend/src/kyc/kyc.service.ts:3461](../../backend/src/kyc/kyc.service.ts#L3461); KycService.clearReviewTaskStatus [backend/src/kyc/kyc.service.ts:3067](../../backend/src/kyc/kyc.service.ts#L3067); KycService.createNotification [backend/src/kyc/kyc.service.ts:3498](../../backend/src/kyc/kyc.service.ts#L3498); KycService.audit [backend/src/kyc/kyc.service.ts:3485](../../backend/src/kyc/kyc.service.ts#L3485); KycService.finalizeApprovedKyc [backend/src/kyc/kyc.service.ts:1654](../../backend/src/kyc/kyc.service.ts#L1654); KycService.afterKycFinal [backend/src/kyc/kyc.service.ts:1675](../../backend/src/kyc/kyc.service.ts#L1675); KycService.notifyReadyForClientConversion [backend/src/kyc/kyc.service.ts:1796](../../backend/src/kyc/kyc.service.ts#L1796); KycService.completeRekyc [backend/src/kyc/kyc.service.ts:1681](../../backend/src/kyc/kyc.service.ts#L1681); KycService.syncClientRecords [backend/src/kyc/kyc.service.ts:1708](../../backend/src/kyc/kyc.service.ts#L1708); KycService.formInclude [backend/src/kyc/kyc.service.ts:2597](../../backend/src/kyc/kyc.service.ts#L2597); KycService.serializeForm [backend/src/kyc/kyc.service.ts:2534](../../backend/src/kyc/kyc.service.ts#L2534); KycService.sectionRows [backend/src/kyc/kyc.service.ts:2625](../../backend/src/kyc/kyc.service.ts#L2625); KycService.asArray [backend/src/kyc/kyc.service.ts:3823](../../backend/src/kyc/kyc.service.ts#L3823); KycService.sectionFWithCaseDocuments [backend/src/kyc/kyc.service.ts:2630](../../backend/src/kyc/kyc.service.ts#L2630); KycService.dedupeRequiredDocumentRows [backend/src/kyc/kyc.service.ts:2712](../../backend/src/kyc/kyc.service.ts#L2712); KycService.documentMatchText [backend/src/kyc/kyc.service.ts:2809](../../backend/src/kyc/kyc.service.ts#L2809); KycService.documentFileNames [backend/src/kyc/kyc.service.ts:2773](../../backend/src/kyc/kyc.service.ts#L2773); KycService.isRequiredDocumentMatch [backend/src/kyc/kyc.service.ts:2788](../../backend/src/kyc/kyc.service.ts#L2788); KycService.dedupeAdditionalDocumentRows [backend/src/kyc/kyc.service.ts:2754](../../backend/src/kyc/kyc.service.ts#L2754); KycService.upsertActivationChecklist [backend/src/kyc/kyc.service.ts:3644](../../backend/src/kyc/kyc.service.ts#L3644); KycService.activationChecklistItems [backend/src/kyc/kyc.service.ts:3614](../../backend/src/kyc/kyc.service.ts#L3614).
- QA: apply Q-API for this ID and its workflow-specific cases; store status/body/DB diff with secrets removed.
- DTO field-access candidates: conditions, confidentialNotes, data, decision, formalComments, reason. These span reachable helpers and may include fields of internally composed DTOs; they are not a mandatory field list or complete wire schema. Match to the entry DTO and workflow before constructing requests.

## API-0725331B

**POST /api/kyc/:id/internal-reviews/signed-documents** - KycController.uploadSignedKycDocument

- Entry/auth: AuthGuard('jwt'); RolesGuard; fallback roles: DMLRO, MLRO, COMPANY_ADMIN, SUPER_ADMIN.
- Inputs: `@CurrentUser() user: RequestUser`; `@Param('id') id: string`; `@Body() dto: Record<string, unknown>`.
- Output: JSON returned from delegated service; inferred fields in linked implementation. Inferred by TypeScript; no explicit response DTO.
- Behavior: Command (may mutate); detected reachable writes: signedKycDocument.updateMany, signedKycDocument.create, auditLog.create, notification.create.
- Tenant/role/state/validation helper candidates: tenantWhere, enumValue, hasAnyRole, requiredText.
- Error branch candidates: ForbiddenException: 'Only DMLRO can upload this signed KYC document'); ForbiddenException: 'Only MLRO can upload this signed KYC document'); NotFoundException: 'KYC case not found'); ForbiddenException: 'User is not assigned to a tenant'); BadRequestException: `${label} must be one of ${allowed.join(', ')}`); BadRequestException: `${label} is required`).
- Evidence: [backend/src/kyc/kyc.controller.ts:374](../../backend/src/kyc/kyc.controller.ts#L374).
- Logic chain: KycService.uploadSignedKycDocument [backend/src/kyc/kyc.service.ts:1190](../../backend/src/kyc/kyc.service.ts#L1190); KycService.findOne [backend/src/kyc/kyc.service.ts:148](../../backend/src/kyc/kyc.service.ts#L148); KycService.tenantWhere [backend/src/kyc/kyc.service.ts:2922](../../backend/src/kyc/kyc.service.ts#L2922); KycService.getTenantId [backend/src/kyc/kyc.service.ts:2947](../../backend/src/kyc/kyc.service.ts#L2947); KycService.caseInclude [backend/src/kyc/kyc.service.ts:4020](../../backend/src/kyc/kyc.service.ts#L4020); KycService.withKycNumber [backend/src/kyc/kyc.service.ts:3978](../../backend/src/kyc/kyc.service.ts#L3978); KycService.generatedKycNumber [backend/src/kyc/kyc.service.ts:3962](../../backend/src/kyc/kyc.service.ts#L3962); KycService.enumValue [backend/src/kyc/kyc.service.ts:3815](../../backend/src/kyc/kyc.service.ts#L3815); KycService.hasAnyRole [backend/src/kyc/kyc.service.ts:2959](../../backend/src/kyc/kyc.service.ts#L2959); KycService.requiredText [backend/src/kyc/kyc.service.ts:3831](../../backend/src/kyc/kyc.service.ts#L3831); KycService.optionalText [backend/src/kyc/kyc.service.ts:3838](../../backend/src/kyc/kyc.service.ts#L3838); KycService.text [backend/src/kyc/kyc.service.ts:3885](../../backend/src/kyc/kyc.service.ts#L3885); KycService.audit [backend/src/kyc/kyc.service.ts:3485](../../backend/src/kyc/kyc.service.ts#L3485); KycService.jsonValue [backend/src/kyc/kyc.service.ts:3872](../../backend/src/kyc/kyc.service.ts#L3872); KycService.createNotification [backend/src/kyc/kyc.service.ts:3498](../../backend/src/kyc/kyc.service.ts#L3498).
- QA: apply Q-API for this ID and its workflow-specific cases; store status/body/DB diff with secrets removed.
- DTO field-access candidates: comments, fileName, fileSize, fileType, reviewStage, signatureType, storageKey. These span reachable helpers and may include fields of internally composed DTOs; they are not a mandatory field list or complete wire schema. Match to the entry DTO and workflow before constructing requests.

## API-A4FB20A5

**POST /api/kyc/:id/internal-reviews/signed-documents/upload** - KycController.uploadSignedKycDocumentFile

- Entry/auth: AuthGuard('jwt'); RolesGuard; fallback roles: DMLRO, MLRO, COMPANY_ADMIN, SUPER_ADMIN.
- Inputs: `@CurrentUser() user: RequestUser`; `@Param('id') id: string`; `@Body('reviewStage') reviewStage: string`; `@UploadedFile() file?: { originalname: string; mimetype?: string; size: number; buffer?: Buffer }`.
- Output: JSON returned from delegated service; inferred fields in linked implementation. Inferred by TypeScript; no explicit response DTO.
- Behavior: Command (may mutate); detected reachable writes: signedKycDocument.updateMany, signedKycDocument.create, auditLog.create, notification.create.
- Tenant/role/state/validation helper candidates: tenantWhere, enumValue, hasAnyRole, requiredText.
- Error branch candidates: BadRequestException: 'Upload a signed KYC document file'); ForbiddenException: 'Only DMLRO can upload this signed KYC document'); ForbiddenException: 'Only MLRO can upload this signed KYC document'); NotFoundException: 'KYC case not found'); ForbiddenException: 'User is not assigned to a tenant'); BadRequestException: `${label} must be one of ${allowed.join(', ')}`); BadRequestException: `${label} is required`).
- Evidence: [backend/src/kyc/kyc.controller.ts:380](../../backend/src/kyc/kyc.controller.ts#L380).
- Logic chain: KycService.uploadSignedKycDocumentFile [backend/src/kyc/kyc.service.ts:1227](../../backend/src/kyc/kyc.service.ts#L1227); KycService.findOne [backend/src/kyc/kyc.service.ts:148](../../backend/src/kyc/kyc.service.ts#L148); KycService.tenantWhere [backend/src/kyc/kyc.service.ts:2922](../../backend/src/kyc/kyc.service.ts#L2922); KycService.getTenantId [backend/src/kyc/kyc.service.ts:2947](../../backend/src/kyc/kyc.service.ts#L2947); KycService.caseInclude [backend/src/kyc/kyc.service.ts:4020](../../backend/src/kyc/kyc.service.ts#L4020); KycService.withKycNumber [backend/src/kyc/kyc.service.ts:3978](../../backend/src/kyc/kyc.service.ts#L3978); KycService.generatedKycNumber [backend/src/kyc/kyc.service.ts:3962](../../backend/src/kyc/kyc.service.ts#L3962); KycService.enumValue [backend/src/kyc/kyc.service.ts:3815](../../backend/src/kyc/kyc.service.ts#L3815); KycService.hasAnyRole [backend/src/kyc/kyc.service.ts:2959](../../backend/src/kyc/kyc.service.ts#L2959); KycService.signedKycDocumentUploadRoot [backend/src/kyc/kyc.service.ts:3909](../../backend/src/kyc/kyc.service.ts#L3909); KycService.safeFileName [backend/src/kyc/kyc.service.ts:3985](../../backend/src/kyc/kyc.service.ts#L3985); KycService.uploadSignedKycDocument [backend/src/kyc/kyc.service.ts:1190](../../backend/src/kyc/kyc.service.ts#L1190); KycService.requiredText [backend/src/kyc/kyc.service.ts:3831](../../backend/src/kyc/kyc.service.ts#L3831); KycService.optionalText [backend/src/kyc/kyc.service.ts:3838](../../backend/src/kyc/kyc.service.ts#L3838); KycService.text [backend/src/kyc/kyc.service.ts:3885](../../backend/src/kyc/kyc.service.ts#L3885); KycService.audit [backend/src/kyc/kyc.service.ts:3485](../../backend/src/kyc/kyc.service.ts#L3485); KycService.jsonValue [backend/src/kyc/kyc.service.ts:3872](../../backend/src/kyc/kyc.service.ts#L3872); KycService.createNotification [backend/src/kyc/kyc.service.ts:3498](../../backend/src/kyc/kyc.service.ts#L3498).
- QA: apply Q-API for this ID and its workflow-specific cases; store status/body/DB diff with secrets removed.
- DTO field-access candidates: comments, fileName, fileSize, fileType, reviewStage, signatureType, storageKey. These span reachable helpers and may include fields of internally composed DTOs; they are not a mandatory field list or complete wire schema. Match to the entry DTO and workflow before constructing requests.

## API-C8B81FCD

**POST /api/kyc/:id/internal-reviews/supervisor/submit** - KycController.submitSupervisorReview

- Entry/auth: AuthGuard('jwt'); RolesGuard; fallback roles: AML_SUPERVISOR, AML_TEAM, COMPANY_ADMIN, SUPER_ADMIN.
- Inputs: `@CurrentUser() user: RequestUser`; `@Param('id') id: string`; `@Body() dto: Record<string, unknown>`.
- Output: JSON returned from delegated service; inferred fields in linked implementation. Inferred by TypeScript; no explicit response DTO.
- Behavior: Command (may mutate); detected reachable writes: internalReviewTask.updateMany, internalReviewSubmission.updateMany, internalReviewTask.upsert, internalReviewSubmission.upsert, internalReviewVersion.create, reviewerComment.updateMany, kycInternalReview.upsert, internalReviewTask.deleteMany, kycCase.update, kycCaseStatusHistory.create, auditLog.create, notification.create.
- Tenant/role/state/validation helper candidates: assertStageRole, hasAnyRole, assertReviewStageActive, tenantWhere, assertPreviousStageComplete, assertEditableReview, assertReviewPackageReady, assertComplianceReady, assertInternalUseReady, assertScreeningReady, assertCrrfReady.
- Error branch candidates: BadRequestException: 'Add AML Supervisor comments before submitting the review.'); ForbiddenException: `You cannot edit the ${this.stageLabel(stage)} review`); BadRequestException: `${this.stageLabel(stage)} does not have an active review task for this case.`); InternalServerErrorException: 'Unable to resubmit this KYC file to MLRO. The review queue was refreshed; NotFoundException: 'KYC case not found'); ForbiddenException: 'User is not assigned to a tenant'); BadRequestException: `${this.stageLabel(previous)} review must be submitted first`); BadRequestException: `${this.stageLabel(stage)} review is locked after submission`); BadRequestException: `Complete the required KYC form details before submitting to DMLRO.\n${kycFormCompletenessMessage(formIssues)}`); BadRequestException: error); BadRequestException: `Open the KYC form, go to H. Internal Use Only and choose the ${missing.join(' and the ')}, then save.`); BadRequestException: issues.join('\n')); ForbiddenException: .
- Evidence: [backend/src/kyc/kyc.controller.ts:339](../../backend/src/kyc/kyc.controller.ts#L339).
- Logic chain: KycService.submitSupervisorReview [backend/src/kyc/kyc.service.ts:930](../../backend/src/kyc/kyc.service.ts#L930); KycService.assertStageRole [backend/src/kyc/kyc.service.ts:2963](../../backend/src/kyc/kyc.service.ts#L2963); KycService.hasAnyRole [backend/src/kyc/kyc.service.ts:2959](../../backend/src/kyc/kyc.service.ts#L2959); KycService.stageLabel [backend/src/kyc/kyc.service.ts:2976](../../backend/src/kyc/kyc.service.ts#L2976); KycService.assertReviewStageActive [backend/src/kyc/kyc.service.ts:3040](../../backend/src/kyc/kyc.service.ts#L3040); KycService.submitReviewAndRoute [backend/src/kyc/kyc.service.ts:3073](../../backend/src/kyc/kyc.service.ts#L3073); KycService.findOne [backend/src/kyc/kyc.service.ts:148](../../backend/src/kyc/kyc.service.ts#L148); KycService.tenantWhere [backend/src/kyc/kyc.service.ts:2922](../../backend/src/kyc/kyc.service.ts#L2922); KycService.getTenantId [backend/src/kyc/kyc.service.ts:2947](../../backend/src/kyc/kyc.service.ts#L2947); KycService.caseInclude [backend/src/kyc/kyc.service.ts:4020](../../backend/src/kyc/kyc.service.ts#L4020); KycService.withKycNumber [backend/src/kyc/kyc.service.ts:3978](../../backend/src/kyc/kyc.service.ts#L3978); KycService.generatedKycNumber [backend/src/kyc/kyc.service.ts:3962](../../backend/src/kyc/kyc.service.ts#L3962); KycService.assertPreviousStageComplete [backend/src/kyc/kyc.service.ts:3018](../../backend/src/kyc/kyc.service.ts#L3018); KycService.assertEditableReview [backend/src/kyc/kyc.service.ts:3030](../../backend/src/kyc/kyc.service.ts#L3030); KycService.assertReviewPackageReady [backend/src/kyc/kyc.service.ts:3111](../../backend/src/kyc/kyc.service.ts#L3111); KycService.formCompletenessIssues [backend/src/kyc/kyc.service.ts:3120](../../backend/src/kyc/kyc.service.ts#L3120); KycService.formInclude [backend/src/kyc/kyc.service.ts:2597](../../backend/src/kyc/kyc.service.ts#L2597); KycService.serializeForm [backend/src/kyc/kyc.service.ts:2534](../../backend/src/kyc/kyc.service.ts#L2534); KycService.sectionRows [backend/src/kyc/kyc.service.ts:2625](../../backend/src/kyc/kyc.service.ts#L2625); KycService.asArray [backend/src/kyc/kyc.service.ts:3823](../../backend/src/kyc/kyc.service.ts#L3823); KycService.text [backend/src/kyc/kyc.service.ts:3885](../../backend/src/kyc/kyc.service.ts#L3885); KycService.sectionFWithCaseDocuments [backend/src/kyc/kyc.service.ts:2630](../../backend/src/kyc/kyc.service.ts#L2630); KycService.dedupeRequiredDocumentRows [backend/src/kyc/kyc.service.ts:2712](../../backend/src/kyc/kyc.service.ts#L2712); KycService.optionalText [backend/src/kyc/kyc.service.ts:3838](../../backend/src/kyc/kyc.service.ts#L3838); KycService.documentMatchText [backend/src/kyc/kyc.service.ts:2809](../../backend/src/kyc/kyc.service.ts#L2809); KycService.documentFileNames [backend/src/kyc/kyc.service.ts:2773](../../backend/src/kyc/kyc.service.ts#L2773); KycService.isRequiredDocumentMatch [backend/src/kyc/kyc.service.ts:2788](../../backend/src/kyc/kyc.service.ts#L2788); KycService.dedupeAdditionalDocumentRows [backend/src/kyc/kyc.service.ts:2754](../../backend/src/kyc/kyc.service.ts#L2754); KycService.assertComplianceReady [backend/src/kyc/kyc.service.ts:3133](../../backend/src/kyc/kyc.service.ts#L3133); KycService.assertInternalUseReady [backend/src/kyc/kyc.service.ts:3127](../../backend/src/kyc/kyc.service.ts#L3127); KycService.assertScreeningReady [backend/src/kyc/kyc.service.ts:3142](../../backend/src/kyc/kyc.service.ts#L3142); KycService.assertCrrfReady [backend/src/kyc/kyc.service.ts:3202](../../backend/src/kyc/kyc.service.ts#L3202); KycService.lockReviewSubmission [backend/src/kyc/kyc.service.ts:3289](../../backend/src/kyc/kyc.service.ts#L3289); KycService.jsonValue [backend/src/kyc/kyc.service.ts:3872](../../backend/src/kyc/kyc.service.ts#L3872); KycService.clearReviewTaskStatus [backend/src/kyc/kyc.service.ts:3067](../../backend/src/kyc/kyc.service.ts#L3067); KycService.recordStatus [backend/src/kyc/kyc.service.ts:3461](../../backend/src/kyc/kyc.service.ts#L3461); KycService.stageStatus [backend/src/kyc/kyc.service.ts:2987](../../backend/src/kyc/kyc.service.ts#L2987); KycService.audit [backend/src/kyc/kyc.service.ts:3485](../../backend/src/kyc/kyc.service.ts#L3485); KycService.createNotification [backend/src/kyc/kyc.service.ts:3498](../../backend/src/kyc/kyc.service.ts#L3498).
- QA: apply Q-API for this ID and its workflow-specific cases; store status/body/DB diff with secrets removed.
- DTO field-access candidates: conditions, confidentialNotes, data, decision, formalComments, reason. These span reachable helpers and may include fields of internally composed DTOs; they are not a mandatory field list or complete wire schema. Match to the entry DTO and workflow before constructing requests.

## API-D8647DF4

**POST /api/kyc/:id/legal-documents** - KycController.uploadLegalDocument

- Entry/auth: AuthGuard('jwt'); RolesGuard; fallback roles: AML_TEAM, AML_SUPERVISOR, COMPANY_ADMIN, SUPER_ADMIN.
- Inputs: `@CurrentUser() user: RequestUser`; `@Param('id') id: string`; `@Body() dto: UploadLegalDocumentDto`.
- Output: JSON returned from delegated service; inferred fields in linked implementation. Inferred by TypeScript; no explicit response DTO.
- Behavior: Command (may mutate); detected reachable writes: legalDocument.update, legalDocument.create, kycCase.update, kycCaseStatusHistory.create.
- Tenant/role/state/validation helper candidates: requireWritableCase, tenantWhere, isLegacyFullKycDraft, formTenantWhere.
- Error branch candidates: NotFoundException: 'KYC case not found'); BadRequestException: 'KYC preparation is locked while the case is under DMLRO, MLRO, or SEF review. It can be edited again only after DMLRO returns it to the AML Supervisor.'); ForbiddenException: 'User is not assigned to a tenant').
- Evidence: [backend/src/kyc/kyc.controller.ts:207](../../backend/src/kyc/kyc.controller.ts#L207).
- Logic chain: KycService.uploadLegalDocument [backend/src/kyc/kyc.service.ts:324](../../backend/src/kyc/kyc.service.ts#L324); KycService.requireWritableCase [backend/src/kyc/kyc.service.ts:2819](../../backend/src/kyc/kyc.service.ts#L2819); KycService.tenantWhere [backend/src/kyc/kyc.service.ts:2922](../../backend/src/kyc/kyc.service.ts#L2922); KycService.getTenantId [backend/src/kyc/kyc.service.ts:2947](../../backend/src/kyc/kyc.service.ts#L2947); KycService.isPreparationEditableStatus [backend/src/kyc/kyc.service.ts:2841](../../backend/src/kyc/kyc.service.ts#L2841); KycService.isLegacyFullKycDraft [backend/src/kyc/kyc.service.ts:2835](../../backend/src/kyc/kyc.service.ts#L2835); KycService.formTenantWhere [backend/src/kyc/kyc.service.ts:2939](../../backend/src/kyc/kyc.service.ts#L2939); KycService.caseInclude [backend/src/kyc/kyc.service.ts:4020](../../backend/src/kyc/kyc.service.ts#L4020).
- QA: apply Q-API for this ID and its workflow-specific cases; store status/body/DB diff with secrets removed.
- DTO field-access candidates: documentType, fileName, mimeType, size, storagePath. These span reachable helpers and may include fields of internally composed DTOs; they are not a mandatory field list or complete wire schema. Match to the entry DTO and workflow before constructing requests.

## API-0A70F34F

**DELETE /api/kyc/:id/legal-documents/:documentId** - KycController.deleteLegalDocument

- Entry/auth: AuthGuard('jwt'); RolesGuard; fallback roles: AML_TEAM, AML_SUPERVISOR, COMPANY_ADMIN, SUPER_ADMIN.
- Inputs: `@CurrentUser() user: RequestUser`; `@Param('id') id: string`; `@Param('documentId') documentId: string`.
- Output: JSON returned from delegated service; inferred fields in linked implementation. Inferred by TypeScript; no explicit response DTO.
- Behavior: Command (may mutate); detected reachable writes: legalDocument.delete.
- Tenant/role/state/validation helper candidates: requireWritableCase, tenantWhere, isLegacyFullKycDraft, formTenantWhere.
- Error branch candidates: NotFoundException: 'Uploaded document not found'); NotFoundException: 'KYC case not found'); BadRequestException: 'KYC preparation is locked while the case is under DMLRO, MLRO, or SEF review. It can be edited again only after DMLRO returns it to the AML Supervisor.'); ForbiddenException: 'User is not assigned to a tenant').
- Evidence: [backend/src/kyc/kyc.controller.ts:283](../../backend/src/kyc/kyc.controller.ts#L283).
- Logic chain: KycService.deleteLegalDocument [backend/src/kyc/kyc.service.ts:611](../../backend/src/kyc/kyc.service.ts#L611); KycService.requireWritableCase [backend/src/kyc/kyc.service.ts:2819](../../backend/src/kyc/kyc.service.ts#L2819); KycService.tenantWhere [backend/src/kyc/kyc.service.ts:2922](../../backend/src/kyc/kyc.service.ts#L2922); KycService.getTenantId [backend/src/kyc/kyc.service.ts:2947](../../backend/src/kyc/kyc.service.ts#L2947); KycService.isPreparationEditableStatus [backend/src/kyc/kyc.service.ts:2841](../../backend/src/kyc/kyc.service.ts#L2841); KycService.isLegacyFullKycDraft [backend/src/kyc/kyc.service.ts:2835](../../backend/src/kyc/kyc.service.ts#L2835); KycService.formTenantWhere [backend/src/kyc/kyc.service.ts:2939](../../backend/src/kyc/kyc.service.ts#L2939); KycService.resolveLegalDocumentPath [backend/src/kyc/kyc.service.ts:3913](../../backend/src/kyc/kyc.service.ts#L3913); KycService.legalDocumentUploadRoot [backend/src/kyc/kyc.service.ts:3905](../../backend/src/kyc/kyc.service.ts#L3905); KycService.caseInclude [backend/src/kyc/kyc.service.ts:4020](../../backend/src/kyc/kyc.service.ts#L4020).
- QA: apply Q-API for this ID and its workflow-specific cases; store status/body/DB diff with secrets removed.
- DTO field-access candidates: none resolved. These span reachable helpers and may include fields of internally composed DTOs; they are not a mandatory field list or complete wire schema. Match to the entry DTO and workflow before constructing requests.

## API-60800880

**GET /api/kyc/:id/legal-documents/:documentId/view** - KycController.viewLegalDocument

- Entry/auth: AuthGuard('jwt'); RolesGuard; fallback roles: none declared; authenticated-only when JWT applies.
- Inputs: `@CurrentUser() user: RequestUser`; `@Param('id') id: string`; `@Param('documentId') documentId: string`; `@Res() response: Response`.
- Output: Response.send binary/HTML; see controller MIME and Content-Disposition. Inferred by TypeScript; no explicit response DTO.
- Behavior: Read candidate (static scan only); detected reachable writes: none detected.
- Tenant/role/state/validation helper candidates: tenantWhere.
- Error branch candidates: NotFoundException: 'Uploaded document not found'); NotFoundException: 'Uploaded file is not available for this document'); NotFoundException: 'KYC case not found'); ForbiddenException: 'User is not assigned to a tenant').
- Evidence: [backend/src/kyc/kyc.controller.ts:255](../../backend/src/kyc/kyc.controller.ts#L255).
- Logic chain: KycService.getLegalDocumentFile [backend/src/kyc/kyc.service.ts:554](../../backend/src/kyc/kyc.service.ts#L554); KycService.findOne [backend/src/kyc/kyc.service.ts:148](../../backend/src/kyc/kyc.service.ts#L148); KycService.tenantWhere [backend/src/kyc/kyc.service.ts:2922](../../backend/src/kyc/kyc.service.ts#L2922); KycService.getTenantId [backend/src/kyc/kyc.service.ts:2947](../../backend/src/kyc/kyc.service.ts#L2947); KycService.caseInclude [backend/src/kyc/kyc.service.ts:4020](../../backend/src/kyc/kyc.service.ts#L4020); KycService.withKycNumber [backend/src/kyc/kyc.service.ts:3978](../../backend/src/kyc/kyc.service.ts#L3978); KycService.generatedKycNumber [backend/src/kyc/kyc.service.ts:3962](../../backend/src/kyc/kyc.service.ts#L3962); KycService.resolveLegalDocumentPath [backend/src/kyc/kyc.service.ts:3913](../../backend/src/kyc/kyc.service.ts#L3913); KycService.legalDocumentUploadRoot [backend/src/kyc/kyc.service.ts:3905](../../backend/src/kyc/kyc.service.ts#L3905).
- QA: apply Q-API for this ID and its workflow-specific cases; store status/body/DB diff with secrets removed.
- DTO field-access candidates: none resolved. These span reachable helpers and may include fields of internally composed DTOs; they are not a mandatory field list or complete wire schema. Match to the entry DTO and workflow before constructing requests.

## API-A7A89B73

**GET /api/kyc/:id/legal-documents/download-group** - KycController.downloadLegalDocumentGroup

- Entry/auth: AuthGuard('jwt'); RolesGuard; fallback roles: none declared; authenticated-only when JWT applies.
- Inputs: `@CurrentUser() user: RequestUser`; `@Param('id') id: string`; `@Query('documentType') documentType: string`; `@Res() response: Response`.
- Output: Response.send binary/HTML; see controller MIME and Content-Disposition. Inferred by TypeScript; no explicit response DTO.
- Behavior: Read candidate (static scan only); detected reachable writes: none detected.
- Tenant/role/state/validation helper candidates: tenantWhere.
- Error branch candidates: BadRequestException: 'Document type is required'); NotFoundException: 'No uploaded files are available for this document group'); NotFoundException: 'Uploaded files are not available for this document group'); NotFoundException: 'KYC case not found'); ForbiddenException: 'User is not assigned to a tenant').
- Evidence: [backend/src/kyc/kyc.controller.ts:269](../../backend/src/kyc/kyc.controller.ts#L269).
- Logic chain: KycService.getLegalDocumentGroupZip [backend/src/kyc/kyc.service.ts:579](../../backend/src/kyc/kyc.service.ts#L579); KycService.findOne [backend/src/kyc/kyc.service.ts:148](../../backend/src/kyc/kyc.service.ts#L148); KycService.tenantWhere [backend/src/kyc/kyc.service.ts:2922](../../backend/src/kyc/kyc.service.ts#L2922); KycService.getTenantId [backend/src/kyc/kyc.service.ts:2947](../../backend/src/kyc/kyc.service.ts#L2947); KycService.caseInclude [backend/src/kyc/kyc.service.ts:4020](../../backend/src/kyc/kyc.service.ts#L4020); KycService.withKycNumber [backend/src/kyc/kyc.service.ts:3978](../../backend/src/kyc/kyc.service.ts#L3978); KycService.generatedKycNumber [backend/src/kyc/kyc.service.ts:3962](../../backend/src/kyc/kyc.service.ts#L3962); KycService.resolveLegalDocumentPath [backend/src/kyc/kyc.service.ts:3913](../../backend/src/kyc/kyc.service.ts#L3913); KycService.legalDocumentUploadRoot [backend/src/kyc/kyc.service.ts:3905](../../backend/src/kyc/kyc.service.ts#L3905); KycService.uniqueArchiveFileName [backend/src/kyc/kyc.service.ts:3994](../../backend/src/kyc/kyc.service.ts#L3994); KycService.safeFileName [backend/src/kyc/kyc.service.ts:3985](../../backend/src/kyc/kyc.service.ts#L3985).
- QA: apply Q-API for this ID and its workflow-specific cases; store status/body/DB diff with secrets removed.
- DTO field-access candidates: none resolved. These span reachable helpers and may include fields of internally composed DTOs; they are not a mandatory field list or complete wire schema. Match to the entry DTO and workflow before constructing requests.

## API-E82679AC

**POST /api/kyc/:id/legal-documents/upload** - KycController.uploadLegalDocumentFile

- Entry/auth: AuthGuard('jwt'); RolesGuard; fallback roles: AML_TEAM, AML_SUPERVISOR, COMPANY_ADMIN, SUPER_ADMIN.
- Inputs: `@CurrentUser() user: RequestUser`; `@Param('id') id: string`; `@Body('documentType') documentType: string`; `@UploadedFile() file: { originalname: string; mimetype?: string; size: number; buffer?: Buffer }`.
- Output: JSON returned from delegated service; inferred fields in linked implementation. Inferred by TypeScript; no explicit response DTO.
- Behavior: Command (may mutate); detected reachable writes: legalDocument.update, legalDocument.create, kycCase.update, kycCaseStatusHistory.create.
- Tenant/role/state/validation helper candidates: requireWritableCase, tenantWhere, isLegacyFullKycDraft, formTenantWhere.
- Error branch candidates: BadRequestException: 'Document type is required'); BadRequestException: 'Upload document files'); BadRequestException: 'Document uploads are disabled after submission unless the case is returned for additional information.'); NotFoundException: 'KYC case not found'); BadRequestException: 'KYC preparation is locked while the case is under DMLRO, MLRO, or SEF review. It can be edited again only after DMLRO returns it to the AML Supervisor.'); ForbiddenException: 'User is not assigned to a tenant').
- Evidence: [backend/src/kyc/kyc.controller.ts:217](../../backend/src/kyc/kyc.controller.ts#L217).
- Logic chain: KycService.uploadLegalDocumentFile [backend/src/kyc/kyc.service.ts:431](../../backend/src/kyc/kyc.service.ts#L431); KycService.uploadLegalDocumentFiles [backend/src/kyc/kyc.service.ts:440](../../backend/src/kyc/kyc.service.ts#L440); KycService.requireWritableCase [backend/src/kyc/kyc.service.ts:2819](../../backend/src/kyc/kyc.service.ts#L2819); KycService.tenantWhere [backend/src/kyc/kyc.service.ts:2922](../../backend/src/kyc/kyc.service.ts#L2922); KycService.getTenantId [backend/src/kyc/kyc.service.ts:2947](../../backend/src/kyc/kyc.service.ts#L2947); KycService.isPreparationEditableStatus [backend/src/kyc/kyc.service.ts:2841](../../backend/src/kyc/kyc.service.ts#L2841); KycService.isLegacyFullKycDraft [backend/src/kyc/kyc.service.ts:2835](../../backend/src/kyc/kyc.service.ts#L2835); KycService.formTenantWhere [backend/src/kyc/kyc.service.ts:2939](../../backend/src/kyc/kyc.service.ts#L2939); KycService.legalDocumentUploadRoot [backend/src/kyc/kyc.service.ts:3905](../../backend/src/kyc/kyc.service.ts#L3905); KycService.safeFileName [backend/src/kyc/kyc.service.ts:3985](../../backend/src/kyc/kyc.service.ts#L3985); KycService.caseInclude [backend/src/kyc/kyc.service.ts:4020](../../backend/src/kyc/kyc.service.ts#L4020).
- QA: apply Q-API for this ID and its workflow-specific cases; store status/body/DB diff with secrets removed.
- DTO field-access candidates: none resolved. These span reachable helpers and may include fields of internally composed DTOs; they are not a mandatory field list or complete wire schema. Match to the entry DTO and workflow before constructing requests.

## API-31BB8A09

**POST /api/kyc/:id/legal-documents/upload-many** - KycController.uploadLegalDocumentFiles

- Entry/auth: AuthGuard('jwt'); RolesGuard; fallback roles: AML_TEAM, AML_SUPERVISOR, COMPANY_ADMIN, SUPER_ADMIN.
- Inputs: `@CurrentUser() user: RequestUser`; `@Param('id') id: string`; `@Body('documentType') documentType: string`; `@UploadedFiles() files: Array<{ originalname: string; mimetype?: string; size: number; buffer?: Buffer }>`.
- Output: JSON returned from delegated service; inferred fields in linked implementation. Inferred by TypeScript; no explicit response DTO.
- Behavior: Command (may mutate); detected reachable writes: legalDocument.update, legalDocument.create, kycCase.update, kycCaseStatusHistory.create.
- Tenant/role/state/validation helper candidates: requireWritableCase, tenantWhere, isLegacyFullKycDraft, formTenantWhere.
- Error branch candidates: BadRequestException: 'Document type is required'); BadRequestException: 'Upload document files'); BadRequestException: 'Document uploads are disabled after submission unless the case is returned for additional information.'); NotFoundException: 'KYC case not found'); BadRequestException: 'KYC preparation is locked while the case is under DMLRO, MLRO, or SEF review. It can be edited again only after DMLRO returns it to the AML Supervisor.'); ForbiddenException: 'User is not assigned to a tenant').
- Evidence: [backend/src/kyc/kyc.controller.ts:243](../../backend/src/kyc/kyc.controller.ts#L243).
- Logic chain: KycService.uploadLegalDocumentFiles [backend/src/kyc/kyc.service.ts:440](../../backend/src/kyc/kyc.service.ts#L440); KycService.requireWritableCase [backend/src/kyc/kyc.service.ts:2819](../../backend/src/kyc/kyc.service.ts#L2819); KycService.tenantWhere [backend/src/kyc/kyc.service.ts:2922](../../backend/src/kyc/kyc.service.ts#L2922); KycService.getTenantId [backend/src/kyc/kyc.service.ts:2947](../../backend/src/kyc/kyc.service.ts#L2947); KycService.isPreparationEditableStatus [backend/src/kyc/kyc.service.ts:2841](../../backend/src/kyc/kyc.service.ts#L2841); KycService.isLegacyFullKycDraft [backend/src/kyc/kyc.service.ts:2835](../../backend/src/kyc/kyc.service.ts#L2835); KycService.formTenantWhere [backend/src/kyc/kyc.service.ts:2939](../../backend/src/kyc/kyc.service.ts#L2939); KycService.legalDocumentUploadRoot [backend/src/kyc/kyc.service.ts:3905](../../backend/src/kyc/kyc.service.ts#L3905); KycService.safeFileName [backend/src/kyc/kyc.service.ts:3985](../../backend/src/kyc/kyc.service.ts#L3985); KycService.caseInclude [backend/src/kyc/kyc.service.ts:4020](../../backend/src/kyc/kyc.service.ts#L4020).
- QA: apply Q-API for this ID and its workflow-specific cases; store status/body/DB diff with secrets removed.
- DTO field-access candidates: none resolved. These span reachable helpers and may include fields of internally composed DTOs; they are not a mandatory field list or complete wire schema. Match to the entry DTO and workflow before constructing requests.

## API-36DE4573

**PATCH /api/kyc/:id/proposal-status** - KycController.updateProposalStatus

- Entry/auth: AuthGuard('jwt'); RolesGuard; fallback roles: AML_TEAM, AML_SUPERVISOR, COMPANY_ADMIN, SUPER_ADMIN.
- Inputs: `@CurrentUser() user: RequestUser`; `@Param('id') id: string`; `@Body() dto: UpdateProposalStatusDto`.
- Output: JSON returned from delegated service; inferred fields in linked implementation. Inferred by TypeScript; no explicit response DTO.
- Behavior: Command (may mutate); detected reachable writes: kycCase.update, kycCaseStatusHistory.create.
- Tenant/role/state/validation helper candidates: requireWritableCase, tenantWhere, isLegacyFullKycDraft, formTenantWhere.
- Error branch candidates: NotFoundException: 'KYC case not found'); BadRequestException: 'KYC preparation is locked while the case is under DMLRO, MLRO, or SEF review. It can be edited again only after DMLRO returns it to the AML Supervisor.'); ForbiddenException: 'User is not assigned to a tenant').
- Evidence: [backend/src/kyc/kyc.controller.ts:197](../../backend/src/kyc/kyc.controller.ts#L197).
- Logic chain: KycService.updateProposalStatus [backend/src/kyc/kyc.service.ts:312](../../backend/src/kyc/kyc.service.ts#L312); KycService.requireWritableCase [backend/src/kyc/kyc.service.ts:2819](../../backend/src/kyc/kyc.service.ts#L2819); KycService.tenantWhere [backend/src/kyc/kyc.service.ts:2922](../../backend/src/kyc/kyc.service.ts#L2922); KycService.getTenantId [backend/src/kyc/kyc.service.ts:2947](../../backend/src/kyc/kyc.service.ts#L2947); KycService.isPreparationEditableStatus [backend/src/kyc/kyc.service.ts:2841](../../backend/src/kyc/kyc.service.ts#L2841); KycService.isLegacyFullKycDraft [backend/src/kyc/kyc.service.ts:2835](../../backend/src/kyc/kyc.service.ts#L2835); KycService.formTenantWhere [backend/src/kyc/kyc.service.ts:2939](../../backend/src/kyc/kyc.service.ts#L2939); KycService.updateStatus [backend/src/kyc/kyc.service.ts:2881](../../backend/src/kyc/kyc.service.ts#L2881); KycService.caseInclude [backend/src/kyc/kyc.service.ts:4020](../../backend/src/kyc/kyc.service.ts#L4020).
- QA: apply Q-API for this ID and its workflow-specific cases; store status/body/DB diff with secrets removed.
- DTO field-access candidates: note, proposalStatus. These span reachable helpers and may include fields of internally composed DTOs; they are not a mandatory field list or complete wire schema. Match to the entry DTO and workflow before constructing requests.

## API-6F5C31D7

**POST /api/kyc/:id/return-to-bd** - KycController.returnToBusinessDevelopment

- Entry/auth: AuthGuard('jwt'); RolesGuard; fallback roles: AML_TEAM, AML_SUPERVISOR, COMPANY_ADMIN, SUPER_ADMIN.
- Inputs: `@CurrentUser() user: RequestUser`; `@Param('id') id: string`; `@Body('reason') reason: string`.
- Output: JSON returned from delegated service; inferred fields in linked implementation. Inferred by TypeScript; no explicit response DTO.
- Behavior: Command (may mutate); detected reachable writes: enquiry.update, enquiryStatusHistory.create, kycCase.update, kycCaseStatusHistory.create, internalReviewTask.updateMany, notification.createMany, internalReviewTask.deleteMany.
- Tenant/role/state/validation helper candidates: hasAnyRole, tenantWhere.
- Error branch candidates: ForbiddenException: 'Only AML users can return a KYC case to BD.'); BadRequestException: 'Provide a reason before returning the KYC case to BD.'); BadRequestException: 'Only KYC cases created from an enquiry can be returned to BD.'); BadRequestException: 'The KYC case can be returned to BD only while it is with AML Supervisor.'); NotFoundException: 'Source enquiry not found.'); NotFoundException: 'KYC case not found'); ForbiddenException: 'User is not assigned to a tenant').
- Evidence: [backend/src/kyc/kyc.controller.ts:305](../../backend/src/kyc/kyc.controller.ts#L305).
- Logic chain: KycService.returnToBusinessDevelopment [backend/src/kyc/kyc.service.ts:768](../../backend/src/kyc/kyc.service.ts#L768); KycService.hasAnyRole [backend/src/kyc/kyc.service.ts:2959](../../backend/src/kyc/kyc.service.ts#L2959); KycService.optionalText [backend/src/kyc/kyc.service.ts:3838](../../backend/src/kyc/kyc.service.ts#L3838); KycService.text [backend/src/kyc/kyc.service.ts:3885](../../backend/src/kyc/kyc.service.ts#L3885); KycService.findOne [backend/src/kyc/kyc.service.ts:148](../../backend/src/kyc/kyc.service.ts#L148); KycService.tenantWhere [backend/src/kyc/kyc.service.ts:2922](../../backend/src/kyc/kyc.service.ts#L2922); KycService.getTenantId [backend/src/kyc/kyc.service.ts:2947](../../backend/src/kyc/kyc.service.ts#L2947); KycService.caseInclude [backend/src/kyc/kyc.service.ts:4020](../../backend/src/kyc/kyc.service.ts#L4020); KycService.withKycNumber [backend/src/kyc/kyc.service.ts:3978](../../backend/src/kyc/kyc.service.ts#L3978); KycService.generatedKycNumber [backend/src/kyc/kyc.service.ts:3962](../../backend/src/kyc/kyc.service.ts#L3962); KycService.clearReviewTaskStatus [backend/src/kyc/kyc.service.ts:3067](../../backend/src/kyc/kyc.service.ts#L3067).
- QA: apply Q-API for this ID and its workflow-specific cases; store status/body/DB diff with secrets removed.
- DTO field-access candidates: none resolved. These span reachable helpers and may include fields of internally composed DTOs; they are not a mandatory field list or complete wire schema. Match to the entry DTO and workflow before constructing requests.

## API-6B7FFB1E

**PATCH /api/kyc/:id/service** - KycController.assignService

- Entry/auth: AuthGuard('jwt'); RolesGuard; fallback roles: AML_TEAM, AML_SUPERVISOR, COMPANY_ADMIN, SUPER_ADMIN.
- Inputs: `@CurrentUser() user: RequestUser`; `@Param('id') id: string`; `@Body() dto: AssignServiceDto`.
- Output: JSON returned from delegated service; inferred fields in linked implementation. Inferred by TypeScript; no explicit response DTO.
- Behavior: Command (may mutate); detected reachable writes: clientService.upsert, kycCase.update, kycCaseStatusHistory.create.
- Tenant/role/state/validation helper candidates: requireWritableCase, tenantWhere, isLegacyFullKycDraft, formTenantWhere.
- Error branch candidates: NotFoundException: 'KYC case not found'); BadRequestException: 'KYC preparation is locked while the case is under DMLRO, MLRO, or SEF review. It can be edited again only after DMLRO returns it to the AML Supervisor.'); ForbiddenException: 'User is not assigned to a tenant'); NotFoundException: 'Client service not found'); BadRequestException: 'Provide serviceId or serviceName').
- Evidence: [backend/src/kyc/kyc.controller.ts:191](../../backend/src/kyc/kyc.controller.ts#L191).
- Logic chain: KycService.assignService [backend/src/kyc/kyc.service.ts:297](../../backend/src/kyc/kyc.service.ts#L297); KycService.requireWritableCase [backend/src/kyc/kyc.service.ts:2819](../../backend/src/kyc/kyc.service.ts#L2819); KycService.tenantWhere [backend/src/kyc/kyc.service.ts:2922](../../backend/src/kyc/kyc.service.ts#L2922); KycService.getTenantId [backend/src/kyc/kyc.service.ts:2947](../../backend/src/kyc/kyc.service.ts#L2947); KycService.isPreparationEditableStatus [backend/src/kyc/kyc.service.ts:2841](../../backend/src/kyc/kyc.service.ts#L2841); KycService.isLegacyFullKycDraft [backend/src/kyc/kyc.service.ts:2835](../../backend/src/kyc/kyc.service.ts#L2835); KycService.formTenantWhere [backend/src/kyc/kyc.service.ts:2939](../../backend/src/kyc/kyc.service.ts#L2939); KycService.resolveService [backend/src/kyc/kyc.service.ts:2853](../../backend/src/kyc/kyc.service.ts#L2853); KycService.updateStatus [backend/src/kyc/kyc.service.ts:2881](../../backend/src/kyc/kyc.service.ts#L2881); KycService.caseInclude [backend/src/kyc/kyc.service.ts:4020](../../backend/src/kyc/kyc.service.ts#L4020).
- QA: apply Q-API for this ID and its workflow-specific cases; store status/body/DB diff with secrets removed.
- DTO field-access candidates: description, serviceId, serviceName. These span reachable helpers and may include fields of internally composed DTOs; they are not a mandatory field list or complete wire schema. Match to the entry DTO and workflow before constructing requests.

## API-379F818E

**POST /api/kyc/:id/start-aml-review** - KycController.startAmlReview

- Entry/auth: AuthGuard('jwt'); RolesGuard; fallback roles: AML_TEAM, COMPANY_ADMIN, SUPER_ADMIN.
- Inputs: `@CurrentUser() user: RequestUser`; `@Param('id') id: string`.
- Output: JSON returned from delegated service; inferred fields in linked implementation. Inferred by TypeScript; no explicit response DTO.
- Behavior: Command (may mutate); detected reachable writes: internalReviewTask.upsert, notification.create, kycCase.update, kycCaseStatusHistory.create.
- Tenant/role/state/validation helper candidates: tenantWhere.
- Error branch candidates: BadRequestException: 'Case must be submitted to AML before review starts'); NotFoundException: 'KYC case not found'); ForbiddenException: 'User is not assigned to a tenant').
- Evidence: [backend/src/kyc/kyc.controller.ts:311](../../backend/src/kyc/kyc.controller.ts#L311).
- Logic chain: KycService.startAmlReview [backend/src/kyc/kyc.service.ts:753](../../backend/src/kyc/kyc.service.ts#L753); KycService.findOne [backend/src/kyc/kyc.service.ts:148](../../backend/src/kyc/kyc.service.ts#L148); KycService.tenantWhere [backend/src/kyc/kyc.service.ts:2922](../../backend/src/kyc/kyc.service.ts#L2922); KycService.getTenantId [backend/src/kyc/kyc.service.ts:2947](../../backend/src/kyc/kyc.service.ts#L2947); KycService.caseInclude [backend/src/kyc/kyc.service.ts:4020](../../backend/src/kyc/kyc.service.ts#L4020); KycService.withKycNumber [backend/src/kyc/kyc.service.ts:3978](../../backend/src/kyc/kyc.service.ts#L3978); KycService.generatedKycNumber [backend/src/kyc/kyc.service.ts:3962](../../backend/src/kyc/kyc.service.ts#L3962); KycService.isSubmittedToAml [backend/src/kyc/kyc.service.ts:2955](../../backend/src/kyc/kyc.service.ts#L2955); KycService.ensureReviewTask [backend/src/kyc/kyc.service.ts:3049](../../backend/src/kyc/kyc.service.ts#L3049); KycService.createNotification [backend/src/kyc/kyc.service.ts:3498](../../backend/src/kyc/kyc.service.ts#L3498); KycService.stageLabel [backend/src/kyc/kyc.service.ts:2976](../../backend/src/kyc/kyc.service.ts#L2976); KycService.updateStatus [backend/src/kyc/kyc.service.ts:2881](../../backend/src/kyc/kyc.service.ts#L2881).
- QA: apply Q-API for this ID and its workflow-specific cases; store status/body/DB diff with secrets removed.
- DTO field-access candidates: none resolved. These span reachable helpers and may include fields of internally composed DTOs; they are not a mandatory field list or complete wire schema. Match to the entry DTO and workflow before constructing requests.

## API-86FF54AD

**GET /api/kyc/:id/submission-readiness** - KycController.submissionReadiness

- Entry/auth: AuthGuard('jwt'); RolesGuard; fallback roles: AML_TEAM, AML_SUPERVISOR, COMPANY_ADMIN, SUPER_ADMIN.
- Inputs: `@CurrentUser() user: RequestUser`; `@Param('id') id: string`.
- Output: JSON returned from delegated service; inferred fields in linked implementation. Inferred by TypeScript; no explicit response DTO.
- Behavior: Read candidate (static scan only); detected reachable writes: none detected.
- Tenant/role/state/validation helper candidates: requireWritableCase, tenantWhere, isLegacyFullKycDraft, formTenantWhere, assertComplianceReady, assertInternalUseReady, assertScreeningReady, assertCrrfReady.
- Error branch candidates: NotFoundException: 'KYC case not found'); BadRequestException: 'KYC preparation is locked while the case is under DMLRO, MLRO, or SEF review. It can be edited again only after DMLRO returns it to the AML Supervisor.'); ForbiddenException: 'User is not assigned to a tenant'); BadRequestException: error); BadRequestException: `Open the KYC form, go to H. Internal Use Only and choose the ${missing.join(' and the ')}, then save.`); BadRequestException: issues.join('\n')).
- Evidence: [backend/src/kyc/kyc.controller.ts:299](../../backend/src/kyc/kyc.controller.ts#L299).
- Logic chain: KycService.submissionReadiness [backend/src/kyc/kyc.service.ts:636](../../backend/src/kyc/kyc.service.ts#L636); KycService.requireWritableCase [backend/src/kyc/kyc.service.ts:2819](../../backend/src/kyc/kyc.service.ts#L2819); KycService.tenantWhere [backend/src/kyc/kyc.service.ts:2922](../../backend/src/kyc/kyc.service.ts#L2922); KycService.getTenantId [backend/src/kyc/kyc.service.ts:2947](../../backend/src/kyc/kyc.service.ts#L2947); KycService.isPreparationEditableStatus [backend/src/kyc/kyc.service.ts:2841](../../backend/src/kyc/kyc.service.ts#L2841); KycService.isLegacyFullKycDraft [backend/src/kyc/kyc.service.ts:2835](../../backend/src/kyc/kyc.service.ts#L2835); KycService.formTenantWhere [backend/src/kyc/kyc.service.ts:2939](../../backend/src/kyc/kyc.service.ts#L2939); KycService.formCompletenessIssues [backend/src/kyc/kyc.service.ts:3120](../../backend/src/kyc/kyc.service.ts#L3120); KycService.formInclude [backend/src/kyc/kyc.service.ts:2597](../../backend/src/kyc/kyc.service.ts#L2597); KycService.serializeForm [backend/src/kyc/kyc.service.ts:2534](../../backend/src/kyc/kyc.service.ts#L2534); KycService.sectionRows [backend/src/kyc/kyc.service.ts:2625](../../backend/src/kyc/kyc.service.ts#L2625); KycService.asArray [backend/src/kyc/kyc.service.ts:3823](../../backend/src/kyc/kyc.service.ts#L3823); KycService.text [backend/src/kyc/kyc.service.ts:3885](../../backend/src/kyc/kyc.service.ts#L3885); KycService.sectionFWithCaseDocuments [backend/src/kyc/kyc.service.ts:2630](../../backend/src/kyc/kyc.service.ts#L2630); KycService.dedupeRequiredDocumentRows [backend/src/kyc/kyc.service.ts:2712](../../backend/src/kyc/kyc.service.ts#L2712); KycService.optionalText [backend/src/kyc/kyc.service.ts:3838](../../backend/src/kyc/kyc.service.ts#L3838); KycService.documentMatchText [backend/src/kyc/kyc.service.ts:2809](../../backend/src/kyc/kyc.service.ts#L2809); KycService.documentFileNames [backend/src/kyc/kyc.service.ts:2773](../../backend/src/kyc/kyc.service.ts#L2773); KycService.isRequiredDocumentMatch [backend/src/kyc/kyc.service.ts:2788](../../backend/src/kyc/kyc.service.ts#L2788); KycService.dedupeAdditionalDocumentRows [backend/src/kyc/kyc.service.ts:2754](../../backend/src/kyc/kyc.service.ts#L2754); KycService.assertComplianceReady [backend/src/kyc/kyc.service.ts:3133](../../backend/src/kyc/kyc.service.ts#L3133); KycService.assertInternalUseReady [backend/src/kyc/kyc.service.ts:3127](../../backend/src/kyc/kyc.service.ts#L3127); KycService.assertScreeningReady [backend/src/kyc/kyc.service.ts:3142](../../backend/src/kyc/kyc.service.ts#L3142); KycService.assertCrrfReady [backend/src/kyc/kyc.service.ts:3202](../../backend/src/kyc/kyc.service.ts#L3202).
- QA: apply Q-API for this ID and its workflow-specific cases; store status/body/DB diff with secrets removed.
- DTO field-access candidates: none resolved. These span reachable helpers and may include fields of internally composed DTOs; they are not a mandatory field list or complete wire schema. Match to the entry DTO and workflow before constructing requests.

## API-D128107A

**POST /api/kyc/:id/submit-to-aml** - KycController.submitToAml

- Entry/auth: AuthGuard('jwt'); RolesGuard; fallback roles: AML_TEAM, AML_SUPERVISOR, COMPANY_ADMIN, SUPER_ADMIN.
- Inputs: `@CurrentUser() user: RequestUser`; `@Param('id') id: string`; `@Body() dto: Record<string, unknown>`.
- Output: JSON returned from delegated service; inferred fields in linked implementation. Inferred by TypeScript; no explicit response DTO.
- Behavior: Command (may mutate); detected reachable writes: internalReviewSubmission.updateMany, internalReviewTask.updateMany, kycCase.update, kycCaseStatusHistory.create, internalReviewTask.upsert, internalReviewSubmission.upsert, internalReviewVersion.create, reviewerComment.updateMany, kycInternalReview.upsert, auditLog.create, internalReviewTask.deleteMany, notification.create.
- Tenant/role/state/validation helper candidates: requireWritableCase, tenantWhere, isLegacyFullKycDraft, formTenantWhere, assertReviewPackageReady, assertComplianceReady, assertInternalUseReady, assertScreeningReady, assertCrrfReady.
- Error branch candidates: BadRequestException: 'This case has already been submitted. It can be resubmitted only after DMLRO returns it to the AML Supervisor.'); BadRequestException: 'Upload at least one document required for KYC preparation before submitting to DMLRO'); BadRequestException: 'Enter AML Supervisor comments on the submission page before submitting to DMLRO.'); NotFoundException: 'KYC case not found'); BadRequestException: 'KYC preparation is locked while the case is under DMLRO, MLRO, or SEF review. It can be edited again only after DMLRO returns it to the AML Supervisor.'); ForbiddenException: 'User is not assigned to a tenant'); BadRequestException: `Complete the required KYC form details before submitting to DMLRO.\n${kycFormCompletenessMessage(formIssues)}`); BadRequestException: error); BadRequestException: `Open the KYC form, go to H. Internal Use Only and choose the ${missing.join(' and the ')}, then save.`); BadRequestException: issues.join('\n')); ForbiddenException: .
- Evidence: [backend/src/kyc/kyc.controller.ts:293](../../backend/src/kyc/kyc.controller.ts#L293).
- Logic chain: KycService.submitToAml [backend/src/kyc/kyc.service.ts:670](../../backend/src/kyc/kyc.service.ts#L670); KycService.requireWritableCase [backend/src/kyc/kyc.service.ts:2819](../../backend/src/kyc/kyc.service.ts#L2819); KycService.tenantWhere [backend/src/kyc/kyc.service.ts:2922](../../backend/src/kyc/kyc.service.ts#L2922); KycService.getTenantId [backend/src/kyc/kyc.service.ts:2947](../../backend/src/kyc/kyc.service.ts#L2947); KycService.isPreparationEditableStatus [backend/src/kyc/kyc.service.ts:2841](../../backend/src/kyc/kyc.service.ts#L2841); KycService.isLegacyFullKycDraft [backend/src/kyc/kyc.service.ts:2835](../../backend/src/kyc/kyc.service.ts#L2835); KycService.formTenantWhere [backend/src/kyc/kyc.service.ts:2939](../../backend/src/kyc/kyc.service.ts#L2939); KycService.assertReviewPackageReady [backend/src/kyc/kyc.service.ts:3111](../../backend/src/kyc/kyc.service.ts#L3111); KycService.formCompletenessIssues [backend/src/kyc/kyc.service.ts:3120](../../backend/src/kyc/kyc.service.ts#L3120); KycService.formInclude [backend/src/kyc/kyc.service.ts:2597](../../backend/src/kyc/kyc.service.ts#L2597); KycService.serializeForm [backend/src/kyc/kyc.service.ts:2534](../../backend/src/kyc/kyc.service.ts#L2534); KycService.sectionRows [backend/src/kyc/kyc.service.ts:2625](../../backend/src/kyc/kyc.service.ts#L2625); KycService.asArray [backend/src/kyc/kyc.service.ts:3823](../../backend/src/kyc/kyc.service.ts#L3823); KycService.text [backend/src/kyc/kyc.service.ts:3885](../../backend/src/kyc/kyc.service.ts#L3885); KycService.sectionFWithCaseDocuments [backend/src/kyc/kyc.service.ts:2630](../../backend/src/kyc/kyc.service.ts#L2630); KycService.dedupeRequiredDocumentRows [backend/src/kyc/kyc.service.ts:2712](../../backend/src/kyc/kyc.service.ts#L2712); KycService.optionalText [backend/src/kyc/kyc.service.ts:3838](../../backend/src/kyc/kyc.service.ts#L3838); KycService.documentMatchText [backend/src/kyc/kyc.service.ts:2809](../../backend/src/kyc/kyc.service.ts#L2809); KycService.documentFileNames [backend/src/kyc/kyc.service.ts:2773](../../backend/src/kyc/kyc.service.ts#L2773); KycService.isRequiredDocumentMatch [backend/src/kyc/kyc.service.ts:2788](../../backend/src/kyc/kyc.service.ts#L2788); KycService.dedupeAdditionalDocumentRows [backend/src/kyc/kyc.service.ts:2754](../../backend/src/kyc/kyc.service.ts#L2754); KycService.assertComplianceReady [backend/src/kyc/kyc.service.ts:3133](../../backend/src/kyc/kyc.service.ts#L3133); KycService.assertInternalUseReady [backend/src/kyc/kyc.service.ts:3127](../../backend/src/kyc/kyc.service.ts#L3127); KycService.assertScreeningReady [backend/src/kyc/kyc.service.ts:3142](../../backend/src/kyc/kyc.service.ts#L3142); KycService.assertCrrfReady [backend/src/kyc/kyc.service.ts:3202](../../backend/src/kyc/kyc.service.ts#L3202); KycService.lockReviewSubmission [backend/src/kyc/kyc.service.ts:3289](../../backend/src/kyc/kyc.service.ts#L3289); KycService.stageLabel [backend/src/kyc/kyc.service.ts:2976](../../backend/src/kyc/kyc.service.ts#L2976); KycService.jsonValue [backend/src/kyc/kyc.service.ts:3872](../../backend/src/kyc/kyc.service.ts#L3872); KycService.audit [backend/src/kyc/kyc.service.ts:3485](../../backend/src/kyc/kyc.service.ts#L3485); KycService.clearReviewTaskStatus [backend/src/kyc/kyc.service.ts:3067](../../backend/src/kyc/kyc.service.ts#L3067); KycService.createNotification [backend/src/kyc/kyc.service.ts:3498](../../backend/src/kyc/kyc.service.ts#L3498); KycService.caseInclude [backend/src/kyc/kyc.service.ts:4020](../../backend/src/kyc/kyc.service.ts#L4020).
- QA: apply Q-API for this ID and its workflow-specific cases; store status/body/DB diff with secrets removed.
- DTO field-access candidates: conditions, confidentialNotes, data, decision, formalComments, reason. These span reachable helpers and may include fields of internally composed DTOs; they are not a mandatory field list or complete wire schema. Match to the entry DTO and workflow before constructing requests.

## API-2F3919F3

**GET /api/kyc/:id/timeline** - KycController.getTimeline

- Entry/auth: AuthGuard('jwt'); RolesGuard; fallback roles: none declared; authenticated-only when JWT applies.
- Inputs: `@CurrentUser() user: RequestUser`; `@Param('id') id: string`.
- Output: JSON returned from delegated service; inferred fields in linked implementation. Inferred by TypeScript; no explicit response DTO.
- Behavior: Read candidate (static scan only); detected reachable writes: none detected.
- Tenant/role/state/validation helper candidates: tenantWhere.
- Error branch candidates: NotFoundException: 'KYC case not found'); ForbiddenException: 'User is not assigned to a tenant').
- Evidence: [backend/src/kyc/kyc.controller.ts:431](../../backend/src/kyc/kyc.controller.ts#L431).
- Logic chain: KycService.getTimeline [backend/src/kyc/kyc.service.ts:1837](../../backend/src/kyc/kyc.service.ts#L1837); KycService.findOne [backend/src/kyc/kyc.service.ts:148](../../backend/src/kyc/kyc.service.ts#L148); KycService.tenantWhere [backend/src/kyc/kyc.service.ts:2922](../../backend/src/kyc/kyc.service.ts#L2922); KycService.getTenantId [backend/src/kyc/kyc.service.ts:2947](../../backend/src/kyc/kyc.service.ts#L2947); KycService.caseInclude [backend/src/kyc/kyc.service.ts:4020](../../backend/src/kyc/kyc.service.ts#L4020); KycService.withKycNumber [backend/src/kyc/kyc.service.ts:3978](../../backend/src/kyc/kyc.service.ts#L3978); KycService.generatedKycNumber [backend/src/kyc/kyc.service.ts:3962](../../backend/src/kyc/kyc.service.ts#L3962).
- QA: apply Q-API for this ID and its workflow-specific cases; store status/body/DB diff with secrets removed.
- DTO field-access candidates: none resolved. These span reachable helpers and may include fields of internally composed DTOs; they are not a mandatory field list or complete wire schema. Match to the entry DTO and workflow before constructing requests.

## API-081C6E9B

**GET /api/kyc/:kycCaseId/crrf** - CrrfController.getWorkspace

- Entry/auth: AuthGuard('jwt'); RolesGuard; fallback roles: AML_TEAM, AML_SUPERVISOR, DMLRO, MLRO, SEF, CEO, COMPANY_ADMIN, SUPER_ADMIN.
- Inputs: `@CurrentUser() user: RequestUser`; `@Param('kycCaseId') kycCaseId: string`.
- Output: JSON returned from delegated service; inferred fields in linked implementation. Inferred by TypeScript; no explicit response DTO.
- Behavior: GET WITH SIDE EFFECTS; detected reachable writes: crrfRecord.create.
- Tenant/role/state/validation helper candidates: recordTenantWhere.
- Error branch candidates: NotFoundException: 'KYC case not found.'); ForbiddenException: 'User is not assigned to a tenant.').
- Evidence: [backend/src/crrf/crrf.controller.ts:17](../../backend/src/crrf/crrf.controller.ts#L17).
- Logic chain: CrrfService.getWorkspace [backend/src/crrf/crrf.service.ts:39](../../backend/src/crrf/crrf.service.ts#L39); CrrfService.findCase [backend/src/crrf/crrf.service.ts:196](../../backend/src/crrf/crrf.service.ts#L196); CrrfService.caseTenantWhere [backend/src/crrf/crrf.service.ts:254](../../backend/src/crrf/crrf.service.ts#L254); CrrfService.getTenantId [backend/src/crrf/crrf.service.ts:266](../../backend/src/crrf/crrf.service.ts#L266); CrrfService.ensureRecord [backend/src/crrf/crrf.service.ts:209](../../backend/src/crrf/crrf.service.ts#L209); CrrfService.recordTenantWhere [backend/src/crrf/crrf.service.ts:258](../../backend/src/crrf/crrf.service.ts#L258); CrrfService.clientInfo [backend/src/crrf/crrf.service.ts:227](../../backend/src/crrf/crrf.service.ts#L227); CrrfService.generalCompanySection [backend/src/crrf/crrf.service.ts:243](../../backend/src/crrf/crrf.service.ts#L243); CrrfService.isRecord [backend/src/crrf/crrf.service.ts:337](../../backend/src/crrf/crrf.service.ts#L337); CrrfService.stringValue [backend/src/crrf/crrf.service.ts:327](../../backend/src/crrf/crrf.service.ts#L327).
- QA: apply Q-API for this ID and its workflow-specific cases; store status/body/DB diff with secrets removed.
- DTO field-access candidates: none resolved. These span reachable helpers and may include fields of internally composed DTOs; they are not a mandatory field list or complete wire schema. Match to the entry DTO and workflow before constructing requests.

## API-5458803A

**PATCH /api/kyc/:kycCaseId/crrf** - CrrfController.saveWorkspace

- Entry/auth: AuthGuard('jwt'); RolesGuard; fallback roles: AML_TEAM, AML_SUPERVISOR, DMLRO, MLRO, COMPANY_ADMIN, SUPER_ADMIN.
- Inputs: `@CurrentUser() user: RequestUser`; `@Param('kycCaseId') kycCaseId: string`; `@Body() dto: Record<string, unknown>`.
- Output: JSON returned from delegated service; inferred fields in linked implementation. Inferred by TypeScript; no explicit response DTO.
- Behavior: Command (may mutate); detected reachable writes: crrfRecord.update, crrfRecord.create.
- Tenant/role/state/validation helper candidates: recordTenantWhere, enumValue.
- Error branch candidates: BadRequestException: 'Risk rating is required before saving the CRRF record.'); BadRequestException: 'Upload at least one supporting CRRF document before saving the record.'); NotFoundException: 'KYC case not found.'); ForbiddenException: 'User is not assigned to a tenant.').
- Evidence: [backend/src/crrf/crrf.controller.ts:23](../../backend/src/crrf/crrf.controller.ts#L23).
- Logic chain: CrrfService.saveWorkspace [backend/src/crrf/crrf.service.ts:48](../../backend/src/crrf/crrf.service.ts#L48); CrrfService.findCase [backend/src/crrf/crrf.service.ts:196](../../backend/src/crrf/crrf.service.ts#L196); CrrfService.caseTenantWhere [backend/src/crrf/crrf.service.ts:254](../../backend/src/crrf/crrf.service.ts#L254); CrrfService.getTenantId [backend/src/crrf/crrf.service.ts:266](../../backend/src/crrf/crrf.service.ts#L266); CrrfService.ensureRecord [backend/src/crrf/crrf.service.ts:209](../../backend/src/crrf/crrf.service.ts#L209); CrrfService.recordTenantWhere [backend/src/crrf/crrf.service.ts:258](../../backend/src/crrf/crrf.service.ts#L258); CrrfService.enumValue [backend/src/crrf/crrf.service.ts:323](../../backend/src/crrf/crrf.service.ts#L323); CrrfService.internalCommentValue [backend/src/crrf/crrf.service.ts:331](../../backend/src/crrf/crrf.service.ts#L331); CrrfService.stringValue [backend/src/crrf/crrf.service.ts:327](../../backend/src/crrf/crrf.service.ts#L327); CrrfService.getWorkspace [backend/src/crrf/crrf.service.ts:39](../../backend/src/crrf/crrf.service.ts#L39); CrrfService.clientInfo [backend/src/crrf/crrf.service.ts:227](../../backend/src/crrf/crrf.service.ts#L227); CrrfService.generalCompanySection [backend/src/crrf/crrf.service.ts:243](../../backend/src/crrf/crrf.service.ts#L243); CrrfService.isRecord [backend/src/crrf/crrf.service.ts:337](../../backend/src/crrf/crrf.service.ts#L337).
- QA: apply Q-API for this ID and its workflow-specific cases; store status/body/DB diff with secrets removed.
- DTO field-access candidates: dmlroComment, internalComment, mlroComment, riskRating. These span reachable helpers and may include fields of internally composed DTOs; they are not a mandatory field list or complete wire schema. Match to the entry DTO and workflow before constructing requests.

## API-C0EBB861

**DELETE /api/kyc/:kycCaseId/crrf/documents/:documentId** - CrrfController.deleteDocument

- Entry/auth: AuthGuard('jwt'); RolesGuard; fallback roles: AML_TEAM, AML_SUPERVISOR, DMLRO, MLRO, COMPANY_ADMIN, SUPER_ADMIN.
- Inputs: `@CurrentUser() user: RequestUser`; `@Param('kycCaseId') kycCaseId: string`; `@Param('documentId') documentId: string`.
- Output: JSON returned from delegated service; inferred fields in linked implementation. Inferred by TypeScript; no explicit response DTO.
- Behavior: Command (may mutate); detected reachable writes: crrfDocument.delete, crrfRecord.create.
- Tenant/role/state/validation helper candidates: documentTenantWhere, recordTenantWhere.
- Error branch candidates: NotFoundException: 'CRRF document not found.'); ForbiddenException: 'User is not assigned to a tenant.'); NotFoundException: 'KYC case not found.').
- Evidence: [backend/src/crrf/crrf.controller.ts:55](../../backend/src/crrf/crrf.controller.ts#L55).
- Logic chain: CrrfService.deleteDocument [backend/src/crrf/crrf.service.ts:129](../../backend/src/crrf/crrf.service.ts#L129); CrrfService.documentTenantWhere [backend/src/crrf/crrf.service.ts:262](../../backend/src/crrf/crrf.service.ts#L262); CrrfService.getTenantId [backend/src/crrf/crrf.service.ts:266](../../backend/src/crrf/crrf.service.ts#L266); CrrfService.resolveDocumentPath [backend/src/crrf/crrf.service.ts:277](../../backend/src/crrf/crrf.service.ts#L277); CrrfService.uploadRoot [backend/src/crrf/crrf.service.ts:273](../../backend/src/crrf/crrf.service.ts#L273); CrrfService.getWorkspace [backend/src/crrf/crrf.service.ts:39](../../backend/src/crrf/crrf.service.ts#L39); CrrfService.findCase [backend/src/crrf/crrf.service.ts:196](../../backend/src/crrf/crrf.service.ts#L196); CrrfService.caseTenantWhere [backend/src/crrf/crrf.service.ts:254](../../backend/src/crrf/crrf.service.ts#L254); CrrfService.ensureRecord [backend/src/crrf/crrf.service.ts:209](../../backend/src/crrf/crrf.service.ts#L209); CrrfService.recordTenantWhere [backend/src/crrf/crrf.service.ts:258](../../backend/src/crrf/crrf.service.ts#L258); CrrfService.clientInfo [backend/src/crrf/crrf.service.ts:227](../../backend/src/crrf/crrf.service.ts#L227); CrrfService.generalCompanySection [backend/src/crrf/crrf.service.ts:243](../../backend/src/crrf/crrf.service.ts#L243); CrrfService.isRecord [backend/src/crrf/crrf.service.ts:337](../../backend/src/crrf/crrf.service.ts#L337); CrrfService.stringValue [backend/src/crrf/crrf.service.ts:327](../../backend/src/crrf/crrf.service.ts#L327).
- QA: apply Q-API for this ID and its workflow-specific cases; store status/body/DB diff with secrets removed.
- DTO field-access candidates: none resolved. These span reachable helpers and may include fields of internally composed DTOs; they are not a mandatory field list or complete wire schema. Match to the entry DTO and workflow before constructing requests.

## API-E5D21E74

**GET /api/kyc/:kycCaseId/crrf/documents/:documentId/view** - CrrfController.viewDocument

- Entry/auth: AuthGuard('jwt'); RolesGuard; fallback roles: AML_TEAM, AML_SUPERVISOR, DMLRO, MLRO, SEF, CEO, COMPANY_ADMIN, SUPER_ADMIN.
- Inputs: `@CurrentUser() user: RequestUser`; `@Param('kycCaseId') kycCaseId: string`; `@Param('documentId') documentId: string`; `@Res() response: Response`.
- Output: Response.send binary/HTML; see controller MIME and Content-Disposition. Inferred by TypeScript; no explicit response DTO.
- Behavior: Read candidate (static scan only); detected reachable writes: none detected.
- Tenant/role/state/validation helper candidates: documentTenantWhere.
- Error branch candidates: NotFoundException: 'CRRF document file not found.'); NotFoundException: 'CRRF document file is missing from storage.'); ForbiddenException: 'User is not assigned to a tenant.').
- Evidence: [backend/src/crrf/crrf.controller.ts:40](../../backend/src/crrf/crrf.controller.ts#L40).
- Logic chain: CrrfService.getDocumentFile [backend/src/crrf/crrf.service.ts:108](../../backend/src/crrf/crrf.service.ts#L108); CrrfService.documentTenantWhere [backend/src/crrf/crrf.service.ts:262](../../backend/src/crrf/crrf.service.ts#L262); CrrfService.getTenantId [backend/src/crrf/crrf.service.ts:266](../../backend/src/crrf/crrf.service.ts#L266); CrrfService.resolveDocumentPath [backend/src/crrf/crrf.service.ts:277](../../backend/src/crrf/crrf.service.ts#L277); CrrfService.uploadRoot [backend/src/crrf/crrf.service.ts:273](../../backend/src/crrf/crrf.service.ts#L273).
- QA: apply Q-API for this ID and its workflow-specific cases; store status/body/DB diff with secrets removed.
- DTO field-access candidates: none resolved. These span reachable helpers and may include fields of internally composed DTOs; they are not a mandatory field list or complete wire schema. Match to the entry DTO and workflow before constructing requests.

## API-DDD625EB

**POST /api/kyc/:kycCaseId/crrf/documents/upload** - CrrfController.uploadDocuments

- Entry/auth: AuthGuard('jwt'); RolesGuard; fallback roles: AML_TEAM, AML_SUPERVISOR, DMLRO, MLRO, COMPANY_ADMIN, SUPER_ADMIN.
- Inputs: `@CurrentUser() user: RequestUser`; `@Param('kycCaseId') kycCaseId: string`; `@UploadedFiles() files: Array<{ originalname: string; mimetype?: string; size?: number; buffer: Buffer }>`.
- Output: JSON returned from delegated service; inferred fields in linked implementation. Inferred by TypeScript; no explicit response DTO.
- Behavior: Command (may mutate); detected reachable writes: crrfDocument.create, crrfRecord.create.
- Tenant/role/state/validation helper candidates: recordTenantWhere.
- Error branch candidates: BadRequestException: 'Select at least one CRRF document to upload.'); NotFoundException: 'KYC case not found.'); ForbiddenException: 'User is not assigned to a tenant.').
- Evidence: [backend/src/crrf/crrf.controller.ts:29](../../backend/src/crrf/crrf.controller.ts#L29).
- Logic chain: CrrfService.uploadDocuments [backend/src/crrf/crrf.service.ts:71](../../backend/src/crrf/crrf.service.ts#L71); CrrfService.findCase [backend/src/crrf/crrf.service.ts:196](../../backend/src/crrf/crrf.service.ts#L196); CrrfService.caseTenantWhere [backend/src/crrf/crrf.service.ts:254](../../backend/src/crrf/crrf.service.ts#L254); CrrfService.getTenantId [backend/src/crrf/crrf.service.ts:266](../../backend/src/crrf/crrf.service.ts#L266); CrrfService.ensureRecord [backend/src/crrf/crrf.service.ts:209](../../backend/src/crrf/crrf.service.ts#L209); CrrfService.recordTenantWhere [backend/src/crrf/crrf.service.ts:258](../../backend/src/crrf/crrf.service.ts#L258); CrrfService.uploadRoot [backend/src/crrf/crrf.service.ts:273](../../backend/src/crrf/crrf.service.ts#L273); CrrfService.safeFileName [backend/src/crrf/crrf.service.ts:302](../../backend/src/crrf/crrf.service.ts#L302); CrrfService.mimeTypeForFile [backend/src/crrf/crrf.service.ts:294](../../backend/src/crrf/crrf.service.ts#L294); CrrfService.getWorkspace [backend/src/crrf/crrf.service.ts:39](../../backend/src/crrf/crrf.service.ts#L39); CrrfService.clientInfo [backend/src/crrf/crrf.service.ts:227](../../backend/src/crrf/crrf.service.ts#L227); CrrfService.generalCompanySection [backend/src/crrf/crrf.service.ts:243](../../backend/src/crrf/crrf.service.ts#L243); CrrfService.isRecord [backend/src/crrf/crrf.service.ts:337](../../backend/src/crrf/crrf.service.ts#L337); CrrfService.stringValue [backend/src/crrf/crrf.service.ts:327](../../backend/src/crrf/crrf.service.ts#L327).
- QA: apply Q-API for this ID and its workflow-specific cases; store status/body/DB diff with secrets removed.
- DTO field-access candidates: none resolved. These span reachable helpers and may include fields of internally composed DTOs; they are not a mandatory field list or complete wire schema. Match to the entry DTO and workflow before constructing requests.

## API-961FF538

**GET /api/kyc/:kycCaseId/crrf/export/excel** - CrrfController.exportExcel

- Entry/auth: AuthGuard('jwt'); RolesGuard; fallback roles: AML_TEAM, AML_SUPERVISOR, DMLRO, MLRO, SEF, CEO, COMPANY_ADMIN, SUPER_ADMIN.
- Inputs: `@CurrentUser() user: RequestUser`; `@Param('kycCaseId') kycCaseId: string`; `@Res() response: Response`.
- Output: Response.send binary/HTML; see controller MIME and Content-Disposition. Inferred by TypeScript; no explicit response DTO.
- Behavior: GET WITH SIDE EFFECTS; detected reachable writes: crrfRecord.create.
- Tenant/role/state/validation helper candidates: recordTenantWhere.
- Error branch candidates: NotFoundException: 'KYC case not found.'); ForbiddenException: 'User is not assigned to a tenant.').
- Evidence: [backend/src/crrf/crrf.controller.ts:61](../../backend/src/crrf/crrf.controller.ts#L61).
- Logic chain: CrrfService.exportExcel [backend/src/crrf/crrf.service.ts:144](../../backend/src/crrf/crrf.service.ts#L144); CrrfService.getWorkspace [backend/src/crrf/crrf.service.ts:39](../../backend/src/crrf/crrf.service.ts#L39); CrrfService.findCase [backend/src/crrf/crrf.service.ts:196](../../backend/src/crrf/crrf.service.ts#L196); CrrfService.caseTenantWhere [backend/src/crrf/crrf.service.ts:254](../../backend/src/crrf/crrf.service.ts#L254); CrrfService.getTenantId [backend/src/crrf/crrf.service.ts:266](../../backend/src/crrf/crrf.service.ts#L266); CrrfService.ensureRecord [backend/src/crrf/crrf.service.ts:209](../../backend/src/crrf/crrf.service.ts#L209); CrrfService.recordTenantWhere [backend/src/crrf/crrf.service.ts:258](../../backend/src/crrf/crrf.service.ts#L258); CrrfService.clientInfo [backend/src/crrf/crrf.service.ts:227](../../backend/src/crrf/crrf.service.ts#L227); CrrfService.generalCompanySection [backend/src/crrf/crrf.service.ts:243](../../backend/src/crrf/crrf.service.ts#L243); CrrfService.isRecord [backend/src/crrf/crrf.service.ts:337](../../backend/src/crrf/crrf.service.ts#L337); CrrfService.stringValue [backend/src/crrf/crrf.service.ts:327](../../backend/src/crrf/crrf.service.ts#L327); CrrfService.escapeHtml [backend/src/crrf/crrf.service.ts:314](../../backend/src/crrf/crrf.service.ts#L314); CrrfService.safeExportName [backend/src/crrf/crrf.service.ts:310](../../backend/src/crrf/crrf.service.ts#L310); CrrfService.safeFileName [backend/src/crrf/crrf.service.ts:302](../../backend/src/crrf/crrf.service.ts#L302).
- QA: apply Q-API for this ID and its workflow-specific cases; store status/body/DB diff with secrets removed.
- DTO field-access candidates: none resolved. These span reachable helpers and may include fields of internally composed DTOs; they are not a mandatory field list or complete wire schema. Match to the entry DTO and workflow before constructing requests.

## API-D3607C55

**GET /api/kyc/:kycCaseId/crrf/export/pdf** - CrrfController.exportPdf

- Entry/auth: AuthGuard('jwt'); RolesGuard; fallback roles: AML_TEAM, AML_SUPERVISOR, DMLRO, MLRO, SEF, CEO, COMPANY_ADMIN, SUPER_ADMIN.
- Inputs: `@CurrentUser() user: RequestUser`; `@Param('kycCaseId') kycCaseId: string`; `@Res() response: Response`.
- Output: Response.send binary/HTML; see controller MIME and Content-Disposition. Inferred by TypeScript; no explicit response DTO.
- Behavior: GET WITH SIDE EFFECTS; detected reachable writes: crrfRecord.create.
- Tenant/role/state/validation helper candidates: recordTenantWhere.
- Error branch candidates: NotFoundException: 'KYC case not found.'); ForbiddenException: 'User is not assigned to a tenant.').
- Evidence: [backend/src/crrf/crrf.controller.ts:70](../../backend/src/crrf/crrf.controller.ts#L70).
- Logic chain: CrrfService.exportPdf [backend/src/crrf/crrf.service.ts:163](../../backend/src/crrf/crrf.service.ts#L163); CrrfService.getWorkspace [backend/src/crrf/crrf.service.ts:39](../../backend/src/crrf/crrf.service.ts#L39); CrrfService.findCase [backend/src/crrf/crrf.service.ts:196](../../backend/src/crrf/crrf.service.ts#L196); CrrfService.caseTenantWhere [backend/src/crrf/crrf.service.ts:254](../../backend/src/crrf/crrf.service.ts#L254); CrrfService.getTenantId [backend/src/crrf/crrf.service.ts:266](../../backend/src/crrf/crrf.service.ts#L266); CrrfService.ensureRecord [backend/src/crrf/crrf.service.ts:209](../../backend/src/crrf/crrf.service.ts#L209); CrrfService.recordTenantWhere [backend/src/crrf/crrf.service.ts:258](../../backend/src/crrf/crrf.service.ts#L258); CrrfService.clientInfo [backend/src/crrf/crrf.service.ts:227](../../backend/src/crrf/crrf.service.ts#L227); CrrfService.generalCompanySection [backend/src/crrf/crrf.service.ts:243](../../backend/src/crrf/crrf.service.ts#L243); CrrfService.isRecord [backend/src/crrf/crrf.service.ts:337](../../backend/src/crrf/crrf.service.ts#L337); CrrfService.stringValue [backend/src/crrf/crrf.service.ts:327](../../backend/src/crrf/crrf.service.ts#L327); CrrfService.pdfRow [backend/src/crrf/crrf.service.ts:248](../../backend/src/crrf/crrf.service.ts#L248); CrrfService.safeExportName [backend/src/crrf/crrf.service.ts:310](../../backend/src/crrf/crrf.service.ts#L310); CrrfService.safeFileName [backend/src/crrf/crrf.service.ts:302](../../backend/src/crrf/crrf.service.ts#L302).
- QA: apply Q-API for this ID and its workflow-specific cases; store status/body/DB diff with secrets removed.
- DTO field-access candidates: none resolved. These span reachable helpers and may include fields of internally composed DTOs; they are not a mandatory field list or complete wire schema. Match to the entry DTO and workflow before constructing requests.

## API-40B72B78

**GET /api/kyc/:kycCaseId/screening/context** - ScreeningController.getContext

- Entry/auth: AuthGuard('jwt'); RolesGuard; fallback roles: AML_TEAM, AML_SUPERVISOR, DMLRO, MLRO, SEF, CEO, COMPANY_ADMIN, SUPER_ADMIN.
- Inputs: `@CurrentUser() user: RequestUser`; `@Param('kycCaseId') kycCaseId: string`.
- Output: JSON returned from delegated service; inferred fields in linked implementation. Inferred by TypeScript; no explicit response DTO.
- Behavior: GET WITH SIDE EFFECTS; detected reachable writes: screeningCheck.upsert, screeningCaseCheck.createMany.
- Tenant/role/state/validation helper candidates: recordTenantWhere.
- Error branch candidates: NotFoundException: 'KYC case not found.'); ForbiddenException: 'User is not assigned to a tenant.').
- Evidence: [backend/src/screening/screening.controller.ts:17](../../backend/src/screening/screening.controller.ts#L17).
- Logic chain: ScreeningService.getContext [backend/src/screening/screening.service.ts:96](../../backend/src/screening/screening.service.ts#L96); ScreeningService.findCase [backend/src/screening/screening.service.ts:538](../../backend/src/screening/screening.service.ts#L538); ScreeningService.caseTenantWhere [backend/src/screening/screening.service.ts:719](../../backend/src/screening/screening.service.ts#L719); ScreeningService.getTenantId [backend/src/screening/screening.service.ts:739](../../backend/src/screening/screening.service.ts#L739); ScreeningService.ensureMandatoryIndividualChecks [backend/src/screening/screening.service.ts:133](../../backend/src/screening/screening.service.ts#L133); ScreeningService.sectionTenantWhere [backend/src/screening/screening.service.ts:723](../../backend/src/screening/screening.service.ts#L723); ScreeningService.sectionMap [backend/src/screening/screening.service.ts:640](../../backend/src/screening/screening.service.ts#L640); ScreeningService.isRecord [backend/src/screening/screening.service.ts:793](../../backend/src/screening/screening.service.ts#L793); ScreeningService.recordTenantWhere [backend/src/screening/screening.service.ts:727](../../backend/src/screening/screening.service.ts#L727); ScreeningService.ensureMergedCaseChecks [backend/src/screening/screening.service.ts:675](../../backend/src/screening/screening.service.ts#L675); ScreeningService.clientInfo [backend/src/screening/screening.service.ts:626](../../backend/src/screening/screening.service.ts#L626); ScreeningService.stringValue [backend/src/screening/screening.service.ts:779](../../backend/src/screening/screening.service.ts#L779); ScreeningService.extractEntities [backend/src/screening/screening.service.ts:567](../../backend/src/screening/screening.service.ts#L567); ScreeningService.pushEntity [backend/src/screening/screening.service.ts:658](../../backend/src/screening/screening.service.ts#L658); ScreeningService.listValue [backend/src/screening/screening.service.ts:783](../../backend/src/screening/screening.service.ts#L783); ScreeningService.firstText [backend/src/screening/screening.service.ts:788](../../backend/src/screening/screening.service.ts#L788).
- QA: apply Q-API for this ID and its workflow-specific cases; store status/body/DB diff with secrets removed.
- DTO field-access candidates: none resolved. These span reachable helpers and may include fields of internally composed DTOs; they are not a mandatory field list or complete wire schema. Match to the entry DTO and workflow before constructing requests.

## API-815BC666

**DELETE /api/kyc/:kycCaseId/screening/documents/:documentId** - ScreeningController.deleteDocument

- Entry/auth: AuthGuard('jwt'); RolesGuard; fallback roles: AML_TEAM, AML_SUPERVISOR, COMPANY_ADMIN, SUPER_ADMIN.
- Inputs: `@CurrentUser() user: RequestUser`; `@Param('kycCaseId') kycCaseId: string`; `@Param('documentId') documentId: string`.
- Output: JSON returned from delegated service; inferred fields in linked implementation. Inferred by TypeScript; no explicit response DTO.
- Behavior: Command (may mutate); detected reachable writes: screeningDocument.delete, screeningCheck.upsert, screeningCaseCheck.createMany.
- Tenant/role/state/validation helper candidates: documentTenantWhere, recordTenantWhere.
- Error branch candidates: NotFoundException: 'Screening document not found.'); ForbiddenException: 'User is not assigned to a tenant.'); NotFoundException: 'KYC case not found.').
- Evidence: [backend/src/screening/screening.controller.ts:124](../../backend/src/screening/screening.controller.ts#L124).
- Logic chain: ScreeningService.deleteDocument [backend/src/screening/screening.service.ts:520](../../backend/src/screening/screening.service.ts#L520); ScreeningService.documentTenantWhere [backend/src/screening/screening.service.ts:731](../../backend/src/screening/screening.service.ts#L731); ScreeningService.getTenantId [backend/src/screening/screening.service.ts:739](../../backend/src/screening/screening.service.ts#L739); ScreeningService.resolveScreeningDocumentPath [backend/src/screening/screening.service.ts:750](../../backend/src/screening/screening.service.ts#L750); ScreeningService.screeningUploadRoot [backend/src/screening/screening.service.ts:746](../../backend/src/screening/screening.service.ts#L746); ScreeningService.getContext [backend/src/screening/screening.service.ts:96](../../backend/src/screening/screening.service.ts#L96); ScreeningService.findCase [backend/src/screening/screening.service.ts:538](../../backend/src/screening/screening.service.ts#L538); ScreeningService.caseTenantWhere [backend/src/screening/screening.service.ts:719](../../backend/src/screening/screening.service.ts#L719); ScreeningService.ensureMandatoryIndividualChecks [backend/src/screening/screening.service.ts:133](../../backend/src/screening/screening.service.ts#L133); ScreeningService.sectionTenantWhere [backend/src/screening/screening.service.ts:723](../../backend/src/screening/screening.service.ts#L723); ScreeningService.sectionMap [backend/src/screening/screening.service.ts:640](../../backend/src/screening/screening.service.ts#L640); ScreeningService.isRecord [backend/src/screening/screening.service.ts:793](../../backend/src/screening/screening.service.ts#L793); ScreeningService.recordTenantWhere [backend/src/screening/screening.service.ts:727](../../backend/src/screening/screening.service.ts#L727); ScreeningService.ensureMergedCaseChecks [backend/src/screening/screening.service.ts:675](../../backend/src/screening/screening.service.ts#L675); ScreeningService.clientInfo [backend/src/screening/screening.service.ts:626](../../backend/src/screening/screening.service.ts#L626); ScreeningService.stringValue [backend/src/screening/screening.service.ts:779](../../backend/src/screening/screening.service.ts#L779); ScreeningService.extractEntities [backend/src/screening/screening.service.ts:567](../../backend/src/screening/screening.service.ts#L567); ScreeningService.pushEntity [backend/src/screening/screening.service.ts:658](../../backend/src/screening/screening.service.ts#L658); ScreeningService.listValue [backend/src/screening/screening.service.ts:783](../../backend/src/screening/screening.service.ts#L783); ScreeningService.firstText [backend/src/screening/screening.service.ts:788](../../backend/src/screening/screening.service.ts#L788).
- QA: apply Q-API for this ID and its workflow-specific cases; store status/body/DB diff with secrets removed.
- DTO field-access candidates: none resolved. These span reachable helpers and may include fields of internally composed DTOs; they are not a mandatory field list or complete wire schema. Match to the entry DTO and workflow before constructing requests.

## API-9B18C607

**GET /api/kyc/:kycCaseId/screening/documents/:documentId/view** - ScreeningController.viewDocument

- Entry/auth: AuthGuard('jwt'); RolesGuard; fallback roles: AML_TEAM, AML_SUPERVISOR, DMLRO, MLRO, SEF, CEO, COMPANY_ADMIN, SUPER_ADMIN.
- Inputs: `@CurrentUser() user: RequestUser`; `@Param('kycCaseId') kycCaseId: string`; `@Param('documentId') documentId: string`; `@Res() response: Response`.
- Output: Response.send binary/HTML; see controller MIME and Content-Disposition. Inferred by TypeScript; no explicit response DTO.
- Behavior: Read candidate (static scan only); detected reachable writes: none detected.
- Tenant/role/state/validation helper candidates: documentTenantWhere.
- Error branch candidates: NotFoundException: 'Screening document file not found.'); NotFoundException: 'Screening document file is missing from storage.'); ForbiddenException: 'User is not assigned to a tenant.').
- Evidence: [backend/src/screening/screening.controller.ts:109](../../backend/src/screening/screening.controller.ts#L109).
- Logic chain: ScreeningService.getDocumentFile [backend/src/screening/screening.service.ts:499](../../backend/src/screening/screening.service.ts#L499); ScreeningService.documentTenantWhere [backend/src/screening/screening.service.ts:731](../../backend/src/screening/screening.service.ts#L731); ScreeningService.getTenantId [backend/src/screening/screening.service.ts:739](../../backend/src/screening/screening.service.ts#L739); ScreeningService.resolveScreeningDocumentPath [backend/src/screening/screening.service.ts:750](../../backend/src/screening/screening.service.ts#L750); ScreeningService.screeningUploadRoot [backend/src/screening/screening.service.ts:746](../../backend/src/screening/screening.service.ts#L746).
- QA: apply Q-API for this ID and its workflow-specific cases; store status/body/DB diff with secrets removed.
- DTO field-access candidates: none resolved. These span reachable helpers and may include fields of internally composed DTOs; they are not a mandatory field list or complete wire schema. Match to the entry DTO and workflow before constructing requests.

## API-CFC8A791

**PATCH /api/kyc/:kycCaseId/screening/merged-checks/:checkType** - ScreeningController.updateMergedCheck

- Entry/auth: AuthGuard('jwt'); RolesGuard; fallback roles: AML_TEAM, AML_SUPERVISOR, COMPANY_ADMIN, SUPER_ADMIN.
- Inputs: `@CurrentUser() user: RequestUser`; `@Param('kycCaseId') kycCaseId: string`; `@Param('checkType') checkType: string`; `@Body() dto: Record<string, unknown>`.
- Output: JSON returned from delegated service; inferred fields in linked implementation. Inferred by TypeScript; no explicit response DTO.
- Behavior: Command (may mutate); detected reachable writes: screeningCaseCheck.upsert, screeningCheck.upsert, screeningCaseCheck.createMany.
- Tenant/role/state/validation helper candidates: enumValue, recordTenantWhere.
- Error branch candidates: BadRequestException: 'Select NCTC, UN, OFAC, EU, PPO List, World-Check, or Google for the common screening result.'); BadRequestException: 'Select a valid screening result.'); BadRequestException: 'Add comments for potential or confirmed matches.'); NotFoundException: 'KYC case not found.'); ForbiddenException: 'User is not assigned to a tenant.').
- Evidence: [backend/src/screening/screening.controller.ts:64](../../backend/src/screening/screening.controller.ts#L64).
- Logic chain: ScreeningService.updateMergedCheck [backend/src/screening/screening.service.ts:152](../../backend/src/screening/screening.service.ts#L152); ScreeningService.findCase [backend/src/screening/screening.service.ts:538](../../backend/src/screening/screening.service.ts#L538); ScreeningService.caseTenantWhere [backend/src/screening/screening.service.ts:719](../../backend/src/screening/screening.service.ts#L719); ScreeningService.getTenantId [backend/src/screening/screening.service.ts:739](../../backend/src/screening/screening.service.ts#L739); ScreeningService.enumValue [backend/src/screening/screening.service.ts:775](../../backend/src/screening/screening.service.ts#L775); ScreeningService.stringValue [backend/src/screening/screening.service.ts:779](../../backend/src/screening/screening.service.ts#L779); ScreeningService.getContext [backend/src/screening/screening.service.ts:96](../../backend/src/screening/screening.service.ts#L96); ScreeningService.ensureMandatoryIndividualChecks [backend/src/screening/screening.service.ts:133](../../backend/src/screening/screening.service.ts#L133); ScreeningService.sectionTenantWhere [backend/src/screening/screening.service.ts:723](../../backend/src/screening/screening.service.ts#L723); ScreeningService.sectionMap [backend/src/screening/screening.service.ts:640](../../backend/src/screening/screening.service.ts#L640); ScreeningService.isRecord [backend/src/screening/screening.service.ts:793](../../backend/src/screening/screening.service.ts#L793); ScreeningService.recordTenantWhere [backend/src/screening/screening.service.ts:727](../../backend/src/screening/screening.service.ts#L727); ScreeningService.ensureMergedCaseChecks [backend/src/screening/screening.service.ts:675](../../backend/src/screening/screening.service.ts#L675); ScreeningService.clientInfo [backend/src/screening/screening.service.ts:626](../../backend/src/screening/screening.service.ts#L626); ScreeningService.extractEntities [backend/src/screening/screening.service.ts:567](../../backend/src/screening/screening.service.ts#L567); ScreeningService.pushEntity [backend/src/screening/screening.service.ts:658](../../backend/src/screening/screening.service.ts#L658); ScreeningService.listValue [backend/src/screening/screening.service.ts:783](../../backend/src/screening/screening.service.ts#L783); ScreeningService.firstText [backend/src/screening/screening.service.ts:788](../../backend/src/screening/screening.service.ts#L788).
- QA: apply Q-API for this ID and its workflow-specific cases; store status/body/DB diff with secrets removed.
- DTO field-access candidates: notes, resultStatus. These span reachable helpers and may include fields of internally composed DTOs; they are not a mandatory field list or complete wire schema. Match to the entry DTO and workflow before constructing requests.

## API-BB9F5AB9

**DELETE /api/kyc/:kycCaseId/screening/merged-documents/:documentId** - ScreeningController.deleteMergedDocument

- Entry/auth: AuthGuard('jwt'); RolesGuard; fallback roles: AML_TEAM, AML_SUPERVISOR, COMPANY_ADMIN, SUPER_ADMIN.
- Inputs: `@CurrentUser() user: RequestUser`; `@Param('kycCaseId') kycCaseId: string`; `@Param('documentId') documentId: string`.
- Output: JSON returned from delegated service; inferred fields in linked implementation. Inferred by TypeScript; no explicit response DTO.
- Behavior: Command (may mutate); detected reachable writes: screeningCaseDocument.delete, screeningCheck.upsert, screeningCaseCheck.createMany.
- Tenant/role/state/validation helper candidates: recordTenantWhere.
- Error branch candidates: NotFoundException: 'Merged screening document not found.'); ForbiddenException: 'User is not assigned to a tenant.'); NotFoundException: 'KYC case not found.').
- Evidence: [backend/src/screening/screening.controller.ts:90](../../backend/src/screening/screening.controller.ts#L90).
- Logic chain: ScreeningService.deleteMergedDocument [backend/src/screening/screening.service.ts:481](../../backend/src/screening/screening.service.ts#L481); ScreeningService.caseDocumentTenantWhere [backend/src/screening/screening.service.ts:735](../../backend/src/screening/screening.service.ts#L735); ScreeningService.getTenantId [backend/src/screening/screening.service.ts:739](../../backend/src/screening/screening.service.ts#L739); ScreeningService.resolveScreeningDocumentPath [backend/src/screening/screening.service.ts:750](../../backend/src/screening/screening.service.ts#L750); ScreeningService.screeningUploadRoot [backend/src/screening/screening.service.ts:746](../../backend/src/screening/screening.service.ts#L746); ScreeningService.getContext [backend/src/screening/screening.service.ts:96](../../backend/src/screening/screening.service.ts#L96); ScreeningService.findCase [backend/src/screening/screening.service.ts:538](../../backend/src/screening/screening.service.ts#L538); ScreeningService.caseTenantWhere [backend/src/screening/screening.service.ts:719](../../backend/src/screening/screening.service.ts#L719); ScreeningService.ensureMandatoryIndividualChecks [backend/src/screening/screening.service.ts:133](../../backend/src/screening/screening.service.ts#L133); ScreeningService.sectionTenantWhere [backend/src/screening/screening.service.ts:723](../../backend/src/screening/screening.service.ts#L723); ScreeningService.sectionMap [backend/src/screening/screening.service.ts:640](../../backend/src/screening/screening.service.ts#L640); ScreeningService.isRecord [backend/src/screening/screening.service.ts:793](../../backend/src/screening/screening.service.ts#L793); ScreeningService.recordTenantWhere [backend/src/screening/screening.service.ts:727](../../backend/src/screening/screening.service.ts#L727); ScreeningService.ensureMergedCaseChecks [backend/src/screening/screening.service.ts:675](../../backend/src/screening/screening.service.ts#L675); ScreeningService.clientInfo [backend/src/screening/screening.service.ts:626](../../backend/src/screening/screening.service.ts#L626); ScreeningService.stringValue [backend/src/screening/screening.service.ts:779](../../backend/src/screening/screening.service.ts#L779); ScreeningService.extractEntities [backend/src/screening/screening.service.ts:567](../../backend/src/screening/screening.service.ts#L567); ScreeningService.pushEntity [backend/src/screening/screening.service.ts:658](../../backend/src/screening/screening.service.ts#L658); ScreeningService.listValue [backend/src/screening/screening.service.ts:783](../../backend/src/screening/screening.service.ts#L783); ScreeningService.firstText [backend/src/screening/screening.service.ts:788](../../backend/src/screening/screening.service.ts#L788).
- QA: apply Q-API for this ID and its workflow-specific cases; store status/body/DB diff with secrets removed.
- DTO field-access candidates: none resolved. These span reachable helpers and may include fields of internally composed DTOs; they are not a mandatory field list or complete wire schema. Match to the entry DTO and workflow before constructing requests.

## API-0D8258E5

**GET /api/kyc/:kycCaseId/screening/merged-documents/:documentId/view** - ScreeningController.viewMergedDocument

- Entry/auth: AuthGuard('jwt'); RolesGuard; fallback roles: AML_TEAM, AML_SUPERVISOR, DMLRO, MLRO, SEF, CEO, COMPANY_ADMIN, SUPER_ADMIN.
- Inputs: `@CurrentUser() user: RequestUser`; `@Param('kycCaseId') kycCaseId: string`; `@Param('documentId') documentId: string`; `@Res() response: Response`.
- Output: Response.send binary/HTML; see controller MIME and Content-Disposition. Inferred by TypeScript; no explicit response DTO.
- Behavior: Read candidate (static scan only); detected reachable writes: none detected.
- Tenant/role/state/validation helper candidates: none detected; inspect implementation before acceptance.
- Error branch candidates: NotFoundException: 'Merged screening document file not found.'); NotFoundException: 'Merged screening document file is missing from storage.'); ForbiddenException: 'User is not assigned to a tenant.').
- Evidence: [backend/src/screening/screening.controller.ts:75](../../backend/src/screening/screening.controller.ts#L75).
- Logic chain: ScreeningService.getMergedDocumentFile [backend/src/screening/screening.service.ts:460](../../backend/src/screening/screening.service.ts#L460); ScreeningService.caseDocumentTenantWhere [backend/src/screening/screening.service.ts:735](../../backend/src/screening/screening.service.ts#L735); ScreeningService.getTenantId [backend/src/screening/screening.service.ts:739](../../backend/src/screening/screening.service.ts#L739); ScreeningService.resolveScreeningDocumentPath [backend/src/screening/screening.service.ts:750](../../backend/src/screening/screening.service.ts#L750); ScreeningService.screeningUploadRoot [backend/src/screening/screening.service.ts:746](../../backend/src/screening/screening.service.ts#L746).
- QA: apply Q-API for this ID and its workflow-specific cases; store status/body/DB diff with secrets removed.
- DTO field-access candidates: none resolved. These span reachable helpers and may include fields of internally composed DTOs; they are not a mandatory field list or complete wire schema. Match to the entry DTO and workflow before constructing requests.

## API-1A5E5ED2

**POST /api/kyc/:kycCaseId/screening/merged-documents/upload** - ScreeningController.uploadMergedDocuments

- Entry/auth: AuthGuard('jwt'); RolesGuard; fallback roles: AML_TEAM, AML_SUPERVISOR, COMPANY_ADMIN, SUPER_ADMIN.
- Inputs: `@CurrentUser() user: RequestUser`; `@Param('kycCaseId') kycCaseId: string`; `@Body() dto: Record<string, unknown>`; `@UploadedFiles() files: Array<{ originalname: string; mimetype?: string; size?: number; buffer: Buffer }>`.
- Output: JSON returned from delegated service; inferred fields in linked implementation. Inferred by TypeScript; no explicit response DTO.
- Behavior: Command (may mutate); detected reachable writes: screeningCaseCheck.upsert, screeningCaseDocument.create, screeningCheck.upsert, screeningCaseCheck.createMany.
- Tenant/role/state/validation helper candidates: enumValue, recordTenantWhere.
- Error branch candidates: BadRequestException: 'Select at least one merged screening evidence document to upload.'); BadRequestException: 'Upload common screening evidence only for NCTC, UN, OFAC, EU, or PPO List. World-Check and Google are result-only checks.'); NotFoundException: 'KYC case not found.'); ForbiddenException: 'User is not assigned to a tenant.').
- Evidence: [backend/src/screening/screening.controller.ts:52](../../backend/src/screening/screening.controller.ts#L52).
- Logic chain: ScreeningService.uploadMergedDocuments [backend/src/screening/screening.service.ts:335](../../backend/src/screening/screening.service.ts#L335); ScreeningService.findCase [backend/src/screening/screening.service.ts:538](../../backend/src/screening/screening.service.ts#L538); ScreeningService.caseTenantWhere [backend/src/screening/screening.service.ts:719](../../backend/src/screening/screening.service.ts#L719); ScreeningService.getTenantId [backend/src/screening/screening.service.ts:739](../../backend/src/screening/screening.service.ts#L739); ScreeningService.enumValue [backend/src/screening/screening.service.ts:775](../../backend/src/screening/screening.service.ts#L775); ScreeningService.screeningUploadRoot [backend/src/screening/screening.service.ts:746](../../backend/src/screening/screening.service.ts#L746); ScreeningService.safeFileName [backend/src/screening/screening.service.ts:767](../../backend/src/screening/screening.service.ts#L767); ScreeningService.checkLabel [backend/src/screening/screening.service.ts:705](../../backend/src/screening/screening.service.ts#L705); ScreeningService.getContext [backend/src/screening/screening.service.ts:96](../../backend/src/screening/screening.service.ts#L96); ScreeningService.ensureMandatoryIndividualChecks [backend/src/screening/screening.service.ts:133](../../backend/src/screening/screening.service.ts#L133); ScreeningService.sectionTenantWhere [backend/src/screening/screening.service.ts:723](../../backend/src/screening/screening.service.ts#L723); ScreeningService.sectionMap [backend/src/screening/screening.service.ts:640](../../backend/src/screening/screening.service.ts#L640); ScreeningService.isRecord [backend/src/screening/screening.service.ts:793](../../backend/src/screening/screening.service.ts#L793); ScreeningService.recordTenantWhere [backend/src/screening/screening.service.ts:727](../../backend/src/screening/screening.service.ts#L727); ScreeningService.ensureMergedCaseChecks [backend/src/screening/screening.service.ts:675](../../backend/src/screening/screening.service.ts#L675); ScreeningService.clientInfo [backend/src/screening/screening.service.ts:626](../../backend/src/screening/screening.service.ts#L626); ScreeningService.stringValue [backend/src/screening/screening.service.ts:779](../../backend/src/screening/screening.service.ts#L779); ScreeningService.extractEntities [backend/src/screening/screening.service.ts:567](../../backend/src/screening/screening.service.ts#L567); ScreeningService.pushEntity [backend/src/screening/screening.service.ts:658](../../backend/src/screening/screening.service.ts#L658); ScreeningService.listValue [backend/src/screening/screening.service.ts:783](../../backend/src/screening/screening.service.ts#L783); ScreeningService.firstText [backend/src/screening/screening.service.ts:788](../../backend/src/screening/screening.service.ts#L788).
- QA: apply Q-API for this ID and its workflow-specific cases; store status/body/DB diff with secrets removed.
- DTO field-access candidates: checkType. These span reachable helpers and may include fields of internally composed DTOs; they are not a mandatory field list or complete wire schema. Match to the entry DTO and workflow before constructing requests.

## API-73AAC1D8

**POST /api/kyc/:kycCaseId/screening/records** - ScreeningController.createRecord

- Entry/auth: AuthGuard('jwt'); RolesGuard; fallback roles: AML_TEAM, AML_SUPERVISOR, COMPANY_ADMIN, SUPER_ADMIN.
- Inputs: `@CurrentUser() user: RequestUser`; `@Param('kycCaseId') kycCaseId: string`; `@Body() dto: Record<string, unknown>`.
- Output: JSON returned from delegated service; inferred fields in linked implementation. Inferred by TypeScript; no explicit response DTO.
- Behavior: Command (may mutate); detected reachable writes: screeningRecord.create, screeningCheck.upsert, screeningCaseCheck.createMany.
- Tenant/role/state/validation helper candidates: recordTenantWhere, enumValue.
- Error branch candidates: BadRequestException: `Upload merged PDF evidence before adding screening records for: ${missingMergedEvidence.map((item) => this.checkLabel(item)).join(', ')}.`); BadRequestException: 'Select an entity or enter a manual screening name.'); ForbiddenException: 'User is not assigned to a tenant.'); NotFoundException: 'KYC case not found.').
- Evidence: [backend/src/screening/screening.controller.ts:23](../../backend/src/screening/screening.controller.ts#L23).
- Logic chain: ScreeningService.createRecord [backend/src/screening/screening.service.ts:186](../../backend/src/screening/screening.service.ts#L186); ScreeningService.getTenantId [backend/src/screening/screening.service.ts:739](../../backend/src/screening/screening.service.ts#L739); ScreeningService.getContext [backend/src/screening/screening.service.ts:96](../../backend/src/screening/screening.service.ts#L96); ScreeningService.findCase [backend/src/screening/screening.service.ts:538](../../backend/src/screening/screening.service.ts#L538); ScreeningService.caseTenantWhere [backend/src/screening/screening.service.ts:719](../../backend/src/screening/screening.service.ts#L719); ScreeningService.ensureMandatoryIndividualChecks [backend/src/screening/screening.service.ts:133](../../backend/src/screening/screening.service.ts#L133); ScreeningService.sectionTenantWhere [backend/src/screening/screening.service.ts:723](../../backend/src/screening/screening.service.ts#L723); ScreeningService.sectionMap [backend/src/screening/screening.service.ts:640](../../backend/src/screening/screening.service.ts#L640); ScreeningService.isRecord [backend/src/screening/screening.service.ts:793](../../backend/src/screening/screening.service.ts#L793); ScreeningService.recordTenantWhere [backend/src/screening/screening.service.ts:727](../../backend/src/screening/screening.service.ts#L727); ScreeningService.ensureMergedCaseChecks [backend/src/screening/screening.service.ts:675](../../backend/src/screening/screening.service.ts#L675); ScreeningService.clientInfo [backend/src/screening/screening.service.ts:626](../../backend/src/screening/screening.service.ts#L626); ScreeningService.stringValue [backend/src/screening/screening.service.ts:779](../../backend/src/screening/screening.service.ts#L779); ScreeningService.extractEntities [backend/src/screening/screening.service.ts:567](../../backend/src/screening/screening.service.ts#L567); ScreeningService.pushEntity [backend/src/screening/screening.service.ts:658](../../backend/src/screening/screening.service.ts#L658); ScreeningService.listValue [backend/src/screening/screening.service.ts:783](../../backend/src/screening/screening.service.ts#L783); ScreeningService.firstText [backend/src/screening/screening.service.ts:788](../../backend/src/screening/screening.service.ts#L788); ScreeningService.checkLabel [backend/src/screening/screening.service.ts:705](../../backend/src/screening/screening.service.ts#L705); ScreeningService.enumValue [backend/src/screening/screening.service.ts:775](../../backend/src/screening/screening.service.ts#L775).
- QA: apply Q-API for this ID and its workflow-specific cases; store status/body/DB diff with secrets removed.
- DTO field-access candidates: country, entityName, entitySourceId, entityType, identifier. These span reachable helpers and may include fields of internally composed DTOs; they are not a mandatory field list or complete wire schema. Match to the entry DTO and workflow before constructing requests.

## API-E8226A18

**DELETE /api/kyc/:kycCaseId/screening/records/:recordId** - ScreeningController.deleteRecord

- Entry/auth: AuthGuard('jwt'); RolesGuard; fallback roles: AML_TEAM, AML_SUPERVISOR, COMPANY_ADMIN, SUPER_ADMIN.
- Inputs: `@CurrentUser() user: RequestUser`; `@Param('kycCaseId') kycCaseId: string`; `@Param('recordId') recordId: string`.
- Output: JSON returned from delegated service; inferred fields in linked implementation. Inferred by TypeScript; no explicit response DTO.
- Behavior: Command (may mutate); detected reachable writes: screeningRecord.delete, screeningCheck.upsert, screeningCaseCheck.createMany.
- Tenant/role/state/validation helper candidates: recordTenantWhere.
- Error branch candidates: NotFoundException: 'Screening record not found.'); ForbiddenException: 'User is not assigned to a tenant.'); NotFoundException: 'KYC case not found.').
- Evidence: [backend/src/screening/screening.controller.ts:46](../../backend/src/screening/screening.controller.ts#L46).
- Logic chain: ScreeningService.deleteRecord [backend/src/screening/screening.service.ts:323](../../backend/src/screening/screening.service.ts#L323); ScreeningService.findRecord [backend/src/screening/screening.service.ts:551](../../backend/src/screening/screening.service.ts#L551); ScreeningService.recordTenantWhere [backend/src/screening/screening.service.ts:727](../../backend/src/screening/screening.service.ts#L727); ScreeningService.getTenantId [backend/src/screening/screening.service.ts:739](../../backend/src/screening/screening.service.ts#L739); ScreeningService.resolveScreeningDocumentPath [backend/src/screening/screening.service.ts:750](../../backend/src/screening/screening.service.ts#L750); ScreeningService.screeningUploadRoot [backend/src/screening/screening.service.ts:746](../../backend/src/screening/screening.service.ts#L746); ScreeningService.getContext [backend/src/screening/screening.service.ts:96](../../backend/src/screening/screening.service.ts#L96); ScreeningService.findCase [backend/src/screening/screening.service.ts:538](../../backend/src/screening/screening.service.ts#L538); ScreeningService.caseTenantWhere [backend/src/screening/screening.service.ts:719](../../backend/src/screening/screening.service.ts#L719); ScreeningService.ensureMandatoryIndividualChecks [backend/src/screening/screening.service.ts:133](../../backend/src/screening/screening.service.ts#L133); ScreeningService.sectionTenantWhere [backend/src/screening/screening.service.ts:723](../../backend/src/screening/screening.service.ts#L723); ScreeningService.sectionMap [backend/src/screening/screening.service.ts:640](../../backend/src/screening/screening.service.ts#L640); ScreeningService.isRecord [backend/src/screening/screening.service.ts:793](../../backend/src/screening/screening.service.ts#L793); ScreeningService.ensureMergedCaseChecks [backend/src/screening/screening.service.ts:675](../../backend/src/screening/screening.service.ts#L675); ScreeningService.clientInfo [backend/src/screening/screening.service.ts:626](../../backend/src/screening/screening.service.ts#L626); ScreeningService.stringValue [backend/src/screening/screening.service.ts:779](../../backend/src/screening/screening.service.ts#L779); ScreeningService.extractEntities [backend/src/screening/screening.service.ts:567](../../backend/src/screening/screening.service.ts#L567); ScreeningService.pushEntity [backend/src/screening/screening.service.ts:658](../../backend/src/screening/screening.service.ts#L658); ScreeningService.listValue [backend/src/screening/screening.service.ts:783](../../backend/src/screening/screening.service.ts#L783); ScreeningService.firstText [backend/src/screening/screening.service.ts:788](../../backend/src/screening/screening.service.ts#L788).
- QA: apply Q-API for this ID and its workflow-specific cases; store status/body/DB diff with secrets removed.
- DTO field-access candidates: none resolved. These span reachable helpers and may include fields of internally composed DTOs; they are not a mandatory field list or complete wire schema. Match to the entry DTO and workflow before constructing requests.

## API-42B70497

**PATCH /api/kyc/:kycCaseId/screening/records/:recordId** - ScreeningController.updateRecord

- Entry/auth: AuthGuard('jwt'); RolesGuard; fallback roles: AML_TEAM, AML_SUPERVISOR, COMPANY_ADMIN, SUPER_ADMIN.
- Inputs: `@CurrentUser() user: RequestUser`; `@Param('kycCaseId') kycCaseId: string`; `@Param('recordId') recordId: string`; `@Body() dto: Record<string, unknown>`.
- Output: JSON returned from delegated service; inferred fields in linked implementation. Inferred by TypeScript; no explicit response DTO.
- Behavior: Command (may mutate); detected reachable writes: screeningRecord.update, screeningCheck.upsert, screeningCaseCheck.createMany.
- Tenant/role/state/validation helper candidates: recordTenantWhere, enumValue.
- Error branch candidates: NotFoundException: 'Screening record not found.'); ForbiddenException: 'User is not assigned to a tenant.'); NotFoundException: 'KYC case not found.').
- Evidence: [backend/src/screening/screening.controller.ts:29](../../backend/src/screening/screening.controller.ts#L29).
- Logic chain: ScreeningService.updateRecord [backend/src/screening/screening.service.ts:230](../../backend/src/screening/screening.service.ts#L230); ScreeningService.findRecord [backend/src/screening/screening.service.ts:551](../../backend/src/screening/screening.service.ts#L551); ScreeningService.recordTenantWhere [backend/src/screening/screening.service.ts:727](../../backend/src/screening/screening.service.ts#L727); ScreeningService.getTenantId [backend/src/screening/screening.service.ts:739](../../backend/src/screening/screening.service.ts#L739); ScreeningService.stringValue [backend/src/screening/screening.service.ts:779](../../backend/src/screening/screening.service.ts#L779); ScreeningService.enumValue [backend/src/screening/screening.service.ts:775](../../backend/src/screening/screening.service.ts#L775); ScreeningService.isRecord [backend/src/screening/screening.service.ts:793](../../backend/src/screening/screening.service.ts#L793); ScreeningService.getContext [backend/src/screening/screening.service.ts:96](../../backend/src/screening/screening.service.ts#L96); ScreeningService.findCase [backend/src/screening/screening.service.ts:538](../../backend/src/screening/screening.service.ts#L538); ScreeningService.caseTenantWhere [backend/src/screening/screening.service.ts:719](../../backend/src/screening/screening.service.ts#L719); ScreeningService.ensureMandatoryIndividualChecks [backend/src/screening/screening.service.ts:133](../../backend/src/screening/screening.service.ts#L133); ScreeningService.sectionTenantWhere [backend/src/screening/screening.service.ts:723](../../backend/src/screening/screening.service.ts#L723); ScreeningService.sectionMap [backend/src/screening/screening.service.ts:640](../../backend/src/screening/screening.service.ts#L640); ScreeningService.ensureMergedCaseChecks [backend/src/screening/screening.service.ts:675](../../backend/src/screening/screening.service.ts#L675); ScreeningService.clientInfo [backend/src/screening/screening.service.ts:626](../../backend/src/screening/screening.service.ts#L626); ScreeningService.extractEntities [backend/src/screening/screening.service.ts:567](../../backend/src/screening/screening.service.ts#L567); ScreeningService.pushEntity [backend/src/screening/screening.service.ts:658](../../backend/src/screening/screening.service.ts#L658); ScreeningService.listValue [backend/src/screening/screening.service.ts:783](../../backend/src/screening/screening.service.ts#L783); ScreeningService.firstText [backend/src/screening/screening.service.ts:788](../../backend/src/screening/screening.service.ts#L788).
- QA: apply Q-API for this ID and its workflow-specific cases; store status/body/DB diff with secrets removed.
- DTO field-access candidates: checks, conclusionStatus, country, entityName, identifier, remarks. These span reachable helpers and may include fields of internally composed DTOs; they are not a mandatory field list or complete wire schema. Match to the entry DTO and workflow before constructing requests.

## API-E325C8CB

**POST /api/kyc/:kycCaseId/screening/records/:recordId/complete** - ScreeningController.completeRecord

- Entry/auth: AuthGuard('jwt'); RolesGuard; fallback roles: AML_TEAM, AML_SUPERVISOR, COMPANY_ADMIN, SUPER_ADMIN.
- Inputs: `@CurrentUser() user: RequestUser`; `@Param('kycCaseId') kycCaseId: string`; `@Param('recordId') recordId: string`.
- Output: JSON returned from delegated service; inferred fields in linked implementation. Inferred by TypeScript; no explicit response DTO.
- Behavior: Command (may mutate); detected reachable writes: screeningRecord.update, screeningCaseCheck.createMany, screeningCheck.upsert.
- Tenant/role/state/validation helper candidates: recordTenantWhere.
- Error branch candidates: BadRequestException: `Cannot finalize screening yet. ${requirements.join(' ')}`); NotFoundException: 'Screening record not found.'); ForbiddenException: 'User is not assigned to a tenant.'); NotFoundException: 'KYC case not found.').
- Evidence: [backend/src/screening/screening.controller.ts:40](../../backend/src/screening/screening.controller.ts#L40).
- Logic chain: ScreeningService.completeRecord [backend/src/screening/screening.service.ts:273](../../backend/src/screening/screening.service.ts#L273); ScreeningService.findRecord [backend/src/screening/screening.service.ts:551](../../backend/src/screening/screening.service.ts#L551); ScreeningService.recordTenantWhere [backend/src/screening/screening.service.ts:727](../../backend/src/screening/screening.service.ts#L727); ScreeningService.getTenantId [backend/src/screening/screening.service.ts:739](../../backend/src/screening/screening.service.ts#L739); ScreeningService.caseDocumentTenantWhere [backend/src/screening/screening.service.ts:735](../../backend/src/screening/screening.service.ts#L735); ScreeningService.ensureMergedCaseChecks [backend/src/screening/screening.service.ts:675](../../backend/src/screening/screening.service.ts#L675); ScreeningService.checkLabel [backend/src/screening/screening.service.ts:705](../../backend/src/screening/screening.service.ts#L705); ScreeningService.getContext [backend/src/screening/screening.service.ts:96](../../backend/src/screening/screening.service.ts#L96); ScreeningService.findCase [backend/src/screening/screening.service.ts:538](../../backend/src/screening/screening.service.ts#L538); ScreeningService.caseTenantWhere [backend/src/screening/screening.service.ts:719](../../backend/src/screening/screening.service.ts#L719); ScreeningService.ensureMandatoryIndividualChecks [backend/src/screening/screening.service.ts:133](../../backend/src/screening/screening.service.ts#L133); ScreeningService.sectionTenantWhere [backend/src/screening/screening.service.ts:723](../../backend/src/screening/screening.service.ts#L723); ScreeningService.sectionMap [backend/src/screening/screening.service.ts:640](../../backend/src/screening/screening.service.ts#L640); ScreeningService.isRecord [backend/src/screening/screening.service.ts:793](../../backend/src/screening/screening.service.ts#L793); ScreeningService.clientInfo [backend/src/screening/screening.service.ts:626](../../backend/src/screening/screening.service.ts#L626); ScreeningService.stringValue [backend/src/screening/screening.service.ts:779](../../backend/src/screening/screening.service.ts#L779); ScreeningService.extractEntities [backend/src/screening/screening.service.ts:567](../../backend/src/screening/screening.service.ts#L567); ScreeningService.pushEntity [backend/src/screening/screening.service.ts:658](../../backend/src/screening/screening.service.ts#L658); ScreeningService.listValue [backend/src/screening/screening.service.ts:783](../../backend/src/screening/screening.service.ts#L783); ScreeningService.firstText [backend/src/screening/screening.service.ts:788](../../backend/src/screening/screening.service.ts#L788).
- QA: apply Q-API for this ID and its workflow-specific cases; store status/body/DB diff with secrets removed.
- DTO field-access candidates: none resolved. These span reachable helpers and may include fields of internally composed DTOs; they are not a mandatory field list or complete wire schema. Match to the entry DTO and workflow before constructing requests.

## API-5898413C

**POST /api/kyc/:kycCaseId/screening/records/:recordId/documents/upload** - ScreeningController.uploadDocuments

- Entry/auth: AuthGuard('jwt'); RolesGuard; fallback roles: AML_TEAM, AML_SUPERVISOR, COMPANY_ADMIN, SUPER_ADMIN.
- Inputs: `@CurrentUser() user: RequestUser`; `@Param('kycCaseId') kycCaseId: string`; `@Param('recordId') recordId: string`; `@Body() dto: Record<string, unknown>`; `@UploadedFiles() files: Array<{ originalname: string; mimetype?: string; size?: number; buffer: Buffer }>`.
- Output: JSON returned from delegated service; inferred fields in linked implementation. Inferred by TypeScript; no explicit response DTO.
- Behavior: Command (may mutate); detected reachable writes: screeningCheck.create, screeningCheck.update, screeningDocument.create, screeningCheck.upsert, screeningCaseCheck.createMany.
- Tenant/role/state/validation helper candidates: recordTenantWhere, enumValue.
- Error branch candidates: BadRequestException: 'Select at least one screening document to upload.'); BadRequestException: 'Select the screening check type before uploading.'); NotFoundException: 'Screening record not found.'); ForbiddenException: 'User is not assigned to a tenant.'); NotFoundException: 'KYC case not found.').
- Evidence: [backend/src/screening/screening.controller.ts:96](../../backend/src/screening/screening.controller.ts#L96).
- Logic chain: ScreeningService.uploadDocuments [backend/src/screening/screening.service.ts:390](../../backend/src/screening/screening.service.ts#L390); ScreeningService.findRecord [backend/src/screening/screening.service.ts:551](../../backend/src/screening/screening.service.ts#L551); ScreeningService.recordTenantWhere [backend/src/screening/screening.service.ts:727](../../backend/src/screening/screening.service.ts#L727); ScreeningService.getTenantId [backend/src/screening/screening.service.ts:739](../../backend/src/screening/screening.service.ts#L739); ScreeningService.enumValue [backend/src/screening/screening.service.ts:775](../../backend/src/screening/screening.service.ts#L775); ScreeningService.screeningUploadRoot [backend/src/screening/screening.service.ts:746](../../backend/src/screening/screening.service.ts#L746); ScreeningService.safeFileName [backend/src/screening/screening.service.ts:767](../../backend/src/screening/screening.service.ts#L767); ScreeningService.stringValue [backend/src/screening/screening.service.ts:779](../../backend/src/screening/screening.service.ts#L779); ScreeningService.checkLabel [backend/src/screening/screening.service.ts:705](../../backend/src/screening/screening.service.ts#L705); ScreeningService.getContext [backend/src/screening/screening.service.ts:96](../../backend/src/screening/screening.service.ts#L96); ScreeningService.findCase [backend/src/screening/screening.service.ts:538](../../backend/src/screening/screening.service.ts#L538); ScreeningService.caseTenantWhere [backend/src/screening/screening.service.ts:719](../../backend/src/screening/screening.service.ts#L719); ScreeningService.ensureMandatoryIndividualChecks [backend/src/screening/screening.service.ts:133](../../backend/src/screening/screening.service.ts#L133); ScreeningService.sectionTenantWhere [backend/src/screening/screening.service.ts:723](../../backend/src/screening/screening.service.ts#L723); ScreeningService.sectionMap [backend/src/screening/screening.service.ts:640](../../backend/src/screening/screening.service.ts#L640); ScreeningService.isRecord [backend/src/screening/screening.service.ts:793](../../backend/src/screening/screening.service.ts#L793); ScreeningService.ensureMergedCaseChecks [backend/src/screening/screening.service.ts:675](../../backend/src/screening/screening.service.ts#L675); ScreeningService.clientInfo [backend/src/screening/screening.service.ts:626](../../backend/src/screening/screening.service.ts#L626); ScreeningService.extractEntities [backend/src/screening/screening.service.ts:567](../../backend/src/screening/screening.service.ts#L567); ScreeningService.pushEntity [backend/src/screening/screening.service.ts:658](../../backend/src/screening/screening.service.ts#L658); ScreeningService.listValue [backend/src/screening/screening.service.ts:783](../../backend/src/screening/screening.service.ts#L783); ScreeningService.firstText [backend/src/screening/screening.service.ts:788](../../backend/src/screening/screening.service.ts#L788).
- QA: apply Q-API for this ID and its workflow-specific cases; store status/body/DB diff with secrets removed.
- DTO field-access candidates: checkType, documentType. These span reachable helpers and may include fields of internally composed DTOs; they are not a mandatory field list or complete wire schema. Match to the entry DTO and workflow before constructing requests.

## API-BD67B8EC

**GET /api/kyc/aml/notifications** - KycController.getPendingAmlNotifications

- Entry/auth: AuthGuard('jwt'); RolesGuard; fallback roles: AML_TEAM, COMPANY_ADMIN, SUPER_ADMIN.
- Inputs: `@CurrentUser() user: RequestUser`.
- Output: JSON returned from delegated service; inferred fields in linked implementation. Inferred by TypeScript; no explicit response DTO.
- Behavior: Read candidate (static scan only); detected reachable writes: none detected.
- Tenant/role/state/validation helper candidates: none detected; inspect implementation before acceptance.
- Error branch candidates: ForbiddenException: 'User is not assigned to a tenant').
- Evidence: [backend/src/kyc/kyc.controller.ts:35](../../backend/src/kyc/kyc.controller.ts#L35).
- Logic chain: KycService.getPendingAmlNotifications [backend/src/kyc/kyc.service.ts:2370](../../backend/src/kyc/kyc.service.ts#L2370); KycService.getTenantId [backend/src/kyc/kyc.service.ts:2947](../../backend/src/kyc/kyc.service.ts#L2947).
- QA: apply Q-API for this ID and its workflow-specific cases; store status/body/DB diff with secrets removed.
- DTO field-access candidates: none resolved. These span reachable helpers and may include fields of internally composed DTOs; they are not a mandatory field list or complete wire schema. Match to the entry DTO and workflow before constructing requests.

## API-81BAF9B4

**GET /api/kyc/review/tasks** - KycController.getMyReviewTasks

- Entry/auth: AuthGuard('jwt'); RolesGuard; fallback roles: AML_TEAM, AML_SUPERVISOR, DMLRO, MLRO, SEF, COMPANY_ADMIN, SUPER_ADMIN.
- Inputs: `@CurrentUser() user: RequestUser`.
- Output: JSON returned from delegated service; inferred fields in linked implementation. Inferred by TypeScript; no explicit response DTO.
- Behavior: Read candidate (static scan only); detected reachable writes: none detected.
- Tenant/role/state/validation helper candidates: hasAnyRole.
- Error branch candidates: InternalServerErrorException: 'Unable to load SEF review tasks. Confirm the latest database migrations are applied and refresh the page.'); ForbiddenException: 'User is not assigned to a tenant').
- Evidence: [backend/src/kyc/kyc.controller.ts:41](../../backend/src/kyc/kyc.controller.ts#L41).
- Logic chain: KycService.getMyReviewTasks [backend/src/kyc/kyc.service.ts:2395](../../backend/src/kyc/kyc.service.ts#L2395); KycService.reviewStagesForUser [backend/src/kyc/kyc.service.ts:3550](../../backend/src/kyc/kyc.service.ts#L3550); KycService.hasAnyRole [backend/src/kyc/kyc.service.ts:2959](../../backend/src/kyc/kyc.service.ts#L2959); KycService.reviewNotificationTypesForUser [backend/src/kyc/kyc.service.ts:3561](../../backend/src/kyc/kyc.service.ts#L3561); KycService.getTenantId [backend/src/kyc/kyc.service.ts:2947](../../backend/src/kyc/kyc.service.ts#L2947); KycService.stageStatus [backend/src/kyc/kyc.service.ts:2987](../../backend/src/kyc/kyc.service.ts#L2987).
- QA: apply Q-API for this ID and its workflow-specific cases; store status/body/DB diff with secrets removed.
- DTO field-access candidates: none resolved. These span reachable helpers and may include fields of internally composed DTOs; they are not a mandatory field list or complete wire schema. Match to the entry DTO and workflow before constructing requests.

## API-6FD57A81

**GET /api/modules** - ModulesController.findAll

- Entry/auth: AuthGuard('jwt'); RolesGuard; fallback roles: SUPER_ADMIN.
- Inputs: none.
- Output: JSON returned from delegated service; inferred fields in linked implementation. Inferred by TypeScript; no explicit response DTO.
- Behavior: Read candidate (static scan only); detected reachable writes: none detected.
- Tenant/role/state/validation helper candidates: none detected; inspect implementation before acceptance.
- Error branch candidates: none explicitly thrown in resolved methods; global errors still apply.
- Evidence: [backend/src/modules/modules.controller.ts:12](../../backend/src/modules/modules.controller.ts#L12).
- Logic chain: ModulesService.findAll [backend/src/modules/modules.service.ts:8](../../backend/src/modules/modules.service.ts#L8).
- QA: apply Q-API for this ID and its workflow-specific cases; store status/body/DB diff with secrets removed.
- DTO field-access candidates: none resolved. These span reachable helpers and may include fields of internally composed DTOs; they are not a mandatory field list or complete wire schema. Match to the entry DTO and workflow before constructing requests.

## API-C3DF3359

**GET /api/notifications** - NotificationsController.findAll

- Entry/auth: AuthGuard('jwt'); fallback roles: none declared; authenticated-only when JWT applies.
- Inputs: `@CurrentUser() user: RequestUser`.
- Output: JSON returned from delegated service; inferred fields in linked implementation. Inferred by TypeScript; no explicit response DTO.
- Behavior: Read candidate (static scan only); detected reachable writes: none detected.
- Tenant/role/state/validation helper candidates: notificationWhere, hasAnyRole.
- Error branch candidates: none explicitly thrown in resolved methods; global errors still apply.
- Evidence: [backend/src/notifications/notifications.controller.ts:12](../../backend/src/notifications/notifications.controller.ts#L12).
- Logic chain: NotificationsService.findAll [backend/src/notifications/notifications.service.ts:10](../../backend/src/notifications/notifications.service.ts#L10); NotificationsService.notificationWhere [backend/src/notifications/notifications.service.ts:52](../../backend/src/notifications/notifications.service.ts#L52); NotificationsService.notificationTypesForUser [backend/src/notifications/notifications.service.ts:64](../../backend/src/notifications/notifications.service.ts#L64); NotificationsService.hasAnyRole [backend/src/notifications/notifications.service.ts:128](../../backend/src/notifications/notifications.service.ts#L128).
- QA: apply Q-API for this ID and its workflow-specific cases; store status/body/DB diff with secrets removed.
- DTO field-access candidates: none resolved. These span reachable helpers and may include fields of internally composed DTOs; they are not a mandatory field list or complete wire schema. Match to the entry DTO and workflow before constructing requests.

## API-65B6D065

**PATCH /api/notifications/:id/read** - NotificationsController.markRead

- Entry/auth: AuthGuard('jwt'); fallback roles: none declared; authenticated-only when JWT applies.
- Inputs: `@CurrentUser() user: RequestUser`; `@Param('id') id: string`.
- Output: JSON returned from delegated service; inferred fields in linked implementation. Inferred by TypeScript; no explicit response DTO.
- Behavior: Command (may mutate); detected reachable writes: notification.update.
- Tenant/role/state/validation helper candidates: notificationWhere, hasAnyRole.
- Error branch candidates: NotFoundException: 'Notification not found').
- Evidence: [backend/src/notifications/notifications.controller.ts:22](../../backend/src/notifications/notifications.controller.ts#L22).
- Logic chain: NotificationsService.markRead [backend/src/notifications/notifications.service.ts:23](../../backend/src/notifications/notifications.service.ts#L23); NotificationsService.notificationWhere [backend/src/notifications/notifications.service.ts:52](../../backend/src/notifications/notifications.service.ts#L52); NotificationsService.notificationTypesForUser [backend/src/notifications/notifications.service.ts:64](../../backend/src/notifications/notifications.service.ts#L64); NotificationsService.hasAnyRole [backend/src/notifications/notifications.service.ts:128](../../backend/src/notifications/notifications.service.ts#L128).
- QA: apply Q-API for this ID and its workflow-specific cases; store status/body/DB diff with secrets removed.
- DTO field-access candidates: none resolved. These span reachable helpers and may include fields of internally composed DTOs; they are not a mandatory field list or complete wire schema. Match to the entry DTO and workflow before constructing requests.

## API-FA599A44

**PATCH /api/notifications/read-all** - NotificationsController.markAllRead

- Entry/auth: AuthGuard('jwt'); fallback roles: none declared; authenticated-only when JWT applies.
- Inputs: `@CurrentUser() user: RequestUser`.
- Output: JSON returned from delegated service; inferred fields in linked implementation. Inferred by TypeScript; no explicit response DTO.
- Behavior: Command (may mutate); detected reachable writes: notification.updateMany.
- Tenant/role/state/validation helper candidates: notificationWhere, hasAnyRole.
- Error branch candidates: none explicitly thrown in resolved methods; global errors still apply.
- Evidence: [backend/src/notifications/notifications.controller.ts:17](../../backend/src/notifications/notifications.controller.ts#L17).
- Logic chain: NotificationsService.markAllRead [backend/src/notifications/notifications.service.ts:43](../../backend/src/notifications/notifications.service.ts#L43); NotificationsService.notificationWhere [backend/src/notifications/notifications.service.ts:52](../../backend/src/notifications/notifications.service.ts#L52); NotificationsService.notificationTypesForUser [backend/src/notifications/notifications.service.ts:64](../../backend/src/notifications/notifications.service.ts#L64); NotificationsService.hasAnyRole [backend/src/notifications/notifications.service.ts:128](../../backend/src/notifications/notifications.service.ts#L128); NotificationsService.findAll [backend/src/notifications/notifications.service.ts:10](../../backend/src/notifications/notifications.service.ts#L10).
- QA: apply Q-API for this ID and its workflow-specific cases; store status/body/DB diff with secrets removed.
- DTO field-access candidates: none resolved. These span reachable helpers and may include fields of internally composed DTOs; they are not a mandatory field list or complete wire schema. Match to the entry DTO and workflow before constructing requests.

## API-AAF14881

**GET /api/permissions** - PermissionsController.findAll

- Entry/auth: AuthGuard('jwt'); RolesGuard; fallback roles: SUPER_ADMIN.
- Inputs: none.
- Output: JSON returned from delegated service; inferred fields in linked implementation. Inferred by TypeScript; no explicit response DTO.
- Behavior: Read candidate (static scan only); detected reachable writes: none detected.
- Tenant/role/state/validation helper candidates: none detected; inspect implementation before acceptance.
- Error branch candidates: none explicitly thrown in resolved methods; global errors still apply.
- Evidence: [backend/src/permissions/permissions.controller.ts:12](../../backend/src/permissions/permissions.controller.ts#L12).
- Logic chain: PermissionsService.findAll [backend/src/permissions/permissions.service.ts:8](../../backend/src/permissions/permissions.service.ts#L8).
- QA: apply Q-API for this ID and its workflow-specific cases; store status/body/DB diff with secrets removed.
- DTO field-access candidates: none resolved. These span reachable helpers and may include fields of internally composed DTOs; they are not a mandatory field list or complete wire schema. Match to the entry DTO and workflow before constructing requests.

## API-E6508535

**GET /api/roles** - RolesController.findAll

- Entry/auth: AuthGuard('jwt'); RolesGuard; fallback roles: SUPER_ADMIN, COMPANY_ADMIN.
- Inputs: none.
- Output: JSON returned from delegated service; inferred fields in linked implementation. Inferred by TypeScript; no explicit response DTO.
- Behavior: Read candidate (static scan only); detected reachable writes: none detected.
- Tenant/role/state/validation helper candidates: none detected; inspect implementation before acceptance.
- Error branch candidates: none explicitly thrown in resolved methods; global errors still apply.
- Evidence: [backend/src/roles/roles.controller.ts:12](../../backend/src/roles/roles.controller.ts#L12).
- Logic chain: RolesService.findAll [backend/src/roles/roles.service.ts:8](../../backend/src/roles/roles.service.ts#L8).
- QA: apply Q-API for this ID and its workflow-specific cases; store status/body/DB diff with secrets removed.
- DTO field-access candidates: none resolved. These span reachable helpers and may include fields of internally composed DTOs; they are not a mandatory field list or complete wire schema. Match to the entry DTO and workflow before constructing requests.

## API-FAD10027

**GET /api/screening** - ScreeningListController.listRecords

- Entry/auth: AuthGuard('jwt'); RolesGuard; fallback roles: AML_TEAM, AML_SUPERVISOR, DMLRO, MLRO, SEF, CEO, COMPANY_ADMIN, SUPER_ADMIN.
- Inputs: `@CurrentUser() user: RequestUser`.
- Output: JSON returned from delegated service; inferred fields in linked implementation. Inferred by TypeScript; no explicit response DTO.
- Behavior: Read candidate (static scan only); detected reachable writes: none detected.
- Tenant/role/state/validation helper candidates: recordTenantWhere.
- Error branch candidates: ForbiddenException: 'User is not assigned to a tenant.').
- Evidence: [backend/src/screening/screening.controller.ts:136](../../backend/src/screening/screening.controller.ts#L136).
- Logic chain: ScreeningService.listRecords [backend/src/screening/screening.service.ts:72](../../backend/src/screening/screening.service.ts#L72); ScreeningService.recordTenantWhere [backend/src/screening/screening.service.ts:727](../../backend/src/screening/screening.service.ts#L727); ScreeningService.getTenantId [backend/src/screening/screening.service.ts:739](../../backend/src/screening/screening.service.ts#L739).
- QA: apply Q-API for this ID and its workflow-specific cases; store status/body/DB diff with secrets removed.
- DTO field-access candidates: none resolved. These span reachable helpers and may include fields of internally composed DTOs; they are not a mandatory field list or complete wire schema. Match to the entry DTO and workflow before constructing requests.

## API-5ADDCCFF

**PUT /api/tenant-modules** - TenantModulesController.assign

- Entry/auth: AuthGuard('jwt'); RolesGuard; fallback roles: SUPER_ADMIN.
- Inputs: `@Body() dto: AssignTenantModuleDto`.
- Output: JSON returned from delegated service; inferred fields in linked implementation. Inferred by TypeScript; no explicit response DTO.
- Behavior: Command (may mutate); detected reachable writes: tenantModule.upsert.
- Tenant/role/state/validation helper candidates: none detected; inspect implementation before acceptance.
- Error branch candidates: none explicitly thrown in resolved methods; global errors still apply.
- Evidence: [backend/src/tenant-modules/tenant-modules.controller.ts:19](../../backend/src/tenant-modules/tenant-modules.controller.ts#L19).
- Logic chain: TenantModulesService.assign [backend/src/tenant-modules/tenant-modules.service.ts:17](../../backend/src/tenant-modules/tenant-modules.service.ts#L17).
- QA: apply Q-API for this ID and its workflow-specific cases; store status/body/DB diff with secrets removed.
- DTO field-access candidates: isEnabled, moduleId, tenantId. These span reachable helpers and may include fields of internally composed DTOs; they are not a mandatory field list or complete wire schema. Match to the entry DTO and workflow before constructing requests.

## API-AF74D957

**GET /api/tenant-modules/:tenantId** - TenantModulesController.findByTenant

- Entry/auth: AuthGuard('jwt'); RolesGuard; fallback roles: SUPER_ADMIN.
- Inputs: `@Param('tenantId') tenantId: string`.
- Output: JSON returned from delegated service; inferred fields in linked implementation. Inferred by TypeScript; no explicit response DTO.
- Behavior: Read candidate (static scan only); detected reachable writes: none detected.
- Tenant/role/state/validation helper candidates: none detected; inspect implementation before acceptance.
- Error branch candidates: none explicitly thrown in resolved methods; global errors still apply.
- Evidence: [backend/src/tenant-modules/tenant-modules.controller.ts:13](../../backend/src/tenant-modules/tenant-modules.controller.ts#L13).
- Logic chain: TenantModulesService.findByTenant [backend/src/tenant-modules/tenant-modules.service.ts:9](../../backend/src/tenant-modules/tenant-modules.service.ts#L9).
- QA: apply Q-API for this ID and its workflow-specific cases; store status/body/DB diff with secrets removed.
- DTO field-access candidates: none resolved. These span reachable helpers and may include fields of internally composed DTOs; they are not a mandatory field list or complete wire schema. Match to the entry DTO and workflow before constructing requests.

## API-3F8FA46B

**GET /api/tenants** - TenantsController.findAll

- Entry/auth: AuthGuard('jwt'); RolesGuard; fallback roles: SUPER_ADMIN.
- Inputs: none.
- Output: JSON returned from delegated service; inferred fields in linked implementation. Inferred by TypeScript; no explicit response DTO.
- Behavior: Read candidate (static scan only); detected reachable writes: none detected.
- Tenant/role/state/validation helper candidates: none detected; inspect implementation before acceptance.
- Error branch candidates: none explicitly thrown in resolved methods; global errors still apply.
- Evidence: [backend/src/tenants/tenants.controller.ts:13](../../backend/src/tenants/tenants.controller.ts#L13).
- Logic chain: TenantsService.findAll [backend/src/tenants/tenants.service.ts:10](../../backend/src/tenants/tenants.service.ts#L10).
- QA: apply Q-API for this ID and its workflow-specific cases; store status/body/DB diff with secrets removed.
- DTO field-access candidates: none resolved. These span reachable helpers and may include fields of internally composed DTOs; they are not a mandatory field list or complete wire schema. Match to the entry DTO and workflow before constructing requests.

## API-B00A1FCA

**POST /api/tenants** - TenantsController.create

- Entry/auth: AuthGuard('jwt'); RolesGuard; fallback roles: SUPER_ADMIN.
- Inputs: `@Body() dto: CreateTenantDto`.
- Output: JSON returned from delegated service; inferred fields in linked implementation. Inferred by TypeScript; no explicit response DTO.
- Behavior: Command (may mutate); detected reachable writes: tenant.create.
- Tenant/role/state/validation helper candidates: none detected; inspect implementation before acceptance.
- Error branch candidates: none explicitly thrown in resolved methods; global errors still apply.
- Evidence: [backend/src/tenants/tenants.controller.ts:19](../../backend/src/tenants/tenants.controller.ts#L19).
- Logic chain: TenantsService.create [backend/src/tenants/tenants.service.ts:29](../../backend/src/tenants/tenants.service.ts#L29).
- QA: apply Q-API for this ID and its workflow-specific cases; store status/body/DB diff with secrets removed.
- DTO field-access candidates: isActive, name, slug. These span reachable helpers and may include fields of internally composed DTOs; they are not a mandatory field list or complete wire schema. Match to the entry DTO and workflow before constructing requests.

## API-96DAF7CF

**GET /api/tenants/:id** - TenantsController.findOne

- Entry/auth: AuthGuard('jwt'); RolesGuard; fallback roles: SUPER_ADMIN.
- Inputs: `@Param('id') id: string`.
- Output: JSON returned from delegated service; inferred fields in linked implementation. Inferred by TypeScript; no explicit response DTO.
- Behavior: Read candidate (static scan only); detected reachable writes: none detected.
- Tenant/role/state/validation helper candidates: none detected; inspect implementation before acceptance.
- Error branch candidates: none explicitly thrown in resolved methods; global errors still apply.
- Evidence: [backend/src/tenants/tenants.controller.ts:25](../../backend/src/tenants/tenants.controller.ts#L25).
- Logic chain: TenantsService.findOne [backend/src/tenants/tenants.service.ts:19](../../backend/src/tenants/tenants.service.ts#L19).
- QA: apply Q-API for this ID and its workflow-specific cases; store status/body/DB diff with secrets removed.
- DTO field-access candidates: none resolved. These span reachable helpers and may include fields of internally composed DTOs; they are not a mandatory field list or complete wire schema. Match to the entry DTO and workflow before constructing requests.

## API-55FFF749

**GET /api/users** - UsersController.findAll

- Entry/auth: AuthGuard('jwt'); RolesGuard; fallback roles: SUPER_ADMIN, COMPANY_ADMIN.
- Inputs: `@CurrentUser() user: RequestUser`.
- Output: JSON returned from delegated service; inferred fields in linked implementation. Inferred by TypeScript; no explicit response DTO.
- Behavior: Read candidate (static scan only); detected reachable writes: none detected.
- Tenant/role/state/validation helper candidates: assertAdmin.
- Error branch candidates: ForbiddenException: 'Only administrators can manage users.'); ForbiddenException: 'A company administrator must belong to a company.').
- Evidence: [backend/src/users/users.controller.ts:15](../../backend/src/users/users.controller.ts#L15).
- Logic chain: UsersService.findAll [backend/src/users/users.service.ts:24](../../backend/src/users/users.service.ts#L24); UsersService.assertAdmin [backend/src/users/users.service.ts:18](../../backend/src/users/users.service.ts#L18).
- QA: apply Q-API for this ID and its workflow-specific cases; store status/body/DB diff with secrets removed.
- DTO field-access candidates: none resolved. These span reachable helpers and may include fields of internally composed DTOs; they are not a mandatory field list or complete wire schema. Match to the entry DTO and workflow before constructing requests.

## API-0598E5EB

**POST /api/users** - UsersController.create

- Entry/auth: AuthGuard('jwt'); RolesGuard; fallback roles: SUPER_ADMIN, COMPANY_ADMIN.
- Inputs: `@CurrentUser() user: RequestUser`; `@Body() dto: CreateUserDto`.
- Output: JSON returned from delegated service; inferred fields in linked implementation. Inferred by TypeScript; no explicit response DTO.
- Behavior: Command (may mutate); detected reachable writes: user.create, auditLog.create.
- Tenant/role/state/validation helper candidates: assertAdmin.
- Error branch candidates: ForbiddenException: 'You can only create users for your own company.'); BadRequestException: 'Select a company for this account.'); BadRequestException: 'Company is not active or does not exist.'); ForbiddenException: 'Only administrators can manage users.'); ForbiddenException: 'A company administrator must belong to a company.'); BadRequestException: policyError); BadRequestException: 'Select valid workflow roles.'); ForbiddenException: 'Only a Super Admin can assign the Super Admin role.'); BadRequestException: 'A selected role is not configured. Contact the platform administrator.'); ConflictException: 'An account with that email address already exists.').
- Evidence: [backend/src/users/users.controller.ts:25](../../backend/src/users/users.controller.ts#L25).
- Logic chain: UsersService.create [backend/src/users/users.service.ts:64](../../backend/src/users/users.service.ts#L64); UsersService.assertAdmin [backend/src/users/users.service.ts:18](../../backend/src/users/users.service.ts#L18); UsersService.passwordHash [backend/src/users/users.service.ts:53](../../backend/src/users/users.service.ts#L53); UsersService.assignedRoles [backend/src/users/users.service.ts:45](../../backend/src/users/users.service.ts#L45); UsersService.duplicateEmail [backend/src/users/users.service.ts:59](../../backend/src/users/users.service.ts#L59).
- QA: apply Q-API for this ID and its workflow-specific cases; store status/body/DB diff with secrets removed.
- DTO field-access candidates: email, firstName, lastName, password, roles, tenantId. These span reachable helpers and may include fields of internally composed DTOs; they are not a mandatory field list or complete wire schema. Match to the entry DTO and workflow before constructing requests.

## API-DCE136B1

**DELETE /api/users/:id** - UsersController.remove

- Entry/auth: AuthGuard('jwt'); RolesGuard; fallback roles: SUPER_ADMIN, COMPANY_ADMIN.
- Inputs: `@CurrentUser() user: RequestUser`; `@Param('id') id: string`.
- Output: JSON returned from delegated service; inferred fields in linked implementation. Inferred by TypeScript; no explicit response DTO.
- Behavior: Command (may mutate); detected reachable writes: auditLog.create, user.delete.
- Tenant/role/state/validation helper candidates: assertAdmin.
- Error branch candidates: BadRequestException: 'You cannot delete your own account.'); BadRequestException: 'Platform administrator removal is protected.'); BadRequestException: 'Keep at least one active Company Admin for this company.'); BadRequestException: `${target.firstName} ${target.lastName} has work recorded in the system (${recorded} item${recorded === 1 ? '' : 's'} such as enquiries, KYC reviews or comments), so the account cannot be deleted without losing the audit; ForbiddenException: 'Only administrators can manage users.'); ForbiddenException: 'A company administrator must belong to a company.'); NotFoundException: 'User not found.'); ForbiddenException: 'Company administrators cannot manage platform administrators.').
- Evidence: [backend/src/users/users.controller.ts:33](../../backend/src/users/users.controller.ts#L33).
- Logic chain: UsersService.remove [backend/src/users/users.service.ts:115](../../backend/src/users/users.service.ts#L115); UsersService.assertAdmin [backend/src/users/users.service.ts:18](../../backend/src/users/users.service.ts#L18); UsersService.scopedTarget [backend/src/users/users.service.ts:38](../../backend/src/users/users.service.ts#L38).
- QA: apply Q-API for this ID and its workflow-specific cases; store status/body/DB diff with secrets removed.
- DTO field-access candidates: none resolved. These span reachable helpers and may include fields of internally composed DTOs; they are not a mandatory field list or complete wire schema. Match to the entry DTO and workflow before constructing requests.

## API-08AE14DF

**PATCH /api/users/:id** - UsersController.update

- Entry/auth: AuthGuard('jwt'); RolesGuard; fallback roles: SUPER_ADMIN, COMPANY_ADMIN.
- Inputs: `@CurrentUser() user: RequestUser`; `@Param('id') id: string`; `@Body() dto: UpdateUserDto`.
- Output: JSON returned from delegated service; inferred fields in linked implementation. Inferred by TypeScript; no explicit response DTO.
- Behavior: Command (may mutate); detected reachable writes: userRole.deleteMany, user.update, auditLog.create.
- Tenant/role/state/validation helper candidates: assertAdmin.
- Error branch candidates: BadRequestException: 'You cannot suspend your own account or change your own roles.'); BadRequestException: 'Keep at least one active Company Admin for this company.'); BadRequestException: 'Platform administrator removal is protected.'); ForbiddenException: 'Only administrators can manage users.'); ForbiddenException: 'A company administrator must belong to a company.'); NotFoundException: 'User not found.'); ForbiddenException: 'Company administrators cannot manage platform administrators.'); BadRequestException: 'Select valid workflow roles.'); ForbiddenException: 'Only a Super Admin can assign the Super Admin role.'); BadRequestException: 'A selected role is not configured. Contact the platform administrator.'); ConflictException: 'An account with that email address already exists.').
- Evidence: [backend/src/users/users.controller.ts:29](../../backend/src/users/users.controller.ts#L29).
- Logic chain: UsersService.update [backend/src/users/users.service.ts:84](../../backend/src/users/users.service.ts#L84); UsersService.assertAdmin [backend/src/users/users.service.ts:18](../../backend/src/users/users.service.ts#L18); UsersService.scopedTarget [backend/src/users/users.service.ts:38](../../backend/src/users/users.service.ts#L38); UsersService.assignedRoles [backend/src/users/users.service.ts:45](../../backend/src/users/users.service.ts#L45); UsersService.duplicateEmail [backend/src/users/users.service.ts:59](../../backend/src/users/users.service.ts#L59).
- QA: apply Q-API for this ID and its workflow-specific cases; store status/body/DB diff with secrets removed.
- DTO field-access candidates: email, firstName, lastName, roles, status. These span reachable helpers and may include fields of internally composed DTOs; they are not a mandatory field list or complete wire schema. Match to the entry DTO and workflow before constructing requests.

## API-6D874D05

**POST /api/users/:id/reset-password** - UsersController.resetPassword

- Entry/auth: AuthGuard('jwt'); RolesGuard; fallback roles: SUPER_ADMIN, COMPANY_ADMIN.
- Inputs: `@CurrentUser() user: RequestUser`; `@Param('id') id: string`; `@Body() dto: ResetUserPasswordDto`.
- Output: JSON returned from delegated service; inferred fields in linked implementation. Inferred by TypeScript; no explicit response DTO.
- Behavior: Command (may mutate); detected reachable writes: user.update, auditLog.create.
- Tenant/role/state/validation helper candidates: assertAdmin.
- Error branch candidates: ForbiddenException: 'Only administrators can manage users.'); ForbiddenException: 'A company administrator must belong to a company.'); NotFoundException: 'User not found.'); ForbiddenException: 'Company administrators cannot manage platform administrators.'); BadRequestException: policyError).
- Evidence: [backend/src/users/users.controller.ts:37](../../backend/src/users/users.controller.ts#L37).
- Logic chain: UsersService.resetPassword [backend/src/users/users.service.ts:145](../../backend/src/users/users.service.ts#L145); UsersService.assertAdmin [backend/src/users/users.service.ts:18](../../backend/src/users/users.service.ts#L18); UsersService.scopedTarget [backend/src/users/users.service.ts:38](../../backend/src/users/users.service.ts#L38); UsersService.passwordHash [backend/src/users/users.service.ts:53](../../backend/src/users/users.service.ts#L53).
- QA: apply Q-API for this ID and its workflow-specific cases; store status/body/DB diff with secrets removed.
- DTO field-access candidates: password. These span reachable helpers and may include fields of internally composed DTOs; they are not a mandatory field list or complete wire schema. Match to the entry DTO and workflow before constructing requests.

## API-95D8FFEA

**GET /api/users/options** - UsersController.options

- Entry/auth: AuthGuard('jwt'); RolesGuard; fallback roles: SUPER_ADMIN, COMPANY_ADMIN.
- Inputs: `@CurrentUser() user: RequestUser`.
- Output: JSON returned from delegated service; inferred fields in linked implementation. Inferred by TypeScript; no explicit response DTO.
- Behavior: Read candidate (static scan only); detected reachable writes: none detected.
- Tenant/role/state/validation helper candidates: assertAdmin.
- Error branch candidates: ForbiddenException: 'Only administrators can manage users.'); ForbiddenException: 'A company administrator must belong to a company.').
- Evidence: [backend/src/users/users.controller.ts:21](../../backend/src/users/users.controller.ts#L21).
- Logic chain: UsersService.options [backend/src/users/users.service.ts:29](../../backend/src/users/users.service.ts#L29); UsersService.assertAdmin [backend/src/users/users.service.ts:18](../../backend/src/users/users.service.ts#L18).
- QA: apply Q-API for this ID and its workflow-specific cases; store status/body/DB diff with secrets removed.
- DTO field-access candidates: none resolved. These span reachable helpers and may include fields of internally composed DTOs; they are not a mandatory field list or complete wire schema. Match to the entry DTO and workflow before constructing requests.

## Request DTO contracts

Global ValidationPipe uses whitelist, forbidNonWhitelisted and transform. These decorators apply to concrete DTO classes, not erased TypeScript Record bodies. Optionality here is transport-level, not necessarily workflow completeness.

### AddEnquiryCommentDto

[backend/src/enquiries/dto/update-enquiry.dto.ts:98](../../backend/src/enquiries/dto/update-enquiry.dto.ts#L98)

| Field | Type | Validation decorators |
|---|---|---|
| body | string | @IsString() |

### AddRoleDto

[backend/src/compliance-clients/dto/client-records.dto.ts:41](../../backend/src/compliance-clients/dto/client-records.dto.ts#L41)

| Field | Type | Validation decorators |
|---|---|---|
| role | (typeof ROLE_TYPES)[number] | @IsIn(ROLE_TYPES) |
| title? | string | @IsOptional() @IsString() @MaxLength(100) |
| percentage? | string | @IsOptional() @IsString() @MaxLength(10) |
| viaPersonId? | string | @IsOptional() @IsString() @MaxLength(100) |

### AddWorkflowCommentDto

[backend/src/kyc/dto/add-workflow-comment.dto.ts:3](../../backend/src/kyc/dto/add-workflow-comment.dto.ts#L3)

| Field | Type | Validation decorators |
|---|---|---|
| body | string | @IsString() |

### AllocateStaffDto

[backend/src/compliance-clients/dto/client-records.dto.ts:91](../../backend/src/compliance-clients/dto/client-records.dto.ts#L91)

| Field | Type | Validation decorators |
|---|---|---|
| userId | string | @IsString() @MaxLength(100) |

### AssignServiceDto

[backend/src/kyc/dto/assign-service.dto.ts:3](../../backend/src/kyc/dto/assign-service.dto.ts#L3)

| Field | Type | Validation decorators |
|---|---|---|
| serviceId? | string | @IsOptional() @IsString() |
| serviceName? | string | @IsOptional() @IsString() |
| description? | string | @IsOptional() @IsString() |

### AssignTenantModuleDto

[backend/src/tenant-modules/dto/assign-tenant-module.dto.ts:3](../../backend/src/tenant-modules/dto/assign-tenant-module.dto.ts#L3)

| Field | Type | Validation decorators |
|---|---|---|
| tenantId | string | @IsString() |
| moduleId | string | @IsString() |
| isEnabled | boolean | @IsBoolean() |

### CancelDto

[backend/src/compliance-clients/dto/compliance-monitoring.dto.ts:100](../../backend/src/compliance-clients/dto/compliance-monitoring.dto.ts#L100)

| Field | Type | Validation decorators |
|---|---|---|
| reason? | string | @IsOptional() @IsString() @MaxLength(1000) |

### ChangePasswordDto

[backend/src/auth/dto/change-password.dto.ts:4](../../backend/src/auth/dto/change-password.dto.ts#L4)

| Field | Type | Validation decorators |
|---|---|---|
| currentPassword | string | @IsString() @MinLength(1) @MaxLength(256) |
| newPassword | string | @IsString() @MaxLength(PASSWORD_MAX_BYTES, { message: PASSWORD_RULE_MESSAGE }) @Matches(PASSWORD_PATTERN, { message: PASSWORD_RULE_MESSAGE }) |
| confirmPassword | string | @IsString() @MinLength(1) @MaxLength(PASSWORD_MAX_BYTES, { message: PASSWORD_RULE_MESSAGE }) |

### CompleteReviewDto

[backend/src/compliance-clients/dto/compliance-monitoring.dto.ts:74](../../backend/src/compliance-clients/dto/compliance-monitoring.dto.ts#L74)

| Field | Type | Validation decorators |
|---|---|---|
| outcome | 'NO_CHANGE' \| 'RISK_CHANGE_REQUESTED' \| 'EXIT_RECOMMENDED' | @IsIn(['NO_CHANGE', 'RISK_CHANGE_REQUESTED', 'EXIT_RECOMMENDED']) |
| findings | string | @IsString() @MaxLength(6000) |
| proposedRisk? | (typeof RISK_LEVELS)[number] | @IsOptional() @IsIn(RISK_LEVELS) |
| proposedCdd? | (typeof CDD_TYPES)[number] | @IsOptional() @IsIn(CDD_TYPES) |
| reasonCategory? | (typeof RISK_REASONS)[number] | @IsOptional() @IsIn(RISK_REASONS) |
| explanation? | string | @IsOptional() @IsString() @MaxLength(4000) |

### CreateClientContactDto

[backend/src/clients/dto/create-client.dto.ts:4](../../backend/src/clients/dto/create-client.dto.ts#L4)

| Field | Type | Validation decorators |
|---|---|---|
| name | string | @IsString() |
| email? | string | @IsOptional() @IsEmail() |
| phone? | string | @IsOptional() @IsString() |
| position? | string | @IsOptional() @IsString() |

### CreateClientDto

[backend/src/clients/dto/create-client.dto.ts:21](../../backend/src/clients/dto/create-client.dto.ts#L21)

| Field | Type | Validation decorators |
|---|---|---|
| name | string | @IsString() |
| registrationNumber? | string | @IsOptional() @IsString() |
| industry? | string | @IsOptional() @IsString() |
| country? | string | @IsOptional() @IsString() |
| contacts? | CreateClientContactDto[] | @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => CreateClientContactDto) |

### CreateDocumentSectionDto

[backend/src/compliance-clients/dto/client-document.dto.ts:28](../../backend/src/compliance-clients/dto/client-document.dto.ts#L28)

| Field | Type | Validation decorators |
|---|---|---|
| title | string | @IsString() @MaxLength(120) |
| description? | string | @IsOptional() @IsString() @MaxLength(300) |

### CreateEnquiryAttachmentDto

[backend/src/enquiries/dto/create-enquiry.dto.ts:5](../../backend/src/enquiries/dto/create-enquiry.dto.ts#L5)

| Field | Type | Validation decorators |
|---|---|---|
| documentType | string | @IsString() |
| fileName | string | @IsString() |
| storagePath? | string | @IsOptional() @IsString() |
| mimeType? | string | @IsOptional() @IsString() |
| size? | number | @IsOptional() |

### CreateEnquiryDto

[backend/src/enquiries/dto/create-enquiry.dto.ts:24](../../backend/src/enquiries/dto/create-enquiry.dto.ts#L24)

| Field | Type | Validation decorators |
|---|---|---|
| enquiryType | EnquiryType | @IsEnum(EnquiryType) |
| clientId? | string | @IsOptional() @IsString() |
| companyName? | string | @IsOptional() @IsString() |
| proposedCompanyName? | string | @IsOptional() @IsString() |
| requestedServices? | string[] | @IsOptional() @IsArray() @IsString({ each: true }) |
| keyContactName? | string | @IsOptional() @IsString() |
| keyContactEmail? | string | @IsOptional() @IsEmail() |
| keyContactPhone? | string | @IsOptional() @IsString() |
| keyContactPosition? | string | @IsOptional() @IsString() |
| headOfficeCountry? | string | @IsOptional() @IsString() |
| branchCountry? | string | @IsOptional() @IsString() |
| areaOfOperation? | string | @IsOptional() @IsString() |
| details? | Record<string, unknown> | @IsOptional() @IsObject() |
| notes? | string | @IsOptional() @IsString() |
| attachments? | CreateEnquiryAttachmentDto[] | @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => CreateEnquiryAttachmentDto) |

### CreateKycCaseDto

[backend/src/kyc/dto/create-kyc-case.dto.ts:3](../../backend/src/kyc/dto/create-kyc-case.dto.ts#L3)

| Field | Type | Validation decorators |
|---|---|---|
| clientId | string | @IsString() |
| title? | string | @IsOptional() @IsString() |
| serviceName? | string | @IsOptional() @IsString() |

### CreateLegalDocumentDto

[backend/src/compliance-clients/dto/legal-document.dto.ts:15](../../backend/src/compliance-clients/dto/legal-document.dto.ts#L15)

| Field | Type | Validation decorators |
|---|---|---|
| typeKey | string | @IsString() @MaxLength(40) |
| typeLabel? | string | @IsOptional() @IsString() @MaxLength(150) |
| nature? | 'COMPANY' \| 'INDIVIDUAL' | @IsOptional() @IsIn(['COMPANY', 'INDIVIDUAL']) |
| replacesId? | string | @IsOptional() @IsString() @MaxLength(100) |
| readMethod? | 'MANUAL' \| 'LOCAL' \| 'AI' | @IsOptional() @IsIn(['MANUAL', 'LOCAL', 'AI']) |
| kycDocumentId? | string | @IsOptional() @IsString() @MaxLength(100) |

### CreatePersonDto

[backend/src/compliance-clients/dto/client-records.dto.ts:19](../../backend/src/compliance-clients/dto/client-records.dto.ts#L19)

| Field | Type | Validation decorators |
|---|---|---|
| partyType | 'INDIVIDUAL' \| 'CORPORATE' | @IsIn(['INDIVIDUAL', 'CORPORATE']) |
| fullName | string | @IsString() @MaxLength(300) |
| role | (typeof ROLE_TYPES)[number] | @IsIn(ROLE_TYPES) |
| title? | string | @IsOptional() @IsString() @MaxLength(100) |
| percentage? | string | @IsOptional() @IsString() @MaxLength(10) |

### CreateScreeningDto

[backend/src/compliance-clients/dto/compliance-monitoring.dto.ts:19](../../backend/src/compliance-clients/dto/compliance-monitoring.dto.ts#L19)

| Field | Type | Validation decorators |
|---|---|---|
| screenedAt | string | @IsDateString() |
| result | (typeof SCREENING_RESULTS)[number] | @IsIn(SCREENING_RESULTS) |
| summary | string | @IsString() @MaxLength(4000) |
| scope? | string | @IsOptional() @IsString() @MaxLength(500) |
| listsChecked? | string[] | @IsOptional() @Transform(toList) @IsArray() @ArrayMaxSize(SCREENING_LISTS.length) @IsIn(SCREENING_LISTS, { each: true }) |
| reviewId? | string | @IsOptional() @IsString() @MaxLength(64) |

### CreateTenantDto

[backend/src/tenants/dto/create-tenant.dto.ts:3](../../backend/src/tenants/dto/create-tenant.dto.ts#L3)

| Field | Type | Validation decorators |
|---|---|---|
| name | string | @IsString() @MinLength(2) |
| slug | string | @IsString() @MinLength(2) |
| isActive? | boolean | @IsOptional() @IsBoolean() |

### CreateUserDto

[backend/src/users/dto/manage-user.dto.ts:32](../../backend/src/users/dto/manage-user.dto.ts#L32)

| Field | Type | Validation decorators |
|---|---|---|
| password | string | @IsString() @MaxLength(PASSWORD_MAX_BYTES, { message: PASSWORD_RULE_MESSAGE }) @Matches(PASSWORD_PATTERN, { message: PASSWORD_RULE_MESSAGE }) |
| tenantId? | string | @IsOptional() @IsUUID() |

### DecideRiskChangeDto

[backend/src/compliance-clients/dto/compliance-monitoring.dto.ts:64](../../backend/src/compliance-clients/dto/compliance-monitoring.dto.ts#L64)

| Field | Type | Validation decorators |
|---|---|---|
| decision | 'APPROVE' \| 'REJECT' | @IsIn(['APPROVE', 'REJECT']) |
| note? | string | @IsOptional() @IsString() @MaxLength(2000) |

### DeleteClientDocumentDto

[backend/src/compliance-clients/dto/client-document.dto.ts:21](../../backend/src/compliance-clients/dto/client-document.dto.ts#L21)

| Field | Type | Validation decorators |
|---|---|---|
| reason? | string | @IsOptional() @IsString() @MaxLength(1000) |

### LegalDocumentFieldsDto

[backend/src/compliance-clients/dto/legal-document.dto.ts:5](../../backend/src/compliance-clients/dto/legal-document.dto.ts#L5)

| Field | Type | Validation decorators |
|---|---|---|
| personId? | string | @IsOptional() @IsString() @MaxLength(100) |
| documentNumber? | string \| null | @IsOptional() @ValidateIf((dto: LegalDocumentFieldsDto) => dto.documentNumber !== null) @IsString() @MaxLength(100) |
| holderName? | string | @IsOptional() @IsString() @MaxLength(300) |
| location? | string \| null | @IsOptional() @ValidateIf((dto: LegalDocumentFieldsDto) => dto.location !== null) @IsString() @MaxLength(100) |
| issueDate? | string \| null | @IsOptional() @ValidateIf((dto: LegalDocumentFieldsDto) => dto.issueDate !== null) @IsString() @MaxLength(10) |
| expiryDate? | string \| null | @IsOptional() @ValidateIf((dto: LegalDocumentFieldsDto) => dto.expiryDate !== null) @IsString() @MaxLength(10) |
| notes? | string \| null | @IsOptional() @ValidateIf((dto: LegalDocumentFieldsDto) => dto.notes !== null) @IsString() @MaxLength(1000) |

### LinkKycIdentityDocumentDto

[backend/src/compliance-clients/dto/client-records.dto.ts:131](../../backend/src/compliance-clients/dto/client-records.dto.ts#L131)

| Field | Type | Validation decorators |
|---|---|---|
| legalDocumentId | string | @IsString() @MaxLength(100) |

### LoginDto

[backend/src/auth/dto/login.dto.ts:4](../../backend/src/auth/dto/login.dto.ts#L4)

| Field | Type | Validation decorators |
|---|---|---|
| email | string | @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim().toLowerCase() : value) @IsEmail() |
| password | string | @IsString() @MinLength(8) |

### PassportDto

[backend/src/compliance-clients/dto/client-records.dto.ts:75](../../backend/src/compliance-clients/dto/client-records.dto.ts#L75)

| Field | Type | Validation decorators |
|---|---|---|
| passportNumber | string | @IsString() @MaxLength(100) |
| issuingCountry? | string | @IsOptional() @IsString() @MaxLength(100) |
| expiryDate? | string | @IsOptional() @IsString() @MaxLength(10) |

### ReadIdentityDocumentDto

[backend/src/compliance-clients/dto/profile-edit.dto.ts:6](../../backend/src/compliance-clients/dto/profile-edit.dto.ts#L6)

| Field | Type | Validation decorators |
|---|---|---|
| identityType | 'QID' \| 'PASSPORT' | @IsIn(['QID', 'PASSPORT']) |

### ReadLegalDocumentDto

[backend/src/compliance-clients/dto/legal-document.dto.ts:29](../../backend/src/compliance-clients/dto/legal-document.dto.ts#L29)

| Field | Type | Validation decorators |
|---|---|---|
| typeKey | string | @IsString() @MaxLength(40) |

### RemoveLegalDocumentDto

[backend/src/compliance-clients/dto/legal-document.dto.ts:33](../../backend/src/compliance-clients/dto/legal-document.dto.ts#L33)

| Field | Type | Validation decorators |
|---|---|---|
| reason | string | @IsString() @MaxLength(1000) |

### RemoveRecordDto

[backend/src/compliance-clients/dto/client-records.dto.ts:97](../../backend/src/compliance-clients/dto/client-records.dto.ts#L97)

| Field | Type | Validation decorators |
|---|---|---|
| reason? | string | @IsOptional() @IsString() @MaxLength(500) |

### RequestRiskChangeDto

[backend/src/compliance-clients/dto/compliance-monitoring.dto.ts:48](../../backend/src/compliance-clients/dto/compliance-monitoring.dto.ts#L48)

| Field | Type | Validation decorators |
|---|---|---|
| proposedRisk | (typeof RISK_LEVELS)[number] | @IsIn(RISK_LEVELS) |
| proposedCdd? | (typeof CDD_TYPES)[number] | @IsOptional() @IsIn(CDD_TYPES) |
| reasonCategory | (typeof RISK_REASONS)[number] | @IsIn(RISK_REASONS) |
| explanation | string | @IsString() @MaxLength(4000) |

### ResendLoginCodeDto

[backend/src/auth/dto/login-otp.dto.ts:14](../../backend/src/auth/dto/login-otp.dto.ts#L14)

| Field | Type | Validation decorators |
|---|---|---|
| challengeId | string | @IsUUID() |

### ResetUserPasswordDto

[backend/src/users/dto/manage-user.dto.ts:48](../../backend/src/users/dto/manage-user.dto.ts#L48)

| Field | Type | Validation decorators |
|---|---|---|
| password | string | @IsString() @MaxLength(PASSWORD_MAX_BYTES, { message: PASSWORD_RULE_MESSAGE }) @Matches(PASSWORD_PATTERN, { message: PASSWORD_RULE_MESSAGE }) |

### SaveAiSettingsDto

[backend/src/ai-settings/ai-settings.controller.ts:10](../../backend/src/ai-settings/ai-settings.controller.ts#L10)

| Field | Type | Validation decorators |
|---|---|---|
| apiKey? | string | @IsOptional() @IsString() @MaxLength(300) |
| model? | string | @IsOptional() @IsString() @MaxLength(80) |
| enabled? | boolean | @IsOptional() @IsBoolean() |

### SaveExpiryItemDto

[backend/src/compliance-clients/dto/compliance-monitoring.dto.ts:107](../../backend/src/compliance-clients/dto/compliance-monitoring.dto.ts#L107)

| Field | Type | Validation decorators |
|---|---|---|
| documentType | (typeof EXPIRY_TYPES)[number] | @IsIn(EXPIRY_TYPES) |
| documentLabel? | string | @IsOptional() @IsString() @MaxLength(120) |
| holderName | string | @IsString() @MaxLength(200) |
| holderRole? | string | @IsOptional() @IsString() @MaxLength(80) |
| documentNumber? | string | @IsOptional() @IsString() @MaxLength(80) |
| expiryDate | string | @IsDateString() |
| notes? | string | @IsOptional() @IsString() @MaxLength(1000) |
| isActive? | boolean | @IsOptional() @IsBoolean() |

### UpdateClientContactDto

[backend/src/clients/dto/update-client.dto.ts:4](../../backend/src/clients/dto/update-client.dto.ts#L4)

| Field | Type | Validation decorators |
|---|---|---|
| name | string | @IsString() |
| email? | string | @IsOptional() @IsEmail() |
| phone? | string | @IsOptional() @IsString() |
| position? | string | @IsOptional() @IsString() |

### UpdateClientDto

[backend/src/clients/dto/update-client.dto.ts:21](../../backend/src/clients/dto/update-client.dto.ts#L21)

| Field | Type | Validation decorators |
|---|---|---|
| name? | string | @IsOptional() @IsString() |
| registrationNumber? | string | @IsOptional() @IsString() |
| industry? | string | @IsOptional() @IsString() |
| country? | string | @IsOptional() @IsString() |
| contacts? | UpdateClientContactDto[] | @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => UpdateClientContactDto) |

### UpdateComplianceClientDto

[backend/src/compliance-clients/dto/update-compliance-client.dto.ts:3](../../backend/src/compliance-clients/dto/update-compliance-client.dto.ts#L3)

| Field | Type | Validation decorators |
|---|---|---|
| name? | string | @IsOptional() @IsString() @MaxLength(200) |
| clientCode? | string | @IsOptional() @IsString() @MaxLength(40) |
| registrationNumber? | string | @IsOptional() @IsString() @MaxLength(100) |
| country? | string | @IsOptional() @IsString() @MaxLength(100) |
| industry? | string | @IsOptional() @IsString() @MaxLength(200) |
| cddType? | 'SIMPLIFIED' \| 'REGULAR' \| 'ENHANCED' \| 'NONE' | @IsOptional() @IsIn(['SIMPLIFIED', 'REGULAR', 'ENHANCED', 'NONE']) |
| jurisdiction? | 'QFC' \| 'MOCI' \| 'QFZ' \| 'OTHER' \| 'NONE' | @IsOptional() @IsIn(['QFC', 'MOCI', 'QFZ', 'OTHER', 'NONE']) |
| email? | string | @IsOptional() @ValidateIf((dto: UpdateComplianceClientDto) => Boolean(dto.email?.trim())) @IsEmail() @MaxLength(254) |
| phone? | string | @IsOptional() @IsString() @MaxLength(40) |
| address? | string | @IsOptional() @IsString() @MaxLength(500) |
| status? | 'ACTIVE' \| 'INACTIVE' | @IsOptional() @IsIn(['ACTIVE', 'INACTIVE']) |
| statusReason? | string | @IsOptional() @IsString() @MaxLength(1000) |

### UpdateDocumentSectionDto

[backend/src/compliance-clients/dto/client-document.dto.ts:39](../../backend/src/compliance-clients/dto/client-document.dto.ts#L39)

| Field | Type | Validation decorators |
|---|---|---|
| title? | string | @IsOptional() @IsString() @MaxLength(120) |
| description? | string | @IsOptional() @IsString() @MaxLength(300) |
| isActive? | boolean | @IsOptional() @Transform(({ value }) => (value === 'true' ? true : value === 'false' ? false : value)) @IsBoolean() |

### UpdateEnquiryAttachmentDto

[backend/src/enquiries/dto/update-enquiry.dto.ts:5](../../backend/src/enquiries/dto/update-enquiry.dto.ts#L5)

| Field | Type | Validation decorators |
|---|---|---|
| documentType | string | @IsString() |
| fileName | string | @IsString() |
| storagePath? | string | @IsOptional() @IsString() |
| mimeType? | string | @IsOptional() @IsString() |
| size? | number | @IsOptional() |

### UpdateEnquiryDto

[backend/src/enquiries/dto/update-enquiry.dto.ts:24](../../backend/src/enquiries/dto/update-enquiry.dto.ts#L24)

| Field | Type | Validation decorators |
|---|---|---|
| enquiryType? | EnquiryType | @IsOptional() @IsEnum(EnquiryType) |
| clientId? | string \| null | @IsOptional() @IsString() |
| companyName? | string | @IsOptional() @IsString() |
| proposedCompanyName? | string | @IsOptional() @IsString() |
| requestedServices? | string[] | @IsOptional() @IsArray() @IsString({ each: true }) |
| keyContactName? | string | @IsOptional() @IsString() |
| keyContactEmail? | string | @IsOptional() @IsEmail() |
| keyContactPhone? | string | @IsOptional() @IsString() |
| keyContactPosition? | string | @IsOptional() @IsString() |
| headOfficeCountry? | string | @IsOptional() @IsString() |
| branchCountry? | string | @IsOptional() @IsString() |
| areaOfOperation? | string | @IsOptional() @IsString() |
| details? | Record<string, unknown> | @IsOptional() @IsObject() |
| notes? | string | @IsOptional() @IsString() |
| attachments? | UpdateEnquiryAttachmentDto[] | @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => UpdateEnquiryAttachmentDto) |

### UpdateEnquiryStatusDto

[backend/src/enquiries/dto/update-enquiry.dto.ts:89](../../backend/src/enquiries/dto/update-enquiry.dto.ts#L89)

| Field | Type | Validation decorators |
|---|---|---|
| status | EnquiryStatus | @IsEnum(EnquiryStatus) |
| note? | string | @IsOptional() @IsString() |

### UpdateKycCaseDto

[backend/src/kyc/dto/update-kyc-case.dto.ts:3](../../backend/src/kyc/dto/update-kyc-case.dto.ts#L3)

| Field | Type | Validation decorators |
|---|---|---|
| clientId? | string | @IsOptional() @IsString() |
| title? | string | @IsOptional() @IsString() |
| serviceName? | string | @IsOptional() @IsString() |

### UpdateProposalStatusDto

[backend/src/kyc/dto/update-proposal-status.dto.ts:4](../../backend/src/kyc/dto/update-proposal-status.dto.ts#L4)

| Field | Type | Validation decorators |
|---|---|---|
| proposalStatus | ProposalStatus | @IsEnum(ProposalStatus) |
| note? | string | @IsOptional() @IsString() |

### UpdateRecordFieldDto

[backend/src/compliance-clients/dto/client-records.dto.ts:6](../../backend/src/compliance-clients/dto/client-records.dto.ts#L6)

| Field | Type | Validation decorators |
|---|---|---|
| field | string | @IsString() @MaxLength(60) |
| value? | string \| null | @IsOptional() @ValidateIf((dto: UpdateRecordFieldDto) => dto.value !== null) @IsString() @MaxLength(2000) |

### UpdateRoleDto

[backend/src/compliance-clients/dto/client-records.dto.ts:61](../../backend/src/compliance-clients/dto/client-records.dto.ts#L61)

| Field | Type | Validation decorators |
|---|---|---|
| percentage? | string \| null | @IsOptional() @ValidateIf((dto: UpdateRoleDto) => dto.percentage !== null) @IsString() @MaxLength(10) |
| viaPersonId? | string \| null | @IsOptional() @ValidateIf((dto: UpdateRoleDto) => dto.viaPersonId !== null) @IsString() @MaxLength(100) |

### UpdateSelfProfileDto

[backend/src/auth/self-profile.controller.ts:9](../../backend/src/auth/self-profile.controller.ts#L9)

| Field | Type | Validation decorators |
|---|---|---|
| firstName | string | @IsString() @MinLength(1) @MaxLength(80) |
| lastName | string | @IsString() @MinLength(1) @MaxLength(80) |
| bio | string | @IsString() @MaxLength(500) |
| avatarDataUrl | string \| null | @ValidateIf((_object, value) => value !== null) @IsString() @MaxLength(180000) |

### UpdateUserDto

[backend/src/users/dto/manage-user.dto.ts:43](../../backend/src/users/dto/manage-user.dto.ts#L43)

| Field | Type | Validation decorators |
|---|---|---|
| status | 'ACTIVE' \| 'SUSPENDED' | @IsIn(['ACTIVE', 'SUSPENDED']) |

### UploadClientDocumentDto

[backend/src/compliance-clients/dto/client-document.dto.ts:5](../../backend/src/compliance-clients/dto/client-document.dto.ts#L5)

| Field | Type | Validation decorators |
|---|---|---|
| sectionId | string | @IsString() @MaxLength(64) |
| title? | string | @IsOptional() @IsString() @MaxLength(200) |
| notes? | string | @IsOptional() @IsString() @MaxLength(2000) |

### UploadIdentityDocumentDto

[backend/src/compliance-clients/dto/client-records.dto.ts:106](../../backend/src/compliance-clients/dto/client-records.dto.ts#L106)

| Field | Type | Validation decorators |
|---|---|---|
| personId | string | @IsString() @MaxLength(100) |
| identityType | 'QID' \| 'PASSPORT' | @IsIn(['QID', 'PASSPORT']) |
| passportId? | string | @IsOptional() @IsString() @MaxLength(100) |
| documentNumber? | string | @IsOptional() @IsString() @MaxLength(100) |
| expiryDate? | string | @IsOptional() @IsString() @MaxLength(10) |

### UploadLegalDocumentDto

[backend/src/kyc/dto/upload-legal-document.dto.ts:3](../../backend/src/kyc/dto/upload-legal-document.dto.ts#L3)

| Field | Type | Validation decorators |
|---|---|---|
| documentType | string | @IsString() |
| fileName | string | @IsString() |
| storagePath? | string | @IsOptional() @IsString() |
| mimeType? | string | @IsOptional() @IsString() |
| size? | number | @IsOptional() @IsInt() @Min(1) |

### UserProfileDto

[backend/src/users/dto/manage-user.dto.ts:7](../../backend/src/users/dto/manage-user.dto.ts#L7)

| Field | Type | Validation decorators |
|---|---|---|
| firstName | string | @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value) @IsString() @MinLength(1) @MaxLength(100) |
| lastName | string | @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value) @IsString() @MinLength(1) @MaxLength(100) |
| email | string | @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim().toLowerCase() : value) @IsEmail() @MaxLength(254) |
| roles | string[] | @IsArray() @ArrayNotEmpty() @ArrayUnique() @IsIn(MANAGED_ROLES, { each: true }) |

### VerifyLoginCodeDto

[backend/src/auth/dto/login-otp.dto.ts:4](../../backend/src/auth/dto/login-otp.dto.ts#L4)

| Field | Type | Validation decorators |
|---|---|---|
| challengeId | string | @IsUUID() |
| code | string | @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.replace(/\s+/g, '') : value) @IsString() @Matches(/^\d{6}$/, { message: 'Enter the 6-digit code from the email.' }) |

## Persisted status and decision vocabulary

Enum membership alone does not authorize a transition; use service guard and decision tables in WORKFLOWS.

### UserStatus

`ACTIVE`, `INVITED`, `SUSPENDED`

### AuditAction

`CREATE`, `UPDATE`, `DELETE`, `LOGIN`, `LOGOUT`, `ENABLE`, `DISABLE`

### KycCaseStatus

`INQUIRY_RECEIVED`, `PROPOSAL_OPTIONAL`, `LEGAL_DOCUMENTS_PENDING`, `LEGAL_DOCUMENTS_UPLOADED`, `RETURNED_TO_BD`, `SUBMITTED_TO_AML`, `AML_REVIEW_STARTED`, `SUPERVISOR_REVIEW_PENDING`, `SUPERVISOR_REVIEW_IN_PROGRESS`, `SUPERVISOR_ADDITIONAL_INFORMATION_REQUIRED`, `SUPERVISOR_REVIEW_COMPLETED`, `DMLRO_REVIEW_PENDING`, `DMLRO_REVIEW_IN_PROGRESS`, `DMLRO_ADDITIONAL_INFORMATION_REQUIRED`, `DMLRO_REVIEW_COMPLETED`, `MLRO_REVIEW_PENDING`, `MLRO_REVIEW_IN_PROGRESS`, `MLRO_ADDITIONAL_INFORMATION_REQUIRED`, `MLRO_APPROVED`, `MLRO_APPROVED_WITH_CONDITIONS`, `MLRO_REJECTED`, `SEF_DECISION_PENDING`, `SEF_DECISION_IN_PROGRESS`, `SEF_APPROVED`, `SEF_REJECTED`, `FINAL_SIGNATURES_PENDING`, `FINAL_DOCUMENTS_PENDING`, `KYC_FINAL_APPROVED`, `CLIENT_ACTIVATION_PENDING`, `CLIENT_ACTIVE`, `CLIENT_REJECTED`, `CLIENT_ON_HOLD`

### KycCasePurpose

`ONBOARDING`, `REKYC`

### ProposalStatus

`NOT_REQUIRED`, `REQUIRED`, `SENT`, `ACCEPTED`, `REJECTED`

### LegalDocumentStatus

`UPLOADED`, `VERIFIED`, `REJECTED`

### NotificationType

`AML_CASE_SUBMITTED`, `SUPERVISOR_TASK_ASSIGNED`, `SUPERVISOR_REVIEW_COMPLETED`, `DMLRO_TASK_ASSIGNED`, `DMLRO_REVIEW_COMPLETED`, `MLRO_TASK_ASSIGNED`, `ADDITIONAL_INFORMATION_REQUESTED`, `SIGNED_KYC_UPLOADED`, `RISK_CLASSIFICATION_CHANGED`, `MLRO_APPROVAL_COMPLETED`, `MLRO_APPROVAL_WITH_CONDITIONS`, `MLRO_REJECTION`, `SEF_TASK_ASSIGNED`, `SEF_DECISION_COMPLETED`, `CLIENT_READY_FOR_ACTIVATION`, `CLIENT_ACTIVATED`, `GENERAL`, `COMPLIANCE_RISK_CHANGE_REQUESTED`, `COMPLIANCE_RISK_CHANGE_DECIDED`, `COMPLIANCE_REVIEW_DUE`, `COMPLIANCE_DOCUMENT_EXPIRING`, `COMPLIANCE_SCREENING_ALERT`, `COMPLIANCE_LEGAL_DOCUMENT_CHANGED`

### EnquiryType

`EXISTING_LEGAL_ENTITY`, `PROPOSED_COMPANY`, `CURRENT_CLIENT_NEW_SERVICES`

### EnquiryStatus

`DRAFT`, `SUBMITTED_TO_AML_SUPERVISOR`, `RETURNED_TO_BD`, `READY_FOR_KYC`, `CONVERTED_TO_KYC`, `CLOSED`

### KycFormSectionKey

`GENERAL_COMPANY`, `OWNERSHIP`, `MANAGEMENT`, `COMPLIANCE_RISK`, `COMMUNICATION_PERSON`, `REQUIRED_DOCUMENTS`, `CLIENT_DECLARATION`

### KycGeneratedDocumentType

`DOCX`, `PDF`

### RiskClassification

`LOW`, `MEDIUM`, `HIGH`

### CrrfRiskRating

`LOW`, `MEDIUM`, `HIGH`

### DueDiligenceType

`SIMPLIFIED`, `REGULAR`, `ENHANCED`

### ReviewStage

`SUPERVISOR`, `DMLRO`, `MLRO`, `SEF`

### ReviewTaskStatus

`PENDING`, `IN_PROGRESS`, `PAUSED`, `COMPLETED`, `RETURNED`, `CANCELLED`

### ReviewSubmissionStatus

`DRAFT`, `SUBMITTED`, `RETURNED`, `REOPENED`

### ReviewDecision

`APPROVE`, `APPROVE_WITH_CONDITIONS`, `DMLRO_FINAL_APPROVE`, `REJECT`, `REQUEST_ADDITIONAL_INFORMATION`, `RETURN_TO_SUPERVISOR`, `RETURN_TO_DMLRO`, `RETURN_TO_MLRO`, `SEND_TO_SEF`

### ScreeningEntityType

`CLIENT_COMPANY`, `SHAREHOLDER`, `UBO`, `MANAGER`, `MANUAL`

### ScreeningCheckType

`NCTC`, `UN`, `OFAC`, `EU`, `PPO_LIST`, `WORLD_CHECK`, `GOOGLE`, `OTHER`

### ScreeningResultStatus

`NOT_CHECKED`, `CLEAR`, `POTENTIAL_MATCH`, `CONFIRMED_MATCH`, `NEGATIVE_NEWS_FOUND`, `NO_NEGATIVE_NEWS`, `PREVIOUSLY_NEGATIVE_NEWS`, `PREVIOUSLY_VIOLATIONS`

### ScreeningConclusionStatus

`CLEAR`, `NOT_CLEAR`, `NO_SANCTION_FOUND`, `SANCTION_FOUND`

### ScreeningRecordStatus

`DRAFT`, `COMPLETED`

### RiskOverrideReason

`PEP_IDENTIFIED`, `SANCTIONS_FINDING`, `ADVERSE_MEDIA`, `OWNERSHIP_COMPLEXITY`, `COUNTRY_RISK`, `INDUSTRY_RISK`, `SOURCE_OF_FUNDS_CONCERN`, `ENHANCED_MONITORING_REQUIRED`, `PROFESSIONAL_JUDGEMENT`, `OTHER`

### SignedKycDocumentStage

`DMLRO_SIGNED_KYC`, `MLRO_SIGNED_KYC`, `FINAL_SIGNED_KYC`

### ReviewCommentType

`FORMAL`, `CONFIDENTIAL`

### ConfidentialVisibilityScope

`SUPERVISOR_DMLRO_MLRO`, `DMLRO_MLRO`, `MLRO_ONLY`

### ClientJurisdiction

`QFC`, `MOCI`, `QFZ`, `OTHER`

### ClientEngagementStatus

`PENDING`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED`

### ClientDocumentCategory

`CDD`, `MONITORING`, `COMPLIANCE`, `SCREENING`

### ClientScreeningResult

`PENDING`, `CLEAR`, `REVIEW`, `ALERT`

### ClientRiskChangeStatus

`PENDING`, `APPROVED`, `REJECTED`, `CANCELLED`

### ClientReviewStatus

`IN_PROGRESS`, `COMPLETED`, `CANCELLED`

### ClientReviewOutcome

`NO_CHANGE`, `RISK_CHANGE_REQUESTED`, `EXIT_RECOMMENDED`

### ClientExpiryDocumentType

`PASSPORT`, `QID`, `CR`, `TRADE_LICENSE`, `COMPUTER_CARD`, `OTHER`

### ClientPartyType

`INDIVIDUAL`, `CORPORATE`

### ClientPersonRoleType

`SHAREHOLDER`, `UBO`, `DIRECTOR`, `MANAGER`, `SECRETARY`, `SEF`, `AUTHORISED_SIGNATORY`, `KEY_CONTACT`, `CEO`, `CFO`, `COO`, `MANAGING_DIRECTOR`, `GENERAL_MANAGER`, `CHAIRMAN`, `OTHER`

### ClientLegalDocumentNature

`COMPANY`, `INDIVIDUAL`

### ClientLegalDocumentStatus

`CURRENT`, `REPLACED`, `DELETED`

## Data model and relationships

Prisma schema excerpt per model includes scalar fields, relations, cascade behavior and unique/index constraints. No database contents are read. File paths are storage references, not a backup of file bytes.

### Tenant

```prisma
id            String         @id @default(uuid())
name          String
slug          String         @unique
isActive      Boolean        @default(true)
users         User[]
enquiries     Enquiry[]
enquiryAttachments EnquiryAttachment[]
enquiryComments EnquiryComment[]
enquiryStatusHistory EnquiryStatusHistory[]
tenantModules TenantModule[]
clients       Client[]
clientContacts ClientContact[]
clientServices ClientService[]
clientEngagements ClientEngagement[]
clientDocumentSections ClientDocumentSection[]
clientDocuments ClientDocument[]
clientScreenings ClientScreening[]
clientRiskChanges ClientRiskChange[]
clientReviews ClientReview[]
clientExpiryItems ClientExpiryItem[]
complianceReminders ComplianceReminder[]
clientProfileOverrides ClientProfileOverride[]
clientEntityProfiles ClientEntityProfile[]
clientPeople  ClientPerson[]
clientPersonRoles ClientPersonRole[]
clientPersonPassports ClientPersonPassport[]
clientLegalDocuments ClientLegalDocument[]
aiSetting     TenantAiSetting?
clientAllocations ClientAllocation[]
kycCases      KycCase[]
documents     Document[]
legalDocuments LegalDocument[]
workflowComments WorkflowComment[]
approvals     Approval[]
notifications Notification[]
kycForms      KycForm[]
kycSectionData KycSectionData[]
kycShareholders KycShareholder[]
kycUbos       KycUbo[]
kycManagers   KycManager[]
kycRequiredDocuments KycRequiredDocument[]
kycInternalReviews KycInternalReview[]
internalReviewTasks InternalReviewTask[]
internalReviewSubmissions InternalReviewSubmission[]
internalReviewVersions InternalReviewVersion[]
reviewerComments ReviewerComment[]
signedKycDocuments SignedKycDocument[]
riskReclassifications RiskReclassification[]
clientActivationChecklists ClientActivationChecklist[]
kycGeneratedDocuments KycGeneratedDocument[]
screeningRecords ScreeningRecord[]
screeningCaseChecks ScreeningCaseCheck[]
screeningCaseDocuments ScreeningCaseDocument[]
screeningChecks ScreeningCheck[]
screeningDocuments ScreeningDocument[]
crrfRecords CrrfRecord[]
crrfDocuments CrrfDocument[]
statusHistory KycCaseStatusHistory[]
auditLogs     AuditLog[]
createdAt     DateTime       @default(now())
updatedAt     DateTime       @updatedAt
```

### User

```prisma
profile UserProfile?
id           String         @id @default(uuid())
tenantId     String?
tenant       Tenant?        @relation(fields: [tenantId], references: [id])
email        String         @unique
passwordHash String
firstName    String
lastName     String
status       UserStatus     @default(ACTIVE)
// Login protection: consecutive failed sign-ins, temporary lockout, and a version that ends all sessions when raised.
failedLoginCount           Int                        @default(0)
lockedUntil                DateTime?
sessionVersion             Int                        @default(0)
loginChallenges            LoginChallenge[]
roles        UserRole[]
auditLogs    AuditLog[]
createdEnquiries Enquiry[] @relation("EnquiryCreator")
enquiryComments EnquiryComment[] @relation("EnquiryCommentAuthor")
enquiryStatusHistory EnquiryStatusHistory[] @relation("EnquiryStatusChangedBy")
createdCases KycCase[]      @relation("KycCaseCreator")
assignedCases KycCase[]     @relation("KycCaseAssignee")
uploadedDocuments LegalDocument[] @relation("LegalDocumentUploader")
comments     WorkflowComment[]
notifications Notification[]
statusHistory KycCaseStatusHistory[]
createdKycForms KycForm[] @relation("KycFormCreatedBy")
updatedKycForms KycForm[] @relation("KycFormUpdatedBy")
assignedReviewTasks InternalReviewTask[] @relation("InternalReviewTaskAssignee")
submittedInternalReviews InternalReviewSubmission[] @relation("InternalReviewSubmittedBy")
reviewerComments ReviewerComment[] @relation("ReviewerCommentAuthor")
uploadedSignedKycDocuments SignedKycDocument[] @relation("SignedKycDocumentUploader")
riskReclassifications RiskReclassification[] @relation("RiskReclassificationUser")
createdClientEngagements ClientEngagement[] @relation("ClientEngagementCreator")
clientAllocations ClientAllocation[] @relation("ClientAllocationUser")
uploadedClientDocuments ClientDocument[] @relation("ClientDocumentUploader")
performedClientScreenings ClientScreening[] @relation("ClientScreeningPerformer")
requestedClientRiskChanges ClientRiskChange[] @relation("ClientRiskChangeRequester")
decidedClientRiskChanges ClientRiskChange[] @relation("ClientRiskChangeDecider")
startedClientReviews ClientReview[] @relation("ClientReviewStarter")
completedClientReviews ClientReview[] @relation("ClientReviewCompleter")
createdAt    DateTime       @default(now())
updatedAt    DateTime       @updatedAt
```

### UserProfile

```prisma
userId        String   @id
user          User     @relation(fields: [userId], references: [id], onDelete: Cascade)
bio           String   @default("")
avatarDataUrl String?
updatedAt     DateTime @updatedAt
```

### Enquiry

```prisma
id                  String                 @id @default(uuid())
tenantId            String
tenant              Tenant                 @relation(fields: [tenantId], references: [id], onDelete: Cascade)
enquiryCode         String
enquiryType         EnquiryType
status              EnquiryStatus          @default(DRAFT)
clientId            String?
client              Client?                @relation(fields: [clientId], references: [id], onDelete: SetNull)
companyName         String?
proposedCompanyName String?
requestedServices   String[]               @default([])
keyContactName      String?
keyContactEmail     String?
keyContactPhone     String?
keyContactPosition  String?
headOfficeCountry   String?
branchCountry       String?
areaOfOperation     String?
details             Json?
notes               String?
createdById         String?
createdBy           User?                  @relation("EnquiryCreator", fields: [createdById], references: [id], onDelete: SetNull)
attachments         EnquiryAttachment[]
comments            EnquiryComment[]
statusHistory       EnquiryStatusHistory[]
notifications       Notification[]
generatedKycCases   KycCase[]              @relation("EnquiryGeneratedKycCases")
createdAt           DateTime               @default(now())
updatedAt           DateTime               @updatedAt
@@unique([tenantId, enquiryCode])
@@index([tenantId])
@@index([clientId])
@@index([status])
@@index([enquiryType])
```

### EnquiryAttachment

```prisma
id           String   @id @default(uuid())
tenantId     String
tenant       Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
enquiryId    String
enquiry      Enquiry  @relation(fields: [enquiryId], references: [id], onDelete: Cascade)
documentType String
fileName     String
storagePath  String?
mimeType     String?
size         Int?
createdBy    String?
createdAt    DateTime @default(now())
@@index([tenantId])
@@index([enquiryId])
```

### EnquiryComment

```prisma
id        String   @id @default(uuid())
tenantId  String
tenant    Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
enquiryId String
enquiry   Enquiry  @relation(fields: [enquiryId], references: [id], onDelete: Cascade)
body      String
authorId  String?
author    User?    @relation("EnquiryCommentAuthor", fields: [authorId], references: [id], onDelete: SetNull)
createdAt DateTime @default(now())
@@index([tenantId])
@@index([enquiryId])
@@index([authorId])
```

### EnquiryStatusHistory

```prisma
id          String         @id @default(uuid())
tenantId    String
tenant      Tenant         @relation(fields: [tenantId], references: [id], onDelete: Cascade)
enquiryId   String
enquiry     Enquiry        @relation(fields: [enquiryId], references: [id], onDelete: Cascade)
fromStatus  EnquiryStatus?
toStatus    EnquiryStatus
note        String?
changedById String?
changedBy   User?          @relation("EnquiryStatusChangedBy", fields: [changedById], references: [id], onDelete: SetNull)
createdAt   DateTime       @default(now())
@@index([tenantId])
@@index([enquiryId])
@@index([toStatus])
@@index([changedById])
```

### Role

```prisma
id          String           @id @default(uuid())
name        String           @unique
description String?
users       UserRole[]
permissions RolePermission[]
createdAt   DateTime         @default(now())
updatedAt   DateTime         @updatedAt
```

### Permission

```prisma
id          String           @id @default(uuid())
key         String           @unique
description String?
roles       RolePermission[]
createdAt   DateTime         @default(now())
updatedAt   DateTime         @updatedAt
```

### UserRole

```prisma
id     String @id @default(uuid())
userId String
roleId String
user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)
role   Role   @relation(fields: [roleId], references: [id], onDelete: Cascade)
@@unique([userId, roleId])
```

### RolePermission

```prisma
id           String     @id @default(uuid())
roleId       String
permissionId String
role         Role       @relation(fields: [roleId], references: [id], onDelete: Cascade)
permission   Permission @relation(fields: [permissionId], references: [id], onDelete: Cascade)
@@unique([roleId, permissionId])
```

### Module

```prisma
id            String         @id @default(uuid())
name          String         @unique
key           String         @unique
description   String?
isSystem      Boolean        @default(false)
tenantModules TenantModule[]
createdAt     DateTime       @default(now())
updatedAt     DateTime       @updatedAt
```

### TenantModule

```prisma
id        String   @id @default(uuid())
tenantId  String
moduleId  String
isEnabled Boolean  @default(true)
tenant    Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
module    Module   @relation(fields: [moduleId], references: [id], onDelete: Cascade)
createdAt DateTime @default(now())
updatedAt DateTime @updatedAt
@@unique([tenantId, moduleId])
```

### Client

```prisma
id                 String          @id @default(uuid())
tenantId           String
tenant             Tenant          @relation(fields: [tenantId], references: [id], onDelete: Cascade)
name               String
registrationNumber String?
industry           String?
country            String?
status             String          @default("PROSPECT")
// Compliance register fields, filled when a client is activated through the KYC engagement decision.
clientCode         String?
jurisdiction       ClientJurisdiction?
email              String?
phone              String?
address            String?
cddType            DueDiligenceType?
riskLevel          RiskClassification?
lastReviewDate     DateTime?
nextReviewDate     DateTime?
activatedAt        DateTime?
statusReason       String?
// KYC case whose form is the client's current profile (set on activation and on re-KYC approval).
currentKycCaseId   String?
contacts           ClientContact[]
enquiries          Enquiry[]
kycCases           KycCase[]
screeningRecords   ScreeningRecord[]
engagements        ClientEngagement[]
documents          ClientDocument[]
screenings         ClientScreening[]
riskChanges        ClientRiskChange[]
reviews            ClientReview[]
expiryItems        ClientExpiryItem[]
profileOverrides   ClientProfileOverride[]
entityProfile      ClientEntityProfile?
people             ClientPerson[]
legalDocuments     ClientLegalDocument[]
allocations        ClientAllocation[]
notifications      Notification[]
createdAt          DateTime        @default(now())
updatedAt          DateTime        @updatedAt
@@unique([tenantId, clientCode])
@@index([tenantId])
@@index([tenantId, status])
@@index([nextReviewDate])
```

### ClientDocumentSection

```prisma
id          String                 @id @default(uuid())
tenantId    String
tenant      Tenant                 @relation(fields: [tenantId], references: [id], onDelete: Cascade)
key         String
title       String
description String?
category    ClientDocumentCategory @default(COMPLIANCE)
isSystem    Boolean                @default(false)
isActive    Boolean                @default(true)
sortOrder   Int                    @default(0)
createdById String?
documents   ClientDocument[]
createdAt   DateTime               @default(now())
updatedAt   DateTime               @updatedAt
@@unique([tenantId, key])
@@index([tenantId])
```

### ClientDocument

```prisma
id           String                @id @default(uuid())
tenantId     String
tenant       Tenant                @relation(fields: [tenantId], references: [id], onDelete: Cascade)
clientId     String
client       Client                @relation(fields: [clientId], references: [id], onDelete: Cascade)
sectionId    String
section      ClientDocumentSection @relation(fields: [sectionId], references: [id], onDelete: Restrict)
title        String
notes        String?
fileName     String
storagePath  String
mimeType     String?
size         Int?
uploadedById String?
uploadedBy   User?                 @relation("ClientDocumentUploader", fields: [uploadedById], references: [id], onDelete: SetNull)
screeningId  String?
screening    ClientScreening?      @relation(fields: [screeningId], references: [id], onDelete: SetNull)
// QID / passport copies uploaded from a person's details: personKey is the normalized full name, so the same
// person listed as shareholder and director shares the copies. Number and expiry are those of this copy.
personKey      String?
// The client person this QID / passport copy belongs to (set from 2026-11-22; older copies are linked on first load).
personId       String?
person         ClientPerson?         @relation(fields: [personId], references: [id], onDelete: SetNull)
personName     String?
identityType   String?
documentNumber String?
documentExpiry DateTime?
deletedAt    DateTime?
deletedById  String?
deleteReason String?
createdAt    DateTime              @default(now())
updatedAt    DateTime              @updatedAt
@@index([tenantId])
@@index([clientId, sectionId])
@@index([clientId, personKey])
@@index([personId])
@@index([screeningId])
```

### ClientScreening

```prisma
id            String                @id @default(uuid())
tenantId      String
tenant        Tenant                @relation(fields: [tenantId], references: [id], onDelete: Cascade)
clientId      String
client        Client                @relation(fields: [clientId], references: [id], onDelete: Cascade)
reviewId      String?
review        ClientReview?         @relation(fields: [reviewId], references: [id], onDelete: SetNull)
screenedAt    DateTime
scope         String?
listsChecked  String[]
result        ClientScreeningResult
summary       String
performedById String?
performedBy   User?                 @relation("ClientScreeningPerformer", fields: [performedById], references: [id], onDelete: SetNull)
documents     ClientDocument[]
createdAt     DateTime              @default(now())
updatedAt     DateTime              @updatedAt
@@index([tenantId])
@@index([clientId, screenedAt])
```

### ClientRiskChange

```prisma
id             String                 @id @default(uuid())
tenantId       String
tenant         Tenant                 @relation(fields: [tenantId], references: [id], onDelete: Cascade)
clientId       String
client         Client                 @relation(fields: [clientId], references: [id], onDelete: Cascade)
previousRisk   RiskClassification?
proposedRisk   RiskClassification
previousCdd    DueDiligenceType?
proposedCdd    DueDiligenceType?
reasonCategory RiskOverrideReason
explanation    String
status         ClientRiskChangeStatus @default(PENDING)
requestedById  String?
requestedBy    User?                  @relation("ClientRiskChangeRequester", fields: [requestedById], references: [id], onDelete: SetNull)
decidedById    String?
decidedBy      User?                  @relation("ClientRiskChangeDecider", fields: [decidedById], references: [id], onDelete: SetNull)
decisionNote   String?
decidedAt      DateTime?
review         ClientReview?
createdAt      DateTime               @default(now())
updatedAt      DateTime               @updatedAt
@@index([tenantId, status])
@@index([clientId])
```

### ClientReview

```prisma
id            String               @id @default(uuid())
tenantId      String
tenant        Tenant               @relation(fields: [tenantId], references: [id], onDelete: Cascade)
clientId      String
client        Client               @relation(fields: [clientId], references: [id], onDelete: Cascade)
status        ClientReviewStatus   @default(IN_PROGRESS)
dueDate       DateTime?
riskAtStart   RiskClassification?
outcome       ClientReviewOutcome?
findings      String?
riskChangeId  String?              @unique
riskChange    ClientRiskChange?    @relation(fields: [riskChangeId], references: [id], onDelete: SetNull)
startedById   String?
startedBy     User?                @relation("ClientReviewStarter", fields: [startedById], references: [id], onDelete: SetNull)
completedById String?
completedBy   User?                @relation("ClientReviewCompleter", fields: [completedById], references: [id], onDelete: SetNull)
startedAt     DateTime             @default(now())
completedAt   DateTime?
screenings    ClientScreening[]
createdAt     DateTime             @default(now())
updatedAt     DateTime             @updatedAt
@@index([tenantId, status])
@@index([clientId])
```

### ClientExpiryItem

```prisma
id             String                   @id @default(uuid())
tenantId       String
tenant         Tenant                   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
clientId       String
client         Client                   @relation(fields: [clientId], references: [id], onDelete: Cascade)
documentType   ClientExpiryDocumentType
documentLabel  String?
holderName     String
holderRole     String?
documentNumber String?
expiryDate     DateTime
notes          String?
isActive       Boolean                  @default(true)
// Set on records kept in step with a person's QID / passport expiry on the client profile; null for manual records.
sourceKey      String?
createdById    String?
updatedById    String?
createdAt      DateTime                 @default(now())
updatedAt      DateTime                 @updatedAt
@@unique([clientId, sourceKey])
@@index([tenantId, expiryDate])
@@index([clientId])
```

### ClientProfileOverride

```prisma
id          String   @id @default(uuid())
tenantId    String
tenant      Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
clientId    String
client      Client   @relation(fields: [clientId], references: [id], onDelete: Cascade)
kycCaseId   String
kycCase     KycCase  @relation(fields: [kycCaseId], references: [id], onDelete: Cascade)
section     String
rowId       String   @default("")
// Full name of the row when first edited; matches officer rows whose ids changed after a form re-save.
rowLabel    String?
field       String
value       String?
updatedById String?
createdAt   DateTime @default(now())
updatedAt   DateTime @updatedAt
@@unique([kycCaseId, section, rowId, field])
@@index([tenantId])
@@index([clientId])
```

### ClientEntityProfile

```prisma
id                       String    @id @default(uuid())
tenantId                 String
tenant                   Tenant    @relation(fields: [tenantId], references: [id], onDelete: Cascade)
clientId                 String    @unique
client                   Client    @relation(fields: [clientId], references: [id], onDelete: Cascade)
legalName                String?
legalForm                String?
commercialRegistrationNo String?
crExpiryDate             DateTime?
dateOfIncorporation      DateTime?
countryOfIncorporation   String?
placeOfIncorporation     String?
registeredOfficeAddress  String?
shareCapital             String?
taxIdentificationNo      String?
poBox                    String?
telephone                String?
email                    String?
website                  String?
businessNature           String?
relatedIndustry          String?
licenseActivities        String?
prospectiveServices      String?
financialYearEnd         String?
auditorName              String?
// KYC case the KYC-held fields were last taken from.
sourceKycCaseId          String?
// Field name -> ISO time of the last edit on the client page; a later re-KYC approval keeps those values.
fieldEditedAt            Json      @default("{
```

### ClientPerson

```prisma
id                    String                 @id @default(uuid())
tenantId              String
tenant                Tenant                 @relation(fields: [tenantId], references: [id], onDelete: Cascade)
clientId              String
client                Client                 @relation(fields: [clientId], references: [id], onDelete: Cascade)
partyType             ClientPartyType        @default(INDIVIDUAL)
title                 String?
fullName              String
nationality           String?
dualCitizenship       Boolean?
otherNationality      String?
dateOfBirth           DateTime?
address               String?
telephone             String?
email                 String?
isPep                 Boolean?
pepDetails            String?
// Entity the person represents (the KYC "entity name").
representedEntity     String?
qidNumber             String?
qidExpiry             DateTime?
nationalAddressExpiry DateTime?
// Corporate parties: CR / registration number, and the MIS client it is linked to (if any).
registrationNumber    String?
linkedClientName      String?
// Combined "QID / Passport" value from an older KYC that was never split.
legacyIdentity        String?
fieldEditedAt         Json                   @default("{
```

### ClientPersonRole

```prisma
id            String               @id @default(uuid())
tenantId      String
tenant        Tenant               @relation(fields: [tenantId], references: [id], onDelete: Cascade)
personId      String
person        ClientPerson         @relation("ClientPersonRoles", fields: [personId], references: [id], onDelete: Cascade)
role          ClientPersonRoleType
// Position wording for OTHER (for example "Compliance Officer"); empty for the listed roles.
title         String               @default("")
percentage    Decimal?             @db.Decimal(5, 2)
// A UBO held through a corporate shareholder of the client.
viaPersonId   String?
via           ClientPerson?        @relation("ClientPersonRoleVia", fields: [viaPersonId], references: [id], onDelete: SetNull)
// KYC row the role came from (SHAREHOLDER / UBO / OFFICER / KEY_CONTACT and row id), used to prefill the next re-KYC.
sourceSection String?
sourceRowId   String?
createdById   String?
createdAt     DateTime             @default(now())
updatedAt     DateTime             @updatedAt
@@unique([personId, role, title])
@@index([tenantId])
@@index([viaPersonId])
```

### ClientPersonPassport

```prisma
id             String       @id @default(uuid())
tenantId       String
tenant         Tenant       @relation(fields: [tenantId], references: [id], onDelete: Cascade)
personId       String
person         ClientPerson @relation(fields: [personId], references: [id], onDelete: Cascade)
passportNumber String
issuingCountry String?
expiryDate     DateTime?
// The passport printed on the KYC form; others are kept on the client profile only.
isPrimary      Boolean      @default(false)
createdById    String?
updatedById    String?
createdAt      DateTime     @default(now())
updatedAt      DateTime     @updatedAt
@@index([tenantId])
@@index([personId])
```

### ClientLegalDocument

```prisma
id                  String                    @id @default(uuid())
tenantId            String
tenant              Tenant                    @relation(fields: [tenantId], references: [id], onDelete: Cascade)
clientId            String
client              Client                    @relation(fields: [clientId], references: [id], onDelete: Cascade)
// Catalogue key (CR_EXTRACT_EN, TAX_CARD, ...) or OTHER with the typed label.
typeKey             String
typeLabel           String
nature              ClientLegalDocumentNature
personId            String?
person              ClientPerson?             @relation(fields: [personId], references: [id], onDelete: SetNull)
documentNumber      String?
holderName          String
location            String?
issueDate           DateTime?
expiryDate          DateTime?
notes               String?
fileName            String?
storagePath         String?
mimeType            String?
size                Int?
status              ClientLegalDocumentStatus @default(CURRENT)
// The document this one replaced (a renewed CR replaces the previous one).
replacesId          String?                   @unique
replaces            ClientLegalDocument?      @relation("ClientLegalDocumentReplacement", fields: [replacesId], references: [id], onDelete: SetNull)
replacedBy          ClientLegalDocument?      @relation("ClientLegalDocumentReplacement")
// KYC upload the file was copied from, if any.
sourceKycDocumentId String?
// How the values were filled: MANUAL, LOCAL (read on the server) or AI (read by the company's AI service).
readMethod          String?
statusReason        String?
statusChangedAt     DateTime?
statusChangedById   String?
createdById         String?
updatedById         String?
createdAt           DateTime                  @default(now())
updatedAt           DateTime                  @updatedAt
@@index([tenantId])
@@index([clientId, status])
@@index([personId])
```

### TenantAiSetting

```prisma
id              String   @id @default(uuid())
tenantId        String   @unique
tenant          Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
provider        String   @default("OPENAI")
model           String
apiKeyEncrypted String
apiKeyLast4     String
enabled         Boolean  @default(true)
updatedById     String?
createdAt       DateTime @default(now())
updatedAt       DateTime @updatedAt
```

### ClientAllocation

```prisma
id          String   @id @default(uuid())
tenantId    String
tenant      Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
clientId    String
client      Client   @relation(fields: [clientId], references: [id], onDelete: Cascade)
userId      String
user        User     @relation("ClientAllocationUser", fields: [userId], references: [id], onDelete: Cascade)
createdById String?
createdAt   DateTime @default(now())
@@unique([clientId, userId])
@@index([tenantId])
@@index([userId])
```

### ComplianceReminder

```prisma
id        String   @id @default(uuid())
tenantId  String
tenant    Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
kind      String
entityId  String
milestone String
createdAt DateTime @default(now())
@@unique([tenantId, kind, entityId, milestone])
```

### ClientEngagement

```prisma
id               String                 @id @default(uuid())
tenantId         String
tenant           Tenant                 @relation(fields: [tenantId], references: [id], onDelete: Cascade)
clientId         String
client           Client                 @relation(fields: [clientId], references: [id], onDelete: Cascade)
kycCaseId        String?                @unique
kycCase          KycCase?               @relation(fields: [kycCaseId], references: [id], onDelete: SetNull)
engagementNumber String
serviceName      String
description      String?
status           ClientEngagementStatus @default(PENDING)
startDate        DateTime?
endDate          DateTime?
createdById      String?
createdBy        User?                  @relation("ClientEngagementCreator", fields: [createdById], references: [id], onDelete: SetNull)
createdAt        DateTime               @default(now())
updatedAt        DateTime               @updatedAt
@@unique([tenantId, engagementNumber])
@@index([tenantId])
@@index([clientId])
```

### ClientContact

```prisma
id        String   @id @default(uuid())
tenantId  String
tenant    Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
clientId  String
client    Client   @relation(fields: [clientId], references: [id], onDelete: Cascade)
name      String
email     String?
phone     String?
position  String?
isPrimary Boolean  @default(false)
createdAt DateTime @default(now())
updatedAt DateTime @updatedAt
@@index([tenantId])
@@index([clientId])
```

### ClientService

```prisma
id          String    @id @default(uuid())
tenantId    String
tenant      Tenant    @relation(fields: [tenantId], references: [id], onDelete: Cascade)
name        String
description String?
kycCases    KycCase[]
createdAt   DateTime  @default(now())
updatedAt   DateTime  @updatedAt
@@unique([tenantId, name])
@@index([tenantId])
```

### KycCase

```prisma
id                String                 @id @default(uuid())
tenantId          String
tenant            Tenant                 @relation(fields: [tenantId], references: [id], onDelete: Cascade)
clientId          String
client            Client                 @relation(fields: [clientId], references: [id], onDelete: Cascade)
sourceEnquiryId   String?                @unique
sourceEnquiry     Enquiry?               @relation("EnquiryGeneratedKycCases", fields: [sourceEnquiryId], references: [id], onDelete: SetNull)
serviceId         String?
service           ClientService?         @relation(fields: [serviceId], references: [id], onDelete: SetNull)
title             String
kycNumber         String
// REKYC cases refresh an existing client's KYC; earlier cases are kept as history.
purpose           KycCasePurpose         @default(ONBOARDING)
previousKycCaseId String?
previousKycCase   KycCase?               @relation("KycCaseRekyc", fields: [previousKycCaseId], references: [id], onDelete: SetNull)
rekycCases        KycCase[]              @relation("KycCaseRekyc")
profileOverrides  ClientProfileOverride[]
status            KycCaseStatus          @default(INQUIRY_RECEIVED)
proposalStatus    ProposalStatus         @default(NOT_REQUIRED)
createdById       String?
createdBy         User?                  @relation("KycCaseCreator", fields: [createdById], references: [id], onDelete: SetNull)
amlAssigneeId     String?
amlAssignee       User?                  @relation("KycCaseAssignee", fields: [amlAssigneeId], references: [id], onDelete: SetNull)
statusHistory     KycCaseStatusHistory[]
legalDocuments    LegalDocument[]
comments          WorkflowComment[]
notifications     Notification[]
kycForm           KycForm?
kycSectionData    KycSectionData[]
kycShareholders   KycShareholder[]
kycUbos           KycUbo[]
kycManagers       KycManager[]
kycRequiredDocuments KycRequiredDocument[]
kycInternalReview KycInternalReview?
internalReviewTasks InternalReviewTask[]
internalReviewSubmissions InternalReviewSubmission[]
internalReviewVersions InternalReviewVersion[]
reviewerComments ReviewerComment[]
signedKycDocuments SignedKycDocument[]
riskReclassifications RiskReclassification[]
activationChecklist ClientActivationChecklist?
kycGeneratedDocuments KycGeneratedDocument[]
screeningRecords  ScreeningRecord[]
screeningCaseChecks ScreeningCaseCheck[]
screeningCaseDocuments ScreeningCaseDocument[]
crrfRecord       CrrfRecord?
clientEngagement ClientEngagement?
submittedToAmlAt  DateTime?
amlReviewStartedAt DateTime?
createdAt         DateTime               @default(now())
updatedAt         DateTime               @updatedAt
@@unique([tenantId, kycNumber])
@@index([tenantId])
@@index([clientId])
@@index([sourceEnquiryId])
@@index([status])
```

### KycForm

```prisma
id                 String                 @id @default(uuid())
tenantId           String
tenant             Tenant                 @relation(fields: [tenantId], references: [id], onDelete: Cascade)
kycCaseId          String                 @unique
kycCase            KycCase                @relation(fields: [kycCaseId], references: [id], onDelete: Cascade)
status             String                 @default("DRAFT")
isLocked           Boolean                @default(false)
version            Int                    @default(1)
createdBy          String
createdByUser      User                   @relation("KycFormCreatedBy", fields: [createdBy], references: [id], onDelete: Restrict)
updatedBy          String
updatedByUser      User                   @relation("KycFormUpdatedBy", fields: [updatedBy], references: [id], onDelete: Restrict)
sections           KycSectionData[]
shareholders       KycShareholder[]
ubos               KycUbo[]
managers           KycManager[]
requiredDocuments  KycRequiredDocument[]
internalReview     KycInternalReview?
generatedDocuments KycGeneratedDocument[]
revisions          KycFormRevision[]
fullKycStarted     Boolean                @default(false)
createdAt          DateTime               @default(now())
updatedAt          DateTime               @updatedAt
@@index([tenantId])
@@index([kycCaseId])
```

### KycFormRevision

```prisma
id           String   @id @default(uuid())
tenantId     String
kycFormId    String
kycForm      KycForm  @relation(fields: [kycFormId], references: [id], onDelete: Cascade)
version      Int
snapshot     Json
reason       String
createdBy    String
createdAt    DateTime @default(now())
files        KycRevisionFile[]
@@unique([kycFormId, version])
@@index([tenantId, kycFormId])
```

### KycRevisionFile

```prisma
id               String          @id @default(uuid())
revisionId       String
revision         KycFormRevision @relation(fields: [revisionId], references: [id], onDelete: Cascade)
sourceDocumentId String
fileName         String
mimeType         String
content          Bytes
@@index([revisionId])
```

### KycSectionData

```prisma
id         String            @id @default(uuid())
tenantId   String
tenant     Tenant            @relation(fields: [tenantId], references: [id], onDelete: Cascade)
kycCaseId  String
kycCase    KycCase           @relation(fields: [kycCaseId], references: [id], onDelete: Cascade)
kycFormId  String
kycForm    KycForm           @relation(fields: [kycFormId], references: [id], onDelete: Cascade)
sectionKey KycFormSectionKey
data       Json
createdBy  String
updatedBy  String
createdAt  DateTime          @default(now())
updatedAt  DateTime          @updatedAt
@@unique([kycFormId, sectionKey])
@@index([tenantId])
@@index([kycCaseId])
```

### KycShareholder

```prisma
id                  String   @id @default(uuid())
tenantId            String
tenant              Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
kycCaseId           String
kycCase             KycCase  @relation(fields: [kycCaseId], references: [id], onDelete: Cascade)
kycFormId           String
kycForm             KycForm  @relation(fields: [kycFormId], references: [id], onDelete: Cascade)
fullName            String
nationality         String?
dateOfBirth         DateTime?
identityNumber      String?
ownershipPercentage Decimal? @db.Decimal(5, 2)
residenceAddress    String?
sortOrder           Int      @default(0)
createdBy           String
updatedBy           String
createdAt           DateTime @default(now())
updatedAt           DateTime @updatedAt
@@index([tenantId])
@@index([kycCaseId])
@@index([kycFormId])
```

### KycUbo

```prisma
id                  String   @id @default(uuid())
tenantId            String
tenant              Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
kycCaseId           String
kycCase             KycCase  @relation(fields: [kycCaseId], references: [id], onDelete: Cascade)
kycFormId           String
kycForm             KycForm  @relation(fields: [kycFormId], references: [id], onDelete: Cascade)
fullName            String
nationality         String?
dateOfBirth         DateTime?
identityNumber      String?
ownershipPercentage Decimal? @db.Decimal(5, 2)
residenceAddress    String?
notes               String?
sortOrder           Int      @default(0)
createdBy           String
updatedBy           String
createdAt           DateTime @default(now())
updatedAt           DateTime @updatedAt
@@index([tenantId])
@@index([kycCaseId])
@@index([kycFormId])
```

### KycManager

```prisma
id                    String   @id @default(uuid())
tenantId              String
tenant                Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
kycCaseId             String
kycCase               KycCase  @relation(fields: [kycCaseId], references: [id], onDelete: Cascade)
kycFormId             String
kycForm               KycForm  @relation(fields: [kycFormId], references: [id], onDelete: Cascade)
fullName              String
entityName            String?
nationalityAndAddress String?
nationality           String?
address               String?
dateOfBirth           DateTime?
identityNumber        String?
qidNumber             String?
qidExpiry             DateTime?
passportNumber        String?
passportExpiry        DateTime?
position              String?
// Per-person declarations (2026-11-23): Mr / Ms / Sheikh ..., Yes / No answers as typed in the form.
title                 String?
dualCitizenship       String?
otherNationality      String?
isPep                 String?
pepDetails            String?
isAuthorizedSignatory Boolean  @default(false)
sortOrder             Int      @default(0)
createdBy             String
updatedBy             String
createdAt             DateTime @default(now())
updatedAt             DateTime @updatedAt
@@index([tenantId])
@@index([kycCaseId])
@@index([kycFormId])
```

### KycRequiredDocument

```prisma
id           String   @id @default(uuid())
tenantId     String
tenant       Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
kycCaseId    String
kycCase      KycCase  @relation(fields: [kycCaseId], references: [id], onDelete: Cascade)
kycFormId    String
kycForm      KycForm  @relation(fields: [kycFormId], references: [id], onDelete: Cascade)
documentType String
isRequired   Boolean  @default(true)
isProvided   Boolean  @default(false)
fileName     String?
storagePath  String?
mimeType     String?
size         Int?
sortOrder    Int      @default(0)
createdBy    String
updatedBy    String
createdAt    DateTime @default(now())
updatedAt    DateTime @updatedAt
@@index([tenantId])
@@index([kycCaseId])
@@index([kycFormId])
```

### KycInternalReview

```prisma
id                       String              @id @default(uuid())
tenantId                 String
tenant                   Tenant              @relation(fields: [tenantId], references: [id], onDelete: Cascade)
kycCaseId                String              @unique
kycCase                  KycCase             @relation(fields: [kycCaseId], references: [id], onDelete: Cascade)
kycFormId                String              @unique
kycForm                  KycForm             @relation(fields: [kycFormId], references: [id], onDelete: Cascade)
amlAccuracyChecked       Boolean             @default(false)
amlClarificationFindings String?
riskClassification       RiskClassification?
dueDiligenceType         DueDiligenceType?
amlName                  String?
amlSignatureFileName     String?
amlSignatureDataUrl      String?
amlDate                  DateTime?
dmlroName                String?
dmlroSignatureFileName   String?
dmlroSignatureDataUrl    String?
dmlroDate                DateTime?
dmlroRiskClassification  RiskClassification?
dmlroDecision            ReviewDecision?
dmlroConditions          String?
dmlroReason              String?
dmlroComments            String?
mlroName                 String?
mlroSignatureFileName    String?
mlroSignatureDataUrl     String?
mlroDate                 DateTime?
mlroDecision             ReviewDecision?
mlroFinalRiskClassification RiskClassification?
mlroRiskReasonCategory   RiskOverrideReason?
mlroRiskExplanation      String?
mlroConditions           String?
mlroComments             String?
sefName                  String?
sefSignatureFileName     String?
sefSignatureDataUrl      String?
sefDate                  DateTime?
sefDecision              ReviewDecision?
sefConditions            String?
sefComments              String?
createdBy                String
updatedBy                String
createdAt                DateTime            @default(now())
updatedAt                DateTime            @updatedAt
@@index([tenantId])
```

### InternalReviewTask

```prisma
id           String           @id @default(uuid())
tenantId     String
tenant       Tenant           @relation(fields: [tenantId], references: [id], onDelete: Cascade)
kycCaseId    String
kycCase      KycCase          @relation(fields: [kycCaseId], references: [id], onDelete: Cascade)
stage        ReviewStage
status       ReviewTaskStatus @default(PENDING)
assignedToId String?
assignedTo   User?            @relation("InternalReviewTaskAssignee", fields: [assignedToId], references: [id], onDelete: SetNull)
dueDate      DateTime?
startedAt    DateTime?
completedAt  DateTime?
createdBy    String
updatedBy    String
createdAt    DateTime         @default(now())
updatedAt    DateTime         @updatedAt
@@unique([kycCaseId, stage, status])
@@index([tenantId])
@@index([kycCaseId])
@@index([stage])
@@index([assignedToId])
```

### InternalReviewSubmission

```prisma
id              String                 @id @default(uuid())
tenantId        String
tenant          Tenant                 @relation(fields: [tenantId], references: [id], onDelete: Cascade)
kycCaseId       String
kycCase         KycCase                @relation(fields: [kycCaseId], references: [id], onDelete: Cascade)
stage           ReviewStage
status          ReviewSubmissionStatus @default(DRAFT)
version         Int                    @default(1)
data            Json
formalComments  String?
confidentialNotes String?
submittedById   String?
submittedBy     User?                  @relation("InternalReviewSubmittedBy", fields: [submittedById], references: [id], onDelete: SetNull)
submittedAt     DateTime?
isLocked        Boolean                @default(false)
createdBy       String
updatedBy       String
createdAt       DateTime               @default(now())
updatedAt       DateTime               @updatedAt
@@unique([kycCaseId, stage])
@@index([tenantId])
@@index([kycCaseId])
@@index([stage])
@@index([submittedById])
```

### InternalReviewVersion

```prisma
id           String      @id @default(uuid())
tenantId     String
tenant       Tenant      @relation(fields: [tenantId], references: [id], onDelete: Cascade)
kycCaseId    String
kycCase      KycCase     @relation(fields: [kycCaseId], references: [id], onDelete: Cascade)
stage        ReviewStage
version      Int
snapshot     Json
submittedBy  String?
submittedAt  DateTime?
createdAt    DateTime    @default(now())
@@unique([kycCaseId, stage, version])
@@index([tenantId])
@@index([kycCaseId])
```

### ReviewerComment

```prisma
id              String                       @id @default(uuid())
tenantId        String
tenant          Tenant                       @relation(fields: [tenantId], references: [id], onDelete: Cascade)
kycCaseId       String
kycCase         KycCase                      @relation(fields: [kycCaseId], references: [id], onDelete: Cascade)
stage           ReviewStage
type            ReviewCommentType
visibilityScope ConfidentialVisibilityScope?
body            String
isLocked        Boolean                      @default(false)
authorId        String?
author          User?                        @relation("ReviewerCommentAuthor", fields: [authorId], references: [id], onDelete: SetNull)
createdAt       DateTime                     @default(now())
updatedAt       DateTime                     @updatedAt
@@index([tenantId])
@@index([kycCaseId])
@@index([stage])
@@index([type])
```

### SignedKycDocument

```prisma
id              String                 @id @default(uuid())
tenantId        String
tenant          Tenant                 @relation(fields: [tenantId], references: [id], onDelete: Cascade)
kycCaseId       String
kycCase         KycCase                @relation(fields: [kycCaseId], references: [id], onDelete: Cascade)
reviewStage     SignedKycDocumentStage
fileName        String
fileType        String?
fileSize        Int?
storageKey      String?
documentVersion Int                    @default(1)
signatureType   String?
comments        String?
activeVersion   Boolean                @default(true)
uploadedById    String?
uploadedBy      User?                  @relation("SignedKycDocumentUploader", fields: [uploadedById], references: [id], onDelete: SetNull)
uploadedAt      DateTime               @default(now())
createdAt       DateTime               @default(now())
updatedAt       DateTime               @updatedAt
@@unique([kycCaseId, reviewStage, documentVersion])
@@index([tenantId])
@@index([kycCaseId])
@@index([reviewStage])
```

### RiskReclassification

```prisma
id                     String             @id @default(uuid())
tenantId               String
tenant                 Tenant             @relation(fields: [tenantId], references: [id], onDelete: Cascade)
kycCaseId              String
kycCase                KycCase            @relation(fields: [kycCaseId], references: [id], onDelete: Cascade)
calculatedRisk         RiskClassification?
supervisorRisk         RiskClassification?
dmlroRisk              RiskClassification?
previousRisk           RiskClassification?
newRisk                RiskClassification
reasonCategory         RiskOverrideReason
explanation            String
effectiveDate          DateTime
changedById            String?
changedBy              User?              @relation("RiskReclassificationUser", fields: [changedById], references: [id], onDelete: SetNull)
createdAt              DateTime           @default(now())
@@index([tenantId])
@@index([kycCaseId])
```

### ClientActivationChecklist

```prisma
id             String   @id @default(uuid())
tenantId       String
tenant         Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
kycCaseId      String   @unique
kycCase        KycCase  @relation(fields: [kycCaseId], references: [id], onDelete: Cascade)
checklist      Json
isReady        Boolean  @default(false)
blockingIssues Json?
completedAt    DateTime?
createdBy      String
updatedBy      String
createdAt      DateTime @default(now())
updatedAt      DateTime @updatedAt
@@index([tenantId])
```

### KycGeneratedDocument

```prisma
id           String                   @id @default(uuid())
tenantId     String
tenant       Tenant                   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
kycCaseId    String
kycCase      KycCase                  @relation(fields: [kycCaseId], references: [id], onDelete: Cascade)
kycFormId    String
kycForm      KycForm                  @relation(fields: [kycFormId], references: [id], onDelete: Cascade)
documentType KycGeneratedDocumentType
version      Int
formRevision Int?
fileName     String
mimeType     String
content      Bytes
createdBy    String
updatedBy    String
createdAt    DateTime                 @default(now())
updatedAt    DateTime                 @updatedAt
@@unique([kycFormId, documentType, version])
@@index([tenantId])
@@index([kycCaseId])
```

### KycCaseStatusHistory

```prisma
id             String        @id @default(uuid())
tenantId       String
tenant         Tenant        @relation(fields: [tenantId], references: [id], onDelete: Cascade)
kycCaseId      String
kycCase        KycCase       @relation(fields: [kycCaseId], references: [id], onDelete: Cascade)
fromStatus     KycCaseStatus?
toStatus       KycCaseStatus
changedById    String?
changedBy      User?         @relation(fields: [changedById], references: [id], onDelete: SetNull)
note           String?
createdAt      DateTime      @default(now())
@@index([tenantId])
@@index([kycCaseId])
```

### Document

```prisma
id          String   @id @default(uuid())
tenantId    String
tenant      Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
fileName    String
storagePath String
mimeType    String?
size        Int?
createdAt   DateTime @default(now())
updatedAt   DateTime @updatedAt
```

### Approval

```prisma
id        String   @id @default(uuid())
tenantId  String
tenant    Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
subject   String
status    String   @default("PENDING")
createdAt DateTime @default(now())
updatedAt DateTime @updatedAt
```

### Notification

```prisma
id          String           @id @default(uuid())
tenantId    String
tenant      Tenant           @relation(fields: [tenantId], references: [id], onDelete: Cascade)
kycCaseId   String?
kycCase     KycCase?         @relation(fields: [kycCaseId], references: [id], onDelete: Cascade)
enquiryId   String?
enquiry     Enquiry?         @relation(fields: [enquiryId], references: [id], onDelete: Cascade)
clientId    String?
client      Client?          @relation(fields: [clientId], references: [id], onDelete: Cascade)
recipientId String?
recipient   User?            @relation(fields: [recipientId], references: [id], onDelete: SetNull)
type        NotificationType @default(GENERAL)
title       String
message     String
isRead      Boolean          @default(false)
createdAt   DateTime         @default(now())
updatedAt   DateTime         @updatedAt
@@index([tenantId])
@@index([kycCaseId])
@@index([enquiryId])
@@index([clientId])
```

### LegalDocument

```prisma
id           String              @id @default(uuid())
tenantId     String
tenant       Tenant              @relation(fields: [tenantId], references: [id], onDelete: Cascade)
kycCaseId    String
kycCase      KycCase             @relation(fields: [kycCaseId], references: [id], onDelete: Cascade)
documentType String
fileName     String
storagePath  String?
mimeType     String?
size         Int?
status       LegalDocumentStatus @default(UPLOADED)
uploadedById String?
uploadedBy   User?               @relation("LegalDocumentUploader", fields: [uploadedById], references: [id], onDelete: SetNull)
createdAt    DateTime            @default(now())
updatedAt    DateTime            @updatedAt
@@index([tenantId])
@@index([kycCaseId])
```

### ScreeningRecord

```prisma
id             String                @id @default(uuid())
tenantId       String
tenant         Tenant                @relation(fields: [tenantId], references: [id], onDelete: Cascade)
kycCaseId      String
kycCase        KycCase               @relation(fields: [kycCaseId], references: [id], onDelete: Cascade)
clientId       String?
client         Client?               @relation(fields: [clientId], references: [id], onDelete: SetNull)
entityType     ScreeningEntityType
entitySourceId String?
entityName     String
identifier     String?
country        String?
status         ScreeningRecordStatus @default(DRAFT)
conclusionStatus ScreeningConclusionStatus?
remarks        String?
createdById    String?
updatedById    String?
checks         ScreeningCheck[]
documents      ScreeningDocument[]
createdAt      DateTime              @default(now())
updatedAt      DateTime              @updatedAt
@@index([tenantId])
@@index([kycCaseId])
@@index([clientId])
@@index([status])
```

### ScreeningCaseDocument

```prisma
id           String             @id @default(uuid())
tenantId     String
tenant       Tenant             @relation(fields: [tenantId], references: [id], onDelete: Cascade)
kycCaseId    String
kycCase      KycCase            @relation(fields: [kycCaseId], references: [id], onDelete: Cascade)
screeningCaseCheckId String?
screeningCaseCheck   ScreeningCaseCheck? @relation(fields: [screeningCaseCheckId], references: [id], onDelete: SetNull)
checkType    ScreeningCheckType
documentType String
fileName     String
storagePath  String?
mimeType     String?
size         Int?
uploadedById String?
createdAt    DateTime           @default(now())
updatedAt    DateTime           @updatedAt
@@index([tenantId])
@@index([kycCaseId])
@@index([screeningCaseCheckId])
@@index([checkType])
```

### ScreeningCaseCheck

```prisma
id           String                @id @default(uuid())
tenantId     String
tenant       Tenant                @relation(fields: [tenantId], references: [id], onDelete: Cascade)
kycCaseId    String
kycCase      KycCase               @relation(fields: [kycCaseId], references: [id], onDelete: Cascade)
checkType    ScreeningCheckType
resultStatus ScreeningResultStatus @default(NOT_CHECKED)
notes        String?
documents    ScreeningCaseDocument[]
createdAt    DateTime              @default(now())
updatedAt    DateTime              @updatedAt
@@unique([kycCaseId, checkType])
@@index([tenantId])
@@index([kycCaseId])
```

### ScreeningCheck

```prisma
id                String                @id @default(uuid())
tenantId          String
tenant            Tenant                @relation(fields: [tenantId], references: [id], onDelete: Cascade)
screeningRecordId String
screeningRecord   ScreeningRecord       @relation(fields: [screeningRecordId], references: [id], onDelete: Cascade)
checkType         ScreeningCheckType
isSelected        Boolean               @default(false)
resultStatus      ScreeningResultStatus @default(NOT_CHECKED)
notes             String?
documents         ScreeningDocument[]
createdAt         DateTime              @default(now())
updatedAt         DateTime              @updatedAt
@@unique([screeningRecordId, checkType])
@@index([tenantId])
@@index([screeningRecordId])
```

### ScreeningDocument

```prisma
id                String           @id @default(uuid())
tenantId          String
tenant            Tenant           @relation(fields: [tenantId], references: [id], onDelete: Cascade)
screeningRecordId String
screeningRecord   ScreeningRecord  @relation(fields: [screeningRecordId], references: [id], onDelete: Cascade)
screeningCheckId  String?
screeningCheck    ScreeningCheck?  @relation(fields: [screeningCheckId], references: [id], onDelete: SetNull)
documentType      String
fileName          String
storagePath       String?
mimeType          String?
size              Int?
uploadedById      String?
createdAt         DateTime         @default(now())
updatedAt         DateTime         @updatedAt
@@index([tenantId])
@@index([screeningRecordId])
@@index([screeningCheckId])
```

### CrrfRecord

```prisma
id           String         @id @default(uuid())
tenantId     String
tenant       Tenant         @relation(fields: [tenantId], references: [id], onDelete: Cascade)
kycCaseId    String         @unique
kycCase      KycCase        @relation(fields: [kycCaseId], references: [id], onDelete: Cascade)
riskRating   CrrfRiskRating?
internalComment String?
dmlroComment String?
mlroComment  String?
createdById  String?
updatedById  String?
documents    CrrfDocument[]
createdAt    DateTime       @default(now())
updatedAt    DateTime       @updatedAt
@@index([tenantId])
@@index([kycCaseId])
@@index([riskRating])
```

### CrrfDocument

```prisma
id           String     @id @default(uuid())
tenantId     String
tenant       Tenant     @relation(fields: [tenantId], references: [id], onDelete: Cascade)
crrfRecordId String
crrfRecord   CrrfRecord @relation(fields: [crrfRecordId], references: [id], onDelete: Cascade)
fileName     String
storagePath  String?
mimeType     String?
size         Int?
uploadedById String?
createdAt    DateTime   @default(now())
updatedAt    DateTime   @updatedAt
@@index([tenantId])
@@index([crrfRecordId])
```

### WorkflowComment

```prisma
id          String   @id @default(uuid())
tenantId    String
tenant      Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
kycCaseId   String
kycCase     KycCase  @relation(fields: [kycCaseId], references: [id], onDelete: Cascade)
authorId    String?
author      User?    @relation(fields: [authorId], references: [id], onDelete: SetNull)
body        String
createdAt   DateTime @default(now())
updatedAt   DateTime @updatedAt
@@index([tenantId])
@@index([kycCaseId])
```

### AuditLog

```prisma
id         String      @id @default(uuid())
tenantId   String?
tenant     Tenant?     @relation(fields: [tenantId], references: [id], onDelete: SetNull)
actorId    String?
actor      User?       @relation(fields: [actorId], references: [id], onDelete: SetNull)
action     AuditAction
entityType String
entityId   String?
metadata   Json?
ipAddress  String?
createdAt  DateTime    @default(now())
```

### LoginChallenge

```prisma
id         String    @id @default(uuid())
userId     String
user User @relation(fields: [userId], references: [id], onDelete: Cascade)
codeHash   String
expiresAt  DateTime
attempts   Int       @default(0)
sendCount  Int       @default(1)
lastSentAt DateTime  @default(now())
consumedAt DateTime?
createdAt  DateTime  @default(now())
@@index([userId])
@@index([expiresAt])
```
