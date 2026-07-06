export type RequestUser = {
  id: string;
  email: string;
  tenantId: string | null;
  roles: string[];
};
