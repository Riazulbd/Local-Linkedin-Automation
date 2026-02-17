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

export async function sendMessage(page: Page, data: SendMessageData, lead: Lead): Promise<ActionResult> {
  const template = String(data.messageTemplate || '').trim();
  const messageText = template ? interpolate(template, lead).trim() : '';

  if (!messageText) {
    return { success: false, error: 'Message template is empty' };
  }

  await actionLogger.log('send_message', 'send_message', 'running', 'Opening message composer', lead.id);

  return withPopupGuard(page, async () => {
    const messageBtn = await findFirst(page, LI.messageBtn, 2500);
    if (!messageBtn) {
      await actionLogger.log(
        'send_message',
        'send_message',
        'error',
        'Message button not found. Lead may not be connected.',
        lead.id
      );
      return { success: false, error: 'Message button not found - may not be connected' };
    }

    await humanClick(page, messageBtn);
    await actionDelay();

    const composeBox = await findFirst(page, LI.messageComposeBox, 5000);
    if (!composeBox) {
      await actionLogger.log('send_message', 'send_message', 'error', 'Message compose box not found', lead.id);
      return { success: false, error: 'Message compose box not found' };
    }

    await humanType(page, composeBox, messageText);
    await actionDelay();

    const sendBtn = await findFirst(page, LI.messageSendBtn, 3000);
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
