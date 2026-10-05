import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  Header,
  HeightRule,
  HorizontalPositionRelativeFrom,
  ImageRun,
  LineRuleType,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableLayoutType,
  TableRow,
  TextRun,
  TextWrappingType,
  VerticalPositionRelativeFrom,
  WidthType
} from 'docx';
import { KycImage, Letterhead, LetterheadBand, PAGE_MM } from './kyc-export-assets';
import { Block, Cell, COLORS, KycDocumentModel, Line, Row, TableStyle } from './kyc-document-model';
import { cleanText } from './kyc-export-format';

// A4 inside the Newoon letterhead: 15 mm side margins, body starting below the header artwork.
const PAGE = { width: 11906, height: 16838 };
const MARGIN = { left: 850, right: 850, top: 2000, bottom: 1000, header: 300, footer: 535 };
const CONTENT = PAGE.width - MARGIN.left - MARGIN.right;
const TWIPS_TO_PX = 96 / 1440;
const PT = 20;
const SECTION_PADDING = 115;

const FONT = 'Arial';
const SYMBOL_FONT = 'Segoe UI Symbol';
// Half-points, matching the preview's 11 px body and 10 px tables.
const SIZE = { body: 17, table: 15, title: 24, bar: 17, diagramTitle: 19 };

const edge = (color: string, size = 4) => ({ style: BorderStyle.SINGLE, size, color });
const none = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
const grid = (color: string) => ({ top: edge(color), bottom: edge(color), left: edge(color), right: edge(color), insideHorizontal: edge(color), insideVertical: edge(color) });
const outline = (color: string, size = 4) => ({ top: edge(color, size), bottom: edge(color, size), left: edge(color, size), right: edge(color, size), insideHorizontal: none, insideVertical: none });
const fontOf = (family: string) => ({ ascii: family, hAnsi: family, cs: family, eastAsia: family });
const cellMargins = { top: 50, bottom: 40, left: 80, right: 80 };

function runs(line: Line, size: number) {
  return line.parts.map((part) => 'box' in part
    ? new TextRun({ text: part.box ? '☒' : '☐', font: { ascii: SYMBOL_FONT, hAnsi: SYMBOL_FONT, cs: SYMBOL_FONT, eastAsia: 'MS Gothic' }, size })
    : new TextRun({ text: cleanText(part.text), bold: part.bold, color: part.muted ? COLORS.muted : COLORS.ink, font: fontOf(/[☑☐]/.test(part.text) ? SYMBOL_FONT : FONT), size }));
}

function paragraph(line: Line, size: number, alignment?: 'left' | 'center') {
  const align = line.align || alignment;
  return new Paragraph({
    children: runs(line, size),
    alignment: align === 'center' ? AlignmentType.CENTER : align === 'justify' ? AlignmentType.JUSTIFIED : AlignmentType.LEFT,
    keepNext: line.keepNext,
    spacing: { before: (line.spaceBefore ?? 0) * PT, after: (line.spaceAfter ?? 0) * PT, line: 252, lineRule: LineRuleType.AUTO }
  });
}

function imageRun(image: KycImage, maxWidthPx: number, maxHeightPx: number) {
  const scale = Math.min(maxWidthPx / image.width, maxHeightPx / image.height, 1);
  return new ImageRun({ type: 'png', data: image.png, transformation: { width: Math.max(1, Math.round(image.width * scale)), height: Math.max(1, Math.round(image.height * scale)) } });
}

const spacer = (points: number) => new Paragraph({ spacing: { before: 0, after: 0, line: Math.max(20, points * PT), lineRule: LineRuleType.EXACT }, children: [] });

function cellContent(cell: Cell, widthTwips: number, size: number) {
  const output: Paragraph[] = (cell.lines?.length ? cell.lines : [{ parts: [] }]).map((line) => paragraph(line, size, cell.align));
  if (cell.image) {
    // Preview images are limited to 48 px high.
    output.push(new Paragraph({ children: [imageRun(cell.image, (widthTwips - cellMargins.left - cellMargins.right) * TWIPS_TO_PX, 48)], spacing: { before: 30, after: 0 } }));
  }
  return output;
}

function table(weights: number[], rows: Row[], style: TableStyle, width: number) {
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  const widths = weights.map((weight) => Math.floor((weight / total) * width));
  widths[widths.length - 1] += width - widths.reduce((sum, value) => sum + value, 0);
  const size = style === 'data' ? SIZE.table : SIZE.body;
  return new Table({
    width: { size: width, type: WidthType.DXA },
    columnWidths: widths,
    layout: TableLayoutType.FIXED,
    borders: grid(COLORS.border),
    rows: rows.map((row) => {
      let column = 0;
      return new TableRow({
        cantSplit: true,
        tableHeader: row.header,
        // The preview's grid cells are at least 32 px tall.
        height: style === 'fields' ? { value: 20 * PT, rule: HeightRule.ATLEAST } : undefined,
        children: row.cells.map((cell) => {
          const span = cell.span || 1;
          const cellWidth = widths.slice(column, column + span).reduce((sum, value) => sum + value, 0);
          column += span;
          return new TableCell({
            width: { size: cellWidth, type: WidthType.DXA },
            columnSpan: span > 1 ? span : undefined,
            shading: row.header ? { type: ShadingType.CLEAR, color: 'auto', fill: COLORS.header } : undefined,
            margins: cellMargins,
            children: cellContent(cell, cellWidth, size)
          });
        })
      });
    })
  });
}

function diagram(item: Extract<Block, { kind: 'diagram' }>, width: number) {
  const innerWidth = width - 2 * 160;
  const content: Array<Paragraph | Table> = [
    new Paragraph({ spacing: { after: 100 }, keepNext: true, children: [new TextRun({ text: item.title, bold: true, font: fontOf(FONT), size: SIZE.diagramTitle, color: COLORS.ink })] })
  ];
  if (item.diagram) {
    const picture = new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 60, after: 60 },
      // Word renders SVG text with its own metrics, so the exact high-resolution raster is used.
      children: [new ImageRun({ type: 'png', data: item.diagram.png.png, transformation: { width: Math.round(item.diagram.widthPt * (96 / 72)), height: Math.round(item.diagram.heightPt * (96 / 72)) } })]
    });
    content.push(new Table({
      width: { size: innerWidth, type: WidthType.DXA },
      columnWidths: [innerWidth],
      layout: TableLayoutType.FIXED,
      borders: outline('1E293B', 12),
      rows: [new TableRow({ cantSplit: true, children: [new TableCell({ width: { size: innerWidth, type: WidthType.DXA }, margins: cellMargins, children: [picture] })] })]
    }));
    if (item.diagram.condensed) content.push(new Paragraph({ spacing: { before: 60 }, children: [new TextRun({ text: 'Structure condensed to fit the page; the tables list every party.', italics: true, font: fontOf(FONT), size: 14, color: COLORS.muted })] }));
  } else {
    content.push(new Paragraph({ children: [new TextRun({ text: item.emptyText, font: fontOf(FONT), size: SIZE.body, color: COLORS.muted })] }));
  }
  content.push(spacer(1));
  // Light panel around the chart, as in the preview's "Control Structure" card.
  return new Table({
    width: { size: width, type: WidthType.DXA },
    columnWidths: [width],
    layout: TableLayoutType.FIXED,
    borders: outline('E2E8F0'),
    rows: [new TableRow({ cantSplit: true, children: [new TableCell({ width: { size: width, type: WidthType.DXA }, shading: { type: ShadingType.CLEAR, color: 'auto', fill: 'F8FAFC' }, margins: { top: 160, bottom: 100, left: 160, right: 160 }, children: content })] })]
  });
}

function blocks(items: Block[], width: number): Array<Paragraph | Table> {
  const output: Array<Paragraph | Table> = [];
  items.forEach((item, index) => {
    const isTable = item.kind === 'table' || item.kind === 'diagram';
    // Tables inside a section sit 6 pt apart, like the preview's mt-2 spacing; a group heading sits 3 pt above its grid.
    if (isTable && index > 0 && items[index - 1].kind !== 'subheading') output.push(spacer(6));
    output.push(...block(item, width));
  });
  return output;
}

function block(item: Block, width: number): Array<Paragraph | Table> {
  switch (item.kind) {
    case 'para':
      return [paragraph(item.line, SIZE.body)];
    case 'subheading':
      // Review-group heading inside Section H (AML Supervisor, DMLRO, MLRO, SEF).
      return [new Paragraph({
        keepNext: true,
        spacing: { before: 120, after: 60 },
        shading: { type: ShadingType.CLEAR, color: 'auto', fill: COLORS.groupFill },
        border: { left: { style: BorderStyle.SINGLE, size: 24, color: COLORS.groupEdge, space: 4 } },
        indent: { left: 80 },
        children: [new TextRun({ text: item.text.toUpperCase(), bold: true, font: fontOf(FONT), size: SIZE.table + 1, color: COLORS.bar })]
      })];
    case 'title':
      return [new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 120, after: 60 }, children: [new TextRun({ text: item.text, bold: true, font: fontOf(FONT), size: SIZE.title, color: '020617' })] })];
    case 'table':
      return [table(item.weights, item.rows, item.style, width)];
    case 'diagram':
      return [diagram(item, width)];
    case 'section': {
      const inner = width - SECTION_PADDING * 2;
      return [
        spacer(10),
        new Table({
          width: { size: width, type: WidthType.DXA },
          columnWidths: [width],
          layout: TableLayoutType.FIXED,
          borders: outline(COLORS.border),
          rows: [
            new TableRow({
              cantSplit: true,
              children: [new TableCell({
                width: { size: width, type: WidthType.DXA },
                shading: { type: ShadingType.CLEAR, color: 'auto', fill: COLORS.bar },
                margins: { top: 40, bottom: 40, left: 115, right: 115 },
                children: [new Paragraph({ keepNext: true, children: [new TextRun({ text: item.title.toUpperCase(), bold: true, color: 'FFFFFF', font: fontOf(FONT), size: SIZE.bar })] })]
              })]
            }),
            new TableRow({
              children: [new TableCell({
                width: { size: width, type: WidthType.DXA },
                margins: { top: SECTION_PADDING, bottom: SECTION_PADDING, left: SECTION_PADDING, right: SECTION_PADDING },
                // Word needs a paragraph after a nested table at the end of a cell.
                children: [...blocks(item.blocks, inner), spacer(1)]
              })]
            })
          ]
        })
      ];
    }
  }
}

// Letterhead artwork floats behind the text at its exact page position, as in the Newoon Word template.
function letterheadParagraph(band: LetterheadBand | null) {
  if (!band) return new Paragraph({ children: [] });
  const emu = (mm: number) => Math.round(mm * 36000);
  return new Paragraph({
    spacing: { after: 0 },
    children: [new ImageRun({
      type: 'png',
      data: band.png,
      transformation: { width: Math.round((PAGE_MM.width / 25.4) * 96), height: Math.round((band.heightMm / 25.4) * 96) },
      floating: {
        horizontalPosition: { relative: HorizontalPositionRelativeFrom.PAGE, offset: 0 },
        verticalPosition: { relative: VerticalPositionRelativeFrom.PAGE, offset: emu(band.topMm) },
        behindDocument: true,
        allowOverlap: true,
        wrap: { type: TextWrappingType.NONE }
      }
    })]
  });
}

export async function renderKycDocx(model: KycDocumentModel, letterhead: Letterhead): Promise<Buffer> {
  const document = new Document({
    creator: 'Newoon MIS',
    title: `Know Your Customer Form - ${model.companyName}`,
    description: `KYC document ${model.kycNumber} v${model.documentVersion}`,
    styles: {
      default: {
        document: { run: { font: FONT, size: SIZE.body, color: COLORS.ink }, paragraph: { spacing: { after: 0, line: 252 } } }
      }
    },
    sections: [{
      properties: { page: { size: PAGE, margin: MARGIN } },
      headers: { default: new Header({ children: [letterheadParagraph(letterhead.header)] }) },
      footers: { default: new Footer({ children: [letterheadParagraph(letterhead.footer)] }) },
      children: blocks(model.blocks, CONTENT)
    }]
  });
  return Packer.toBuffer(document);
}
