import sanitizeHtml = require('sanitize-html');
import { parseDocument } from 'htmlparser2';

export type CommentRun = { text: string; bold?: boolean; italic?: boolean; underline?: boolean; highlight?: boolean };
const allowedTags = ['p', 'br', 'strong', 'b', 'em', 'i', 'u', 'mark', 'ul', 'ol', 'li'];
export function safeComment(value: unknown): string {
  const original = String(value ?? '');
  if (!original) return '';
  const html = /<\/?[a-z][^>]*>/i.test(original) ? original : `<p>${original.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>')}</p>`;
  return sanitizeHtml(html, { allowedTags, allowedAttributes: {} });
}
export function commentLines(value: unknown): CommentRun[][] {
  const original = String(value ?? '');
  if (!/<\/?[a-z][^>]*>/i.test(original)) return original.split('\n').map((text) => [{ text }]);
  const output: CommentRun[][] = [[]];
  const newline = () => { if (output[output.length - 1].length) output.push([]); };
  const walk = (nodes: ReturnType<typeof parseDocument>['children'], style: Omit<CommentRun, 'text'> = {}, ordered = false) => {
    let itemNumber = 0;
    for (const node of nodes) {
      if (node.type === 'text') output[output.length - 1].push({ ...style, text: node.data });
      else if (node.type === 'tag') {
        const block = ['p', 'li', 'ul', 'ol'].includes(node.name);
        if (block || node.name === 'br') newline();
        if (node.name === 'li') output[output.length - 1].push({ text: ordered ? `${++itemNumber}. ` : '- ' });
        walk(node.children, { ...style, bold: style.bold || ['b', 'strong'].includes(node.name), italic: style.italic || ['i', 'em'].includes(node.name), underline: style.underline || node.name === 'u', highlight: style.highlight || node.name === 'mark' }, node.name === 'ol');
        if (block) newline();
      }
    }
  };
  walk(parseDocument(safeComment(original)).children);
  return output.filter((line) => line.length);
}
export function hasComment(value: unknown): boolean {
  const content = (nodes: ReturnType<typeof parseDocument>['children']): string => nodes.map((node) => node.type === 'text' ? node.data : node.type === 'tag' ? content(node.children) : '').join('');
  return content(parseDocument(safeComment(value)).children).replace(/[\s\u200B-\u200D\uFEFF]/g, '').length > 0;
}
