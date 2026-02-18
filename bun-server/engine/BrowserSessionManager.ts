import { lookup } from 'node:dns/promises';
import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';
import { AdsPowerManager } from './AdsPowerManager';
import { logger } from '../logger';

interface BrowserSession {
  profileId: string;
  adspowerProfileId: string;
  wsEndpoint: string;
  browser: Browser;
  context: BrowserContext;
  page: Page;
  startedAt: string;
}

function isAdsPowerStartupPage(url: string): boolean {
  if (!url) return false;

  try {
    const parsed = new URL(url);
    return parsed.hostname.toLowerCase() === 'start.adspower.net';
  } catch {
    return url.toLowerCase().includes('start.adspower.net');
  }
}

export class BrowserSessionManager {
  private sessions = new Map<string, BrowserSession>();

  async getSession(profileId: string, adspowerProfileId: string): Promise<Page> {
    const existing = this.sessions.get(profileId);
    if (existing) {
      const connected = existing.browser.isConnected() && (await this.isPageUsable(existing.page));
      if (connected) {
        return existing.page;
      }

      this.sessions.delete(profileId);
      await existing.browser.close().catch(() => undefined);
    }

    logger.info('Starting new persistent AdsPower session', {
      profileId,
      adspowerProfileId,
    });

    const { wsEndpoint: rawWsEndpoint } = await AdsPowerManager.startProfile(adspowerProfileId);
    const wsEndpoint = await this.normalizeWsEndpoint(rawWsEndpoint);
    await this.sleep(3000);

    const browser = await chromium.connectOverCDP(wsEndpoint, {
      timeout: Number(process.env.ADSPOWER_CONNECT_TIMEOUT_MS || 12000),
    });

    const context = browser.contexts()[0] ?? (await browser.newContext({ viewport: null }));
    const page = await this.getPrimaryPage(context);

    // Warm up the session before running actions.
    await page
      .goto('https://www.linkedin.com/feed', { waitUntil: 'domcontentloaded', timeout: 15000 })
      .catch((error) => {
        logger.warn('AdsPower session warmup navigation failed', {
          profileId,
          error: error instanceof Error ? error.message : String(error),
        });
      });
    await page.waitForTimeout(2000).catch(() => undefined);

    const session: BrowserSession = {
      profileId,
      adspowerProfileId,
      wsEndpoint,
      browser,
      context,
      page,
      startedAt: new Date().toISOString(),
    };

    this.sessions.set(profileId, session);
    return page;
  }

  async isSessionValid(profileId: string): Promise<boolean> {
    const session = this.sessions.get(profileId);
    if (!session || !session.browser.isConnected()) return false;
    if (!(await this.isPageUsable(session.page))) return false;

    try {
      const url = session.page.url();
      return url.includes('/feed') || url.includes('/in/') || url.includes('/mynetwork');
    } catch {
      return false;
    }
  }

  async closeSession(profileId: string): Promise<void> {
    const session = this.sessions.get(profileId);
    if (!session) return;

    this.sessions.delete(profileId);
    await this.sleep(2000);
    await session.browser.close().catch(() => undefined);

    if (process.env.ADSPOWER_STOP_ON_SESSION_CLOSE === 'true') {
      await AdsPowerManager.stopProfile(session.adspowerProfileId).catch(() => undefined);
    }
  }

  async closeAll(): Promise<void> {
    const profileIds = Array.from(this.sessions.keys());
    for (const profileId of profileIds) {
      await this.closeSession(profileId);
    }
  }

  private async isPageUsable(page: Page): Promise<boolean> {
    if (page.isClosed()) return false;
    try {
      await page.evaluate(() => true);
      return true;
    } catch {
      return false;
    }
  }

  private async getPrimaryPage(context: BrowserContext): Promise<Page> {
    const openPages = context.pages().filter((entry) => !entry.isClosed());
    let page = openPages.find((entry) => !isAdsPowerStartupPage(entry.url()));

    if (!page) {
      page = openPages[0] ?? (await context.newPage());

      // Do not close the last startup tab first; that can terminate the AdsPower window.
      if (isAdsPowerStartupPage(page.url())) {
        await page
          .goto('about:blank', {
            waitUntil: 'domcontentloaded',
            timeout: 8000,
          })
          .catch(() => undefined);
      }
    }

    await page.bringToFront().catch(() => undefined);
    return page;
  }

  private async normalizeWsEndpoint(wsEndpoint: string): Promise<string> {
    try {
      const parsed = new URL(wsEndpoint);
      const localHosts = new Set(['127.0.0.1', 'localhost', '0.0.0.0']);
      if (!localHosts.has(parsed.hostname)) {
        return wsEndpoint;
      }

      const configuredWsHost = process.env.ADSPOWER_WS_HOST?.trim();
      const fallbackHost = (() => {
        try {
          return new URL(process.env.ADSPOWER_BASE_URL || 'http://localhost:50325').hostname;
        } catch {
          return null;
        }
      })();

      const host = configuredWsHost || fallbackHost || 'host.docker.internal';
      parsed.hostname = await this.resolveHost(host);
      return parsed.toString();
    } catch {
      return wsEndpoint;
    }
  }

  private async resolveHost(host: string): Promise<string> {
    if (/^[0-9.]+$/.test(host) || host.includes(':')) {
      return host;
    }

    try {
      const { address } = await lookup(host);
      return address;
    } catch {
      return host;
    }
  }

  private async sleep(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }
}

export const browserSessionManager = new BrowserSessionManager();
