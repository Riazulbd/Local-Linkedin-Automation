import type { Page } from 'playwright';

export async function checkConnection(page: Page, _lead: any) {
  await page.waitForTimeout(500);

  const msgBtn = page.locator('button:has-text("Message")').first();
  if (await msgBtn.isVisible().catch(() => false)) {
    return { success: true, action: 'yes', data: { status: 'connected' } };
  }

  const followingBtn = page.locator('button:has-text("Following")').first();
  if (await followingBtn.isVisible().catch(() => false)) {
    return { success: true, action: 'yes', data: { status: 'following' } };
  }

  const pendingBtn = page.locator('button:has-text("Pending")').first();
  if (await pendingBtn.isVisible().catch(() => false)) {
    return { success: true, action: 'yes', data: { status: 'pending' } };
  }

  return { success: true, action: 'no', data: { status: 'not_connected' } };
}
