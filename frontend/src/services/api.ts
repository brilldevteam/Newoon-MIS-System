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
  if (typeof data === 'string') return data;
  if (typeof data?.message === 'string') return data.message;
  if (Array.isArray(data?.message)) return data.message.join(', ');
  // The API exception filter wraps Nest exception responses in `error`.
  // Read the nested message so users receive a useful action instead of a generic failure.
  if (typeof data?.error?.message?.message === 'string') return data.error.message.message;
  if (Array.isArray(data?.error?.message?.message)) return data.error.message.message.join(', ');
  if (typeof data?.error?.message === 'string') return data.error.message;
  if (Array.isArray(data?.error?.message)) return data.error.message.join(', ');
  if (typeof data?.error === 'string') return data.error;
  return fallback;
}
