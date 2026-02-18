import type { Page } from 'playwright';
import { actionPause, glanceAtPage, humanScrollDown, randomBetween } from '../helpers/humanBehavior';
import { detectLoggedOut, detectRateLimit, dismissPopups, safeWaitForSettle } from '../helpers/linkedinGuard';
import { detectConnectionState, updateLeadConnectionState } from '../helpers/connectionDetector';
import { scrapeProfileData } from '../helpers/profileScraper';
import { supabase } from '../../lib/supabase';
import type { ActionResult, Lead } from '../../../types';

type VisitProfileData = {
  useCurrentLead?: boolean;
  url?: string;
};

function pickString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

async function applyScrapedProfileData(lead: Lead, scraped: Awaited<ReturnType<typeof scrapeProfileData>>) {
  if (!lead.id) return;

  const { data: currentRow } = await supabase
    .from('leads')
    .select('first_name,last_name,company,extra_data')
    .eq('id', lead.id)
    .maybeSingle();

  const current = (currentRow ?? {}) as {
    first_name?: string | null;
    last_name?: string | null;
    company?: string | null;
    extra_data?: Record<string, unknown> | null;
  };

  const nextExtra: Record<string, unknown> = {
    ...(current.extra_data && typeof current.extra_data === 'object' ? current.extra_data : {}),
  };
  if (scraped.fullName) nextExtra.full_name = scraped.fullName;
  if (scraped.headline) nextExtra.headline = scraped.headline;
  if (scraped.location) nextExtra.location = scraped.location;

  await supabase
    .from('leads')
    .update({
      first_name: pickString(scraped.firstName) || pickString(current.first_name) || pickString(lead.first_name),
      last_name: pickString(scraped.lastName) || pickString(current.last_name) || pickString(lead.last_name),
      company: pickString(scraped.company) || pickString(current.company) || pickString(lead.company),
      extra_data: nextExtra,
      updated_at: new Date().toISOString(),
    })
    .eq('id', lead.id);
}

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

    let scrapedProfile: Awaited<ReturnType<typeof scrapeProfileData>> | null = null;
    if (lead?.id) {
      scrapedProfile = await scrapeProfileData(page).catch(() => null);
      if (scrapedProfile) {
        await applyScrapedProfileData(lead, scrapedProfile).catch(() => undefined);
      }
    }

    await glanceAtPage(page);
    await humanScrollDown(page, randomBetween(400, 900));
    await actionPause();
    await dismissPopups(page);
    await humanScrollDown(page, randomBetween(200, 500));
    await dismissPopups(page);

    const connectionState = await detectConnectionState(page);
    if (lead?.id) {
      await updateLeadConnectionState(supabase, lead.id, connectionState).catch(() => undefined);
    }

    return {
      success: true,
      action: 'visited',
      data: {
        url,
        connectionState,
        scrapedProfile: scrapedProfile
          ? {
              firstName: scrapedProfile.firstName,
              lastName: scrapedProfile.lastName,
              company: scrapedProfile.company,
            }
          : null,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'VISIT_PROFILE_FAILED',
    };
  }
}
