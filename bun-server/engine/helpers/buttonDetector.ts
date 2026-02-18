import type { Locator, Page } from 'playwright';
import { microDelay } from './humanBehavior';
import type { ConnectionDegree } from './connectionDetector';

export interface DetectedButtons {
  message: Locator | null;
  connect: Locator | null;
  connectInMoreMenu: Locator | null;
  more: Locator | null;
  pending: Locator | null;
  following: Locator | null;
}

export type ConnectionStrategy =
  | { action: 'message'; button: Locator }
  | { action: 'connect_direct'; button: Locator }
  | { action: 'connect_via_more'; moreButton: Locator; connectButton: Locator }
  | { action: 'follow'; reason: '3rd_degree_no_connect' }
  | { action: 'skip'; reason: 'pending' | 'already_connected' | 'no_action_available' };

const MESSAGE_SELECTORS = [
  'button[aria-label^="Message "]',
  'button[aria-label*="Message" i]:has-text("Message")',
  'button.artdeco-button:has-text("Message")',
  'button:has-text("Message")',
];

const CONNECT_SELECTORS = [
  'button[aria-label^="Invite "]',
  'button[aria-label*="Invite" i]:has-text("Connect")',
  'button.artdeco-button--primary:has-text("Connect")',
  'button:has-text("Connect")',
  '[data-control-name="connect"]',
];

const PENDING_SELECTORS = [
  'button[aria-label*="Pending" i]',
  'button:has-text("Pending")',
];

const FOLLOWING_SELECTORS = [
  'button[aria-label*="Following" i]',
  'button:has-text("Following")',
];

const MORE_SELECTORS = [
  'main button[aria-label="More actions"]',
  'button[aria-label="More actions"]',
  'button[aria-label*="More actions" i]',
  'main button.artdeco-dropdown__trigger:has-text("More")',
  'button.artdeco-dropdown__trigger:has-text("More")',
];

const CONNECT_IN_MORE_SELECTORS = [
  'div[role="menu"] button:has-text("Connect")',
  'div[role="menu"] [role="menuitem"]:has-text("Connect")',
  '.artdeco-dropdown__content-inner button:has-text("Connect")',
  '.artdeco-dropdown__content-inner [role="menuitem"]:has-text("Connect")',
  'li[role="menuitem"]:has-text("Connect")',
];

async function isEnabled(locator: Locator): Promise<boolean> {
  const disabled = await locator.getAttribute('disabled').catch(() => null);
  const ariaDisabled = await locator.getAttribute('aria-disabled').catch(() => null);
  return disabled === null && ariaDisabled !== 'true';
}

async function findVisible(
  page: Page,
  selectors: readonly string[],
  timeoutMs: number
): Promise<Locator | null> {
  const maxCandidatesPerSelector = 20;

  for (const selector of selectors) {
    try {
      const root = page.locator(selector);
      const count = Math.min(await root.count(), maxCandidatesPerSelector);

      for (let i = 0; i < count; i += 1) {
        const locator = root.nth(i);
        const candidateTimeout = i === 0 ? timeoutMs : 250;
        const visible = await locator.isVisible({ timeout: candidateTimeout }).catch(() => false);
        if (!visible) continue;
        const isSearch = await locator
          .evaluate((el) => {
            const isSearchInput =
              el.matches('input[role="combobox"][aria-label*="Search" i]') ||
              el.matches('input.search-global-typeahead__input') ||
              el.matches('[data-view-name="search-global-typeahead-input"]');
            const inSearchContainer = Boolean(
              el.closest('.search-global-typeahead, .global-nav__search, [data-view-name*="search-global-typeahead"]')
            );
            return isSearchInput || inSearchContainer;
          })
          .catch(() => false);
        if (isSearch) continue;
        if (!(await isEnabled(locator))) continue;
        return locator;
      }
    } catch {
      // try next selector
    }
  }

  return null;
}

export async function findConnectInMoreMenu(page: Page): Promise<Locator | null> {
  return findVisible(page, CONNECT_IN_MORE_SELECTORS, 1200);
}

/**
 * Scans all relevant profile action buttons and peeks inside "More actions"
 * to detect hidden "Connect" options for 3rd-degree profiles.
 */
export async function detectProfileButtons(page: Page, firstName: string): Promise<DetectedButtons> {
  console.log(`[ButtonDetector] scanning action buttons for "${firstName}"`);

  const escapedName = firstName.replace(/"/g, '').trim();
  const messageSelectors = escapedName
    ? ([`button[aria-label^="Message ${escapedName}" i]`, ...MESSAGE_SELECTORS] as const)
    : MESSAGE_SELECTORS;
  const connectSelectors = escapedName
    ? ([`button[aria-label^="Invite ${escapedName}" i]`, ...CONNECT_SELECTORS] as const)
    : CONNECT_SELECTORS;

  const buttons: DetectedButtons = {
    message: await findVisible(page, messageSelectors, 1000),
    connect: await findVisible(page, connectSelectors, 1000),
    connectInMoreMenu: null,
    more: await findVisible(page, MORE_SELECTORS, 1000),
    pending: await findVisible(page, PENDING_SELECTORS, 700),
    following: await findVisible(page, FOLLOWING_SELECTORS, 700),
  };

  if (buttons.more) {
    try {
      await buttons.more.click({ timeout: 2000 });
      await microDelay();

      buttons.connectInMoreMenu = await findConnectInMoreMenu(page);
    } catch (error) {
      console.log(
        `[ButtonDetector] failed to peek inside More menu: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    } finally {
      await page.keyboard.press('Escape').catch(() => undefined);
      await microDelay();
    }
  }

  console.log('[ButtonDetector] result', {
    hasMessage: Boolean(buttons.message),
    hasConnect: Boolean(buttons.connect),
    hasConnectInMore: Boolean(buttons.connectInMoreMenu),
    hasMore: Boolean(buttons.more),
    hasPending: Boolean(buttons.pending),
    hasFollowing: Boolean(buttons.following),
  });

  return buttons;
}

export function determineConnectionStrategy(
  buttons: DetectedButtons,
  connectionDegree: ConnectionDegree
): ConnectionStrategy {
  if (buttons.pending || connectionDegree === 'pending') {
    return { action: 'skip', reason: 'pending' };
  }

  if (buttons.message && !buttons.connect && !buttons.connectInMoreMenu) {
    return { action: 'message', button: buttons.message };
  }

  if (buttons.connect) {
    return { action: 'connect_direct', button: buttons.connect };
  }

  if (buttons.more && buttons.connectInMoreMenu) {
    return {
      action: 'connect_via_more',
      moreButton: buttons.more,
      connectButton: buttons.connectInMoreMenu,
    };
  }

  if (connectionDegree === '1st') {
    return { action: 'skip', reason: 'already_connected' };
  }

  if (connectionDegree === '3rd') {
    return { action: 'follow', reason: '3rd_degree_no_connect' };
  }

  return { action: 'skip', reason: 'no_action_available' };
}
