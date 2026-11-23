import { ClientExpiryDocumentType } from '@prisma/client';

// Document types of the legal documents register (requirements D01-D14, docs/KYC_CLIENT_PROFILE_REQUIREMENTS.md).
// QID and PASSPORT are kept on the person (ClientPerson / ClientPersonPassport); the register lists them with the
// others. OTHER takes a typed label. The frontend keeps the same list (legalDocumentTypes in the client service).
export type LegalDocumentTypeKey =
  | 'CR_EXTRACT_EN' | 'CR_EXTRACT_AR' | 'PUBLIC_CR' | 'CERT_INCORPORATION' | 'COMMERCIAL_LICENSE' | 'COMPUTER_CARD'
  | 'ARTICLES' | 'TAX_CARD' | 'COMPANY_PROFILE' | 'ORG_CHART' | 'AUDITED_FS' | 'NATIONAL_ADDRESS' | 'POWER_OF_ATTORNEY'
  | 'QID' | 'PASSPORT' | 'OTHER';

export type LegalDocumentType = {
  key: LegalDocumentTypeKey;
  label: string;
  nature: 'COMPANY' | 'INDIVIDUAL';
  hasExpiry: boolean;
  // Kept on the person, not in ClientLegalDocument.
  personIdentity?: boolean;
  // Type used on the Expiry tab (reminders: 90/60/30 days for company documents).
  expiryType: ClientExpiryDocumentType;
  // Registration / CR documents: their expiry is the company's CR expiry.
  isRegistration?: boolean;
  // Shown on the Overview tab (requirement R10).
  overview?: boolean;
};

export const LEGAL_DOCUMENT_TYPES: LegalDocumentType[] = [
  { key: 'CR_EXTRACT_EN', label: 'Commercial Registration Extract (English)', nature: 'COMPANY', hasExpiry: true, expiryType: 'CR', isRegistration: true },
  { key: 'CR_EXTRACT_AR', label: 'Commercial Registration Extract (Arabic)', nature: 'COMPANY', hasExpiry: true, expiryType: 'CR', isRegistration: true },
  { key: 'PUBLIC_CR', label: 'Public CR (Public portal)', nature: 'COMPANY', hasExpiry: true, expiryType: 'CR', isRegistration: true },
  { key: 'CERT_INCORPORATION', label: 'Certificate of Incorporation', nature: 'COMPANY', hasExpiry: false, expiryType: 'OTHER' },
  { key: 'COMMERCIAL_LICENSE', label: 'Commercial License', nature: 'COMPANY', hasExpiry: true, expiryType: 'TRADE_LICENSE' },
  { key: 'COMPUTER_CARD', label: 'Computer card', nature: 'COMPANY', hasExpiry: true, expiryType: 'COMPUTER_CARD' },
  { key: 'ARTICLES', label: 'Articles of Association', nature: 'COMPANY', hasExpiry: false, expiryType: 'OTHER' },
  { key: 'TAX_CARD', label: 'Tax card', nature: 'COMPANY', hasExpiry: true, expiryType: 'OTHER' },
  { key: 'COMPANY_PROFILE', label: 'Company profile', nature: 'COMPANY', hasExpiry: false, expiryType: 'OTHER', overview: true },
  { key: 'ORG_CHART', label: 'Organisation chart', nature: 'COMPANY', hasExpiry: false, expiryType: 'OTHER', overview: true },
  { key: 'AUDITED_FS', label: 'Latest Audited Financial Statements', nature: 'COMPANY', hasExpiry: false, expiryType: 'OTHER' },
  { key: 'NATIONAL_ADDRESS', label: 'National Address certificate', nature: 'INDIVIDUAL', hasExpiry: true, expiryType: 'OTHER' },
  { key: 'POWER_OF_ATTORNEY', label: 'Power of attorney', nature: 'INDIVIDUAL', hasExpiry: true, expiryType: 'OTHER' },
  { key: 'QID', label: 'QID', nature: 'INDIVIDUAL', hasExpiry: true, personIdentity: true, expiryType: 'QID' },
  { key: 'PASSPORT', label: 'Passport', nature: 'INDIVIDUAL', hasExpiry: true, personIdentity: true, expiryType: 'PASSPORT' },
  { key: 'OTHER', label: 'Other', nature: 'COMPANY', hasExpiry: true, expiryType: 'OTHER' }
];

export function legalDocumentType(key: string | null | undefined) {
  return LEGAL_DOCUMENT_TYPES.find((type) => type.key === key) || null;
}
