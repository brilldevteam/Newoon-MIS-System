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
