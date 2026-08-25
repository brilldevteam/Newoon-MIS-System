import type { ComponentType } from 'react';
import { formatNumber } from '../utils/format';

type StatCardProps = {
  label: string;
  value: number;
  detail?: string;
  trend?: string;
  tone?: 'green' | 'blue' | 'amber' | 'rose' | 'slate';
  icon?: ComponentType<{ className?: string }>;
};

const tones = {
  green: {
    card: 'border-emerald-100 bg-white text-slate-950',
    icon: 'bg-emerald-50 text-emerald-700',
    trend: 'bg-emerald-50 text-emerald-700'
  },
  blue: {
    card: 'border-sky-100 bg-white text-slate-950',
    icon: 'bg-sky-50 text-sky-700',
    trend: 'bg-sky-50 text-sky-700'
  },
  amber: {
    card: 'border-amber-100 bg-white text-slate-950',
    icon: 'bg-amber-50 text-amber-700',
    trend: 'bg-amber-50 text-amber-700'
  },
  rose: {
    card: 'border-rose-100 bg-white text-slate-950',
    icon: 'bg-rose-50 text-rose-700',
    trend: 'bg-rose-50 text-rose-700'
  },
  slate: {
    card: 'border-slate-200 bg-white text-slate-950',
    icon: 'bg-slate-100 text-slate-700',
    trend: 'bg-slate-100 text-slate-700'
  }
};

export function StatCard({ label, value, detail, trend, tone = 'slate', icon: Icon }: StatCardProps) {
  const styles = tones[tone];

  return (
    <div className={`rounded-xl border p-5 shadow-sm shadow-slate-200/60 transition hover:-translate-y-0.5 hover:shadow-md ${styles.card}`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
          <p className="mt-3 text-3xl font-semibold tracking-tight">{formatNumber(value)}</p>
        </div>
        {Icon ? (
          <span className={`inline-flex h-10 w-10 items-center justify-center rounded-xl ${styles.icon}`}>
            <Icon className="h-5 w-5" />
          </span>
        ) : null}
      </div>
      <div className="mt-4 flex items-center justify-between gap-3 text-xs">
        <span className="truncate text-slate-500">{detail || 'Current workspace total'}</span>
        {trend ? <span className={`rounded-full px-2 py-1 font-semibold ${styles.trend}`}>{trend}</span> : null}
      </div>
    </div>
  );
}
