import { DueDiligenceType, Prisma, RiskClassification } from '@prisma/client';

// Statuses that make up the compliance register: clients that completed onboarding.
// PROSPECT and REJECTED clients have not been onboarded and stay out of the register.
export const COMPLIANCE_REGISTER_STATUSES = ['ACTIVE', 'INACTIVE', 'ON_HOLD'] as const;

// The register filter. A client whose engagement was put on hold before it was ever activated (no code, never
// activated) is not an onboarded client yet, so it stays out of the register until Operations converts it.
export const COMPLIANCE_REGISTER_WHERE: Prisma.ClientWhereInput = {
  status: { in: [...COMPLIANCE_REGISTER_STATUSES] },
  NOT: { status: 'ON_HOLD', activatedAt: null, clientCode: null }
};

// Periodic review cycle per risk level, in years (agreed 2026-11-09: High 1, Medium 2, Low 3).
export const REVIEW_CYCLE_YEARS: Record<RiskClassification, number> = {
  HIGH: 1,
  MEDIUM: 2,
  LOW: 3
};

export function nextReviewDateFor(risk: RiskClassification | null | undefined, from: Date) {
  if (!risk) return null;
  const next = new Date(from);
  next.setFullYear(next.getFullYear() + REVIEW_CYCLE_YEARS[risk]);
  return next;
}

// Client codes follow the KYC/engagement style: CL-<activation year>-<4 digits>, restarting each year.
// Clients imported from the legacy system keep their old number as CL-LEG-<4 digits> (see legacyClientCode).
export const CLIENT_CODE_PREFIX = 'CL';

export function legacyClientCode(legacyNumber: number) {
  return `${CLIENT_CODE_PREFIX}-LEG-${String(legacyNumber).padStart(4, '0')}`;
}

export async function nextClientCode(tx: Prisma.TransactionClient, tenantId: string, date = new Date()) {
  const prefix = `${CLIENT_CODE_PREFIX}-${date.getFullYear()}-`;
  const latest = await tx.client.findFirst({
    where: { tenantId, clientCode: { startsWith: prefix } },
    orderBy: { clientCode: 'desc' },
    select: { clientCode: true }
  });
  return `${prefix}${String(sequenceAfter(latest?.clientCode, prefix)).padStart(4, '0')}`;
}

export async function nextEngagementNumber(tx: Prisma.TransactionClient, tenantId: string, date = new Date()) {
  const prefix = `ENG-${date.getFullYear()}-`;
  const latest = await tx.clientEngagement.findFirst({
    where: { tenantId, engagementNumber: { startsWith: prefix } },
    orderBy: { engagementNumber: 'desc' },
    select: { engagementNumber: true }
  });
  return `${prefix}${String(sequenceAfter(latest?.engagementNumber, prefix)).padStart(4, '0')}`;
}

// Highest existing number + 1, so a deleted record never causes a number to be issued twice.
// Numbers are zero-padded to 4 digits, so text order matches numeric order up to 9999 per year.
function sequenceAfter(latest: string | null | undefined, prefix: string) {
  const current = latest ? Number.parseInt(latest.slice(prefix.length), 10) : 0;
  return (Number.isFinite(current) ? current : 0) + 1;
}

// Risk and CDD type recorded for a KYC case: an approved reclassification wins over the internal review,
// which wins over the CRRF rating.
export async function onboardingRiskProfile(tx: Prisma.TransactionClient, kycCaseId: string, tenantId: string) {
  const [reclassification, review, crrf] = await Promise.all([
    tx.riskReclassification.findFirst({
      where: { kycCaseId, tenantId },
      orderBy: [{ effectiveDate: 'desc' }, { createdAt: 'desc' }],
      select: { newRisk: true }
    }),
    tx.kycInternalReview.findFirst({ where: { kycCaseId, tenantId }, select: { riskClassification: true, dueDiligenceType: true } }),
    tx.crrfRecord.findFirst({ where: { kycCaseId, tenantId }, select: { riskRating: true } })
  ]);

  const riskLevel: RiskClassification | null =
    reclassification?.newRisk || review?.riskClassification || (crrf?.riskRating ? (crrf.riskRating as RiskClassification) : null);
  const cddType: DueDiligenceType | null = review?.dueDiligenceType || null;
  return { riskLevel, cddType };
}
