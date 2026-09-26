import { api } from './api';

export type DashboardSummary = {
  totalTenants: number;
  totalClients: number;
  openEnquiries: number;
  pendingKyc: number;
  pendingApprovals: number;
  approvedKyc: number;
  enabledModules: number;
};

export async function getDashboardSummary() {
  const response = await api.get<DashboardSummary>('/dashboard/summary');
  return response.data;
}
