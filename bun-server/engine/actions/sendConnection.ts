import type { Page } from 'playwright';
import { humanClick, humanType, findButtonByText } from '../helpers/humanBehavior';
import { interpolateTemplate } from '../helpers/template';

export async function sendConnection(page: Page, data: any, _lead: any) {
  await page.waitForTimeout(1000);

  const messageBtn = await findButtonByText(page, 'Message');
  if (messageBtn) {
    return { success: true, action: 'already_connected' };
  }

  const pendingBtn = page.locator('button:has-text("Pending")').first();
  if (await pendingBtn.isVisible().catch(() => false)) {
    return { success: true, action: 'already_pending' };
  }

  const connectBtn = await findButtonByText(page, 'Connect');
  if (!connectBtn) {
    return { success: false, error: 'Connect button not found' };
  }

  await humanClick(connectBtn);
  await page.waitForTimeout(800 + Math.random() * 700);

  const note = interpolateTemplate(
    String(data.connectionNote || ''),
    _lead as Record<string, unknown>
  ).trim();
  if (note) {
    const addNoteBtn = page.locator('button:has-text("Add a note")').first();
    if (await addNoteBtn.isVisible().catch(() => false)) {
      await humanClick(addNoteBtn);
      await page.waitForTimeout(500);

      const textarea = page.locator('textarea[name="message"], textarea#custom-message').first();
      await textarea.waitFor({ timeout: 4000 });
      await humanType(page, textarea, note.slice(0, 300));
      await page.waitForTimeout(300);
    }
  }

  const sendInviteBtn = page
    .locator('button:has-text("Send"), button:has-text("Send invitation"), button:has-text("Send without a note")')
    .first();

  if (!(await sendInviteBtn.isVisible().catch(() => false))) {
    return { success: false, error: 'Send invitation button not found' };
  }

  await humanClick(sendInviteBtn);
  await page.waitForTimeout(1000);

  return { success: true, action: 'connection_sent' };
}
