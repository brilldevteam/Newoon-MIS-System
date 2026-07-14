export const newoonServiceOptions = [
  '',
  'N001 - Secretary and QFC Compliance Service',
  'N002 - Address Service',
  'N003 - Temporary Authorized Signatory Service',
  'N004 - Open Bank Account - Personal / Corporate',
  'N005 - Accounting and Bookkeeping Service',
  'N006 - Nominee Manager in QFZ Company',
  'N007 - Payroll Service & HR Onboarding',
  'N008 - Company Formation - QFZ',
  'N009 - Company Formation - QFC',
  'N010 - Business Plan Proposal Preparation',
  'N011 - Senior Executive Function Services',
  'N012 - Management Account Preparation Service',
  'N013 - Document Attestation Assistance from MOFA and Embassy',
  'N014 - PRO Services for Immigration Work',
  'N015 - Authorized Signatory Service',
  'N016 - Assist for Capital Gain Tax Assessment',
  'N017 - Assist in Obtain QID',
  'N018 - Assist for Company Enhanced Due Diligence',
  'N019 - Liquidation Service - MOCI',
  'N020 - Company Formation - MOCI',
  'N021 - Tax Compliance Service',
  'N022 - Temporary Secretary and QFC Compliance Service',
  'N023 - Preparation of FS and Assist in ITR Submission',
  'N024 - Assist for Share Capital Reduction',
  'N025 - Assistant with Company Initial Setup Tasks',
  'N026 - Payroll Service',
  'N027 - Assist for Share Capital Increase',
  'N028 - Director Service',
  'N029 - Assist for Company Ownership Change',
  'N030 - Audit Documents Filling Service',
  'N031 - Tax Dhareeba Update Service',
  'N032 - Assign staff as Admin Coordinator',
  'N033 - Liquidation Service - QFC',
  'N034 - Coordinate for Medical and Fingerpring for Visa',
  'N035 - Shareholder Update in QFC Portal',
  'N036 - Business Advisory Service for Restructuring Legal Structure',
  'N037 - Renueve Certification Dervice',
  'N038 - Nominee Shareholder Service',
  'N039 - Additional Support Services',
  'N040 - Secretary and QFC Compliance Service - QFZ',
  'N041 - Interim Manager Service - MOCI',
  'N042 - Assistance in Processing Tax Residence Certificate',
  'N043 - Initial Setup Support and Mandatory Compliance Requirements'
];

export function serviceListValue(value: unknown) {
  if (Array.isArray(value)) {
    return value.filter(Boolean).map(String);
  }

  if (!value) return [];

  return String(value)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export function serviceListText(value: unknown) {
  return serviceListValue(value).join(', ');
}
