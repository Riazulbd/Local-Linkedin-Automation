import type { Page } from 'playwright';
import type { ActionResult } from '../../../types';
import { dismissPopups } from '../helpers/linkedinGuard';

export async function checkConnection(
  page: Page,
  _lead?: { id?: string }
): Promise<ActionResult & { isConnected: boolean }> {
  await dismissPopups(page);
  const degree1 = page.locator('.dist-value:has-text("1st")').first();
  const degree1Alt = page.locator('[aria-label*="1st degree"]').first();

  const is1st =
    (await degree1.isVisible({ timeout: 1500 }).catch(() => false)) ||
    (await degree1Alt.isVisible({ timeout: 1500 }).catch(() => false));

  return {
    success: true,
    isConnected: is1st,
    action: is1st ? 'connected' : 'not_connected',
    data: { status: is1st ? 'connected' : 'not_connected' },
  };
}
