// Preliminary KYC ownership chain. Keep in step with backend/src/common/preliminary-ownership-chain.ts.
// A Corporate Entity shareholder row whose parentRowId names another Corporate Entity row is a parent company:
// it owns `ownershipPercentage` % of that company. Rows without a valid parent are direct shareholders of the
// client company. This is the same parentRowId shape the full KYC form uses, so conversion keeps the chain.
type Row = { id?: unknown; shareholderType?: unknown; parentRowId?: unknown; ownershipPercentage?: unknown; fullName?: unknown };

export const CORPORATE_ENTITY = 'Corporate Entity';
const id = (row: Row) => String(row.id || '');
const isCorporate = (row: Row | undefined) => row?.shareholderType === CORPORATE_ENTITY;
// Same leniency as the API's ownershipPercentageValue: "50", "50%" and "50,5" are accepted.
const percent = (value: unknown) => {
  const text = String(value ?? '').trim().replace(/\s*%\s*$/, '').replace(',', '.').trim();
  const number = Number(text);
  return text && Number.isFinite(number) ? number : null;
};

/** The parent company id, or '' when the row is a direct shareholder (missing, non-corporate, self or circular parent). */
export function chainParentId<T extends Row>(row: T, rows: T[]): string {
  const parentId = String(row.parentRowId || '');
  if (!parentId || !isCorporate(row)) return '';
  const byId = new Map(rows.map((item) => [id(item), item]));
  if (!isCorporate(byId.get(parentId))) return '';
  const seen = new Set([id(row)]);
  for (let currentId = parentId; currentId; currentId = String(byId.get(currentId)?.parentRowId || '')) {
    if (seen.has(currentId)) return '';
    seen.add(currentId);
    if (!isCorporate(byId.get(currentId))) break;
  }
  return parentId;
}

export function directShareholders<T extends Row>(rows: T[]): T[] {
  return rows.filter((row) => !chainParentId(row, rows));
}

export function directOwnershipTotal(rows: Row[]): number {
  return directShareholders(rows).reduce((sum, row) => sum + (percent(row.ownershipPercentage) ?? 0), 0);
}

/** Rows in chain order (each direct shareholder followed by its parent companies) with depth and 1 / 1.1 / 1.1.1 numbering. */
export function ownershipChainOrder<T extends Row>(rows: T[]): { row: T; depth: number; number: string; parent?: T }[] {
  const children = new Map<string, T[]>();
  for (const row of rows) {
    const parentId = chainParentId(row, rows);
    children.set(parentId, [...(children.get(parentId) || []), row]);
  }
  const result: { row: T; depth: number; number: string; parent?: T }[] = [];
  const visit = (parentId: string, prefix: string, depth: number, parent?: T) => {
    (children.get(parentId) || []).forEach((row, index) => {
      const number = prefix ? `${prefix}.${index + 1}` : String(index + 1);
      result.push({ row, depth, number, parent });
      if (id(row)) visit(id(row), number, depth + 1, row);
    });
  };
  visit('', '', 0);
  return result;
}

/** Ids of rows that sit above the given company in the chain (its owners at any level) plus the company itself. */
export function ownersAndSelfIds(rowId: string, rows: Row[]): Set<string> {
  const result = new Set<string>(rowId ? [rowId] : []);
  let added = true;
  while (added) {
    added = false;
    for (const row of rows) {
      if (!result.has(id(row)) && result.has(chainParentId(row, rows))) { result.add(id(row)); added = true; }
    }
  }
  return result;
}

/** Fraction (0-1) of the client company held through this company along the chain, or null if a percentage is missing. */
export function interestThroughCompany(companyId: string, rows: Row[]): number | null {
  const byId = new Map(rows.map((row) => [id(row), row]));
  let share = 1;
  const seen = new Set<string>();
  for (let current = byId.get(companyId); current; current = byId.get(chainParentId(current, rows))) {
    if (seen.has(id(current))) return null;
    seen.add(id(current));
    const value = percent(current.ownershipPercentage);
    if (value === null) return null;
    share *= value / 100;
    if (!chainParentId(current, rows)) return share;
  }
  return null;
}

/** Indirect UBO % in the client company for a person owning `ownershipPercentage` % of the given company. */
export function indirectUboPercentage(ownershipPercentage: unknown, companyId: string, rows: Row[]): string {
  const own = percent(ownershipPercentage);
  const through = companyId ? interestThroughCompany(companyId, rows) : null;
  if (own === null || through === null) return '';
  return String(Number((own * through).toFixed(2)));
}

/** Companies whose owners (parent companies plus linked beneficial owners) add up to more than 100%. */
export function overOwnedCompanies(shareholders: Row[], ubos: Row[]): { name: string; total: number }[] {
  const totals = new Map<string, number>();
  for (const row of shareholders) {
    const parentId = chainParentId(row, shareholders);
    if (parentId) totals.set(parentId, (totals.get(parentId) || 0) + (percent(row.ownershipPercentage) ?? 0));
  }
  for (const row of ubos) {
    const parentId = String(row.parentRowId || '');
    if (parentId && shareholders.some((item) => id(item) === parentId && isCorporate(item))) totals.set(parentId, (totals.get(parentId) || 0) + (percent(row.ownershipPercentage) ?? 0));
  }
  return [...totals].filter(([, total]) => total > 100.005).map(([companyId, total]) => ({
    name: String(shareholders.find((row) => id(row) === companyId)?.fullName || '').trim() || 'Unnamed company', total
  }));
}

/** "Client company" for a direct shareholder, otherwise the name of the company this row owns. */
export function shareholderOfLabel(row: Row, rows: Row[], clientLabel = 'Client company'): string {
  const parentId = chainParentId(row, rows);
  if (!parentId) return clientLabel;
  return String(rows.find((item) => id(item) === parentId)?.fullName || '').trim() || 'Unnamed company';
}
