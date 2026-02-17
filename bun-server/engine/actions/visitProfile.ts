import type { Page } from 'playwright';
import { actionPause, glanceAtPage, humanScrollDown, randomBetween } from '../helpers/humanBehavior';
import { detectLoggedOut, detectRateLimit, dismissPopups, safeWaitForSettle } from '../helpers/linkedinGuard';
import type { ActionResult, Lead } from '../../../types';

type VisitProfileData = {
  useCurrentLead?: boolean;
  url?: string;
};

export async function visitProfile(page: Page, linkedinUrl: string): Promise<ActionResult>;
export async function visitProfile(page: Page, data: VisitProfileData, lead: Lead): Promise<ActionResult>;
export async function visitProfile(
  page: Page,
  input: string | VisitProfileData,
  lead?: Lead
): Promise<ActionResult> {
  try {
    const rawUrl =
      typeof input === 'string'
        ? input
        : input.useCurrentLead
          ? lead?.linkedin_url || input.url || ''
          : input.url || lead?.linkedin_url || '';

    if (!rawUrl) {
      return { success: false, error: 'MISSING_PROFILE_URL' };
    }

    const url = rawUrl.endsWith('/') ? rawUrl : `${rawUrl}/`;

    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await safeWaitForSettle(page);
    await dismissPopups(page);

    if (await detectLoggedOut(page)) {
      return { success: false, error: 'SESSION_EXPIRED' };
    }

    if (await detectRateLimit(page)) {
      return { success: false, error: 'RATE_LIMITED' };
    }

    await glanceAtPage(page);
    await humanScrollDown(page, randomBetween(400, 900));
    await actionPause();
    await dismissPopups(page);
    await humanScrollDown(page, randomBetween(200, 500));
    await dismissPopups(page);

    return { success: true, action: 'visited', data: { url } };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'VISIT_PROFILE_FAILED',
    };
  }
}
