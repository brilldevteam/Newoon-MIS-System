import { useId } from 'react';

export type DashboardPoint = { label: string; value: number };
export const dashboardColors = ['#6789be', '#57a69a', '#d6b369', '#b57887', '#8d92b6', '#8c9aab'];

export function monthlyDashboardPoints(dates: string[], months: number, now = new Date()): DashboardPoint[] {
  return Array.from({ length: months }, (_, index) => {
    const start = Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - months + index + 1, 1);
    const end = Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - months + index + 2, 1);
    return {
      label: new Intl.DateTimeFormat('en', { month: 'short', timeZone: 'UTC' }).format(start),
      value: dates.filter(value => { const date = Date.parse(value); return date >= start && date < end && date <= now.getTime(); }).length
    };
  });
}

export function DashboardBarChart({ points, color = '#c73543', label }: { points: DashboardPoint[]; color?: string; label: string }) {
  const maximum = Math.max(4, Math.ceil(Math.max(0, ...points.map(point => point.value)) / 4) * 4);
  return <figure aria-label={label} data-chart="bars" className="min-w-0">
    <div className="overflow-x-auto pb-1">
      <div className="relative pl-8" style={{ minWidth: points.length > 8 ? 440 : undefined }}>
        <div className="pointer-events-none absolute inset-x-0 top-8 h-44" aria-hidden="true">
          {[0, 1, 2, 3, 4].map(tick => <div key={tick} className="absolute left-0 right-0 flex translate-y-1/2 items-center gap-2" style={{ bottom: `${tick * 25}%` }}>
            <span className="w-6 shrink-0 text-right text-[10px] text-slate-400">{maximum * tick / 4}</span><span className="h-px flex-1 bg-slate-100" />
          </div>)}
        </div>
        <div className="relative grid gap-3 pt-8" style={{ gridTemplateColumns: `repeat(${Math.max(1, points.length)}, minmax(0,1fr))` }}>
          {points.map((point, index) => <div key={`${point.label}-${index}`} className="min-w-0">
            <div tabIndex={0} role="img" aria-label={`${point.label}: ${point.value}`} title={`${point.label}: ${point.value}`} data-chart-value={point.value} className="group relative flex h-44 items-end justify-center rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-brand-500">
              <div className="relative w-full max-w-10 rounded-t-sm" style={{ height: point.value ? `${point.value / maximum * 100}%` : 2, backgroundColor: point.value ? color : '#e8edf2' }}>
                <span className="absolute -top-7 left-1/2 -translate-x-1/2 rounded bg-slate-900 px-2 py-1 text-[10px] font-medium text-white opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100">{point.value}</span>
              </div>
            </div>
            <p className="mt-3 min-h-8 break-words text-center text-[11px] leading-4 text-slate-500">{point.label}</p>
          </div>)}
        </div>
      </div>
    </div>
    <figcaption className="sr-only">{points.map(point => `${point.label}: ${point.value}`).join('; ')}</figcaption>
  </figure>;
}

export function DashboardDonut({ points, label, centerLabel }: { points: DashboardPoint[]; label: string; centerLabel: string }) {
  const id = useId();
  const total = points.reduce((sum, point) => sum + point.value, 0);
  const circumference = 2 * Math.PI * 72;
  let offset = 0;
  return <figure aria-label={label} data-chart="donut" className="min-w-0">
    <svg viewBox="0 0 200 200" role="img" aria-labelledby={id} className="mx-auto h-44 w-44">
      <title id={id}>{label}: {total}. {points.map(point => `${point.label}: ${point.value}`).join('; ')}</title>
      <circle cx="100" cy="100" r="72" fill="none" stroke="#e9eef3" strokeWidth="15" />
      {points.map((point, index) => {
        const length = total ? point.value / total * circumference : 0;
        const start = offset; offset += length;
        return <circle key={`${point.label}-${index}`} data-chart-value={point.value} cx="100" cy="100" r="72" fill="none" stroke={dashboardColors[index % dashboardColors.length]} strokeWidth="15" strokeDasharray={`${length} ${circumference}`} strokeDashoffset={-start} transform="rotate(-90 100 100)"><title>{point.label}: {point.value}</title></circle>;
      })}
      <text x="100" y="98" textAnchor="middle" fill="#18212d" fontSize="26" fontWeight="600">{total.toLocaleString()}</text>
      <text x="100" y="120" textAnchor="middle" fill="#7b8798" fontSize="10">{centerLabel}</text>
    </svg>
    <figcaption><ul className="mt-3 space-y-2.5">{points.map((point, index) => <li key={`${point.label}-${index}`} className="flex items-start justify-between gap-3 text-xs"><span className="flex min-w-0 items-start gap-2 text-slate-500"><span aria-hidden="true" className="mt-1 h-2 w-2 shrink-0 rounded-sm" style={{ backgroundColor: dashboardColors[index % dashboardColors.length] }} /><span className="break-words">{point.label}</span></span><span className="font-semibold tabular-nums text-slate-800">{point.value.toLocaleString()}</span></li>)}</ul></figcaption>
  </figure>;
}
