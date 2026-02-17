import type { Page } from 'playwright';
import type { ActionResult, CampaignStep, Lead } from '../../../types';
import { LI, findFirst } from '../helpers/selectors';
import { actionDelay, humanClick, humanType } from '../helpers/humanBehavior';
import { withPopupGuard } from '../helpers/popupGuard';
import { interpolate } from '../helpers/templateEngine';
import { Logger } from '../../lib/logger';

type SendMessageData = Partial<CampaignStep['config']> & {
  messageTemplate?: string;
  runId?: string;
};

const actionLogger = new Logger(process.env.ACTION_LOG_RUN_ID ?? 'runtime_send_message');

async function resolveMessageButton(page: Page) {
  const direct = await findFirst(page, LI.messageBtn, 2200);
  if (direct) {
    return direct;
  }

  const moreActions = await findFirst(page, LI.moreActionsBtn, 1500);
  if (!moreActions) {
    return null;
  }

  await humanClick(page, moreActions);
  await actionDelay();

  const messageFromMenu = await findFirst(page, LI.messageInMoreMenu, 2400);
  if (messageFromMenu) {
    return messageFromMenu;
  }

  await page.keyboard.press('Escape').catch(() => undefined);
  return null;
}

async function waitForComposeBox(page: Page) {
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    const composeBox = await findFirst(page, LI.messageComposeBox, 3000);
    if (composeBox) {
      return composeBox;
    }
    await actionDelay();
  }
  return null;
}

export async function sendMessage(page: Page, data: SendMessageData, lead: Lead): Promise<ActionResult> {
  const template = String(data.messageTemplate || '').trim();
  const messageText = template ? interpolate(template, lead).trim() : '';

  if (!messageText) {
    return { success: false, error: 'Message template is empty' };
  }

  await actionLogger.log('send_message', 'send_message', 'running', 'Opening message composer', lead.id);

  return withPopupGuard(page, async () => {
    const messageBtn = await resolveMessageButton(page);
    if (!messageBtn) {
      await actionLogger.log(
        'send_message',
        'send_message',
        'error',
        'Message button not found in profile actions or more-actions menu.',
        lead.id
      );
      return { success: false, error: 'Message button not found - may not be connected' };
    }

    await humanClick(page, messageBtn);
    await actionDelay();

    let composeBox = await waitForComposeBox(page);
    if (!composeBox) {
      // LinkedIn sometimes opens a shell first and needs a second click to focus the chat composer.
      await humanClick(page, messageBtn).catch(() => undefined);
      await actionDelay();
      composeBox = await waitForComposeBox(page);
    }

    if (!composeBox) {
      await actionLogger.log(
        'send_message',
        'send_message',
        'error',
        `Message compose box not found (url: ${page.url()})`,
        lead.id
      );
      return { success: false, error: 'Message compose box not found' };
    }

    await humanType(page, composeBox, messageText);
    await actionDelay();

    const sendBtn = await findFirst(page, LI.messageSendBtn, 3500);
    if (!sendBtn) {
      await actionLogger.log('send_message', 'send_message', 'error', 'Send button not found', lead.id);
      return { success: false, error: 'Send button not found' };
    }

    await humanClick(page, sendBtn);
    await actionDelay();

    await actionLogger.log('send_message', 'send_message', 'success', 'Message sent', lead.id);
    return {
      success: true,
      action: 'message_sent',
      data: { messageLength: messageText.length },
    };
  });
}
