import type { Page } from 'playwright';
import type { ActionResult, Lead } from '../../../types';
import { LI, findFirst } from '../helpers/selectors';
import { withPopupGuard } from '../helpers/popupGuard';
import { Logger } from '../../lib/logger';

const actionLogger = new Logger(process.env.ACTION_LOG_RUN_ID ?? 'runtime_check_connection');

export async function checkConnection(page: Page, lead: Lead): Promise<ActionResult> {
  await actionLogger.log('check_connection', 'check_connection', 'running', 'Checking connection status', lead.id);

  return withPopupGuard(page, async () => {
    const messageBtn = await findFirst(page, LI.messageBtn, 1200);
    if (messageBtn) {
      await actionLogger.log('check_connection', 'check_connection', 'success', 'Connected (message available)', lead.id);
      return { success: true, action: 'yes', data: { status: 'connected' } };
    }

    const followingBtn = await findFirst(page, LI.followingBtn, 1200);
    if (followingBtn) {
      await actionLogger.log('check_connection', 'check_connection', 'success', 'Following detected', lead.id);
      return { success: true, action: 'yes', data: { status: 'following' } };
    }

    const pendingBtn = await findFirst(page, LI.pendingBtn, 1200);
    if (pendingBtn) {
      await actionLogger.log('check_connection', 'check_connection', 'success', 'Connection pending', lead.id);
      return { success: true, action: 'yes', data: { status: 'pending' } };
    }

    const degreeLoc = await findFirst(page, LI.profileConnectionDegree, 1000);
    const degreeText = degreeLoc ? ((await degreeLoc.textContent()) || '').trim().toLowerCase() : '';
    if (degreeText.includes('1st')) {
      await actionLogger.log('check_connection', 'check_connection', 'success', '1st degree detected', lead.id);
      return { success: true, action: 'yes', data: { status: 'connected', degree: degreeText } };
    }

    await actionLogger.log('check_connection', 'check_connection', 'success', 'Not connected', lead.id);
    return { success: true, action: 'no', data: { status: 'not_connected', degree: degreeText } };
  });
}
