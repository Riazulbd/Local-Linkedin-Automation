import type { Page } from 'playwright';
import type { ActionResult } from '../../../types';
import { actionPause, humanClick, humanType, thinkingPause } from '../helpers/humanBehavior';
import {
  detectLoggedOut,
  detectRateLimit,
  dismissPopups,
  findVisibleButton,
} from '../helpers/linkedinGuard';

const THREAD_SELECTORS = (threadId?: string, participantName?: string) => [
  threadId ? `[data-entity-urn="${threadId}"]` : '',
  threadId ? `.msg-conversation-listitem[data-entity-urn="${threadId}"]` : '',
  participantName ? `.msg-conversation-listitem:has-text("${participantName}")` : '',
  participantName ? `.msg-conversations-container__convo-item-link:has-text("${participantName}")` : '',
].filter(Boolean);

const MESSAGE_INPUT_SELECTORS = [
  '.msg-form__contenteditable',
  '[contenteditable="true"][role="textbox"]',
  '[data-artdeco-is-focused] [contenteditable]',
];

const SEND_BUTTON_SELECTORS = [
  'button.msg-form__send-button',
  '[aria-label="Send"]',
  'button:has-text("Send")',
];

export async function replyInInbox(
  page: Page,
  text: string,
  threadId?: string,
  participantName?: string
): Promise<ActionResult> {
  const message = text.trim();
  if (!message) {
    return { success: false, error: 'MESSAGE_TEXT_EMPTY' };
  }

  await dismissPopups(page);

  if (await detectLoggedOut(page)) {
    return { success: false, error: 'SESSION_EXPIRED' };
  }
  if (await detectRateLimit(page)) {
    return { success: false, error: 'RATE_LIMITED' };
  }

  if (threadId || participantName) {
    const thread = await findVisibleButton(page, THREAD_SELECTORS(threadId, participantName), 3000);
    if (thread) {
      await humanClick(page, thread.locator);
      await actionPause();
      await dismissPopups(page);
    }
  }

  const input = await findVisibleButton(page, MESSAGE_INPUT_SELECTORS, 4000);
  if (!input) {
    return { success: false, error: 'MESSAGE_INPUT_NOT_FOUND' };
  }

  await thinkingPause();
  await humanType(page, input.locator, message);
  await thinkingPause();
  await dismissPopups(page);

  const send = await findVisibleButton(page, SEND_BUTTON_SELECTORS, 3000);
  if (!send) {
    return { success: false, error: 'SEND_BUTTON_NOT_FOUND' };
  }

  await humanClick(page, send.locator);
  await actionPause();
  await dismissPopups(page);

  return { success: true, action: 'message_sent' };
}
