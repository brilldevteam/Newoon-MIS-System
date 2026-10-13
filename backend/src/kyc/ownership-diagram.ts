import { createCanvas } from '@napi-rs/canvas';

type OwnershipNode = {
  id: string; parentId: string; name: string; type: string;
  ownership: string; detail: string; isUbo: boolean; depth: number; x: number;
};

export function renderOwnershipDiagram(nodes: OwnershipNode[], maxDepth: number, leafCount: number) {
  const width = Math.max(1200, leafCount * 560);
  const boxWidth = leafCount === 1 ? 1040 : 520;
  const fontSize = 32;
  const canvas = createCanvas(width, 1);
  const context = canvas.getContext('2d');
  const font = (bold = false) => `${bold ? 'bold ' : ''}${fontSize}px "DejaVu Sans", Arial, sans-serif`;
  const wrap = (value: string) => {
    context.font = font();
    const lines: string[] = [];
    let line = '';
    for (const word of value.split(/\s+/)) {
      if (context.measureText(`${line} ${word}`.trim()).width > boxWidth - 64 && line) {
        lines.push(line);
        line = '';
      }
      // Preserve long names/identifiers rather than silently dropping words.
      for (const character of word) {
        if (context.measureText(line + character).width > boxWidth - 64) {
          lines.push(line);
          line = '';
        }
        line += character;
      }
      line += ' ';
    }
    if (line.trim()) lines.push(line.trim());
    return lines;
  };
  const labels = new Map(nodes.map(node => [node.id, [...wrap(node.name), node.type, ...(node.detail && node.id !== 'ROOT' ? wrap(node.detail) : []), ...(node.isUbo ? ['Ultimate beneficial owner'] : [])]]));
  const boxHeight = Math.max(180, ...[...labels.values()].map(lines => lines.length * 44 + 48));
  const gap = 96;
  canvas.height = 48 + (maxDepth + 1) * boxHeight + maxDepth * gap;
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, width, canvas.height);
  const left = (node: OwnershipNode) => node.x * width - boxWidth / 2;
  const top = (node: OwnershipNode) => 24 + node.depth * (boxHeight + gap);
  context.lineWidth = 3;
  for (const node of nodes.filter(node => node.parentId)) {
    const parent = nodes.find(parent => parent.id === node.parentId);
    if (!parent) continue;
    const x1 = parent.x * width, x2 = node.x * width;
    const y1 = top(parent) + boxHeight, y2 = top(node), middle = (y1 + y2) / 2;
    context.strokeStyle = '#344054';
    context.beginPath();
    context.moveTo(x1, y1); context.lineTo(x1, middle);
    context.lineTo(x2, middle); context.lineTo(x2, y2);
    context.moveTo(x2 - 10, y2 - 14); context.lineTo(x2, y2); context.lineTo(x2 + 10, y2 - 14);
    context.stroke();
    context.font = font(); context.fillStyle = '#172033';
    context.fillText(`${node.ownership}%`, x2 + 18, y2 - 24);
  }
  for (const node of nodes) {
    const root = node.id === 'ROOT';
    const x = left(node), y = top(node);
    context.fillStyle = root ? '#172033' : node.isUbo ? '#e5f4f0' : '#f1f4f8';
    context.fillRect(x, y, boxWidth, boxHeight);
    context.strokeStyle = node.isUbo ? '#267a65' : '#667085';
    context.strokeRect(x, y, boxWidth, boxHeight);
    context.fillStyle = root ? '#ffffff' : '#172033';
    labels.get(node.id)!.forEach((line, index) => {
      context.font = font(index === 0);
      context.fillText(line, x + 32, y + 44 + index * 44);
    });
  }
  return `data:image/png;base64,${canvas.toBuffer('image/png').toString('base64')}`;
}
