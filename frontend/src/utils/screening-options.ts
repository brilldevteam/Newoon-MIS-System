import type { ScreeningEntityOption, ScreeningRecord } from '../services/kyc-workflow.service';

export function remainingScreeningEntities(entities: ScreeningEntityOption[], records: ScreeningRecord[]): ScreeningEntityOption[] {
  const normalized = (value: string | null | undefined) => (value || '').trim().toLowerCase();
  return entities.filter((entity) => !records.some((record) => {
    if (record.status !== 'COMPLETED') return false;
    if (record.entitySourceId && record.entitySourceId !== entity.sourceId) return false;
    if (normalized(entity.identifier)) return normalized(entity.identifier) === normalized(record.identifier);
    return normalized(entity.name) === normalized(record.entityName);
  }));
}
