import type { Page } from 'playwright';
import { interpolate } from '../helpers/templateEngine';
import { sendMessageAction } from '../playwright-actions/sendMessage.spec';
import type { ActionResult, Lead } from '../../../types';

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

  const recipientName = lead ? `${lead.first_name || ''} ${lead.last_name || ''}`.trim() : undefined;

  return sendMessageAction(page, {
    message: text,
    recipientName
  });
}
