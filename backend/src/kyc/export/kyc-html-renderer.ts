import { ARABIC_FONT_FAMILY, ARIAL_FONT_FAMILY, KycImage, Letterhead, LetterheadBand, PAGE_MM, pdfFontFaceCss, SYMBOL_FONT_FAMILY } from './kyc-export-assets';
import { Block, Cell, COLORS, Inline, KycDocumentModel, Line, Row, TableStyle } from './kyc-document-model';
import { cleanText } from './kyc-export-format';

// Same page geometry as the DOCX: A4 inside the Newoon letterhead, margins in millimetres.
export const PDF_MARGIN_MM = { top: 35.28, bottom: 17.64, left: 15, right: 15 };

const escape = (value: string) => cleanText(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const dataUri = (image: KycImage) => `data:image/png;base64,${image.png.toString('base64')}`;
const fonts = `'${ARIAL_FONT_FAMILY}', '${ARABIC_FONT_FAMILY}', '${SYMBOL_FONT_FAMILY}', Arial, sans-serif`;

// Checkboxes are drawn rather than taken from a font, so they look identical on every server.
const CHECKED = '<span class="cb"><svg viewBox="0 0 10 10"><path d="M1.6 1.6L8.4 8.4M8.4 1.6L1.6 8.4" stroke="#000" stroke-width="0.9"/></svg></span>';
const UNCHECKED = '<span class="cb"></span>';

function inline(part: Inline) {
  if ('box' in part) return part.box ? CHECKED : UNCHECKED;
  const value = escape(part.text).replace(/ {2,}/g, (spaces) => '&nbsp;'.repeat(spaces.length));
  if (part.bold) return `<b>${value}</b>`;
  return part.muted ? `<span class="muted">${value}</span>` : value;
}

function lineHtml(line: Line, alignment?: 'left' | 'center') {
  const align = line.align || alignment;
  const styles = [
    align && align !== 'left' ? `text-align:${align}` : '',
    line.spaceAfter ? `margin-bottom:${line.spaceAfter}pt` : '',
    line.spaceBefore ? `margin-top:${line.spaceBefore}pt` : ''
  ].filter(Boolean).join(';');
  return `<div class="ln"${styles ? ` style="${styles}"` : ''}>${line.parts.map(inline).join('') || '&#8203;'}</div>`;
}

function cellHtml(cell: Cell) {
  const lines = (cell.lines?.length ? cell.lines : [{ parts: [] }]).map((line) => lineHtml(line, cell.align)).join('');
  return `${lines}${cell.image ? `<img class="sig" src="${dataUri(cell.image)}" alt="">` : ''}`;
}

function tableHtml(weights: number[], rows: Row[], style: TableStyle) {
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  const rowHtml = (row: Row) => `<tr${row.header ? ' class="head"' : ''}>${row.cells.map((cell) => `<td${cell.span && cell.span > 1 ? ` colspan="${cell.span}"` : ''}>${cellHtml(cell)}</td>`).join('')}</tr>`;
  const header = rows.filter((row) => row.header);
  const body = rows.filter((row) => !row.header);
  return `<table class="${style}"><colgroup>${weights.map((weight) => `<col style="width:${((weight / total) * 100).toFixed(3)}%">`).join('')}</colgroup>${header.length ? `<thead>${header.map(rowHtml).join('')}</thead>` : ''}<tbody>${body.map(rowHtml).join('')}</tbody></table>`;
}

function blockHtml(item: Block): string {
  switch (item.kind) {
    case 'para':
      return lineHtml(item.line);
    case 'title':
      return `<h1>${escape(item.text)}</h1>`;
    case 'subheading':
      return `<div class="group">${escape(item.text)}</div>`;
    case 'table':
      return tableHtml(item.weights, item.rows, item.style);
    case 'section':
      return `<section><div class="bar">${escape(item.title)}</div><div class="box">${item.blocks.map(blockHtml).join('')}</div></section>`;
    case 'diagram': {
      const content = item.diagram
        ? `<div class="chart">${item.diagram.svg}</div>${item.diagram.condensed ? '<div class="note">Structure condensed to fit the page; the tables list every party.</div>' : ''}`
        : `<div class="ln muted">${escape(item.emptyText)}</div>`;
      return `<div class="diagram"><div class="diagram-title">${escape(item.title)}</div>${content}</div>`;
    }
  }
}

export function renderKycHtml(model: KycDocumentModel) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Know Your Customer Form - ${escape(model.companyName)}</title><style>
${pdfFontFaceCss()}
@page { size: A4; }
* { box-sizing: border-box; }
html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
/* Mirrors the in-app live preview: 11 px body, 10 px tables, slate borders, brand-900 section bars. */
body { margin: 0; color: #${COLORS.ink}; font-family: ${fonts}; font-size: 8.5pt; line-height: 1.4; }
h1 { margin: 6pt 0 3pt; text-align: center; font-size: 12pt; font-weight: 700; color: #020617; }
section { margin-top: 10pt; }
.bar { background: #${COLORS.bar}; color: #fff; font-weight: 700; text-transform: uppercase; padding: 2pt 5.75pt; break-after: avoid; }
.box { border: 0.5pt solid #${COLORS.border}; border-top: 0; padding: 5.75pt; }
.box > table + table, .box > .diagram + table, .box > table + .diagram { margin-top: 6pt; }
/* Review-group heading inside Section H (AML Supervisor, DMLRO, MLRO, SEF). */
.group { margin: 8pt 0 3pt; padding: 1.5pt 5pt; background: #${COLORS.groupFill}; border-left: 3pt solid #${COLORS.groupEdge}; color: #${COLORS.bar}; font-weight: 700; font-size: 8pt; text-transform: uppercase; break-after: avoid; }
.ln { margin: 0; min-height: 1em; }
.muted { color: #${COLORS.muted}; }
table { border-collapse: collapse; table-layout: fixed; width: 100%; }
td { border: 0.5pt solid #${COLORS.border}; padding: 3pt 4pt; vertical-align: top; overflow-wrap: anywhere; }
tr { break-inside: avoid; }
thead { display: table-header-group; }
table.fields td { height: 22pt; }
table.data { font-size: 7.5pt; }
tr.head td { background: #${COLORS.header}; font-weight: 700; }
.sig { display: block; max-height: 36pt; max-width: 100%; margin-top: 1.5pt; object-fit: contain; }
.cb { display: inline-block; width: 0.8em; height: 0.8em; border: 0.6pt solid #000; vertical-align: -0.1em; margin: 0 0.12em; position: relative; }
.cb svg { position: absolute; inset: 0; width: 100%; height: 100%; }
.diagram { background: #F8FAFC; border: 0.5pt solid #E2E8F0; padding: 8pt; break-inside: avoid; }
.diagram-title { font-weight: 700; font-size: 9.5pt; margin-bottom: 5pt; }
.chart { border: 1.5pt solid #1E293B; background: #fff; padding: 3pt; text-align: center; }
.chart svg { display: inline-block; max-width: 100%; height: auto; }
.note { font-style: italic; font-size: 7pt; color: #${COLORS.muted}; margin-top: 3pt; }
</style></head><body>
${model.blocks.map(blockHtml).join('\n')}
</body></html>`;
}

// Chromium draws header/footer templates inside the page margins; the full-width letterhead bands are placed at
// the same page coordinates as in the DOCX.
export function pdfHeaderFooter(letterhead: Letterhead) {
  const base = 'margin:0;padding:0;width:100%;position:relative;overflow:hidden;-webkit-print-color-adjust:exact;';
  const band = (image: LetterheadBand | null, areaTopMm: number) => image
    ? `<img src="${dataUri(image)}" style="position:absolute;left:0;top:${(image.topMm - areaTopMm).toFixed(2)}mm;width:${PAGE_MM.width}mm;height:${image.heightMm.toFixed(2)}mm;">`
    : '';
  return {
    // Chromium pads header/footer templates (about 0.4 cm); cancel it so the bands sit where Word places them.
    headerTemplate: `<div style="${base}height:${PDF_MARGIN_MM.top}mm;margin-top:-5.05mm;">${band(letterhead.header, 0)}</div>`,
    footerTemplate: `<div style="${base}height:${PDF_MARGIN_MM.bottom}mm;margin-bottom:-5.2mm;">${band(letterhead.footer, PAGE_MM.height - PDF_MARGIN_MM.bottom)}</div>`,
    marginTopMm: PDF_MARGIN_MM.top,
    marginBottomMm: PDF_MARGIN_MM.bottom
  };
}
