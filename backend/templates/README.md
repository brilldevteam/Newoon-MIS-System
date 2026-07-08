# KYC Part 1 DOCX Template

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
{declarationFullName}
{declarationPosition}
{declarationDate}
{signatureFileName}
{stampFileName}
{amlAccuracyChecked}
{amlClarificationFindings}
{riskClassification}
{dueDiligenceType}
{amlName}
{amlSignatureFileName}
{amlDate}
{dmlroName}
{dmlroSignatureFileName}
{dmlroDate}
{dmlroComments}
{mlroName}
{mlroSignatureFileName}
{mlroDate}
{mlroComments}
```

To make the export match the original format, copy the blank KYC format DOCX, keep its layout, and replace the blank answer areas with these placeholders.
