import { api } from './api';

// The company's AI service for reading documents. The API key is sent once when saved and never returned.
export type AiSettings = {
  provider: 'OPENAI';
  configured: boolean;
  enabled: boolean;
  model: string;
  keyHint: string | null;
  keyReadable: boolean | null;
  updatedAt: string | null;
  serverCanStoreKeys: boolean;
};

export function getAiSettings() {
  return api.get<AiSettings>('/ai-settings').then((response) => response.data);
}

export function saveAiSettings(payload: { apiKey?: string; model?: string; enabled?: boolean }) {
  return api.put<AiSettings>('/ai-settings', payload).then((response) => response.data);
}

export function testAiSettings() {
  return api.post<{ ok: boolean; message: string }>('/ai-settings/test', {}, { timeout: 30000 }).then((response) => response.data);
}

export function removeAiSettings() {
  return api.post<AiSettings>('/ai-settings/remove', {}).then((response) => response.data);
}
