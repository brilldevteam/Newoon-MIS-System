import { MrzResult } from './mrz';

// The answer of the passport / QID "fill from a copy" readers on the enquiry and KYC forms. Nothing is stored:
// the form fills in the values and staff check them against the document.
export type IdentityReading =
  | { found: false; message: string }
  | {
      found: true;
      identityType: 'PASSPORT' | 'QID' | null;
      typeMatches: boolean;
      documentNumber: string | null;
      documentNumberCheck: MrzResult['documentNumberCheck'];
      expiryDate: string | null;
      expiryValid: boolean;
      dateOfBirth: string | null;
      nameOnDocument: string;
      nationality: string;
      issuingCountry: string;
    };

export function identityReading(read: MrzResult | null, identityType: string | undefined): IdentityReading {
  if (!read || (!read.documentNumber && !read.expiryDate)) {
    return { found: false, message: 'The details could not be read from this file. Enter them from the document.' };
  }
  // A passport has a TD3 zone with document type P; an ID card such as the QID a TD1 zone.
  const detectedType = read.format === 'TD3' && read.documentType.startsWith('P') ? 'PASSPORT' : read.format === 'TD1' ? 'QID' : null;
  return {
    found: true,
    identityType: detectedType || (identityType === 'QID' || identityType === 'PASSPORT' ? identityType : null),
    typeMatches: !identityType || !detectedType || identityType === detectedType,
    documentNumber: read.documentNumber,
    documentNumberCheck: read.documentNumberCheck,
    expiryDate: read.expiryDate,
    expiryValid: read.expiryValid,
    dateOfBirth: read.dateOfBirth,
    nameOnDocument: [read.givenNames, read.surname].filter(Boolean).join(' '),
    nationality: read.nationality,
    issuingCountry: read.issuingCountry
  };
}
