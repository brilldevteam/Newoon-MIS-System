type Party = { id?: unknown; fullName?: unknown; parentRowId?: unknown; sourceShareholderId?: unknown };

// Display only: do not alter owner matching, percentages or saved rows.
export function uboDisplayName(owner: Party, shareholders: Party[]) {
  const source = shareholders.find((row) => row.id && (row.id === owner.sourceShareholderId || row.id === owner.id));
  const parentId = owner.parentRowId || source?.parentRowId;
  const name = String(owner.fullName || '').trim();
  if (!parentId) return name;
  const parent = shareholders.find((row) => row.id === parentId);
  const company = String(parent?.fullName || '').trim() || 'Linked shareholder unavailable';
  return `${name} (Through: ${company})`;
}
