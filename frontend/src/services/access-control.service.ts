import { api } from './api';

export type AccessLevel = 'NONE' | 'VIEW' | 'EDIT';
export type AccessArea = { key: string; label: string; description: string };
export type AccessRole = { name: string; description?: string | null; levels: Record<string, AccessLevel> };
export type AccessMatrix = { configured: boolean; areas: AccessArea[]; roles: AccessRole[] };

export function getAccessMatrix() {
  return api.get<AccessMatrix>('/access-control').then((response) => response.data);
}

export function updateRoleAccess(roleName: string, levels: Record<string, AccessLevel>) {
  return api.put<AccessMatrix>(`/access-control/roles/${roleName}`, { levels }).then((response) => response.data);
}
