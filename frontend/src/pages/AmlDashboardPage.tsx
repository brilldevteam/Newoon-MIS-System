import { ShieldCheck } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AmlNotification, getAmlNotifications } from '../services/kyc-workflow.service';
import { kycStatusLabel } from '../utils/kyc-status-labels';

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

export function AmlDashboardPage() {
  const [notifications, setNotifications] = useState<AmlNotification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAmlNotifications()
      .then(setNotifications)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-950">AML Dashboard</h1>
        <p className="mt-1 text-sm text-slate-500">Submitted client files waiting for AML KYC review.</p>
      </div>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Pending Notifications</p>
          <p className="mt-2 text-2xl font-semibold text-slate-950">{notifications.length}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Dashboard Scope</p>
          <p className="mt-2 text-sm font-medium text-slate-950">Initial intake handoff</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Next Module</p>
          <p className="mt-2 text-sm font-medium text-slate-950">Full KYC Part 1 later</p>
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white">
        <div className="flex items-center gap-2 border-b border-slate-200 px-5 py-4">
          <ShieldCheck className="h-4 w-4 text-brand-700" />
          <h2 className="text-base font-semibold text-slate-950">Cases Ready for AML</h2>
        </div>
        <div className="divide-y divide-slate-100">
          {loading ? (
            <p className="px-5 py-6 text-sm text-slate-500">Loading AML notifications...</p>
          ) : notifications.length ? (
            notifications.map((notification) => (
              <Link
                key={notification.id}
                to={notification.kycCase ? `/kyc/${notification.kycCase.id}` : '/aml'}
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
            <p className="px-5 py-6 text-sm text-slate-500">No submitted KYC cases are waiting for AML right now.</p>
          )}
        </div>
      </section>
    </div>
  );
}
