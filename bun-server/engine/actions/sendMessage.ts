import type { Page } from 'playwright';
import { actionPause, humanClick, humanType, thinkingPause } from '../helpers/humanBehavior';
import { detectRateLimit, dismissPopups, findVisibleButton } from '../helpers/linkedinGuard';
import { interpolate } from '../helpers/templateEngine';
import type { ActionResult, Lead } from '../../../types';

const MESSAGE_BTN_SELECTORS = [
  'button:has-text("Message")',
  '[aria-label*="Message"]',
  'a:has-text("Message")',
];

const MESSAGE_INPUT_SELECTORS = [
  '.msg-form__contenteditable',
  '[contenteditable="true"][role="textbox"]',
  '[data-artdeco-is-focused] [contenteditable]',
];

const SEND_BTN_SELECTORS = [
  'button.msg-form__send-button',
  '[aria-label="Send"]',
  'button:has-text("Send")',
];

type SendMessageConfig = {
  message?: string;
  messageTemplate?: string;
};

function resolveMessageText(input: SendMessageConfig | string, lead?: Lead): string {
  const raw = typeof input === 'string' ? input : input.message || input.messageTemplate || '';
  return lead ? interpolate(raw, lead) : raw;
}

export async function sendMessage(page: Page, text: string): Promise<ActionResult>;
export async function sendMessage(page: Page, input: SendMessageConfig, lead?: Lead): Promise<ActionResult>;
export async function sendMessage(
  page: Page,
  input: SendMessageConfig | string,
  lead?: Lead
): Promise<ActionResult> {
  const text = resolveMessageText(input, lead).trim();
  if (!text) {
    return { success: false, error: 'MESSAGE_TEXT_EMPTY' };
  }

  await dismissPopups(page);

  if (await detectRateLimit(page)) {
    return { success: false, error: 'RATE_LIMITED' };
  }

  const msgBtn = await findVisibleButton(page, MESSAGE_BTN_SELECTORS, 3000);
  if (!msgBtn) {
    return { success: false, error: 'MESSAGE_BUTTON_NOT_FOUND' };
  }

  await humanClick(page, msgBtn.locator);
  await actionPause();
  await dismissPopups(page);

  const inputBox = await findVisibleButton(page, MESSAGE_INPUT_SELECTORS, 4000);
  if (!inputBox) {
    return { success: false, error: 'MESSAGE_INPUT_NOT_FOUND' };
  }

  await thinkingPause();
  await humanType(page, inputBox.locator, text);
  await thinkingPause();
  await dismissPopups(page);

  const sendBtn = await findVisibleButton(page, SEND_BTN_SELECTORS, 3000);
  if (!sendBtn) {
    return { success: false, error: 'SEND_BUTTON_NOT_FOUND' };
  }

  await humanClick(page, sendBtn.locator);
  await actionPause();
  await dismissPopups(page);

  return { success: true, action: 'message_sent' };
}
