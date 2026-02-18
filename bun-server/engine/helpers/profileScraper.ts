import type { Page } from 'playwright';

export interface ScrapedProfile {
  firstName: string | null;
  lastName: string | null;
  fullName: string;
  headline: string | null;
  company: string | null;
  location: string | null;
}

async function firstVisibleText(page: Page, selectors: string[], timeoutMs: number): Promise<string | null> {
  for (const selector of selectors) {
    try {
      const locator = page.locator(selector).first();
      const text = (await locator.textContent({ timeout: timeoutMs }))?.trim();
      if (text) return text;
    } catch {
      // try next selector
    }
  }
  return null;
}

function parseName(fullName: string): { firstName: string | null; lastName: string | null } {
  const cleaned = fullName.trim().replace(/\s+/g, ' ');
  if (!cleaned) return { firstName: null, lastName: null };
  const parts = cleaned.split(' ');
  return {
    firstName: parts[0] || null,
    lastName: parts.slice(1).join(' ') || null,
  };
}

export async function scrapeProfileData(page: Page): Promise<ScrapedProfile> {
  const fullName =
    (await firstVisibleText(
      page,
      [
        'h1.text-heading-xlarge',
        'h1.inline.t-24.v-align-middle.break-words',
        'h1[class*="top-card-layout__title"]',
        'main h1',
      ],
      2200
    )) ?? '';

  const { firstName, lastName } = parseName(fullName);

  const headline = await firstVisibleText(
    page,
    [
      '.text-body-medium.break-words',
      '.pv-top-card--list + div .text-body-medium',
      '[class*="top-card-layout__headline"]',
    ],
    1800
  );

  let company: string | null = null;
  if (headline && headline.includes(' at ')) {
    company = headline.split(' at ').pop()?.trim() || null;
  } else if (headline && headline.includes(' @ ')) {
    company = headline.split(' @ ').pop()?.trim() || null;
  }

  if (!company) {
    company = await firstVisibleText(
      page,
      [
        '#experience ~ * .t-bold span[aria-hidden="true"]',
        '[id*="experience"] .t-bold span[aria-hidden="true"]',
      ],
      1500
    );
  }

  const location = await firstVisibleText(
    page,
    [
      '.text-body-small.inline.t-black--light.break-words',
      '[class*="top-card-layout__first-subline"]',
      '[class*="top-card-layout__location"]',
    ],
    1500
  );

  return {
    firstName,
    lastName,
    fullName,
    headline: headline ?? null,
    company: company ?? null,
    location: location ?? null,
  };
}
