import { Injectable, Logger, OnApplicationShutdown } from '@nestjs/common';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { dirname, join, sep } from 'path';
import { MrzResult, parseMrz } from '../common/mrz';

// Reads the machine-readable zone of a passport or ID card (for example the back of the Qatar ID) from an uploaded
// image or PDF, locally: OCR with tesseract.js and the bundled English data (@tesseract.js-data/eng), PDF pages
// rendered with pdfjs-dist. No file leaves the server. Results only pre-fill the form; staff confirm before saving.

type Worker = { recognize: (image: Buffer) => Promise<{ data: { text: string } }>; setParameters: (params: Record<string, string>) => Promise<unknown>; terminate: () => Promise<unknown> };

const MRZ_CHARACTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789<';
const TARGET_WIDTH = 2000;
const MAX_PDF_PAGES = 2;
const READ_TIMEOUT_MS = 60_000;
// pdfjs-dist is an ES module; a real dynamic import keeps it out of the CommonJS require path.
const importModule = new Function('specifier', 'return import(specifier)') as (specifier: string) => Promise<any>;

@Injectable()
export class IdDocumentReaderService implements OnApplicationShutdown {
  private readonly logger = new Logger(IdDocumentReaderService.name);
  private worker: Promise<Worker> | null = null;
  private queue: Promise<unknown> = Promise.resolve();

  async onApplicationShutdown() {
    if (this.worker) await (await this.worker).terminate().catch(() => undefined);
  }

  // Returns the best MRZ found in the file, or null. Reads are queued so only one OCR job runs at a time.
  read(file: { buffer: Buffer; mimetype?: string; originalname?: string }): Promise<MrzResult | null> {
    const job = this.queue.then(() => this.withTimeout(this.readNow(file)));
    this.queue = job.catch(() => undefined);
    return job;
  }

  private async readNow(file: { buffer: Buffer; mimetype?: string; originalname?: string }) {
    const isPdf = file.mimetype === 'application/pdf' || /\.pdf$/i.test(file.originalname || '') || file.buffer.subarray(0, 5).toString() === '%PDF-';
    const pages = isPdf ? await this.pdfPages(file.buffer) : [file.buffer];
    const worker = await this.getWorker();
    let best: MrzResult | null = null;
    for (const page of pages) {
      for (const image of await this.variants(page)) {
        const { data } = await worker.recognize(image);
        const result = parseMrz(data.text);
        if (result && rank(result) > (best ? rank(best) : -1)) best = result;
        if (best && best.documentNumberCheck === 'OK' && best.expiryValid) return best;
      }
    }
    return best;
  }

  // The MRZ sits at the bottom of the passport data page and of the ID card back: read that band first, enlarged.
  private async variants(source: Buffer) {
    const image = await loadImage(source);
    const scale = Math.min(4, Math.max(1, TARGET_WIDTH / image.width));
    const width = Math.round(image.width * scale);
    const height = Math.round(image.height * scale);
    const draw = (top: number, bandHeight: number) => {
      const canvas = createCanvas(width, Math.round(bandHeight * scale));
      const context = canvas.getContext('2d');
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, top, image.width, bandHeight, 0, 0, canvas.width, canvas.height);
      // Greyscale with a contrast stretch helps OCR on photographed or coloured documents.
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
      const data = pixels.data;
      let min = 255;
      let max = 0;
      for (let index = 0; index < data.length; index += 4) {
        const grey = 0.299 * data[index] + 0.587 * data[index + 1] + 0.114 * data[index + 2];
        data[index] = grey;
        if (grey < min) min = grey;
        if (grey > max) max = grey;
      }
      const range = Math.max(1, max - min);
      for (let index = 0; index < data.length; index += 4) {
        const value = Math.max(0, Math.min(255, ((data[index] - min) * 255) / range));
        data[index] = data[index + 1] = data[index + 2] = value;
      }
      context.putImageData(pixels, 0, 0);
      return canvas.toBuffer('image/png');
    };
    const band = Math.round(image.height * 0.4);
    return [draw(image.height - band, band), draw(0, image.height)].filter(() => width > 0 && height > 0);
  }

  // Renders the first pages of a PDF as PNG images (also used by the document reader for scanned PDFs).
  async pdfPages(buffer: Buffer, maxPages = MAX_PDF_PAGES) {
    const pdfjs = await importModule('pdfjs-dist/legacy/build/pdf.mjs');
    // Fonts for text in the PDF come from the package itself, never from the network.
    const standardFontDataUrl = `${join(dirname(require.resolve('pdfjs-dist/package.json')), 'standard_fonts').split(sep).join('/')}/`;
    const task = pdfjs.getDocument({ data: new Uint8Array(buffer), isEvalSupported: false, disableFontFace: true, useSystemFonts: false, standardFontDataUrl });
    const document = await task.promise;
    const pages: Buffer[] = [];
    try {
      for (let number = 1; number <= Math.min(document.numPages, maxPages); number += 1) {
        const page = await document.getPage(number);
        const base = page.getViewport({ scale: 1 });
        const viewport = page.getViewport({ scale: Math.min(4, Math.max(1.5, TARGET_WIDTH / base.width)) });
        const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
        const context = canvas.getContext('2d');
        context.fillStyle = '#ffffff';
        context.fillRect(0, 0, canvas.width, canvas.height);
        await page.render({ canvas, canvasContext: context, viewport }).promise;
        pages.push(canvas.toBuffer('image/png'));
        page.cleanup();
      }
    } finally {
      await task.destroy();
    }
    return pages;
  }

  private getWorker() {
    if (!this.worker) {
      this.worker = (async () => {
        const { createWorker, OEM, PSM } = await import('tesseract.js');
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const language = require('@tesseract.js-data/eng') as { langPath: string; gzip: boolean };
        const worker = (await createWorker('eng', OEM.LSTM_ONLY, { langPath: language.langPath, gzip: language.gzip, cacheMethod: 'none' })) as unknown as Worker;
        await worker.setParameters({ tessedit_char_whitelist: MRZ_CHARACTERS, tessedit_pageseg_mode: String(PSM.SINGLE_BLOCK) });
        this.logger.log('ID document reader ready (local OCR).');
        return worker;
      })().catch((error) => {
        this.worker = null;
        throw error;
      });
    }
    return this.worker;
  }

  private withTimeout<T>(promise: Promise<T>) {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Reading the document took too long.')), READ_TIMEOUT_MS);
      promise.then((value) => { clearTimeout(timer); resolve(value); }, (error) => { clearTimeout(timer); reject(error); });
    });
  }
}

function rank(result: MrzResult) {
  return { OK: 4, CORRECTED: 2, FAILED: 0 }[result.documentNumberCheck] + (result.expiryValid ? 4 : 0) + (result.expiryDate ? 1 : 0);
}
