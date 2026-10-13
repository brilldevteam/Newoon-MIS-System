# KYC DOCX Template

## Current Export Behavior

KYC DOCX and PDF downloads are rendered from the shared model in `backend/src/kyc/export/`. This template supplies only the letterhead (`word/media/image1.png`) and footer (`word/media/image3.png`) artwork, which `kyc-export-assets.ts` trims automatically. Changing placeholders or body text in the template has no effect. To change the letterhead, replace those two images in the template, keeping their file names.

The placeholder guidance below is historical. Read `docs/DEVELOPER_HANDOVER.md` for current rendering and QA instructions.

Place the approved blank KYC DOCX template here:

```text
backend/templates/kyc-part-1-template.docx
```

The backend uses this file first. If it does not exist, it falls back to a basic generated DOCX.

Supported placeholders:

```text
{date}
{reference}
{legalName}
{commercialRegistrationNo}
{taxIdentificationNo}
{dateOfIncorporation}
{countryOfIncorporation}
{legalForm}
{registeredOfficeAddress}
{telephone}
{email}
{website}
{businessNature}
{licenseActivities}
{relatedIndustry}
{prospectiveService}
{shareholdersText}
{ownershipStructureText}
{shareholderType}
{shareholderLinkedClient}
{shareholderIsUbo}
{totalOwnershipPercentage}
{uboDifferentFromShareholders}
{uboGroupStructureNotes}
{ubosText}
{managersText}
{pepQuestion}
{pepDetails}
{sanctionQuestion}
{sanctionDetails}
{dualCitizenshipQuestion}
{dualCitizenshipDetails}
{dualCitizenshipPassportFileName}
{communicationFullName}
{communicationPosition}
{communicationNationality}
{communicationIdentityNumber}
{communicationMobile}
{communicationEmail}
{requiredDocumentsText}
{additionalDocumentsText}
{uploadedFilesNote}
{declarationFullName}
{declarationPosition}
{declarationDate}
{signatureFileName}
{stampFileName}
{amlAccuracyChecked}
{amlAccuracyYes}
{amlAccuracyNo}
{amlClarificationFindings}
{riskClassification}
{riskHigh}
{riskMedium}
{riskLow}
{dueDiligenceType}
{dueSimplified}
{dueRegular}
{dueEnhanced}
{amlName}
{amlSignatureFileName}
{amlDate}
{amlComments}
{dmlroName}
{dmlroSignatureFileName}
{dmlroDate}
{dmlroDecision}
{dmlroConditions}
{dmlroReason}
{dmlroComments}
{mlroName}
{mlroSignatureFileName}
{mlroDate}
{mlroDecision}
{mlroFinalRiskClassification}
{mlroRiskReasonCategory}
{mlroRiskExplanation}
{mlroConditions}
{mlroComments}
{sefName}
{sefSignatureFileName}
{sefDate}
{sefComments}
```

To make the export match the original format, copy the blank KYC format DOCX, keep its layout, and replace the blank answer areas with these placeholders.
