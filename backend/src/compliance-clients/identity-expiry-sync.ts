import { Prisma } from '@prisma/client';
import { IdentityExpiry } from './compliance-client-profile';

// Keeps the client's Expiry records in step with the QID / passport expiry dates on its profile. Records created
// here carry a sourceKey; manual Expiry records (sourceKey null) are never touched. A person's document that is no
// longer on the profile is deactivated, not deleted. The compliance reminder sweep then notifies at 60 and 30 days
// and on expiry; a new expiry date starts a new set of reminders because the milestone includes the date.
export async function syncIdentityExpiryItems(
  tx: Prisma.TransactionClient,
  client: { id: string; tenantId: string },
  userId: string,
  documents: IdentityExpiry[]
) {
  const existing = await tx.clientExpiryItem.findMany({
    where: { clientId: client.id, tenantId: client.tenantId, sourceKey: { not: null } }
  });
  const summary = { created: 0, updated: 0, deactivated: 0 };

  for (const document of documents) {
    const expiryDate = new Date(`${document.expiryDate.slice(0, 10)}T00:00:00.000Z`);
    const data = {
      documentType: document.documentType,
      holderName: document.holderName.slice(0, 200),
      holderRole: document.holderRole.slice(0, 200),
      documentNumber: document.documentNumber,
      expiryDate,
      isActive: true
    };
    const current = existing.find((item) => item.sourceKey === document.sourceKey);
    if (!current) {
      await tx.clientExpiryItem.create({
        data: {
          ...data,
          tenantId: client.tenantId,
          clientId: client.id,
          sourceKey: document.sourceKey,
          notes: 'Kept in step with the client profile.',
          createdById: userId
        }
      });
      summary.created += 1;
    } else if (
      current.expiryDate.getTime() !== expiryDate.getTime() || !current.isActive || current.holderName !== data.holderName ||
      current.holderRole !== data.holderRole || current.documentNumber !== data.documentNumber
    ) {
      await tx.clientExpiryItem.update({ where: { id: current.id }, data: { ...data, updatedById: userId } });
      summary.updated += 1;
    }
  }

  const keys = new Set(documents.map((document) => document.sourceKey));
  const stale = existing.filter((item) => item.isActive && !keys.has(item.sourceKey!));
  if (stale.length) {
    await tx.clientExpiryItem.updateMany({ where: { id: { in: stale.map((item) => item.id) } }, data: { isActive: false, updatedById: userId } });
    summary.deactivated = stale.length;
  }

  if (summary.created || summary.updated || summary.deactivated) {
    await tx.auditLog.create({
      data: {
        tenantId: client.tenantId,
        actorId: userId,
        action: 'UPDATE',
        entityType: 'ClientExpiryItem',
        entityId: client.id,
        metadata: { action: 'IDENTITY_EXPIRY_SYNC', clientId: client.id, ...summary } as Prisma.InputJsonValue
      }
    });
  }
  return summary;
}
