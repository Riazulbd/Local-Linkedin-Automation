import type { Page } from 'playwright';
import { humanScroll } from '../helpers/humanBehavior';

export async function visitProfile(page: Page, data: any, lead: any) {
  const url = data.useCurrentLead ? lead.linkedin_url : data.url;

  if (!url) throw new Error('No LinkedIn URL provided');

  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 25000 });
  await page.waitForTimeout(1500 + Math.random() * 1500);

  await humanScroll(page);

  return { success: true, action: 'visited', data: { url } };
}
