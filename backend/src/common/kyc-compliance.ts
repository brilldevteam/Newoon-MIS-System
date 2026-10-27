export function complianceValidationError(sectionA: Record<string, unknown>, sectionD: Record<string, unknown>, fullKycStarted = false): string | null {
  if (sectionA.formVariant === 'PRELIMINARY_PROPOSED_COMPANY' && !fullKycStarted) return null;
  for (const [key, label, details] of [
    ['pepQuestion', 'PEP exposure', 'pepDetails'],
    ['sanctionQuestion', 'sanction exposure', 'sanctionDetails'],
    ['dualCitizenshipQuestion', 'dual citizenship', 'dualCitizenshipDetails']
  ]) {
    if (!['Yes', 'No'].includes(String(sectionD[key] || ''))) return `Complete ${label} in D. Compliance and Risk before submitting full KYC.`;
    if (sectionD[key] === 'Yes' && !String(sectionD[details] || '').trim()) return `Add ${label} details in D. Compliance and Risk before submitting full KYC.`;
  }
  return null;
}
