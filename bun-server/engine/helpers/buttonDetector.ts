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

const ACTION_CONTAINER_SELECTORS = [
  'ul[class*="vnNIgiulPPXqQrqJbqGMhhdCMWIdGnxmPJhlHU"] ~ div.nGOMxDwRwzbhggBWRdqlNUbgklupeTaZPLZBo',
  'div.nGOMxDwRwzbhggBWRdqlNUbgklupeTaZPLZBo',
  'div.QibvhqjSyNICBfzkqMTgfyDVOTsCUYeyHk',
  'div.entry-point',
  '.pv-top-card',
] as const;

const OPEN_DROPDOWN_SELECTORS = [
  'div.artdeco-dropdown__content[aria-hidden="false"]',
  'div.artdeco-dropdown__content:not([aria-hidden="true"])',
  'div.bdRelTpFILSnaGkmJSoyZfNhXHSDqnSFNTY[aria-hidden="false"]',
  'div.artdeco-dropdown__content-inner',
] as const;

const CONNECT_IN_DROPDOWN_SELECTORS = [
  'div[role="button"][aria-label*="Invite" i]',
  'div[role="button"]:has-text("Connect")',
  'div.artdeco-dropdown__item:has-text("Connect")',
  'button:has-text("Connect")',
] as const;

async function isEnabled(locator: Locator): Promise<boolean> {
  const disabled = await locator.getAttribute('disabled').catch(() => null);
  const ariaDisabled = await locator.getAttribute('aria-disabled').catch(() => null);
  return disabled === null && ariaDisabled !== 'true';
}

async function firstVisibleInScope(
  root: Page | Locator,
  selectors: readonly string[],
  timeoutMs: number
): Promise<Locator | null> {
  const maxCandidatesPerSelector = 25;

  for (const selector of selectors) {
    try {
      const set = root.locator(selector);
      const count = Math.min(await set.count(), maxCandidatesPerSelector);
      if (count === 0) continue;

      for (let index = 0; index < count; index += 1) {
        const candidate = set.nth(index);
        const visible = await candidate
          .isVisible({ timeout: index === 0 ? timeoutMs : 300 })
          .catch(() => false);
        if (!visible) continue;
        if (!(await isEnabled(candidate))) continue;
        return candidate;
      }
    } catch {
      // Continue with next selector.
    }
  }

  return null;
}

async function looksLikeActionContainer(container: Locator): Promise<boolean> {
  const hasEntryPoint = (await container.locator('div.entry-point').count().catch(() => 0)) > 0;
  const hasDropdown = (await container.locator('div.artdeco-dropdown').count().catch(() => 0)) > 0;
  const hasMessageButton = (await container.locator('button[aria-label^="Message"]').count().catch(() => 0)) > 0;
  return hasEntryPoint || hasDropdown || hasMessageButton;
}

async function getActionContainer(page: Page): Promise<Locator | null> {
  console.log('[ButtonDetector] Searching for profile action container...');

  try {
    const connectionsUl = page.locator('ul').filter({ hasText: /connections/i }).first();
    if (await connectionsUl.isVisible({ timeout: 2000 })) {
      const sibling = connectionsUl.locator('xpath=following-sibling::div[1]').first();
      if (await sibling.isVisible({ timeout: 1000 })) {
        if (await looksLikeActionContainer(sibling)) {
          console.log('[ButtonDetector] Found action container via connections sibling');
          return sibling;
        }
      }
    }
  } catch (error) {
    console.log(
      `[ButtonDetector] Strategy 1 failed: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  try {
    const entryPoint = page.locator('div.entry-point').first();
    if (await entryPoint.isVisible({ timeout: 2000 })) {
      const parent = entryPoint
        .locator('xpath=ancestor::div[descendant::div[contains(@class,"artdeco-dropdown")]][1]')
        .first();
      if (await parent.isVisible({ timeout: 1000 })) {
        console.log('[ButtonDetector] Found action container via entry-point parent');
        return parent;
      }
    }
  } catch (error) {
    console.log(
      `[ButtonDetector] Strategy 2 failed: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  for (const selector of ACTION_CONTAINER_SELECTORS) {
    try {
      const candidate = page.locator(selector).first();
      if (!(await candidate.isVisible({ timeout: 1000 }).catch(() => false))) continue;

      if (await looksLikeActionContainer(candidate)) {
        console.log(`[ButtonDetector] Found action container via selector: ${selector}`);
        return candidate;
      }
    } catch {
      // continue
    }
  }

  console.error('[ButtonDetector] Action container not found');
  return null;
}

async function findOpenDropdown(page: Page): Promise<Locator | null> {
  return firstVisibleInScope(page, OPEN_DROPDOWN_SELECTORS, 1500);
}

export async function findConnectInMoreMenu(page: Page): Promise<Locator | null> {
  const dropdown = await findOpenDropdown(page);
  if (!dropdown) return null;
  return firstVisibleInScope(dropdown, CONNECT_IN_DROPDOWN_SELECTORS, 1000);
}

export async function detectProfileButtons(page: Page, firstName: string): Promise<DetectedButtons> {
  console.log('[ButtonDetector] Starting scoped button detection...');

  const buttons: DetectedButtons = {
    message: null,
    connect: null,
    connectInMoreMenu: null,
    more: null,
    pending: null,
    following: null,
  };

  const actionContainer = await getActionContainer(page);
  if (!actionContainer) {
    return buttons;
  }

  const cleanFirstName = firstName.replace(/"/g, '').trim();
  const messageSelectors = [
    cleanFirstName ? `button[aria-label^="Message ${cleanFirstName}" i]` : '',
    'button[aria-label^="Message" i]',
    'button.artdeco-button--primary:has-text("Message")',
    'div.entry-point button:has-text("Message")',
  ].filter(Boolean);

  buttons.message = await firstVisibleInScope(actionContainer, messageSelectors, 1000);
  if (buttons.message) {
    console.log('[ButtonDetector] Found Message button');
  }

  const directConnectSelectors = [
    cleanFirstName ? `button[aria-label^="Invite ${cleanFirstName}" i]` : '',
    'button[aria-label*="Invite" i]:has-text("Connect")',
    'button.artdeco-button--primary:has-text("Connect")',
  ].filter(Boolean);

  buttons.connect = await firstVisibleInScope(actionContainer, directConnectSelectors, 1000);
  if (buttons.connect) {
    console.log('[ButtonDetector] Found direct Connect button');
  }

  buttons.pending = await firstVisibleInScope(
    actionContainer,
    ['button[aria-label*="Pending" i]', 'button:has-text("Pending")'],
    700
  );
  if (buttons.pending) {
    console.log('[ButtonDetector] Found Pending button');
  }

  buttons.following = await firstVisibleInScope(
    actionContainer,
    ['button[aria-label*="Following" i]', 'button:has-text("Following")'],
    700
  );
  if (buttons.following) {
    console.log('[ButtonDetector] Found Following button');
  }

  buttons.more = await firstVisibleInScope(
    actionContainer,
    [
      'button[aria-label="More actions"]',
      'button.artdeco-dropdown__trigger:has-text("More")',
      'div.artdeco-dropdown button:has-text("More")',
    ],
    1000
  );
  if (buttons.more) {
    console.log('[ButtonDetector] Found More button');
  }

  if (buttons.more) {
    try {
      await buttons.more.click({ timeout: 2000 });
      await microDelay();

      const dropdown = await findOpenDropdown(page);
      if (dropdown) {
        buttons.connectInMoreMenu = await firstVisibleInScope(dropdown, CONNECT_IN_DROPDOWN_SELECTORS, 1000);
        if (!buttons.connectInMoreMenu) {
          buttons.connectInMoreMenu = await findConnectInMoreMenu(page);
        }

        if (buttons.connectInMoreMenu) {
          console.log('[ButtonDetector] Found Connect in More dropdown');
        }

        const unfollowOption = await dropdown
          .locator('div[role="button"][aria-label*="Unfollow" i]')
          .first()
          .isVisible({ timeout: 500 })
          .catch(() => false);
        if (unfollowOption) {
          console.log('[ButtonDetector] Unfollow option present (profile is followed)');
        }
      } else {
        console.log('[ButtonDetector] More dropdown did not open');
      }
    } catch (error) {
      console.error(
        `[ButtonDetector] Failed to inspect More dropdown: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    } finally {
      await page.keyboard.press('Escape').catch(() => undefined);
      await microDelay();
    }
  }

  console.log('[ButtonDetector] Scan complete:', {
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

  if (buttons.message && !buttons.connect && !buttons.connectInMoreMenu) {
    return { action: 'skip', reason: 'already_connected' };
  }

  if (connectionDegree === '3rd' && !buttons.connect && !buttons.connectInMoreMenu) {
    return { action: 'follow', reason: '3rd_degree_no_connect' };
  }

  return { action: 'skip', reason: 'no_action_available' };
}

export async function debugButtonScoping(page: Page): Promise<void> {
  console.log('\n=== BUTTON SCOPING DEBUG ===');

  const connectionsUl = page.locator('ul').filter({ hasText: /connections/i }).first();
  const hasConnectionsUl = await connectionsUl.isVisible({ timeout: 1000 }).catch(() => false);
  console.log(`Connections UL: ${hasConnectionsUl ? 'FOUND' : 'NOT FOUND'}`);

  if (hasConnectionsUl) {
    const sibling = connectionsUl.locator('xpath=following-sibling::div[1]').first();
    const hasSiblingContainer = await sibling.isVisible({ timeout: 1000 }).catch(() => false);
    console.log(`Sibling action container: ${hasSiblingContainer ? 'FOUND' : 'NOT FOUND'}`);

    if (hasSiblingContainer) {
      const entryPoints = await sibling.locator('div.entry-point').count().catch(() => 0);
      const dropdowns = await sibling.locator('div.artdeco-dropdown').count().catch(() => 0);
      console.log(`  entry-point count: ${entryPoints}`);
      console.log(`  artdeco-dropdown count: ${dropdowns}`);
    }
  }

  const allButtonsCount = await page.locator('button').count().catch(() => 0);
  const messageButtonsCount = await page.locator('button:has-text("Message")').count().catch(() => 0);
  console.log(`Global button count: ${allButtonsCount}`);
  console.log(`Global Message button count: ${messageButtonsCount}`);
  console.log('============================\n');
}
