import type { Page } from 'playwright';
import { humanClick, humanType, findButtonByText } from '../helpers/humanBehavior';
import { interpolateTemplate } from '../helpers/template';

export async function sendMessage(page: Page, data: any, lead: any) {
  const text = interpolateTemplate(data.messageTemplate || '', lead as Record<string, unknown>);
  if (!text.trim()) throw new Error('Message template is empty');

  const messageBtn = await findButtonByText(page, 'Message');
  if (!messageBtn) {
    return { success: false, error: 'Message button not found - may not be connected' };
  }

  await humanClick(messageBtn);
  await page.waitForTimeout(1500 + Math.random() * 1000);

  const composeBox = page
    .locator('.msg-form__contenteditable, [contenteditable="true"][role="textbox"]')
    .first();

  await composeBox.waitFor({ timeout: 5000 });
  await composeBox.click();
  await page.waitForTimeout(500);

  await humanType(page, composeBox, text);
  await page.waitForTimeout(500 + Math.random() * 500);

  const sendBtn = page.locator('.msg-form__send-button, button[type="submit"]').first();
  if (!(await sendBtn.isVisible().catch(() => false))) {
    return { success: false, error: 'Send button not found' };
  }

  await humanClick(sendBtn);
  await page.waitForTimeout(1000);

  return { success: true, action: 'message_sent' };
}
