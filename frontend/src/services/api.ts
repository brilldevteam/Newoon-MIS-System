import axios from 'axios';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api'
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('newoon_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export function getApiErrorMessage(error: any, fallback: string) {
  const data = error?.response?.data;
  const message = findErrorMessage(data);
  if (message) return message;
  if (error?.response?.status === 429) return 'AI service is temporarily rate-limited. Wait one minute and try again.';
  return fallback;
}

function findErrorMessage(value: unknown, depth = 0): string {
  if (depth > 5 || value == null) return '';
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.map((item) => findErrorMessage(item, depth + 1)).filter(Boolean).join(', ');
  if (typeof value !== 'object') return '';

  const record = value as Record<string, unknown>;
  for (const key of ['message', 'error', 'detail']) {
    const message = findErrorMessage(record[key], depth + 1);
    if (message && !['Bad Gateway', 'Too Many Requests', 'Internal Server Error'].includes(message)) return message;
  }
  return '';
}
