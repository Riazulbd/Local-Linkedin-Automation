import type { Page } from 'playwright';
import type { ActionResult, CampaignStep, Lead } from '../../../types';
import { LI, findFirst } from '../helpers/selectors';
import { actionDelay, humanClick } from '../helpers/humanBehavior';
import { withPopupGuard } from '../helpers/popupGuard';
import { Logger } from '../../lib/logger';

type FollowProfileData = Partial<CampaignStep['config']> & {
  fallbackToConnect?: boolean;
  runId?: string;
};

const actionLogger = new Logger(process.env.ACTION_LOG_RUN_ID ?? 'runtime_follow_profile');

export async function followProfile(page: Page, data: FollowProfileData, lead: Lead): Promise<ActionResult> {
  await actionLogger.log('follow_profile', 'follow_profile', 'running', 'Checking follow state', lead.id);

  return withPopupGuard(page, async () => {
    const alreadyFollowing = await findFirst(page, LI.followingBtn, 1200);
    if (alreadyFollowing) {
      await actionLogger.log('follow_profile', 'follow_profile', 'success', 'Already following', lead.id);
      return { success: true, action: 'already_following' };
    }

    const followBtn = await findFirst(page, LI.followBtn, 2500);
    if (followBtn) {
      await humanClick(page, followBtn);
      await actionDelay();

      const confirmed = await findFirst(page, LI.followingBtn, 3000);
      await actionLogger.log(
        'follow_profile',
        'follow_profile',
        'success',
        confirmed ? 'Followed profile' : 'Follow clicked, awaiting state refresh',
        lead.id
      );
      return {
        success: true,
        action: confirmed ? 'followed' : 'follow_clicked_unverified',
      };
    }

    if (data.fallbackToConnect !== false) {
      const connectBtn = await findFirst(page, LI.connectBtn, 1800);
      if (connectBtn) {
        await humanClick(page, connectBtn);
        await actionDelay();

        const sendWithoutNote = await findFirst(page, LI.sendWithoutNoteBtn, 2200);
        if (sendWithoutNote) {
          await humanClick(page, sendWithoutNote);
          await actionDelay();
        }

        await actionLogger.log('follow_profile', 'follow_profile', 'success', 'Follow unavailable, sent connection', lead.id);
        return { success: true, action: 'connection_sent' };
      }
    }

    await actionLogger.log('follow_profile', 'follow_profile', 'error', 'No follow or connect button found', lead.id);
    return { success: false, error: 'No follow or connect button found' };
  });
}
