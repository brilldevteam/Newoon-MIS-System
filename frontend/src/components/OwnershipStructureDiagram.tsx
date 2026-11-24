import { useEffect, useRef, useState } from 'react';
type Row = Record<string, any>;

export function OwnershipStructureDiagram({ rootName, rows, ubos, fit = false }: { rootName: string; rows: Row[]; ubos: Row[]; fit?: boolean }) {
  const viewport = useRef<HTMLDivElement>(null); const [width, setWidth] = useState(0);
  useEffect(() => {
    if (!fit || !viewport.current) return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(viewport.current); return () => observer.disconnect();
  }, [fit]);
  const hasRows = rows.length > 0;
  const uboIds = new Set([
    ...rows.filter((row) => row.isUbo).map((row, index) => row.id || String(index)),
    ...ubos.map((row) => String(row.identityNumber || row.fullName || ''))
  ]);
  const linkedUbos = ubos.filter((row) => row.parentRowId && !rows.some((party) => party.id === row.id || party.fullName === row.fullName && party.identityNumber === row.identityNumber));
  const normalizedRows: Row[] = [...rows, ...linkedUbos.map<Row>((row) => ({ ...row, isUbo: true, shareholderType: 'Individual' }))].map((row, index) => ({ ...row, id: row.id || `ownership-${index + 1}` }));
  const childrenByParent = new Map<string, Row[]>();
  normalizedRows.forEach((row) => {
    const parent = row.parentRowId || 'ROOT';
    childrenByParent.set(parent, [...(childrenByParent.get(parent) || []), row]);
  });
  type DiagramNode = Row & { id: string; parentId: string; depth: number; x: number };
  const diagramNodes: DiagramNode[] = [{ id: 'ROOT', parentId: '', depth: 0, x: 0.5, fullName: rootName || 'Client company', shareholderType: 'Client company' } as DiagramNode];
  let leafIndex = 0;
  let maxDepth = 0;
  const walk = (parentId: string, depth: number): number => {
    const children = childrenByParent.get(parentId) || [];
    if (!children.length) return leafIndex++;
    const childXs = children.map((row) => {
      const childX = walk(row.id, depth + 1);
      diagramNodes.push({ ...(row as Row), id: String(row.id), parentId, depth, x: childX } as DiagramNode);
      maxDepth = Math.max(maxDepth, depth);
      return childX;
    });
    return childXs.reduce((sum, value) => sum + value, 0) / childXs.length;
  };
  const rootX = walk('ROOT', 1);
  const leafCount = Math.max(1, leafIndex);
  diagramNodes.forEach((node) => {
    node.x = ((node.id === 'ROOT' ? rootX : node.x) + 0.5) / leafCount;
  });
  const layerColors = ['bg-slate-950 text-white', 'bg-blue-50 text-slate-950 border-blue-300', 'bg-green-50 text-slate-950 border-green-300', 'bg-amber-50 text-slate-950 border-amber-300', 'bg-purple-50 text-slate-950 border-purple-300', 'bg-red-50 text-slate-950 border-red-300', 'bg-cyan-50 text-slate-950 border-cyan-300'];
  const layerCount = Math.max(1, maxDepth + 1);
  const diagramWidth = Math.max(920, leafCount * 250 + 170);
  const rowHeight = 128;
  const nodeWidth = 220;
  const nodeHeight = 92;
  const diagramHeight = 84 + layerCount * rowHeight;
  const scale = fit && width ? Math.min(1, Math.max(0.1, (width - 24) / diagramWidth)) : 1;
  const leftRail = 122;
  const topOffset = 62;
  const usableWidth = diagramWidth - leftRail - 55;
  const nodeCenterX = (node: DiagramNode) => leftRail + 30 + node.x * usableWidth;
  const nodeTop = (node: DiagramNode) => topOffset + node.depth * rowHeight;
  const nodeDetail = (node: DiagramNode) => {
    if (node.id === 'ROOT') return 'Layer 0';
    if (Array.isArray(node.nationality)) return node.nationality.join(', ');
    return node.nationality || node.residenceAddress || '';
  };

  return (
    <section data-ownership-diagram="true" className="rounded-md border border-slate-200 bg-slate-50 p-3">
      <p className="text-sm font-semibold text-slate-950">Control Structure</p>
      {!hasRows ? (
        <p className="mt-3 rounded-md border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-500">No control structure generated.</p>
      ) : (
        <div ref={viewport} className="mt-3 overflow-x-auto rounded-md border border-slate-400 bg-white p-3">
          <div className="relative mx-auto" style={{ width: diagramWidth * scale, height: diagramHeight * scale }}><div className="absolute left-0 top-0" style={{ width: diagramWidth, height: diagramHeight, transform: `scale(${scale})`, transformOrigin: 'top left' }}>
            <h4 className="absolute left-0 right-0 top-3 text-center text-lg font-bold uppercase tracking-wide text-slate-950">
              {rootName || 'Client company'} - Control Structure
            </h4>
            {Array.from({ length: layerCount }).map((_, depth) => (
              <div
                key={depth}
                className={`absolute left-3 flex h-12 w-24 items-center justify-center rounded-md border text-sm font-bold shadow-sm ${layerColors[depth] || 'border-slate-300 bg-slate-50 text-slate-950'}`}
                style={{ top: topOffset + depth * rowHeight + 12 }}
              >
                Layer {depth}
              </div>
            ))}
            <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox={`0 0 ${diagramWidth} ${diagramHeight}`} preserveAspectRatio="none">
              {diagramNodes.filter((node) => node.parentId).map((node) => {
                const parent = diagramNodes.find((candidate) => candidate.id === node.parentId);
                if (!parent) return null;
                const x1 = nodeCenterX(parent);
                const y1 = nodeTop(parent) + nodeHeight;
                const x2 = nodeCenterX(node);
                const y2 = nodeTop(node);
                const elbowY = (y1 + y2) / 2;
                return (
                  <g key={`${node.parentId}-${node.id}`}>
                    <path d={`M ${x1} ${y1} V ${elbowY} H ${x2} V ${y2}`} fill="none" stroke="#111827" strokeWidth="2" />
                    <path d={`M ${x2 - 5} ${y2 - 8} L ${x2} ${y2} L ${x2 + 5} ${y2 - 8}`} fill="none" stroke="#111827" strokeWidth="2" />
                    <text x={x2 + 8} y={Math.max(y2 - 12, elbowY - 4)} className="fill-slate-950 text-[13px] font-bold">
                      {(node.shareholderPercentage ?? node.ownershipPercentage) ? `${node.shareholderPercentage ?? node.ownershipPercentage}%` : ''}
                    </text>
                  </g>
                );
              })}
            </svg>
            {diagramNodes.map((node) => {
              const isRoot = node.id === 'ROOT';
              const isUbo = Boolean(node.isUbo) || uboIds.has(String(node.identityNumber || node.fullName || ''));
              const top = nodeTop(node);
              const left = nodeCenterX(node) - nodeWidth / 2;
              return (
                <div
                  key={node.id}
                  className={`absolute flex flex-col items-center justify-center rounded-md border px-8 py-2 text-center text-xs shadow-sm ${isRoot ? 'border-slate-950 bg-slate-950 text-white' : layerColors[node.depth] || 'border-slate-300 bg-white text-slate-950'}`}
                  style={{ width: nodeWidth, height: nodeHeight, left, top }}
                >
                  <p className="line-clamp-2 min-h-[28px] font-bold uppercase leading-tight">{node.fullName || 'Unnamed party'}</p>
                  <p className={`mt-1 leading-tight ${isRoot ? 'text-slate-200' : 'text-slate-600'}`}>{node.shareholderType || 'Individual'}</p>
                  <p className={`mt-0.5 line-clamp-1 leading-tight ${isRoot ? 'text-slate-200' : 'text-slate-600'}`}>{nodeDetail(node)}</p>
                  {isUbo ? <span className="absolute right-2 top-2 rounded-full bg-cyan-100 px-2 py-0.5 text-[10px] font-bold leading-none text-cyan-800">Beneficial</span> : null}
                </div>
              );
            })}
          </div></div>
        </div>
      )}
    </section>
  );
}
