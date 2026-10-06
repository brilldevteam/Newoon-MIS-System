export type OwnershipRow = {
  id?: string; fullName?: string; identityNumber?: string; isUbo?: boolean;
  shareholderType?: string; parentRowId?: string; sourceShareholderId?: string;
};

export function mergeBeneficialOwners<T extends OwnershipRow>(shareholders: T[], manual: T[]): T[] {
  const result: T[] = [];
  for (const row of [...shareholders.filter((party) => party.isUbo && party.shareholderType !== 'Corporate Entity'), ...manual]) {
    if (!row.fullName?.trim()) continue;
    if (manual.includes(row) && shareholders.some((party) => (row.sourceShareholderId && party.id === row.sourceShareholderId || row.id && party.id === row.id) && (!party.isUbo || party.shareholderType === 'Corporate Entity'))) continue;
    if (result.some((other) => row.id && other.id === row.id ||
      row.sourceShareholderId && other.id === row.sourceShareholderId ||
      (other.fullName?.trim().toLowerCase() === row.fullName?.trim().toLowerCase() &&
       String(other.identityNumber || '').trim() === String(row.identityNumber || '').trim()))) continue;
    result.push(row);
  }
  return result;
}
