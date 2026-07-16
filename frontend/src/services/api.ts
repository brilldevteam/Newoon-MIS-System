import axios from 'axios';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api'
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
  if (typeof data?.error?.message === 'string') return data.error.message;
  if (Array.isArray(data?.error?.message)) return data.error.message.join(', ');
  if (typeof data?.error === 'string') return data.error;
  return fallback;
}
