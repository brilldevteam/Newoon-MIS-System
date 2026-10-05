import { createCanvas, GlobalFonts, loadImage } from '@napi-rs/canvas';
import { existsSync, readFileSync } from 'fs';
import { dirname, join } from 'path';
import PizZip from 'pizzip';

export type KycImage = { png: Buffer; width: number; height: number };
// A full-page-width strip of letterhead artwork and its vertical position on an A4 page, in millimetres.
export type LetterheadBand = KycImage & { topMm: number; heightMm: number };
export type Letterhead = { header: LetterheadBand | null; footer: LetterheadBand | null };

export const PAGE_MM = { width: 210, height: 297 };

// Carlito and Arimo are metric-compatible with Calibri and Arial, so the PDF wraps
// text exactly like Word does, on any server.
export const FONT_FAMILY = 'KycBody';
export const ARIAL_FONT_FAMILY = 'KycArial';
export const ARABIC_FONT_FAMILY = 'KycArabic';
export const SYMBOL_FONT_FAMILY = 'KycSymbols';

type FontFile = { family: string; weight: 400 | 700; style: 'normal' | 'italic'; file: string; unicodeRange?: string };

function fontDir(name: string) {
  return join(dirname(require.resolve(`@fontsource/${name}/package.json`)), 'files');
}

function fontFiles(): FontFile[] {
  const latin = 'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD';
  const latinExt = 'U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF';
  const carlito = fontDir('carlito');
  const arimo = fontDir('arimo');
  const arabic = fontDir('noto-sans-arabic');
  const symbols = fontDir('noto-sans-symbols-2');
  const files: FontFile[] = [];
  for (const weight of [400, 700] as const) {
    files.push({ family: FONT_FAMILY, weight, style: 'normal', file: join(carlito, `carlito-latin-${weight}-normal.woff2`), unicodeRange: latin });
    // Carlito ships Latin only; Arimo covers extended Latin in the same family so accented names never fall back.
    files.push({ family: FONT_FAMILY, weight, style: 'normal', file: join(arimo, `arimo-latin-ext-${weight}-normal.woff2`), unicodeRange: latinExt });
    files.push({ family: ARIAL_FONT_FAMILY, weight, style: 'normal', file: join(arimo, `arimo-latin-${weight}-normal.woff2`), unicodeRange: latin });
    files.push({ family: ARIAL_FONT_FAMILY, weight, style: 'normal', file: join(arimo, `arimo-latin-ext-${weight}-normal.woff2`), unicodeRange: latinExt });
    files.push({ family: ARABIC_FONT_FAMILY, weight, style: 'normal', file: join(arabic, `noto-sans-arabic-arabic-${weight}-normal.woff2`) });
  }
  files.push({ family: SYMBOL_FONT_FAMILY, weight: 400, style: 'normal', file: join(symbols, 'noto-sans-symbols-2-symbols-400-normal.woff2') });
  return files.filter((font) => existsSync(font.file));
}

let fontFaceCss: string | null = null;

export function pdfFontFaceCss() {
  if (fontFaceCss === null) {
    fontFaceCss = fontFiles()
      .map((font) => `@font-face{font-family:'${font.family}';font-style:${font.style};font-weight:${font.weight};font-display:block;src:url(data:font/woff2;base64,${readFileSync(font.file).toString('base64')}) format('woff2');${font.unicodeRange ? `unicode-range:${font.unicodeRange};` : ''}}`)
      .join('\n');
  }
  return fontFaceCss;
}

let canvasFontsRegistered = false;

export function registerCanvasFonts() {
  if (canvasFontsRegistered) return;
  canvasFontsRegistered = true;
  for (const font of fontFiles()) GlobalFonts.registerFromPath(font.file, font.family);
}

function templatePath() {
  const candidates = [
    join(process.cwd(), 'backend', 'templates', 'kyc-part-1-template.docx'),
    join(process.cwd(), 'templates', 'kyc-part-1-template.docx'),
    join(__dirname, '..', '..', '..', 'templates', 'kyc-part-1-template.docx'),
    join(__dirname, '..', '..', '..', '..', 'backend', 'templates', 'kyc-part-1-template.docx')
  ];
  return candidates.find((candidate) => existsSync(candidate));
}

let letterheadPromise: Promise<Letterhead> | null = null;

// The template stores the letterhead as two page-width canvases placed at the top and bottom of the page.
// Keep the full width (so logos land exactly where the Word template has them) and drop only the empty rows.
export function loadLetterhead(): Promise<Letterhead> {
  if (!letterheadPromise) {
    letterheadPromise = (async () => {
      const path = templatePath();
      if (!path) return { header: null, footer: null };
      const zip = new PizZip(readFileSync(path));
      const media = (name: string) => zip.file(`word/media/${name}`)?.asNodeBuffer();
      const header = media('image1.png');
      const footer = media('image3.png');
      return {
        header: header ? await letterheadBand(header, 'top') : null,
        footer: footer ? await letterheadBand(footer, 'bottom') : null
      };
    })().catch(() => ({ header: null, footer: null }));
  }
  return letterheadPromise;
}

async function letterheadBand(buffer: Buffer, anchor: 'top' | 'bottom'): Promise<LetterheadBand> {
  const image = await loadImage(buffer);
  const width = Math.round(image.width);
  const height = Math.round(image.height);
  const canvas = createCanvas(width, height);
  const context = canvas.getContext('2d');
  context.drawImage(image, 0, 0, width, height);
  const bounds = visibleBounds(context.getImageData(0, 0, width, height).data, width, height);
  const padding = Math.round(height * 0.01);
  const top = Math.max(0, bounds.top - padding);
  const bottom = Math.min(height - 1, bounds.bottom + padding);
  const band = createCanvas(width, bottom - top + 1);
  band.getContext('2d').drawImage(canvas, 0, top, width, bottom - top + 1, 0, 0, width, bottom - top + 1);
  const mmPerPixel = PAGE_MM.width / width;
  // Header canvas starts at the top edge of the page; footer canvas ends at the bottom edge.
  const imageTopMm = anchor === 'top' ? 0 : PAGE_MM.height - height * mmPerPixel;
  return { png: band.toBuffer('image/png'), width, height: bottom - top + 1, topMm: imageTopMm + top * mmPerPixel, heightMm: (bottom - top + 1) * mmPerPixel };
}

function visibleBounds(pixels: Uint8ClampedArray, width: number, height: number) {
  let left = width, top = height, right = -1, bottom = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const offset = (y * width + x) * 4;
      const visible = pixels[offset + 3] > 16 && (pixels[offset] < 238 || pixels[offset + 1] < 238 || pixels[offset + 2] < 238);
      if (!visible) continue;
      if (x < left) left = x;
      if (x > right) right = x;
      if (y < top) top = y;
      if (y > bottom) bottom = y;
    }
  }
  return right < 0 ? { left: 0, top: 0, right: width - 1, bottom: height - 1 } : { left, top, right, bottom };
}

export function parseImageDataUrl(value: unknown) {
  const match = /^data:(image\/(?:png|jpe?g|gif|webp|svg\+xml));base64,([A-Za-z0-9+/=\s]+)$/i.exec(String(value ?? ''));
  return match ? Buffer.from(match[2], 'base64') : null;
}

// Signatures and stamps: decode any supported format, trim surrounding whitespace and re-encode as PNG.
export async function normalizeImage(dataUrl: unknown): Promise<KycImage | null> {
  const buffer = parseImageDataUrl(dataUrl);
  if (!buffer?.length) return null;
  try {
    const image = await loadImage(buffer);
    const width = Math.max(1, Math.round(image.width));
    const height = Math.max(1, Math.round(image.height));
    const source = createCanvas(width, height);
    const context = source.getContext('2d');
    context.drawImage(image, 0, 0, width, height);
    const bounds = visibleBounds(context.getImageData(0, 0, width, height).data, width, height);
    const padding = 12;
    const left = Math.max(0, bounds.left - padding);
    const top = Math.max(0, bounds.top - padding);
    const cropWidth = Math.min(width - 1, bounds.right + padding) - left + 1;
    const cropHeight = Math.min(height - 1, bounds.bottom + padding) - top + 1;
    const scale = Math.max(cropWidth, cropHeight) > 900 ? 900 / Math.max(cropWidth, cropHeight) : 1;
    const output = createCanvas(Math.max(1, Math.round(cropWidth * scale)), Math.max(1, Math.round(cropHeight * scale)));
    output.getContext('2d').drawImage(source, left, top, cropWidth, cropHeight, 0, 0, output.width, output.height);
    return { png: output.toBuffer('image/png'), width: output.width, height: output.height };
  } catch {
    return null;
  }
}
