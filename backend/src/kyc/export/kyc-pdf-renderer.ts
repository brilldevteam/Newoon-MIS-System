import { Injectable, Logger, OnModuleDestroy, ServiceUnavailableException } from '@nestjs/common';
import { execFile } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';
import type { Browser } from 'puppeteer-core';
import puppeteer from 'puppeteer-core';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);
const RENDER_TIMEOUT_MS = 45000;

export type PdfRenderOptions = { headerTemplate: string; footerTemplate: string; marginTopMm: number; marginBottomMm: number; marginLeftMm: number; marginRightMm: number };

// One long-lived headless Chromium shared by all requests, with a small concurrency limit,
// instead of launching a new browser process for every download.
@Injectable()
export class KycPdfRenderer implements OnModuleDestroy {
  private readonly logger = new Logger(KycPdfRenderer.name);
  private browser: Promise<Browser> | null = null;
  private executable: Promise<string> | null = null;
  private active = 0;
  private readonly waiting: Array<() => void> = [];
  private readonly maxConcurrent = Math.max(1, Number(process.env.PDF_RENDER_CONCURRENCY) || 2);

  async render(html: string, options: PdfRenderOptions): Promise<Buffer> {
    await this.acquire();
    try {
      return await this.renderOnce(html, options);
    } finally {
      this.release();
    }
  }

  async onModuleDestroy() {
    const browser = await this.browser?.catch(() => null);
    this.browser = null;
    await browser?.close().catch(() => undefined);
  }

  private async renderOnce(html: string, options: PdfRenderOptions) {
    const browser = await this.getBrowser();
    const page = await browser.newPage();
    let timer: NodeJS.Timeout | undefined;
    try {
      const work = (async () => {
        // Documents are fully self-contained; block every network request.
        await page.setRequestInterception(true);
        page.on('request', (request) => {
          const url = request.url();
          if (url.startsWith('data:') || url === 'about:blank') void request.continue();
          else void request.abort();
        });
        await page.setContent(html, { waitUntil: 'load', timeout: RENDER_TIMEOUT_MS });
        await page.evaluate('document.fonts.ready');
        return page.pdf({
          format: 'A4',
          printBackground: true,
          displayHeaderFooter: true,
          headerTemplate: options.headerTemplate,
          footerTemplate: options.footerTemplate,
          margin: {
            top: `${options.marginTopMm.toFixed(2)}mm`,
            bottom: `${options.marginBottomMm.toFixed(2)}mm`,
            left: `${options.marginLeftMm}mm`,
            right: `${options.marginRightMm}mm`
          },
          timeout: RENDER_TIMEOUT_MS
        });
      })();
      const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`PDF rendering exceeded ${RENDER_TIMEOUT_MS / 1000}s`)), RENDER_TIMEOUT_MS + 5000);
      });
      return Buffer.from(await Promise.race([work, timeout]));
    } catch (error) {
      this.logger.error(`KYC PDF rendering failed: ${(error as Error).message}`);
      if (!browser.connected) this.browser = null;
      throw new ServiceUnavailableException('The PDF could not be generated right now. Please try again; if it keeps failing, ask an administrator to check the server PDF renderer (Chromium).');
    } finally {
      clearTimeout(timer);
      await page.close().catch(() => undefined);
    }
  }

  private getBrowser() {
    if (!this.browser) {
      this.browser = (async () => {
        const executablePath = await this.resolveExecutable();
        const browser = await puppeteer.launch({
          executablePath,
          headless: true,
          args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--font-render-hinting=none']
        });
        browser.on('disconnected', () => {
          this.browser = null;
        });
        this.logger.log(`PDF renderer started (${executablePath})`);
        return browser;
      })().catch((error) => {
        this.browser = null;
        this.logger.error(`Unable to start Chromium for PDF rendering: ${(error as Error).message}`);
        throw new ServiceUnavailableException('PDF generation requires Chromium. Install Google Chrome or Chromium on the server, or set CHROMIUM_PATH to its executable.');
      });
    }
    return this.browser;
  }

  private resolveExecutable() {
    if (!this.executable) {
      this.executable = (async () => {
        const localAppData = process.env.LOCALAPPDATA;
        const candidates = [
          process.env.CHROMIUM_PATH,
          '/usr/bin/google-chrome-stable',
          '/usr/bin/google-chrome',
          '/usr/bin/chromium',
          '/usr/bin/chromium-browser',
          '/snap/bin/chromium',
          'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
          'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
          localAppData ? join(localAppData, 'Google', 'Chrome', 'Application', 'chrome.exe') : undefined,
          'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
          'google-chrome-stable',
          'chromium',
          'chromium-browser'
        ].filter(Boolean) as string[];
        for (const candidate of candidates) {
          if (candidate.includes('/') || candidate.includes('\\')) {
            if (existsSync(candidate)) return candidate;
            continue;
          }
          try {
            const { stdout } = await execFileAsync(process.platform === 'win32' ? 'where' : 'which', [candidate], { timeout: 5000, windowsHide: true });
            const path = stdout.split(/\r?\n/)[0]?.trim();
            if (path) return path;
          } catch {
            // Try the next candidate.
          }
        }
        throw new Error('No Chrome/Chromium executable found');
      })().catch((error) => {
        this.executable = null;
        throw error;
      });
    }
    return this.executable;
  }

  private acquire() {
    if (this.active < this.maxConcurrent) {
      this.active++;
      return Promise.resolve();
    }
    return new Promise<void>((resolve) => this.waiting.push(() => {
      this.active++;
      resolve();
    }));
  }

  private release() {
    this.active--;
    this.waiting.shift()?.();
  }
}
