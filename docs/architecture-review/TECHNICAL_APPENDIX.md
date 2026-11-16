# Technical Workflow and API Appendix

Baseline `7da1a27a874e72d2f0b28f4910e48b12e1b0d24b` on `bugfix-2026-10-27`. Review date 27 October 2026.

Coverage: 21 registered controllers, 118 HTTP operations, 30 frontend routes, 47 database models, 26 enums. Resolved from AppModule imports and module controllers; no application startup or database access.

## How to interpret this inventory

This is a source-derived contract index, not an OpenAPI specification or a claim that every endpoint has passed QA. IDs are stable hashes of method/path. Source links are relative to this repository. DTO declarations below define decorator validation; Record<string, unknown> bodies depend on service checks. Output schemas are generally inferred rather than explicit DTOs: linked controller/service methods are authoritative. QA must capture redacted real response shapes on staging before freezing a client API contract.

Roles below are FALLBACK DECORATORS, not an unconditional allow-list. RolesGuard can replace them with area grants when configured. JWT validates current user roles/status. Methods without @Roles bypass RolesGuard area enforcement. Service role/status and tenant checks still apply where implemented. Global error shape is {statusCode,timestamp,path,error}; error can be an object or message. Typical failures: 400 validation/state, 401 session, 403 role, 404 scoped resource, 413/415 upload limits/types where implemented, 500 unhandled/DB errors, 503 PDF renderer. Exact errors detected below are candidate branches, not promised for every input.

GET classification follows same-service helper calls and detected Prisma writes; it is not a proof of purity or complete dependency traversal. File writes and database writes are not one transaction. Audit/notification entries appear in the detected writes, not a guarantee every successful action emits them. Standard JSON success defaults follow Nest (POST 201, others 200 unless overridden); binary responses follow controller.

Read the [workflow specification](WORKFLOWS.md), [findings](FINDINGS.md) and [QA checklist](QA_HANDOVER.md) alongside this appendix.

## Frontend entry points

| ID | Route | Page or redirect | Inherited presentation guard | Evidence |
|---|---|---|---|---|
| UI-C42C80AA | `/login` | `<LoginPage />` | `No explicit wrapper here` | [frontend/src/routes/router.tsx:37](../../frontend/src/routes/router.tsx#L37) |
| UI-42099B4A | `/` | `<HomeRedirect />` | `<ProtectedRoute />` | [frontend/src/routes/router.tsx:45](../../frontend/src/routes/router.tsx#L45) |
| UI-28BD26B4 | `/access-denied` | `<AccessDeniedPage />` | `<ProtectedRoute />` | [frontend/src/routes/router.tsx:46](../../frontend/src/routes/router.tsx#L46) |
| UI-5EC026C5 | `/dashboard` | `<DashboardPage />` | `<ProtectedRoute />` | [frontend/src/routes/router.tsx:47](../../frontend/src/routes/router.tsx#L47) |
| UI-60DE948F | `/enquiries` | `<EnquiryListPage />` | `<ProtectedRoute />; <RequireAccess area="enquiries" fallbackRoles={workflowRoles.enquiries} />` | [frontend/src/routes/router.tsx:50](../../frontend/src/routes/router.tsx#L50) |
| UI-5AAA1184 | `/enquiries/:id` | `<EnquiryDetailsPage />` | `<ProtectedRoute />; <RequireAccess area="enquiries" fallbackRoles={workflowRoles.enquiryView} />` | [frontend/src/routes/router.tsx:54](../../frontend/src/routes/router.tsx#L54) |
| UI-5E733969 | `/enquiries/new` | `<AddEnquiryPage />` | `<ProtectedRoute />; <RequireAccess area="enquiries" write fallbackRoles={workflowRoles.clientIntake} />` | [frontend/src/routes/router.tsx:58](../../frontend/src/routes/router.tsx#L58) |
| UI-08D99489 | `/enquiries/:id/edit` | `<AddEnquiryPage />` | `<ProtectedRoute />; <RequireAccess area="enquiries" write fallbackRoles={workflowRoles.enquiryEditing} />` | [frontend/src/routes/router.tsx:62](../../frontend/src/routes/router.tsx#L62) |
| UI-4072F695 | `/clients` | `<ClientListPage />` | `<ProtectedRoute />; <RequireAccess area="clients" fallbackRoles={workflowRoles.clientIntake} />` | [frontend/src/routes/router.tsx:67](../../frontend/src/routes/router.tsx#L67) |
| UI-A690ED0A | `/clients/:id` | `<ClientDetailsPage />` | `<ProtectedRoute />; <RequireAccess area="clients" fallbackRoles={workflowRoles.clientIntake} />` | [frontend/src/routes/router.tsx:68](../../frontend/src/routes/router.tsx#L68) |
| UI-2727DF55 | `/clients/new` | `<AddClientPage />` | `<ProtectedRoute />; <RequireAccess area="clients" write fallbackRoles={workflowRoles.clientIntake} />` | [frontend/src/routes/router.tsx:74](../../frontend/src/routes/router.tsx#L74) |
| UI-8B9693F8 | `/clients/:id/edit` | `<AddClientPage />` | `<ProtectedRoute />; <RequireAccess area="clients" write fallbackRoles={workflowRoles.clientIntake} />` | [frontend/src/routes/router.tsx:75](../../frontend/src/routes/router.tsx#L75) |
| UI-FC3EDF4F | `/tenants` | `<TenantsPage />` | `<ProtectedRoute />; <RequireAccess area="administration" fallbackRoles={workflowRoles.admin} />` | [frontend/src/routes/router.tsx:81](../../frontend/src/routes/router.tsx#L81) |
| UI-17B09069 | `/modules` | `<ModulesPage />` | `<ProtectedRoute />; <RequireAccess area="administration" fallbackRoles={workflowRoles.admin} />` | [frontend/src/routes/router.tsx:82](../../frontend/src/routes/router.tsx#L82) |
| UI-E6EF7307 | `/users` | `<UsersPage />` | `<ProtectedRoute />; <RequireAccess area="administration" fallbackRoles={workflowRoles.userAdmin} />` | [frontend/src/routes/router.tsx:87](../../frontend/src/routes/router.tsx#L87) |
| UI-753D9E1F | `/access-control` | `<AccessControlPage />` | `<ProtectedRoute />; <RequireRoles roles={workflowRoles.admin} />` | [frontend/src/routes/router.tsx:91](../../frontend/src/routes/router.tsx#L91) |
| UI-513452A7 | `/kyc-workflow` | `<KycWorkflowPage />` | `<ProtectedRoute />; <RequireAccess area="kyc" fallbackRoles={[...workflowRoles.caseCreation, ...workflowRoles.kycPreparation, ...workflowRoles.reviewTasks]} />` | [frontend/src/routes/router.tsx:96](../../frontend/src/routes/router.tsx#L96) |
| UI-45500B06 | `/kyc/:id` | `<KycCaseDetailsPage />` | `<ProtectedRoute />; <RequireAccess area="kyc" fallbackRoles={[...workflowRoles.caseCreation, ...workflowRoles.kycPreparation, ...workflowRoles.reviewTasks]} />` | [frontend/src/routes/router.tsx:97](../../frontend/src/routes/router.tsx#L97) |
| UI-1E7757AB | `/kyc/new` | `<CreateKycCasePage />` | `<ProtectedRoute />; <RequireAccess area="kyc" write fallbackRoles={workflowRoles.caseCreation} />` | [frontend/src/routes/router.tsx:103](../../frontend/src/routes/router.tsx#L103) |
| UI-029A4677 | `/kyc/:id/edit` | `<CreateKycCasePage />` | `<ProtectedRoute />; <RequireAccess area="kyc" write fallbackRoles={workflowRoles.caseCreation} />` | [frontend/src/routes/router.tsx:104](../../frontend/src/routes/router.tsx#L104) |
| UI-D918C14E | `/kyc/:id/form` | `<KycFormEditorPage />` | `<ProtectedRoute />; <RequireAccess area="kyc" write fallbackRoles={workflowRoles.kycFormBuilder} />` | [frontend/src/routes/router.tsx:110](../../frontend/src/routes/router.tsx#L110) |
| UI-5BC25A17 | `/kyc/:id/submit` | `<SubmitToAmlPage />` | `<ProtectedRoute />; <RequireAccess area="kyc" write fallbackRoles={workflowRoles.kycFormBuilder} />` | [frontend/src/routes/router.tsx:111](../../frontend/src/routes/router.tsx#L111) |
| UI-27E491D3 | `/kyc/:id/revisions` | `<KycFormRevisionsPage />` | `<ProtectedRoute />; <RequireAccess area="kyc" fallbackRoles={workflowRoles.kycFormBuilder} />` | [frontend/src/routes/router.tsx:116](../../frontend/src/routes/router.tsx#L116) |
| UI-E06B4F54 | `/kyc/:id/documents` | `<UploadLegalDocumentsPage />` | `<ProtectedRoute />; <RequireAccess area="kyc" write fallbackRoles={workflowRoles.documentUpload} />` | [frontend/src/routes/router.tsx:120](../../frontend/src/routes/router.tsx#L120) |
| UI-48A0907A | `/screening` | `<ScreeningListPage />` | `<ProtectedRoute />; <RequireAccess area="screening" fallbackRoles={workflowRoles.screening} />` | [frontend/src/routes/router.tsx:125](../../frontend/src/routes/router.tsx#L125) |
| UI-94160747 | `/kyc/:id/screening` | `<KycScreeningPage />` | `<ProtectedRoute />; <RequireAccess area="screening" fallbackRoles={workflowRoles.screening} />` | [frontend/src/routes/router.tsx:126](../../frontend/src/routes/router.tsx#L126) |
| UI-F47950FD | `/crrf` | `<CrrfListPage />` | `<ProtectedRoute />; <RequireAccess area="crrf" fallbackRoles={workflowRoles.crrf} />` | [frontend/src/routes/router.tsx:132](../../frontend/src/routes/router.tsx#L132) |
| UI-0027B296 | `/kyc/:id/crrf` | `<CrrfWorkspacePage />` | `<ProtectedRoute />; <RequireAccess area="crrf" fallbackRoles={workflowRoles.crrf} />` | [frontend/src/routes/router.tsx:133](../../frontend/src/routes/router.tsx#L133) |
| UI-A5908753 | `/kyc/:id/internal-review` | `<InternalReviewWorkspacePage />` | `<ProtectedRoute />; <RequireAccess area="approvals" fallbackRoles={workflowRoles.reviewTasks} />` | [frontend/src/routes/router.tsx:139](../../frontend/src/routes/router.tsx#L139) |
| UI-2063ABE2 | `/review-tasks` | `<ReviewTasksPage />` | `<ProtectedRoute />; <RequireAccess area="approvals" fallbackRoles={workflowRoles.reviewTasks} />` | [frontend/src/routes/router.tsx:145](../../frontend/src/routes/router.tsx#L145) |

## API operation index

| ID | Method and path | Handler | Classification |
|---|---|---|---|
| [API-877BF8E4](#api-877bf8e4) | `GET /api/access-control` | AccessControlController.matrix | GET WITH SIDE EFFECTS |
| [API-812E3C7B](#api-812e3c7b) | `GET /api/access-control/me` | AccessControlController.mine | Read candidate (static scan only) |
| [API-8B7FA898](#api-8b7fa898) | `PUT /api/access-control/roles/:roleName` | AccessControlController.update | Command (may mutate) |
| [API-EBFCDF2C](#api-ebfcdf2c) | `GET /api/approvals` | ApprovalsController.findAll | Read candidate (static scan only) |
| [API-1AB8DBCE](#api-1ab8dbce) | `GET /api/audit-logs` | AuditLogsController.findAll | Read candidate (static scan only) |
| [API-4B243C69](#api-4b243c69) | `POST /api/auth/login` | AuthController.login | Command (may mutate) |
| [API-56B94144](#api-56b94144) | `GET /api/auth/me` | AuthController.me | Read candidate (static scan only) |
| [API-7FD503B4](#api-7fd503b4) | `GET /api/clients` | ClientsController.findAll | Read candidate (static scan only) |
| [API-BABA0CF1](#api-baba0cf1) | `POST /api/clients` | ClientsController.create | Command (may mutate) |
| [API-5B6DA8D0](#api-5b6da8d0) | `DELETE /api/clients/:id` | ClientsController.remove | Command (may mutate) |
| [API-90F59AA9](#api-90f59aa9) | `GET /api/clients/:id` | ClientsController.findOne | Read candidate (static scan only) |
| [API-9AB9DDF9](#api-9ab9ddf9) | `PATCH /api/clients/:id` | ClientsController.update | Command (may mutate) |
| [API-EC99E535](#api-ec99e535) | `GET /api/clients/match` | ClientsController.match | Read candidate (static scan only) |
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
| [API-B62F552C](#api-b62f552c) | `POST /api/kyc/:id/final-kyc-decision` | KycController.completeFinalKycDecision | Command (may mutate) |
| [API-0AED223E](#api-0aed223e) | `GET /api/kyc/:id/form` | KycController.getForm | GET WITH SIDE EFFECTS |
| [API-BC473411](#api-bc473411) | `POST /api/kyc/:id/form` | KycController.createForm | Command (may mutate) |
| [API-A3C714C0](#api-a3c714c0) | `PATCH /api/kyc/:id/form/autosave` | KycController.autoSaveForm | Command (may mutate) |
| [API-490F75DE](#api-490f75de) | `POST /api/kyc/:id/form/generate-docx` | KycController.generateDocx | Command (may mutate) |
| [API-DD13B530](#api-dd13b530) | `POST /api/kyc/:id/form/generate-pdf` | KycController.generatePdf | Command (may mutate) |
| [API-78F4A26B](#api-78f4a26b) | `GET /api/kyc/:id/form/generated-documents/:documentId/download` | KycController.downloadGeneratedDocument | GET WITH SIDE EFFECTS |
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

## API-877BF8E4

**GET /api/access-control** - AccessControlController.matrix

- Entry/auth: AuthGuard('jwt'); RolesGuard; fallback roles: SUPER_ADMIN.
- Inputs: none.
- Output: JSON returned from delegated service; inferred fields in linked implementation. Inferred by TypeScript; no explicit response DTO.
- Behavior: GET WITH SIDE EFFECTS; detected reachable writes: permission.createMany.
- Tenant/role/state/validation helper candidates: none detected; inspect implementation before acceptance.
- Error branch candidates: none explicitly thrown in resolved methods; global errors still apply.
- Evidence: [backend/src/access-control/access-control.controller.ts:14](../../backend/src/access-control/access-control.controller.ts#L14).
- Logic chain: AccessControlService.getMatrix [backend/src/access-control/access-control.service.ts:36](../../backend/src/access-control/access-control.service.ts#L36); AccessControlService.ensureCatalog [backend/src/access-control/access-control.service.ts:113](../../backend/src/access-control/access-control.service.ts#L113); AccessControlService.isConfigured [backend/src/access-control/access-control.service.ts:148](../../backend/src/access-control/access-control.service.ts#L148); AccessControlService.levelFor [backend/src/access-control/access-control.service.ts:153](../../backend/src/access-control/access-control.service.ts#L153).
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
- Logic chain: AccessControlService.effectivePermissions [backend/src/access-control/access-control.service.ts:92](../../backend/src/access-control/access-control.service.ts#L92); AccessControlService.isConfigured [backend/src/access-control/access-control.service.ts:148](../../backend/src/access-control/access-control.service.ts#L148).
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
- Logic chain: AccessControlService.updateRole [backend/src/access-control/access-control.service.ts:57](../../backend/src/access-control/access-control.service.ts#L57); AccessControlService.ensureCatalog [backend/src/access-control/access-control.service.ts:113](../../backend/src/access-control/access-control.service.ts#L113); AccessControlService.bootstrapDefaults [backend/src/access-control/access-control.service.ts:126](../../backend/src/access-control/access-control.service.ts#L126); AccessControlService.getMatrix [backend/src/access-control/access-control.service.ts:36](../../backend/src/access-control/access-control.service.ts#L36); AccessControlService.isConfigured [backend/src/access-control/access-control.service.ts:148](../../backend/src/access-control/access-control.service.ts#L148); AccessControlService.levelFor [backend/src/access-control/access-control.service.ts:153](../../backend/src/access-control/access-control.service.ts#L153).
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
- Inputs: none.
- Output: JSON returned from delegated service; inferred fields in linked implementation. Inferred by TypeScript; no explicit response DTO.
- Behavior: Read candidate (static scan only); detected reachable writes: none detected.
- Tenant/role/state/validation helper candidates: none detected; inspect implementation before acceptance.
- Error branch candidates: none explicitly thrown in resolved methods; global errors still apply.
- Evidence: [backend/src/audit-logs/audit-logs.controller.ts:12](../../backend/src/audit-logs/audit-logs.controller.ts#L12).
- Logic chain: AuditLogsService.findAll [backend/src/audit-logs/audit-logs.service.ts:8](../../backend/src/audit-logs/audit-logs.service.ts#L8).
- QA: apply Q-API for this ID and its workflow-specific cases; store status/body/DB diff with secrets removed.
- DTO field-access candidates: none resolved. These span reachable helpers and may include fields of internally composed DTOs; they are not a mandatory field list or complete wire schema. Match to the entry DTO and workflow before constructing requests.

## API-4B243C69

**POST /api/auth/login** - AuthController.login

- Entry/auth: No controller/method guard detected (public); fallback roles: none declared; authenticated-only when JWT applies.
- Inputs: `@Body() dto: LoginDto`.
- Output: JSON returned from delegated service; inferred fields in linked implementation. Inferred by TypeScript; no explicit response DTO.
- Behavior: Command (may mutate); detected reachable writes: auditLog.create.
- Tenant/role/state/validation helper candidates: none detected; inspect implementation before acceptance.
- Error branch candidates: UnauthorizedException: 'Invalid email or password'); UnauthorizedException: 'User account is not active').
- Evidence: [backend/src/auth/auth.controller.ts:12](../../backend/src/auth/auth.controller.ts#L12).
- Logic chain: AuthService.login [backend/src/auth/auth.service.ts:16](../../backend/src/auth/auth.service.ts#L16); AuthService.toPublicUser [backend/src/auth/auth.service.ts:66](../../backend/src/auth/auth.service.ts#L66).
- QA: apply Q-API for this ID and its workflow-specific cases; store status/body/DB diff with secrets removed.
- DTO field-access candidates: email, password. These span reachable helpers and may include fields of internally composed DTOs; they are not a mandatory field list or complete wire schema. Match to the entry DTO and workflow before constructing requests.

## API-56B94144

**GET /api/auth/me** - AuthController.me

- Entry/auth: AuthGuard('jwt'); fallback roles: none declared; authenticated-only when JWT applies.
- Inputs: `@CurrentUser() user: RequestUser`.
- Output: JSON returned from delegated service; inferred fields in linked implementation. Inferred by TypeScript; no explicit response DTO.
- Behavior: Read candidate (static scan only); detected reachable writes: none detected.
- Tenant/role/state/validation helper candidates: none detected; inspect implementation before acceptance.
- Error branch candidates: none explicitly thrown in resolved methods; global errors still apply.
- Evidence: [backend/src/auth/auth.controller.ts:17](../../backend/src/auth/auth.controller.ts#L17).
- Logic chain: AuthService.currentUser [backend/src/auth/auth.service.ts:54](../../backend/src/auth/auth.service.ts#L54); AuthService.toPublicUser [backend/src/auth/auth.service.ts:66](../../backend/src/auth/auth.service.ts#L66).
- QA: apply Q-API for this ID and its workflow-specific cases; store status/body/DB diff with secrets removed.
- DTO field-access candidates: none resolved. These span reachable helpers and may include fields of internally composed DTOs; they are not a mandatory field list or complete wire schema. Match to the entry DTO and workflow before constructing requests.

## API-7FD503B4

**GET /api/clients** - ClientsController.findAll

- Entry/auth: AuthGuard('jwt'); RolesGuard; fallback roles: none declared; authenticated-only when JWT applies.
- Inputs: `@CurrentUser() user: RequestUser`.
- Output: JSON returned from delegated service; inferred fields in linked implementation. Inferred by TypeScript; no explicit response DTO.
- Behavior: Read candidate (static scan only); detected reachable writes: none detected.
- Tenant/role/state/validation helper candidates: tenantWhere.
- Error branch candidates: ForbiddenException: 'Super admin must act within a tenant for this operation'); ForbiddenException: 'User is not assigned to a tenant').
- Evidence: [backend/src/clients/clients.controller.ts:22](../../backend/src/clients/clients.controller.ts#L22).
- Logic chain: ClientsService.findAll [backend/src/clients/clients.service.ts:38](../../backend/src/clients/clients.service.ts#L38); ClientsService.tenantWhere [backend/src/clients/clients.service.ts:261](../../backend/src/clients/clients.service.ts#L261); ClientsService.getTenantId [backend/src/clients/clients.service.ts:265](../../backend/src/clients/clients.service.ts#L265).
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
- Evidence: [backend/src/clients/clients.controller.ts:16](../../backend/src/clients/clients.controller.ts#L16).
- Logic chain: ClientsService.create [backend/src/clients/clients.service.ts:11](../../backend/src/clients/clients.service.ts#L11); ClientsService.getTenantId [backend/src/clients/clients.service.ts:265](../../backend/src/clients/clients.service.ts#L265).
- QA: apply Q-API for this ID and its workflow-specific cases; store status/body/DB diff with secrets removed.
- DTO field-access candidates: contacts, country, industry, name, registrationNumber. These span reachable helpers and may include fields of internally composed DTOs; they are not a mandatory field list or complete wire schema. Match to the entry DTO and workflow before constructing requests.

## API-5B6DA8D0

**DELETE /api/clients/:id** - ClientsController.remove

- Entry/auth: AuthGuard('jwt'); RolesGuard; fallback roles: OPERATING_TEAM, COMPANY_ADMIN, SUPER_ADMIN.
- Inputs: `@CurrentUser() user: RequestUser`; `@Param('id') id: string`.
- Output: JSON returned from delegated service; inferred fields in linked implementation. Inferred by TypeScript; no explicit response DTO.
- Behavior: Command (may mutate); detected reachable writes: client.delete.
- Tenant/role/state/validation helper candidates: tenantWhere.
- Error branch candidates: NotFoundException: 'Client not found'); ForbiddenException: 'Super admin must act within a tenant for this operation'); ForbiddenException: 'User is not assigned to a tenant').
- Evidence: [backend/src/clients/clients.controller.ts:48](../../backend/src/clients/clients.controller.ts#L48).
- Logic chain: ClientsService.remove [backend/src/clients/clients.service.ts:251](../../backend/src/clients/clients.service.ts#L251); ClientsService.findOne [backend/src/clients/clients.service.ts:52](../../backend/src/clients/clients.service.ts#L52); ClientsService.tenantWhere [backend/src/clients/clients.service.ts:261](../../backend/src/clients/clients.service.ts#L261); ClientsService.getTenantId [backend/src/clients/clients.service.ts:265](../../backend/src/clients/clients.service.ts#L265).
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
- Evidence: [backend/src/clients/clients.controller.ts:37](../../backend/src/clients/clients.controller.ts#L37).
- Logic chain: ClientsService.findOne [backend/src/clients/clients.service.ts:52](../../backend/src/clients/clients.service.ts#L52); ClientsService.tenantWhere [backend/src/clients/clients.service.ts:261](../../backend/src/clients/clients.service.ts#L261); ClientsService.getTenantId [backend/src/clients/clients.service.ts:265](../../backend/src/clients/clients.service.ts#L265).
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
- Evidence: [backend/src/clients/clients.controller.ts:42](../../backend/src/clients/clients.controller.ts#L42).
- Logic chain: ClientsService.update [backend/src/clients/clients.service.ts:207](../../backend/src/clients/clients.service.ts#L207); ClientsService.findOne [backend/src/clients/clients.service.ts:52](../../backend/src/clients/clients.service.ts#L52); ClientsService.tenantWhere [backend/src/clients/clients.service.ts:261](../../backend/src/clients/clients.service.ts#L261); ClientsService.getTenantId [backend/src/clients/clients.service.ts:265](../../backend/src/clients/clients.service.ts#L265).
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
- Evidence: [backend/src/clients/clients.controller.ts:27](../../backend/src/clients/clients.controller.ts#L27).
- Logic chain: ClientsService.matchByIdentifier [backend/src/clients/clients.service.ts:76](../../backend/src/clients/clients.service.ts#L76); ClientsService.normalizedIdentifier [backend/src/clients/clients.service.ts:289](../../backend/src/clients/clients.service.ts#L289); ClientsService.tenantWhere [backend/src/clients/clients.service.ts:261](../../backend/src/clients/clients.service.ts#L261); ClientsService.getTenantId [backend/src/clients/clients.service.ts:265](../../backend/src/clients/clients.service.ts#L265); ClientsService.clientMatch [backend/src/clients/clients.service.ts:277](../../backend/src/clients/clients.service.ts#L277); ClientsService.matchClientRegistrationByNormalizedValue [backend/src/clients/clients.service.ts:115](../../backend/src/clients/clients.service.ts#L115); ClientsService.matchKycCompanyRegistration [backend/src/clients/clients.service.ts:130](../../backend/src/clients/clients.service.ts#L130); ClientsService.recordValue [backend/src/clients/clients.service.ts:296](../../backend/src/clients/clients.service.ts#L296); ClientsService.matchKycOwnerByIdentifier [backend/src/clients/clients.service.ts:151](../../backend/src/clients/clients.service.ts#L151); ClientsService.matchKycOwnerByNormalizedValue [backend/src/clients/clients.service.ts:187](../../backend/src/clients/clients.service.ts#L187).
- QA: apply Q-API for this ID and its workflow-specific cases; store status/body/DB diff with secrets removed.
- DTO field-access candidates: none resolved. These span reachable helpers and may include fields of internally composed DTOs; they are not a mandatory field list or complete wire schema. Match to the entry DTO and workflow before constructing requests.

## API-126A3D33

**GET /api/crrf** - CrrfListController.listRecords

- Entry/auth: AuthGuard('jwt'); RolesGuard; fallback roles: AML_TEAM, AML_SUPERVISOR, DMLRO, MLRO, SEF, COMPANY_ADMIN, SUPER_ADMIN.
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
- Error branch candidates: none explicitly thrown in resolved methods; global errors still apply.
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

- Entry/auth: AuthGuard('jwt'); RolesGuard; fallback roles: OPERATING_TEAM, AML_TEAM, AML_SUPERVISOR, DMLRO, MLRO, SEF, ACCOUNTING_TEAM, HR_TEAM, COMPANY_ADMIN, SUPER_ADMIN.
- Inputs: `@CurrentUser() user: RequestUser`.
- Output: JSON returned from delegated service; inferred fields in linked implementation. Inferred by TypeScript; no explicit response DTO.
- Behavior: Read candidate (static scan only); detected reachable writes: none detected.
- Tenant/role/state/validation helper candidates: tenantWhere.
- Error branch candidates: ForbiddenException: 'Super admin must act within a tenant for this operation'); ForbiddenException: 'User is not assigned to a tenant').
- Evidence: [backend/src/enquiries/enquiries.controller.ts:25](../../backend/src/enquiries/enquiries.controller.ts#L25).
- Logic chain: EnquiriesService.findAll [backend/src/enquiries/enquiries.service.ts:145](../../backend/src/enquiries/enquiries.service.ts#L145); EnquiriesService.tenantWhere [backend/src/enquiries/enquiries.service.ts:857](../../backend/src/enquiries/enquiries.service.ts#L857); EnquiriesService.getTenantId [backend/src/enquiries/enquiries.service.ts:861](../../backend/src/enquiries/enquiries.service.ts#L861).
- QA: apply Q-API for this ID and its workflow-specific cases; store status/body/DB diff with secrets removed.
- DTO field-access candidates: none resolved. These span reachable helpers and may include fields of internally composed DTOs; they are not a mandatory field list or complete wire schema. Match to the entry DTO and workflow before constructing requests.

## API-2A03FCD2

**POST /api/enquiries** - EnquiriesController.create

- Entry/auth: AuthGuard('jwt'); RolesGuard; fallback roles: OPERATING_TEAM, COMPANY_ADMIN, SUPER_ADMIN.
- Inputs: `@CurrentUser() user: RequestUser`; `@Body() dto: CreateEnquiryDto`.
- Output: JSON returned from delegated service; inferred fields in linked implementation. Inferred by TypeScript; no explicit response DTO.
- Behavior: Command (may mutate); detected reachable writes: enquiry.create, enquiryStatusHistory.create, notification.createMany.
- Tenant/role/state/validation helper candidates: assertClientTenant, tenantWhere.
- Error branch candidates: ServiceUnavailableException: ; ForbiddenException: 'Super admin must act within a tenant for this operation'); ForbiddenException: 'User is not assigned to a tenant'); NotFoundException: 'Client not found for this enquiry'); NotFoundException: 'Enquiry not found').
- Evidence: [backend/src/enquiries/enquiries.controller.ts:19](../../backend/src/enquiries/enquiries.controller.ts#L19).
- Logic chain: EnquiriesService.create [backend/src/enquiries/enquiries.service.ts:50](../../backend/src/enquiries/enquiries.service.ts#L50); EnquiriesService.getTenantId [backend/src/enquiries/enquiries.service.ts:861](../../backend/src/enquiries/enquiries.service.ts#L861); EnquiriesService.assertClientTenant [backend/src/enquiries/enquiries.service.ts:838](../../backend/src/enquiries/enquiries.service.ts#L838); EnquiriesService.tenantWhere [backend/src/enquiries/enquiries.service.ts:857](../../backend/src/enquiries/enquiries.service.ts#L857); EnquiriesService.nextEnquiryCode [backend/src/enquiries/enquiries.service.ts:804](../../backend/src/enquiries/enquiries.service.ts#L804); EnquiriesService.jsonValue [backend/src/enquiries/enquiries.service.ts:849](../../backend/src/enquiries/enquiries.service.ts#L849); EnquiriesService.enquiryDisplayName [backend/src/enquiries/enquiries.service.ts:992](../../backend/src/enquiries/enquiries.service.ts#L992); EnquiriesService.findOne [backend/src/enquiries/enquiries.service.ts:159](../../backend/src/enquiries/enquiries.service.ts#L159); EnquiriesService.logCreateFailure [backend/src/enquiries/enquiries.service.ts:974](../../backend/src/enquiries/enquiries.service.ts#L974); EnquiriesService.enquiryCreateDatabaseException [backend/src/enquiries/enquiries.service.ts:1049](../../backend/src/enquiries/enquiries.service.ts#L1049).
- QA: apply Q-API for this ID and its workflow-specific cases; store status/body/DB diff with secrets removed.
- DTO field-access candidates: areaOfOperation, attachments, branchCountry, clientId, companyName, details, enquiryType, headOfficeCountry, keyContactEmail, keyContactName, keyContactPhone, keyContactPosition, notes, proposedCompanyName, requestedServices. These span reachable helpers and may include fields of internally composed DTOs; they are not a mandatory field list or complete wire schema. Match to the entry DTO and workflow before constructing requests.

## API-62F96B16

**DELETE /api/enquiries/:id** - EnquiriesController.remove

- Entry/auth: AuthGuard('jwt'); RolesGuard; fallback roles: SUPER_ADMIN.
- Inputs: `@CurrentUser() user: RequestUser`; `@Param('id') id: string`.
- Output: JSON returned from delegated service; inferred fields in linked implementation. Inferred by TypeScript; no explicit response DTO.
- Behavior: Command (may mutate); detected reachable writes: enquiry.delete.
- Tenant/role/state/validation helper candidates: tenantWhere.
- Error branch candidates: NotFoundException: 'Enquiry not found'); ForbiddenException: 'Super admin must act within a tenant for this operation'); ForbiddenException: 'User is not assigned to a tenant').
- Evidence: [backend/src/enquiries/enquiries.controller.ts:139](../../backend/src/enquiries/enquiries.controller.ts#L139).
- Logic chain: EnquiriesService.remove [backend/src/enquiries/enquiries.service.ts:792](../../backend/src/enquiries/enquiries.service.ts#L792); EnquiriesService.findOne [backend/src/enquiries/enquiries.service.ts:159](../../backend/src/enquiries/enquiries.service.ts#L159); EnquiriesService.tenantWhere [backend/src/enquiries/enquiries.service.ts:857](../../backend/src/enquiries/enquiries.service.ts#L857); EnquiriesService.getTenantId [backend/src/enquiries/enquiries.service.ts:861](../../backend/src/enquiries/enquiries.service.ts#L861); EnquiriesService.removeEnquiryAttachmentDirectory [backend/src/enquiries/enquiries.service.ts:1181](../../backend/src/enquiries/enquiries.service.ts#L1181); EnquiriesService.enquiryAttachmentUploadRoot [backend/src/enquiries/enquiries.service.ts:966](../../backend/src/enquiries/enquiries.service.ts#L966).
- QA: apply Q-API for this ID and its workflow-specific cases; store status/body/DB diff with secrets removed.
- DTO field-access candidates: none resolved. These span reachable helpers and may include fields of internally composed DTOs; they are not a mandatory field list or complete wire schema. Match to the entry DTO and workflow before constructing requests.

## API-45584D11

**GET /api/enquiries/:id** - EnquiriesController.findOne

- Entry/auth: AuthGuard('jwt'); RolesGuard; fallback roles: OPERATING_TEAM, AML_TEAM, AML_SUPERVISOR, DMLRO, MLRO, SEF, ACCOUNTING_TEAM, HR_TEAM, COMPANY_ADMIN, SUPER_ADMIN.
- Inputs: `@CurrentUser() user: RequestUser`; `@Param('id') id: string`.
- Output: JSON returned from delegated service; inferred fields in linked implementation. Inferred by TypeScript; no explicit response DTO.
- Behavior: Read candidate (static scan only); detected reachable writes: none detected.
- Tenant/role/state/validation helper candidates: tenantWhere.
- Error branch candidates: NotFoundException: 'Enquiry not found'); ForbiddenException: 'Super admin must act within a tenant for this operation'); ForbiddenException: 'User is not assigned to a tenant').
- Evidence: [backend/src/enquiries/enquiries.controller.ts:37](../../backend/src/enquiries/enquiries.controller.ts#L37).
- Logic chain: EnquiriesService.findOne [backend/src/enquiries/enquiries.service.ts:159](../../backend/src/enquiries/enquiries.service.ts#L159); EnquiriesService.tenantWhere [backend/src/enquiries/enquiries.service.ts:857](../../backend/src/enquiries/enquiries.service.ts#L857); EnquiriesService.getTenantId [backend/src/enquiries/enquiries.service.ts:861](../../backend/src/enquiries/enquiries.service.ts#L861).
- QA: apply Q-API for this ID and its workflow-specific cases; store status/body/DB diff with secrets removed.
- DTO field-access candidates: none resolved. These span reachable helpers and may include fields of internally composed DTOs; they are not a mandatory field list or complete wire schema. Match to the entry DTO and workflow before constructing requests.

## API-AA5ECB01

**PATCH /api/enquiries/:id** - EnquiriesController.update

- Entry/auth: AuthGuard('jwt'); RolesGuard; fallback roles: OPERATING_TEAM, AML_SUPERVISOR, COMPANY_ADMIN, SUPER_ADMIN.
- Inputs: `@CurrentUser() user: RequestUser`; `@Param('id') id: string`; `@Body() dto: UpdateEnquiryDto`.
- Output: JSON returned from delegated service; inferred fields in linked implementation. Inferred by TypeScript; no explicit response DTO.
- Behavior: Command (may mutate); detected reachable writes: enquiryAttachment.deleteMany, enquiry.update.
- Tenant/role/state/validation helper candidates: tenantWhere, canModifyEnquiry, hasAnyRole, assertClientTenant.
- Error branch candidates: BadRequestException: 'This enquiry has already been submitted. It can be edited again only after AML returns it to BD.'); NotFoundException: 'Enquiry not found'); ForbiddenException: 'Super admin must act within a tenant for this operation'); ForbiddenException: 'User is not assigned to a tenant'); NotFoundException: 'Client not found for this enquiry').
- Evidence: [backend/src/enquiries/enquiries.controller.ts:43](../../backend/src/enquiries/enquiries.controller.ts#L43).
- Logic chain: EnquiriesService.update [backend/src/enquiries/enquiries.service.ts:179](../../backend/src/enquiries/enquiries.service.ts#L179); EnquiriesService.findOne [backend/src/enquiries/enquiries.service.ts:159](../../backend/src/enquiries/enquiries.service.ts#L159); EnquiriesService.tenantWhere [backend/src/enquiries/enquiries.service.ts:857](../../backend/src/enquiries/enquiries.service.ts#L857); EnquiriesService.getTenantId [backend/src/enquiries/enquiries.service.ts:861](../../backend/src/enquiries/enquiries.service.ts#L861); EnquiriesService.canModifyEnquiry [backend/src/enquiries/enquiries.service.ts:873](../../backend/src/enquiries/enquiries.service.ts#L873); EnquiriesService.hasAnyRole [backend/src/enquiries/enquiries.service.ts:962](../../backend/src/enquiries/enquiries.service.ts#L962); EnquiriesService.assertClientTenant [backend/src/enquiries/enquiries.service.ts:838](../../backend/src/enquiries/enquiries.service.ts#L838); EnquiriesService.jsonValue [backend/src/enquiries/enquiries.service.ts:849](../../backend/src/enquiries/enquiries.service.ts#L849); EnquiriesService.objectValue [backend/src/enquiries/enquiries.service.ts:1000](../../backend/src/enquiries/enquiries.service.ts#L1000).
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
- Evidence: [backend/src/enquiries/enquiries.controller.ts:111](../../backend/src/enquiries/enquiries.controller.ts#L111).
- Logic chain: EnquiriesService.getAttachmentFile [backend/src/enquiries/enquiries.service.ts:734](../../backend/src/enquiries/enquiries.service.ts#L734); EnquiriesService.findOne [backend/src/enquiries/enquiries.service.ts:159](../../backend/src/enquiries/enquiries.service.ts#L159); EnquiriesService.tenantWhere [backend/src/enquiries/enquiries.service.ts:857](../../backend/src/enquiries/enquiries.service.ts#L857); EnquiriesService.getTenantId [backend/src/enquiries/enquiries.service.ts:861](../../backend/src/enquiries/enquiries.service.ts#L861); EnquiriesService.resolveEnquiryAttachmentPath [backend/src/enquiries/enquiries.service.ts:1113](../../backend/src/enquiries/enquiries.service.ts#L1113); EnquiriesService.enquiryAttachmentUploadRoot [backend/src/enquiries/enquiries.service.ts:966](../../backend/src/enquiries/enquiries.service.ts#L966).
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
- Evidence: [backend/src/enquiries/enquiries.controller.ts:125](../../backend/src/enquiries/enquiries.controller.ts#L125).
- Logic chain: EnquiriesService.getAttachmentGroupZip [backend/src/enquiries/enquiries.service.ts:759](../../backend/src/enquiries/enquiries.service.ts#L759); EnquiriesService.findOne [backend/src/enquiries/enquiries.service.ts:159](../../backend/src/enquiries/enquiries.service.ts#L159); EnquiriesService.tenantWhere [backend/src/enquiries/enquiries.service.ts:857](../../backend/src/enquiries/enquiries.service.ts#L857); EnquiriesService.getTenantId [backend/src/enquiries/enquiries.service.ts:861](../../backend/src/enquiries/enquiries.service.ts#L861); EnquiriesService.resolveEnquiryAttachmentPath [backend/src/enquiries/enquiries.service.ts:1113](../../backend/src/enquiries/enquiries.service.ts#L1113); EnquiriesService.enquiryAttachmentUploadRoot [backend/src/enquiries/enquiries.service.ts:966](../../backend/src/enquiries/enquiries.service.ts#L966); EnquiriesService.uniqueArchiveFileName [backend/src/enquiries/enquiries.service.ts:1159](../../backend/src/enquiries/enquiries.service.ts#L1159); EnquiriesService.safeFileName [backend/src/enquiries/enquiries.service.ts:1150](../../backend/src/enquiries/enquiries.service.ts#L1150).
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
- Evidence: [backend/src/enquiries/enquiries.controller.ts:61](../../backend/src/enquiries/enquiries.controller.ts#L61).
- Logic chain: EnquiriesService.uploadAttachmentFile [backend/src/enquiries/enquiries.service.ts:645](../../backend/src/enquiries/enquiries.service.ts#L645); EnquiriesService.uploadAttachmentFiles [backend/src/enquiries/enquiries.service.ts:687](../../backend/src/enquiries/enquiries.service.ts#L687); EnquiriesService.findOne [backend/src/enquiries/enquiries.service.ts:159](../../backend/src/enquiries/enquiries.service.ts#L159); EnquiriesService.tenantWhere [backend/src/enquiries/enquiries.service.ts:857](../../backend/src/enquiries/enquiries.service.ts#L857); EnquiriesService.getTenantId [backend/src/enquiries/enquiries.service.ts:861](../../backend/src/enquiries/enquiries.service.ts#L861); EnquiriesService.canModifyEnquiry [backend/src/enquiries/enquiries.service.ts:873](../../backend/src/enquiries/enquiries.service.ts#L873); EnquiriesService.hasAnyRole [backend/src/enquiries/enquiries.service.ts:962](../../backend/src/enquiries/enquiries.service.ts#L962); EnquiriesService.enquiryAttachmentUploadRoot [backend/src/enquiries/enquiries.service.ts:966](../../backend/src/enquiries/enquiries.service.ts#L966); EnquiriesService.safeFileName [backend/src/enquiries/enquiries.service.ts:1150](../../backend/src/enquiries/enquiries.service.ts#L1150).
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
- Evidence: [backend/src/enquiries/enquiries.controller.ts:99](../../backend/src/enquiries/enquiries.controller.ts#L99).
- Logic chain: EnquiriesService.uploadAttachmentFiles [backend/src/enquiries/enquiries.service.ts:687](../../backend/src/enquiries/enquiries.service.ts#L687); EnquiriesService.findOne [backend/src/enquiries/enquiries.service.ts:159](../../backend/src/enquiries/enquiries.service.ts#L159); EnquiriesService.tenantWhere [backend/src/enquiries/enquiries.service.ts:857](../../backend/src/enquiries/enquiries.service.ts#L857); EnquiriesService.getTenantId [backend/src/enquiries/enquiries.service.ts:861](../../backend/src/enquiries/enquiries.service.ts#L861); EnquiriesService.canModifyEnquiry [backend/src/enquiries/enquiries.service.ts:873](../../backend/src/enquiries/enquiries.service.ts#L873); EnquiriesService.hasAnyRole [backend/src/enquiries/enquiries.service.ts:962](../../backend/src/enquiries/enquiries.service.ts#L962); EnquiriesService.enquiryAttachmentUploadRoot [backend/src/enquiries/enquiries.service.ts:966](../../backend/src/enquiries/enquiries.service.ts#L966); EnquiriesService.safeFileName [backend/src/enquiries/enquiries.service.ts:1150](../../backend/src/enquiries/enquiries.service.ts#L1150).
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
- Evidence: [backend/src/enquiries/enquiries.controller.ts:55](../../backend/src/enquiries/enquiries.controller.ts#L55).
- Logic chain: EnquiriesService.addComment [backend/src/enquiries/enquiries.service.ts:333](../../backend/src/enquiries/enquiries.service.ts#L333); EnquiriesService.findOne [backend/src/enquiries/enquiries.service.ts:159](../../backend/src/enquiries/enquiries.service.ts#L159); EnquiriesService.tenantWhere [backend/src/enquiries/enquiries.service.ts:857](../../backend/src/enquiries/enquiries.service.ts#L857); EnquiriesService.getTenantId [backend/src/enquiries/enquiries.service.ts:861](../../backend/src/enquiries/enquiries.service.ts#L861).
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
- Evidence: [backend/src/enquiries/enquiries.controller.ts:31](../../backend/src/enquiries/enquiries.controller.ts#L31).
- Logic chain: EnquiriesService.convertToKyc [backend/src/enquiries/enquiries.service.ts:348](../../backend/src/enquiries/enquiries.service.ts#L348); EnquiriesService.convertToKycUnsafe [backend/src/enquiries/enquiries.service.ts:364](../../backend/src/enquiries/enquiries.service.ts#L364); EnquiriesService.findOne [backend/src/enquiries/enquiries.service.ts:159](../../backend/src/enquiries/enquiries.service.ts#L159); EnquiriesService.tenantWhere [backend/src/enquiries/enquiries.service.ts:857](../../backend/src/enquiries/enquiries.service.ts#L857); EnquiriesService.getTenantId [backend/src/enquiries/enquiries.service.ts:861](../../backend/src/enquiries/enquiries.service.ts#L861); EnquiriesService.enquiryDisplayName [backend/src/enquiries/enquiries.service.ts:992](../../backend/src/enquiries/enquiries.service.ts#L992); EnquiriesService.objectValue [backend/src/enquiries/enquiries.service.ts:1000](../../backend/src/enquiries/enquiries.service.ts#L1000); EnquiriesService.optionalText [backend/src/enquiries/enquiries.service.ts:1008](../../backend/src/enquiries/enquiries.service.ts#L1008); EnquiriesService.serviceDisplayName [backend/src/enquiries/enquiries.service.ts:996](../../backend/src/enquiries/enquiries.service.ts#L996); EnquiriesService.nextKycNumber [backend/src/enquiries/enquiries.service.ts:825](../../backend/src/enquiries/enquiries.service.ts#L825); EnquiriesService.copyEnquiryAttachmentToLegalDocuments [backend/src/enquiries/enquiries.service.ts:1132](../../backend/src/enquiries/enquiries.service.ts#L1132); EnquiriesService.resolveEnquiryAttachmentPath [backend/src/enquiries/enquiries.service.ts:1113](../../backend/src/enquiries/enquiries.service.ts#L1113); EnquiriesService.enquiryAttachmentUploadRoot [backend/src/enquiries/enquiries.service.ts:966](../../backend/src/enquiries/enquiries.service.ts#L966); EnquiriesService.legalDocumentUploadRoot [backend/src/enquiries/enquiries.service.ts:970](../../backend/src/enquiries/enquiries.service.ts#L970); EnquiriesService.safeFileName [backend/src/enquiries/enquiries.service.ts:1150](../../backend/src/enquiries/enquiries.service.ts#L1150); EnquiriesService.asArray [backend/src/enquiries/enquiries.service.ts:1004](../../backend/src/enquiries/enquiries.service.ts#L1004); EnquiriesService.ownershipPercentageValue [backend/src/enquiries/enquiries.service.ts:1012](../../backend/src/enquiries/enquiries.service.ts#L1012); EnquiriesService.enquirySectionA [backend/src/enquiries/enquiries.service.ts:1029](../../backend/src/enquiries/enquiries.service.ts#L1029); EnquiriesService.enquirySectionE [backend/src/enquiries/enquiries.service.ts:1073](../../backend/src/enquiries/enquiries.service.ts#L1073); EnquiriesService.requiredDocumentRows [backend/src/enquiries/enquiries.service.ts:1084](../../backend/src/enquiries/enquiries.service.ts#L1084); EnquiriesService.isSameDocumentType [backend/src/enquiries/enquiries.service.ts:1106](../../backend/src/enquiries/enquiries.service.ts#L1106); EnquiriesService.requiredJsonValue [backend/src/enquiries/enquiries.service.ts:853](../../backend/src/enquiries/enquiries.service.ts#L853); EnquiriesService.logConvertFailure [backend/src/enquiries/enquiries.service.ts:982](../../backend/src/enquiries/enquiries.service.ts#L982).
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
- Evidence: [backend/src/enquiries/enquiries.controller.ts:73](../../backend/src/enquiries/enquiries.controller.ts#L73).
- Logic chain: EnquiriesService.getPreliminaryKyc [backend/src/enquiries/enquiries.service.ts:655](../../backend/src/enquiries/enquiries.service.ts#L655); EnquiriesService.findOne [backend/src/enquiries/enquiries.service.ts:159](../../backend/src/enquiries/enquiries.service.ts#L159); EnquiriesService.tenantWhere [backend/src/enquiries/enquiries.service.ts:857](../../backend/src/enquiries/enquiries.service.ts#L857); EnquiriesService.getTenantId [backend/src/enquiries/enquiries.service.ts:861](../../backend/src/enquiries/enquiries.service.ts#L861); EnquiriesService.assertProposedCompanyEnquiry [backend/src/enquiries/enquiries.service.ts:890](../../backend/src/enquiries/enquiries.service.ts#L890); EnquiriesService.objectValue [backend/src/enquiries/enquiries.service.ts:1000](../../backend/src/enquiries/enquiries.service.ts#L1000); EnquiriesService.optionalText [backend/src/enquiries/enquiries.service.ts:1008](../../backend/src/enquiries/enquiries.service.ts#L1008).
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
- Evidence: [backend/src/enquiries/enquiries.controller.ts:87](../../backend/src/enquiries/enquiries.controller.ts#L87).
- Logic chain: EnquiriesService.savePreliminaryKyc [backend/src/enquiries/enquiries.service.ts:662](../../backend/src/enquiries/enquiries.service.ts#L662); EnquiriesService.findOne [backend/src/enquiries/enquiries.service.ts:159](../../backend/src/enquiries/enquiries.service.ts#L159); EnquiriesService.tenantWhere [backend/src/enquiries/enquiries.service.ts:857](../../backend/src/enquiries/enquiries.service.ts#L857); EnquiriesService.getTenantId [backend/src/enquiries/enquiries.service.ts:861](../../backend/src/enquiries/enquiries.service.ts#L861); EnquiriesService.assertProposedCompanyEnquiry [backend/src/enquiries/enquiries.service.ts:890](../../backend/src/enquiries/enquiries.service.ts#L890); EnquiriesService.canModifyEnquiry [backend/src/enquiries/enquiries.service.ts:873](../../backend/src/enquiries/enquiries.service.ts#L873); EnquiriesService.hasAnyRole [backend/src/enquiries/enquiries.service.ts:962](../../backend/src/enquiries/enquiries.service.ts#L962); EnquiriesService.preliminaryKycData [backend/src/enquiries/enquiries.service.ts:896](../../backend/src/enquiries/enquiries.service.ts#L896); EnquiriesService.objectValue [backend/src/enquiries/enquiries.service.ts:1000](../../backend/src/enquiries/enquiries.service.ts#L1000); EnquiriesService.optionalText [backend/src/enquiries/enquiries.service.ts:1008](../../backend/src/enquiries/enquiries.service.ts#L1008); EnquiriesService.asArray [backend/src/enquiries/enquiries.service.ts:1004](../../backend/src/enquiries/enquiries.service.ts#L1004); EnquiriesService.requiredJsonValue [backend/src/enquiries/enquiries.service.ts:853](../../backend/src/enquiries/enquiries.service.ts#L853); EnquiriesService.getPreliminaryKyc [backend/src/enquiries/enquiries.service.ts:655](../../backend/src/enquiries/enquiries.service.ts#L655).
- QA: apply Q-API for this ID and its workflow-specific cases; store status/body/DB diff with secrets removed.
- DTO field-access candidates: businessActivity, companyName, contact, declaration, documents, expectedBusiness, jurisdiction, management, proposedLegalForm, registeredOfficeAddress, shareholders, sourceOfFunds, ubos. These span reachable helpers and may include fields of internally composed DTOs; they are not a mandatory field list or complete wire schema. Match to the entry DTO and workflow before constructing requests.

## API-8C410B0C

**POST /api/enquiries/:id/preliminary-kyc/complete** - EnquiriesController.completePreliminaryKyc

- Entry/auth: AuthGuard('jwt'); RolesGuard; fallback roles: OPERATING_TEAM, COMPANY_ADMIN, SUPER_ADMIN.
- Inputs: `@CurrentUser() user: RequestUser`; `@Param('id') id: string`; `@Body() dto: Record<string, unknown>`.
- Output: JSON returned from delegated service; inferred fields in linked implementation. Inferred by TypeScript; no explicit response DTO.
- Behavior: Command (may mutate); detected reachable writes: enquiry.update.
- Tenant/role/state/validation helper candidates: tenantWhere, assertProposedCompanyEnquiry, canModifyEnquiry, hasAnyRole, requiredJsonValue, assertCompletePreliminaryKyc.
- Error branch candidates: BadRequestException: 'The Preliminary KYC form is locked after the enquiry is submitted. AML must return the enquiry before it can be edited.'); NotFoundException: 'Enquiry not found'); ForbiddenException: 'Super admin must act within a tenant for this operation'); ForbiddenException: 'User is not assigned to a tenant'); BadRequestException: 'Preliminary KYC is available only for Proposed Company - No Legal Status Yet enquiries.'); BadRequestException: 'Complete all Preliminary KYC company details before submitting the enquiry.'); BadRequestException: 'Add at least one proposed shareholder with name and ownership percentage.'); BadRequestException: `Direct shareholder ownership must total 100%. Current total: ${total.toFixed(2)}%.`); BadRequestException: 'Enter a UBO percentage for each beneficial owner linked to a corporate shareholder.'); BadRequestException: 'Add at least one proposed management or control person with name and position.'); BadRequestException: 'Confirm at least one required Preliminary KYC document is available.'); BadRequestException: 'Ownership percentage must be a number between 0 and 100.').
- Evidence: [backend/src/enquiries/enquiries.controller.ts:93](../../backend/src/enquiries/enquiries.controller.ts#L93).
- Logic chain: EnquiriesService.completePreliminaryKyc [backend/src/enquiries/enquiries.service.ts:676](../../backend/src/enquiries/enquiries.service.ts#L676); EnquiriesService.savePreliminaryKyc [backend/src/enquiries/enquiries.service.ts:662](../../backend/src/enquiries/enquiries.service.ts#L662); EnquiriesService.findOne [backend/src/enquiries/enquiries.service.ts:159](../../backend/src/enquiries/enquiries.service.ts#L159); EnquiriesService.tenantWhere [backend/src/enquiries/enquiries.service.ts:857](../../backend/src/enquiries/enquiries.service.ts#L857); EnquiriesService.getTenantId [backend/src/enquiries/enquiries.service.ts:861](../../backend/src/enquiries/enquiries.service.ts#L861); EnquiriesService.assertProposedCompanyEnquiry [backend/src/enquiries/enquiries.service.ts:890](../../backend/src/enquiries/enquiries.service.ts#L890); EnquiriesService.canModifyEnquiry [backend/src/enquiries/enquiries.service.ts:873](../../backend/src/enquiries/enquiries.service.ts#L873); EnquiriesService.hasAnyRole [backend/src/enquiries/enquiries.service.ts:962](../../backend/src/enquiries/enquiries.service.ts#L962); EnquiriesService.preliminaryKycData [backend/src/enquiries/enquiries.service.ts:896](../../backend/src/enquiries/enquiries.service.ts#L896); EnquiriesService.objectValue [backend/src/enquiries/enquiries.service.ts:1000](../../backend/src/enquiries/enquiries.service.ts#L1000); EnquiriesService.optionalText [backend/src/enquiries/enquiries.service.ts:1008](../../backend/src/enquiries/enquiries.service.ts#L1008); EnquiriesService.asArray [backend/src/enquiries/enquiries.service.ts:1004](../../backend/src/enquiries/enquiries.service.ts#L1004); EnquiriesService.requiredJsonValue [backend/src/enquiries/enquiries.service.ts:853](../../backend/src/enquiries/enquiries.service.ts#L853); EnquiriesService.getPreliminaryKyc [backend/src/enquiries/enquiries.service.ts:655](../../backend/src/enquiries/enquiries.service.ts#L655); EnquiriesService.assertCompletePreliminaryKyc [backend/src/enquiries/enquiries.service.ts:934](../../backend/src/enquiries/enquiries.service.ts#L934); EnquiriesService.ownershipPercentageValue [backend/src/enquiries/enquiries.service.ts:1012](../../backend/src/enquiries/enquiries.service.ts#L1012).
- QA: apply Q-API for this ID and its workflow-specific cases; store status/body/DB diff with secrets removed.
- DTO field-access candidates: businessActivity, companyName, contact, declaration, documents, expectedBusiness, jurisdiction, management, proposedLegalForm, registeredOfficeAddress, shareholders, sourceOfFunds, ubos. These span reachable helpers and may include fields of internally composed DTOs; they are not a mandatory field list or complete wire schema. Match to the entry DTO and workflow before constructing requests.

## API-3A245610

**GET /api/enquiries/:id/preliminary-kyc/pdf** - EnquiriesController.downloadPreliminaryPdf

- Entry/auth: AuthGuard('jwt'); RolesGuard; fallback roles: none declared; authenticated-only when JWT applies.
- Inputs: `@CurrentUser() user: RequestUser`; `@Param('id') id: string`; `@Res() response: Response`.
- Output: Response.send binary/HTML; see controller MIME and Content-Disposition. Inferred by TypeScript; no explicit response DTO.
- Behavior: Read candidate (static scan only); detected reachable writes: none detected.
- Tenant/role/state/validation helper candidates: tenantWhere, assertProposedCompanyEnquiry.
- Error branch candidates: BadRequestException: 'No Preliminary KYC form is available to download.'); NotFoundException: 'Enquiry not found'); ForbiddenException: 'Super admin must act within a tenant for this operation'); ForbiddenException: 'User is not assigned to a tenant'); BadRequestException: 'Preliminary KYC is available only for Proposed Company - No Legal Status Yet enquiries.').
- Evidence: [backend/src/enquiries/enquiries.controller.ts:78](../../backend/src/enquiries/enquiries.controller.ts#L78).
- Logic chain: EnquiriesService.downloadPreliminaryPdf [backend/src/enquiries/enquiries.service.ts:44](../../backend/src/enquiries/enquiries.service.ts#L44); EnquiriesService.getPreliminaryKyc [backend/src/enquiries/enquiries.service.ts:655](../../backend/src/enquiries/enquiries.service.ts#L655); EnquiriesService.findOne [backend/src/enquiries/enquiries.service.ts:159](../../backend/src/enquiries/enquiries.service.ts#L159); EnquiriesService.tenantWhere [backend/src/enquiries/enquiries.service.ts:857](../../backend/src/enquiries/enquiries.service.ts#L857); EnquiriesService.getTenantId [backend/src/enquiries/enquiries.service.ts:861](../../backend/src/enquiries/enquiries.service.ts#L861); EnquiriesService.assertProposedCompanyEnquiry [backend/src/enquiries/enquiries.service.ts:890](../../backend/src/enquiries/enquiries.service.ts#L890); EnquiriesService.objectValue [backend/src/enquiries/enquiries.service.ts:1000](../../backend/src/enquiries/enquiries.service.ts#L1000); EnquiriesService.optionalText [backend/src/enquiries/enquiries.service.ts:1008](../../backend/src/enquiries/enquiries.service.ts#L1008).
- QA: apply Q-API for this ID and its workflow-specific cases; store status/body/DB diff with secrets removed.
- DTO field-access candidates: none resolved. These span reachable helpers and may include fields of internally composed DTOs; they are not a mandatory field list or complete wire schema. Match to the entry DTO and workflow before constructing requests.

## API-F4305601

**PATCH /api/enquiries/:id/status** - EnquiriesController.updateStatus

- Entry/auth: AuthGuard('jwt'); RolesGuard; fallback roles: OPERATING_TEAM, AML_SUPERVISOR, COMPANY_ADMIN, SUPER_ADMIN.
- Inputs: `@CurrentUser() user: RequestUser`; `@Param('id') id: string`; `@Body() dto: UpdateEnquiryStatusDto`.
- Output: JSON returned from delegated service; inferred fields in linked implementation. Inferred by TypeScript; no explicit response DTO.
- Behavior: Command (may mutate); detected reachable writes: enquiry.update, enquiryStatusHistory.create, notification.createMany.
- Tenant/role/state/validation helper candidates: tenantWhere, assertCompletePreliminaryKyc, hasAnyRole.
- Error branch candidates: BadRequestException: 'This enquiry has already been converted to KYC and its status cannot be changed.'); BadRequestException: 'This enquiry has already been submitted to AML Supervisor.'); ForbiddenException: 'Only AML reviewers can return an enquiry to BD.'); ForbiddenException: 'Only AML reviewers can mark an enquiry ready for KYC.'); NotFoundException: 'Enquiry not found'); ForbiddenException: 'Super admin must act within a tenant for this operation'); ForbiddenException: 'User is not assigned to a tenant'); BadRequestException: 'Complete all Preliminary KYC company details before submitting the enquiry.'); BadRequestException: 'Add at least one proposed shareholder with name and ownership percentage.'); BadRequestException: `Direct shareholder ownership must total 100%. Current total: ${total.toFixed(2)}%.`); BadRequestException: 'Enter a UBO percentage for each beneficial owner linked to a corporate shareholder.'); BadRequestException: 'Add at least one proposed management or control person with name and position.'); BadRequestException: 'Confirm at least one required Preliminary KYC document is available.'); BadRequestException: 'Ownership percentage must be a number between 0 and 100.').
- Evidence: [backend/src/enquiries/enquiries.controller.ts:49](../../backend/src/enquiries/enquiries.controller.ts#L49).
- Logic chain: EnquiriesService.updateStatus [backend/src/enquiries/enquiries.service.ts:239](../../backend/src/enquiries/enquiries.service.ts#L239); EnquiriesService.findOne [backend/src/enquiries/enquiries.service.ts:159](../../backend/src/enquiries/enquiries.service.ts#L159); EnquiriesService.tenantWhere [backend/src/enquiries/enquiries.service.ts:857](../../backend/src/enquiries/enquiries.service.ts#L857); EnquiriesService.getTenantId [backend/src/enquiries/enquiries.service.ts:861](../../backend/src/enquiries/enquiries.service.ts#L861); EnquiriesService.assertCompletePreliminaryKyc [backend/src/enquiries/enquiries.service.ts:934](../../backend/src/enquiries/enquiries.service.ts#L934); EnquiriesService.optionalText [backend/src/enquiries/enquiries.service.ts:1008](../../backend/src/enquiries/enquiries.service.ts#L1008); EnquiriesService.asArray [backend/src/enquiries/enquiries.service.ts:1004](../../backend/src/enquiries/enquiries.service.ts#L1004); EnquiriesService.ownershipPercentageValue [backend/src/enquiries/enquiries.service.ts:1012](../../backend/src/enquiries/enquiries.service.ts#L1012); EnquiriesService.objectValue [backend/src/enquiries/enquiries.service.ts:1000](../../backend/src/enquiries/enquiries.service.ts#L1000); EnquiriesService.enquiryDisplayName [backend/src/enquiries/enquiries.service.ts:992](../../backend/src/enquiries/enquiries.service.ts#L992); EnquiriesService.hasAnyRole [backend/src/enquiries/enquiries.service.ts:962](../../backend/src/enquiries/enquiries.service.ts#L962).
- QA: apply Q-API for this ID and its workflow-specific cases; store status/body/DB diff with secrets removed.
- DTO field-access candidates: note, status. These span reachable helpers and may include fields of internally composed DTOs; they are not a mandatory field list or complete wire schema. Match to the entry DTO and workflow before constructing requests.

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
- Logic chain: KycService.findAll [backend/src/kyc/kyc.service.ts:63](../../backend/src/kyc/kyc.service.ts#L63); KycService.tenantWhere [backend/src/kyc/kyc.service.ts:2445](../../backend/src/kyc/kyc.service.ts#L2445); KycService.getTenantId [backend/src/kyc/kyc.service.ts:2470](../../backend/src/kyc/kyc.service.ts#L2470); KycService.caseInclude [backend/src/kyc/kyc.service.ts:3420](../../backend/src/kyc/kyc.service.ts#L3420); KycService.withKycNumber [backend/src/kyc/kyc.service.ts:3378](../../backend/src/kyc/kyc.service.ts#L3378); KycService.generatedKycNumber [backend/src/kyc/kyc.service.ts:3362](../../backend/src/kyc/kyc.service.ts#L3362).
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
- Logic chain: KycService.create [backend/src/kyc/kyc.service.ts:112](../../backend/src/kyc/kyc.service.ts#L112); KycService.getTenantId [backend/src/kyc/kyc.service.ts:2470](../../backend/src/kyc/kyc.service.ts#L2470); KycService.nextKycNumber [backend/src/kyc/kyc.service.ts:2449](../../backend/src/kyc/kyc.service.ts#L2449); KycService.caseInclude [backend/src/kyc/kyc.service.ts:3420](../../backend/src/kyc/kyc.service.ts#L3420).
- QA: apply Q-API for this ID and its workflow-specific cases; store status/body/DB diff with secrets removed.
- DTO field-access candidates: clientId, serviceName, title. These span reachable helpers and may include fields of internally composed DTOs; they are not a mandatory field list or complete wire schema. Match to the entry DTO and workflow before constructing requests.

## API-BF74970E

**DELETE /api/kyc/:id** - KycController.remove

- Entry/auth: AuthGuard('jwt'); RolesGuard; fallback roles: COMPANY_ADMIN, SUPER_ADMIN.
- Inputs: `@CurrentUser() user: RequestUser`; `@Param('id') id: string`.
- Output: JSON returned from delegated service; inferred fields in linked implementation. Inferred by TypeScript; no explicit response DTO.
- Behavior: Command (may mutate); detected reachable writes: kycCase.delete.
- Tenant/role/state/validation helper candidates: requireWritableCase, tenantWhere, isLegacyFullKycDraft, formTenantWhere.
- Error branch candidates: NotFoundException: 'KYC case not found'); BadRequestException: 'KYC preparation is locked while the case is under DMLRO, MLRO, or SEF review. It can be edited again only after DMLRO returns it to the AML Supervisor.'); ForbiddenException: 'User is not assigned to a tenant').
- Evidence: [backend/src/kyc/kyc.controller.ts:58](../../backend/src/kyc/kyc.controller.ts#L58).
- Logic chain: KycService.remove [backend/src/kyc/kyc.service.ts:203](../../backend/src/kyc/kyc.service.ts#L203); KycService.requireWritableCase [backend/src/kyc/kyc.service.ts:2342](../../backend/src/kyc/kyc.service.ts#L2342); KycService.tenantWhere [backend/src/kyc/kyc.service.ts:2445](../../backend/src/kyc/kyc.service.ts#L2445); KycService.getTenantId [backend/src/kyc/kyc.service.ts:2470](../../backend/src/kyc/kyc.service.ts#L2470); KycService.isPreparationEditableStatus [backend/src/kyc/kyc.service.ts:2364](../../backend/src/kyc/kyc.service.ts#L2364); KycService.isLegacyFullKycDraft [backend/src/kyc/kyc.service.ts:2358](../../backend/src/kyc/kyc.service.ts#L2358); KycService.formTenantWhere [backend/src/kyc/kyc.service.ts:2462](../../backend/src/kyc/kyc.service.ts#L2462).
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
- Logic chain: KycService.findOne [backend/src/kyc/kyc.service.ts:75](../../backend/src/kyc/kyc.service.ts#L75); KycService.tenantWhere [backend/src/kyc/kyc.service.ts:2445](../../backend/src/kyc/kyc.service.ts#L2445); KycService.getTenantId [backend/src/kyc/kyc.service.ts:2470](../../backend/src/kyc/kyc.service.ts#L2470); KycService.caseInclude [backend/src/kyc/kyc.service.ts:3420](../../backend/src/kyc/kyc.service.ts#L3420); KycService.withKycNumber [backend/src/kyc/kyc.service.ts:3378](../../backend/src/kyc/kyc.service.ts#L3378); KycService.generatedKycNumber [backend/src/kyc/kyc.service.ts:3362](../../backend/src/kyc/kyc.service.ts#L3362).
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
- Logic chain: KycService.update [backend/src/kyc/kyc.service.ts:164](../../backend/src/kyc/kyc.service.ts#L164); KycService.requireWritableCase [backend/src/kyc/kyc.service.ts:2342](../../backend/src/kyc/kyc.service.ts#L2342); KycService.tenantWhere [backend/src/kyc/kyc.service.ts:2445](../../backend/src/kyc/kyc.service.ts#L2445); KycService.getTenantId [backend/src/kyc/kyc.service.ts:2470](../../backend/src/kyc/kyc.service.ts#L2470); KycService.isPreparationEditableStatus [backend/src/kyc/kyc.service.ts:2364](../../backend/src/kyc/kyc.service.ts#L2364); KycService.isLegacyFullKycDraft [backend/src/kyc/kyc.service.ts:2358](../../backend/src/kyc/kyc.service.ts#L2358); KycService.formTenantWhere [backend/src/kyc/kyc.service.ts:2462](../../backend/src/kyc/kyc.service.ts#L2462); KycService.caseInclude [backend/src/kyc/kyc.service.ts:3420](../../backend/src/kyc/kyc.service.ts#L3420).
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
- Evidence: [backend/src/kyc/kyc.controller.ts:378](../../backend/src/kyc/kyc.controller.ts#L378).
- Logic chain: KycService.recalculateActivationReadiness [backend/src/kyc/kyc.service.ts:1087](../../backend/src/kyc/kyc.service.ts#L1087); KycService.tenantWhere [backend/src/kyc/kyc.service.ts:2445](../../backend/src/kyc/kyc.service.ts#L2445); KycService.getTenantId [backend/src/kyc/kyc.service.ts:2470](../../backend/src/kyc/kyc.service.ts#L2470); KycService.activationChecklistItems [backend/src/kyc/kyc.service.ts:3019](../../backend/src/kyc/kyc.service.ts#L3019); KycService.jsonValue [backend/src/kyc/kyc.service.ts:3272](../../backend/src/kyc/kyc.service.ts#L3272).
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
- Evidence: [backend/src/kyc/kyc.controller.ts:400](../../backend/src/kyc/kyc.controller.ts#L400).
- Logic chain: KycService.startAmendment [backend/src/kyc/kyc.service.ts:1336](../../backend/src/kyc/kyc.service.ts#L1336); KycService.findOne [backend/src/kyc/kyc.service.ts:75](../../backend/src/kyc/kyc.service.ts#L75); KycService.tenantWhere [backend/src/kyc/kyc.service.ts:2445](../../backend/src/kyc/kyc.service.ts#L2445); KycService.getTenantId [backend/src/kyc/kyc.service.ts:2470](../../backend/src/kyc/kyc.service.ts#L2470); KycService.caseInclude [backend/src/kyc/kyc.service.ts:3420](../../backend/src/kyc/kyc.service.ts#L3420); KycService.withKycNumber [backend/src/kyc/kyc.service.ts:3378](../../backend/src/kyc/kyc.service.ts#L3378); KycService.generatedKycNumber [backend/src/kyc/kyc.service.ts:3362](../../backend/src/kyc/kyc.service.ts#L3362); KycService.assertFinalApprovalReceived [backend/src/kyc/kyc.service.ts:1399](../../backend/src/kyc/kyc.service.ts#L1399); KycService.hasAnyRole [backend/src/kyc/kyc.service.ts:2482](../../backend/src/kyc/kyc.service.ts#L2482); KycService.optionalText [backend/src/kyc/kyc.service.ts:3240](../../backend/src/kyc/kyc.service.ts#L3240); KycService.text [backend/src/kyc/kyc.service.ts:3285](../../backend/src/kyc/kyc.service.ts#L3285); KycService.beginFormAmendment [backend/src/kyc/kyc.service.ts:1212](../../backend/src/kyc/kyc.service.ts#L1212); KycService.formInclude [backend/src/kyc/kyc.service.ts:2120](../../backend/src/kyc/kyc.service.ts#L2120); KycService.serializeForm [backend/src/kyc/kyc.service.ts:2061](../../backend/src/kyc/kyc.service.ts#L2061); KycService.sectionRows [backend/src/kyc/kyc.service.ts:2148](../../backend/src/kyc/kyc.service.ts#L2148); KycService.asArray [backend/src/kyc/kyc.service.ts:3225](../../backend/src/kyc/kyc.service.ts#L3225); KycService.sectionFWithCaseDocuments [backend/src/kyc/kyc.service.ts:2153](../../backend/src/kyc/kyc.service.ts#L2153); KycService.dedupeRequiredDocumentRows [backend/src/kyc/kyc.service.ts:2235](../../backend/src/kyc/kyc.service.ts#L2235); KycService.documentMatchText [backend/src/kyc/kyc.service.ts:2332](../../backend/src/kyc/kyc.service.ts#L2332); KycService.documentFileNames [backend/src/kyc/kyc.service.ts:2296](../../backend/src/kyc/kyc.service.ts#L2296); KycService.isRequiredDocumentMatch [backend/src/kyc/kyc.service.ts:2311](../../backend/src/kyc/kyc.service.ts#L2311); KycService.dedupeAdditionalDocumentRows [backend/src/kyc/kyc.service.ts:2277](../../backend/src/kyc/kyc.service.ts#L2277); KycService.jsonValue [backend/src/kyc/kyc.service.ts:3272](../../backend/src/kyc/kyc.service.ts#L3272); KycService.resolveLegalDocumentPath [backend/src/kyc/kyc.service.ts:3313](../../backend/src/kyc/kyc.service.ts#L3313); KycService.legalDocumentUploadRoot [backend/src/kyc/kyc.service.ts:3305](../../backend/src/kyc/kyc.service.ts#L3305); KycService.signedKycDocumentUploadRoot [backend/src/kyc/kyc.service.ts:3309](../../backend/src/kyc/kyc.service.ts#L3309); KycService.audit [backend/src/kyc/kyc.service.ts:2890](../../backend/src/kyc/kyc.service.ts#L2890); KycService.recordStatus [backend/src/kyc/kyc.service.ts:2866](../../backend/src/kyc/kyc.service.ts#L2866).
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
- Evidence: [backend/src/kyc/kyc.controller.ts:383](../../backend/src/kyc/kyc.controller.ts#L383).
- Logic chain: KycService.addComment [backend/src/kyc/kyc.service.ts:1126](../../backend/src/kyc/kyc.service.ts#L1126); KycService.findOne [backend/src/kyc/kyc.service.ts:75](../../backend/src/kyc/kyc.service.ts#L75); KycService.tenantWhere [backend/src/kyc/kyc.service.ts:2445](../../backend/src/kyc/kyc.service.ts#L2445); KycService.getTenantId [backend/src/kyc/kyc.service.ts:2470](../../backend/src/kyc/kyc.service.ts#L2470); KycService.caseInclude [backend/src/kyc/kyc.service.ts:3420](../../backend/src/kyc/kyc.service.ts#L3420); KycService.withKycNumber [backend/src/kyc/kyc.service.ts:3378](../../backend/src/kyc/kyc.service.ts#L3378); KycService.generatedKycNumber [backend/src/kyc/kyc.service.ts:3362](../../backend/src/kyc/kyc.service.ts#L3362).
- QA: apply Q-API for this ID and its workflow-specific cases; store status/body/DB diff with secrets removed.
- DTO field-access candidates: body. These span reachable helpers and may include fields of internally composed DTOs; they are not a mandatory field list or complete wire schema. Match to the entry DTO and workflow before constructing requests.

## API-C8A169F1

**POST /api/kyc/:id/engagement-decision** - KycController.completeEngagementDecision

- Entry/auth: AuthGuard('jwt'); RolesGuard; fallback roles: OPERATING_TEAM, COMPANY_ADMIN, SUPER_ADMIN.
- Inputs: `@CurrentUser() user: RequestUser`; `@Param('id') id: string`; `@Body() dto: Record<string, unknown>`.
- Output: JSON returned from delegated service; inferred fields in linked implementation. Inferred by TypeScript; no explicit response DTO.
- Behavior: Command (may mutate); detected reachable writes: client.update, kycCase.update, kycCaseStatusHistory.create.
- Tenant/role/state/validation helper candidates: tenantWhere, enumValue.
- Error branch candidates: BadRequestException: 'The KYC file must receive final approval before the engagement decision.'); BadRequestException: 'Upload the signed engagement letter before completing the engagement decision.'); BadRequestException: 'Provide a reason for rejecting or placing the engagement on hold.'); NotFoundException: 'KYC case not found'); ForbiddenException: 'User is not assigned to a tenant'); BadRequestException: `${label} must be one of ${allowed.join(', ')}`).
- Evidence: [backend/src/kyc/kyc.controller.ts:388](../../backend/src/kyc/kyc.controller.ts#L388).
- Logic chain: KycService.completeEngagementDecision [backend/src/kyc/kyc.service.ts:1141](../../backend/src/kyc/kyc.service.ts#L1141); KycService.findOne [backend/src/kyc/kyc.service.ts:75](../../backend/src/kyc/kyc.service.ts#L75); KycService.tenantWhere [backend/src/kyc/kyc.service.ts:2445](../../backend/src/kyc/kyc.service.ts#L2445); KycService.getTenantId [backend/src/kyc/kyc.service.ts:2470](../../backend/src/kyc/kyc.service.ts#L2470); KycService.caseInclude [backend/src/kyc/kyc.service.ts:3420](../../backend/src/kyc/kyc.service.ts#L3420); KycService.withKycNumber [backend/src/kyc/kyc.service.ts:3378](../../backend/src/kyc/kyc.service.ts#L3378); KycService.generatedKycNumber [backend/src/kyc/kyc.service.ts:3362](../../backend/src/kyc/kyc.service.ts#L3362); KycService.enumValue [backend/src/kyc/kyc.service.ts:3217](../../backend/src/kyc/kyc.service.ts#L3217); KycService.optionalText [backend/src/kyc/kyc.service.ts:3240](../../backend/src/kyc/kyc.service.ts#L3240); KycService.text [backend/src/kyc/kyc.service.ts:3285](../../backend/src/kyc/kyc.service.ts#L3285); KycService.updateStatus [backend/src/kyc/kyc.service.ts:2404](../../backend/src/kyc/kyc.service.ts#L2404).
- QA: apply Q-API for this ID and its workflow-specific cases; store status/body/DB diff with secrets removed.
- DTO field-access candidates: decision, reason. These span reachable helpers and may include fields of internally composed DTOs; they are not a mandatory field list or complete wire schema. Match to the entry DTO and workflow before constructing requests.

## API-B62F552C

**POST /api/kyc/:id/final-kyc-decision** - KycController.completeFinalKycDecision

- Entry/auth: AuthGuard('jwt'); RolesGuard; fallback roles: AML_SUPERVISOR, AML_TEAM, DMLRO, MLRO, SEF, COMPANY_ADMIN, SUPER_ADMIN.
- Inputs: `@CurrentUser() user: RequestUser`; `@Param('id') id: string`; `@Body() dto: Record<string, unknown>`.
- Output: JSON returned from delegated service; inferred fields in linked implementation. Inferred by TypeScript; no explicit response DTO.
- Behavior: Command (may mutate); detected reachable writes: kycForm.updateMany, internalReviewSubmission.updateMany, internalReviewTask.upsert, workflowComment.create, kycFormRevision.create, kycRevisionFile.create, kycSectionData.upsert, kycForm.update, kycInternalReview.updateMany, signedKycDocument.updateMany, auditLog.create, kycCase.update, kycCaseStatusHistory.create, internalReviewTask.deleteMany, internalReviewTask.createMany, notification.create.
- Tenant/role/state/validation helper candidates: enumValue, tenantWhere, assertFinalApprovalReceived, hasAnyRole.
- Error branch candidates: ForbiddenException: 'Only AML Supervisor, DMLRO or MLRO can decide whether the approved Preliminary KYC is final.'); ForbiddenException: 'The final KYC decision must be completed by the approving MLRO or SEF role.'); BadRequestException: `${label} must be one of ${allowed.join(', ')}`); NotFoundException: 'KYC case not found'); ForbiddenException: 'User is not assigned to a tenant'); BadRequestException: 'The final KYC decision is available only after all required approvals are completed.'); BadRequestException: 'The case changed during this action. Refresh before trying again.'); BadRequestException: 'Create the KYC form before opening an amendment.'); BadRequestException: 'Select at least one KYC section to amend.'); BadRequestException: 'Provide the amendment reason.').
- Evidence: [backend/src/kyc/kyc.controller.ts:394](../../backend/src/kyc/kyc.controller.ts#L394).
- Logic chain: KycService.completeFinalKycDecision [backend/src/kyc/kyc.service.ts:1176](../../backend/src/kyc/kyc.service.ts#L1176); KycService.enumValue [backend/src/kyc/kyc.service.ts:3217](../../backend/src/kyc/kyc.service.ts#L3217); KycService.findOne [backend/src/kyc/kyc.service.ts:75](../../backend/src/kyc/kyc.service.ts#L75); KycService.tenantWhere [backend/src/kyc/kyc.service.ts:2445](../../backend/src/kyc/kyc.service.ts#L2445); KycService.getTenantId [backend/src/kyc/kyc.service.ts:2470](../../backend/src/kyc/kyc.service.ts#L2470); KycService.caseInclude [backend/src/kyc/kyc.service.ts:3420](../../backend/src/kyc/kyc.service.ts#L3420); KycService.withKycNumber [backend/src/kyc/kyc.service.ts:3378](../../backend/src/kyc/kyc.service.ts#L3378); KycService.generatedKycNumber [backend/src/kyc/kyc.service.ts:3362](../../backend/src/kyc/kyc.service.ts#L3362); KycService.isPreliminaryProposedCompanyCase [backend/src/kyc/kyc.service.ts:1393](../../backend/src/kyc/kyc.service.ts#L1393); KycService.assertFinalApprovalReceived [backend/src/kyc/kyc.service.ts:1399](../../backend/src/kyc/kyc.service.ts#L1399); KycService.hasAnyRole [backend/src/kyc/kyc.service.ts:2482](../../backend/src/kyc/kyc.service.ts#L2482); KycService.startPreliminaryFullKyc [backend/src/kyc/kyc.service.ts:1377](../../backend/src/kyc/kyc.service.ts#L1377); KycService.optionalText [backend/src/kyc/kyc.service.ts:3240](../../backend/src/kyc/kyc.service.ts#L3240); KycService.text [backend/src/kyc/kyc.service.ts:3285](../../backend/src/kyc/kyc.service.ts#L3285); KycService.beginFormAmendment [backend/src/kyc/kyc.service.ts:1212](../../backend/src/kyc/kyc.service.ts#L1212); KycService.formInclude [backend/src/kyc/kyc.service.ts:2120](../../backend/src/kyc/kyc.service.ts#L2120); KycService.serializeForm [backend/src/kyc/kyc.service.ts:2061](../../backend/src/kyc/kyc.service.ts#L2061); KycService.sectionRows [backend/src/kyc/kyc.service.ts:2148](../../backend/src/kyc/kyc.service.ts#L2148); KycService.asArray [backend/src/kyc/kyc.service.ts:3225](../../backend/src/kyc/kyc.service.ts#L3225); KycService.sectionFWithCaseDocuments [backend/src/kyc/kyc.service.ts:2153](../../backend/src/kyc/kyc.service.ts#L2153); KycService.dedupeRequiredDocumentRows [backend/src/kyc/kyc.service.ts:2235](../../backend/src/kyc/kyc.service.ts#L2235); KycService.documentMatchText [backend/src/kyc/kyc.service.ts:2332](../../backend/src/kyc/kyc.service.ts#L2332); KycService.documentFileNames [backend/src/kyc/kyc.service.ts:2296](../../backend/src/kyc/kyc.service.ts#L2296); KycService.isRequiredDocumentMatch [backend/src/kyc/kyc.service.ts:2311](../../backend/src/kyc/kyc.service.ts#L2311); KycService.dedupeAdditionalDocumentRows [backend/src/kyc/kyc.service.ts:2277](../../backend/src/kyc/kyc.service.ts#L2277); KycService.jsonValue [backend/src/kyc/kyc.service.ts:3272](../../backend/src/kyc/kyc.service.ts#L3272); KycService.resolveLegalDocumentPath [backend/src/kyc/kyc.service.ts:3313](../../backend/src/kyc/kyc.service.ts#L3313); KycService.legalDocumentUploadRoot [backend/src/kyc/kyc.service.ts:3305](../../backend/src/kyc/kyc.service.ts#L3305); KycService.signedKycDocumentUploadRoot [backend/src/kyc/kyc.service.ts:3309](../../backend/src/kyc/kyc.service.ts#L3309); KycService.audit [backend/src/kyc/kyc.service.ts:2890](../../backend/src/kyc/kyc.service.ts#L2890); KycService.recordStatus [backend/src/kyc/kyc.service.ts:2866](../../backend/src/kyc/kyc.service.ts#L2866); KycService.routePreliminaryFinalKycForApproval [backend/src/kyc/kyc.service.ts:1364](../../backend/src/kyc/kyc.service.ts#L1364); KycService.createNotification [backend/src/kyc/kyc.service.ts:2903](../../backend/src/kyc/kyc.service.ts#L2903); KycService.startAmendment [backend/src/kyc/kyc.service.ts:1336](../../backend/src/kyc/kyc.service.ts#L1336).
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
- Logic chain: KycService.getForm [backend/src/kyc/kyc.service.ts:1440](../../backend/src/kyc/kyc.service.ts#L1440); KycService.findOne [backend/src/kyc/kyc.service.ts:75](../../backend/src/kyc/kyc.service.ts#L75); KycService.tenantWhere [backend/src/kyc/kyc.service.ts:2445](../../backend/src/kyc/kyc.service.ts#L2445); KycService.getTenantId [backend/src/kyc/kyc.service.ts:2470](../../backend/src/kyc/kyc.service.ts#L2470); KycService.caseInclude [backend/src/kyc/kyc.service.ts:3420](../../backend/src/kyc/kyc.service.ts#L3420); KycService.withKycNumber [backend/src/kyc/kyc.service.ts:3378](../../backend/src/kyc/kyc.service.ts#L3378); KycService.generatedKycNumber [backend/src/kyc/kyc.service.ts:3362](../../backend/src/kyc/kyc.service.ts#L3362); KycService.formInclude [backend/src/kyc/kyc.service.ts:2120](../../backend/src/kyc/kyc.service.ts#L2120); KycService.serializeForm [backend/src/kyc/kyc.service.ts:2061](../../backend/src/kyc/kyc.service.ts#L2061); KycService.sectionRows [backend/src/kyc/kyc.service.ts:2148](../../backend/src/kyc/kyc.service.ts#L2148); KycService.asArray [backend/src/kyc/kyc.service.ts:3225](../../backend/src/kyc/kyc.service.ts#L3225); KycService.text [backend/src/kyc/kyc.service.ts:3285](../../backend/src/kyc/kyc.service.ts#L3285); KycService.sectionFWithCaseDocuments [backend/src/kyc/kyc.service.ts:2153](../../backend/src/kyc/kyc.service.ts#L2153); KycService.dedupeRequiredDocumentRows [backend/src/kyc/kyc.service.ts:2235](../../backend/src/kyc/kyc.service.ts#L2235); KycService.optionalText [backend/src/kyc/kyc.service.ts:3240](../../backend/src/kyc/kyc.service.ts#L3240); KycService.documentMatchText [backend/src/kyc/kyc.service.ts:2332](../../backend/src/kyc/kyc.service.ts#L2332); KycService.documentFileNames [backend/src/kyc/kyc.service.ts:2296](../../backend/src/kyc/kyc.service.ts#L2296); KycService.isRequiredDocumentMatch [backend/src/kyc/kyc.service.ts:2311](../../backend/src/kyc/kyc.service.ts#L2311); KycService.dedupeAdditionalDocumentRows [backend/src/kyc/kyc.service.ts:2277](../../backend/src/kyc/kyc.service.ts#L2277); KycService.ensureKycNumber [backend/src/kyc/kyc.service.ts:3332](../../backend/src/kyc/kyc.service.ts#L3332); KycService.jsonValue [backend/src/kyc/kyc.service.ts:3272](../../backend/src/kyc/kyc.service.ts#L3272); KycService.createForm [backend/src/kyc/kyc.service.ts:1424](../../backend/src/kyc/kyc.service.ts#L1424).
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
- Logic chain: KycService.createForm [backend/src/kyc/kyc.service.ts:1424](../../backend/src/kyc/kyc.service.ts#L1424); KycService.findOne [backend/src/kyc/kyc.service.ts:75](../../backend/src/kyc/kyc.service.ts#L75); KycService.tenantWhere [backend/src/kyc/kyc.service.ts:2445](../../backend/src/kyc/kyc.service.ts#L2445); KycService.getTenantId [backend/src/kyc/kyc.service.ts:2470](../../backend/src/kyc/kyc.service.ts#L2470); KycService.caseInclude [backend/src/kyc/kyc.service.ts:3420](../../backend/src/kyc/kyc.service.ts#L3420); KycService.withKycNumber [backend/src/kyc/kyc.service.ts:3378](../../backend/src/kyc/kyc.service.ts#L3378); KycService.generatedKycNumber [backend/src/kyc/kyc.service.ts:3362](../../backend/src/kyc/kyc.service.ts#L3362); KycService.formInclude [backend/src/kyc/kyc.service.ts:2120](../../backend/src/kyc/kyc.service.ts#L2120).
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
- Logic chain: KycService.autoSaveForm [backend/src/kyc/kyc.service.ts:1455](../../backend/src/kyc/kyc.service.ts#L1455); KycService.assertFormReviewEditable [backend/src/kyc/kyc.service.ts:3073](../../backend/src/kyc/kyc.service.ts#L3073); KycService.findOne [backend/src/kyc/kyc.service.ts:75](../../backend/src/kyc/kyc.service.ts#L75); KycService.tenantWhere [backend/src/kyc/kyc.service.ts:2445](../../backend/src/kyc/kyc.service.ts#L2445); KycService.getTenantId [backend/src/kyc/kyc.service.ts:2470](../../backend/src/kyc/kyc.service.ts#L2470); KycService.caseInclude [backend/src/kyc/kyc.service.ts:3420](../../backend/src/kyc/kyc.service.ts#L3420); KycService.withKycNumber [backend/src/kyc/kyc.service.ts:3378](../../backend/src/kyc/kyc.service.ts#L3378); KycService.generatedKycNumber [backend/src/kyc/kyc.service.ts:3362](../../backend/src/kyc/kyc.service.ts#L3362); KycService.hasAnyRole [backend/src/kyc/kyc.service.ts:2482](../../backend/src/kyc/kyc.service.ts#L2482); KycService.assertStageRole [backend/src/kyc/kyc.service.ts:2486](../../backend/src/kyc/kyc.service.ts#L2486); KycService.stageLabel [backend/src/kyc/kyc.service.ts:2499](../../backend/src/kyc/kyc.service.ts#L2499); KycService.requireWritableCase [backend/src/kyc/kyc.service.ts:2342](../../backend/src/kyc/kyc.service.ts#L2342); KycService.isPreparationEditableStatus [backend/src/kyc/kyc.service.ts:2364](../../backend/src/kyc/kyc.service.ts#L2364); KycService.isLegacyFullKycDraft [backend/src/kyc/kyc.service.ts:2358](../../backend/src/kyc/kyc.service.ts#L2358); KycService.formTenantWhere [backend/src/kyc/kyc.service.ts:2462](../../backend/src/kyc/kyc.service.ts#L2462); KycService.stageStatus [backend/src/kyc/kyc.service.ts:2505](../../backend/src/kyc/kyc.service.ts#L2505); KycService.assertReviewStageActive [backend/src/kyc/kyc.service.ts:2558](../../backend/src/kyc/kyc.service.ts#L2558); KycService.assertEditableReview [backend/src/kyc/kyc.service.ts:2548](../../backend/src/kyc/kyc.service.ts#L2548); KycService.saveSectionData [backend/src/kyc/kyc.service.ts:1975](../../backend/src/kyc/kyc.service.ts#L1975); KycService.requireWritableForm [backend/src/kyc/kyc.service.ts:2004](../../backend/src/kyc/kyc.service.ts#L2004); KycService.createForm [backend/src/kyc/kyc.service.ts:1424](../../backend/src/kyc/kyc.service.ts#L1424); KycService.formInclude [backend/src/kyc/kyc.service.ts:2120](../../backend/src/kyc/kyc.service.ts#L2120); KycService.jsonValue [backend/src/kyc/kyc.service.ts:3272](../../backend/src/kyc/kyc.service.ts#L3272); KycService.getForm [backend/src/kyc/kyc.service.ts:1440](../../backend/src/kyc/kyc.service.ts#L1440); KycService.serializeForm [backend/src/kyc/kyc.service.ts:2061](../../backend/src/kyc/kyc.service.ts#L2061); KycService.sectionRows [backend/src/kyc/kyc.service.ts:2148](../../backend/src/kyc/kyc.service.ts#L2148); KycService.asArray [backend/src/kyc/kyc.service.ts:3225](../../backend/src/kyc/kyc.service.ts#L3225); KycService.text [backend/src/kyc/kyc.service.ts:3285](../../backend/src/kyc/kyc.service.ts#L3285); KycService.sectionFWithCaseDocuments [backend/src/kyc/kyc.service.ts:2153](../../backend/src/kyc/kyc.service.ts#L2153); KycService.dedupeRequiredDocumentRows [backend/src/kyc/kyc.service.ts:2235](../../backend/src/kyc/kyc.service.ts#L2235); KycService.optionalText [backend/src/kyc/kyc.service.ts:3240](../../backend/src/kyc/kyc.service.ts#L3240); KycService.documentMatchText [backend/src/kyc/kyc.service.ts:2332](../../backend/src/kyc/kyc.service.ts#L2332); KycService.documentFileNames [backend/src/kyc/kyc.service.ts:2296](../../backend/src/kyc/kyc.service.ts#L2296); KycService.isRequiredDocumentMatch [backend/src/kyc/kyc.service.ts:2311](../../backend/src/kyc/kyc.service.ts#L2311); KycService.dedupeAdditionalDocumentRows [backend/src/kyc/kyc.service.ts:2277](../../backend/src/kyc/kyc.service.ts#L2277); KycService.ensureKycNumber [backend/src/kyc/kyc.service.ts:3332](../../backend/src/kyc/kyc.service.ts#L3332); KycService.saveOwnership [backend/src/kyc/kyc.service.ts:1491](../../backend/src/kyc/kyc.service.ts#L1491); KycService.hasRowValue [backend/src/kyc/kyc.service.ts:3229](../../backend/src/kyc/kyc.service.ts#L3229); KycService.numberValue [backend/src/kyc/kyc.service.ts:3258](../../backend/src/kyc/kyc.service.ts#L3258); KycService.requiredText [backend/src/kyc/kyc.service.ts:3233](../../backend/src/kyc/kyc.service.ts#L3233); KycService.optionText [backend/src/kyc/kyc.service.ts:3293](../../backend/src/kyc/kyc.service.ts#L3293); KycService.dateValue [backend/src/kyc/kyc.service.ts:3249](../../backend/src/kyc/kyc.service.ts#L3249); KycService.decimalValue [backend/src/kyc/kyc.service.ts:3267](../../backend/src/kyc/kyc.service.ts#L3267); KycService.saveManagers [backend/src/kyc/kyc.service.ts:1586](../../backend/src/kyc/kyc.service.ts#L1586); KycService.saveRequiredDocuments [backend/src/kyc/kyc.service.ts:1634](../../backend/src/kyc/kyc.service.ts#L1634); KycService.syncRequiredDocumentsToLegalDocuments [backend/src/kyc/kyc.service.ts:1694](../../backend/src/kyc/kyc.service.ts#L1694); KycService.legalDocumentSyncKey [backend/src/kyc/kyc.service.ts:3416](../../backend/src/kyc/kyc.service.ts#L3416); KycService.markDocumentsUploadedFromSectionF [backend/src/kyc/kyc.service.ts:1754](../../backend/src/kyc/kyc.service.ts#L1754); KycService.saveInternalReview [backend/src/kyc/kyc.service.ts:1798](../../backend/src/kyc/kyc.service.ts#L1798); KycService.internalReviewAllowedRoles [backend/src/kyc/kyc.service.ts:3094](../../backend/src/kyc/kyc.service.ts#L3094); KycService.internalReviewData [backend/src/kyc/kyc.service.ts:3103](../../backend/src/kyc/kyc.service.ts#L3103); KycService.enumValue [backend/src/kyc/kyc.service.ts:3217](../../backend/src/kyc/kyc.service.ts#L3217).
- QA: apply Q-API for this ID and its workflow-specific cases; store status/body/DB diff with secrets removed.
- DTO field-access candidates: additionalDocuments, amlAccuracyChecked, amlClarificationFindings, amlDate, amlName, amlSignatureDataUrl, amlSignatureFileName, dmlroComments, dmlroConditions, dmlroDate, dmlroDecision, dmlroName, dmlroReason, dmlroRiskClassification, dmlroSignatureDataUrl, dmlroSignatureFileName, documents, dueDiligenceType, expectedVersion, managers, mlroComments, mlroConditions, mlroDate, mlroDecision, mlroFinalRiskClassification, mlroName, mlroRiskExplanation, mlroRiskReasonCategory, mlroSignatureDataUrl, mlroSignatureFileName, reviewPart, riskClassification, sefComments, sefConditions, sefDate, sefDecision, sefName, sefSignatureDataUrl, sefSignatureFileName, shareholders, uboDifferentFromShareholders, uboGroupStructureNotes, ubos, uploadedFilesNote. These span reachable helpers and may include fields of internally composed DTOs; they are not a mandatory field list or complete wire schema. Match to the entry DTO and workflow before constructing requests.

## API-490F75DE

**POST /api/kyc/:id/form/generate-docx** - KycController.generateDocx

- Entry/auth: AuthGuard('jwt'); RolesGuard; fallback roles: AML_TEAM, AML_SUPERVISOR, DMLRO, MLRO, SEF, COMPANY_ADMIN, SUPER_ADMIN.
- Inputs: `@CurrentUser() user: RequestUser`; `@Param('id') id: string`.
- Output: JSON returned from delegated service; inferred fields in linked implementation. Inferred by TypeScript; no explicit response DTO.
- Behavior: Command (may mutate); detected reachable writes: kycGeneratedDocument.create, kycForm.upsert, auditLog.create.
- Tenant/role/state/validation helper candidates: formTenantWhere, tenantWhere.
- Error branch candidates: InternalServerErrorException: 'Unable to store the generated KYC document'); ForbiddenException: 'User is not assigned to a tenant'); NotFoundException: 'KYC case not found').
- Evidence: [backend/src/kyc/kyc.controller.ts:162](../../backend/src/kyc/kyc.controller.ts#L162).
- Logic chain: KycService.generateDocument [backend/src/kyc/kyc.service.ts:1825](../../backend/src/kyc/kyc.service.ts#L1825); KycService.getFormRecord [backend/src/kyc/kyc.service.ts:2047](../../backend/src/kyc/kyc.service.ts#L2047); KycService.formTenantWhere [backend/src/kyc/kyc.service.ts:2462](../../backend/src/kyc/kyc.service.ts#L2462); KycService.getTenantId [backend/src/kyc/kyc.service.ts:2470](../../backend/src/kyc/kyc.service.ts#L2470); KycService.formInclude [backend/src/kyc/kyc.service.ts:2120](../../backend/src/kyc/kyc.service.ts#L2120); KycService.createForm [backend/src/kyc/kyc.service.ts:1424](../../backend/src/kyc/kyc.service.ts#L1424); KycService.findOne [backend/src/kyc/kyc.service.ts:75](../../backend/src/kyc/kyc.service.ts#L75); KycService.tenantWhere [backend/src/kyc/kyc.service.ts:2445](../../backend/src/kyc/kyc.service.ts#L2445); KycService.caseInclude [backend/src/kyc/kyc.service.ts:3420](../../backend/src/kyc/kyc.service.ts#L3420); KycService.withKycNumber [backend/src/kyc/kyc.service.ts:3378](../../backend/src/kyc/kyc.service.ts#L3378); KycService.generatedKycNumber [backend/src/kyc/kyc.service.ts:3362](../../backend/src/kyc/kyc.service.ts#L3362); KycService.serializeForm [backend/src/kyc/kyc.service.ts:2061](../../backend/src/kyc/kyc.service.ts#L2061); KycService.sectionRows [backend/src/kyc/kyc.service.ts:2148](../../backend/src/kyc/kyc.service.ts#L2148); KycService.asArray [backend/src/kyc/kyc.service.ts:3225](../../backend/src/kyc/kyc.service.ts#L3225); KycService.text [backend/src/kyc/kyc.service.ts:3285](../../backend/src/kyc/kyc.service.ts#L3285); KycService.sectionFWithCaseDocuments [backend/src/kyc/kyc.service.ts:2153](../../backend/src/kyc/kyc.service.ts#L2153); KycService.dedupeRequiredDocumentRows [backend/src/kyc/kyc.service.ts:2235](../../backend/src/kyc/kyc.service.ts#L2235); KycService.optionalText [backend/src/kyc/kyc.service.ts:3240](../../backend/src/kyc/kyc.service.ts#L3240); KycService.documentMatchText [backend/src/kyc/kyc.service.ts:2332](../../backend/src/kyc/kyc.service.ts#L2332); KycService.documentFileNames [backend/src/kyc/kyc.service.ts:2296](../../backend/src/kyc/kyc.service.ts#L2296); KycService.isRequiredDocumentMatch [backend/src/kyc/kyc.service.ts:2311](../../backend/src/kyc/kyc.service.ts#L2311); KycService.dedupeAdditionalDocumentRows [backend/src/kyc/kyc.service.ts:2277](../../backend/src/kyc/kyc.service.ts#L2277); KycService.safeFileName [backend/src/kyc/kyc.service.ts:3385](../../backend/src/kyc/kyc.service.ts#L3385); KycService.nextGeneratedVersion [backend/src/kyc/kyc.service.ts:3276](../../backend/src/kyc/kyc.service.ts#L3276); KycService.audit [backend/src/kyc/kyc.service.ts:2890](../../backend/src/kyc/kyc.service.ts#L2890); KycService.jsonValue [backend/src/kyc/kyc.service.ts:3272](../../backend/src/kyc/kyc.service.ts#L3272).
- QA: apply Q-API for this ID and its workflow-specific cases; store status/body/DB diff with secrets removed.
- DTO field-access candidates: none resolved. These span reachable helpers and may include fields of internally composed DTOs; they are not a mandatory field list or complete wire schema. Match to the entry DTO and workflow before constructing requests.

## API-DD13B530

**POST /api/kyc/:id/form/generate-pdf** - KycController.generatePdf

- Entry/auth: AuthGuard('jwt'); RolesGuard; fallback roles: AML_TEAM, AML_SUPERVISOR, DMLRO, MLRO, SEF, COMPANY_ADMIN, SUPER_ADMIN.
- Inputs: `@CurrentUser() user: RequestUser`; `@Param('id') id: string`.
- Output: JSON returned from delegated service; inferred fields in linked implementation. Inferred by TypeScript; no explicit response DTO.
- Behavior: Command (may mutate); detected reachable writes: kycGeneratedDocument.create, kycForm.upsert, auditLog.create.
- Tenant/role/state/validation helper candidates: formTenantWhere, tenantWhere.
- Error branch candidates: InternalServerErrorException: 'Unable to store the generated KYC document'); ForbiddenException: 'User is not assigned to a tenant'); NotFoundException: 'KYC case not found').
- Evidence: [backend/src/kyc/kyc.controller.ts:168](../../backend/src/kyc/kyc.controller.ts#L168).
- Logic chain: KycService.generateDocument [backend/src/kyc/kyc.service.ts:1825](../../backend/src/kyc/kyc.service.ts#L1825); KycService.getFormRecord [backend/src/kyc/kyc.service.ts:2047](../../backend/src/kyc/kyc.service.ts#L2047); KycService.formTenantWhere [backend/src/kyc/kyc.service.ts:2462](../../backend/src/kyc/kyc.service.ts#L2462); KycService.getTenantId [backend/src/kyc/kyc.service.ts:2470](../../backend/src/kyc/kyc.service.ts#L2470); KycService.formInclude [backend/src/kyc/kyc.service.ts:2120](../../backend/src/kyc/kyc.service.ts#L2120); KycService.createForm [backend/src/kyc/kyc.service.ts:1424](../../backend/src/kyc/kyc.service.ts#L1424); KycService.findOne [backend/src/kyc/kyc.service.ts:75](../../backend/src/kyc/kyc.service.ts#L75); KycService.tenantWhere [backend/src/kyc/kyc.service.ts:2445](../../backend/src/kyc/kyc.service.ts#L2445); KycService.caseInclude [backend/src/kyc/kyc.service.ts:3420](../../backend/src/kyc/kyc.service.ts#L3420); KycService.withKycNumber [backend/src/kyc/kyc.service.ts:3378](../../backend/src/kyc/kyc.service.ts#L3378); KycService.generatedKycNumber [backend/src/kyc/kyc.service.ts:3362](../../backend/src/kyc/kyc.service.ts#L3362); KycService.serializeForm [backend/src/kyc/kyc.service.ts:2061](../../backend/src/kyc/kyc.service.ts#L2061); KycService.sectionRows [backend/src/kyc/kyc.service.ts:2148](../../backend/src/kyc/kyc.service.ts#L2148); KycService.asArray [backend/src/kyc/kyc.service.ts:3225](../../backend/src/kyc/kyc.service.ts#L3225); KycService.text [backend/src/kyc/kyc.service.ts:3285](../../backend/src/kyc/kyc.service.ts#L3285); KycService.sectionFWithCaseDocuments [backend/src/kyc/kyc.service.ts:2153](../../backend/src/kyc/kyc.service.ts#L2153); KycService.dedupeRequiredDocumentRows [backend/src/kyc/kyc.service.ts:2235](../../backend/src/kyc/kyc.service.ts#L2235); KycService.optionalText [backend/src/kyc/kyc.service.ts:3240](../../backend/src/kyc/kyc.service.ts#L3240); KycService.documentMatchText [backend/src/kyc/kyc.service.ts:2332](../../backend/src/kyc/kyc.service.ts#L2332); KycService.documentFileNames [backend/src/kyc/kyc.service.ts:2296](../../backend/src/kyc/kyc.service.ts#L2296); KycService.isRequiredDocumentMatch [backend/src/kyc/kyc.service.ts:2311](../../backend/src/kyc/kyc.service.ts#L2311); KycService.dedupeAdditionalDocumentRows [backend/src/kyc/kyc.service.ts:2277](../../backend/src/kyc/kyc.service.ts#L2277); KycService.safeFileName [backend/src/kyc/kyc.service.ts:3385](../../backend/src/kyc/kyc.service.ts#L3385); KycService.nextGeneratedVersion [backend/src/kyc/kyc.service.ts:3276](../../backend/src/kyc/kyc.service.ts#L3276); KycService.audit [backend/src/kyc/kyc.service.ts:2890](../../backend/src/kyc/kyc.service.ts#L2890); KycService.jsonValue [backend/src/kyc/kyc.service.ts:3272](../../backend/src/kyc/kyc.service.ts#L3272).
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
- Logic chain: KycService.downloadGeneratedDocument [backend/src/kyc/kyc.service.ts:1878](../../backend/src/kyc/kyc.service.ts#L1878); KycService.findOne [backend/src/kyc/kyc.service.ts:75](../../backend/src/kyc/kyc.service.ts#L75); KycService.tenantWhere [backend/src/kyc/kyc.service.ts:2445](../../backend/src/kyc/kyc.service.ts#L2445); KycService.getTenantId [backend/src/kyc/kyc.service.ts:2470](../../backend/src/kyc/kyc.service.ts#L2470); KycService.caseInclude [backend/src/kyc/kyc.service.ts:3420](../../backend/src/kyc/kyc.service.ts#L3420); KycService.withKycNumber [backend/src/kyc/kyc.service.ts:3378](../../backend/src/kyc/kyc.service.ts#L3378); KycService.generatedKycNumber [backend/src/kyc/kyc.service.ts:3362](../../backend/src/kyc/kyc.service.ts#L3362); KycService.generatedTenantWhere [backend/src/kyc/kyc.service.ts:2466](../../backend/src/kyc/kyc.service.ts#L2466); KycService.audit [backend/src/kyc/kyc.service.ts:2890](../../backend/src/kyc/kyc.service.ts#L2890); KycService.jsonValue [backend/src/kyc/kyc.service.ts:3272](../../backend/src/kyc/kyc.service.ts#L3272).
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
- Logic chain: KycService.getFormRevisions [backend/src/kyc/kyc.service.ts:1295](../../backend/src/kyc/kyc.service.ts#L1295); KycService.getFormRecord [backend/src/kyc/kyc.service.ts:2047](../../backend/src/kyc/kyc.service.ts#L2047); KycService.formTenantWhere [backend/src/kyc/kyc.service.ts:2462](../../backend/src/kyc/kyc.service.ts#L2462); KycService.getTenantId [backend/src/kyc/kyc.service.ts:2470](../../backend/src/kyc/kyc.service.ts#L2470); KycService.formInclude [backend/src/kyc/kyc.service.ts:2120](../../backend/src/kyc/kyc.service.ts#L2120); KycService.createForm [backend/src/kyc/kyc.service.ts:1424](../../backend/src/kyc/kyc.service.ts#L1424); KycService.findOne [backend/src/kyc/kyc.service.ts:75](../../backend/src/kyc/kyc.service.ts#L75); KycService.tenantWhere [backend/src/kyc/kyc.service.ts:2445](../../backend/src/kyc/kyc.service.ts#L2445); KycService.caseInclude [backend/src/kyc/kyc.service.ts:3420](../../backend/src/kyc/kyc.service.ts#L3420); KycService.withKycNumber [backend/src/kyc/kyc.service.ts:3378](../../backend/src/kyc/kyc.service.ts#L3378); KycService.generatedKycNumber [backend/src/kyc/kyc.service.ts:3362](../../backend/src/kyc/kyc.service.ts#L3362).
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
- Logic chain: KycService.getFormRevision [backend/src/kyc/kyc.service.ts:1303](../../backend/src/kyc/kyc.service.ts#L1303); KycService.getFormRecord [backend/src/kyc/kyc.service.ts:2047](../../backend/src/kyc/kyc.service.ts#L2047); KycService.formTenantWhere [backend/src/kyc/kyc.service.ts:2462](../../backend/src/kyc/kyc.service.ts#L2462); KycService.getTenantId [backend/src/kyc/kyc.service.ts:2470](../../backend/src/kyc/kyc.service.ts#L2470); KycService.formInclude [backend/src/kyc/kyc.service.ts:2120](../../backend/src/kyc/kyc.service.ts#L2120); KycService.createForm [backend/src/kyc/kyc.service.ts:1424](../../backend/src/kyc/kyc.service.ts#L1424); KycService.findOne [backend/src/kyc/kyc.service.ts:75](../../backend/src/kyc/kyc.service.ts#L75); KycService.tenantWhere [backend/src/kyc/kyc.service.ts:2445](../../backend/src/kyc/kyc.service.ts#L2445); KycService.caseInclude [backend/src/kyc/kyc.service.ts:3420](../../backend/src/kyc/kyc.service.ts#L3420); KycService.withKycNumber [backend/src/kyc/kyc.service.ts:3378](../../backend/src/kyc/kyc.service.ts#L3378); KycService.generatedKycNumber [backend/src/kyc/kyc.service.ts:3362](../../backend/src/kyc/kyc.service.ts#L3362).
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
- Logic chain: KycService.downloadFormRevision [backend/src/kyc/kyc.service.ts:1320](../../backend/src/kyc/kyc.service.ts#L1320); KycService.getFormRevision [backend/src/kyc/kyc.service.ts:1303](../../backend/src/kyc/kyc.service.ts#L1303); KycService.getFormRecord [backend/src/kyc/kyc.service.ts:2047](../../backend/src/kyc/kyc.service.ts#L2047); KycService.formTenantWhere [backend/src/kyc/kyc.service.ts:2462](../../backend/src/kyc/kyc.service.ts#L2462); KycService.getTenantId [backend/src/kyc/kyc.service.ts:2470](../../backend/src/kyc/kyc.service.ts#L2470); KycService.formInclude [backend/src/kyc/kyc.service.ts:2120](../../backend/src/kyc/kyc.service.ts#L2120); KycService.createForm [backend/src/kyc/kyc.service.ts:1424](../../backend/src/kyc/kyc.service.ts#L1424); KycService.findOne [backend/src/kyc/kyc.service.ts:75](../../backend/src/kyc/kyc.service.ts#L75); KycService.tenantWhere [backend/src/kyc/kyc.service.ts:2445](../../backend/src/kyc/kyc.service.ts#L2445); KycService.caseInclude [backend/src/kyc/kyc.service.ts:3420](../../backend/src/kyc/kyc.service.ts#L3420); KycService.withKycNumber [backend/src/kyc/kyc.service.ts:3378](../../backend/src/kyc/kyc.service.ts#L3378); KycService.generatedKycNumber [backend/src/kyc/kyc.service.ts:3362](../../backend/src/kyc/kyc.service.ts#L3362); KycService.audit [backend/src/kyc/kyc.service.ts:2890](../../backend/src/kyc/kyc.service.ts#L2890); KycService.jsonValue [backend/src/kyc/kyc.service.ts:3272](../../backend/src/kyc/kyc.service.ts#L3272).
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
- Logic chain: KycService.downloadRevisionFile [backend/src/kyc/kyc.service.ts:1313](../../backend/src/kyc/kyc.service.ts#L1313); KycService.getFormRevision [backend/src/kyc/kyc.service.ts:1303](../../backend/src/kyc/kyc.service.ts#L1303); KycService.getFormRecord [backend/src/kyc/kyc.service.ts:2047](../../backend/src/kyc/kyc.service.ts#L2047); KycService.formTenantWhere [backend/src/kyc/kyc.service.ts:2462](../../backend/src/kyc/kyc.service.ts#L2462); KycService.getTenantId [backend/src/kyc/kyc.service.ts:2470](../../backend/src/kyc/kyc.service.ts#L2470); KycService.formInclude [backend/src/kyc/kyc.service.ts:2120](../../backend/src/kyc/kyc.service.ts#L2120); KycService.createForm [backend/src/kyc/kyc.service.ts:1424](../../backend/src/kyc/kyc.service.ts#L1424); KycService.findOne [backend/src/kyc/kyc.service.ts:75](../../backend/src/kyc/kyc.service.ts#L75); KycService.tenantWhere [backend/src/kyc/kyc.service.ts:2445](../../backend/src/kyc/kyc.service.ts#L2445); KycService.caseInclude [backend/src/kyc/kyc.service.ts:3420](../../backend/src/kyc/kyc.service.ts#L3420); KycService.withKycNumber [backend/src/kyc/kyc.service.ts:3378](../../backend/src/kyc/kyc.service.ts#L3378); KycService.generatedKycNumber [backend/src/kyc/kyc.service.ts:3362](../../backend/src/kyc/kyc.service.ts#L3362).
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
- Logic chain: KycService.saveSectionA [backend/src/kyc/kyc.service.ts:1473](../../backend/src/kyc/kyc.service.ts#L1473); KycService.validateEmail [backend/src/kyc/kyc.service.ts:3210](../../backend/src/kyc/kyc.service.ts#L3210); KycService.saveSectionData [backend/src/kyc/kyc.service.ts:1975](../../backend/src/kyc/kyc.service.ts#L1975); KycService.requireWritableForm [backend/src/kyc/kyc.service.ts:2004](../../backend/src/kyc/kyc.service.ts#L2004); KycService.hasAnyRole [backend/src/kyc/kyc.service.ts:2482](../../backend/src/kyc/kyc.service.ts#L2482); KycService.tenantWhere [backend/src/kyc/kyc.service.ts:2445](../../backend/src/kyc/kyc.service.ts#L2445); KycService.getTenantId [backend/src/kyc/kyc.service.ts:2470](../../backend/src/kyc/kyc.service.ts#L2470); KycService.isPreparationEditableStatus [backend/src/kyc/kyc.service.ts:2364](../../backend/src/kyc/kyc.service.ts#L2364); KycService.isLegacyFullKycDraft [backend/src/kyc/kyc.service.ts:2358](../../backend/src/kyc/kyc.service.ts#L2358); KycService.formTenantWhere [backend/src/kyc/kyc.service.ts:2462](../../backend/src/kyc/kyc.service.ts#L2462); KycService.createForm [backend/src/kyc/kyc.service.ts:1424](../../backend/src/kyc/kyc.service.ts#L1424); KycService.findOne [backend/src/kyc/kyc.service.ts:75](../../backend/src/kyc/kyc.service.ts#L75); KycService.caseInclude [backend/src/kyc/kyc.service.ts:3420](../../backend/src/kyc/kyc.service.ts#L3420); KycService.withKycNumber [backend/src/kyc/kyc.service.ts:3378](../../backend/src/kyc/kyc.service.ts#L3378); KycService.generatedKycNumber [backend/src/kyc/kyc.service.ts:3362](../../backend/src/kyc/kyc.service.ts#L3362); KycService.formInclude [backend/src/kyc/kyc.service.ts:2120](../../backend/src/kyc/kyc.service.ts#L2120); KycService.jsonValue [backend/src/kyc/kyc.service.ts:3272](../../backend/src/kyc/kyc.service.ts#L3272); KycService.getForm [backend/src/kyc/kyc.service.ts:1440](../../backend/src/kyc/kyc.service.ts#L1440); KycService.serializeForm [backend/src/kyc/kyc.service.ts:2061](../../backend/src/kyc/kyc.service.ts#L2061); KycService.sectionRows [backend/src/kyc/kyc.service.ts:2148](../../backend/src/kyc/kyc.service.ts#L2148); KycService.asArray [backend/src/kyc/kyc.service.ts:3225](../../backend/src/kyc/kyc.service.ts#L3225); KycService.text [backend/src/kyc/kyc.service.ts:3285](../../backend/src/kyc/kyc.service.ts#L3285); KycService.sectionFWithCaseDocuments [backend/src/kyc/kyc.service.ts:2153](../../backend/src/kyc/kyc.service.ts#L2153); KycService.dedupeRequiredDocumentRows [backend/src/kyc/kyc.service.ts:2235](../../backend/src/kyc/kyc.service.ts#L2235); KycService.optionalText [backend/src/kyc/kyc.service.ts:3240](../../backend/src/kyc/kyc.service.ts#L3240); KycService.documentMatchText [backend/src/kyc/kyc.service.ts:2332](../../backend/src/kyc/kyc.service.ts#L2332); KycService.documentFileNames [backend/src/kyc/kyc.service.ts:2296](../../backend/src/kyc/kyc.service.ts#L2296); KycService.isRequiredDocumentMatch [backend/src/kyc/kyc.service.ts:2311](../../backend/src/kyc/kyc.service.ts#L2311); KycService.dedupeAdditionalDocumentRows [backend/src/kyc/kyc.service.ts:2277](../../backend/src/kyc/kyc.service.ts#L2277); KycService.ensureKycNumber [backend/src/kyc/kyc.service.ts:3332](../../backend/src/kyc/kyc.service.ts#L3332).
- QA: apply Q-API for this ID and its workflow-specific cases; store status/body/DB diff with secrets removed.
- DTO field-access candidates: email. These span reachable helpers and may include fields of internally composed DTOs; they are not a mandatory field list or complete wire schema. Match to the entry DTO and workflow before constructing requests.

## API-6DF83F11

**PATCH /api/kyc/:id/form/section-b** - KycController.saveSectionB

- Entry/auth: AuthGuard('jwt'); RolesGuard; fallback roles: AML_TEAM, AML_SUPERVISOR, COMPANY_ADMIN, SUPER_ADMIN.
- Inputs: `@CurrentUser() user: RequestUser`; `@Param('id') id: string`; `@Body() dto: Record<string, unknown>`.
- Output: JSON returned from delegated service; inferred fields in linked implementation. Inferred by TypeScript; no explicit response DTO.
- Behavior: Command (may mutate); detected reachable writes: kycShareholder.deleteMany, kycUbo.deleteMany, kycSectionData.upsert, kycShareholder.createMany, kycUbo.createMany, kycForm.update, kycForm.upsert, kycSectionData.update, kycSectionData.create.
- Tenant/role/state/validation helper candidates: requireWritableForm, hasAnyRole, tenantWhere, isLegacyFullKycDraft, formTenantWhere, numberValue, requiredText.
- Error branch candidates: BadRequestException: 'Link each indirect beneficial owner to a corporate shareholder in this form.'); BadRequestException: 'Interest percentage cannot exceed 100% within the same control layer'); ForbiddenException: 'You do not have permission to edit this KYC form section'); NotFoundException: 'KYC case not found'); BadRequestException: 'KYC preparation is locked while the case is under review. It can be edited again only after DMLRO returns it to the AML Supervisor.'); BadRequestException: 'KYC form is locked'); BadRequestException: 'This form revision has changed. Refresh the page before saving your amendment.'); BadRequestException: 'KYC form is locked. Create a new version before editing.'); ForbiddenException: 'User is not assigned to a tenant'); BadRequestException: 'Percentage fields must be numeric'); BadRequestException: `${label} is required`); BadRequestException: 'Invalid date value').
- Evidence: [backend/src/kyc/kyc.controller.ts:120](../../backend/src/kyc/kyc.controller.ts#L120).
- Logic chain: KycService.saveOwnership [backend/src/kyc/kyc.service.ts:1491](../../backend/src/kyc/kyc.service.ts#L1491); KycService.requireWritableForm [backend/src/kyc/kyc.service.ts:2004](../../backend/src/kyc/kyc.service.ts#L2004); KycService.hasAnyRole [backend/src/kyc/kyc.service.ts:2482](../../backend/src/kyc/kyc.service.ts#L2482); KycService.tenantWhere [backend/src/kyc/kyc.service.ts:2445](../../backend/src/kyc/kyc.service.ts#L2445); KycService.getTenantId [backend/src/kyc/kyc.service.ts:2470](../../backend/src/kyc/kyc.service.ts#L2470); KycService.isPreparationEditableStatus [backend/src/kyc/kyc.service.ts:2364](../../backend/src/kyc/kyc.service.ts#L2364); KycService.isLegacyFullKycDraft [backend/src/kyc/kyc.service.ts:2358](../../backend/src/kyc/kyc.service.ts#L2358); KycService.formTenantWhere [backend/src/kyc/kyc.service.ts:2462](../../backend/src/kyc/kyc.service.ts#L2462); KycService.createForm [backend/src/kyc/kyc.service.ts:1424](../../backend/src/kyc/kyc.service.ts#L1424); KycService.findOne [backend/src/kyc/kyc.service.ts:75](../../backend/src/kyc/kyc.service.ts#L75); KycService.caseInclude [backend/src/kyc/kyc.service.ts:3420](../../backend/src/kyc/kyc.service.ts#L3420); KycService.withKycNumber [backend/src/kyc/kyc.service.ts:3378](../../backend/src/kyc/kyc.service.ts#L3378); KycService.generatedKycNumber [backend/src/kyc/kyc.service.ts:3362](../../backend/src/kyc/kyc.service.ts#L3362); KycService.formInclude [backend/src/kyc/kyc.service.ts:2120](../../backend/src/kyc/kyc.service.ts#L2120); KycService.asArray [backend/src/kyc/kyc.service.ts:3225](../../backend/src/kyc/kyc.service.ts#L3225); KycService.hasRowValue [backend/src/kyc/kyc.service.ts:3229](../../backend/src/kyc/kyc.service.ts#L3229); KycService.numberValue [backend/src/kyc/kyc.service.ts:3258](../../backend/src/kyc/kyc.service.ts#L3258); KycService.text [backend/src/kyc/kyc.service.ts:3285](../../backend/src/kyc/kyc.service.ts#L3285); KycService.jsonValue [backend/src/kyc/kyc.service.ts:3272](../../backend/src/kyc/kyc.service.ts#L3272); KycService.requiredText [backend/src/kyc/kyc.service.ts:3233](../../backend/src/kyc/kyc.service.ts#L3233); KycService.optionText [backend/src/kyc/kyc.service.ts:3293](../../backend/src/kyc/kyc.service.ts#L3293); KycService.dateValue [backend/src/kyc/kyc.service.ts:3249](../../backend/src/kyc/kyc.service.ts#L3249); KycService.optionalText [backend/src/kyc/kyc.service.ts:3240](../../backend/src/kyc/kyc.service.ts#L3240); KycService.decimalValue [backend/src/kyc/kyc.service.ts:3267](../../backend/src/kyc/kyc.service.ts#L3267); KycService.getForm [backend/src/kyc/kyc.service.ts:1440](../../backend/src/kyc/kyc.service.ts#L1440); KycService.serializeForm [backend/src/kyc/kyc.service.ts:2061](../../backend/src/kyc/kyc.service.ts#L2061); KycService.sectionRows [backend/src/kyc/kyc.service.ts:2148](../../backend/src/kyc/kyc.service.ts#L2148); KycService.sectionFWithCaseDocuments [backend/src/kyc/kyc.service.ts:2153](../../backend/src/kyc/kyc.service.ts#L2153); KycService.dedupeRequiredDocumentRows [backend/src/kyc/kyc.service.ts:2235](../../backend/src/kyc/kyc.service.ts#L2235); KycService.documentMatchText [backend/src/kyc/kyc.service.ts:2332](../../backend/src/kyc/kyc.service.ts#L2332); KycService.documentFileNames [backend/src/kyc/kyc.service.ts:2296](../../backend/src/kyc/kyc.service.ts#L2296); KycService.isRequiredDocumentMatch [backend/src/kyc/kyc.service.ts:2311](../../backend/src/kyc/kyc.service.ts#L2311); KycService.dedupeAdditionalDocumentRows [backend/src/kyc/kyc.service.ts:2277](../../backend/src/kyc/kyc.service.ts#L2277); KycService.ensureKycNumber [backend/src/kyc/kyc.service.ts:3332](../../backend/src/kyc/kyc.service.ts#L3332).
- QA: apply Q-API for this ID and its workflow-specific cases; store status/body/DB diff with secrets removed.
- DTO field-access candidates: expectedVersion, shareholders, uboDifferentFromShareholders, uboGroupStructureNotes, ubos. These span reachable helpers and may include fields of internally composed DTOs; they are not a mandatory field list or complete wire schema. Match to the entry DTO and workflow before constructing requests.

## API-6FCEF8D0

**PATCH /api/kyc/:id/form/section-c** - KycController.saveSectionC

- Entry/auth: AuthGuard('jwt'); RolesGuard; fallback roles: AML_TEAM, AML_SUPERVISOR, COMPANY_ADMIN, SUPER_ADMIN.
- Inputs: `@CurrentUser() user: RequestUser`; `@Param('id') id: string`; `@Body() dto: Record<string, unknown>`.
- Output: JSON returned from delegated service; inferred fields in linked implementation. Inferred by TypeScript; no explicit response DTO.
- Behavior: Command (may mutate); detected reachable writes: kycManager.deleteMany, kycSectionData.upsert, kycManager.createMany, kycForm.update, kycForm.upsert, kycSectionData.update, kycSectionData.create.
- Tenant/role/state/validation helper candidates: requireWritableForm, hasAnyRole, tenantWhere, isLegacyFullKycDraft, formTenantWhere, requiredText.
- Error branch candidates: ForbiddenException: 'You do not have permission to edit this KYC form section'); NotFoundException: 'KYC case not found'); BadRequestException: 'KYC preparation is locked while the case is under review. It can be edited again only after DMLRO returns it to the AML Supervisor.'); BadRequestException: 'KYC form is locked'); BadRequestException: 'This form revision has changed. Refresh the page before saving your amendment.'); BadRequestException: 'KYC form is locked. Create a new version before editing.'); ForbiddenException: 'User is not assigned to a tenant'); BadRequestException: `${label} is required`); BadRequestException: 'Invalid date value').
- Evidence: [backend/src/kyc/kyc.controller.ts:126](../../backend/src/kyc/kyc.controller.ts#L126).
- Logic chain: KycService.saveManagers [backend/src/kyc/kyc.service.ts:1586](../../backend/src/kyc/kyc.service.ts#L1586); KycService.requireWritableForm [backend/src/kyc/kyc.service.ts:2004](../../backend/src/kyc/kyc.service.ts#L2004); KycService.hasAnyRole [backend/src/kyc/kyc.service.ts:2482](../../backend/src/kyc/kyc.service.ts#L2482); KycService.tenantWhere [backend/src/kyc/kyc.service.ts:2445](../../backend/src/kyc/kyc.service.ts#L2445); KycService.getTenantId [backend/src/kyc/kyc.service.ts:2470](../../backend/src/kyc/kyc.service.ts#L2470); KycService.isPreparationEditableStatus [backend/src/kyc/kyc.service.ts:2364](../../backend/src/kyc/kyc.service.ts#L2364); KycService.isLegacyFullKycDraft [backend/src/kyc/kyc.service.ts:2358](../../backend/src/kyc/kyc.service.ts#L2358); KycService.formTenantWhere [backend/src/kyc/kyc.service.ts:2462](../../backend/src/kyc/kyc.service.ts#L2462); KycService.createForm [backend/src/kyc/kyc.service.ts:1424](../../backend/src/kyc/kyc.service.ts#L1424); KycService.findOne [backend/src/kyc/kyc.service.ts:75](../../backend/src/kyc/kyc.service.ts#L75); KycService.caseInclude [backend/src/kyc/kyc.service.ts:3420](../../backend/src/kyc/kyc.service.ts#L3420); KycService.withKycNumber [backend/src/kyc/kyc.service.ts:3378](../../backend/src/kyc/kyc.service.ts#L3378); KycService.generatedKycNumber [backend/src/kyc/kyc.service.ts:3362](../../backend/src/kyc/kyc.service.ts#L3362); KycService.formInclude [backend/src/kyc/kyc.service.ts:2120](../../backend/src/kyc/kyc.service.ts#L2120); KycService.asArray [backend/src/kyc/kyc.service.ts:3225](../../backend/src/kyc/kyc.service.ts#L3225); KycService.hasRowValue [backend/src/kyc/kyc.service.ts:3229](../../backend/src/kyc/kyc.service.ts#L3229); KycService.jsonValue [backend/src/kyc/kyc.service.ts:3272](../../backend/src/kyc/kyc.service.ts#L3272); KycService.requiredText [backend/src/kyc/kyc.service.ts:3233](../../backend/src/kyc/kyc.service.ts#L3233); KycService.optionalText [backend/src/kyc/kyc.service.ts:3240](../../backend/src/kyc/kyc.service.ts#L3240); KycService.text [backend/src/kyc/kyc.service.ts:3285](../../backend/src/kyc/kyc.service.ts#L3285); KycService.dateValue [backend/src/kyc/kyc.service.ts:3249](../../backend/src/kyc/kyc.service.ts#L3249); KycService.optionText [backend/src/kyc/kyc.service.ts:3293](../../backend/src/kyc/kyc.service.ts#L3293); KycService.getForm [backend/src/kyc/kyc.service.ts:1440](../../backend/src/kyc/kyc.service.ts#L1440); KycService.serializeForm [backend/src/kyc/kyc.service.ts:2061](../../backend/src/kyc/kyc.service.ts#L2061); KycService.sectionRows [backend/src/kyc/kyc.service.ts:2148](../../backend/src/kyc/kyc.service.ts#L2148); KycService.sectionFWithCaseDocuments [backend/src/kyc/kyc.service.ts:2153](../../backend/src/kyc/kyc.service.ts#L2153); KycService.dedupeRequiredDocumentRows [backend/src/kyc/kyc.service.ts:2235](../../backend/src/kyc/kyc.service.ts#L2235); KycService.documentMatchText [backend/src/kyc/kyc.service.ts:2332](../../backend/src/kyc/kyc.service.ts#L2332); KycService.documentFileNames [backend/src/kyc/kyc.service.ts:2296](../../backend/src/kyc/kyc.service.ts#L2296); KycService.isRequiredDocumentMatch [backend/src/kyc/kyc.service.ts:2311](../../backend/src/kyc/kyc.service.ts#L2311); KycService.dedupeAdditionalDocumentRows [backend/src/kyc/kyc.service.ts:2277](../../backend/src/kyc/kyc.service.ts#L2277); KycService.ensureKycNumber [backend/src/kyc/kyc.service.ts:3332](../../backend/src/kyc/kyc.service.ts#L3332).
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
- Logic chain: KycService.saveSectionD [backend/src/kyc/kyc.service.ts:1478](../../backend/src/kyc/kyc.service.ts#L1478); KycService.saveSectionData [backend/src/kyc/kyc.service.ts:1975](../../backend/src/kyc/kyc.service.ts#L1975); KycService.requireWritableForm [backend/src/kyc/kyc.service.ts:2004](../../backend/src/kyc/kyc.service.ts#L2004); KycService.hasAnyRole [backend/src/kyc/kyc.service.ts:2482](../../backend/src/kyc/kyc.service.ts#L2482); KycService.tenantWhere [backend/src/kyc/kyc.service.ts:2445](../../backend/src/kyc/kyc.service.ts#L2445); KycService.getTenantId [backend/src/kyc/kyc.service.ts:2470](../../backend/src/kyc/kyc.service.ts#L2470); KycService.isPreparationEditableStatus [backend/src/kyc/kyc.service.ts:2364](../../backend/src/kyc/kyc.service.ts#L2364); KycService.isLegacyFullKycDraft [backend/src/kyc/kyc.service.ts:2358](../../backend/src/kyc/kyc.service.ts#L2358); KycService.formTenantWhere [backend/src/kyc/kyc.service.ts:2462](../../backend/src/kyc/kyc.service.ts#L2462); KycService.createForm [backend/src/kyc/kyc.service.ts:1424](../../backend/src/kyc/kyc.service.ts#L1424); KycService.findOne [backend/src/kyc/kyc.service.ts:75](../../backend/src/kyc/kyc.service.ts#L75); KycService.caseInclude [backend/src/kyc/kyc.service.ts:3420](../../backend/src/kyc/kyc.service.ts#L3420); KycService.withKycNumber [backend/src/kyc/kyc.service.ts:3378](../../backend/src/kyc/kyc.service.ts#L3378); KycService.generatedKycNumber [backend/src/kyc/kyc.service.ts:3362](../../backend/src/kyc/kyc.service.ts#L3362); KycService.formInclude [backend/src/kyc/kyc.service.ts:2120](../../backend/src/kyc/kyc.service.ts#L2120); KycService.jsonValue [backend/src/kyc/kyc.service.ts:3272](../../backend/src/kyc/kyc.service.ts#L3272); KycService.getForm [backend/src/kyc/kyc.service.ts:1440](../../backend/src/kyc/kyc.service.ts#L1440); KycService.serializeForm [backend/src/kyc/kyc.service.ts:2061](../../backend/src/kyc/kyc.service.ts#L2061); KycService.sectionRows [backend/src/kyc/kyc.service.ts:2148](../../backend/src/kyc/kyc.service.ts#L2148); KycService.asArray [backend/src/kyc/kyc.service.ts:3225](../../backend/src/kyc/kyc.service.ts#L3225); KycService.text [backend/src/kyc/kyc.service.ts:3285](../../backend/src/kyc/kyc.service.ts#L3285); KycService.sectionFWithCaseDocuments [backend/src/kyc/kyc.service.ts:2153](../../backend/src/kyc/kyc.service.ts#L2153); KycService.dedupeRequiredDocumentRows [backend/src/kyc/kyc.service.ts:2235](../../backend/src/kyc/kyc.service.ts#L2235); KycService.optionalText [backend/src/kyc/kyc.service.ts:3240](../../backend/src/kyc/kyc.service.ts#L3240); KycService.documentMatchText [backend/src/kyc/kyc.service.ts:2332](../../backend/src/kyc/kyc.service.ts#L2332); KycService.documentFileNames [backend/src/kyc/kyc.service.ts:2296](../../backend/src/kyc/kyc.service.ts#L2296); KycService.isRequiredDocumentMatch [backend/src/kyc/kyc.service.ts:2311](../../backend/src/kyc/kyc.service.ts#L2311); KycService.dedupeAdditionalDocumentRows [backend/src/kyc/kyc.service.ts:2277](../../backend/src/kyc/kyc.service.ts#L2277); KycService.ensureKycNumber [backend/src/kyc/kyc.service.ts:3332](../../backend/src/kyc/kyc.service.ts#L3332).
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
- Logic chain: KycService.saveSectionE [backend/src/kyc/kyc.service.ts:1482](../../backend/src/kyc/kyc.service.ts#L1482); KycService.validateEmail [backend/src/kyc/kyc.service.ts:3210](../../backend/src/kyc/kyc.service.ts#L3210); KycService.saveSectionData [backend/src/kyc/kyc.service.ts:1975](../../backend/src/kyc/kyc.service.ts#L1975); KycService.requireWritableForm [backend/src/kyc/kyc.service.ts:2004](../../backend/src/kyc/kyc.service.ts#L2004); KycService.hasAnyRole [backend/src/kyc/kyc.service.ts:2482](../../backend/src/kyc/kyc.service.ts#L2482); KycService.tenantWhere [backend/src/kyc/kyc.service.ts:2445](../../backend/src/kyc/kyc.service.ts#L2445); KycService.getTenantId [backend/src/kyc/kyc.service.ts:2470](../../backend/src/kyc/kyc.service.ts#L2470); KycService.isPreparationEditableStatus [backend/src/kyc/kyc.service.ts:2364](../../backend/src/kyc/kyc.service.ts#L2364); KycService.isLegacyFullKycDraft [backend/src/kyc/kyc.service.ts:2358](../../backend/src/kyc/kyc.service.ts#L2358); KycService.formTenantWhere [backend/src/kyc/kyc.service.ts:2462](../../backend/src/kyc/kyc.service.ts#L2462); KycService.createForm [backend/src/kyc/kyc.service.ts:1424](../../backend/src/kyc/kyc.service.ts#L1424); KycService.findOne [backend/src/kyc/kyc.service.ts:75](../../backend/src/kyc/kyc.service.ts#L75); KycService.caseInclude [backend/src/kyc/kyc.service.ts:3420](../../backend/src/kyc/kyc.service.ts#L3420); KycService.withKycNumber [backend/src/kyc/kyc.service.ts:3378](../../backend/src/kyc/kyc.service.ts#L3378); KycService.generatedKycNumber [backend/src/kyc/kyc.service.ts:3362](../../backend/src/kyc/kyc.service.ts#L3362); KycService.formInclude [backend/src/kyc/kyc.service.ts:2120](../../backend/src/kyc/kyc.service.ts#L2120); KycService.jsonValue [backend/src/kyc/kyc.service.ts:3272](../../backend/src/kyc/kyc.service.ts#L3272); KycService.getForm [backend/src/kyc/kyc.service.ts:1440](../../backend/src/kyc/kyc.service.ts#L1440); KycService.serializeForm [backend/src/kyc/kyc.service.ts:2061](../../backend/src/kyc/kyc.service.ts#L2061); KycService.sectionRows [backend/src/kyc/kyc.service.ts:2148](../../backend/src/kyc/kyc.service.ts#L2148); KycService.asArray [backend/src/kyc/kyc.service.ts:3225](../../backend/src/kyc/kyc.service.ts#L3225); KycService.text [backend/src/kyc/kyc.service.ts:3285](../../backend/src/kyc/kyc.service.ts#L3285); KycService.sectionFWithCaseDocuments [backend/src/kyc/kyc.service.ts:2153](../../backend/src/kyc/kyc.service.ts#L2153); KycService.dedupeRequiredDocumentRows [backend/src/kyc/kyc.service.ts:2235](../../backend/src/kyc/kyc.service.ts#L2235); KycService.optionalText [backend/src/kyc/kyc.service.ts:3240](../../backend/src/kyc/kyc.service.ts#L3240); KycService.documentMatchText [backend/src/kyc/kyc.service.ts:2332](../../backend/src/kyc/kyc.service.ts#L2332); KycService.documentFileNames [backend/src/kyc/kyc.service.ts:2296](../../backend/src/kyc/kyc.service.ts#L2296); KycService.isRequiredDocumentMatch [backend/src/kyc/kyc.service.ts:2311](../../backend/src/kyc/kyc.service.ts#L2311); KycService.dedupeAdditionalDocumentRows [backend/src/kyc/kyc.service.ts:2277](../../backend/src/kyc/kyc.service.ts#L2277); KycService.ensureKycNumber [backend/src/kyc/kyc.service.ts:3332](../../backend/src/kyc/kyc.service.ts#L3332).
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
- Logic chain: KycService.saveRequiredDocuments [backend/src/kyc/kyc.service.ts:1634](../../backend/src/kyc/kyc.service.ts#L1634); KycService.requireWritableForm [backend/src/kyc/kyc.service.ts:2004](../../backend/src/kyc/kyc.service.ts#L2004); KycService.hasAnyRole [backend/src/kyc/kyc.service.ts:2482](../../backend/src/kyc/kyc.service.ts#L2482); KycService.tenantWhere [backend/src/kyc/kyc.service.ts:2445](../../backend/src/kyc/kyc.service.ts#L2445); KycService.getTenantId [backend/src/kyc/kyc.service.ts:2470](../../backend/src/kyc/kyc.service.ts#L2470); KycService.isPreparationEditableStatus [backend/src/kyc/kyc.service.ts:2364](../../backend/src/kyc/kyc.service.ts#L2364); KycService.isLegacyFullKycDraft [backend/src/kyc/kyc.service.ts:2358](../../backend/src/kyc/kyc.service.ts#L2358); KycService.formTenantWhere [backend/src/kyc/kyc.service.ts:2462](../../backend/src/kyc/kyc.service.ts#L2462); KycService.createForm [backend/src/kyc/kyc.service.ts:1424](../../backend/src/kyc/kyc.service.ts#L1424); KycService.findOne [backend/src/kyc/kyc.service.ts:75](../../backend/src/kyc/kyc.service.ts#L75); KycService.caseInclude [backend/src/kyc/kyc.service.ts:3420](../../backend/src/kyc/kyc.service.ts#L3420); KycService.withKycNumber [backend/src/kyc/kyc.service.ts:3378](../../backend/src/kyc/kyc.service.ts#L3378); KycService.generatedKycNumber [backend/src/kyc/kyc.service.ts:3362](../../backend/src/kyc/kyc.service.ts#L3362); KycService.formInclude [backend/src/kyc/kyc.service.ts:2120](../../backend/src/kyc/kyc.service.ts#L2120); KycService.dedupeRequiredDocumentRows [backend/src/kyc/kyc.service.ts:2235](../../backend/src/kyc/kyc.service.ts#L2235); KycService.optionalText [backend/src/kyc/kyc.service.ts:3240](../../backend/src/kyc/kyc.service.ts#L3240); KycService.text [backend/src/kyc/kyc.service.ts:3285](../../backend/src/kyc/kyc.service.ts#L3285); KycService.documentMatchText [backend/src/kyc/kyc.service.ts:2332](../../backend/src/kyc/kyc.service.ts#L2332); KycService.documentFileNames [backend/src/kyc/kyc.service.ts:2296](../../backend/src/kyc/kyc.service.ts#L2296); KycService.asArray [backend/src/kyc/kyc.service.ts:3225](../../backend/src/kyc/kyc.service.ts#L3225); KycService.hasRowValue [backend/src/kyc/kyc.service.ts:3229](../../backend/src/kyc/kyc.service.ts#L3229); KycService.dedupeAdditionalDocumentRows [backend/src/kyc/kyc.service.ts:2277](../../backend/src/kyc/kyc.service.ts#L2277); KycService.requiredText [backend/src/kyc/kyc.service.ts:3233](../../backend/src/kyc/kyc.service.ts#L3233); KycService.syncRequiredDocumentsToLegalDocuments [backend/src/kyc/kyc.service.ts:1694](../../backend/src/kyc/kyc.service.ts#L1694); KycService.legalDocumentSyncKey [backend/src/kyc/kyc.service.ts:3416](../../backend/src/kyc/kyc.service.ts#L3416); KycService.jsonValue [backend/src/kyc/kyc.service.ts:3272](../../backend/src/kyc/kyc.service.ts#L3272); KycService.markDocumentsUploadedFromSectionF [backend/src/kyc/kyc.service.ts:1754](../../backend/src/kyc/kyc.service.ts#L1754); KycService.getForm [backend/src/kyc/kyc.service.ts:1440](../../backend/src/kyc/kyc.service.ts#L1440); KycService.serializeForm [backend/src/kyc/kyc.service.ts:2061](../../backend/src/kyc/kyc.service.ts#L2061); KycService.sectionRows [backend/src/kyc/kyc.service.ts:2148](../../backend/src/kyc/kyc.service.ts#L2148); KycService.sectionFWithCaseDocuments [backend/src/kyc/kyc.service.ts:2153](../../backend/src/kyc/kyc.service.ts#L2153); KycService.isRequiredDocumentMatch [backend/src/kyc/kyc.service.ts:2311](../../backend/src/kyc/kyc.service.ts#L2311); KycService.ensureKycNumber [backend/src/kyc/kyc.service.ts:3332](../../backend/src/kyc/kyc.service.ts#L3332).
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
- Logic chain: KycService.saveSectionG [backend/src/kyc/kyc.service.ts:1487](../../backend/src/kyc/kyc.service.ts#L1487); KycService.saveSectionData [backend/src/kyc/kyc.service.ts:1975](../../backend/src/kyc/kyc.service.ts#L1975); KycService.requireWritableForm [backend/src/kyc/kyc.service.ts:2004](../../backend/src/kyc/kyc.service.ts#L2004); KycService.hasAnyRole [backend/src/kyc/kyc.service.ts:2482](../../backend/src/kyc/kyc.service.ts#L2482); KycService.tenantWhere [backend/src/kyc/kyc.service.ts:2445](../../backend/src/kyc/kyc.service.ts#L2445); KycService.getTenantId [backend/src/kyc/kyc.service.ts:2470](../../backend/src/kyc/kyc.service.ts#L2470); KycService.isPreparationEditableStatus [backend/src/kyc/kyc.service.ts:2364](../../backend/src/kyc/kyc.service.ts#L2364); KycService.isLegacyFullKycDraft [backend/src/kyc/kyc.service.ts:2358](../../backend/src/kyc/kyc.service.ts#L2358); KycService.formTenantWhere [backend/src/kyc/kyc.service.ts:2462](../../backend/src/kyc/kyc.service.ts#L2462); KycService.createForm [backend/src/kyc/kyc.service.ts:1424](../../backend/src/kyc/kyc.service.ts#L1424); KycService.findOne [backend/src/kyc/kyc.service.ts:75](../../backend/src/kyc/kyc.service.ts#L75); KycService.caseInclude [backend/src/kyc/kyc.service.ts:3420](../../backend/src/kyc/kyc.service.ts#L3420); KycService.withKycNumber [backend/src/kyc/kyc.service.ts:3378](../../backend/src/kyc/kyc.service.ts#L3378); KycService.generatedKycNumber [backend/src/kyc/kyc.service.ts:3362](../../backend/src/kyc/kyc.service.ts#L3362); KycService.formInclude [backend/src/kyc/kyc.service.ts:2120](../../backend/src/kyc/kyc.service.ts#L2120); KycService.jsonValue [backend/src/kyc/kyc.service.ts:3272](../../backend/src/kyc/kyc.service.ts#L3272); KycService.getForm [backend/src/kyc/kyc.service.ts:1440](../../backend/src/kyc/kyc.service.ts#L1440); KycService.serializeForm [backend/src/kyc/kyc.service.ts:2061](../../backend/src/kyc/kyc.service.ts#L2061); KycService.sectionRows [backend/src/kyc/kyc.service.ts:2148](../../backend/src/kyc/kyc.service.ts#L2148); KycService.asArray [backend/src/kyc/kyc.service.ts:3225](../../backend/src/kyc/kyc.service.ts#L3225); KycService.text [backend/src/kyc/kyc.service.ts:3285](../../backend/src/kyc/kyc.service.ts#L3285); KycService.sectionFWithCaseDocuments [backend/src/kyc/kyc.service.ts:2153](../../backend/src/kyc/kyc.service.ts#L2153); KycService.dedupeRequiredDocumentRows [backend/src/kyc/kyc.service.ts:2235](../../backend/src/kyc/kyc.service.ts#L2235); KycService.optionalText [backend/src/kyc/kyc.service.ts:3240](../../backend/src/kyc/kyc.service.ts#L3240); KycService.documentMatchText [backend/src/kyc/kyc.service.ts:2332](../../backend/src/kyc/kyc.service.ts#L2332); KycService.documentFileNames [backend/src/kyc/kyc.service.ts:2296](../../backend/src/kyc/kyc.service.ts#L2296); KycService.isRequiredDocumentMatch [backend/src/kyc/kyc.service.ts:2311](../../backend/src/kyc/kyc.service.ts#L2311); KycService.dedupeAdditionalDocumentRows [backend/src/kyc/kyc.service.ts:2277](../../backend/src/kyc/kyc.service.ts#L2277); KycService.ensureKycNumber [backend/src/kyc/kyc.service.ts:3332](../../backend/src/kyc/kyc.service.ts#L3332).
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
- Logic chain: KycService.saveInternalReview [backend/src/kyc/kyc.service.ts:1798](../../backend/src/kyc/kyc.service.ts#L1798); KycService.assertFormReviewEditable [backend/src/kyc/kyc.service.ts:3073](../../backend/src/kyc/kyc.service.ts#L3073); KycService.findOne [backend/src/kyc/kyc.service.ts:75](../../backend/src/kyc/kyc.service.ts#L75); KycService.tenantWhere [backend/src/kyc/kyc.service.ts:2445](../../backend/src/kyc/kyc.service.ts#L2445); KycService.getTenantId [backend/src/kyc/kyc.service.ts:2470](../../backend/src/kyc/kyc.service.ts#L2470); KycService.caseInclude [backend/src/kyc/kyc.service.ts:3420](../../backend/src/kyc/kyc.service.ts#L3420); KycService.withKycNumber [backend/src/kyc/kyc.service.ts:3378](../../backend/src/kyc/kyc.service.ts#L3378); KycService.generatedKycNumber [backend/src/kyc/kyc.service.ts:3362](../../backend/src/kyc/kyc.service.ts#L3362); KycService.hasAnyRole [backend/src/kyc/kyc.service.ts:2482](../../backend/src/kyc/kyc.service.ts#L2482); KycService.assertStageRole [backend/src/kyc/kyc.service.ts:2486](../../backend/src/kyc/kyc.service.ts#L2486); KycService.stageLabel [backend/src/kyc/kyc.service.ts:2499](../../backend/src/kyc/kyc.service.ts#L2499); KycService.requireWritableCase [backend/src/kyc/kyc.service.ts:2342](../../backend/src/kyc/kyc.service.ts#L2342); KycService.isPreparationEditableStatus [backend/src/kyc/kyc.service.ts:2364](../../backend/src/kyc/kyc.service.ts#L2364); KycService.isLegacyFullKycDraft [backend/src/kyc/kyc.service.ts:2358](../../backend/src/kyc/kyc.service.ts#L2358); KycService.formTenantWhere [backend/src/kyc/kyc.service.ts:2462](../../backend/src/kyc/kyc.service.ts#L2462); KycService.stageStatus [backend/src/kyc/kyc.service.ts:2505](../../backend/src/kyc/kyc.service.ts#L2505); KycService.assertReviewStageActive [backend/src/kyc/kyc.service.ts:2558](../../backend/src/kyc/kyc.service.ts#L2558); KycService.assertEditableReview [backend/src/kyc/kyc.service.ts:2548](../../backend/src/kyc/kyc.service.ts#L2548); KycService.internalReviewAllowedRoles [backend/src/kyc/kyc.service.ts:3094](../../backend/src/kyc/kyc.service.ts#L3094); KycService.requireWritableForm [backend/src/kyc/kyc.service.ts:2004](../../backend/src/kyc/kyc.service.ts#L2004); KycService.createForm [backend/src/kyc/kyc.service.ts:1424](../../backend/src/kyc/kyc.service.ts#L1424); KycService.formInclude [backend/src/kyc/kyc.service.ts:2120](../../backend/src/kyc/kyc.service.ts#L2120); KycService.internalReviewData [backend/src/kyc/kyc.service.ts:3103](../../backend/src/kyc/kyc.service.ts#L3103); KycService.enumValue [backend/src/kyc/kyc.service.ts:3217](../../backend/src/kyc/kyc.service.ts#L3217); KycService.optionalText [backend/src/kyc/kyc.service.ts:3240](../../backend/src/kyc/kyc.service.ts#L3240); KycService.text [backend/src/kyc/kyc.service.ts:3285](../../backend/src/kyc/kyc.service.ts#L3285); KycService.dateValue [backend/src/kyc/kyc.service.ts:3249](../../backend/src/kyc/kyc.service.ts#L3249); KycService.getForm [backend/src/kyc/kyc.service.ts:1440](../../backend/src/kyc/kyc.service.ts#L1440); KycService.serializeForm [backend/src/kyc/kyc.service.ts:2061](../../backend/src/kyc/kyc.service.ts#L2061); KycService.sectionRows [backend/src/kyc/kyc.service.ts:2148](../../backend/src/kyc/kyc.service.ts#L2148); KycService.asArray [backend/src/kyc/kyc.service.ts:3225](../../backend/src/kyc/kyc.service.ts#L3225); KycService.sectionFWithCaseDocuments [backend/src/kyc/kyc.service.ts:2153](../../backend/src/kyc/kyc.service.ts#L2153); KycService.dedupeRequiredDocumentRows [backend/src/kyc/kyc.service.ts:2235](../../backend/src/kyc/kyc.service.ts#L2235); KycService.documentMatchText [backend/src/kyc/kyc.service.ts:2332](../../backend/src/kyc/kyc.service.ts#L2332); KycService.documentFileNames [backend/src/kyc/kyc.service.ts:2296](../../backend/src/kyc/kyc.service.ts#L2296); KycService.isRequiredDocumentMatch [backend/src/kyc/kyc.service.ts:2311](../../backend/src/kyc/kyc.service.ts#L2311); KycService.dedupeAdditionalDocumentRows [backend/src/kyc/kyc.service.ts:2277](../../backend/src/kyc/kyc.service.ts#L2277); KycService.ensureKycNumber [backend/src/kyc/kyc.service.ts:3332](../../backend/src/kyc/kyc.service.ts#L3332); KycService.jsonValue [backend/src/kyc/kyc.service.ts:3272](../../backend/src/kyc/kyc.service.ts#L3272).
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
- Evidence: [backend/src/kyc/kyc.controller.ts:303](../../backend/src/kyc/kyc.controller.ts#L303).
- Logic chain: KycService.getInternalReviewWorkspace [backend/src/kyc/kyc.service.ts:680](../../backend/src/kyc/kyc.service.ts#L680); KycService.findOne [backend/src/kyc/kyc.service.ts:75](../../backend/src/kyc/kyc.service.ts#L75); KycService.tenantWhere [backend/src/kyc/kyc.service.ts:2445](../../backend/src/kyc/kyc.service.ts#L2445); KycService.getTenantId [backend/src/kyc/kyc.service.ts:2470](../../backend/src/kyc/kyc.service.ts#L2470); KycService.caseInclude [backend/src/kyc/kyc.service.ts:3420](../../backend/src/kyc/kyc.service.ts#L3420); KycService.withKycNumber [backend/src/kyc/kyc.service.ts:3378](../../backend/src/kyc/kyc.service.ts#L3378); KycService.generatedKycNumber [backend/src/kyc/kyc.service.ts:3362](../../backend/src/kyc/kyc.service.ts#L3362); KycService.confidentialCommentWhere [backend/src/kyc/kyc.service.ts:3008](../../backend/src/kyc/kyc.service.ts#L3008); KycService.hasAnyRole [backend/src/kyc/kyc.service.ts:2482](../../backend/src/kyc/kyc.service.ts#L2482); KycService.recalculateActivationReadiness [backend/src/kyc/kyc.service.ts:1087](../../backend/src/kyc/kyc.service.ts#L1087); KycService.activationChecklistItems [backend/src/kyc/kyc.service.ts:3019](../../backend/src/kyc/kyc.service.ts#L3019); KycService.jsonValue [backend/src/kyc/kyc.service.ts:3272](../../backend/src/kyc/kyc.service.ts#L3272).
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
- Evidence: [backend/src/kyc/kyc.controller.ts:349](../../backend/src/kyc/kyc.controller.ts#L349).
- Logic chain: KycService.addReviewerComment [backend/src/kyc/kyc.service.ts:978](../../backend/src/kyc/kyc.service.ts#L978); KycService.findOne [backend/src/kyc/kyc.service.ts:75](../../backend/src/kyc/kyc.service.ts#L75); KycService.tenantWhere [backend/src/kyc/kyc.service.ts:2445](../../backend/src/kyc/kyc.service.ts#L2445); KycService.getTenantId [backend/src/kyc/kyc.service.ts:2470](../../backend/src/kyc/kyc.service.ts#L2470); KycService.caseInclude [backend/src/kyc/kyc.service.ts:3420](../../backend/src/kyc/kyc.service.ts#L3420); KycService.withKycNumber [backend/src/kyc/kyc.service.ts:3378](../../backend/src/kyc/kyc.service.ts#L3378); KycService.generatedKycNumber [backend/src/kyc/kyc.service.ts:3362](../../backend/src/kyc/kyc.service.ts#L3362); KycService.enumValue [backend/src/kyc/kyc.service.ts:3217](../../backend/src/kyc/kyc.service.ts#L3217); KycService.hasAnyRole [backend/src/kyc/kyc.service.ts:2482](../../backend/src/kyc/kyc.service.ts#L2482); KycService.requiredText [backend/src/kyc/kyc.service.ts:3233](../../backend/src/kyc/kyc.service.ts#L3233); KycService.jsonValue [backend/src/kyc/kyc.service.ts:3272](../../backend/src/kyc/kyc.service.ts#L3272).
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
- Evidence: [backend/src/kyc/kyc.controller.ts:314](../../backend/src/kyc/kyc.controller.ts#L314).
- Logic chain: KycService.saveReviewDraft [backend/src/kyc/kyc.service.ts:749](../../backend/src/kyc/kyc.service.ts#L749); KycService.assertStageRole [backend/src/kyc/kyc.service.ts:2486](../../backend/src/kyc/kyc.service.ts#L2486); KycService.hasAnyRole [backend/src/kyc/kyc.service.ts:2482](../../backend/src/kyc/kyc.service.ts#L2482); KycService.stageLabel [backend/src/kyc/kyc.service.ts:2499](../../backend/src/kyc/kyc.service.ts#L2499); KycService.findOne [backend/src/kyc/kyc.service.ts:75](../../backend/src/kyc/kyc.service.ts#L75); KycService.tenantWhere [backend/src/kyc/kyc.service.ts:2445](../../backend/src/kyc/kyc.service.ts#L2445); KycService.getTenantId [backend/src/kyc/kyc.service.ts:2470](../../backend/src/kyc/kyc.service.ts#L2470); KycService.caseInclude [backend/src/kyc/kyc.service.ts:3420](../../backend/src/kyc/kyc.service.ts#L3420); KycService.withKycNumber [backend/src/kyc/kyc.service.ts:3378](../../backend/src/kyc/kyc.service.ts#L3378); KycService.generatedKycNumber [backend/src/kyc/kyc.service.ts:3362](../../backend/src/kyc/kyc.service.ts#L3362); KycService.stageStatus [backend/src/kyc/kyc.service.ts:2505](../../backend/src/kyc/kyc.service.ts#L2505); KycService.assertReviewStageActive [backend/src/kyc/kyc.service.ts:2558](../../backend/src/kyc/kyc.service.ts#L2558); KycService.assertEditableReview [backend/src/kyc/kyc.service.ts:2548](../../backend/src/kyc/kyc.service.ts#L2548); KycService.jsonValue [backend/src/kyc/kyc.service.ts:3272](../../backend/src/kyc/kyc.service.ts#L3272); KycService.optionalText [backend/src/kyc/kyc.service.ts:3240](../../backend/src/kyc/kyc.service.ts#L3240); KycService.text [backend/src/kyc/kyc.service.ts:3285](../../backend/src/kyc/kyc.service.ts#L3285).
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
- Evidence: [backend/src/kyc/kyc.controller.ts:308](../../backend/src/kyc/kyc.controller.ts#L308).
- Logic chain: KycService.startReviewStage [backend/src/kyc/kyc.service.ts:718](../../backend/src/kyc/kyc.service.ts#L718); KycService.assertStageRole [backend/src/kyc/kyc.service.ts:2486](../../backend/src/kyc/kyc.service.ts#L2486); KycService.hasAnyRole [backend/src/kyc/kyc.service.ts:2482](../../backend/src/kyc/kyc.service.ts#L2482); KycService.stageLabel [backend/src/kyc/kyc.service.ts:2499](../../backend/src/kyc/kyc.service.ts#L2499); KycService.findOne [backend/src/kyc/kyc.service.ts:75](../../backend/src/kyc/kyc.service.ts#L75); KycService.tenantWhere [backend/src/kyc/kyc.service.ts:2445](../../backend/src/kyc/kyc.service.ts#L2445); KycService.getTenantId [backend/src/kyc/kyc.service.ts:2470](../../backend/src/kyc/kyc.service.ts#L2470); KycService.caseInclude [backend/src/kyc/kyc.service.ts:3420](../../backend/src/kyc/kyc.service.ts#L3420); KycService.withKycNumber [backend/src/kyc/kyc.service.ts:3378](../../backend/src/kyc/kyc.service.ts#L3378); KycService.generatedKycNumber [backend/src/kyc/kyc.service.ts:3362](../../backend/src/kyc/kyc.service.ts#L3362); KycService.assertPreviousStageComplete [backend/src/kyc/kyc.service.ts:2536](../../backend/src/kyc/kyc.service.ts#L2536); KycService.stageStatus [backend/src/kyc/kyc.service.ts:2505](../../backend/src/kyc/kyc.service.ts#L2505); KycService.recordStatus [backend/src/kyc/kyc.service.ts:2866](../../backend/src/kyc/kyc.service.ts#L2866); KycService.audit [backend/src/kyc/kyc.service.ts:2890](../../backend/src/kyc/kyc.service.ts#L2890); KycService.jsonValue [backend/src/kyc/kyc.service.ts:3272](../../backend/src/kyc/kyc.service.ts#L3272).
- QA: apply Q-API for this ID and its workflow-specific cases; store status/body/DB diff with secrets removed.
- DTO field-access candidates: none resolved. These span reachable helpers and may include fields of internally composed DTOs; they are not a mandatory field list or complete wire schema. Match to the entry DTO and workflow before constructing requests.

## API-C65454C8

**POST /api/kyc/:id/internal-reviews/dmlro/submit** - KycController.submitDmlroReview

- Entry/auth: AuthGuard('jwt'); RolesGuard; fallback roles: DMLRO, COMPANY_ADMIN, SUPER_ADMIN.
- Inputs: `@CurrentUser() user: RequestUser`; `@Param('id') id: string`; `@Body() dto: Record<string, unknown>`.
- Output: JSON returned from delegated service; inferred fields in linked implementation. Inferred by TypeScript; no explicit response DTO.
- Behavior: Command (may mutate); detected reachable writes: internalReviewTask.updateMany, internalReviewSubmission.updateMany, internalReviewTask.upsert, internalReviewSubmission.upsert, internalReviewVersion.create, reviewerComment.updateMany, kycInternalReview.upsert, internalReviewTask.deleteMany, kycCase.update, kycCaseStatusHistory.create, auditLog.create, notification.create, clientActivationChecklist.upsert, kycFormRevision.create, kycRevisionFile.create, kycSectionData.upsert, kycForm.update, kycInternalReview.updateMany, signedKycDocument.updateMany.
- Tenant/role/state/validation helper candidates: assertStageRole, hasAnyRole, assertReviewStageActive, enumValue, tenantWhere, assertPreviousStageComplete, assertEditableReview, assertReviewPackageReady, assertComplianceReady, assertScreeningReady, assertCrrfReady.
- Error branch candidates: BadRequestException: 'Add DMLRO comments before submitting the review.'); BadRequestException: 'Provide DMLRO comments, reason, or conditions for this decision'); ForbiddenException: `You cannot edit the ${this.stageLabel(stage)} review`); BadRequestException: `${this.stageLabel(stage)} does not have an active review task for this case.`); BadRequestException: `${label} must be one of ${allowed.join(', ')}`); InternalServerErrorException: 'Unable to resubmit this KYC file to MLRO. The review queue was refreshed; NotFoundException: 'KYC case not found'); ForbiddenException: 'User is not assigned to a tenant'); BadRequestException: `${this.stageLabel(previous)} review must be submitted first`); BadRequestException: `${this.stageLabel(stage)} review is locked after submission`); BadRequestException: error); BadRequestException: 'Complete Screening for the client and every current shareholder, beneficial owner and manager before submitting to DMLRO.'); BadRequestException: 'Complete Screening common-list results and upload the NCTC, UN, OFAC, EU and PPO evidence before submitting to DMLRO.'); BadRequestException: 'Complete Screening records with final results, remarks and comments for any matches before submitting to DMLRO.'); BadRequestException: 'Complete the CRRF risk rating and upload the CRRF document before submitting to DMLRO.'); BadRequestException: 'The case changed during this action. Refresh before trying again.'); BadRequestException: 'Create the KYC form before opening an amendment.').
- Evidence: [backend/src/kyc/kyc.controller.ts:331](../../backend/src/kyc/kyc.controller.ts#L331).
- Logic chain: KycService.submitDmlroReview [backend/src/kyc/kyc.service.ts:786](../../backend/src/kyc/kyc.service.ts#L786); KycService.assertStageRole [backend/src/kyc/kyc.service.ts:2486](../../backend/src/kyc/kyc.service.ts#L2486); KycService.hasAnyRole [backend/src/kyc/kyc.service.ts:2482](../../backend/src/kyc/kyc.service.ts#L2482); KycService.stageLabel [backend/src/kyc/kyc.service.ts:2499](../../backend/src/kyc/kyc.service.ts#L2499); KycService.assertReviewStageActive [backend/src/kyc/kyc.service.ts:2558](../../backend/src/kyc/kyc.service.ts#L2558); KycService.enumValue [backend/src/kyc/kyc.service.ts:3217](../../backend/src/kyc/kyc.service.ts#L3217); KycService.optionalText [backend/src/kyc/kyc.service.ts:3240](../../backend/src/kyc/kyc.service.ts#L3240); KycService.text [backend/src/kyc/kyc.service.ts:3285](../../backend/src/kyc/kyc.service.ts#L3285); KycService.submitReviewAndRoute [backend/src/kyc/kyc.service.ts:2591](../../backend/src/kyc/kyc.service.ts#L2591); KycService.findOne [backend/src/kyc/kyc.service.ts:75](../../backend/src/kyc/kyc.service.ts#L75); KycService.tenantWhere [backend/src/kyc/kyc.service.ts:2445](../../backend/src/kyc/kyc.service.ts#L2445); KycService.getTenantId [backend/src/kyc/kyc.service.ts:2470](../../backend/src/kyc/kyc.service.ts#L2470); KycService.caseInclude [backend/src/kyc/kyc.service.ts:3420](../../backend/src/kyc/kyc.service.ts#L3420); KycService.withKycNumber [backend/src/kyc/kyc.service.ts:3378](../../backend/src/kyc/kyc.service.ts#L3378); KycService.generatedKycNumber [backend/src/kyc/kyc.service.ts:3362](../../backend/src/kyc/kyc.service.ts#L3362); KycService.assertPreviousStageComplete [backend/src/kyc/kyc.service.ts:2536](../../backend/src/kyc/kyc.service.ts#L2536); KycService.assertEditableReview [backend/src/kyc/kyc.service.ts:2548](../../backend/src/kyc/kyc.service.ts#L2548); KycService.assertReviewPackageReady [backend/src/kyc/kyc.service.ts:2629](../../backend/src/kyc/kyc.service.ts#L2629); KycService.assertComplianceReady [backend/src/kyc/kyc.service.ts:2635](../../backend/src/kyc/kyc.service.ts#L2635); KycService.assertScreeningReady [backend/src/kyc/kyc.service.ts:2644](../../backend/src/kyc/kyc.service.ts#L2644); KycService.formInclude [backend/src/kyc/kyc.service.ts:2120](../../backend/src/kyc/kyc.service.ts#L2120); KycService.serializeForm [backend/src/kyc/kyc.service.ts:2061](../../backend/src/kyc/kyc.service.ts#L2061); KycService.sectionRows [backend/src/kyc/kyc.service.ts:2148](../../backend/src/kyc/kyc.service.ts#L2148); KycService.asArray [backend/src/kyc/kyc.service.ts:3225](../../backend/src/kyc/kyc.service.ts#L3225); KycService.sectionFWithCaseDocuments [backend/src/kyc/kyc.service.ts:2153](../../backend/src/kyc/kyc.service.ts#L2153); KycService.dedupeRequiredDocumentRows [backend/src/kyc/kyc.service.ts:2235](../../backend/src/kyc/kyc.service.ts#L2235); KycService.documentMatchText [backend/src/kyc/kyc.service.ts:2332](../../backend/src/kyc/kyc.service.ts#L2332); KycService.documentFileNames [backend/src/kyc/kyc.service.ts:2296](../../backend/src/kyc/kyc.service.ts#L2296); KycService.isRequiredDocumentMatch [backend/src/kyc/kyc.service.ts:2311](../../backend/src/kyc/kyc.service.ts#L2311); KycService.dedupeAdditionalDocumentRows [backend/src/kyc/kyc.service.ts:2277](../../backend/src/kyc/kyc.service.ts#L2277); KycService.assertCrrfReady [backend/src/kyc/kyc.service.ts:2675](../../backend/src/kyc/kyc.service.ts#L2675); KycService.lockReviewSubmission [backend/src/kyc/kyc.service.ts:2729](../../backend/src/kyc/kyc.service.ts#L2729); KycService.jsonValue [backend/src/kyc/kyc.service.ts:3272](../../backend/src/kyc/kyc.service.ts#L3272); KycService.clearReviewTaskStatus [backend/src/kyc/kyc.service.ts:2585](../../backend/src/kyc/kyc.service.ts#L2585); KycService.recordStatus [backend/src/kyc/kyc.service.ts:2866](../../backend/src/kyc/kyc.service.ts#L2866); KycService.stageStatus [backend/src/kyc/kyc.service.ts:2505](../../backend/src/kyc/kyc.service.ts#L2505); KycService.audit [backend/src/kyc/kyc.service.ts:2890](../../backend/src/kyc/kyc.service.ts#L2890); KycService.createNotification [backend/src/kyc/kyc.service.ts:2903](../../backend/src/kyc/kyc.service.ts#L2903); KycService.upsertActivationChecklist [backend/src/kyc/kyc.service.ts:3048](../../backend/src/kyc/kyc.service.ts#L3048); KycService.activationChecklistItems [backend/src/kyc/kyc.service.ts:3019](../../backend/src/kyc/kyc.service.ts#L3019); KycService.returnDmlroReviewToSupervisor [backend/src/kyc/kyc.service.ts:2682](../../backend/src/kyc/kyc.service.ts#L2682); KycService.saveReturnedReviewSubmission [backend/src/kyc/kyc.service.ts:2805](../../backend/src/kyc/kyc.service.ts#L2805); KycService.beginFormAmendment [backend/src/kyc/kyc.service.ts:1212](../../backend/src/kyc/kyc.service.ts#L1212); KycService.resolveLegalDocumentPath [backend/src/kyc/kyc.service.ts:3313](../../backend/src/kyc/kyc.service.ts#L3313); KycService.legalDocumentUploadRoot [backend/src/kyc/kyc.service.ts:3305](../../backend/src/kyc/kyc.service.ts#L3305); KycService.signedKycDocumentUploadRoot [backend/src/kyc/kyc.service.ts:3309](../../backend/src/kyc/kyc.service.ts#L3309).
- QA: apply Q-API for this ID and its workflow-specific cases; store status/body/DB diff with secrets removed.
- DTO field-access candidates: conditions, confidentialNotes, data, decision, formalComments, reason. These span reachable helpers and may include fields of internally composed DTOs; they are not a mandatory field list or complete wire schema. Match to the entry DTO and workflow before constructing requests.

## API-3D4B2E9E

**POST /api/kyc/:id/internal-reviews/mlro/decision** - KycController.decideMlroReview

- Entry/auth: AuthGuard('jwt'); RolesGuard; fallback roles: MLRO, COMPANY_ADMIN, SUPER_ADMIN.
- Inputs: `@CurrentUser() user: RequestUser`; `@Param('id') id: string`; `@Body() dto: Record<string, unknown>`.
- Output: JSON returned from delegated service; inferred fields in linked implementation. Inferred by TypeScript; no explicit response DTO.
- Behavior: Command (may mutate); detected reachable writes: kycForm.update, internalReviewTask.updateMany, internalReviewTask.upsert, internalReviewSubmission.updateMany, internalReviewSubmission.upsert, internalReviewVersion.create, reviewerComment.updateMany, kycInternalReview.upsert, kycCase.update, kycCaseStatusHistory.create, internalReviewTask.deleteMany, riskReclassification.create, auditLog.create, notification.create, clientActivationChecklist.upsert.
- Tenant/role/state/validation helper candidates: assertStageRole, hasAnyRole, assertReviewStageActive, assertPreviousStageComplete, enumValue, tenantWhere, requiredText.
- Error branch candidates: BadRequestException: 'Provide a reason or conditions for this MLRO decision'); BadRequestException: 'Provide the reason for approving or deciding this case before DMLRO review is completed'); BadRequestException: 'Risk classification changes require an explanation'); BadRequestException: 'High-risk KYC files must be sent to SEF for management decision before final approval.'); InternalServerErrorException: 'Unable to send KYC file to SEF. Confirm the latest database migrations are applied and try again.'); ForbiddenException: `You cannot edit the ${this.stageLabel(stage)} review`); BadRequestException: `${this.stageLabel(stage)} does not have an active review task for this case.`); BadRequestException: `${this.stageLabel(previous)} review must be submitted first`); BadRequestException: `${label} must be one of ${allowed.join(', ')}`); NotFoundException: 'KYC case not found'); ForbiddenException: 'User is not assigned to a tenant'); BadRequestException: `${label} is required`); BadRequestException: 'Invalid date value').
- Evidence: [backend/src/kyc/kyc.controller.ts:337](../../backend/src/kyc/kyc.controller.ts#L337).
- Logic chain: KycService.decideMlroReview [backend/src/kyc/kyc.service.ts:828](../../backend/src/kyc/kyc.service.ts#L828); KycService.assertStageRole [backend/src/kyc/kyc.service.ts:2486](../../backend/src/kyc/kyc.service.ts#L2486); KycService.hasAnyRole [backend/src/kyc/kyc.service.ts:2482](../../backend/src/kyc/kyc.service.ts#L2482); KycService.stageLabel [backend/src/kyc/kyc.service.ts:2499](../../backend/src/kyc/kyc.service.ts#L2499); KycService.assertReviewStageActive [backend/src/kyc/kyc.service.ts:2558](../../backend/src/kyc/kyc.service.ts#L2558); KycService.assertPreviousStageComplete [backend/src/kyc/kyc.service.ts:2536](../../backend/src/kyc/kyc.service.ts#L2536); KycService.enumValue [backend/src/kyc/kyc.service.ts:3217](../../backend/src/kyc/kyc.service.ts#L3217); KycService.findOne [backend/src/kyc/kyc.service.ts:75](../../backend/src/kyc/kyc.service.ts#L75); KycService.tenantWhere [backend/src/kyc/kyc.service.ts:2445](../../backend/src/kyc/kyc.service.ts#L2445); KycService.getTenantId [backend/src/kyc/kyc.service.ts:2470](../../backend/src/kyc/kyc.service.ts#L2470); KycService.caseInclude [backend/src/kyc/kyc.service.ts:3420](../../backend/src/kyc/kyc.service.ts#L3420); KycService.withKycNumber [backend/src/kyc/kyc.service.ts:3378](../../backend/src/kyc/kyc.service.ts#L3378); KycService.generatedKycNumber [backend/src/kyc/kyc.service.ts:3362](../../backend/src/kyc/kyc.service.ts#L3362); KycService.optionalText [backend/src/kyc/kyc.service.ts:3240](../../backend/src/kyc/kyc.service.ts#L3240); KycService.text [backend/src/kyc/kyc.service.ts:3285](../../backend/src/kyc/kyc.service.ts#L3285); KycService.lockReviewSubmission [backend/src/kyc/kyc.service.ts:2729](../../backend/src/kyc/kyc.service.ts#L2729); KycService.jsonValue [backend/src/kyc/kyc.service.ts:3272](../../backend/src/kyc/kyc.service.ts#L3272); KycService.mlroDecisionStatus [backend/src/kyc/kyc.service.ts:2915](../../backend/src/kyc/kyc.service.ts#L2915); KycService.recordStatus [backend/src/kyc/kyc.service.ts:2866](../../backend/src/kyc/kyc.service.ts#L2866); KycService.mlroStatusNote [backend/src/kyc/kyc.service.ts:2930](../../backend/src/kyc/kyc.service.ts#L2930); KycService.clearReviewTaskStatus [backend/src/kyc/kyc.service.ts:2585](../../backend/src/kyc/kyc.service.ts#L2585); KycService.saveRiskReclassification [backend/src/kyc/kyc.service.ts:2985](../../backend/src/kyc/kyc.service.ts#L2985); KycService.requiredText [backend/src/kyc/kyc.service.ts:3233](../../backend/src/kyc/kyc.service.ts#L3233); KycService.dateValue [backend/src/kyc/kyc.service.ts:3249](../../backend/src/kyc/kyc.service.ts#L3249); KycService.audit [backend/src/kyc/kyc.service.ts:2890](../../backend/src/kyc/kyc.service.ts#L2890); KycService.createNotification [backend/src/kyc/kyc.service.ts:2903](../../backend/src/kyc/kyc.service.ts#L2903); KycService.mlroNotificationType [backend/src/kyc/kyc.service.ts:2924](../../backend/src/kyc/kyc.service.ts#L2924); KycService.mlroNotificationTitle [backend/src/kyc/kyc.service.ts:2939](../../backend/src/kyc/kyc.service.ts#L2939); KycService.mlroNotificationMessage [backend/src/kyc/kyc.service.ts:2947](../../backend/src/kyc/kyc.service.ts#L2947); KycService.upsertActivationChecklist [backend/src/kyc/kyc.service.ts:3048](../../backend/src/kyc/kyc.service.ts#L3048); KycService.activationChecklistItems [backend/src/kyc/kyc.service.ts:3019](../../backend/src/kyc/kyc.service.ts#L3019).
- QA: apply Q-API for this ID and its workflow-specific cases; store status/body/DB diff with secrets removed.
- DTO field-access candidates: conditions, confidentialNotes, data, decision, finalRiskClassification, formalComments, previousRiskClassification, reason, riskEffectiveDate, riskExplanation, riskReasonCategory. These span reachable helpers and may include fields of internally composed DTOs; they are not a mandatory field list or complete wire schema. Match to the entry DTO and workflow before constructing requests.

## API-B3555C2D

**POST /api/kyc/:id/internal-reviews/sef/decision** - KycController.decideSefReview

- Entry/auth: AuthGuard('jwt'); RolesGuard; fallback roles: SEF, COMPANY_ADMIN, SUPER_ADMIN.
- Inputs: `@CurrentUser() user: RequestUser`; `@Param('id') id: string`; `@Body() dto: Record<string, unknown>`.
- Output: JSON returned from delegated service; inferred fields in linked implementation. Inferred by TypeScript; no explicit response DTO.
- Behavior: Command (may mutate); detected reachable writes: internalReviewSubmission.updateMany, internalReviewTask.upsert, internalReviewTask.updateMany, internalReviewSubmission.upsert, internalReviewVersion.create, reviewerComment.updateMany, kycInternalReview.upsert, kycCase.update, kycCaseStatusHistory.create, internalReviewTask.deleteMany, notification.create, auditLog.create, clientActivationChecklist.upsert.
- Tenant/role/state/validation helper candidates: assertStageRole, hasAnyRole, assertReviewStageActive, enumValue, tenantWhere, assertPreviousStageComplete.
- Error branch candidates: BadRequestException: 'Provide SEF reason or conditions for this decision'); ForbiddenException: `You cannot edit the ${this.stageLabel(stage)} review`); BadRequestException: `${this.stageLabel(stage)} does not have an active review task for this case.`); BadRequestException: `${label} must be one of ${allowed.join(', ')}`); NotFoundException: 'KYC case not found'); ForbiddenException: 'User is not assigned to a tenant'); BadRequestException: `${this.stageLabel(previous)} review must be submitted first`).
- Evidence: [backend/src/kyc/kyc.controller.ts:343](../../backend/src/kyc/kyc.controller.ts#L343).
- Logic chain: KycService.decideSefReview [backend/src/kyc/kyc.service.ts:941](../../backend/src/kyc/kyc.service.ts#L941); KycService.assertStageRole [backend/src/kyc/kyc.service.ts:2486](../../backend/src/kyc/kyc.service.ts#L2486); KycService.hasAnyRole [backend/src/kyc/kyc.service.ts:2482](../../backend/src/kyc/kyc.service.ts#L2482); KycService.stageLabel [backend/src/kyc/kyc.service.ts:2499](../../backend/src/kyc/kyc.service.ts#L2499); KycService.assertReviewStageActive [backend/src/kyc/kyc.service.ts:2558](../../backend/src/kyc/kyc.service.ts#L2558); KycService.enumValue [backend/src/kyc/kyc.service.ts:3217](../../backend/src/kyc/kyc.service.ts#L3217); KycService.findOne [backend/src/kyc/kyc.service.ts:75](../../backend/src/kyc/kyc.service.ts#L75); KycService.tenantWhere [backend/src/kyc/kyc.service.ts:2445](../../backend/src/kyc/kyc.service.ts#L2445); KycService.getTenantId [backend/src/kyc/kyc.service.ts:2470](../../backend/src/kyc/kyc.service.ts#L2470); KycService.caseInclude [backend/src/kyc/kyc.service.ts:3420](../../backend/src/kyc/kyc.service.ts#L3420); KycService.withKycNumber [backend/src/kyc/kyc.service.ts:3378](../../backend/src/kyc/kyc.service.ts#L3378); KycService.generatedKycNumber [backend/src/kyc/kyc.service.ts:3362](../../backend/src/kyc/kyc.service.ts#L3362); KycService.assertPreviousStageComplete [backend/src/kyc/kyc.service.ts:2536](../../backend/src/kyc/kyc.service.ts#L2536); KycService.optionalText [backend/src/kyc/kyc.service.ts:3240](../../backend/src/kyc/kyc.service.ts#L3240); KycService.text [backend/src/kyc/kyc.service.ts:3285](../../backend/src/kyc/kyc.service.ts#L3285); KycService.lockReviewSubmission [backend/src/kyc/kyc.service.ts:2729](../../backend/src/kyc/kyc.service.ts#L2729); KycService.jsonValue [backend/src/kyc/kyc.service.ts:3272](../../backend/src/kyc/kyc.service.ts#L3272); KycService.recordStatus [backend/src/kyc/kyc.service.ts:2866](../../backend/src/kyc/kyc.service.ts#L2866); KycService.clearReviewTaskStatus [backend/src/kyc/kyc.service.ts:2585](../../backend/src/kyc/kyc.service.ts#L2585); KycService.createNotification [backend/src/kyc/kyc.service.ts:2903](../../backend/src/kyc/kyc.service.ts#L2903); KycService.audit [backend/src/kyc/kyc.service.ts:2890](../../backend/src/kyc/kyc.service.ts#L2890); KycService.upsertActivationChecklist [backend/src/kyc/kyc.service.ts:3048](../../backend/src/kyc/kyc.service.ts#L3048); KycService.activationChecklistItems [backend/src/kyc/kyc.service.ts:3019](../../backend/src/kyc/kyc.service.ts#L3019).
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
- Evidence: [backend/src/kyc/kyc.controller.ts:360](../../backend/src/kyc/kyc.controller.ts#L360).
- Logic chain: KycService.uploadSignedKycDocument [backend/src/kyc/kyc.service.ts:1011](../../backend/src/kyc/kyc.service.ts#L1011); KycService.findOne [backend/src/kyc/kyc.service.ts:75](../../backend/src/kyc/kyc.service.ts#L75); KycService.tenantWhere [backend/src/kyc/kyc.service.ts:2445](../../backend/src/kyc/kyc.service.ts#L2445); KycService.getTenantId [backend/src/kyc/kyc.service.ts:2470](../../backend/src/kyc/kyc.service.ts#L2470); KycService.caseInclude [backend/src/kyc/kyc.service.ts:3420](../../backend/src/kyc/kyc.service.ts#L3420); KycService.withKycNumber [backend/src/kyc/kyc.service.ts:3378](../../backend/src/kyc/kyc.service.ts#L3378); KycService.generatedKycNumber [backend/src/kyc/kyc.service.ts:3362](../../backend/src/kyc/kyc.service.ts#L3362); KycService.enumValue [backend/src/kyc/kyc.service.ts:3217](../../backend/src/kyc/kyc.service.ts#L3217); KycService.hasAnyRole [backend/src/kyc/kyc.service.ts:2482](../../backend/src/kyc/kyc.service.ts#L2482); KycService.requiredText [backend/src/kyc/kyc.service.ts:3233](../../backend/src/kyc/kyc.service.ts#L3233); KycService.optionalText [backend/src/kyc/kyc.service.ts:3240](../../backend/src/kyc/kyc.service.ts#L3240); KycService.text [backend/src/kyc/kyc.service.ts:3285](../../backend/src/kyc/kyc.service.ts#L3285); KycService.audit [backend/src/kyc/kyc.service.ts:2890](../../backend/src/kyc/kyc.service.ts#L2890); KycService.jsonValue [backend/src/kyc/kyc.service.ts:3272](../../backend/src/kyc/kyc.service.ts#L3272); KycService.createNotification [backend/src/kyc/kyc.service.ts:2903](../../backend/src/kyc/kyc.service.ts#L2903).
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
- Evidence: [backend/src/kyc/kyc.controller.ts:366](../../backend/src/kyc/kyc.controller.ts#L366).
- Logic chain: KycService.uploadSignedKycDocumentFile [backend/src/kyc/kyc.service.ts:1048](../../backend/src/kyc/kyc.service.ts#L1048); KycService.findOne [backend/src/kyc/kyc.service.ts:75](../../backend/src/kyc/kyc.service.ts#L75); KycService.tenantWhere [backend/src/kyc/kyc.service.ts:2445](../../backend/src/kyc/kyc.service.ts#L2445); KycService.getTenantId [backend/src/kyc/kyc.service.ts:2470](../../backend/src/kyc/kyc.service.ts#L2470); KycService.caseInclude [backend/src/kyc/kyc.service.ts:3420](../../backend/src/kyc/kyc.service.ts#L3420); KycService.withKycNumber [backend/src/kyc/kyc.service.ts:3378](../../backend/src/kyc/kyc.service.ts#L3378); KycService.generatedKycNumber [backend/src/kyc/kyc.service.ts:3362](../../backend/src/kyc/kyc.service.ts#L3362); KycService.enumValue [backend/src/kyc/kyc.service.ts:3217](../../backend/src/kyc/kyc.service.ts#L3217); KycService.hasAnyRole [backend/src/kyc/kyc.service.ts:2482](../../backend/src/kyc/kyc.service.ts#L2482); KycService.signedKycDocumentUploadRoot [backend/src/kyc/kyc.service.ts:3309](../../backend/src/kyc/kyc.service.ts#L3309); KycService.safeFileName [backend/src/kyc/kyc.service.ts:3385](../../backend/src/kyc/kyc.service.ts#L3385); KycService.uploadSignedKycDocument [backend/src/kyc/kyc.service.ts:1011](../../backend/src/kyc/kyc.service.ts#L1011); KycService.requiredText [backend/src/kyc/kyc.service.ts:3233](../../backend/src/kyc/kyc.service.ts#L3233); KycService.optionalText [backend/src/kyc/kyc.service.ts:3240](../../backend/src/kyc/kyc.service.ts#L3240); KycService.text [backend/src/kyc/kyc.service.ts:3285](../../backend/src/kyc/kyc.service.ts#L3285); KycService.audit [backend/src/kyc/kyc.service.ts:2890](../../backend/src/kyc/kyc.service.ts#L2890); KycService.jsonValue [backend/src/kyc/kyc.service.ts:3272](../../backend/src/kyc/kyc.service.ts#L3272); KycService.createNotification [backend/src/kyc/kyc.service.ts:2903](../../backend/src/kyc/kyc.service.ts#L2903).
- QA: apply Q-API for this ID and its workflow-specific cases; store status/body/DB diff with secrets removed.
- DTO field-access candidates: comments, fileName, fileSize, fileType, reviewStage, signatureType, storageKey. These span reachable helpers and may include fields of internally composed DTOs; they are not a mandatory field list or complete wire schema. Match to the entry DTO and workflow before constructing requests.

## API-C8B81FCD

**POST /api/kyc/:id/internal-reviews/supervisor/submit** - KycController.submitSupervisorReview

- Entry/auth: AuthGuard('jwt'); RolesGuard; fallback roles: AML_SUPERVISOR, AML_TEAM, COMPANY_ADMIN, SUPER_ADMIN.
- Inputs: `@CurrentUser() user: RequestUser`; `@Param('id') id: string`; `@Body() dto: Record<string, unknown>`.
- Output: JSON returned from delegated service; inferred fields in linked implementation. Inferred by TypeScript; no explicit response DTO.
- Behavior: Command (may mutate); detected reachable writes: internalReviewTask.updateMany, internalReviewSubmission.updateMany, internalReviewTask.upsert, internalReviewSubmission.upsert, internalReviewVersion.create, reviewerComment.updateMany, kycInternalReview.upsert, internalReviewTask.deleteMany, kycCase.update, kycCaseStatusHistory.create, auditLog.create, notification.create.
- Tenant/role/state/validation helper candidates: assertStageRole, hasAnyRole, assertReviewStageActive, tenantWhere, assertPreviousStageComplete, assertEditableReview, assertReviewPackageReady, assertComplianceReady, assertScreeningReady, assertCrrfReady.
- Error branch candidates: BadRequestException: 'Add AML Supervisor comments before submitting the review.'); ForbiddenException: `You cannot edit the ${this.stageLabel(stage)} review`); BadRequestException: `${this.stageLabel(stage)} does not have an active review task for this case.`); InternalServerErrorException: 'Unable to resubmit this KYC file to MLRO. The review queue was refreshed; NotFoundException: 'KYC case not found'); ForbiddenException: 'User is not assigned to a tenant'); BadRequestException: `${this.stageLabel(previous)} review must be submitted first`); BadRequestException: `${this.stageLabel(stage)} review is locked after submission`); BadRequestException: error); BadRequestException: 'Complete Screening for the client and every current shareholder, beneficial owner and manager before submitting to DMLRO.'); BadRequestException: 'Complete Screening common-list results and upload the NCTC, UN, OFAC, EU and PPO evidence before submitting to DMLRO.'); BadRequestException: 'Complete Screening records with final results, remarks and comments for any matches before submitting to DMLRO.'); BadRequestException: 'Complete the CRRF risk rating and upload the CRRF document before submitting to DMLRO.').
- Evidence: [backend/src/kyc/kyc.controller.ts:325](../../backend/src/kyc/kyc.controller.ts#L325).
- Logic chain: KycService.submitSupervisorReview [backend/src/kyc/kyc.service.ts:779](../../backend/src/kyc/kyc.service.ts#L779); KycService.assertStageRole [backend/src/kyc/kyc.service.ts:2486](../../backend/src/kyc/kyc.service.ts#L2486); KycService.hasAnyRole [backend/src/kyc/kyc.service.ts:2482](../../backend/src/kyc/kyc.service.ts#L2482); KycService.stageLabel [backend/src/kyc/kyc.service.ts:2499](../../backend/src/kyc/kyc.service.ts#L2499); KycService.assertReviewStageActive [backend/src/kyc/kyc.service.ts:2558](../../backend/src/kyc/kyc.service.ts#L2558); KycService.submitReviewAndRoute [backend/src/kyc/kyc.service.ts:2591](../../backend/src/kyc/kyc.service.ts#L2591); KycService.findOne [backend/src/kyc/kyc.service.ts:75](../../backend/src/kyc/kyc.service.ts#L75); KycService.tenantWhere [backend/src/kyc/kyc.service.ts:2445](../../backend/src/kyc/kyc.service.ts#L2445); KycService.getTenantId [backend/src/kyc/kyc.service.ts:2470](../../backend/src/kyc/kyc.service.ts#L2470); KycService.caseInclude [backend/src/kyc/kyc.service.ts:3420](../../backend/src/kyc/kyc.service.ts#L3420); KycService.withKycNumber [backend/src/kyc/kyc.service.ts:3378](../../backend/src/kyc/kyc.service.ts#L3378); KycService.generatedKycNumber [backend/src/kyc/kyc.service.ts:3362](../../backend/src/kyc/kyc.service.ts#L3362); KycService.assertPreviousStageComplete [backend/src/kyc/kyc.service.ts:2536](../../backend/src/kyc/kyc.service.ts#L2536); KycService.assertEditableReview [backend/src/kyc/kyc.service.ts:2548](../../backend/src/kyc/kyc.service.ts#L2548); KycService.assertReviewPackageReady [backend/src/kyc/kyc.service.ts:2629](../../backend/src/kyc/kyc.service.ts#L2629); KycService.assertComplianceReady [backend/src/kyc/kyc.service.ts:2635](../../backend/src/kyc/kyc.service.ts#L2635); KycService.assertScreeningReady [backend/src/kyc/kyc.service.ts:2644](../../backend/src/kyc/kyc.service.ts#L2644); KycService.formInclude [backend/src/kyc/kyc.service.ts:2120](../../backend/src/kyc/kyc.service.ts#L2120); KycService.serializeForm [backend/src/kyc/kyc.service.ts:2061](../../backend/src/kyc/kyc.service.ts#L2061); KycService.sectionRows [backend/src/kyc/kyc.service.ts:2148](../../backend/src/kyc/kyc.service.ts#L2148); KycService.asArray [backend/src/kyc/kyc.service.ts:3225](../../backend/src/kyc/kyc.service.ts#L3225); KycService.text [backend/src/kyc/kyc.service.ts:3285](../../backend/src/kyc/kyc.service.ts#L3285); KycService.sectionFWithCaseDocuments [backend/src/kyc/kyc.service.ts:2153](../../backend/src/kyc/kyc.service.ts#L2153); KycService.dedupeRequiredDocumentRows [backend/src/kyc/kyc.service.ts:2235](../../backend/src/kyc/kyc.service.ts#L2235); KycService.optionalText [backend/src/kyc/kyc.service.ts:3240](../../backend/src/kyc/kyc.service.ts#L3240); KycService.documentMatchText [backend/src/kyc/kyc.service.ts:2332](../../backend/src/kyc/kyc.service.ts#L2332); KycService.documentFileNames [backend/src/kyc/kyc.service.ts:2296](../../backend/src/kyc/kyc.service.ts#L2296); KycService.isRequiredDocumentMatch [backend/src/kyc/kyc.service.ts:2311](../../backend/src/kyc/kyc.service.ts#L2311); KycService.dedupeAdditionalDocumentRows [backend/src/kyc/kyc.service.ts:2277](../../backend/src/kyc/kyc.service.ts#L2277); KycService.assertCrrfReady [backend/src/kyc/kyc.service.ts:2675](../../backend/src/kyc/kyc.service.ts#L2675); KycService.lockReviewSubmission [backend/src/kyc/kyc.service.ts:2729](../../backend/src/kyc/kyc.service.ts#L2729); KycService.jsonValue [backend/src/kyc/kyc.service.ts:3272](../../backend/src/kyc/kyc.service.ts#L3272); KycService.clearReviewTaskStatus [backend/src/kyc/kyc.service.ts:2585](../../backend/src/kyc/kyc.service.ts#L2585); KycService.recordStatus [backend/src/kyc/kyc.service.ts:2866](../../backend/src/kyc/kyc.service.ts#L2866); KycService.stageStatus [backend/src/kyc/kyc.service.ts:2505](../../backend/src/kyc/kyc.service.ts#L2505); KycService.audit [backend/src/kyc/kyc.service.ts:2890](../../backend/src/kyc/kyc.service.ts#L2890); KycService.createNotification [backend/src/kyc/kyc.service.ts:2903](../../backend/src/kyc/kyc.service.ts#L2903).
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
- Logic chain: KycService.uploadLegalDocument [backend/src/kyc/kyc.service.ts:240](../../backend/src/kyc/kyc.service.ts#L240); KycService.requireWritableCase [backend/src/kyc/kyc.service.ts:2342](../../backend/src/kyc/kyc.service.ts#L2342); KycService.tenantWhere [backend/src/kyc/kyc.service.ts:2445](../../backend/src/kyc/kyc.service.ts#L2445); KycService.getTenantId [backend/src/kyc/kyc.service.ts:2470](../../backend/src/kyc/kyc.service.ts#L2470); KycService.isPreparationEditableStatus [backend/src/kyc/kyc.service.ts:2364](../../backend/src/kyc/kyc.service.ts#L2364); KycService.isLegacyFullKycDraft [backend/src/kyc/kyc.service.ts:2358](../../backend/src/kyc/kyc.service.ts#L2358); KycService.formTenantWhere [backend/src/kyc/kyc.service.ts:2462](../../backend/src/kyc/kyc.service.ts#L2462); KycService.caseInclude [backend/src/kyc/kyc.service.ts:3420](../../backend/src/kyc/kyc.service.ts#L3420).
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
- Evidence: [backend/src/kyc/kyc.controller.ts:269](../../backend/src/kyc/kyc.controller.ts#L269).
- Logic chain: KycService.deleteLegalDocument [backend/src/kyc/kyc.service.ts:486](../../backend/src/kyc/kyc.service.ts#L486); KycService.requireWritableCase [backend/src/kyc/kyc.service.ts:2342](../../backend/src/kyc/kyc.service.ts#L2342); KycService.tenantWhere [backend/src/kyc/kyc.service.ts:2445](../../backend/src/kyc/kyc.service.ts#L2445); KycService.getTenantId [backend/src/kyc/kyc.service.ts:2470](../../backend/src/kyc/kyc.service.ts#L2470); KycService.isPreparationEditableStatus [backend/src/kyc/kyc.service.ts:2364](../../backend/src/kyc/kyc.service.ts#L2364); KycService.isLegacyFullKycDraft [backend/src/kyc/kyc.service.ts:2358](../../backend/src/kyc/kyc.service.ts#L2358); KycService.formTenantWhere [backend/src/kyc/kyc.service.ts:2462](../../backend/src/kyc/kyc.service.ts#L2462); KycService.resolveLegalDocumentPath [backend/src/kyc/kyc.service.ts:3313](../../backend/src/kyc/kyc.service.ts#L3313); KycService.legalDocumentUploadRoot [backend/src/kyc/kyc.service.ts:3305](../../backend/src/kyc/kyc.service.ts#L3305); KycService.caseInclude [backend/src/kyc/kyc.service.ts:3420](../../backend/src/kyc/kyc.service.ts#L3420).
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
- Evidence: [backend/src/kyc/kyc.controller.ts:241](../../backend/src/kyc/kyc.controller.ts#L241).
- Logic chain: KycService.getLegalDocumentFile [backend/src/kyc/kyc.service.ts:429](../../backend/src/kyc/kyc.service.ts#L429); KycService.findOne [backend/src/kyc/kyc.service.ts:75](../../backend/src/kyc/kyc.service.ts#L75); KycService.tenantWhere [backend/src/kyc/kyc.service.ts:2445](../../backend/src/kyc/kyc.service.ts#L2445); KycService.getTenantId [backend/src/kyc/kyc.service.ts:2470](../../backend/src/kyc/kyc.service.ts#L2470); KycService.caseInclude [backend/src/kyc/kyc.service.ts:3420](../../backend/src/kyc/kyc.service.ts#L3420); KycService.withKycNumber [backend/src/kyc/kyc.service.ts:3378](../../backend/src/kyc/kyc.service.ts#L3378); KycService.generatedKycNumber [backend/src/kyc/kyc.service.ts:3362](../../backend/src/kyc/kyc.service.ts#L3362); KycService.resolveLegalDocumentPath [backend/src/kyc/kyc.service.ts:3313](../../backend/src/kyc/kyc.service.ts#L3313); KycService.legalDocumentUploadRoot [backend/src/kyc/kyc.service.ts:3305](../../backend/src/kyc/kyc.service.ts#L3305).
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
- Evidence: [backend/src/kyc/kyc.controller.ts:255](../../backend/src/kyc/kyc.controller.ts#L255).
- Logic chain: KycService.getLegalDocumentGroupZip [backend/src/kyc/kyc.service.ts:454](../../backend/src/kyc/kyc.service.ts#L454); KycService.findOne [backend/src/kyc/kyc.service.ts:75](../../backend/src/kyc/kyc.service.ts#L75); KycService.tenantWhere [backend/src/kyc/kyc.service.ts:2445](../../backend/src/kyc/kyc.service.ts#L2445); KycService.getTenantId [backend/src/kyc/kyc.service.ts:2470](../../backend/src/kyc/kyc.service.ts#L2470); KycService.caseInclude [backend/src/kyc/kyc.service.ts:3420](../../backend/src/kyc/kyc.service.ts#L3420); KycService.withKycNumber [backend/src/kyc/kyc.service.ts:3378](../../backend/src/kyc/kyc.service.ts#L3378); KycService.generatedKycNumber [backend/src/kyc/kyc.service.ts:3362](../../backend/src/kyc/kyc.service.ts#L3362); KycService.resolveLegalDocumentPath [backend/src/kyc/kyc.service.ts:3313](../../backend/src/kyc/kyc.service.ts#L3313); KycService.legalDocumentUploadRoot [backend/src/kyc/kyc.service.ts:3305](../../backend/src/kyc/kyc.service.ts#L3305); KycService.uniqueArchiveFileName [backend/src/kyc/kyc.service.ts:3394](../../backend/src/kyc/kyc.service.ts#L3394); KycService.safeFileName [backend/src/kyc/kyc.service.ts:3385](../../backend/src/kyc/kyc.service.ts#L3385).
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
- Logic chain: KycService.uploadLegalDocumentFile [backend/src/kyc/kyc.service.ts:306](../../backend/src/kyc/kyc.service.ts#L306); KycService.uploadLegalDocumentFiles [backend/src/kyc/kyc.service.ts:315](../../backend/src/kyc/kyc.service.ts#L315); KycService.requireWritableCase [backend/src/kyc/kyc.service.ts:2342](../../backend/src/kyc/kyc.service.ts#L2342); KycService.tenantWhere [backend/src/kyc/kyc.service.ts:2445](../../backend/src/kyc/kyc.service.ts#L2445); KycService.getTenantId [backend/src/kyc/kyc.service.ts:2470](../../backend/src/kyc/kyc.service.ts#L2470); KycService.isPreparationEditableStatus [backend/src/kyc/kyc.service.ts:2364](../../backend/src/kyc/kyc.service.ts#L2364); KycService.isLegacyFullKycDraft [backend/src/kyc/kyc.service.ts:2358](../../backend/src/kyc/kyc.service.ts#L2358); KycService.formTenantWhere [backend/src/kyc/kyc.service.ts:2462](../../backend/src/kyc/kyc.service.ts#L2462); KycService.legalDocumentUploadRoot [backend/src/kyc/kyc.service.ts:3305](../../backend/src/kyc/kyc.service.ts#L3305); KycService.safeFileName [backend/src/kyc/kyc.service.ts:3385](../../backend/src/kyc/kyc.service.ts#L3385); KycService.caseInclude [backend/src/kyc/kyc.service.ts:3420](../../backend/src/kyc/kyc.service.ts#L3420).
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
- Evidence: [backend/src/kyc/kyc.controller.ts:229](../../backend/src/kyc/kyc.controller.ts#L229).
- Logic chain: KycService.uploadLegalDocumentFiles [backend/src/kyc/kyc.service.ts:315](../../backend/src/kyc/kyc.service.ts#L315); KycService.requireWritableCase [backend/src/kyc/kyc.service.ts:2342](../../backend/src/kyc/kyc.service.ts#L2342); KycService.tenantWhere [backend/src/kyc/kyc.service.ts:2445](../../backend/src/kyc/kyc.service.ts#L2445); KycService.getTenantId [backend/src/kyc/kyc.service.ts:2470](../../backend/src/kyc/kyc.service.ts#L2470); KycService.isPreparationEditableStatus [backend/src/kyc/kyc.service.ts:2364](../../backend/src/kyc/kyc.service.ts#L2364); KycService.isLegacyFullKycDraft [backend/src/kyc/kyc.service.ts:2358](../../backend/src/kyc/kyc.service.ts#L2358); KycService.formTenantWhere [backend/src/kyc/kyc.service.ts:2462](../../backend/src/kyc/kyc.service.ts#L2462); KycService.legalDocumentUploadRoot [backend/src/kyc/kyc.service.ts:3305](../../backend/src/kyc/kyc.service.ts#L3305); KycService.safeFileName [backend/src/kyc/kyc.service.ts:3385](../../backend/src/kyc/kyc.service.ts#L3385); KycService.caseInclude [backend/src/kyc/kyc.service.ts:3420](../../backend/src/kyc/kyc.service.ts#L3420).
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
- Logic chain: KycService.updateProposalStatus [backend/src/kyc/kyc.service.ts:228](../../backend/src/kyc/kyc.service.ts#L228); KycService.requireWritableCase [backend/src/kyc/kyc.service.ts:2342](../../backend/src/kyc/kyc.service.ts#L2342); KycService.tenantWhere [backend/src/kyc/kyc.service.ts:2445](../../backend/src/kyc/kyc.service.ts#L2445); KycService.getTenantId [backend/src/kyc/kyc.service.ts:2470](../../backend/src/kyc/kyc.service.ts#L2470); KycService.isPreparationEditableStatus [backend/src/kyc/kyc.service.ts:2364](../../backend/src/kyc/kyc.service.ts#L2364); KycService.isLegacyFullKycDraft [backend/src/kyc/kyc.service.ts:2358](../../backend/src/kyc/kyc.service.ts#L2358); KycService.formTenantWhere [backend/src/kyc/kyc.service.ts:2462](../../backend/src/kyc/kyc.service.ts#L2462); KycService.updateStatus [backend/src/kyc/kyc.service.ts:2404](../../backend/src/kyc/kyc.service.ts#L2404); KycService.caseInclude [backend/src/kyc/kyc.service.ts:3420](../../backend/src/kyc/kyc.service.ts#L3420).
- QA: apply Q-API for this ID and its workflow-specific cases; store status/body/DB diff with secrets removed.
- DTO field-access candidates: note, proposalStatus. These span reachable helpers and may include fields of internally composed DTOs; they are not a mandatory field list or complete wire schema. Match to the entry DTO and workflow before constructing requests.

## API-6F5C31D7

**POST /api/kyc/:id/return-to-bd** - KycController.returnToBusinessDevelopment

- Entry/auth: AuthGuard('jwt'); RolesGuard; fallback roles: AML_TEAM, AML_SUPERVISOR, COMPANY_ADMIN, SUPER_ADMIN.
- Inputs: `@CurrentUser() user: RequestUser`; `@Param('id') id: string`; `@Body('reason') reason: string`.
- Output: JSON returned from delegated service; inferred fields in linked implementation. Inferred by TypeScript; no explicit response DTO.
- Behavior: Command (may mutate); detected reachable writes: enquiry.update, enquiryStatusHistory.create, kycCase.update, kycCaseStatusHistory.create, internalReviewTask.updateMany, notification.createMany.
- Tenant/role/state/validation helper candidates: hasAnyRole, tenantWhere.
- Error branch candidates: ForbiddenException: 'Only AML users can return a KYC case to BD.'); BadRequestException: 'Provide a reason before returning the KYC case to BD.'); BadRequestException: 'Only KYC cases created from an enquiry can be returned to BD.'); BadRequestException: 'The KYC case can be returned to BD only while it is with AML Supervisor.'); NotFoundException: 'Source enquiry not found.'); NotFoundException: 'KYC case not found'); ForbiddenException: 'User is not assigned to a tenant').
- Evidence: [backend/src/kyc/kyc.controller.ts:291](../../backend/src/kyc/kyc.controller.ts#L291).
- Logic chain: KycService.returnToBusinessDevelopment [backend/src/kyc/kyc.service.ts:619](../../backend/src/kyc/kyc.service.ts#L619); KycService.hasAnyRole [backend/src/kyc/kyc.service.ts:2482](../../backend/src/kyc/kyc.service.ts#L2482); KycService.optionalText [backend/src/kyc/kyc.service.ts:3240](../../backend/src/kyc/kyc.service.ts#L3240); KycService.text [backend/src/kyc/kyc.service.ts:3285](../../backend/src/kyc/kyc.service.ts#L3285); KycService.findOne [backend/src/kyc/kyc.service.ts:75](../../backend/src/kyc/kyc.service.ts#L75); KycService.tenantWhere [backend/src/kyc/kyc.service.ts:2445](../../backend/src/kyc/kyc.service.ts#L2445); KycService.getTenantId [backend/src/kyc/kyc.service.ts:2470](../../backend/src/kyc/kyc.service.ts#L2470); KycService.caseInclude [backend/src/kyc/kyc.service.ts:3420](../../backend/src/kyc/kyc.service.ts#L3420); KycService.withKycNumber [backend/src/kyc/kyc.service.ts:3378](../../backend/src/kyc/kyc.service.ts#L3378); KycService.generatedKycNumber [backend/src/kyc/kyc.service.ts:3362](../../backend/src/kyc/kyc.service.ts#L3362).
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
- Logic chain: KycService.assignService [backend/src/kyc/kyc.service.ts:213](../../backend/src/kyc/kyc.service.ts#L213); KycService.requireWritableCase [backend/src/kyc/kyc.service.ts:2342](../../backend/src/kyc/kyc.service.ts#L2342); KycService.tenantWhere [backend/src/kyc/kyc.service.ts:2445](../../backend/src/kyc/kyc.service.ts#L2445); KycService.getTenantId [backend/src/kyc/kyc.service.ts:2470](../../backend/src/kyc/kyc.service.ts#L2470); KycService.isPreparationEditableStatus [backend/src/kyc/kyc.service.ts:2364](../../backend/src/kyc/kyc.service.ts#L2364); KycService.isLegacyFullKycDraft [backend/src/kyc/kyc.service.ts:2358](../../backend/src/kyc/kyc.service.ts#L2358); KycService.formTenantWhere [backend/src/kyc/kyc.service.ts:2462](../../backend/src/kyc/kyc.service.ts#L2462); KycService.resolveService [backend/src/kyc/kyc.service.ts:2376](../../backend/src/kyc/kyc.service.ts#L2376); KycService.updateStatus [backend/src/kyc/kyc.service.ts:2404](../../backend/src/kyc/kyc.service.ts#L2404); KycService.caseInclude [backend/src/kyc/kyc.service.ts:3420](../../backend/src/kyc/kyc.service.ts#L3420).
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
- Evidence: [backend/src/kyc/kyc.controller.ts:297](../../backend/src/kyc/kyc.controller.ts#L297).
- Logic chain: KycService.startAmlReview [backend/src/kyc/kyc.service.ts:604](../../backend/src/kyc/kyc.service.ts#L604); KycService.findOne [backend/src/kyc/kyc.service.ts:75](../../backend/src/kyc/kyc.service.ts#L75); KycService.tenantWhere [backend/src/kyc/kyc.service.ts:2445](../../backend/src/kyc/kyc.service.ts#L2445); KycService.getTenantId [backend/src/kyc/kyc.service.ts:2470](../../backend/src/kyc/kyc.service.ts#L2470); KycService.caseInclude [backend/src/kyc/kyc.service.ts:3420](../../backend/src/kyc/kyc.service.ts#L3420); KycService.withKycNumber [backend/src/kyc/kyc.service.ts:3378](../../backend/src/kyc/kyc.service.ts#L3378); KycService.generatedKycNumber [backend/src/kyc/kyc.service.ts:3362](../../backend/src/kyc/kyc.service.ts#L3362); KycService.isSubmittedToAml [backend/src/kyc/kyc.service.ts:2478](../../backend/src/kyc/kyc.service.ts#L2478); KycService.ensureReviewTask [backend/src/kyc/kyc.service.ts:2567](../../backend/src/kyc/kyc.service.ts#L2567); KycService.createNotification [backend/src/kyc/kyc.service.ts:2903](../../backend/src/kyc/kyc.service.ts#L2903); KycService.stageLabel [backend/src/kyc/kyc.service.ts:2499](../../backend/src/kyc/kyc.service.ts#L2499); KycService.updateStatus [backend/src/kyc/kyc.service.ts:2404](../../backend/src/kyc/kyc.service.ts#L2404).
- QA: apply Q-API for this ID and its workflow-specific cases; store status/body/DB diff with secrets removed.
- DTO field-access candidates: none resolved. These span reachable helpers and may include fields of internally composed DTOs; they are not a mandatory field list or complete wire schema. Match to the entry DTO and workflow before constructing requests.

## API-86FF54AD

**GET /api/kyc/:id/submission-readiness** - KycController.submissionReadiness

- Entry/auth: AuthGuard('jwt'); RolesGuard; fallback roles: AML_TEAM, AML_SUPERVISOR, COMPANY_ADMIN, SUPER_ADMIN.
- Inputs: `@CurrentUser() user: RequestUser`; `@Param('id') id: string`.
- Output: JSON returned from delegated service; inferred fields in linked implementation. Inferred by TypeScript; no explicit response DTO.
- Behavior: Read candidate (static scan only); detected reachable writes: none detected.
- Tenant/role/state/validation helper candidates: requireWritableCase, tenantWhere, isLegacyFullKycDraft, formTenantWhere, assertScreeningReady, assertCrrfReady, assertComplianceReady.
- Error branch candidates: NotFoundException: 'KYC case not found'); BadRequestException: 'KYC preparation is locked while the case is under DMLRO, MLRO, or SEF review. It can be edited again only after DMLRO returns it to the AML Supervisor.'); ForbiddenException: 'User is not assigned to a tenant'); BadRequestException: 'Complete Screening for the client and every current shareholder, beneficial owner and manager before submitting to DMLRO.'); BadRequestException: 'Complete Screening common-list results and upload the NCTC, UN, OFAC, EU and PPO evidence before submitting to DMLRO.'); BadRequestException: 'Complete Screening records with final results, remarks and comments for any matches before submitting to DMLRO.'); BadRequestException: 'Complete the CRRF risk rating and upload the CRRF document before submitting to DMLRO.'); BadRequestException: error).
- Evidence: [backend/src/kyc/kyc.controller.ts:285](../../backend/src/kyc/kyc.controller.ts#L285).
- Logic chain: KycService.submissionReadiness [backend/src/kyc/kyc.service.ts:511](../../backend/src/kyc/kyc.service.ts#L511); KycService.requireWritableCase [backend/src/kyc/kyc.service.ts:2342](../../backend/src/kyc/kyc.service.ts#L2342); KycService.tenantWhere [backend/src/kyc/kyc.service.ts:2445](../../backend/src/kyc/kyc.service.ts#L2445); KycService.getTenantId [backend/src/kyc/kyc.service.ts:2470](../../backend/src/kyc/kyc.service.ts#L2470); KycService.isPreparationEditableStatus [backend/src/kyc/kyc.service.ts:2364](../../backend/src/kyc/kyc.service.ts#L2364); KycService.isLegacyFullKycDraft [backend/src/kyc/kyc.service.ts:2358](../../backend/src/kyc/kyc.service.ts#L2358); KycService.formTenantWhere [backend/src/kyc/kyc.service.ts:2462](../../backend/src/kyc/kyc.service.ts#L2462); KycService.assertScreeningReady [backend/src/kyc/kyc.service.ts:2644](../../backend/src/kyc/kyc.service.ts#L2644); KycService.formInclude [backend/src/kyc/kyc.service.ts:2120](../../backend/src/kyc/kyc.service.ts#L2120); KycService.serializeForm [backend/src/kyc/kyc.service.ts:2061](../../backend/src/kyc/kyc.service.ts#L2061); KycService.sectionRows [backend/src/kyc/kyc.service.ts:2148](../../backend/src/kyc/kyc.service.ts#L2148); KycService.asArray [backend/src/kyc/kyc.service.ts:3225](../../backend/src/kyc/kyc.service.ts#L3225); KycService.text [backend/src/kyc/kyc.service.ts:3285](../../backend/src/kyc/kyc.service.ts#L3285); KycService.sectionFWithCaseDocuments [backend/src/kyc/kyc.service.ts:2153](../../backend/src/kyc/kyc.service.ts#L2153); KycService.dedupeRequiredDocumentRows [backend/src/kyc/kyc.service.ts:2235](../../backend/src/kyc/kyc.service.ts#L2235); KycService.optionalText [backend/src/kyc/kyc.service.ts:3240](../../backend/src/kyc/kyc.service.ts#L3240); KycService.documentMatchText [backend/src/kyc/kyc.service.ts:2332](../../backend/src/kyc/kyc.service.ts#L2332); KycService.documentFileNames [backend/src/kyc/kyc.service.ts:2296](../../backend/src/kyc/kyc.service.ts#L2296); KycService.isRequiredDocumentMatch [backend/src/kyc/kyc.service.ts:2311](../../backend/src/kyc/kyc.service.ts#L2311); KycService.dedupeAdditionalDocumentRows [backend/src/kyc/kyc.service.ts:2277](../../backend/src/kyc/kyc.service.ts#L2277); KycService.assertCrrfReady [backend/src/kyc/kyc.service.ts:2675](../../backend/src/kyc/kyc.service.ts#L2675); KycService.assertComplianceReady [backend/src/kyc/kyc.service.ts:2635](../../backend/src/kyc/kyc.service.ts#L2635).
- QA: apply Q-API for this ID and its workflow-specific cases; store status/body/DB diff with secrets removed.
- DTO field-access candidates: none resolved. These span reachable helpers and may include fields of internally composed DTOs; they are not a mandatory field list or complete wire schema. Match to the entry DTO and workflow before constructing requests.

## API-D128107A

**POST /api/kyc/:id/submit-to-aml** - KycController.submitToAml

- Entry/auth: AuthGuard('jwt'); RolesGuard; fallback roles: AML_TEAM, AML_SUPERVISOR, COMPANY_ADMIN, SUPER_ADMIN.
- Inputs: `@CurrentUser() user: RequestUser`; `@Param('id') id: string`; `@Body() dto: Record<string, unknown>`.
- Output: JSON returned from delegated service; inferred fields in linked implementation. Inferred by TypeScript; no explicit response DTO.
- Behavior: Command (may mutate); detected reachable writes: internalReviewTask.updateMany, kycCase.update, kycCaseStatusHistory.create, internalReviewTask.upsert, internalReviewSubmission.upsert, internalReviewVersion.create, reviewerComment.updateMany, kycInternalReview.upsert, auditLog.create, notification.create.
- Tenant/role/state/validation helper candidates: requireWritableCase, tenantWhere, isLegacyFullKycDraft, formTenantWhere, assertReviewPackageReady, assertComplianceReady, assertScreeningReady, assertCrrfReady.
- Error branch candidates: BadRequestException: 'This case has already been submitted. It can be resubmitted only after DMLRO returns it to the AML Supervisor.'); BadRequestException: 'Upload at least one document required for KYC preparation before submitting to DMLRO'); BadRequestException: 'Enter AML Supervisor comments on the submission page before submitting to DMLRO.'); NotFoundException: 'KYC case not found'); BadRequestException: 'KYC preparation is locked while the case is under DMLRO, MLRO, or SEF review. It can be edited again only after DMLRO returns it to the AML Supervisor.'); ForbiddenException: 'User is not assigned to a tenant'); BadRequestException: error); BadRequestException: 'Complete Screening for the client and every current shareholder, beneficial owner and manager before submitting to DMLRO.'); BadRequestException: 'Complete Screening common-list results and upload the NCTC, UN, OFAC, EU and PPO evidence before submitting to DMLRO.'); BadRequestException: 'Complete Screening records with final results, remarks and comments for any matches before submitting to DMLRO.'); BadRequestException: 'Complete the CRRF risk rating and upload the CRRF document before submitting to DMLRO.').
- Evidence: [backend/src/kyc/kyc.controller.ts:279](../../backend/src/kyc/kyc.controller.ts#L279).
- Logic chain: KycService.submitToAml [backend/src/kyc/kyc.service.ts:534](../../backend/src/kyc/kyc.service.ts#L534); KycService.requireWritableCase [backend/src/kyc/kyc.service.ts:2342](../../backend/src/kyc/kyc.service.ts#L2342); KycService.tenantWhere [backend/src/kyc/kyc.service.ts:2445](../../backend/src/kyc/kyc.service.ts#L2445); KycService.getTenantId [backend/src/kyc/kyc.service.ts:2470](../../backend/src/kyc/kyc.service.ts#L2470); KycService.isPreparationEditableStatus [backend/src/kyc/kyc.service.ts:2364](../../backend/src/kyc/kyc.service.ts#L2364); KycService.isLegacyFullKycDraft [backend/src/kyc/kyc.service.ts:2358](../../backend/src/kyc/kyc.service.ts#L2358); KycService.formTenantWhere [backend/src/kyc/kyc.service.ts:2462](../../backend/src/kyc/kyc.service.ts#L2462); KycService.assertReviewPackageReady [backend/src/kyc/kyc.service.ts:2629](../../backend/src/kyc/kyc.service.ts#L2629); KycService.assertComplianceReady [backend/src/kyc/kyc.service.ts:2635](../../backend/src/kyc/kyc.service.ts#L2635); KycService.assertScreeningReady [backend/src/kyc/kyc.service.ts:2644](../../backend/src/kyc/kyc.service.ts#L2644); KycService.formInclude [backend/src/kyc/kyc.service.ts:2120](../../backend/src/kyc/kyc.service.ts#L2120); KycService.serializeForm [backend/src/kyc/kyc.service.ts:2061](../../backend/src/kyc/kyc.service.ts#L2061); KycService.sectionRows [backend/src/kyc/kyc.service.ts:2148](../../backend/src/kyc/kyc.service.ts#L2148); KycService.asArray [backend/src/kyc/kyc.service.ts:3225](../../backend/src/kyc/kyc.service.ts#L3225); KycService.text [backend/src/kyc/kyc.service.ts:3285](../../backend/src/kyc/kyc.service.ts#L3285); KycService.sectionFWithCaseDocuments [backend/src/kyc/kyc.service.ts:2153](../../backend/src/kyc/kyc.service.ts#L2153); KycService.dedupeRequiredDocumentRows [backend/src/kyc/kyc.service.ts:2235](../../backend/src/kyc/kyc.service.ts#L2235); KycService.optionalText [backend/src/kyc/kyc.service.ts:3240](../../backend/src/kyc/kyc.service.ts#L3240); KycService.documentMatchText [backend/src/kyc/kyc.service.ts:2332](../../backend/src/kyc/kyc.service.ts#L2332); KycService.documentFileNames [backend/src/kyc/kyc.service.ts:2296](../../backend/src/kyc/kyc.service.ts#L2296); KycService.isRequiredDocumentMatch [backend/src/kyc/kyc.service.ts:2311](../../backend/src/kyc/kyc.service.ts#L2311); KycService.dedupeAdditionalDocumentRows [backend/src/kyc/kyc.service.ts:2277](../../backend/src/kyc/kyc.service.ts#L2277); KycService.assertCrrfReady [backend/src/kyc/kyc.service.ts:2675](../../backend/src/kyc/kyc.service.ts#L2675); KycService.lockReviewSubmission [backend/src/kyc/kyc.service.ts:2729](../../backend/src/kyc/kyc.service.ts#L2729); KycService.jsonValue [backend/src/kyc/kyc.service.ts:3272](../../backend/src/kyc/kyc.service.ts#L3272); KycService.audit [backend/src/kyc/kyc.service.ts:2890](../../backend/src/kyc/kyc.service.ts#L2890); KycService.createNotification [backend/src/kyc/kyc.service.ts:2903](../../backend/src/kyc/kyc.service.ts#L2903); KycService.caseInclude [backend/src/kyc/kyc.service.ts:3420](../../backend/src/kyc/kyc.service.ts#L3420).
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
- Evidence: [backend/src/kyc/kyc.controller.ts:406](../../backend/src/kyc/kyc.controller.ts#L406).
- Logic chain: KycService.getTimeline [backend/src/kyc/kyc.service.ts:1410](../../backend/src/kyc/kyc.service.ts#L1410); KycService.findOne [backend/src/kyc/kyc.service.ts:75](../../backend/src/kyc/kyc.service.ts#L75); KycService.tenantWhere [backend/src/kyc/kyc.service.ts:2445](../../backend/src/kyc/kyc.service.ts#L2445); KycService.getTenantId [backend/src/kyc/kyc.service.ts:2470](../../backend/src/kyc/kyc.service.ts#L2470); KycService.caseInclude [backend/src/kyc/kyc.service.ts:3420](../../backend/src/kyc/kyc.service.ts#L3420); KycService.withKycNumber [backend/src/kyc/kyc.service.ts:3378](../../backend/src/kyc/kyc.service.ts#L3378); KycService.generatedKycNumber [backend/src/kyc/kyc.service.ts:3362](../../backend/src/kyc/kyc.service.ts#L3362).
- QA: apply Q-API for this ID and its workflow-specific cases; store status/body/DB diff with secrets removed.
- DTO field-access candidates: none resolved. These span reachable helpers and may include fields of internally composed DTOs; they are not a mandatory field list or complete wire schema. Match to the entry DTO and workflow before constructing requests.

## API-081C6E9B

**GET /api/kyc/:kycCaseId/crrf** - CrrfController.getWorkspace

- Entry/auth: AuthGuard('jwt'); RolesGuard; fallback roles: AML_TEAM, AML_SUPERVISOR, DMLRO, MLRO, SEF, COMPANY_ADMIN, SUPER_ADMIN.
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

- Entry/auth: AuthGuard('jwt'); RolesGuard; fallback roles: AML_TEAM, AML_SUPERVISOR, DMLRO, MLRO, SEF, COMPANY_ADMIN, SUPER_ADMIN.
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

- Entry/auth: AuthGuard('jwt'); RolesGuard; fallback roles: AML_TEAM, AML_SUPERVISOR, DMLRO, MLRO, SEF, COMPANY_ADMIN, SUPER_ADMIN.
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

- Entry/auth: AuthGuard('jwt'); RolesGuard; fallback roles: AML_TEAM, AML_SUPERVISOR, DMLRO, MLRO, SEF, COMPANY_ADMIN, SUPER_ADMIN.
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

- Entry/auth: AuthGuard('jwt'); RolesGuard; fallback roles: AML_TEAM, AML_SUPERVISOR, DMLRO, MLRO, SEF, COMPANY_ADMIN, SUPER_ADMIN.
- Inputs: `@CurrentUser() user: RequestUser`; `@Param('kycCaseId') kycCaseId: string`.
- Output: JSON returned from delegated service; inferred fields in linked implementation. Inferred by TypeScript; no explicit response DTO.
- Behavior: GET WITH SIDE EFFECTS; detected reachable writes: screeningCheck.upsert, screeningCaseCheck.createMany.
- Tenant/role/state/validation helper candidates: recordTenantWhere.
- Error branch candidates: NotFoundException: 'KYC case not found.'); ForbiddenException: 'User is not assigned to a tenant.').
- Evidence: [backend/src/screening/screening.controller.ts:17](../../backend/src/screening/screening.controller.ts#L17).
- Logic chain: ScreeningService.getContext [backend/src/screening/screening.service.ts:95](../../backend/src/screening/screening.service.ts#L95); ScreeningService.findCase [backend/src/screening/screening.service.ts:537](../../backend/src/screening/screening.service.ts#L537); ScreeningService.caseTenantWhere [backend/src/screening/screening.service.ts:717](../../backend/src/screening/screening.service.ts#L717); ScreeningService.getTenantId [backend/src/screening/screening.service.ts:737](../../backend/src/screening/screening.service.ts#L737); ScreeningService.ensureMandatoryIndividualChecks [backend/src/screening/screening.service.ts:132](../../backend/src/screening/screening.service.ts#L132); ScreeningService.sectionTenantWhere [backend/src/screening/screening.service.ts:721](../../backend/src/screening/screening.service.ts#L721); ScreeningService.sectionMap [backend/src/screening/screening.service.ts:639](../../backend/src/screening/screening.service.ts#L639); ScreeningService.isRecord [backend/src/screening/screening.service.ts:791](../../backend/src/screening/screening.service.ts#L791); ScreeningService.recordTenantWhere [backend/src/screening/screening.service.ts:725](../../backend/src/screening/screening.service.ts#L725); ScreeningService.ensureMergedCaseChecks [backend/src/screening/screening.service.ts:673](../../backend/src/screening/screening.service.ts#L673); ScreeningService.clientInfo [backend/src/screening/screening.service.ts:625](../../backend/src/screening/screening.service.ts#L625); ScreeningService.stringValue [backend/src/screening/screening.service.ts:777](../../backend/src/screening/screening.service.ts#L777); ScreeningService.extractEntities [backend/src/screening/screening.service.ts:566](../../backend/src/screening/screening.service.ts#L566); ScreeningService.pushEntity [backend/src/screening/screening.service.ts:655](../../backend/src/screening/screening.service.ts#L655); ScreeningService.listValue [backend/src/screening/screening.service.ts:781](../../backend/src/screening/screening.service.ts#L781); ScreeningService.firstText [backend/src/screening/screening.service.ts:786](../../backend/src/screening/screening.service.ts#L786).
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
- Logic chain: ScreeningService.deleteDocument [backend/src/screening/screening.service.ts:519](../../backend/src/screening/screening.service.ts#L519); ScreeningService.documentTenantWhere [backend/src/screening/screening.service.ts:729](../../backend/src/screening/screening.service.ts#L729); ScreeningService.getTenantId [backend/src/screening/screening.service.ts:737](../../backend/src/screening/screening.service.ts#L737); ScreeningService.resolveScreeningDocumentPath [backend/src/screening/screening.service.ts:748](../../backend/src/screening/screening.service.ts#L748); ScreeningService.screeningUploadRoot [backend/src/screening/screening.service.ts:744](../../backend/src/screening/screening.service.ts#L744); ScreeningService.getContext [backend/src/screening/screening.service.ts:95](../../backend/src/screening/screening.service.ts#L95); ScreeningService.findCase [backend/src/screening/screening.service.ts:537](../../backend/src/screening/screening.service.ts#L537); ScreeningService.caseTenantWhere [backend/src/screening/screening.service.ts:717](../../backend/src/screening/screening.service.ts#L717); ScreeningService.ensureMandatoryIndividualChecks [backend/src/screening/screening.service.ts:132](../../backend/src/screening/screening.service.ts#L132); ScreeningService.sectionTenantWhere [backend/src/screening/screening.service.ts:721](../../backend/src/screening/screening.service.ts#L721); ScreeningService.sectionMap [backend/src/screening/screening.service.ts:639](../../backend/src/screening/screening.service.ts#L639); ScreeningService.isRecord [backend/src/screening/screening.service.ts:791](../../backend/src/screening/screening.service.ts#L791); ScreeningService.recordTenantWhere [backend/src/screening/screening.service.ts:725](../../backend/src/screening/screening.service.ts#L725); ScreeningService.ensureMergedCaseChecks [backend/src/screening/screening.service.ts:673](../../backend/src/screening/screening.service.ts#L673); ScreeningService.clientInfo [backend/src/screening/screening.service.ts:625](../../backend/src/screening/screening.service.ts#L625); ScreeningService.stringValue [backend/src/screening/screening.service.ts:777](../../backend/src/screening/screening.service.ts#L777); ScreeningService.extractEntities [backend/src/screening/screening.service.ts:566](../../backend/src/screening/screening.service.ts#L566); ScreeningService.pushEntity [backend/src/screening/screening.service.ts:655](../../backend/src/screening/screening.service.ts#L655); ScreeningService.listValue [backend/src/screening/screening.service.ts:781](../../backend/src/screening/screening.service.ts#L781); ScreeningService.firstText [backend/src/screening/screening.service.ts:786](../../backend/src/screening/screening.service.ts#L786).
- QA: apply Q-API for this ID and its workflow-specific cases; store status/body/DB diff with secrets removed.
- DTO field-access candidates: none resolved. These span reachable helpers and may include fields of internally composed DTOs; they are not a mandatory field list or complete wire schema. Match to the entry DTO and workflow before constructing requests.

## API-9B18C607

**GET /api/kyc/:kycCaseId/screening/documents/:documentId/view** - ScreeningController.viewDocument

- Entry/auth: AuthGuard('jwt'); RolesGuard; fallback roles: AML_TEAM, AML_SUPERVISOR, DMLRO, MLRO, SEF, COMPANY_ADMIN, SUPER_ADMIN.
- Inputs: `@CurrentUser() user: RequestUser`; `@Param('kycCaseId') kycCaseId: string`; `@Param('documentId') documentId: string`; `@Res() response: Response`.
- Output: Response.send binary/HTML; see controller MIME and Content-Disposition. Inferred by TypeScript; no explicit response DTO.
- Behavior: Read candidate (static scan only); detected reachable writes: none detected.
- Tenant/role/state/validation helper candidates: documentTenantWhere.
- Error branch candidates: NotFoundException: 'Screening document file not found.'); NotFoundException: 'Screening document file is missing from storage.'); ForbiddenException: 'User is not assigned to a tenant.').
- Evidence: [backend/src/screening/screening.controller.ts:109](../../backend/src/screening/screening.controller.ts#L109).
- Logic chain: ScreeningService.getDocumentFile [backend/src/screening/screening.service.ts:498](../../backend/src/screening/screening.service.ts#L498); ScreeningService.documentTenantWhere [backend/src/screening/screening.service.ts:729](../../backend/src/screening/screening.service.ts#L729); ScreeningService.getTenantId [backend/src/screening/screening.service.ts:737](../../backend/src/screening/screening.service.ts#L737); ScreeningService.resolveScreeningDocumentPath [backend/src/screening/screening.service.ts:748](../../backend/src/screening/screening.service.ts#L748); ScreeningService.screeningUploadRoot [backend/src/screening/screening.service.ts:744](../../backend/src/screening/screening.service.ts#L744).
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
- Logic chain: ScreeningService.updateMergedCheck [backend/src/screening/screening.service.ts:151](../../backend/src/screening/screening.service.ts#L151); ScreeningService.findCase [backend/src/screening/screening.service.ts:537](../../backend/src/screening/screening.service.ts#L537); ScreeningService.caseTenantWhere [backend/src/screening/screening.service.ts:717](../../backend/src/screening/screening.service.ts#L717); ScreeningService.getTenantId [backend/src/screening/screening.service.ts:737](../../backend/src/screening/screening.service.ts#L737); ScreeningService.enumValue [backend/src/screening/screening.service.ts:773](../../backend/src/screening/screening.service.ts#L773); ScreeningService.stringValue [backend/src/screening/screening.service.ts:777](../../backend/src/screening/screening.service.ts#L777); ScreeningService.getContext [backend/src/screening/screening.service.ts:95](../../backend/src/screening/screening.service.ts#L95); ScreeningService.ensureMandatoryIndividualChecks [backend/src/screening/screening.service.ts:132](../../backend/src/screening/screening.service.ts#L132); ScreeningService.sectionTenantWhere [backend/src/screening/screening.service.ts:721](../../backend/src/screening/screening.service.ts#L721); ScreeningService.sectionMap [backend/src/screening/screening.service.ts:639](../../backend/src/screening/screening.service.ts#L639); ScreeningService.isRecord [backend/src/screening/screening.service.ts:791](../../backend/src/screening/screening.service.ts#L791); ScreeningService.recordTenantWhere [backend/src/screening/screening.service.ts:725](../../backend/src/screening/screening.service.ts#L725); ScreeningService.ensureMergedCaseChecks [backend/src/screening/screening.service.ts:673](../../backend/src/screening/screening.service.ts#L673); ScreeningService.clientInfo [backend/src/screening/screening.service.ts:625](../../backend/src/screening/screening.service.ts#L625); ScreeningService.extractEntities [backend/src/screening/screening.service.ts:566](../../backend/src/screening/screening.service.ts#L566); ScreeningService.pushEntity [backend/src/screening/screening.service.ts:655](../../backend/src/screening/screening.service.ts#L655); ScreeningService.listValue [backend/src/screening/screening.service.ts:781](../../backend/src/screening/screening.service.ts#L781); ScreeningService.firstText [backend/src/screening/screening.service.ts:786](../../backend/src/screening/screening.service.ts#L786).
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
- Logic chain: ScreeningService.deleteMergedDocument [backend/src/screening/screening.service.ts:480](../../backend/src/screening/screening.service.ts#L480); ScreeningService.caseDocumentTenantWhere [backend/src/screening/screening.service.ts:733](../../backend/src/screening/screening.service.ts#L733); ScreeningService.getTenantId [backend/src/screening/screening.service.ts:737](../../backend/src/screening/screening.service.ts#L737); ScreeningService.resolveScreeningDocumentPath [backend/src/screening/screening.service.ts:748](../../backend/src/screening/screening.service.ts#L748); ScreeningService.screeningUploadRoot [backend/src/screening/screening.service.ts:744](../../backend/src/screening/screening.service.ts#L744); ScreeningService.getContext [backend/src/screening/screening.service.ts:95](../../backend/src/screening/screening.service.ts#L95); ScreeningService.findCase [backend/src/screening/screening.service.ts:537](../../backend/src/screening/screening.service.ts#L537); ScreeningService.caseTenantWhere [backend/src/screening/screening.service.ts:717](../../backend/src/screening/screening.service.ts#L717); ScreeningService.ensureMandatoryIndividualChecks [backend/src/screening/screening.service.ts:132](../../backend/src/screening/screening.service.ts#L132); ScreeningService.sectionTenantWhere [backend/src/screening/screening.service.ts:721](../../backend/src/screening/screening.service.ts#L721); ScreeningService.sectionMap [backend/src/screening/screening.service.ts:639](../../backend/src/screening/screening.service.ts#L639); ScreeningService.isRecord [backend/src/screening/screening.service.ts:791](../../backend/src/screening/screening.service.ts#L791); ScreeningService.recordTenantWhere [backend/src/screening/screening.service.ts:725](../../backend/src/screening/screening.service.ts#L725); ScreeningService.ensureMergedCaseChecks [backend/src/screening/screening.service.ts:673](../../backend/src/screening/screening.service.ts#L673); ScreeningService.clientInfo [backend/src/screening/screening.service.ts:625](../../backend/src/screening/screening.service.ts#L625); ScreeningService.stringValue [backend/src/screening/screening.service.ts:777](../../backend/src/screening/screening.service.ts#L777); ScreeningService.extractEntities [backend/src/screening/screening.service.ts:566](../../backend/src/screening/screening.service.ts#L566); ScreeningService.pushEntity [backend/src/screening/screening.service.ts:655](../../backend/src/screening/screening.service.ts#L655); ScreeningService.listValue [backend/src/screening/screening.service.ts:781](../../backend/src/screening/screening.service.ts#L781); ScreeningService.firstText [backend/src/screening/screening.service.ts:786](../../backend/src/screening/screening.service.ts#L786).
- QA: apply Q-API for this ID and its workflow-specific cases; store status/body/DB diff with secrets removed.
- DTO field-access candidates: none resolved. These span reachable helpers and may include fields of internally composed DTOs; they are not a mandatory field list or complete wire schema. Match to the entry DTO and workflow before constructing requests.

## API-0D8258E5

**GET /api/kyc/:kycCaseId/screening/merged-documents/:documentId/view** - ScreeningController.viewMergedDocument

- Entry/auth: AuthGuard('jwt'); RolesGuard; fallback roles: AML_TEAM, AML_SUPERVISOR, DMLRO, MLRO, SEF, COMPANY_ADMIN, SUPER_ADMIN.
- Inputs: `@CurrentUser() user: RequestUser`; `@Param('kycCaseId') kycCaseId: string`; `@Param('documentId') documentId: string`; `@Res() response: Response`.
- Output: Response.send binary/HTML; see controller MIME and Content-Disposition. Inferred by TypeScript; no explicit response DTO.
- Behavior: Read candidate (static scan only); detected reachable writes: none detected.
- Tenant/role/state/validation helper candidates: none detected; inspect implementation before acceptance.
- Error branch candidates: NotFoundException: 'Merged screening document file not found.'); NotFoundException: 'Merged screening document file is missing from storage.'); ForbiddenException: 'User is not assigned to a tenant.').
- Evidence: [backend/src/screening/screening.controller.ts:75](../../backend/src/screening/screening.controller.ts#L75).
- Logic chain: ScreeningService.getMergedDocumentFile [backend/src/screening/screening.service.ts:459](../../backend/src/screening/screening.service.ts#L459); ScreeningService.caseDocumentTenantWhere [backend/src/screening/screening.service.ts:733](../../backend/src/screening/screening.service.ts#L733); ScreeningService.getTenantId [backend/src/screening/screening.service.ts:737](../../backend/src/screening/screening.service.ts#L737); ScreeningService.resolveScreeningDocumentPath [backend/src/screening/screening.service.ts:748](../../backend/src/screening/screening.service.ts#L748); ScreeningService.screeningUploadRoot [backend/src/screening/screening.service.ts:744](../../backend/src/screening/screening.service.ts#L744).
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
- Logic chain: ScreeningService.uploadMergedDocuments [backend/src/screening/screening.service.ts:334](../../backend/src/screening/screening.service.ts#L334); ScreeningService.findCase [backend/src/screening/screening.service.ts:537](../../backend/src/screening/screening.service.ts#L537); ScreeningService.caseTenantWhere [backend/src/screening/screening.service.ts:717](../../backend/src/screening/screening.service.ts#L717); ScreeningService.getTenantId [backend/src/screening/screening.service.ts:737](../../backend/src/screening/screening.service.ts#L737); ScreeningService.enumValue [backend/src/screening/screening.service.ts:773](../../backend/src/screening/screening.service.ts#L773); ScreeningService.screeningUploadRoot [backend/src/screening/screening.service.ts:744](../../backend/src/screening/screening.service.ts#L744); ScreeningService.safeFileName [backend/src/screening/screening.service.ts:765](../../backend/src/screening/screening.service.ts#L765); ScreeningService.checkLabel [backend/src/screening/screening.service.ts:703](../../backend/src/screening/screening.service.ts#L703); ScreeningService.getContext [backend/src/screening/screening.service.ts:95](../../backend/src/screening/screening.service.ts#L95); ScreeningService.ensureMandatoryIndividualChecks [backend/src/screening/screening.service.ts:132](../../backend/src/screening/screening.service.ts#L132); ScreeningService.sectionTenantWhere [backend/src/screening/screening.service.ts:721](../../backend/src/screening/screening.service.ts#L721); ScreeningService.sectionMap [backend/src/screening/screening.service.ts:639](../../backend/src/screening/screening.service.ts#L639); ScreeningService.isRecord [backend/src/screening/screening.service.ts:791](../../backend/src/screening/screening.service.ts#L791); ScreeningService.recordTenantWhere [backend/src/screening/screening.service.ts:725](../../backend/src/screening/screening.service.ts#L725); ScreeningService.ensureMergedCaseChecks [backend/src/screening/screening.service.ts:673](../../backend/src/screening/screening.service.ts#L673); ScreeningService.clientInfo [backend/src/screening/screening.service.ts:625](../../backend/src/screening/screening.service.ts#L625); ScreeningService.stringValue [backend/src/screening/screening.service.ts:777](../../backend/src/screening/screening.service.ts#L777); ScreeningService.extractEntities [backend/src/screening/screening.service.ts:566](../../backend/src/screening/screening.service.ts#L566); ScreeningService.pushEntity [backend/src/screening/screening.service.ts:655](../../backend/src/screening/screening.service.ts#L655); ScreeningService.listValue [backend/src/screening/screening.service.ts:781](../../backend/src/screening/screening.service.ts#L781); ScreeningService.firstText [backend/src/screening/screening.service.ts:786](../../backend/src/screening/screening.service.ts#L786).
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
- Logic chain: ScreeningService.createRecord [backend/src/screening/screening.service.ts:185](../../backend/src/screening/screening.service.ts#L185); ScreeningService.getTenantId [backend/src/screening/screening.service.ts:737](../../backend/src/screening/screening.service.ts#L737); ScreeningService.getContext [backend/src/screening/screening.service.ts:95](../../backend/src/screening/screening.service.ts#L95); ScreeningService.findCase [backend/src/screening/screening.service.ts:537](../../backend/src/screening/screening.service.ts#L537); ScreeningService.caseTenantWhere [backend/src/screening/screening.service.ts:717](../../backend/src/screening/screening.service.ts#L717); ScreeningService.ensureMandatoryIndividualChecks [backend/src/screening/screening.service.ts:132](../../backend/src/screening/screening.service.ts#L132); ScreeningService.sectionTenantWhere [backend/src/screening/screening.service.ts:721](../../backend/src/screening/screening.service.ts#L721); ScreeningService.sectionMap [backend/src/screening/screening.service.ts:639](../../backend/src/screening/screening.service.ts#L639); ScreeningService.isRecord [backend/src/screening/screening.service.ts:791](../../backend/src/screening/screening.service.ts#L791); ScreeningService.recordTenantWhere [backend/src/screening/screening.service.ts:725](../../backend/src/screening/screening.service.ts#L725); ScreeningService.ensureMergedCaseChecks [backend/src/screening/screening.service.ts:673](../../backend/src/screening/screening.service.ts#L673); ScreeningService.clientInfo [backend/src/screening/screening.service.ts:625](../../backend/src/screening/screening.service.ts#L625); ScreeningService.stringValue [backend/src/screening/screening.service.ts:777](../../backend/src/screening/screening.service.ts#L777); ScreeningService.extractEntities [backend/src/screening/screening.service.ts:566](../../backend/src/screening/screening.service.ts#L566); ScreeningService.pushEntity [backend/src/screening/screening.service.ts:655](../../backend/src/screening/screening.service.ts#L655); ScreeningService.listValue [backend/src/screening/screening.service.ts:781](../../backend/src/screening/screening.service.ts#L781); ScreeningService.firstText [backend/src/screening/screening.service.ts:786](../../backend/src/screening/screening.service.ts#L786); ScreeningService.checkLabel [backend/src/screening/screening.service.ts:703](../../backend/src/screening/screening.service.ts#L703); ScreeningService.enumValue [backend/src/screening/screening.service.ts:773](../../backend/src/screening/screening.service.ts#L773).
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
- Logic chain: ScreeningService.deleteRecord [backend/src/screening/screening.service.ts:322](../../backend/src/screening/screening.service.ts#L322); ScreeningService.findRecord [backend/src/screening/screening.service.ts:550](../../backend/src/screening/screening.service.ts#L550); ScreeningService.recordTenantWhere [backend/src/screening/screening.service.ts:725](../../backend/src/screening/screening.service.ts#L725); ScreeningService.getTenantId [backend/src/screening/screening.service.ts:737](../../backend/src/screening/screening.service.ts#L737); ScreeningService.resolveScreeningDocumentPath [backend/src/screening/screening.service.ts:748](../../backend/src/screening/screening.service.ts#L748); ScreeningService.screeningUploadRoot [backend/src/screening/screening.service.ts:744](../../backend/src/screening/screening.service.ts#L744); ScreeningService.getContext [backend/src/screening/screening.service.ts:95](../../backend/src/screening/screening.service.ts#L95); ScreeningService.findCase [backend/src/screening/screening.service.ts:537](../../backend/src/screening/screening.service.ts#L537); ScreeningService.caseTenantWhere [backend/src/screening/screening.service.ts:717](../../backend/src/screening/screening.service.ts#L717); ScreeningService.ensureMandatoryIndividualChecks [backend/src/screening/screening.service.ts:132](../../backend/src/screening/screening.service.ts#L132); ScreeningService.sectionTenantWhere [backend/src/screening/screening.service.ts:721](../../backend/src/screening/screening.service.ts#L721); ScreeningService.sectionMap [backend/src/screening/screening.service.ts:639](../../backend/src/screening/screening.service.ts#L639); ScreeningService.isRecord [backend/src/screening/screening.service.ts:791](../../backend/src/screening/screening.service.ts#L791); ScreeningService.ensureMergedCaseChecks [backend/src/screening/screening.service.ts:673](../../backend/src/screening/screening.service.ts#L673); ScreeningService.clientInfo [backend/src/screening/screening.service.ts:625](../../backend/src/screening/screening.service.ts#L625); ScreeningService.stringValue [backend/src/screening/screening.service.ts:777](../../backend/src/screening/screening.service.ts#L777); ScreeningService.extractEntities [backend/src/screening/screening.service.ts:566](../../backend/src/screening/screening.service.ts#L566); ScreeningService.pushEntity [backend/src/screening/screening.service.ts:655](../../backend/src/screening/screening.service.ts#L655); ScreeningService.listValue [backend/src/screening/screening.service.ts:781](../../backend/src/screening/screening.service.ts#L781); ScreeningService.firstText [backend/src/screening/screening.service.ts:786](../../backend/src/screening/screening.service.ts#L786).
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
- Logic chain: ScreeningService.updateRecord [backend/src/screening/screening.service.ts:229](../../backend/src/screening/screening.service.ts#L229); ScreeningService.findRecord [backend/src/screening/screening.service.ts:550](../../backend/src/screening/screening.service.ts#L550); ScreeningService.recordTenantWhere [backend/src/screening/screening.service.ts:725](../../backend/src/screening/screening.service.ts#L725); ScreeningService.getTenantId [backend/src/screening/screening.service.ts:737](../../backend/src/screening/screening.service.ts#L737); ScreeningService.stringValue [backend/src/screening/screening.service.ts:777](../../backend/src/screening/screening.service.ts#L777); ScreeningService.enumValue [backend/src/screening/screening.service.ts:773](../../backend/src/screening/screening.service.ts#L773); ScreeningService.isRecord [backend/src/screening/screening.service.ts:791](../../backend/src/screening/screening.service.ts#L791); ScreeningService.getContext [backend/src/screening/screening.service.ts:95](../../backend/src/screening/screening.service.ts#L95); ScreeningService.findCase [backend/src/screening/screening.service.ts:537](../../backend/src/screening/screening.service.ts#L537); ScreeningService.caseTenantWhere [backend/src/screening/screening.service.ts:717](../../backend/src/screening/screening.service.ts#L717); ScreeningService.ensureMandatoryIndividualChecks [backend/src/screening/screening.service.ts:132](../../backend/src/screening/screening.service.ts#L132); ScreeningService.sectionTenantWhere [backend/src/screening/screening.service.ts:721](../../backend/src/screening/screening.service.ts#L721); ScreeningService.sectionMap [backend/src/screening/screening.service.ts:639](../../backend/src/screening/screening.service.ts#L639); ScreeningService.ensureMergedCaseChecks [backend/src/screening/screening.service.ts:673](../../backend/src/screening/screening.service.ts#L673); ScreeningService.clientInfo [backend/src/screening/screening.service.ts:625](../../backend/src/screening/screening.service.ts#L625); ScreeningService.extractEntities [backend/src/screening/screening.service.ts:566](../../backend/src/screening/screening.service.ts#L566); ScreeningService.pushEntity [backend/src/screening/screening.service.ts:655](../../backend/src/screening/screening.service.ts#L655); ScreeningService.listValue [backend/src/screening/screening.service.ts:781](../../backend/src/screening/screening.service.ts#L781); ScreeningService.firstText [backend/src/screening/screening.service.ts:786](../../backend/src/screening/screening.service.ts#L786).
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
- Logic chain: ScreeningService.completeRecord [backend/src/screening/screening.service.ts:272](../../backend/src/screening/screening.service.ts#L272); ScreeningService.findRecord [backend/src/screening/screening.service.ts:550](../../backend/src/screening/screening.service.ts#L550); ScreeningService.recordTenantWhere [backend/src/screening/screening.service.ts:725](../../backend/src/screening/screening.service.ts#L725); ScreeningService.getTenantId [backend/src/screening/screening.service.ts:737](../../backend/src/screening/screening.service.ts#L737); ScreeningService.caseDocumentTenantWhere [backend/src/screening/screening.service.ts:733](../../backend/src/screening/screening.service.ts#L733); ScreeningService.ensureMergedCaseChecks [backend/src/screening/screening.service.ts:673](../../backend/src/screening/screening.service.ts#L673); ScreeningService.checkLabel [backend/src/screening/screening.service.ts:703](../../backend/src/screening/screening.service.ts#L703); ScreeningService.getContext [backend/src/screening/screening.service.ts:95](../../backend/src/screening/screening.service.ts#L95); ScreeningService.findCase [backend/src/screening/screening.service.ts:537](../../backend/src/screening/screening.service.ts#L537); ScreeningService.caseTenantWhere [backend/src/screening/screening.service.ts:717](../../backend/src/screening/screening.service.ts#L717); ScreeningService.ensureMandatoryIndividualChecks [backend/src/screening/screening.service.ts:132](../../backend/src/screening/screening.service.ts#L132); ScreeningService.sectionTenantWhere [backend/src/screening/screening.service.ts:721](../../backend/src/screening/screening.service.ts#L721); ScreeningService.sectionMap [backend/src/screening/screening.service.ts:639](../../backend/src/screening/screening.service.ts#L639); ScreeningService.isRecord [backend/src/screening/screening.service.ts:791](../../backend/src/screening/screening.service.ts#L791); ScreeningService.clientInfo [backend/src/screening/screening.service.ts:625](../../backend/src/screening/screening.service.ts#L625); ScreeningService.stringValue [backend/src/screening/screening.service.ts:777](../../backend/src/screening/screening.service.ts#L777); ScreeningService.extractEntities [backend/src/screening/screening.service.ts:566](../../backend/src/screening/screening.service.ts#L566); ScreeningService.pushEntity [backend/src/screening/screening.service.ts:655](../../backend/src/screening/screening.service.ts#L655); ScreeningService.listValue [backend/src/screening/screening.service.ts:781](../../backend/src/screening/screening.service.ts#L781); ScreeningService.firstText [backend/src/screening/screening.service.ts:786](../../backend/src/screening/screening.service.ts#L786).
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
- Logic chain: ScreeningService.uploadDocuments [backend/src/screening/screening.service.ts:389](../../backend/src/screening/screening.service.ts#L389); ScreeningService.findRecord [backend/src/screening/screening.service.ts:550](../../backend/src/screening/screening.service.ts#L550); ScreeningService.recordTenantWhere [backend/src/screening/screening.service.ts:725](../../backend/src/screening/screening.service.ts#L725); ScreeningService.getTenantId [backend/src/screening/screening.service.ts:737](../../backend/src/screening/screening.service.ts#L737); ScreeningService.enumValue [backend/src/screening/screening.service.ts:773](../../backend/src/screening/screening.service.ts#L773); ScreeningService.screeningUploadRoot [backend/src/screening/screening.service.ts:744](../../backend/src/screening/screening.service.ts#L744); ScreeningService.safeFileName [backend/src/screening/screening.service.ts:765](../../backend/src/screening/screening.service.ts#L765); ScreeningService.stringValue [backend/src/screening/screening.service.ts:777](../../backend/src/screening/screening.service.ts#L777); ScreeningService.checkLabel [backend/src/screening/screening.service.ts:703](../../backend/src/screening/screening.service.ts#L703); ScreeningService.getContext [backend/src/screening/screening.service.ts:95](../../backend/src/screening/screening.service.ts#L95); ScreeningService.findCase [backend/src/screening/screening.service.ts:537](../../backend/src/screening/screening.service.ts#L537); ScreeningService.caseTenantWhere [backend/src/screening/screening.service.ts:717](../../backend/src/screening/screening.service.ts#L717); ScreeningService.ensureMandatoryIndividualChecks [backend/src/screening/screening.service.ts:132](../../backend/src/screening/screening.service.ts#L132); ScreeningService.sectionTenantWhere [backend/src/screening/screening.service.ts:721](../../backend/src/screening/screening.service.ts#L721); ScreeningService.sectionMap [backend/src/screening/screening.service.ts:639](../../backend/src/screening/screening.service.ts#L639); ScreeningService.isRecord [backend/src/screening/screening.service.ts:791](../../backend/src/screening/screening.service.ts#L791); ScreeningService.ensureMergedCaseChecks [backend/src/screening/screening.service.ts:673](../../backend/src/screening/screening.service.ts#L673); ScreeningService.clientInfo [backend/src/screening/screening.service.ts:625](../../backend/src/screening/screening.service.ts#L625); ScreeningService.extractEntities [backend/src/screening/screening.service.ts:566](../../backend/src/screening/screening.service.ts#L566); ScreeningService.pushEntity [backend/src/screening/screening.service.ts:655](../../backend/src/screening/screening.service.ts#L655); ScreeningService.listValue [backend/src/screening/screening.service.ts:781](../../backend/src/screening/screening.service.ts#L781); ScreeningService.firstText [backend/src/screening/screening.service.ts:786](../../backend/src/screening/screening.service.ts#L786).
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
- Logic chain: KycService.getPendingAmlNotifications [backend/src/kyc/kyc.service.ts:1897](../../backend/src/kyc/kyc.service.ts#L1897); KycService.getTenantId [backend/src/kyc/kyc.service.ts:2470](../../backend/src/kyc/kyc.service.ts#L2470).
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
- Logic chain: KycService.getMyReviewTasks [backend/src/kyc/kyc.service.ts:1922](../../backend/src/kyc/kyc.service.ts#L1922); KycService.reviewStagesForUser [backend/src/kyc/kyc.service.ts:2955](../../backend/src/kyc/kyc.service.ts#L2955); KycService.hasAnyRole [backend/src/kyc/kyc.service.ts:2482](../../backend/src/kyc/kyc.service.ts#L2482); KycService.reviewNotificationTypesForUser [backend/src/kyc/kyc.service.ts:2966](../../backend/src/kyc/kyc.service.ts#L2966); KycService.getTenantId [backend/src/kyc/kyc.service.ts:2470](../../backend/src/kyc/kyc.service.ts#L2470); KycService.stageStatus [backend/src/kyc/kyc.service.ts:2505](../../backend/src/kyc/kyc.service.ts#L2505).
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
- Logic chain: NotificationsService.findAll [backend/src/notifications/notifications.service.ts:10](../../backend/src/notifications/notifications.service.ts#L10); NotificationsService.notificationWhere [backend/src/notifications/notifications.service.ts:50](../../backend/src/notifications/notifications.service.ts#L50); NotificationsService.notificationTypesForUser [backend/src/notifications/notifications.service.ts:62](../../backend/src/notifications/notifications.service.ts#L62); NotificationsService.hasAnyRole [backend/src/notifications/notifications.service.ts:110](../../backend/src/notifications/notifications.service.ts#L110).
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
- Logic chain: NotificationsService.markRead [backend/src/notifications/notifications.service.ts:22](../../backend/src/notifications/notifications.service.ts#L22); NotificationsService.notificationWhere [backend/src/notifications/notifications.service.ts:50](../../backend/src/notifications/notifications.service.ts#L50); NotificationsService.notificationTypesForUser [backend/src/notifications/notifications.service.ts:62](../../backend/src/notifications/notifications.service.ts#L62); NotificationsService.hasAnyRole [backend/src/notifications/notifications.service.ts:110](../../backend/src/notifications/notifications.service.ts#L110).
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
- Logic chain: NotificationsService.markAllRead [backend/src/notifications/notifications.service.ts:41](../../backend/src/notifications/notifications.service.ts#L41); NotificationsService.notificationWhere [backend/src/notifications/notifications.service.ts:50](../../backend/src/notifications/notifications.service.ts#L50); NotificationsService.notificationTypesForUser [backend/src/notifications/notifications.service.ts:62](../../backend/src/notifications/notifications.service.ts#L62); NotificationsService.hasAnyRole [backend/src/notifications/notifications.service.ts:110](../../backend/src/notifications/notifications.service.ts#L110); NotificationsService.findAll [backend/src/notifications/notifications.service.ts:10](../../backend/src/notifications/notifications.service.ts#L10).
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

- Entry/auth: AuthGuard('jwt'); RolesGuard; fallback roles: AML_TEAM, AML_SUPERVISOR, DMLRO, MLRO, SEF, COMPANY_ADMIN, SUPER_ADMIN.
- Inputs: `@CurrentUser() user: RequestUser`.
- Output: JSON returned from delegated service; inferred fields in linked implementation. Inferred by TypeScript; no explicit response DTO.
- Behavior: Read candidate (static scan only); detected reachable writes: none detected.
- Tenant/role/state/validation helper candidates: recordTenantWhere.
- Error branch candidates: ForbiddenException: 'User is not assigned to a tenant.').
- Evidence: [backend/src/screening/screening.controller.ts:136](../../backend/src/screening/screening.controller.ts#L136).
- Logic chain: ScreeningService.listRecords [backend/src/screening/screening.service.ts:71](../../backend/src/screening/screening.service.ts#L71); ScreeningService.recordTenantWhere [backend/src/screening/screening.service.ts:725](../../backend/src/screening/screening.service.ts#L725); ScreeningService.getTenantId [backend/src/screening/screening.service.ts:737](../../backend/src/screening/screening.service.ts#L737).
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
- Logic chain: TenantsService.findAll [backend/src/tenants/tenants.service.ts:9](../../backend/src/tenants/tenants.service.ts#L9).
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
- Logic chain: TenantsService.create [backend/src/tenants/tenants.service.ts:28](../../backend/src/tenants/tenants.service.ts#L28).
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
- Logic chain: TenantsService.findOne [backend/src/tenants/tenants.service.ts:18](../../backend/src/tenants/tenants.service.ts#L18).
- QA: apply Q-API for this ID and its workflow-specific cases; store status/body/DB diff with secrets removed.
- DTO field-access candidates: none resolved. These span reachable helpers and may include fields of internally composed DTOs; they are not a mandatory field list or complete wire schema. Match to the entry DTO and workflow before constructing requests.

## API-55FFF749

**GET /api/users** - UsersController.findAll

- Entry/auth: AuthGuard('jwt'); RolesGuard; fallback roles: SUPER_ADMIN, COMPANY_ADMIN.
- Inputs: `@CurrentUser() user: RequestUser`.
- Output: JSON returned from delegated service; inferred fields in linked implementation. Inferred by TypeScript; no explicit response DTO.
- Behavior: Read candidate (static scan only); detected reachable writes: none detected.
- Tenant/role/state/validation helper candidates: none detected; inspect implementation before acceptance.
- Error branch candidates: none explicitly thrown in resolved methods; global errors still apply.
- Evidence: [backend/src/users/users.controller.ts:14](../../backend/src/users/users.controller.ts#L14).
- Logic chain: UsersService.findAll [backend/src/users/users.service.ts:9](../../backend/src/users/users.service.ts#L9).
- QA: apply Q-API for this ID and its workflow-specific cases; store status/body/DB diff with secrets removed.
- DTO field-access candidates: none resolved. These span reachable helpers and may include fields of internally composed DTOs; they are not a mandatory field list or complete wire schema. Match to the entry DTO and workflow before constructing requests.

## Request DTO contracts

Global ValidationPipe uses whitelist, forbidNonWhitelisted and transform. These decorators apply to concrete DTO classes, not erased TypeScript Record bodies. Optionality here is transport-level, not necessarily workflow completeness.

### AddEnquiryCommentDto

[backend/src/enquiries/dto/update-enquiry.dto.ts:98](../../backend/src/enquiries/dto/update-enquiry.dto.ts#L98)

| Field | Type | Validation decorators |
|---|---|---|
| body | string | @IsString() |

### AddWorkflowCommentDto

[backend/src/kyc/dto/add-workflow-comment.dto.ts:3](../../backend/src/kyc/dto/add-workflow-comment.dto.ts#L3)

| Field | Type | Validation decorators |
|---|---|---|
| body | string | @IsString() |

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

### CreateTenantDto

[backend/src/tenants/dto/create-tenant.dto.ts:3](../../backend/src/tenants/dto/create-tenant.dto.ts#L3)

| Field | Type | Validation decorators |
|---|---|---|
| name | string | @IsString() @MinLength(2) |
| slug | string | @IsString() @MinLength(2) |
| isActive? | boolean | @IsOptional() @IsBoolean() |

### LoginDto

[backend/src/auth/dto/login.dto.ts:3](../../backend/src/auth/dto/login.dto.ts#L3)

| Field | Type | Validation decorators |
|---|---|---|
| email | string | @IsEmail() |
| password | string | @IsString() @MinLength(8) |

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

### UploadLegalDocumentDto

[backend/src/kyc/dto/upload-legal-document.dto.ts:3](../../backend/src/kyc/dto/upload-legal-document.dto.ts#L3)

| Field | Type | Validation decorators |
|---|---|---|
| documentType | string | @IsString() |
| fileName | string | @IsString() |
| storagePath? | string | @IsOptional() @IsString() |
| mimeType? | string | @IsOptional() @IsString() |
| size? | number | @IsOptional() @IsInt() @Min(1) |

## Persisted status and decision vocabulary

Enum membership alone does not authorize a transition; use service guard and decision tables in WORKFLOWS.

### UserStatus

`ACTIVE`, `INVITED`, `SUSPENDED`

### AuditAction

`CREATE`, `UPDATE`, `DELETE`, `LOGIN`, `LOGOUT`, `ENABLE`, `DISABLE`

### KycCaseStatus

`INQUIRY_RECEIVED`, `PROPOSAL_OPTIONAL`, `LEGAL_DOCUMENTS_PENDING`, `LEGAL_DOCUMENTS_UPLOADED`, `RETURNED_TO_BD`, `SUBMITTED_TO_AML`, `AML_REVIEW_STARTED`, `SUPERVISOR_REVIEW_PENDING`, `SUPERVISOR_REVIEW_IN_PROGRESS`, `SUPERVISOR_ADDITIONAL_INFORMATION_REQUIRED`, `SUPERVISOR_REVIEW_COMPLETED`, `DMLRO_REVIEW_PENDING`, `DMLRO_REVIEW_IN_PROGRESS`, `DMLRO_ADDITIONAL_INFORMATION_REQUIRED`, `DMLRO_REVIEW_COMPLETED`, `MLRO_REVIEW_PENDING`, `MLRO_REVIEW_IN_PROGRESS`, `MLRO_ADDITIONAL_INFORMATION_REQUIRED`, `MLRO_APPROVED`, `MLRO_APPROVED_WITH_CONDITIONS`, `MLRO_REJECTED`, `SEF_DECISION_PENDING`, `SEF_DECISION_IN_PROGRESS`, `SEF_APPROVED`, `SEF_REJECTED`, `FINAL_SIGNATURES_PENDING`, `FINAL_DOCUMENTS_PENDING`, `KYC_FINAL_APPROVED`, `CLIENT_ACTIVATION_PENDING`, `CLIENT_ACTIVE`, `CLIENT_REJECTED`, `CLIENT_ON_HOLD`

### ProposalStatus

`NOT_REQUIRED`, `REQUIRED`, `SENT`, `ACCEPTED`, `REJECTED`

### LegalDocumentStatus

`UPLOADED`, `VERIFIED`, `REJECTED`

### NotificationType

`AML_CASE_SUBMITTED`, `SUPERVISOR_TASK_ASSIGNED`, `SUPERVISOR_REVIEW_COMPLETED`, `DMLRO_TASK_ASSIGNED`, `DMLRO_REVIEW_COMPLETED`, `MLRO_TASK_ASSIGNED`, `ADDITIONAL_INFORMATION_REQUESTED`, `SIGNED_KYC_UPLOADED`, `RISK_CLASSIFICATION_CHANGED`, `MLRO_APPROVAL_COMPLETED`, `MLRO_APPROVAL_WITH_CONDITIONS`, `MLRO_REJECTION`, `SEF_TASK_ASSIGNED`, `SEF_DECISION_COMPLETED`, `CLIENT_READY_FOR_ACTIVATION`, `CLIENT_ACTIVATED`, `GENERAL`

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
id           String         @id @default(uuid())
tenantId     String?
tenant       Tenant?        @relation(fields: [tenantId], references: [id])
email        String         @unique
passwordHash String
firstName    String
lastName     String
status       UserStatus     @default(ACTIVE)
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
createdAt    DateTime       @default(now())
updatedAt    DateTime       @updatedAt
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
contacts           ClientContact[]
enquiries          Enquiry[]
kycCases           KycCase[]
screeningRecords   ScreeningRecord[]
createdAt          DateTime        @default(now())
updatedAt          DateTime        @updatedAt
@@index([tenantId])
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
submittedToAmlAt  DateTime?
amlReviewStartedAt DateTime?
createdAt         DateTime               @default(now())
updatedAt         DateTime               @updatedAt
@@index([tenantId])
@@index([clientId])
@@index([sourceEnquiryId])
@@index([status])
@@unique([tenantId, kycNumber])
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
position              String?
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
