import type { Page } from 'playwright';
import { actionPause, humanClick, humanType, thinkingPause, randomBetween, sleep } from '../helpers/humanBehavior';
import { detectRateLimit, dismissPopups, findVisibleButton } from '../helpers/linkedinGuard';
import { LI } from '../helpers/selectors';

export interface SendMessageInput {
  message: string;
  recipientName?: string;
}

export async function sendMessageAction(
  page: Page,
  input: SendMessageInput
): Promise<{ success: boolean; action?: string; error?: string }> {
  if (!input.message.trim()) {
    return { success: false, error: 'MESSAGE_TEXT_EMPTY' };
  }

  await dismissPopups(page);
  if (await detectRateLimit(page)) {
    return { success: false, error: 'RATE_LIMITED' };
  }

  // 1. Find and click the Message button on the profile
  const messageBtn = await findVisibleButton(page, LI.messageBtn, 3000);
  if (!messageBtn) {
    return { success: false, error: 'MESSAGE_BUTTON_NOT_FOUND' };
  }

  await humanClick(page, messageBtn.locator);
  await actionPause();
  await dismissPopups(page);

  // 2. Locate the Message Modal & Input
  // We explicitly wait for the modal container to be visible preventing global search interaction
  const messageInputSelector = LI.messageComposeBox[0]; // Primary selector
  try {
    await page.waitForSelector(messageInputSelector, { state: 'visible', timeout: 8000 });
  } catch (e) {
    // Fallback to searching for any in the list if primary fails
    const fallback = await findVisibleButton(page, LI.messageComposeBox, 2000);
    if (!fallback) {
      return { success: false, error: 'MESSAGE_INPUT_NOT_FOUND' };
    }
  }

  // 3. Verify Recipient Name (if provided)
  if (input.recipientName) {
    const headerSelector = LI.messageModalHeader.join(',');
    const headerLocator = page.locator(headerSelector).first();

    try {
      await headerLocator.waitFor({ state: 'visible', timeout: 5000 });
      const headerText = await headerLocator.innerText();

      if (headerText) {
        const normalizedHeader = headerText.toLowerCase().trim();
        const normalizedExpected = input.recipientName.toLowerCase().trim();

        // Simple inclusion check or partial match to account for "Member..." or middle names
        // Splitting by space to check if *part* of the name is present (e.g. First Name)
        const nameParts = normalizedExpected.split(' ').filter(p => p.length > 1);
        const isMatch = nameParts.some(part => normalizedHeader.includes(part));

        if (!isMatch) {
          console.warn(`[Safety] Message modal header "${headerText}" does not match target "${input.recipientName}"`);
          return { success: false, error: 'RECIPIENT_MISMATCH' };
        }
      }
    } catch (err) {
      // If we can't fully verify name, should we proceed? 
      // User requested "Only then should it proceed". 
      // But strict blocking might fail if selector changes. 
      // Let's log warning for now and allow if generic safety checks pass, 
      // OR strict verify if critical. User said "The system must verify".
      // I'll be strict.
      return { success: false, error: 'RECIPIENT_VERIFICATION_FAILED' };
    }
  }

  const inputBox = await findVisibleButton(page, LI.messageComposeBox, 4000);
  if (!inputBox) {
    return { success: false, error: 'MESSAGE_INPUT_NOT_FOUND' };
  }

  await thinkingPause();

  // Focus explicitly
  await inputBox.locator.click({ delay: randomBetween(50, 150) });
  await sleep(randomBetween(500, 1200));

  await humanType(page, inputBox.locator, input.message);
  await thinkingPause();
  await dismissPopups(page);

  const sendButton = await findVisibleButton(page, LI.messageSendBtn, 3000);
  if (!sendButton) {
    return { success: false, error: 'SEND_BUTTON_NOT_FOUND' };
  }

  await humanClick(page, sendButton.locator);
  await actionPause();
  await dismissPopups(page);

  return { success: true, action: 'message_sent' };
}
