import { Prisma } from '@prisma/client';

// The only user fields API responses may embed for authors, actors and creators.
// Never include a User relation with `true`: that would also return passwordHash and account status.
export const userSummarySelect = {
  id: true,
  firstName: true,
  lastName: true,
  email: true
} satisfies Prisma.UserSelect;
