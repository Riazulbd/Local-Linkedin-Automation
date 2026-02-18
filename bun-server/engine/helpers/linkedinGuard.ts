import type { Page } from 'playwright';
import { humanClick, randomBetween, sleep } from './humanBehavior';

// Run before every action to clear interfering overlays.
export async function dismissPopups(page: Page): Promise<void> {
  const dismissCandidates = [
    '[aria-label="Dismiss"]',
    '[aria-label="Close"]',
    'button:has-text("Dismiss")',
    'button:has-text("Not now")',
    'button:has-text("Skip")',
    'button:has-text("Maybe later")',
    'button:has-text("No thanks")',
    'button:has-text("Got it")',
    'button:has-text("Allow")',
    '.artdeco-modal__dismiss',
    '[data-test-modal-close-btn]',
    '.msg-overlay-bubble-header__controls button[aria-label="Close your conversation"]',
    'button:has-text("Accept")',
    '.authwall-join-form button:has-text("Join")',
  ];

  for (const selector of dismissCandidates) {
    try {
      const el = page.locator(selector).first();
      if (await el.isVisible({ timeout: 800 })) {
        await humanClick(page, el);
        await sleep(randomBetween(500, 1200));
        break;
      }
    } catch {
      // Keep scanning candidates.
    }
  }
}

export async function detectRateLimit(page: Page): Promise<boolean> {
  const indicators = [
    'text="Let\'s do a quick security check"',
    'text="Please complete the security check"',
    'text="You\'re doing that too much"',
    'text="suspicious activity"',
    '.captcha-challenge',
    '[data-test-captcha]',
  ];

  for (const sel of indicators) {
    try {
      if (await page.locator(sel).isVisible({ timeout: 500 })) return true;
    } catch {
      // Continue.
    }
  }

  return false;
}

export async function detectLoggedOut(page: Page): Promise<boolean> {
  try {
    const url = page.url();
    if (url.includes('/login') || url.includes('/checkpoint/lg/login') || url.includes('/authwall')) {
      return true;
    }

    const loginBtn = page.locator('a[href*="/login"]').first();
    return await loginBtn.isVisible({ timeout: 500 });
  } catch {
    return false;
  }
}

export async function safeWaitForSettle(page: Page): Promise<void> {
  try {
    await page.waitForLoadState('networkidle', { timeout: 8000 });
  } catch {
    await sleep(randomBetween(2000, 4000));
  }

  await sleep(randomBetween(300, 800));
}

export async function findVisibleButton(
  page: Page,
  selectors: string[] | readonly string[],
  timeoutMs = 2000
): Promise<{ locator: import('playwright').Locator; selectorUsed: string } | null> {
  const maxCandidatesPerSelector = 30;

  for (const sel of selectors) {
    try {
      const root = page.locator(sel);
      const count = Math.min(await root.count(), maxCandidatesPerSelector);
      if (count === 0) {
        continue;
      }

      for (let idx = 0; idx < count; idx += 1) {
        const locator = root.nth(idx);
        const candidateTimeout = idx === 0 ? timeoutMs : 300;

        if (!(await locator.isVisible({ timeout: candidateTimeout }))) {
          continue;
        }

        const disabled = await locator.getAttribute('disabled').catch(() => null);
        const ariaDisabled = await locator.getAttribute('aria-disabled').catch(() => null);
        if (disabled !== null || ariaDisabled === 'true') {
          continue;
        }

        return { locator, selectorUsed: sel };
      }
    } catch {
      // Continue.
    }
  }

  return null;
}
