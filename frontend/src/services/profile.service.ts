import { api } from './api';
export type SelfProfile = { firstName: string; lastName: string; email: string; roles: { role: { name: string } }[]; profile: { bio: string; avatarDataUrl: string | null } | null };
export async function getSelfProfile() { return (await api.get<SelfProfile>('/auth/profile')).data; }
export async function saveSelfProfile(data: { firstName: string; lastName: string; bio: string; avatarDataUrl: string | null }) { return (await api.patch<SelfProfile>('/auth/profile', data)).data; }
