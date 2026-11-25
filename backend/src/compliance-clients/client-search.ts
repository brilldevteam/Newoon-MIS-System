import { ClientJurisdiction, DueDiligenceType, Prisma, RiskClassification } from '@prisma/client';
import { RequestUser } from '../common/types/request-user.type';
import { clientAccessLevel } from './client-access';
import { ROLE_LABELS, ROLE_TYPES } from './client-records';

function calendarDate(value: string) {
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  const local = /^(\d{2})[/-](\d{2})[/-](\d{4})$/.exec(value);
  if (!iso && !local) return null;
  const [year, month, day] = iso ? [+iso[1], +iso[2], +iso[3]] : [+local![3], +local![2], +local![1]];
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day ? date : null;
}

// Search only client-page data the actor can see. This predicate is always ANDed with the register's
// existing tenant/allocation/status filters. Never search raw KYC JSON, review comments or file paths.
export function clientPersonSearchWhere(user: RequestUser, search: string): Prisma.ClientPersonWhereInput {
  const level = clientAccessLevel(user);
  const scope = user.roles.includes('SUPER_ADMIN') ? {} : { tenantId: user.tenantId || '' };
  const visibleRoles: Prisma.ClientPersonRoleWhereInput = level === 'FULL' ? scope : { ...scope, role: { not: 'UBO' } };
  const visiblePerson: Prisma.ClientPersonWhereInput = { ...scope, archivedAt: null, roles: { some: visibleRoles } };
  const terms = [...new Set(search.trim().slice(0, 120).split(/\s+/).filter(Boolean))];
  const predicates = terms.map((term): Prisma.ClientPersonWhereInput => {
    const text = { contains: term, mode: 'insensitive' as const };
    const date = calendarDate(term);
    const roleTerm = term.toLowerCase().replace(/authorized/g, 'authorised');
    const roles = ROLE_TYPES.filter(role => (level === 'FULL' || role !== 'UBO') && `${role.replace(/_/g, ' ')} ${ROLE_LABELS[role]}`.toLowerCase().includes(roleTerm));
    const roleMatch: Prisma.ClientPersonRoleWhereInput = {
      AND: [visibleRoles, { OR: [{ title: text }, ...(roles.length ? [{ role: { in: roles } }] : [])] }]
    };
    const personFields: Prisma.ClientPersonWhereInput[] = [
      { fullName: text }, { title: text }, { nationality: text }, { otherNationality: text },
      { address: text }, { telephone: text }, { email: text }, { representedEntity: text },
      { qidNumber: text }, { registrationNumber: text }, { linkedClientName: text },
      { roles: { some: roleMatch } }
    ];
    if (level !== 'ALLOCATED') {
      personFields.push({ legacyIdentity: text }, { passports: { some: { ...scope, OR: [{ passportNumber: text }, { issuingCountry: text }] } } });
    }
    // PEP information is not used as a search oracle for roles without AML access.
    if (level === 'FULL') personFields.push({ pepDetails: text });
    if (date) {
      personFields.push({ dateOfBirth: date }, { qidExpiry: date }, { nationalAddressExpiry: date });
      if (level !== 'ALLOCATED') personFields.push({ passports: { some: { ...scope, expiryDate: date } } });
    }
    return { OR: personFields };
  });
  return { AND: [visiblePerson, ...predicates] };
}

export function clientSearchWhere(user: RequestUser, search: string): Prisma.ClientWhereInput {
  const level = clientAccessLevel(user);
  const scope = user.roles.includes('SUPER_ADMIN') ? {} : { tenantId: user.tenantId || '' };
  const visibleRoles: Prisma.ClientPersonRoleWhereInput = level === 'FULL' ? scope : { ...scope, role: { not: 'UBO' } };
  const visiblePerson: Prisma.ClientPersonWhereInput = { ...scope, archivedAt: null, roles: { some: visibleRoles } };
  const terms = [...new Set(search.trim().slice(0, 120).split(/\s+/).filter(Boolean))];
  const predicates = terms.map((term): Prisma.ClientWhereInput => {
    const text = { contains: term, mode: 'insensitive' as const };
    const date = calendarDate(term);
    const or: Prisma.ClientWhereInput[] = [
      { name: text }, { clientCode: text }, { registrationNumber: text }, { email: text },
      { phone: text }, { address: text }, { country: text }, { industry: text }, { statusReason: text }, { status: text },
      { entityProfile: { is: { ...scope, OR: [
        { legalName: text }, { legalForm: text }, { commercialRegistrationNo: text }, { countryOfIncorporation: text },
        { placeOfIncorporation: text }, { registeredOfficeAddress: text }, { shareCapital: text },
        { taxIdentificationNo: text }, { poBox: text }, { telephone: text }, { email: text }, { website: text },
        { businessNature: text }, { relatedIndustry: text }, { licenseActivities: text },
        { prospectiveServices: text }, { financialYearEnd: text }, { auditorName: text },
        ...(date ? [{ dateOfIncorporation: date }, { crExpiryDate: date }] : [])
      ] } } },
      { contacts: { some: { ...scope, OR: [{ name: text }, { email: text }, { phone: text }, { position: text }] } } },
      { engagements: { some: { ...scope, OR: [{ engagementNumber: text }, { serviceName: text }, { description: text }] } } },
      { people: { some: clientPersonSearchWhere(user, term) } }
    ];
    const jurisdictions = Object.values(ClientJurisdiction).filter(value => value.toLowerCase().includes(term.toLowerCase()));
    if (jurisdictions.length) or.push({ jurisdiction: { in: jurisdictions } });
    if (level !== 'ALLOCATED') {
      const risks = Object.values(RiskClassification).filter(value => value.toLowerCase().includes(term.toLowerCase()));
      const cdd = Object.values(DueDiligenceType).filter(value => `${value} ${{ SIMPLIFIED: 'SDD', REGULAR: 'RDD', ENHANCED: 'EDD' }[value]}`.toLowerCase().includes(term.toLowerCase()));
      if (risks.length) or.push({ riskLevel: { in: risks } });
      if (cdd.length) or.push({ cddType: { in: cdd } });
      if (date) or.push({ lastReviewDate: date }, { nextReviewDate: date });
    }
    if (level !== 'ALLOCATED') or.push({ kycCases: { some: { ...scope, kycNumber: text } } });
    // Legal register metadata only, not binary file contents or hidden passport copies.
    or.push({ legalDocuments: { some: { ...scope, status: 'CURRENT', ...(level === 'ALLOCATED' ? { typeKey: { not: 'PASSPORT' } } : {}),
      AND: [
        { OR: [{ personId: null }, { person: { is: visiblePerson } }] },
        { OR: [{ typeLabel: text }, { documentNumber: text }, { holderName: text }, { location: text }, { notes: text }, { fileName: text }, ...(date ? [{ issueDate: date }, { expiryDate: date }] : [])] }
      ]
    } } });
    if (level !== 'ALLOCATED') or.push({ documents: { some: {
      ...scope, deletedAt: null,
      AND: [
        { OR: [{ personId: null, identityType: null }, { person: { is: visiblePerson } }] },
        ...(level === 'FULL' ? [] : [{ OR: [{ section: { is: { category: 'COMPLIANCE' as const } } }, { identityType: { in: ['QID', 'PASSPORT'] }, person: { is: visiblePerson } }] }]),
        { OR: [{ title: text }, { fileName: text }, { notes: text }, { personName: text }, { documentNumber: text }] }
      ]
    } } });
    return { OR: or };
  });
  return predicates.length === 1 ? predicates[0] : { AND: predicates };
}
