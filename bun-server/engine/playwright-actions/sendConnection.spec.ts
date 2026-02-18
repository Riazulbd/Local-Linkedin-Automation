import type { Page } from 'playwright';
import { actionPause, humanClick, humanType, microPause, thinkingPause } from '../helpers/humanBehavior';
import { detectRateLimit, dismissPopups, findVisibleButton } from '../helpers/linkedinGuard';

const CONNECT_SELECTORS = [
  'button:has-text("Connect")',
  '[aria-label*="Connect"]',
  'button[data-control-name="connect"]',
];

const PENDING_SELECTORS = [
  'button:has-text("Pending")',
  '[aria-label*="Pending"]',
];

export interface SendConnectionInput {
  note?: string;
}

export async function sendConnectionAction(
  page: Page,
  input: SendConnectionInput = {}
): Promise<{ success: boolean; action?: string; error?: string }> {
  await dismissPopups(page);

  if (await detectRateLimit(page)) {
    return { success: false, error: 'RATE_LIMITED' };
  }

  const pending = await findVisibleButton(page, PENDING_SELECTORS, 1000);
  if (pending) {
    return { success: true, action: 'already_pending' };
  }

  let connectBtn = await findVisibleButton(page, CONNECT_SELECTORS, 2000);
  if (!connectBtn) {
    const moreBtn = await findVisibleButton(
      page,
      ['button:has-text("More")', '[aria-label*="More actions"]'],
      1500
    );

    if (moreBtn) {
      await humanClick(page, moreBtn.locator);
      await microPause();
      await dismissPopups(page);
      connectBtn = await findVisibleButton(page, CONNECT_SELECTORS, 2000);
    }
  }

  if (!connectBtn) {
    return { success: false, error: 'CONNECT_BUTTON_NOT_FOUND' };
  }

  await humanClick(page, connectBtn.locator);
  await actionPause();
  await dismissPopups(page);

  if (input.note?.trim()) {
    const addNoteBtn = await findVisibleButton(
      page,
      ['button:has-text("Add a note")', '[aria-label="Add a note"]'],
      2000
    );

    if (addNoteBtn) {
      await humanClick(page, addNoteBtn.locator);
      await thinkingPause();

      const noteBox = page.locator('textarea[name="message"]').first();
      if (await noteBox.isVisible({ timeout: 2000 })) {
        await humanType(page, noteBox, input.note.slice(0, 300));
      }
    }
  }

  const sendBtn = await findVisibleButton(
    page,
    [
      'button:has-text("Send")',
      'button:has-text("Send without a note")',
      '[aria-label*="Send now"]',
    ],
    3000
  );

  if (!sendBtn) {
    return { success: false, error: 'SEND_BUTTON_NOT_FOUND' };
  }

  await humanClick(page, sendBtn.locator);
  await actionPause();
  await dismissPopups(page);

  return { success: true, action: 'connection_sent' };
}
