import { api } from './api';

export type AiAssistantMessage = { role: 'user' | 'assistant'; content: string };

export function askAiAssistant(messages: AiAssistantMessage[], currentPath: string) {
  return api.post<{ message: string }>('/ai/assistant', { messages, currentPath }).then((response) => response.data);
}
