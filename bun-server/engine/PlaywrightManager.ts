import {
  chromium,
  type Browser,
  type BrowserContext,
  type BrowserContextOptions,
  type Page,
} from 'playwright';
import * as fs from 'fs';
import * as path from 'path';
import { lookup } from 'node:dns/promises';
import { logger } from '../logger';

const STATE_PATH = path.join(process.cwd(), 'session.json');

interface AdsPowerStartResponse {
  code: number;
  msg?: string;
  data?: {
    ws?: {
      puppeteer?: string;
      playwright?: string;
    };
  };
}

interface AdsPowerStopResponse {
  code: number;
  msg?: string;
}

export interface PlaywrightLaunchOptions {
  adspowerProfileId?: string | null;
}

export class PlaywrightManager {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private activePage: Page | null = null;
  private activeAdsPowerProfileId: string | null = null;

  async launch(options: PlaywrightLaunchOptions = {}): Promise<{ browser: Browser; context: BrowserContext }> {
    const requestedAdsPowerProfileId = options.adspowerProfileId?.trim() || null;

    if (
      this.browser &&
      this.context &&
      this.activeAdsPowerProfileId === requestedAdsPowerProfileId
    ) {
      return { browser: this.browser, context: this.context };
    }

    if (this.browser || this.context) {
      await this.cleanup();
    }

    if (requestedAdsPowerProfileId) {
      await this.launchWithAdsPower(requestedAdsPowerProfileId);
    } else {
      await this.launchLocalChromium();
    }

    if (!this.browser || !this.context) {
      throw new Error('Failed to initialize browser context');
    }

    return { browser: this.browser, context: this.context };
  }

  async getPage(options: PlaywrightLaunchOptions = {}): Promise<Page> {
    if (!this.context) {
      await this.launch(options);
    }

    if (this.activePage && (await this.isPageUsable(this.activePage))) {
      await this.closeExtraPages(this.activePage);
      await this.activePage.bringToFront().catch(() => undefined);
      return this.activePage;
    }

    const pages = this.context!.pages();
    for (const page of pages) {
      if (await this.isPageUsable(page)) {
        this.activePage = page;
        await this.closeExtraPages(page);
        await page.bringToFront().catch(() => undefined);
        return page;
      }

      await page.close().catch(() => undefined);
    }

    const page = await this.context!.newPage();
    this.activePage = page;
    await page.bringToFront().catch(() => undefined);
    await this.closeExtraPages(page);
    return page;
  }

  async cleanup() {
    const adsPowerProfileId = this.activeAdsPowerProfileId;

    if (!adsPowerProfileId) {
      await this.persistLocalStorageState();
    }

    if (this.browser) {
      await this.browser.close().catch(() => undefined);
    }

    this.browser = null;
    this.context = null;
    this.activePage = null;
    this.activeAdsPowerProfileId = null;

    if (adsPowerProfileId) {
      await this.stopAdsPowerProfile(adsPowerProfileId).catch((error) => {
        logger.warn('Failed to stop AdsPower profile', {
          adspowerProfileId: adsPowerProfileId,
          error: error instanceof Error ? error.message : String(error),
        });
      });
    }
  }

  private async launchLocalChromium() {
    this.browser = await chromium.launch({
      headless: process.env.HEADLESS !== 'false',
      args: [
        '--start-maximized',
        '--disable-blink-features=AutomationControlled',
        '--no-first-run',
        '--no-default-browser-check',
        '--disable-sync',
        '--disable-background-networking',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-client-side-phishing-detection',
        '--disable-default-apps',
        '--disable-extensions',
        '--disable-hang-monitor',
        '--disable-popup-blocking',
        '--disable-prompt-on-repost',
        '--disable-renderer-backgrounding',
        '--metrics-recording-only',
        '--password-store=basic',
        '--use-mock-keychain',
      ],
    });

    const contextOptions: BrowserContextOptions = {
      viewport: null,
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    };

    if (fs.existsSync(STATE_PATH)) {
      contextOptions.storageState = STATE_PATH;
    }

    this.context = await this.browser.newContext(contextOptions);
    this.activePage = null;
    this.bindContextPageHandler();
    this.activeAdsPowerProfileId = null;

    logger.info('Launched local Chromium', {
      headless: process.env.HEADLESS !== 'false',
    });
  }

  private async launchWithAdsPower(adspowerProfileId: string) {
    const rawWsEndpoint = await this.startAdsPowerProfile(adspowerProfileId);
    const wsEndpoint = await this.normalizeAdsPowerWsEndpoint(rawWsEndpoint);
    this.browser = await this.connectAdsPowerWithRetry(wsEndpoint, adspowerProfileId);

    const existingContext = this.browser.contexts()[0];
    this.context = existingContext ?? (await this.browser.newContext({ viewport: null }));
    this.activePage = null;
    this.bindContextPageHandler();
    this.activeAdsPowerProfileId = adspowerProfileId;

    logger.info('Connected to AdsPower browser profile', {
      adspowerProfileId,
      wsEndpoint,
    });
  }

  private getAdsPowerBaseUrl() {
    return process.env.ADSPOWER_BASE_URL || 'http://localhost:50325';
  }

  private getAdsPowerHeaders() {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    const apiKey = process.env.ADSPOWER_API_KEY;
    if (apiKey) {
      headers.Authorization = `Bearer ${apiKey}`;
    }

    return headers;
  }

  private async startAdsPowerProfile(adspowerProfileId: string) {
    const baseUrl = this.getAdsPowerBaseUrl();
    const response = await fetch(
      `${baseUrl}/api/v1/browser/start?user_id=${encodeURIComponent(adspowerProfileId)}`,
      {
        method: 'GET',
        headers: this.getAdsPowerHeaders(),
        signal: AbortSignal.timeout(15000),
      }
    );

    if (!response.ok) {
      throw new Error(`AdsPower start failed with status ${response.status}`);
    }

    const payload = (await response.json()) as AdsPowerStartResponse;
    if (payload.code !== 0) {
      throw new Error(payload.msg || 'AdsPower failed to start profile');
    }

    const wsEndpoint = payload.data?.ws?.playwright || payload.data?.ws?.puppeteer;
    if (!wsEndpoint) {
      throw new Error('AdsPower returned no WebSocket endpoint');
    }

    return wsEndpoint;
  }

  private async normalizeAdsPowerWsEndpoint(wsEndpoint: string) {
    try {
      const parsed = new URL(wsEndpoint);
      const localHosts = new Set(['127.0.0.1', 'localhost', '0.0.0.0']);
      if (!localHosts.has(parsed.hostname)) {
        return wsEndpoint;
      }

      const configuredWsHost = process.env.ADSPOWER_WS_HOST?.trim();
      const fallbackHost = (() => {
        try {
          return new URL(this.getAdsPowerBaseUrl()).hostname;
        } catch {
          return null;
        }
      })();

      const chosenHost = configuredWsHost || fallbackHost || 'host.docker.internal';
      const resolvedHost = await this.resolveHostToIp(chosenHost);
      parsed.hostname = resolvedHost;

      const normalized = parsed.toString();
      logger.info('Normalized AdsPower WebSocket endpoint for remote reachability', {
        original: wsEndpoint,
        chosenHost,
        resolvedHost,
        normalized,
      });
      return normalized;
    } catch {
      return wsEndpoint;
    }
  }

  private async resolveHostToIp(host: string) {
    const isLikelyIp = /^[0-9.]+$/.test(host) || host.includes(':');
    if (isLikelyIp) return host;

    try {
      const { address } = await lookup(host);
      return address;
    } catch (error) {
      logger.warn('Failed resolving AdsPower WS host to IP, using hostname directly', {
        host,
        error: error instanceof Error ? error.message : String(error),
      });
      return host;
    }
  }

  private async connectAdsPowerWithRetry(wsEndpoint: string, adspowerProfileId: string) {
    const retries = Number(process.env.ADSPOWER_CONNECT_RETRIES || 8);
    const connectTimeoutMs = Number(process.env.ADSPOWER_CONNECT_TIMEOUT_MS || 10000);
    let lastError: unknown = null;

    for (let attempt = 1; attempt <= retries; attempt += 1) {
      try {
        return await chromium.connectOverCDP(wsEndpoint, { timeout: connectTimeoutMs });
      } catch (error) {
        lastError = error;
        logger.warn('AdsPower CDP connect attempt failed', {
          adspowerProfileId,
          attempt,
          retries,
          connectTimeoutMs,
          wsEndpoint,
          error: error instanceof Error ? error.message : String(error),
        });

        if (attempt < retries) {
          const waitMs = 350 * attempt;
          await new Promise((resolve) => setTimeout(resolve, waitMs));
        }
      }
    }

    throw new Error(
      `Failed connecting to AdsPower CDP after ${retries} attempts: ${
        lastError instanceof Error ? lastError.message : String(lastError)
      }`
    );
  }

  private async stopAdsPowerProfile(adspowerProfileId: string) {
    const baseUrl = this.getAdsPowerBaseUrl();
    const response = await fetch(
      `${baseUrl}/api/v1/browser/stop?user_id=${encodeURIComponent(adspowerProfileId)}`,
      {
        method: 'GET',
        headers: this.getAdsPowerHeaders(),
        signal: AbortSignal.timeout(10000),
      }
    );

    if (!response.ok) {
      throw new Error(`AdsPower stop failed with status ${response.status}`);
    }

    const payload = (await response.json()) as AdsPowerStopResponse;
    if (payload.code !== 0) {
      throw new Error(payload.msg || 'AdsPower failed to stop profile');
    }
  }

  private async persistLocalStorageState() {
    if (!this.context) return;

    try {
      const state = await this.context.storageState();
      fs.writeFileSync(STATE_PATH, JSON.stringify(state));
    } catch (error) {
      logger.warn('Failed to persist local browser storage state', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private bindContextPageHandler() {
    if (!this.context) return;

    this.context.on('page', (page) => {
      void this.handleNewPage(page);
    });
  }

  private async handleNewPage(page: Page) {
    if (!this.activePage || this.activePage.isClosed()) {
      this.activePage = page;
      return;
    }

    if (page === this.activePage) {
      return;
    }

    await page.waitForLoadState('domcontentloaded', { timeout: 2000 }).catch(() => undefined);
    await page.close().catch(() => undefined);
    logger.info('Closed extra browser tab to enforce single-tab automation', {
      url: page.url(),
    });
  }

  private async isPageUsable(page: Page) {
    if (page.isClosed()) return false;

    try {
      await page.evaluate(() => true);
      return true;
    } catch {
      return false;
    }
  }

  private async closeExtraPages(activePage: Page) {
    if (!this.context) return;

    for (const page of this.context.pages()) {
      if (page === activePage || page.isClosed()) continue;

      await page.close().catch(() => undefined);
      logger.info('Closed extra browser tab to enforce single-tab automation', {
        url: page.url(),
      });
    }
  }
}
