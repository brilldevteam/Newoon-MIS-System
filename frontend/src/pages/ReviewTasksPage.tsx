import { Bell, ListChecks } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AmlNotification, getMyReviewTasks, ReviewTask, ReviewTaskDashboard } from '../services/kyc-workflow.service';
import { kycStatusLabel } from '../utils/kyc-status-labels';

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

function stageLabel(stage: string) {
  const labels: Record<string, string> = {
    SUPERVISOR: 'AML Supervisor',
    DMLRO: 'DMLRO',
    MLRO: 'MLRO'
  };
  return labels[stage] || stage;
}

function caseSubtitle(taskOrNotification: { kycCase?: ReviewTask['kycCase'] | AmlNotification['kycCase'] }) {
  const kycCase = taskOrNotification.kycCase;
  if (!kycCase) return 'No linked KYC case';
  return `${kycCase.client.name} | ${kycCase.service?.name || 'Service not selected'}`;
}

function reviewLink(caseId?: string) {
  return caseId ? `/kyc/${caseId}/form` : '/review-tasks';
}

export function ReviewTasksPage() {
  const [dashboard, setDashboard] = useState<ReviewTaskDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    getMyReviewTasks()
      .then(setDashboard)
      .catch((requestError: any) => {
        const message = requestError.response?.data?.message;
        setError(typeof message === 'string' ? message : 'Unable to load review tasks.');
      })
      .finally(() => setLoading(false));
  }, []);

  const tasks = dashboard?.tasks || [];
  const notifications = dashboard?.notifications || [];
  const stages = dashboard?.stages || [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-950">My Review Tasks</h1>
        <p className="mt-1 text-sm text-slate-500">Cases and notifications waiting for the current login role.</p>
      </div>

      {error ? <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Pending Tasks</p>
          <p className="mt-2 text-2xl font-semibold text-slate-950">{tasks.length}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Unread Notifications</p>
          <p className="mt-2 text-2xl font-semibold text-slate-950">{notifications.length}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Review Scope</p>
          <p className="mt-2 text-sm font-medium text-slate-950">{stages.length ? stages.map(stageLabel).join(', ') : 'No review stage assigned'}</p>
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white">
        <div className="flex items-center gap-2 border-b border-slate-200 px-5 py-4">
          <ListChecks className="h-4 w-4 text-brand-700" />
          <h2 className="text-base font-semibold text-slate-950">Review Queue</h2>
        </div>
        <div className="divide-y divide-slate-100">
          {loading ? (
            <p className="px-5 py-6 text-sm text-slate-500">Loading review tasks...</p>
          ) : tasks.length ? (
            tasks.map((task) => (
              <Link key={task.id} to={reviewLink(task.kycCase.id)} className="block px-5 py-4 hover:bg-slate-50">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-medium text-slate-950">{task.kycCase.title}</p>
                    <p className="text-sm text-slate-500">{caseSubtitle(task)}</p>
                    <p className="mt-1 text-xs text-slate-500">Assigned {formatDate(task.createdAt)}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <span className="w-fit rounded-full bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-700">{stageLabel(task.stage)}</span>
                    <span className="w-fit rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">{task.status.replace(/_/g, ' ')}</span>
                    <span className="w-fit rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                      {kycStatusLabel(task.kycCase.status)}
                    </span>
                  </div>
                </div>
              </Link>
            ))
          ) : (
            <p className="px-5 py-6 text-sm text-slate-500">No pending review tasks for this login.</p>
          )}
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white">
        <div className="flex items-center gap-2 border-b border-slate-200 px-5 py-4">
          <Bell className="h-4 w-4 text-brand-700" />
          <h2 className="text-base font-semibold text-slate-950">Role Notifications</h2>
        </div>
        <div className="divide-y divide-slate-100">
          {loading ? (
            <p className="px-5 py-6 text-sm text-slate-500">Loading notifications...</p>
          ) : notifications.length ? (
            notifications.map((notification) => (
              <Link
                key={notification.id}
                to={reviewLink(notification.kycCase?.id)}
                className="block px-5 py-4 hover:bg-slate-50"
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-medium text-slate-950">{notification.title}</p>
                    <p className="text-sm text-slate-500">{notification.message}</p>
                    <p className="mt-1 text-xs text-slate-500">{formatDate(notification.createdAt)}</p>
                  </div>
                  {notification.kycCase ? (
                    <span className="w-fit rounded-full bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-700">
                      {kycStatusLabel(notification.kycCase.status)}
                    </span>
                  ) : null}
                </div>
              </Link>
            ))
          ) : (
            <p className="px-5 py-6 text-sm text-slate-500">No unread role notifications.</p>
          )}
        </div>
      </section>
    </div>
  );
}
