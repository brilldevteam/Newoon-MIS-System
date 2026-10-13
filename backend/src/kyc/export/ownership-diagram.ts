import { createCanvas } from '@napi-rs/canvas';
import { ARABIC_FONT_FAMILY, ARIAL_FONT_FAMILY, KycImage, registerCanvasFonts } from './kyc-export-assets';
import { hasArabic } from './kyc-export-format';

export type OwnershipParty = {
  id: string;
  parentId: string;
  name: string;
  type: string;
  percentage: string;
  detail: string;
  isBeneficial: boolean;
};

export type OwnershipDiagram = {
  svg: string;
  png: KycImage;
  // Display size in points, already fitted to the available area.
  widthPt: number;
  heightPt: number;
  // True when the structure had to be shrunk so far that the tables are the readable reference.
  condensed: boolean;
};

type Shape =
  | { kind: 'rect'; x: number; y: number; w: number; h: number; r: number; fill: string; stroke: string; strokeWidth: number }
  | { kind: 'path'; points: Array<[number, number]>; stroke: string; strokeWidth: number }
  | { kind: 'text'; x: number; y: number; value: string; size: number; bold: boolean; color: string; anchor: 'start' | 'middle' };

type Layer = { fill: string; border: string; ink: string; muted: string };
type Node = {
  id: string;
  parentId: string;
  name: string;
  type: string;
  detail: string;
  percentage: string;
  isBeneficial: boolean;
  isRoot: boolean;
  depth: number;
  children: Node[];
  lines: { value: string; size: number; bold: boolean; color: string }[];
  w: number;
  h: number;
  x: number;
  y: number;
};

// Same palette as the in-app live preview (Tailwind slate/blue/green/amber/purple/red/cyan by layer).
const LAYERS: Layer[] = [
  { fill: '#020617', border: '#020617', ink: '#FFFFFF', muted: '#E2E8F0' },
  { fill: '#EFF6FF', border: '#93C5FD', ink: '#020617', muted: '#475569' },
  { fill: '#F0FDF4', border: '#86EFAC', ink: '#020617', muted: '#475569' },
  { fill: '#FFFBEB', border: '#FCD34D', ink: '#020617', muted: '#475569' },
  { fill: '#FAF5FF', border: '#D8B4FE', ink: '#020617', muted: '#475569' },
  { fill: '#FEF2F2', border: '#FCA5A5', ink: '#020617', muted: '#475569' },
  { fill: '#ECFEFF', border: '#67E8F9', ink: '#020617', muted: '#475569' }
];
const FALLBACK_LAYER: Layer = { fill: '#FFFFFF', border: '#CBD5E1', ink: '#020617', muted: '#475569' };
const LINE = '#111827';

const PAD = 6;
const NAME_SIZE = 7;
const SUB_SIZE = 6.3;
const LINE_GAP = 1.28;
const TITLE_SIZE = 9;
const RAIL = 58;
const TITLE_SPACE = 26;

const fontStack = `${ARIAL_FONT_FAMILY}, ${ARABIC_FONT_FAMILY}, Arial, sans-serif`;
const layer = (depth: number) => LAYERS[depth] || FALLBACK_LAYER;
const measureContext = () => {
  registerCanvasFonts();
  return createCanvas(10, 10).getContext('2d');
};

function wrap(context: ReturnType<typeof measureContext>, value: string, size: number, bold: boolean, maxWidth: number) {
  context.font = `${bold ? 'bold ' : ''}${size}px ${fontStack}`;
  const lines: string[] = [];
  let line = '';
  for (const word of value.split(/\s+/).filter(Boolean)) {
    const candidate = line ? `${line} ${word}` : word;
    if (context.measureText(candidate).width <= maxWidth) {
      line = candidate;
      continue;
    }
    if (line) lines.push(line);
    // Break identifiers that are wider than the box instead of letting them overflow.
    line = '';
    for (const character of word) {
      if (line && context.measureText(line + character).width > maxWidth) {
        lines.push(line);
        line = '';
      }
      line += character;
    }
  }
  if (line) lines.push(line);
  return lines.length ? lines : ['-'];
}

function buildTree(rootName: string, parties: OwnershipParty[]) {
  const blank = { lines: [], w: 0, h: 0, x: 0, y: 0, depth: 0 };
  const root: Node = { ...blank, children: [], id: '__ROOT__', parentId: '', name: rootName, type: 'Client company', detail: 'Layer 0', percentage: '', isBeneficial: false, isRoot: true };
  const nodes = new Map<string, Node>();
  parties.forEach((party, index) => {
    const id = party.id || `party-${index + 1}`;
    nodes.set(id, { ...blank, children: [], id, parentId: party.parentId, name: party.name || 'Unnamed party', type: party.type || 'Individual', detail: party.detail, percentage: party.percentage, isBeneficial: party.isBeneficial, isRoot: false });
  });
  const attached = new Set<string>();
  const attach = (parent: Node, depth: number) => {
    for (const node of nodes.values()) {
      if (attached.has(node.id)) continue;
      const parentKey = parent.isRoot ? '' : parent.id;
      const parentExists = node.parentId && node.parentId !== node.id && nodes.has(node.parentId);
      if ((parentExists ? node.parentId : '') !== parentKey) continue;
      attached.add(node.id);
      node.depth = depth;
      parent.children.push(node);
      attach(node, depth + 1);
    }
  };
  attach(root, 1);
  // Parties inside a parent cycle are unreachable; show them under the client rather than dropping them.
  for (const node of nodes.values()) {
    if (attached.has(node.id)) continue;
    attached.add(node.id);
    node.depth = 1;
    root.children.push(node);
    attach(node, 2);
  }
  return root;
}

function walk(node: Node, visit: (node: Node) => void) {
  visit(node);
  node.children.forEach((child) => walk(child, visit));
}

const lineHeight = (line: { value: string; size: number }) => line.size * (hasArabic(line.value) ? 1.7 : LINE_GAP);

function sizeNodes(root: Node, boxWidth: number) {
  const context = measureContext();
  const heights: number[] = [];
  walk(root, (node) => {
    const colors = layer(node.depth);
    const inner = boxWidth - PAD * 2 - (node.isBeneficial ? 10 : 0);
    node.lines = [
      ...wrap(context, node.name.toUpperCase(), NAME_SIZE, true, inner).map((value) => ({ value, size: NAME_SIZE, bold: true, color: colors.ink })),
      ...wrap(context, node.type, SUB_SIZE, false, inner).map((value) => ({ value, size: SUB_SIZE, bold: false, color: colors.muted })),
      ...(node.detail ? wrap(context, node.detail, SUB_SIZE, false, inner) : []).map((value) => ({ value, size: SUB_SIZE, bold: false, color: colors.muted }))
    ];
    node.w = boxWidth;
    node.h = Math.max(44, PAD * 2 + (node.isBeneficial ? 9 : 0) + node.lines.reduce((sum, line) => sum + lineHeight(line), 0));
    heights[node.depth] = Math.max(heights[node.depth] || 0, node.h);
  });
  // Equal heights per layer, like the preview's fixed-size boxes.
  walk(root, (node) => { node.h = heights[node.depth]; });
  return heights;
}

function layoutTopDown(root: Node, heights: number[], gapX: number, gapY: number) {
  const rowTop = heights.map((_, depth) => TITLE_SPACE + heights.slice(0, depth).reduce((sum, height) => sum + height + gapY, 0));
  let cursor = RAIL;
  const place = (node: Node): number => {
    node.y = rowTop[node.depth];
    if (!node.children.length) {
      node.x = cursor;
      cursor += node.w + gapX;
      return node.x + node.w / 2;
    }
    const centers = node.children.map(place);
    const center = (centers[0] + centers[centers.length - 1]) / 2;
    node.x = center - node.w / 2;
    return center;
  };
  place(root);
  let right = 0, bottom = 0;
  walk(root, (node) => { right = Math.max(right, node.x + node.w); bottom = Math.max(bottom, node.y + node.h); });
  return { width: right + 8, height: bottom + 8, rowTop };
}

function layoutLeftRight(root: Node, heights: number[], gapX: number, gapY: number) {
  let cursor = TITLE_SPACE + 22;
  const place = (node: Node): number => {
    node.x = 8 + node.depth * (node.w + gapX);
    if (!node.children.length) {
      node.y = cursor;
      cursor += node.h + gapY;
      return node.y + node.h / 2;
    }
    const centers = node.children.map(place);
    const center = (centers[0] + centers[centers.length - 1]) / 2;
    node.y = center - node.h / 2;
    return center;
  };
  place(root);
  let right = 0, bottom = 0;
  walk(root, (node) => { right = Math.max(right, node.x + node.w); bottom = Math.max(bottom, node.y + node.h); });
  return { width: right + 8, height: bottom + 8, columns: heights.map((_, depth) => 8 + depth * (root.w + gapX)) };
}

function layerLabel(x: number, y: number, w: number, h: number, depth: number): Shape[] {
  const colors = layer(depth);
  return [
    { kind: 'rect', x, y, w, h, r: 3, fill: colors.fill, stroke: colors.border, strokeWidth: 0.7 },
    { kind: 'text', x: x + w / 2, y: y + h / 2 + 2.6, value: `Layer ${depth}`, size: 7.5, bold: true, color: colors.ink, anchor: 'middle' }
  ];
}

function nodeShapes(node: Node): Shape[] {
  const colors = layer(node.depth);
  const output: Shape[] = [{ kind: 'rect', x: node.x, y: node.y, w: node.w, h: node.h, r: 3, fill: colors.fill, stroke: colors.border, strokeWidth: 0.8 }];
  const textHeight = node.lines.reduce((sum, line) => sum + lineHeight(line), 0);
  let y = node.y + (node.h - textHeight) / 2 + (node.isBeneficial ? 3 : 0);
  for (const line of node.lines) {
    y += lineHeight(line);
    output.push({ kind: 'text', x: node.x + node.w / 2, y: y - line.size * (hasArabic(line.value) ? 0.45 : 0.28), value: line.value, size: line.size, bold: line.bold, color: line.color, anchor: 'middle' });
  }
  if (node.isBeneficial) {
    const width = 34;
    output.push({ kind: 'rect', x: node.x + node.w - width - 4, y: node.y + 4, w: width, h: 9, r: 4.5, fill: '#CFFAFE', stroke: '#CFFAFE', strokeWidth: 0.3 });
    output.push({ kind: 'text', x: node.x + node.w - width / 2 - 4, y: node.y + 10.6, value: 'Beneficial', size: 5.6, bold: true, color: '#155E75', anchor: 'middle' });
  }
  return output;
}

function percentLabel(value: string) {
  return value ? (value.endsWith('%') ? value : `${value}%`) : '';
}

function shapes(root: Node, orientation: 'down' | 'right', guides: number[], heights: number[], width: number) {
  const output: Shape[] = [
    { kind: 'text', x: width / 2, y: 14, value: `${root.name.toUpperCase()} - CONTROL STRUCTURE`, size: TITLE_SIZE, bold: true, color: '#020617', anchor: 'middle' }
  ];
  const depths = new Set<number>();
  walk(root, (node) => depths.add(node.depth));
  if (orientation === 'down') {
    [...depths].forEach((depth) => output.push(...layerLabel(4, guides[depth] + (heights[depth] - 22) / 2, 46, 22, depth)));
  } else {
    [...depths].forEach((depth) => output.push(...layerLabel(guides[depth] + root.w / 2 - 23, TITLE_SPACE - 4, 46, 16, depth)));
  }
  walk(root, (parent) => {
    for (const child of parent.children) {
      const label = percentLabel(child.percentage);
      if (orientation === 'down') {
        const x1 = parent.x + parent.w / 2, y1 = parent.y + parent.h;
        const x2 = child.x + child.w / 2, y2 = child.y;
        const elbow = (y1 + y2) / 2;
        output.push({ kind: 'path', points: [[x1, y1], [x1, elbow], [x2, elbow], [x2, y2]], stroke: LINE, strokeWidth: 1 });
        output.push({ kind: 'path', points: [[x2 - 3, y2 - 5], [x2, y2], [x2 + 3, y2 - 5]], stroke: LINE, strokeWidth: 1 });
        if (label) output.push({ kind: 'text', x: x2 + 4, y: Math.max(y2 - 7, elbow - 2), value: label, size: 7.5, bold: true, color: '#020617', anchor: 'start' });
      } else {
        const x1 = parent.x + parent.w, y1 = parent.y + parent.h / 2;
        const x2 = child.x, y2 = child.y + child.h / 2;
        const elbow = (x1 + x2) / 2;
        output.push({ kind: 'path', points: [[x1, y1], [elbow, y1], [elbow, y2], [x2, y2]], stroke: LINE, strokeWidth: 1 });
        output.push({ kind: 'path', points: [[x2 - 5, y2 - 3], [x2, y2], [x2 - 5, y2 + 3]], stroke: LINE, strokeWidth: 1 });
        if (label) output.push({ kind: 'text', x: elbow + 3, y: y2 - 3, value: label, size: 7, bold: true, color: '#020617', anchor: 'start' });
      }
    }
  });
  walk(root, (node) => output.push(...nodeShapes(node)));
  return output;
}

const escape = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function toSvg(items: Shape[], width: number, height: number, displayWidth: number, displayHeight: number) {
  const body = items.map((item) => {
    if (item.kind === 'rect') return `<rect x="${item.x.toFixed(2)}" y="${item.y.toFixed(2)}" width="${item.w.toFixed(2)}" height="${item.h.toFixed(2)}" rx="${item.r}" fill="${item.fill}" stroke="${item.stroke}" stroke-width="${item.strokeWidth}"/>`;
    if (item.kind === 'path') return `<polyline points="${item.points.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(' ')}" fill="none" stroke="${item.stroke}" stroke-width="${item.strokeWidth}" stroke-linejoin="round"/>`;
    return `<text x="${item.x.toFixed(2)}" y="${item.y.toFixed(2)}" font-size="${item.size}" font-weight="${item.bold ? 700 : 400}" fill="${item.color}" text-anchor="${item.anchor}">${escape(item.value)}</text>`;
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${displayWidth.toFixed(2)}pt" height="${displayHeight.toFixed(2)}pt" viewBox="0 0 ${width.toFixed(2)} ${height.toFixed(2)}" font-family="${fontStack}">${body}</svg>`;
}

function toPng(items: Shape[], width: number, height: number, pixelsPerUnit: number): KycImage {
  registerCanvasFonts();
  const canvas = createCanvas(Math.ceil(width * pixelsPerUnit), Math.ceil(height * pixelsPerUnit));
  const context = canvas.getContext('2d');
  context.scale(pixelsPerUnit, pixelsPerUnit);
  context.fillStyle = '#FFFFFF';
  context.fillRect(0, 0, width, height);
  context.lineJoin = 'round';
  for (const item of items) {
    if (item.kind === 'rect') {
      context.beginPath();
      context.roundRect(item.x, item.y, item.w, item.h, item.r);
      context.fillStyle = item.fill;
      context.fill();
      context.lineWidth = item.strokeWidth;
      context.strokeStyle = item.stroke;
      context.stroke();
    } else if (item.kind === 'path') {
      context.beginPath();
      item.points.forEach(([x, y], index) => (index ? context.lineTo(x, y) : context.moveTo(x, y)));
      context.lineWidth = item.strokeWidth;
      context.strokeStyle = item.stroke;
      context.stroke();
    } else {
      context.font = `${item.bold ? 'bold ' : ''}${item.size}px ${fontStack}`;
      context.fillStyle = item.color;
      context.textAlign = item.anchor === 'middle' ? 'center' : 'left';
      context.fillText(item.value, item.x, item.y);
    }
  }
  return { png: canvas.toBuffer('image/png'), width: canvas.width, height: canvas.height };
}

export function renderOwnershipDiagram(rootName: string, parties: OwnershipParty[], maxWidthPt: number, maxHeightPt: number): OwnershipDiagram | null {
  if (!parties.length) return null;
  const root = buildTree(rootName || 'Client company', parties);
  let leaves = 0;
  walk(root, (node) => { if (!node.children.length) leaves++; });

  // Top-down like the preview; switch to left-to-right when many parties would sit side by side.
  let orientation: 'down' | 'right' = 'down';
  let boxWidth = Math.min(130, Math.max(96, (maxWidthPt - RAIL - (leaves - 1) * 12) / leaves));
  if (RAIL + leaves * boxWidth + (leaves - 1) * 12 > maxWidthPt * 1.15) {
    orientation = 'right';
    boxWidth = 112;
  }
  const heights = sizeNodes(root, boxWidth);
  const layout = orientation === 'down' ? layoutTopDown(root, heights, 12, 30) : layoutLeftRight(root, heights, 40, 7);
  const guides = orientation === 'down' ? (layout as { rowTop: number[] }).rowTop : (layout as { columns: number[] }).columns;
  // Widen the canvas to fit the title and centre the boxes under it (the layer rail stays on the left).
  const context = measureContext();
  context.font = `bold ${TITLE_SIZE}px ${fontStack}`;
  const width = Math.max(layout.width, context.measureText(`${root.name.toUpperCase()} - CONTROL STRUCTURE`).width + 24, 200);
  const shift = (width - layout.width) / 2;
  if (shift > 0) {
    walk(root, (node) => { node.x += shift; });
    if (orientation === 'right') guides.forEach((_, index) => { guides[index] += shift; });
  }
  const items = shapes(root, orientation, guides, heights, width);
  const scale = Math.min(1, maxWidthPt / width, maxHeightPt / layout.height);
  const displayWidth = width * scale;
  const displayHeight = layout.height * scale;
  return {
    svg: toSvg(items, width, layout.height, displayWidth, displayHeight),
    // About 300 dpi at display size, so the Word copy prints as sharply as the vector PDF.
    png: toPng(items, width, layout.height, Math.min(6, 4.2 * scale + 0.4)),
    widthPt: displayWidth,
    heightPt: displayHeight,
    condensed: scale < 0.72
  };
}
