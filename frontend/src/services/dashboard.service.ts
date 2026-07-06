import { api } from './api';

export type DashboardSummary = {
  totalTenants: number;
  totalClients: number;
  pendingKyc: number;
  pendingApprovals: number;
  enabledModules: number;
};

export async function getDashboardSummary() {
  const response = await api.get<DashboardSummary>('/dashboard/summary');
  return response.data;
}
