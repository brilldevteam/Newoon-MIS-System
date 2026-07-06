import { api } from './api';

export type AuthUser = {
  id: string;
  tenantId: string | null;
  email: string;
  firstName: string;
  lastName: string;
  roles: string[];
};

export async function login(email: string, password: string) {
  const response = await api.post<{ accessToken: string; user: AuthUser }>('/auth/login', {
    email,
    password
  });
  return response.data;
}

export async function getCurrentUser() {
  const response = await api.get<AuthUser>('/auth/me');
  return response.data;
}
