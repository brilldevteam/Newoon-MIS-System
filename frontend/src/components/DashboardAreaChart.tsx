import { useEffect, useId, useRef, useState } from 'react';
import { DashboardPoint } from './DashboardCharts';

export function DashboardAreaChart({ points, color, label }: { points: DashboardPoint[]; color: string; label: string }) {
  const root = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(600);
  const [active, setActive] = useState<number | null>(null);
  const id = useId();
  useEffect(() => {
    if (!root.current) return;
    const element = root.current;
    const measure = () => setWidth(Math.max(220, Math.round(element.clientWidth)));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const maximum = Math.max(4, Math.ceil(Math.max(0, ...points.map(point => point.value)) / 4) * 4);
  const chartWidth = Math.max(width, points.length > 8 ? 440 : 0);
  const baseline = 205;
  const plotHeight = 175;
  const coordinates = points.map((point, index) => ({
    x: 32 + index * (chartWidth - 48) / Math.max(1, points.length - 1),
    y: baseline - point.value / maximum * plotHeight
  }));
  const path = coordinates.map((point, index) => `${index ? 'L' : 'M'} ${point.x} ${point.y}`).join(' ');
  const selected = active !== null && active < points.length ? active : null;
  return <figure aria-label={label} data-chart="area" className="min-w-0">
    <div ref={root} className="relative min-w-0 overflow-x-auto" onMouseLeave={() => setActive(null)}>
      <div className="relative" style={{ width: chartWidth }}>
        <svg width={chartWidth} height="240" viewBox={`0 0 ${chartWidth} 240`} role="img" aria-labelledby={`${id}-label`}>
          <title id={`${id}-label`}>{label}</title>
          <desc>{points.map(point => `${point.label}: ${point.value}`).join('; ')}</desc>
          <defs><linearGradient id={`${id}-fill`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity="0.18" /><stop offset="100%" stopColor={color} stopOpacity="0.01" /></linearGradient></defs>
          {[0, 1, 2, 3, 4].map(tick => {
            const y = baseline - tick / 4 * plotHeight;
            return <g key={tick}><line x1="32" x2={chartWidth - 16} y1={y} y2={y} stroke="#e9edf3" strokeDasharray="3 4" /><text x="22" y={y + 3} textAnchor="end" fill="#929ba9" fontSize="10">{maximum * tick / 4}</text></g>;
          })}
          {coordinates.length > 0 && <><path d={`${path} L ${coordinates[coordinates.length - 1].x} ${baseline} L ${coordinates[0].x} ${baseline} Z`} fill={`url(#${id}-fill)`} /><path d={path} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" /></>}
          {selected !== null && <line x1={coordinates[selected].x} x2={coordinates[selected].x} y1="20" y2={baseline} stroke={color} strokeOpacity="0.4" strokeDasharray="4 4" />}
          {points.map((point, index) => <g key={`${point.label}-${index}`} tabIndex={0} role="img" aria-label={`${point.label}: ${point.value}`} data-chart-value={point.value} onMouseEnter={() => setActive(index)} onFocus={() => setActive(index)} onBlur={() => setActive(null)} onClick={() => setActive(index)} className="outline-none">
            <rect x={coordinates[index].x - 12} y="16" width="24" height="196" fill="transparent" />
            <circle cx={coordinates[index].x} cy={coordinates[index].y} r={selected === index ? 5 : 3} fill="white" stroke={color} strokeWidth="2" />
            <text x={coordinates[index].x} y="230" textAnchor="middle" fill="#929ba9" fontSize="10">{point.label}</text>
          </g>)}
        </svg>
        {selected !== null && <div className="dashboard-chart-tooltip" role="status" style={{ left: Math.max(32, Math.min(chartWidth - 144, coordinates[selected].x - 30)), top: Math.max(0, coordinates[selected].y - 65), borderColor: `${color}30` }}><span>{points[selected].label}</span><strong style={{ color }}>{points[selected].value.toLocaleString()} records</strong></div>}
      </div>
    </div>
  </figure>;
}
