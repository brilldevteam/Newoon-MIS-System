import { api } from './api';

export type ManagedUser = {
  id: string; tenantId: string | null; firstName: string; lastName: string; email: string;
  status: 'ACTIVE' | 'INVITED' | 'SUSPENDED'; createdAt: string;
  tenant: { id: string; name: string } | null;
  roles: Array<{ role: { id: string; name: string } }>;
};
export type UserOptions = { roles: Array<{ name: string }>; tenants: Array<{ id: string; name: string }> };
export type UserProfile = { firstName: string; lastName: string; email: string; roles: string[] };
export async function listUsers() { return (await api.get<ManagedUser[]>('/users')).data; }
export async function getUserOptions() { return (await api.get<UserOptions>('/users/options')).data; }
export async function createUser(data: UserProfile & { password: string; tenantId?: string }) { return (await api.post<ManagedUser>('/users', data)).data; }
export async function updateUser(id: string, data: UserProfile & { status: 'ACTIVE' | 'SUSPENDED' }) { return (await api.patch<ManagedUser>(`/users/${id}`, data)).data; }
export async function resetUserPassword(id: string, password: string) { return (await api.post(`/users/${id}/reset-password`, { password })).data; }
