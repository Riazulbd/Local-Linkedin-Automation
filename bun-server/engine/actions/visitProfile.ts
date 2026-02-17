import type { Page } from 'playwright';
import type { ActionResult, CampaignStep, Lead } from '../../../types';
import { LI, findFirst } from '../helpers/selectors';
import { navigationDelay, simulateProfileReading } from '../helpers/humanBehavior';
import { withPopupGuard } from '../helpers/popupGuard';
import { Logger } from '../../lib/logger';

type VisitProfileData = Partial<CampaignStep['config']> & {
  useCurrentLead?: boolean;
  url?: string;
  runId?: string;
};

const actionLogger = new Logger(process.env.ACTION_LOG_RUN_ID ?? 'runtime_visit_profile');

export async function visitProfile(page: Page, data: VisitProfileData, lead: Lead): Promise<ActionResult> {
  const targetUrl = (data.useCurrentLead ? lead.linkedin_url : data.url) || lead.linkedin_url;
  if (!targetUrl) {
    return { success: false, error: 'No LinkedIn URL provided' };
  }

  await actionLogger.log('visit_profile', 'visit_profile', 'running', `Navigating to profile: ${targetUrl}`, lead.id);

  return withPopupGuard(page, async () => {
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await navigationDelay();

    const profileName = await findFirst(page, LI.profileName, 4000);
    const foundName = profileName ? (await profileName.textContent())?.trim() || null : null;

    await simulateProfileReading(page, data.dwellSeconds ?? { min: 8, max: 22 });

    await actionLogger.log(
      'visit_profile',
      'visit_profile',
      'success',
      `Visited profile${foundName ? `: ${foundName}` : ''}`,
      lead.id
    );

    return {
      success: true,
      action: 'visited',
      data: {
        url: targetUrl,
        profileName: foundName,
      },
    };
  });
}
