import type { Page } from 'playwright';

export async function seedLinkedInContext(page: Page): Promise<void> {
  await page.goto('https://www.linkedin.com/feed', {
    waitUntil: 'domcontentloaded',
    timeout: 20000,
  });
}
