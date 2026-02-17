import type { Page } from 'playwright';
import type { ActionResult, CampaignStep, Lead } from '../../../types';
import { LI, findFirst } from '../helpers/selectors';
import { humanClick, humanType, actionDelay } from '../helpers/humanBehavior';
import { withPopupGuard } from '../helpers/popupGuard';
import { interpolate } from '../helpers/templateEngine';
import { Logger } from '../../lib/logger';

type SendConnectionData = Partial<CampaignStep['config']> & {
  connectionNote?: string;
  runId?: string;
};

const actionLogger = new Logger(process.env.ACTION_LOG_RUN_ID ?? 'runtime_send_connection');

async function openConnectFlow(page: Page) {
  let connectBtn = await findFirst(page, LI.connectBtn, 2500);
  if (connectBtn) return connectBtn;

  const moreActionsBtn = await findFirst(page, LI.moreActionsBtn, 1500);
  if (!moreActionsBtn) return null;

  await humanClick(page, moreActionsBtn);
  await actionDelay();

  connectBtn = await findFirst(page, LI.connectInMoreMenu, 2000);
  return connectBtn;
}

export async function sendConnection(page: Page, data: SendConnectionData, lead: Lead): Promise<ActionResult> {
  await actionLogger.log('send_connection', 'send_connection', 'running', 'Preparing connection request', lead.id);

  return withPopupGuard(page, async () => {
    const alreadyConnected = await findFirst(page, LI.messageBtn, 1000);
    if (alreadyConnected) {
      await actionLogger.log('send_connection', 'send_connection', 'success', 'Already connected', lead.id);
      return { success: true, action: 'already_connected' };
    }

    const pending = await findFirst(page, LI.pendingBtn, 1000);
    if (pending) {
      await actionLogger.log('send_connection', 'send_connection', 'success', 'Connection already pending', lead.id);
      return { success: true, action: 'already_pending' };
    }

    const connectBtn = await openConnectFlow(page);
    if (!connectBtn) {
      await actionLogger.log('send_connection', 'send_connection', 'error', 'Connect button not found', lead.id);
      return { success: false, error: 'Connect button not found' };
    }

    await humanClick(page, connectBtn);
    await actionDelay();

    const rawNote = String(data.connectionNote || '').trim();
    const note = rawNote ? interpolate(rawNote, lead).trim().slice(0, 300) : '';

    if (note) {
      const addNoteBtn = await findFirst(page, LI.addNoteBtn, 2500);
      if (addNoteBtn) {
        await humanClick(page, addNoteBtn);
        await actionDelay();

        const noteBox = await findFirst(page, LI.connectionNoteTextarea, 3000);
        if (!noteBox) {
          await actionLogger.log(
            'send_connection',
            'send_connection',
            'error',
            'Connection note textarea not found',
            lead.id
          );
          return { success: false, error: 'Connection note textarea not found' };
        }

        await humanType(page, noteBox, note);
      }
    }

    const sendInviteBtn =
      (await findFirst(page, LI.sendInviteBtn, 2500)) ||
      (await findFirst(page, LI.sendWithoutNoteBtn, 2000));
    if (!sendInviteBtn) {
      await actionLogger.log('send_connection', 'send_connection', 'error', 'Send invitation button not found', lead.id);
      return { success: false, error: 'Send invitation button not found' };
    }

    await humanClick(page, sendInviteBtn);
    await actionDelay();

    await actionLogger.log('send_connection', 'send_connection', 'success', 'Connection request sent', lead.id);
    return {
      success: true,
      action: 'connection_sent',
      data: { noteLength: note.length },
    };
  });
}
