export function preliminaryObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

export function preliminaryDeclaration(data: Record<string, unknown>): Record<string, unknown> {
  const declaration = data.declaration && typeof data.declaration === 'object' && !Array.isArray(data.declaration)
    ? data.declaration as Record<string, unknown> : {};
  return {
    fullName: declaration.fullName || '',
    position: declaration.position || '',
    date: declaration.date || '',
    signatureDataUrl: declaration.authorizedSignatureDataUrl || '',
    signatureFileName: declaration.authorizedSignature || '',
    stampDataUrl: declaration.companyStampDataUrl || '',
    stampFileName: declaration.companyStamp || ''
  };
}

export function declarationWithPreliminaryFallback(current: Record<string, unknown>, preliminary: Record<string, unknown>) {
  const result = { ...preliminaryDeclaration(preliminary), ...current };
  // Older conversions did not transfer the declaration. Never replace an entered KYC value.
  for (const [key, value] of Object.entries(preliminaryDeclaration(preliminary))) {
    if (!result[key]) result[key] = value;
  }
  return result;
}

export function amendedPreliminaryDocument(source: Record<string, unknown>, sectionA: Record<string, unknown>, shareholders: Record<string, unknown>[], ubos: Record<string, unknown>[], managers: Record<string, unknown>[], contact: Record<string, unknown>, declaration: Record<string, unknown>) {
  return {
    ...source,
    companyName: sectionA.legalName, proposedLegalForm: sectionA.legalForm,
    jurisdiction: sectionA.countryOfIncorporation, registeredOfficeAddress: sectionA.registeredOfficeAddress,
    businessActivity: sectionA.businessNature, expectedBusiness: sectionA.prospectiveService,
    shareholders: shareholders.map((row) => ({ ...row, address: row.residenceAddress, ownershipPercentage: row.shareholderPercentage ?? row.ownershipPercentage })),
    ubos: ubos.map((row) => ({ ...row, address: row.residenceAddress, ownershipPercentage: row.uboInterestPercentage ?? row.ownershipPercentage, uboPercentage: row.uboInterestPercentage ?? row.ownershipPercentage })),
    management: managers,
    contact: { ...preliminaryObject(source.contact), ...contact, mobileNumber: contact.mobileNumber },
    declaration: { ...preliminaryObject(source.declaration), fullName: declaration.fullName, position: declaration.position, date: declaration.date, authorizedSignatureDataUrl: declaration.signatureDataUrl, companyStampDataUrl: declaration.stampDataUrl }
  };
}
