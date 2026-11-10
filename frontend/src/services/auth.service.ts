import { api } from './api';

export type AuthUser = {
  id: string;
  tenantId: string | null;
  email: string;
  firstName: string;
  lastName: string;
  roles: string[];
  permissions?: string[];
  accessControlConfigured?: boolean;
};

export type LoginSession = { accessToken: string; user: AuthUser };

// Returned by step 1 when email sign-in codes are enabled.
export type LoginCodeChallenge = {
  otpRequired: true;
  challengeId: string;
  maskedEmail: string;
  expiresInSeconds: number;
  resendAfterSeconds: number;
};

export function isCodeChallenge(result: LoginSession | LoginCodeChallenge): result is LoginCodeChallenge {
  return 'otpRequired' in result && result.otpRequired === true;
}

export async function login(email: string, password: string) {
  const response = await api.post<LoginSession | LoginCodeChallenge>('/auth/login', {
    email,
    password
  });
  return response.data;
}

export async function verifyLoginCode(challengeId: string, code: string) {
  const response = await api.post<LoginSession>('/auth/login/verify', { challengeId, code });
  return response.data;
}

export async function resendLoginCode(challengeId: string) {
  const response = await api.post<LoginCodeChallenge>('/auth/login/resend', { challengeId });
  return response.data;
}

export async function getCurrentUser() {
  const response = await api.get<AuthUser>('/auth/me');
  return response.data;
}
