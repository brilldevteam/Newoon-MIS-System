import { formatNumber } from '../utils/format';

type StatCardProps = {
  label: string;
  value: number;
  tone?: 'green' | 'blue' | 'amber' | 'rose' | 'slate';
};

const tones = {
  green: 'border-brand-100 bg-brand-50 text-brand-900',
  blue: 'border-sky-100 bg-sky-50 text-sky-950',
  amber: 'border-amber-100 bg-amber-50 text-amber-950',
  rose: 'border-rose-100 bg-rose-50 text-rose-950',
  slate: 'border-slate-200 bg-white text-slate-950'
};

export function StatCard({ label, value, tone = 'slate' }: StatCardProps) {
  return (
    <div className={`rounded-lg border p-5 shadow-sm ${tones[tone]}`}>
      <p className="text-sm font-medium opacity-75">{label}</p>
      <p className="mt-3 text-3xl font-semibold">{formatNumber(value)}</p>
    </div>
  );
}
