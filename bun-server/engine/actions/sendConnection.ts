import type { Locator, Page } from 'playwright';
import { followProfile } from './followProfile';
import { detectConnectionState } from '../helpers/connectionDetector';
import {
  detectProfileButtons,
  determineConnectionStrategy,
  findConnectInMoreMenu,
} from '../helpers/buttonDetector';
import { dismissPopups, withPopupGuard } from '../helpers/popupGuard';
import { humanClick, humanType, microDelay, thinkingPause } from '../helpers/humanBehavior';
import { interpolate } from '../helpers/templateEngine';
import type { ActionResult, Lead } from '../../../types';

type SendConnectionConfig = {
  note?: string;
  connectionNote?: string;
};

type ModalResult = {
  success: boolean;
  mode: 'with_note' | 'without_note' | 'no_modal';
  error?: string;
};

const ADD_NOTE_SELECTORS = [
  'button[aria-label="Add a note"]',
  'button:has-text("Add a note")',
];

const NOTE_TEXTAREA_SELECTORS = [
  'textarea[name="message"]',
  '#custom-message',
  'textarea[aria-label*="note" i]',
  'textarea',
];

const SEND_WITH_NOTE_SELECTORS = [
  'button[aria-label="Send invitation"]',
  'button:has-text("Send invitation")',
  'button[type="submit"]:has-text("Send")',
];

const SEND_WITHOUT_NOTE_SELECTORS = [
  'button[aria-label="Send without a note"]',
  'button:has-text("Send without a note")',
  'button:has-text("Send now")',
  'button[aria-label="Send invitation"]',
];

function debug(message: string, details?: Record<string, unknown>) {
  if (details) {
    console.log(`[sendConnection] ${message}`, details);
    return;
  }
  console.log(`[sendConnection] ${message}`);
}

function resolveFirstName(lead?: Lead): string {
  if (lead?.first_name && lead.first_name.trim()) {
    return lead.first_name.trim();
  }

  const raw = lead?.linkedin_url ?? '';
  const slug = raw.split('/in/')[1]?.split(/[/?#]/)[0] ?? '';
  if (!slug) return 'User';

  const firstToken = slug.split('-')[0]?.trim();
  return firstToken || 'User';
}

function resolveConnectionNote(
  input: SendConnectionConfig | string | undefined,
  lead?: Lead
): string | undefined {
  if (!input) return undefined;
  const raw = typeof input === 'string' ? input : input.note || input.connectionNote || '';
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  return lead ? interpolate(trimmed, lead) : trimmed;
}

async function isEnabled(locator: Locator): Promise<boolean> {
  const disabled = await locator.getAttribute('disabled').catch(() => null);
  const ariaDisabled = await locator.getAttribute('aria-disabled').catch(() => null);
  return disabled === null && ariaDisabled !== 'true';
}

async function findVisible(page: Page, selectors: readonly string[], timeoutMs: number): Promise<Locator | null> {
  for (const selector of selectors) {
    try {
      const candidate = page.locator(selector).first();
      const visible = await candidate.isVisible({ timeout: timeoutMs }).catch(() => false);
      if (!visible) continue;
      const isSearch = await candidate
        .evaluate((el: Element) => {
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
      if (!(await isEnabled(candidate))) continue;
      return candidate;
    } catch {
      // continue
    }
  }
  return null;
}

async function clickLocator(page: Page, locator: Locator): Promise<void> {
  await withPopupGuard(page, async () => {
    await humanClick(page, locator);
  });
}

async function handleConnectionNoteModal(
  page: Page,
  note: string | undefined
): Promise<ModalResult> {
  debug('checking connection modal');
  await page.waitForTimeout(1200);

  const trimmedNote = note?.trim() || '';

  // No obvious modal controls means LinkedIn may have sent immediately.
  const addNoteButton = await findVisible(page, ADD_NOTE_SELECTORS, 1200);
  const sendWithoutNoteButton = await findVisible(page, SEND_WITHOUT_NOTE_SELECTORS, 1200);
  const sendWithNoteButton = await findVisible(page, SEND_WITH_NOTE_SELECTORS, 1200);
  if (!addNoteButton && !sendWithoutNoteButton && !sendWithNoteButton) {
    debug('no modal controls found; treating connect click as accepted');
    await dismissPopups(page);
    return { success: true, mode: 'no_modal' };
  }

  if (trimmedNote) {
    if (addNoteButton) {
      debug('opening add-note modal');
      await thinkingPause();
      await clickLocator(page, addNoteButton);
      await microDelay();
    }

    const noteBox = await findVisible(page, NOTE_TEXTAREA_SELECTORS, 1800);
    if (noteBox) {
      debug('typing connection note');
      await humanType(page, noteBox, trimmedNote.slice(0, 300));
    } else {
      debug('note textarea not found, proceeding without note');
    }

    const sendButton = (await findVisible(page, SEND_WITH_NOTE_SELECTORS, 1800))
      || (await findVisible(page, SEND_WITHOUT_NOTE_SELECTORS, 1200));

    if (!sendButton) {
      return {
        success: false,
        mode: 'with_note',
        error: 'SEND_INVITATION_BUTTON_NOT_FOUND',
      };
    }

    debug('sending invite (with note path)');
    await thinkingPause();
    await clickLocator(page, sendButton);
    await microDelay();
    await dismissPopups(page);
    return { success: true, mode: 'with_note' };
  }

  const sendWithout = (await findVisible(page, SEND_WITHOUT_NOTE_SELECTORS, 2000))
    || (await findVisible(page, SEND_WITH_NOTE_SELECTORS, 1200));

  if (!sendWithout) {
    return {
      success: false,
      mode: 'without_note',
      error: 'SEND_WITHOUT_NOTE_BUTTON_NOT_FOUND',
    };
  }

  debug('sending invite without note');
  await thinkingPause();
  await clickLocator(page, sendWithout);
  await microDelay();
  await dismissPopups(page);
  return { success: true, mode: 'without_note' };
}

async function executeDirectConnect(
  page: Page,
  connectButton: Locator,
  note: string | undefined
): Promise<ActionResult> {
  debug('clicking direct connect');
  await thinkingPause();
  await clickLocator(page, connectButton);
  await microDelay();
  await dismissPopups(page);

  const modalResult = await handleConnectionNoteModal(page, note);
  if (!modalResult.success) {
    return {
      success: false,
      error: modalResult.error || 'CONNECTION_MODAL_SEND_FAILED',
      action: 'connect_modal_failed',
      data: { modalMode: modalResult.mode },
    };
  }

  return {
    success: true,
    action: 'connection_sent_direct',
    data: { modalMode: modalResult.mode },
  };
}

async function executeConnectViaMore(
  page: Page,
  moreButton: Locator,
  connectButton: Locator,
  note: string | undefined
): Promise<ActionResult> {
  debug('clicking More -> Connect');

  await thinkingPause();
  await clickLocator(page, moreButton);
  await microDelay();

  let connectOption: Locator | null = connectButton;
  const visible = await connectOption.isVisible({ timeout: 1000 }).catch(() => false);
  if (!visible) {
    connectOption = await findConnectInMoreMenu(page);
  }

  if (!connectOption) {
    await page.keyboard.press('Escape').catch(() => undefined);
    return {
      success: false,
      error: 'CONNECT_OPTION_NOT_FOUND_IN_MORE',
      action: 'connect_option_missing',
    };
  }

  await thinkingPause();
  await clickLocator(page, connectOption);
  await microDelay();
  await dismissPopups(page);

  const modalResult = await handleConnectionNoteModal(page, note);
  if (!modalResult.success) {
    return {
      success: false,
      error: modalResult.error || 'CONNECTION_MODAL_SEND_FAILED',
      action: 'connect_modal_failed',
      data: { modalMode: modalResult.mode, via: 'more' },
    };
  }

  return {
    success: true,
    action: 'connection_sent_via_more',
    data: { modalMode: modalResult.mode },
  };
}

export async function sendConnection(page: Page, note?: string): Promise<ActionResult>;
export async function sendConnection(page: Page, input?: SendConnectionConfig, lead?: Lead): Promise<ActionResult>;
export async function sendConnection(
  page: Page,
  input?: SendConnectionConfig | string,
  lead?: Lead
): Promise<ActionResult> {
  await dismissPopups(page);

  const firstName = resolveFirstName(lead);
  const note = resolveConnectionNote(input, lead);

  debug('starting strategy detection', {
    firstName,
    hasLead: Boolean(lead),
    hasNote: Boolean(note),
  });

  const buttons = await detectProfileButtons(page, firstName);
  const connectionDegree = await detectConnectionState(page);
  const strategy = determineConnectionStrategy(buttons, connectionDegree);

  debug('strategy selected', {
    strategy: strategy.action,
    degree: connectionDegree,
  });

  if (strategy.action === 'skip') {
    if (strategy.reason === 'pending') {
      return { success: true, action: 'already_pending', data: { degree: connectionDegree } };
    }
    if (strategy.reason === 'already_connected') {
      return { success: true, action: 'already_connected', data: { degree: connectionDegree } };
    }
    return {
      success: true,
      action: 'skipped_no_action',
      data: { degree: connectionDegree },
    };
  }

  if (strategy.action === 'message') {
    return { success: true, action: 'already_connected', data: { degree: connectionDegree } };
  }

  if (strategy.action === 'follow') {
    const followResult = await followProfile(page, input, lead);
    if (followResult.success) {
      return {
        success: true,
        action: 'followed_instead',
        data: { reason: strategy.reason, degree: connectionDegree },
      };
    }
    return {
      success: false,
      action: followResult.action || 'follow_fallback_failed',
      error: followResult.error || 'FOLLOW_FALLBACK_FAILED',
      data: { reason: strategy.reason, degree: connectionDegree },
    };
  }

  if (strategy.action === 'connect_direct') {
    return executeDirectConnect(page, strategy.button, note);
  }

  if (strategy.action === 'connect_via_more') {
    return executeConnectViaMore(page, strategy.moreButton, strategy.connectButton, note);
  }

  return {
    success: false,
    action: 'unknown_strategy',
    error: 'UNHANDLED_CONNECTION_STRATEGY',
    data: { degree: connectionDegree },
  };
}
