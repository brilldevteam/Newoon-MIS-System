# MIS Workflow & System Requirements

## 1. Enquiry Creation

When a new enquiry is received, the system should create the enquiry with a unique Enquiry Code.

Notification of the new enquiry should go to:
- AML Supervisor
- DMLRO
- MLRO

BD should select the Enquiry Type from the following dropdown:

A. Existing Legal Entity  
B. Proposed Company – No Legal Status Yet  
C. Current Client – New Services Requested

Once the enquiry type is selected, the relevant form should automatically appear.

The user should not see fields that are irrelevant to the selected enquiry type.

The selected enquiry type and Enquiry Code should remain linked to the enquiry throughout the workflow.

## 2. A – Existing Legal Entity

When Existing Legal Entity is selected, the system should display the fields applicable to an existing legal entity.

### Information Required

1. Service Requested
   - Dropdown selection

2. Key Communication Person Details

3. Country Exposure
   - Head Office
   - Branch
   - Area of Operation

The system should allow the relevant country exposure information to be captured based on the entity's operations.

### Attachments

The following attachment options should appear:
- Corporate Documents – Company
- Identity Proof – UBO
- Identity Proof – Director
- Identity Proof – SEF
- Corporate documents of corporate shareholders in case of multiple layers of UBO
- UBO Part 1 and Part 2 submitted to QFC
- Identity Proof – Authorized Secretary

### Return to BD

Supervisor should have an option to send the enquiry back to BD where additional documents or information are required.

Supervisor should be able to write comments explaining what is required.

The comments should be visible to BD so that BD can provide the requested information/documents and send the enquiry back for review.

## 3. B – Proposed Company (No Legal Status Yet)

When Proposed Company – No Legal Status Yet is selected, the system should display the preliminary company information fields instead of the Existing Legal Entity fields.

### Information Required

**Proposed Company Name:**

**Proposed Legal Form**
- QFC LLC
- Branch
- Partnership

**Jurisdiction of Registration**
- QFC
- MOCI
- Free Zone

**Proposed Business Activity:**

**Source of Initial Capital:**

**Expected Services from Newoon:**
- Dropdown
- Option to select multiple services

**Proposed Registered Office Address:**

The system should allow multiple services to be selected where more than one service is expected from Newoon.

### Attachments

The following attachment options should appear:
- Identity Proof – Proposed UBO
- Identity Proof – Director UBO
- Identity Proof – Proposed SEF
- Corporate documents of corporate shareholders in case of multiple layers of UBO
- UBO Part 1 and Part 2 submitted to QFC
- Identity Proof – Authorized Secretary

### Return to BD

AML should have an option to send the enquiry back to BD for:
- Additional documents
- Additional information

AML should be able to write comments explaining what is outstanding.

BD should be able to provide the requested information and send the same enquiry back for AML review.

## 4. C – Current Client / New Services Requested

When Current Client – New Services Requested is selected, the system should display a simplified form.

For this enquiry type, BD should only be required to enter/select the new service(s) requested and in the place of company name list of our current company should appear only here as it is new service to current client and submit the enquiry.

The full Existing Legal Entity or Proposed Company form should not appear for this enquiry type.

## 5. Submission to AML Supervisor

Once BD completes and submits the enquiry, it should be sent to the AML Supervisor.

For:
- Existing Legal Entity
- Proposed Company – No Legal Status Yet
- Current Client / New Services Requested

the information and files should reach the AML Supervisor in the same format/structure in which they were submitted.

## 6. KYC Form – Required System Changes

The following changes are required in the existing KYC form.

### Section B – Nationality

The system should allow more than one nationality to be selected for an individual.

Nationality should be displayed using the country name.

For example, the system should display the actual country name rather than only a country code.

### Section C – Position

The system should allow more than one position to be selected for an individual.

The user should not have to create separate entries for the same individual simply because more than one position applies.

### Section D – Document Upload

Where Yes is selected in any relevant part of Section D, the system should allow more than one document to be uploaded.

The existing system currently provides only one document upload option.

This restriction should be removed so that multiple supporting documents can be uploaded where required.

### Section E – Position

The system should allow more than one position to be selected for an individual.

### Section F – Document Duplication

The following existing system issues should be corrected:
- In the Required Documents section, all documents are currently appearing twice.
- In the Additional Documents section, documents are currently appearing multiple times.

Each document requirement should appear correctly without unnecessary duplication.

## 7. Shareholder & UBO Diagram

The system should have an option to automatically generate the Shareholder & UBO diagram based on the information filled under the UBO & Shareholder section by Supervisor.

The diagram should be generated based on the Shareholder/UBO information entered into the system.

This should reduce the need to manually prepare the ownership diagram separately.

## 8. CRRF

There should be an option to upload the CRRF in:
- Excel
- PDF

The CRRF should remain linked to the same enquiry/file for review.

## 9. Screening

There should be an option to upload Screening files in:
- Excel
- PDF

The permitted MB/file-size limit for Screening uploads should be increased to accommodate larger files.

The Screening documents should remain linked to the same enquiry/file for review.

## 10. DMLRO Review

When the file goes to the DMLRO, the review should be clearly divided into three sections:

1. KYC
2. CRRF
3. Screening

The DMLRO should be able to review these three components from the same file.

The user should not need to search for the KYC, CRRF and Screening separately.

## 11. MLRO Approval

After the required review is completed, the file should go to the MLRO for approval.

The system should provide the following decision options:
- Approved
- Rejected
- Approved with Condition

The selected decision should remain recorded against the enquiry/file.

## 12. Approved with Condition

If Approved with Condition is selected, the approver should be able to record the condition in the system.

A notification should automatically go to BD informing them that there is a condition that needs to be complied with.

BD should be able to see the condition clearly so that the required action can be completed.

The condition should remain linked to the same enquiry/file.

## 13. High-Risk Files

If the file is classified as High Risk, an additional approval layer should apply.

The file should go to SEF for additional approval.

The High-Risk file should therefore not be treated in the same way as a normal-risk file where additional SEF approval is required.

## 14. Proposed Company – Final KYC Upon Incorporation

For Proposed Company – No Legal Status Yet, the DMLRO and MLRO should have an option to flag:

**Final KYC Required Upon Incorporation**

This flag should remain attached to the enquiry so that the Final KYC requirement is not missed after the company is incorporated.

Once the company is incorporated, a Final KYC should be completed.

The information already entered in the Preliminary KYC should automatically populate the Final KYC.

The same information should not need to be entered again.

The pre-populated information should have the option to:
- Edit
- Update
- Delete

This will allow any information that changed between the proposed-company stage and incorporation stage to be corrected in the Final KYC.
