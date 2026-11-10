# Newoon MIS Client Delivery Feature Register

This register reorganizes the chronological technical history in `CHANGE_LOG_REPORT.md` into a client-facing delivery scope. It covers the project from the initial foundation on 2026-07-06 through the latest completed changes on 2026-09-17.

## Classification

- **Major change:** A complete module, workflow, security boundary, approval stage, report, or client-facing business capability.
- **Minor change:** A refinement, validation rule, UI improvement, wording correction, compatibility update, or defect fix within a major capability.
- **Delivery status:** `Delivered` means implemented and included in the application source. Production availability still depends on deploying the applicable branch, build, and migrations.

## Delivery Summary

| Category | Major capabilities | Minor enhancements and corrections |
| --- | ---: | ---: |
| Platform and access | 2 | 5 |
| Enquiry management | 2 | 12 |
| KYC preparation and form | 3 | 17 |
| Screening | 2 | 12 |
| CRRF | 1 | 8 |
| Review and approval | 4 | 14 |
| Client activation and amendment | 2 | 7 |
| Documents, exports, and security | 2 | 15 |
| Documentation and support | 1 | 1 |
| **Total** | **19** | **91** |

Counts represent grouped delivery items, not commits or individual code changes.

## Major Changes

### M01. Multi-Tenant MIS Platform Foundation

**Status:** Delivered  
**Delivery period:** 2026-07-06 onward

- SaaS-ready tenants, users, roles, permissions, modules, and tenant module assignments.
- JWT authentication, role-based access control, audit logging, and seeded workflow accounts.
- Client, document, approval, and operational dashboard foundations.

### M02. Role-Based Operational Workspaces

**Status:** Delivered  
**Delivery period:** 2026-07-15 to 2026-09-17

- Role-specific navigation and actions for Operations/BD, AML Team, AML Supervisor, DMLRO, MLRO, SEF, Company Admin, and Super Admin.
- My Review Tasks queues and role notifications.
- Tenant-scoped access to KYC, Screening, CRRF, and review data.

### M03. Enquiry Intake and Management

**Status:** Delivered  
**Delivery period:** 2026-08-11 to 2026-09-17

- Enquiry creation, editing, requested services, contact details, notes, attachments, comments, and status history.
- Existing entity, proposed company, and current-client/new-service enquiry types.
- AML submission, return-to-BD, ready-for-KYC, and responsible-stage status handling.

### M04. Controlled Enquiry-to-KYC Conversion

**Status:** Delivered  
**Delivery period:** 2026-08-11 to 2026-09-17

- Converts an approved enquiry into a linked KYC case and populated KYC form.
- Generates a unique `KYC-YYYY-0001` number.
- Prevents repeated or concurrent conversion of the same enquiry.
- Keeps prospects out of the active client register until final activation.

### M05. KYC Workflow and Case Register

**Status:** Delivered  
**Delivery period:** 2026-07-06 to 2026-09-17

- KYC case register, service assignment, proposal status, preparation documents, timeline, comments, and workflow status tracking.
- KYC number displayed consistently across KYC, Screening, and CRRF.
- Preliminary proposed-company KYC identification.

### M06. Full KYC Form Builder

**Status:** Delivered  
**Delivery period:** 2026-07-06 to 2026-09-17

- Section A to H KYC data capture for company, control/interest, management, compliance, communication person, documents, declaration, and internal review.
- Autosave, section save, signatures, previews, populated exports, and form locking.
- Multiple requested Newoon services and searchable structured dropdowns.

### M07. Ownership and Beneficial-Control Structure

**Status:** Delivered  
**Delivery period:** 2026-08-18 to 2026-09-17

- Multi-layer control/interest structure editor with linked corporate entities.
- Corporate lookup using saved KYC CR numbers.
- Generated ownership/control diagram in the KYC document.
- Beneficial-person identification and percentage validation.

### M08. Screening Workspace and Register

**Status:** Delivered  
**Delivery period:** 2026-08-31 to 2026-09-17

- KYC-linked Screening workspace and aggregate Screening register.
- Client company and individual screening records derived from KYC parties and managers.
- Result, notes, remarks, evidence, draft, finalize, view, and delete workflows.

### M09. Screening Tool and Evidence Controls

**Status:** Delivered  
**Delivery period:** 2026-09-01 to 2026-09-17

- Common evidence and results for NCTC, UN, OFAC, EU, PPO List, World-Check, and Google.
- Selective individual screening tools for NCTC, UN, OFAC, and Other.
- Evidence and comment rules based on selected tools and match outcomes.

### M10. CRRF Workspace, Register, and Reporting

**Status:** Delivered  
**Delivery period:** 2026-09-02 to 2026-09-17

- KYC-linked CRRF workspace and CRRF register.
- Client information, mandatory risk rating, internal comments, and optional supporting files.
- Excel and PDF CRRF exports with internal comments excluded.

### M11. Internal Review and Approval Workflow

**Status:** Delivered  
**Delivery period:** 2026-07-15 to 2026-09-17

- AML Supervisor, DMLRO, MLRO, and SEF review stages.
- Drafts, signatures, dates, formal decisions, conditions, reasons, comments, and immutable submitted versions.
- Role queues, notifications, return routes, and additional-information handling.

### M12. Unified Review Package

**Status:** Delivered  
**Delivery period:** 2026-09-08 to 2026-09-17

- KYC Form, Screening, and CRRF reviewed together from one workspace.
- In-page Screening and CRRF details without leaving the KYC review screen.
- Read-only reviewer access to evidence files, results, remarks, and internal comments.

### M13. Risk-Based SEF Routing and Review Continuity

**Status:** Delivered  
**Delivery period:** 2026-07-20 to 2026-09-17

- SEF management decision stage and Section H review fields.
- Mandatory SEF routing for High-risk cases and optional MLRO routing for other risk levels.
- Reason-controlled MLRO review while DMLRO is pending.
- Reason-controlled DMLRO final approval during MLRO absence.

### M14. Parallel DMLRO and MLRO Review Assignment

**Status:** Delivered  
**Delivery period:** 2026-09-17

- AML submission creates DMLRO and parallel MLRO review tasks and notifications.
- Existing DMLRO-pending cases recover missing MLRO assignments when the queue is loaded.

### M15. Final KYC Decision and Amendment Workflow

**Status:** Delivered  
**Delivery period:** 2026-09-17

- AML Team/AML Supervisor dropdown after required approvals.
- Approved KYC can be locked and marked as final.
- Amendment-required path selects affected sections, records a reason, increments the version, reopens the populated form, and restarts approval.

### M16. Signed Engagement and Client Activation

**Status:** Delivered  
**Delivery period:** 2026-09-17

- Operations/BD uploads the signed engagement letter after final KYC confirmation.
- Outcomes include Convert and activate, Reject, and On hold.
- Only activated records appear in the Clients list.

### M17. Document Management and Export Generation

**Status:** Delivered  
**Delivery period:** 2026-07-07 to 2026-09-17

- Multi-file uploads, grouped document headings, append behavior, individual view/download, delete, and ZIP download.
- KYC DOCX/PDF generation and versioned generated-document storage.
- CRRF Excel/PDF reporting and Screening/CRRF evidence access.

### M18. Production Security Hardening

**Status:** Delivered  
**Delivery period:** 2026-09-08

- Server-side file extension, MIME type, binary signature, file size, and file-count validation.
- Executable, script, macro-capable, and unsafe upload blocking.
- Upload path containment and safe response headers.
- Same-origin production API behavior, production CORS, security headers, database-backed session validation, and authenticated tenant scoping.

### M19. Newoon AML Compass Knowledge Base

**Status:** Delivered  
**Delivery period:** 2026-09-17

- Standalone, responsive AML, KYC, and compliance help center branded as Newoon AML Compass.
- Searchable and filterable guide library covering enquiries, KYC, Screening, CRRF, approvals, amendments, activation, documents, roles, security, and troubleshooting.
- Structured article pages with contents navigation, previous/next guides, support links, and mobile layouts.

## Minor Changes

### Platform, Access, and UI

1. Refreshed dashboard cards, layout, operational summaries, and visual hierarchy.
2. Redesigned login screen while preserving workflow credentials.
3. Added modern application typography and Newoon brand styling.
4. Separated brand red from green success, amber pending, blue in-progress, and red error states.
5. Fixed password visibility toggle and differentiated API connectivity failures from invalid credentials.

### Enquiry Management

1. Added `QFC LLC` to proposed legal-form options.
2. Added Requested Service `Other` with a details field.
3. Removed duplicate contact-person identity upload from the Contact tab.
4. Renamed Director UBO attachment wording to Proposed Director.
5. Added Passport and/or QID with separate expiry dates; either identity is sufficient.
6. Added phone country-code handling and enquiry creation diagnostics.
7. Routed new-enquiry notifications to SEF and corrected AML return wording to BD.
8. Restricted enquiry deletion to Super Admin.
9. Preserved multiple saved files while editing an enquiry.
10. Locked Operations editing, uploading, and resubmission after submission until returned by AML.
11. Added grouped enquiry attachment display and single-file/ZIP download behavior.
12. Replaced converted status actions with an Open KYC Case action.

### KYC Preparation and Form

1. Added legal-document view and delete actions.
2. Added multi-document KYC preparation uploads.
3. Preserved files across repeated uploads instead of replacing them.
4. Added searchable country and KYC dropdown overlays.
5. Added signature upload controls.
6. Synced case uploads into the KYC required-document checklist.
7. Fixed initial section focus so Section A opens first.
8. Added multiple country support for manager/director nationality.
9. Added manager nationality and address fields.
10. Changed Review links so the KYC form opens in a new browser tab.
11. Renamed Reference to KYC Number and auto-populated it.
12. Added preliminary proposed-company visual treatment.
13. Replaced Owner/Shareholder/UBO wording with Party, Control/Interest, and Beneficial person terminology.
14. Changed checklist `Provided` wording to `Received`.
15. Renamed legal-entity shareholder CR wording to legal-entity parties while retaining legacy matching.
16. Removed the AML Supervisor accuracy-check field from UI and generated documents.
17. Removed the Workflow Progress panel from KYC details.

### Screening

1. Added entity auto-linking from KYC company, parties, managers, and communication person.
2. Fixed saved result/notes refresh behavior.
3. Added compact expandable records and collapse/expand controls.
4. Added Screening PDF result dropdown persistence.
5. Renamed Conclusion to Result.
6. Added screening entity deletion.
7. Added result-dependent remarks validation.
8. Added World-Check and Google to required common evidence.
9. Rendered only selected individual screening tools.
10. Removed duplicated Other-document upload UI.
11. Replaced country text fields with the shared country dropdown.
12. Arranged name, identifier, country, and result in one responsive row.

### CRRF

1. Auto-populated client name, code, CR number, and country with KYC fallback data.
2. Added Low, Medium, and High risk ratings.
3. Added multiple PDF/XLS/XLSX uploads.
4. Added CRRF file view and delete actions.
5. Consolidated DMLRO/MLRO comments into one internal Comments field.
6. Kept internal comments editable in-system while excluding them from exports.
7. Kept supporting documents optional while risk rating remains mandatory.
8. Combined risk rating, comments, uploads, uploaded files, and Save CRRF into one form layout.

### Review and Approval

1. Added review-task notifications and unread notification handling.
2. Fixed repeated review-queue transitions.
3. Added final approval and signed document version controls.
4. Added DMLRO/MLRO/SEF decision fields, signatures, dates, conditions, and reasons.
5. Added additional-information and return routing.
6. Added role-specific review navigation.
7. Opened notification Review actions on the modern Review Package screen.
8. Hid the KYC editor while Screening or CRRF details are selected.
9. Added evidence file view actions, notes, remarks, and internal comments to the package.
10. Added collapsible Screening records with Collapse all/Expand all.
11. Added read-only Screening access for DMLRO, MLRO, and SEF.
12. Added parallel MLRO task backfill for existing DMLRO-pending cases.
13. Improved final-decision error reporting.
14. Prevented engagement activation before AML final-KYC confirmation.

### Client Activation and Amendment

1. Added signed engagement letter validation.
2. Added Convert and activate, Reject, and On hold outcomes.
3. Added mandatory reasons for Reject and On hold.
4. Hid prospect records from the active Clients list.
5. Added client-status backfill for existing activated/direct clients.
6. Added selected-section and reason requirements for amendments.
7. Preserved prior KYC data when opening an amendment version.

### Documents, Exports, and Security

1. Fixed KYC DOCX template lookup and production frontend serving.
2. Improved DOCX/PDF save and download behavior.
3. Polished ownership diagram spacing, borders, labels, and UBO/beneficial badge placement.
4. Added grouped KYC preparation files and ZIP download for multi-file groups.
5. Added grouped enquiry ZIP downloads.
6. Added explicit download actions instead of relying on file preview.
7. Added upload hints for allowed types, 10 MB per file, and up to 20 files.
8. Added frontend pre-upload validation.
9. Restricted Screening merged evidence to PDF.
10. Restricted CRRF evidence to PDF/Excel.
11. Added `X-Content-Type-Options: nosniff` to file responses.
12. Removed hard-coded production localhost API fallback.
13. Revalidated user status, role, and tenant on authenticated requests.
14. Blocked suspended-user login and stale-session access.
15. Reviewed authenticated tenant boundaries across KYC, Screening, CRRF, Enquiry, and Documents.

### Documentation and Support

1. Added responsive search, topic filters, popular workflows, article navigation, feedback controls, and a support handoff to the Newoon AML Compass knowledge base.

## Final Delivery Evaluation Checklist

Use this checklist before presenting the completed feature list to the client:

- [ ] Confirm every major capability against the deployed production build.
- [ ] Confirm every applicable migration is deployed successfully.
- [ ] Validate each role with a dedicated test account.
- [ ] Complete one standard-risk KYC from enquiry through client activation.
- [ ] Complete one High-risk KYC through mandatory SEF approval.
- [ ] Complete one amendment cycle and verify version increment/data preservation.
- [ ] Verify KYC DOCX/PDF and CRRF Excel/PDF outputs.
- [ ] Verify grouped single-file and ZIP downloads.
- [ ] Verify rejected/on-hold enquiries do not appear as active clients.
- [ ] Record client acceptance, deferred items, and out-of-scope requests separately.

## Maintenance Rule

Continue recording implementation detail chronologically in `CHANGE_LOG_REPORT.md`. For every client-visible completed change, also update the relevant major or minor item in this register. Add a new major item only when the application gains a distinct business capability or workflow.
