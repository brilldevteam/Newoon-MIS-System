window.AML_COMPASS_TOPICS = [
  { id: 'getting-started', code: '01', title: 'Getting Started', description: 'Workspace basics, roles, and first steps' },
  { id: 'enquiries', code: 'EN', title: 'Enquiries', description: 'Intake, documents, and AML handoff' },
  { id: 'kyc', code: 'KY', title: 'KYC Preparation', description: 'Cases, forms, ownership, and documents' },
  { id: 'screening', code: 'SC', title: 'Screening', description: 'Tools, results, evidence, and finalization' },
  { id: 'crrf', code: 'CR', title: 'CRRF', description: 'Risk rating, comments, files, and exports' },
  { id: 'reviews', code: 'RV', title: 'Reviews & Approvals', description: 'DMLRO, MLRO, SEF, and handoffs' },
  { id: 'activation', code: 'AC', title: 'Final KYC & Activation', description: 'Amendments, engagement, and clients' },
  { id: 'documents', code: 'DC', title: 'Documents & Exports', description: 'Uploads, ZIP files, DOCX, PDF, and Excel' },
  { id: 'security', code: 'SE', title: 'Security & Access', description: 'Roles, sessions, tenants, and upload rules' },
  { id: 'troubleshooting', code: '?', title: 'Troubleshooting', description: 'Practical solutions to common issues' }
];

window.AML_COMPASS_GUIDES = [
  {
    id: 'getting-started', topic: 'getting-started', title: 'Getting started with AML Compass', time: '6 min', summary: 'Understand the workspace, navigation, and the end-to-end AML and KYC lifecycle.',
    sections: [
      { title: 'What AML Compass manages', body: ['AML Compass connects enquiry intake, KYC preparation, screening, CRRF, role-based review, final KYC confirmation, and client activation in one controlled workflow.'] },
      { title: 'The standard lifecycle', steps: ['Operations or BD records an enquiry and supporting documents.', 'AML reviews the enquiry and converts it into one linked KYC case.', 'AML completes the KYC Form, Screening, and CRRF package.', 'DMLRO and MLRO review the package; High-risk cases require SEF.', 'AML confirms the approved KYC as final or opens an amendment.', 'Operations uploads the signed engagement letter and activates, rejects, or places the engagement on hold.'] },
      { title: 'Use the left navigation', body: ['Dashboard shows operational totals. Enquiries manages intake. KYC Workflow tracks prepared files. Screening and CRRF provide specialist registers. My Review Tasks appears for decision-making roles.'], callout: 'The actions you see depend on your assigned role and the current workflow status.' }
    ]
  },
  {
    id: 'roles-access', topic: 'getting-started', title: 'Understand roles and access', time: '7 min', summary: 'Know which team owns each action and why some controls are hidden.',
    sections: [
      { title: 'Operations and BD', body: ['Creates and updates enquiries, uploads intake documents, and submits files to AML. After final KYC confirmation, Operations uploads the signed engagement letter and completes the engagement outcome.'] },
      { title: 'AML Team and AML Supervisor', body: ['Reviews intake, creates or completes KYC records, Screening, and CRRF, routes the review package, and confirms the final KYC or opens an amendment.'] },
      { title: 'DMLRO, MLRO, and SEF', body: ['DMLRO and MLRO review the combined KYC package. MLRO can route any case to SEF, and High-risk cases must be reviewed by SEF. Approved exceptions require a recorded reason.'] },
      { title: 'Administrators', body: ['Company Admin manages the tenant workflow. Super Admin has platform-wide administration and is the only role allowed to delete enquiries.'], callout: 'If an expected button is missing, confirm the login role and the case status before treating it as a system error.' }
    ]
  },
  {
    id: 'enquiries', topic: 'enquiries', title: 'Create and submit an enquiry', time: '9 min', summary: 'Capture a complete enquiry and hand it to AML without losing documents.',
    sections: [
      { title: 'Create the enquiry', steps: ['Open Enquiries and select Add Enquiry.', 'Choose Existing Legal Entity, Proposed Company, or Current Client / New Services.', 'Complete company, contact, exposure, attachment, and notes information.', 'For identity, enter Passport and/or QID with the applicable expiry date.', 'Save the enquiry and review the details page.'] },
      { title: 'Add services and documents', body: ['Select one or more available services. Use Other when the required service is not listed and enter its name. Multiple files under one document heading remain grouped together.'] },
      { title: 'Submit to AML', body: ['Submit the enquiry once the required information is ready. Editing and uploading are locked after submission until AML returns the enquiry to BD.'], callout: 'Do not upload the same document repeatedly. Existing files remain visible when the enquiry is reopened for editing.' }
    ]
  },
  {
    id: 'enquiry-to-kyc', topic: 'enquiries', title: 'Review and convert an enquiry to KYC', time: '6 min', summary: 'Move one approved enquiry into one uniquely linked KYC case.',
    sections: [
      { title: 'Review the enquiry', steps: ['Open the submitted enquiry using an AML Team or AML Supervisor account.', 'Review company details, requested services, contact identity, and every attachment group.', 'Return the enquiry to BD when information is missing, or mark it Ready for KYC.'] },
      { title: 'Create the KYC case', body: ['Select Create KYC Case only after the enquiry is ready. AML Compass generates a KYC number in the `KYC-YYYY-0001` format and copies the available enquiry information and documents into the KYC workspace.'] },
      { title: 'Duplicate protection', body: ['A converted enquiry becomes terminal and displays Open KYC Case instead of conversion actions. Repeated or simultaneous requests cannot create another KYC from the same enquiry.'], callout: 'Prospective records do not appear in the active Clients list until the final engagement is converted and activated.' }
    ]
  },
  {
    id: 'kyc-preparation', topic: 'kyc', title: 'Prepare the KYC form and supporting documents', time: '12 min', summary: 'Complete the eight KYC sections and prepare a review-ready file.',
    sections: [
      { title: 'Open the KYC workspace', body: ['Open KYC Workflow and select the KYC number. The case page provides access to the KYC Form, Screening, CRRF, preparation documents, timeline, and comments.'] },
      { title: 'Complete Sections A to H', steps: ['A: General Company Information and KYC number.', 'B: Control / Interest Details and beneficial persons.', 'C: Managers, signatories, directors, and secretary.', 'D: Compliance and Risk.', 'E: Key Communication Person.', 'F: Required Documents.', 'G: Client Declaration.', 'H: Internal Use Only.'] },
      { title: 'Save and validate', body: ['Save each section after completing it. The form preview updates with saved values. Use searchable lists for structured values and review percentage and beneficial-person validation before submission.'], callout: 'A proposed-company enquiry opens as a preliminary proposed-company KYC form while retaining the same controlled review process.' }
    ]
  },
  {
    id: 'ownership', topic: 'kyc', title: 'Build the control and beneficial-person structure', time: '8 min', summary: 'Record direct and multi-layer entities and produce a readable structure diagram.',
    sections: [
      { title: 'Add listed parties', body: ['In Section B, add each individual or corporate party, select its parent entity, enter interest percentage, and record identity or CR details.'] },
      { title: 'Link corporate entities', body: ['Use CR lookup to locate existing corporate entities saved in other KYC forms. The current client is excluded from self-matching.'] },
      { title: 'Confirm beneficial persons', body: ['Mark the applicable natural persons as beneficial persons and confirm the total percentage. The generated KYC document includes the saved structure and diagram.'], callout: 'Use the neutral Party, Control / Interest, and Beneficial person terminology shown in the application and exports.' }
    ]
  },
  {
    id: 'screening', topic: 'screening', title: 'Complete Screening and evidence', time: '11 min', summary: 'Record required common checks and only the individual tools that apply.',
    sections: [
      { title: 'Complete common Screening PDF results', body: ['Record results and evidence for NCTC, UN, OFAC, EU, PPO List, World-Check, and Google in the common Screening PDF section.'] },
      { title: 'Create individual records', steps: ['Select a KYC-linked company, party, beneficial person, manager, or add a manual record.', 'Confirm the screening name, identifier, and country.', 'Choose only the individual tools used: NCTC, UN, OFAC, or Other.', 'Record a result and upload evidence for each selected tool.', 'Add comments for potential or confirmed matches.', 'Save the draft and finalize when complete.'] },
      { title: 'Review files', body: ['Use the file-level View action before finalizing. Expand or collapse records when a case contains many screened entities.'], callout: 'Unused individual tools are not displayed and do not need empty results.' }
    ]
  },
  {
    id: 'crrf', topic: 'crrf', title: 'Complete the CRRF risk record', time: '7 min', summary: 'Set the risk rating, maintain internal comments, and attach optional evidence.',
    sections: [
      { title: 'Confirm linked client data', body: ['CRRF displays the client name, client code, CR number, country, and KYC number using linked client and KYC data.'] },
      { title: 'Record risk and comments', steps: ['Select Low, Medium, or High risk.', 'Enter internal comments where needed.', 'Upload optional PDF, XLS, or XLSX supporting files.', 'Review uploaded files and select Save CRRF.'] },
      { title: 'Export the report', body: ['Use Excel or PDF export for the formal CRRF record. Internal comments remain visible inside AML Compass but are deliberately excluded from exports.'], callout: 'Risk rating is mandatory. Supporting documents are optional.' }
    ]
  },
  {
    id: 'review-package', topic: 'reviews', title: 'Review the complete KYC package', time: '9 min', summary: 'Inspect KYC, Screening, CRRF, evidence, and internal comments from one screen.',
    sections: [
      { title: 'Open the assigned task', body: ['Use My Review Tasks or the role notification. The Review action opens the modern KYC Review Package for the assigned case.'] },
      { title: 'Review all three areas', steps: ['KYC Form: review client sections and generated documents.', 'Screening: inspect records, results, remarks, and each evidence file.', 'CRRF: confirm client data, risk rating, supporting files, and internal comments.'] },
      { title: 'Record the decision', body: ['Complete reviewer name, date, signature, decision, conditions, reason, and comments as required by the role. Submitted stages are versioned and locked.'], callout: 'Reviewers have read-only access to Screening evidence; AML retains edit and finalize permissions.' }
    ]
  },
  {
    id: 'approvals', topic: 'reviews', title: 'Route DMLRO, MLRO, and SEF approvals', time: '10 min', summary: 'Apply the correct review route for standard, exception, and High-risk cases.',
    sections: [
      { title: 'DMLRO and MLRO review', body: ['AML submission assigns DMLRO and makes the package available to MLRO in parallel. Each reviewer records a controlled decision and supporting comments.'] },
      { title: 'SEF routing', body: ['MLRO can choose Send to SEF at any risk level. High-risk cases must go to SEF before final KYC confirmation.'] },
      { title: 'Absence and bypass controls', body: ['MLRO may review while DMLRO is pending only with a recorded bypass reason. DMLRO may perform final approval during MLRO absence only by selecting the dedicated option and recording the reason or conditions.'], callout: 'Use exception decisions only for genuine continuity cases such as documented absence or vacation.' }
    ]
  },
  {
    id: 'final-kyc', topic: 'activation', title: 'Confirm the final KYC or open an amendment', time: '7 min', summary: 'Complete the AML post-approval decision before client activation.',
    sections: [
      { title: 'Open Final KYC Decision', body: ['After MLRO approval, or SEF approval where required, open the KYC case using AML Team or AML Supervisor access.'] },
      { title: 'Use approved KYC as final', body: ['Select Use approved KYC as final and confirm. AML Compass locks the form and changes the status to KYC Final Approved.'] },
      { title: 'Request an amendment', steps: ['Select Amendment required.', 'Choose the affected KYC sections.', 'Enter the amendment reason.', 'Confirm the decision.', 'Edit the reopened, previously populated form.', 'Complete the review cycle again to produce the final KYC.'], callout: 'Operations cannot activate the engagement until AML confirms a final KYC.' }
    ]
  },
  {
    id: 'client-activation', topic: 'activation', title: 'Complete engagement and activate the client', time: '6 min', summary: 'Upload the signed engagement and determine the final client outcome.',
    sections: [
      { title: 'Upload the signed engagement', body: ['After KYC Final Approved, Operations or BD uploads the signed engagement letter in the KYC case.'] },
      { title: 'Choose the outcome', steps: ['Convert to client and activate: adds the record to the active Clients list.', 'Reject engagement: requires a reason and keeps the prospect out of active clients.', 'Place engagement on hold: requires a reason and records the hold state.'] },
      { title: 'Verify the client register', body: ['Only records with an active client outcome appear in Clients. An enquiry or prepared KYC is not automatically an active client.'] }
    ]
  },
  {
    id: 'documents', topic: 'documents', title: 'Upload, review, and download documents', time: '8 min', summary: 'Use safe multi-file controls and grouped downloads throughout AML Compass.',
    sections: [
      { title: 'Upload rules', body: ['The interface shows allowed formats for each area. The general limit is 10 MB per file and up to 20 files. Screening common evidence is PDF-only; CRRF accepts PDF and Excel.'] },
      { title: 'Work with file groups', body: ['Files uploaded under the same heading stay grouped. Use individual View or Download actions. Download uses the original file when one is present and a ZIP archive when multiple files are present.'] },
      { title: 'Generate formal documents', body: ['Generate or download the KYC as DOCX or PDF and CRRF as Excel or PDF where available. Submitted review versions and generated documents remain linked to the KYC case.'], callout: 'Executable, script, macro-capable, incorrectly identified, oversized, and excessive file selections are rejected.' }
    ]
  },
  {
    id: 'troubleshooting', topic: 'troubleshooting', title: 'Troubleshoot common workflow issues', time: '9 min', summary: 'Resolve missing actions, failed uploads, empty queues, and local server errors.',
    sections: [
      { title: 'A button is missing', body: ['Confirm the logged-in role shown in the header and the current case status. Actions are intentionally hidden when the role or workflow stage does not own them. Refresh after a deployment.'] },
      { title: 'A review task is missing', body: ['Open My Review Tasks using the correct DMLRO, MLRO, or SEF account. Confirm AML submitted the case and review the notification bell. MLRO queue loading repairs older missing parallel assignments for DMLRO-pending cases.'] },
      { title: 'A file is rejected', body: ['Check the displayed file type, size, and count rules. Rename only misleading filenames; do not change an extension to disguise the real file type.'] },
      { title: 'Local backend will not start', body: ['`EADDRINUSE` means another process owns port 5000. Stop the existing backend before starting another. Prisma `EPERM` on Windows means a running Node process is locking the Prisma engine; stop the backend before generating Prisma Client.'], callout: 'On production, use `prisma migrate deploy`, never `prisma migrate dev`.' }
    ]
  }
];
