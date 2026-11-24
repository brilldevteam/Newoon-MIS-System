import { FileText, GitFork, Maximize2, Minimize2 } from 'lucide-react';
import { ReactNode, useEffect, useRef, useState } from 'react';

export function DocumentPreviewFrame({ children, structure }: { children: ReactNode; structure: ReactNode }) {
  const root = useRef<HTMLElement>(null); const viewport = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<'document' | 'structure'>('document');
  const [zoom, setZoom] = useState('fit'); const [width, setWidth] = useState(794);
  const [expanded, setExpanded] = useState(false); const [error, setError] = useState('');
  useEffect(() => {
    if (!viewport.current) return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(viewport.current); return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const update = () => setExpanded(document.fullscreenElement === root.current);
    document.addEventListener('fullscreenchange', update);
    return () => document.removeEventListener('fullscreenchange', update);
  }, []);
  const scale = zoom === 'fit' ? Math.min(1, Math.max(0.1, (width - 32) / 794)) : Number(zoom);
  async function expand() {
    try { if (expanded) await document.exitFullscreen(); else await root.current?.requestFullscreen(); }
    catch { setError('Expanded preview is unavailable in this browser.'); }
  }
  return <aside ref={root} aria-label="KYC document preview" className="min-w-0 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm fullscreen:rounded-none">
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-white p-3">
      <div className="flex gap-1 rounded-md bg-slate-100 p-1" aria-label="Preview view">
        <button type="button" aria-pressed={mode === 'document'} onClick={() => setMode('document')} className={`inline-flex items-center gap-1.5 rounded px-2.5 py-1.5 text-xs font-semibold ${mode === 'document' ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-500'}`}><FileText className="h-4 w-4" />Document</button>
        <button type="button" aria-pressed={mode === 'structure'} onClick={() => setMode('structure')} className={`inline-flex items-center gap-1.5 rounded px-2.5 py-1.5 text-xs font-semibold ${mode === 'structure' ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-500'}`}><GitFork className="h-4 w-4" />Structure</button>
      </div>
      <div className="flex items-center gap-2">
        {mode === 'document' && <select aria-label="Document zoom" value={zoom} onChange={(event) => setZoom(event.target.value)} className="h-8 rounded-md border border-slate-200 bg-white px-2 text-xs"><option value="fit">Fit width</option><option value="1">100%</option><option value="1.25">125%</option><option value="1.5">150%</option></select>}
        <button type="button" onClick={expand} title={expanded ? 'Exit expanded preview' : 'Expand preview'} aria-label={expanded ? 'Exit expanded preview' : 'Expand preview'} className="grid h-8 w-8 place-items-center rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50">{expanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}</button>
      </div>
    </div>
    {error && <p role="status" className="px-3 py-2 text-xs text-amber-700">{error}</p>}
    <div ref={viewport} className="overflow-auto bg-slate-200/80" style={{ maxHeight: expanded ? 'calc(100dvh - 64px)' : 'calc(100dvh - 220px)', minHeight: 280 }}>
      {mode === 'document' ? <div className="min-w-max p-4"><div style={{ width: 794, zoom: scale }} className="mx-auto">{children}</div></div> : <div className="p-4">{structure}</div>}
    </div>
  </aside>;
}
