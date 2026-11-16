# Endpoint Coverage Matrix

All rows are NOT RUN on staging. Q-API in QA_HANDOVER.md defines mandatory steps; each endpoint also needs its successful workflow-specific input. This matrix is coverage assignment, not test execution evidence.

| Endpoint ID | Operation | Workflow family | Required test set | Result | Evidence |
|---|---|---|---|---|---|
| API-877BF8E4 | `GET /api/access-control` | AccessControlController | Q-API, Q-READ | NOT RUN | Pending |
| API-812E3C7B | `GET /api/access-control/me` | AccessControlController | Q-API, Q-READ | NOT RUN | Pending |
| API-8B7FA898 | `PUT /api/access-control/roles/:roleName` | AccessControlController | Q-API, Q-NEG, Q-RACE | NOT RUN | Pending |
| API-EBFCDF2C | `GET /api/approvals` | ApprovalsController | Q-API, Q-READ | NOT RUN | Pending |
| API-1AB8DBCE | `GET /api/audit-logs` | AuditLogsController | Q-API, Q-READ | NOT RUN | Pending |
| API-4B243C69 | `POST /api/auth/login` | AuthController | Q-API, Q-NEG, Q-RACE | NOT RUN | Pending |
| API-56B94144 | `GET /api/auth/me` | AuthController | Q-API, Q-READ | NOT RUN | Pending |
| API-7FD503B4 | `GET /api/clients` | ClientsController | Q-API, Q-READ | NOT RUN | Pending |
| API-BABA0CF1 | `POST /api/clients` | ClientsController | Q-API, Q-NEG, Q-RACE | NOT RUN | Pending |
| API-5B6DA8D0 | `DELETE /api/clients/:id` | ClientsController | Q-API, Q-NEG, Q-RACE | NOT RUN | Pending |
| API-90F59AA9 | `GET /api/clients/:id` | ClientsController | Q-API, Q-READ | NOT RUN | Pending |
| API-9AB9DDF9 | `PATCH /api/clients/:id` | ClientsController | Q-API, Q-NEG, Q-RACE | NOT RUN | Pending |
| API-EC99E535 | `GET /api/clients/match` | ClientsController | Q-API, Q-READ | NOT RUN | Pending |
| API-126A3D33 | `GET /api/crrf` | CrrfListController | Q-API, Q-READ | NOT RUN | Pending |
| API-49780112 | `GET /api/dashboard/summary` | DashboardController | Q-API, Q-READ | NOT RUN | Pending |
| API-5B2BF5E4 | `GET /api/documents` | DocumentsController | Q-API, Q-READ | NOT RUN | Pending |
| API-FFC0C4D5 | `GET /api/enquiries` | EnquiriesController | Q-API, Q-READ | NOT RUN | Pending |
| API-2A03FCD2 | `POST /api/enquiries` | EnquiriesController | Q-API, Q-NEG, Q-RACE | NOT RUN | Pending |
| API-62F96B16 | `DELETE /api/enquiries/:id` | EnquiriesController | Q-API, Q-NEG, Q-RACE | NOT RUN | Pending |
| API-45584D11 | `GET /api/enquiries/:id` | EnquiriesController | Q-API, Q-READ | NOT RUN | Pending |
| API-AA5ECB01 | `PATCH /api/enquiries/:id` | EnquiriesController | Q-API, Q-NEG, Q-RACE | NOT RUN | Pending |
| API-4E2DD820 | `GET /api/enquiries/:id/attachments/:attachmentId/view` | EnquiriesController | Q-API, Q-READ | NOT RUN | Pending |
| API-0296575E | `GET /api/enquiries/:id/attachments/download-group` | EnquiriesController | Q-API, Q-READ | NOT RUN | Pending |
| API-DB8CC420 | `POST /api/enquiries/:id/attachments/upload` | EnquiriesController | Q-API, Q-NEG, Q-RACE | NOT RUN | Pending |
| API-3509838E | `POST /api/enquiries/:id/attachments/upload-many` | EnquiriesController | Q-API, Q-NEG, Q-RACE | NOT RUN | Pending |
| API-838B7EDE | `POST /api/enquiries/:id/comments` | EnquiriesController | Q-API, Q-NEG, Q-RACE | NOT RUN | Pending |
| API-AAC19E27 | `POST /api/enquiries/:id/convert-to-kyc` | EnquiriesController | Q-API, Q-NEG, Q-RACE | NOT RUN | Pending |
| API-5586363A | `GET /api/enquiries/:id/preliminary-kyc` | EnquiriesController | Q-API, Q-READ | NOT RUN | Pending |
| API-7A2D0CDF | `PATCH /api/enquiries/:id/preliminary-kyc` | EnquiriesController | Q-API, Q-NEG, Q-RACE | NOT RUN | Pending |
| API-8C410B0C | `POST /api/enquiries/:id/preliminary-kyc/complete` | EnquiriesController | Q-API, Q-NEG, Q-RACE | NOT RUN | Pending |
| API-3A245610 | `GET /api/enquiries/:id/preliminary-kyc/pdf` | EnquiriesController | Q-API, Q-READ | NOT RUN | Pending |
| API-F4305601 | `PATCH /api/enquiries/:id/status` | EnquiriesController | Q-API, Q-NEG, Q-RACE | NOT RUN | Pending |
| API-69E2E58A | `GET /api/health` | AppController | Q-API, Q-READ | NOT RUN | Pending |
| API-3FD10834 | `GET /api/kyc` | KycController | Q-API, Q-READ | NOT RUN | Pending |
| API-F3EDD356 | `POST /api/kyc` | KycController | Q-API, Q-NEG, Q-RACE | NOT RUN | Pending |
| API-BF74970E | `DELETE /api/kyc/:id` | KycController | Q-API, Q-NEG, Q-RACE | NOT RUN | Pending |
| API-157E465A | `GET /api/kyc/:id` | KycController | Q-API, Q-READ | NOT RUN | Pending |
| API-8FD7BC30 | `PATCH /api/kyc/:id` | KycController | Q-API, Q-NEG, Q-RACE | NOT RUN | Pending |
| API-07738DF5 | `GET /api/kyc/:id/activation-readiness` | KycController | Q-API, Q-READ | NOT RUN | Pending |
| API-AF4E1C0A | `POST /api/kyc/:id/amendments` | KycController | Q-API, Q-NEG, Q-RACE | NOT RUN | Pending |
| API-7B6EA1C6 | `POST /api/kyc/:id/comments` | KycController | Q-API, Q-NEG, Q-RACE | NOT RUN | Pending |
| API-C8A169F1 | `POST /api/kyc/:id/engagement-decision` | KycController | Q-API, Q-NEG, Q-RACE | NOT RUN | Pending |
| API-B62F552C | `POST /api/kyc/:id/final-kyc-decision` | KycController | Q-API, Q-NEG, Q-RACE | NOT RUN | Pending |
| API-0AED223E | `GET /api/kyc/:id/form` | KycController | Q-API, Q-READ | NOT RUN | Pending |
| API-BC473411 | `POST /api/kyc/:id/form` | KycController | Q-API, Q-NEG, Q-RACE | NOT RUN | Pending |
| API-A3C714C0 | `PATCH /api/kyc/:id/form/autosave` | KycController | Q-API, Q-NEG, Q-RACE | NOT RUN | Pending |
| API-490F75DE | `POST /api/kyc/:id/form/generate-docx` | KycController | Q-API, Q-NEG, Q-RACE | NOT RUN | Pending |
| API-DD13B530 | `POST /api/kyc/:id/form/generate-pdf` | KycController | Q-API, Q-NEG, Q-RACE | NOT RUN | Pending |
| API-78F4A26B | `GET /api/kyc/:id/form/generated-documents/:documentId/download` | KycController | Q-API, Q-READ | NOT RUN | Pending |
| API-5242388D | `GET /api/kyc/:id/form/revisions` | KycController | Q-API, Q-READ | NOT RUN | Pending |
| API-1CF5873D | `GET /api/kyc/:id/form/revisions/:revisionId` | KycController | Q-API, Q-READ | NOT RUN | Pending |
| API-401ED459 | `GET /api/kyc/:id/form/revisions/:revisionId/download` | KycController | Q-API, Q-READ | NOT RUN | Pending |
| API-EBFAE586 | `GET /api/kyc/:id/form/revisions/:revisionId/files/:fileId` | KycController | Q-API, Q-READ | NOT RUN | Pending |
| API-A221380A | `PATCH /api/kyc/:id/form/section-a` | KycController | Q-API, Q-NEG, Q-RACE | NOT RUN | Pending |
| API-6DF83F11 | `PATCH /api/kyc/:id/form/section-b` | KycController | Q-API, Q-NEG, Q-RACE | NOT RUN | Pending |
| API-6FCEF8D0 | `PATCH /api/kyc/:id/form/section-c` | KycController | Q-API, Q-NEG, Q-RACE | NOT RUN | Pending |
| API-95E0B5BF | `PATCH /api/kyc/:id/form/section-d` | KycController | Q-API, Q-NEG, Q-RACE | NOT RUN | Pending |
| API-F0C2E965 | `PATCH /api/kyc/:id/form/section-e` | KycController | Q-API, Q-NEG, Q-RACE | NOT RUN | Pending |
| API-70638C15 | `PATCH /api/kyc/:id/form/section-f` | KycController | Q-API, Q-NEG, Q-RACE | NOT RUN | Pending |
| API-5EFC49C1 | `PATCH /api/kyc/:id/form/section-g` | KycController | Q-API, Q-NEG, Q-RACE | NOT RUN | Pending |
| API-76C06151 | `PATCH /api/kyc/:id/form/section-h` | KycController | Q-API, Q-NEG, Q-RACE | NOT RUN | Pending |
| API-8FFFD545 | `GET /api/kyc/:id/internal-reviews` | KycController | Q-API, Q-READ | NOT RUN | Pending |
| API-BAA9C4BA | `POST /api/kyc/:id/internal-reviews/:stage/comments` | KycController | Q-API, Q-NEG, Q-RACE | NOT RUN | Pending |
| API-CE158663 | `PATCH /api/kyc/:id/internal-reviews/:stage/draft` | KycController | Q-API, Q-NEG, Q-RACE | NOT RUN | Pending |
| API-FAD85287 | `POST /api/kyc/:id/internal-reviews/:stage/start` | KycController | Q-API, Q-NEG, Q-RACE | NOT RUN | Pending |
| API-C65454C8 | `POST /api/kyc/:id/internal-reviews/dmlro/submit` | KycController | Q-API, Q-NEG, Q-RACE | NOT RUN | Pending |
| API-3D4B2E9E | `POST /api/kyc/:id/internal-reviews/mlro/decision` | KycController | Q-API, Q-NEG, Q-RACE | NOT RUN | Pending |
| API-B3555C2D | `POST /api/kyc/:id/internal-reviews/sef/decision` | KycController | Q-API, Q-NEG, Q-RACE | NOT RUN | Pending |
| API-0725331B | `POST /api/kyc/:id/internal-reviews/signed-documents` | KycController | Q-API, Q-NEG, Q-RACE | NOT RUN | Pending |
| API-A4FB20A5 | `POST /api/kyc/:id/internal-reviews/signed-documents/upload` | KycController | Q-API, Q-NEG, Q-RACE | NOT RUN | Pending |
| API-C8B81FCD | `POST /api/kyc/:id/internal-reviews/supervisor/submit` | KycController | Q-API, Q-NEG, Q-RACE | NOT RUN | Pending |
| API-D8647DF4 | `POST /api/kyc/:id/legal-documents` | KycController | Q-API, Q-NEG, Q-RACE | NOT RUN | Pending |
| API-0A70F34F | `DELETE /api/kyc/:id/legal-documents/:documentId` | KycController | Q-API, Q-NEG, Q-RACE | NOT RUN | Pending |
| API-60800880 | `GET /api/kyc/:id/legal-documents/:documentId/view` | KycController | Q-API, Q-READ | NOT RUN | Pending |
| API-A7A89B73 | `GET /api/kyc/:id/legal-documents/download-group` | KycController | Q-API, Q-READ | NOT RUN | Pending |
| API-E82679AC | `POST /api/kyc/:id/legal-documents/upload` | KycController | Q-API, Q-NEG, Q-RACE | NOT RUN | Pending |
| API-31BB8A09 | `POST /api/kyc/:id/legal-documents/upload-many` | KycController | Q-API, Q-NEG, Q-RACE | NOT RUN | Pending |
| API-36DE4573 | `PATCH /api/kyc/:id/proposal-status` | KycController | Q-API, Q-NEG, Q-RACE | NOT RUN | Pending |
| API-6F5C31D7 | `POST /api/kyc/:id/return-to-bd` | KycController | Q-API, Q-NEG, Q-RACE | NOT RUN | Pending |
| API-6B7FFB1E | `PATCH /api/kyc/:id/service` | KycController | Q-API, Q-NEG, Q-RACE | NOT RUN | Pending |
| API-379F818E | `POST /api/kyc/:id/start-aml-review` | KycController | Q-API, Q-NEG, Q-RACE | NOT RUN | Pending |
| API-86FF54AD | `GET /api/kyc/:id/submission-readiness` | KycController | Q-API, Q-READ | NOT RUN | Pending |
| API-D128107A | `POST /api/kyc/:id/submit-to-aml` | KycController | Q-API, Q-NEG, Q-RACE | NOT RUN | Pending |
| API-2F3919F3 | `GET /api/kyc/:id/timeline` | KycController | Q-API, Q-READ | NOT RUN | Pending |
| API-081C6E9B | `GET /api/kyc/:kycCaseId/crrf` | CrrfController | Q-API, Q-READ | NOT RUN | Pending |
| API-5458803A | `PATCH /api/kyc/:kycCaseId/crrf` | CrrfController | Q-API, Q-NEG, Q-RACE | NOT RUN | Pending |
| API-C0EBB861 | `DELETE /api/kyc/:kycCaseId/crrf/documents/:documentId` | CrrfController | Q-API, Q-NEG, Q-RACE | NOT RUN | Pending |
| API-E5D21E74 | `GET /api/kyc/:kycCaseId/crrf/documents/:documentId/view` | CrrfController | Q-API, Q-READ | NOT RUN | Pending |
| API-DDD625EB | `POST /api/kyc/:kycCaseId/crrf/documents/upload` | CrrfController | Q-API, Q-NEG, Q-RACE | NOT RUN | Pending |
| API-961FF538 | `GET /api/kyc/:kycCaseId/crrf/export/excel` | CrrfController | Q-API, Q-READ | NOT RUN | Pending |
| API-D3607C55 | `GET /api/kyc/:kycCaseId/crrf/export/pdf` | CrrfController | Q-API, Q-READ | NOT RUN | Pending |
| API-40B72B78 | `GET /api/kyc/:kycCaseId/screening/context` | ScreeningController | Q-API, Q-READ | NOT RUN | Pending |
| API-815BC666 | `DELETE /api/kyc/:kycCaseId/screening/documents/:documentId` | ScreeningController | Q-API, Q-NEG, Q-RACE | NOT RUN | Pending |
| API-9B18C607 | `GET /api/kyc/:kycCaseId/screening/documents/:documentId/view` | ScreeningController | Q-API, Q-READ | NOT RUN | Pending |
| API-CFC8A791 | `PATCH /api/kyc/:kycCaseId/screening/merged-checks/:checkType` | ScreeningController | Q-API, Q-NEG, Q-RACE | NOT RUN | Pending |
| API-BB9F5AB9 | `DELETE /api/kyc/:kycCaseId/screening/merged-documents/:documentId` | ScreeningController | Q-API, Q-NEG, Q-RACE | NOT RUN | Pending |
| API-0D8258E5 | `GET /api/kyc/:kycCaseId/screening/merged-documents/:documentId/view` | ScreeningController | Q-API, Q-READ | NOT RUN | Pending |
| API-1A5E5ED2 | `POST /api/kyc/:kycCaseId/screening/merged-documents/upload` | ScreeningController | Q-API, Q-NEG, Q-RACE | NOT RUN | Pending |
| API-73AAC1D8 | `POST /api/kyc/:kycCaseId/screening/records` | ScreeningController | Q-API, Q-NEG, Q-RACE | NOT RUN | Pending |
| API-E8226A18 | `DELETE /api/kyc/:kycCaseId/screening/records/:recordId` | ScreeningController | Q-API, Q-NEG, Q-RACE | NOT RUN | Pending |
| API-42B70497 | `PATCH /api/kyc/:kycCaseId/screening/records/:recordId` | ScreeningController | Q-API, Q-NEG, Q-RACE | NOT RUN | Pending |
| API-E325C8CB | `POST /api/kyc/:kycCaseId/screening/records/:recordId/complete` | ScreeningController | Q-API, Q-NEG, Q-RACE | NOT RUN | Pending |
| API-5898413C | `POST /api/kyc/:kycCaseId/screening/records/:recordId/documents/upload` | ScreeningController | Q-API, Q-NEG, Q-RACE | NOT RUN | Pending |
| API-BD67B8EC | `GET /api/kyc/aml/notifications` | KycController | Q-API, Q-READ | NOT RUN | Pending |
| API-81BAF9B4 | `GET /api/kyc/review/tasks` | KycController | Q-API, Q-READ | NOT RUN | Pending |
| API-6FD57A81 | `GET /api/modules` | ModulesController | Q-API, Q-READ | NOT RUN | Pending |
| API-C3DF3359 | `GET /api/notifications` | NotificationsController | Q-API, Q-READ | NOT RUN | Pending |
| API-65B6D065 | `PATCH /api/notifications/:id/read` | NotificationsController | Q-API, Q-NEG, Q-RACE | NOT RUN | Pending |
| API-FA599A44 | `PATCH /api/notifications/read-all` | NotificationsController | Q-API, Q-NEG, Q-RACE | NOT RUN | Pending |
| API-AAF14881 | `GET /api/permissions` | PermissionsController | Q-API, Q-READ | NOT RUN | Pending |
| API-E6508535 | `GET /api/roles` | RolesController | Q-API, Q-READ | NOT RUN | Pending |
| API-FAD10027 | `GET /api/screening` | ScreeningListController | Q-API, Q-READ | NOT RUN | Pending |
| API-5ADDCCFF | `PUT /api/tenant-modules` | TenantModulesController | Q-API, Q-NEG, Q-RACE | NOT RUN | Pending |
| API-AF74D957 | `GET /api/tenant-modules/:tenantId` | TenantModulesController | Q-API, Q-READ | NOT RUN | Pending |
| API-3F8FA46B | `GET /api/tenants` | TenantsController | Q-API, Q-READ | NOT RUN | Pending |
| API-B00A1FCA | `POST /api/tenants` | TenantsController | Q-API, Q-NEG, Q-RACE | NOT RUN | Pending |
| API-96DAF7CF | `GET /api/tenants/:id` | TenantsController | Q-API, Q-READ | NOT RUN | Pending |
| API-55FFF749 | `GET /api/users` | UsersController | Q-API, Q-READ | NOT RUN | Pending |
