import type { Page } from 'playwright';
import { LoginManager } from './LoginManager';
import { navigationDelay } from './helpers/humanBehavior';
import { logger } from '../logger';

interface SessionHealOptions {
  twoFactorTimeoutMs?: number;
}

export class SessionHealer {
  private loginManager = new LoginManager();

  async healSession(
    profileId: string,
    adspowerProfileId: string,
    page: Page,
    options: SessionHealOptions = {}
  ): Promise<boolean> {
    logger.info('Checking LinkedIn session health', { profileId, adspowerProfileId });

    try {
      await page.goto('https://www.linkedin.com/feed', {
        waitUntil: 'domcontentloaded',
        timeout: 20000,
      });
      await navigationDelay();
    } catch (error) {
      logger.warn('Session warmup navigation failed', {
        profileId,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }

    const url = page.url();
    if (url.includes('/feed') || url.includes('/mynetwork') || url.includes('/in/')) {
      return true;
    }

    if (url.includes('/login') || url.includes('/authwall') || url.includes('/uas/login')) {
      const result = await this.loginManager.loginProfile(profileId, adspowerProfileId, page, {
        twoFactorTimeoutMs: options.twoFactorTimeoutMs,
      });
      return result === 'success' || result === 'already_logged_in';
    }

    logger.warn('Session healer found unknown LinkedIn state', {
      profileId,
      url,
    });
    return false;
  }
}
