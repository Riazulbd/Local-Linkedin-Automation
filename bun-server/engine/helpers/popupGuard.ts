import type { Page } from 'playwright';
import { microDelay, thinkingPause } from './humanBehavior';

interface PopupHandler {
  name: string;
  detectSelector: string;
  action: 'dismiss' | 'click' | 'escape';
  clickSelector?: string;
}

const POPUP_HANDLERS: PopupHandler[] = [
  {
    name: 'connection_note_modal',
    detectSelector: '[data-test-modal-id="send-invite-modal"]',
    action: 'click',
    clickSelector: 'button[aria-label="Send without a note"]',
  },
  {
    name: 'grow_network_banner',
    detectSelector: '.mn-grow-your-network-callout',
    action: 'dismiss',
    clickSelector: '[aria-label="Dismiss"]',
  },
  {
    name: 'download_app_popup',
    detectSelector: '[data-test-modal-id="app-download-banner"]',
    action: 'click',
    clickSelector: 'button[aria-label*="dismiss"], button[aria-label*="close"], button[aria-label*="Close"]',
  },
  {
    name: 'cookie_consent',
    detectSelector: '#artdeco-global-alert-container button[data-test-global-alert-action]',
    action: 'click',
    clickSelector: '#artdeco-global-alert-container button[data-test-global-alert-action]',
  },
  {
    name: 'captcha',
    detectSelector: '[data-test-modal-id="challenge"]',
    action: 'escape',
  },
  {
    name: 'invitation_sent_toast',
    detectSelector: '.artdeco-toast-item--visible',
    action: 'dismiss',
    clickSelector: '.artdeco-toast-item--visible button[aria-label="Dismiss"]',
  },
  {
    name: 'people_also_viewed',
    detectSelector: '[data-test-modal-id="profile-share-modal"]',
    action: 'escape',
  },
  {
    name: 'premium_upsell',
    detectSelector: '[data-test-modal-id="premium-upgrade-modal"]',
    action: 'escape',
  },
  {
    name: 'login_wall',
    detectSelector: '.authwall-join-form',
    action: 'escape',
  },
  {
    name: 'sales_nav_trial',
    detectSelector: '[data-test-modal-id="trial-modal"]',
    action: 'click',
    clickSelector: 'button[aria-label*="dismiss"], [aria-label*="No thanks"], [aria-label*="Close"]',
  },
  {
    name: 'messaging_floater',
    detectSelector: '.msg-overlay-list-bubble',
    action: 'click',
    clickSelector: '.msg-overlay-list-bubble button[aria-label*="Close"]',
  },
];

export class PopupError extends Error {
  constructor(public type: 'captcha' | 'login_wall' | 'unknown', message: string) {
    super(message);
    this.name = 'PopupError';
  }
}

export async function dismissPopups(page: Page): Promise<void> {
  for (const handler of POPUP_HANDLERS) {
    try {
      const el = page.locator(handler.detectSelector).first();
      const visible = await el.isVisible({ timeout: 600 });
      if (!visible) continue;

      console.log(`[PopupGuard] Detected: ${handler.name}`);

      if (handler.name === 'captcha' || handler.name === 'login_wall') {
        throw new PopupError(
          handler.name === 'captcha' ? 'captcha' : 'login_wall',
          `Blocked by: ${handler.name}`
        );
      }

      if (handler.action === 'escape') {
        await page.keyboard.press('Escape');
        await microDelay();
        continue;
      }

      if (handler.action === 'click' || handler.action === 'dismiss') {
        if (handler.clickSelector) {
          const btn = page.locator(handler.clickSelector).first();
          if (await btn.isVisible({ timeout: 500 })) {
            await thinkingPause();
            await btn.click();
            await microDelay();
          }
        }
      }
    } catch (e) {
      if (e instanceof PopupError) throw e;
    }
  }
}

export async function withPopupGuard<T>(
  page: Page,
  action: () => Promise<T>,
  retries = 2
): Promise<T> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    await dismissPopups(page);
    try {
      return await action();
    } catch (e) {
      if (e instanceof PopupError) throw e;
      if (attempt < retries) {
        await dismissPopups(page);
        await microDelay();
      } else {
        throw e;
      }
    }
  }
  throw new Error('withPopupGuard: exhausted retries');
}
