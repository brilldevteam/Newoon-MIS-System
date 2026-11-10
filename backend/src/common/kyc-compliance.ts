export function complianceValidationError(sectionA: Record<string, unknown>, sectionD: Record<string, unknown>, fullKycStarted = false): string | null {
  if (sectionA.formVariant === 'PRELIMINARY_PROPOSED_COMPANY' && !fullKycStarted) return null;
  for (const [key, label, details] of [
    ['pepQuestion', 'PEP exposure', 'pepDetails'],
    ['sanctionQuestion', 'sanction exposure', 'sanctionDetails'],
    ['dualCitizenshipQuestion', 'dual citizenship', 'dualCitizenshipDetails']
  ]) {
    if (!['Yes', 'No'].includes(String(sectionD[key] || ''))) return `Open the KYC form, go to D. Compliance and Risk and answer Yes or No for ${label}.`;
    if (sectionD[key] === 'Yes' && !String(sectionD[details] || '').trim()) return `${label[0].toUpperCase()}${label.slice(1)} is answered Yes. Add the details in the KYC form, D. Compliance and Risk.`;
  }
  return null;
}
