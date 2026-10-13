type Party = Record<string, unknown>;
export function beneficialOwners(shareholders: Party[], manual: Party[]): Party[] {
  const result: Party[] = [];
  for (const row of [...shareholders.filter((party) => party.isUbo && party.shareholderType !== 'Corporate Entity'), ...manual]) {
    const name = String(row.fullName || '').trim().toLowerCase();
    if (!name) continue;
    if (manual.includes(row) && shareholders.some((party) => (row.sourceShareholderId && party.id === row.sourceShareholderId || row.id && party.id === row.id) && (!party.isUbo || party.shareholderType === 'Corporate Entity'))) continue;
    if (result.some((other) => row.id && row.id === other.id ||
      row.sourceShareholderId && row.sourceShareholderId === other.id ||
      String(other.fullName || '').trim().toLowerCase() === name &&
      String(other.identityNumber || '').trim() === String(row.identityNumber || '').trim())) continue;
    result.push(row);
  }
  return result;
}
