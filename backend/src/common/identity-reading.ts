import { IdCardText } from './id-card-text';
import { MrzResult } from './mrz';

// The answer of the passport / QID "fill from a copy" readers on the enquiry and KYC forms. Nothing is stored:
// the form fills in the values and staff check them against the document.
// readFromText: read from the printed labels of a card without machine-readable lines (no check digits), so every
// value must be compared with the document. qid / passport: both, when the card shows both (older residency permit).
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
      readFromText?: boolean;
      qid?: { number: string; expiry: string | null };
      passport?: { number: string; expiry: string | null };
    };

const NOT_READ = { found: false as const, message: 'The details could not be read from this file. Enter them from the document.' };

export function identityReading(read: MrzResult | null, identityType: string | undefined, card?: IdCardText | null): IdentityReading {
  if (!read || (!read.documentNumber && !read.expiryDate)) return card ? cardReading(card, identityType) : NOT_READ;
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

function cardReading(card: IdCardText, identityType: string | undefined): IdentityReading {
  const qid = card.qidNumber ? { number: card.qidNumber, expiry: card.qidExpiry } : undefined;
  const passport = card.passportNumber ? { number: card.passportNumber, expiry: card.passportExpiry } : undefined;
  // The chosen type when the card shows it, otherwise the one it shows.
  const type: 'PASSPORT' | 'QID' = identityType === 'PASSPORT' ? (passport ? 'PASSPORT' : 'QID') : (qid ? 'QID' : 'PASSPORT');
  const main = type === 'QID' ? qid : passport;
  return {
    found: true,
    identityType: type,
    typeMatches: !identityType || identityType === type,
    documentNumber: main?.number || null,
    documentNumberCheck: 'FAILED',
    expiryDate: main?.expiry || null,
    expiryValid: false,
    dateOfBirth: card.dateOfBirth,
    nameOnDocument: card.fullName || '',
    nationality: card.nationality || '',
    issuingCountry: '',
    readFromText: true,
    qid,
    passport
  };
}
