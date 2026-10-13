export type FormChange = { path: string; before: unknown; after: unknown; kind: 'added' | 'removed' | 'changed' };
const ignored = new Set(['id', 'tenantId', 'kycCaseId', 'kycFormId', 'createdAt', 'updatedAt', 'createdBy', 'updatedBy', 'sourceShareholderId', 'storagePath', 'preliminaryKyc']);
const object = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};

export function compareKycForms(before: Record<string, unknown>, after: Record<string, unknown>): FormChange[] {
  const changes: FormChange[] = [];
  const visit = (left: unknown, right: unknown, path: string) => {
    if (Array.isArray(left) || Array.isArray(right)) {
      const a = Array.isArray(left) ? left : [], b = Array.isArray(right) ? right : [];
      if (![...a, ...b].some((item) => item && typeof item === 'object')) {
        if (JSON.stringify([...a].sort()) !== JSON.stringify([...b].sort())) changes.push({ path, before: a, after: b, kind: 'changed' });
        return;
      }
      const used = new Set<number>();
      a.forEach((item, index) => {
        const row = object(item);
        let match = -1;
        for (const key of ['id', 'identityNumber', 'fullName', 'documentType', 'fileName']) {
          if (!row[key]) continue;
          match = b.findIndex((other, candidate) => !used.has(candidate) && row[key] === object(other)[key]);
          if (match >= 0) break;
        }
        const label = String(row.fullName || row.documentType || `Row ${index + 1}`);
        if (match < 0) changes.push({ path: `${path} / ${label}`, before: item, after: null, kind: 'removed' });
        else { used.add(match); visit(item, b[match], `${path} / ${label}`); }
      });
      b.forEach((item, index) => { if (!used.has(index)) { const row = object(item); changes.push({ path: `${path} / ${String(row.fullName || row.documentType || `Row ${index + 1}`)}`, before: null, after: item, kind: 'added' }); } });
      return;
    }
    if ((left && typeof left === 'object') || (right && typeof right === 'object')) {
      const a = object(left), b = object(right);
      for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) if (!ignored.has(key)) visit(a[key], b[key], `${path} / ${key}`);
      return;
    }
    if ((left ?? '') !== (right ?? '')) changes.push({ path, before: left, after: right, kind: left === undefined || left === null || left === '' ? 'added' : right === undefined || right === null || right === '' ? 'removed' : 'changed' });
  };
  const preliminary = before.preliminaryDocument && after.preliminaryDocument;
  if (preliminary) visit(before.preliminaryDocument, after.preliminaryDocument, 'Preliminary KYC');
  else for (const section of ['sectionA', 'sectionB', 'sectionC', 'sectionD', 'sectionE', 'sectionF', 'sectionG']) {
    visit(before[section], after[section], section);
  }
  return changes;
}
