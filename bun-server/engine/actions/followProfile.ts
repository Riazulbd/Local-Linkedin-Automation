import type { Locator, Page } from 'playwright';
import { humanClick, findButtonByText } from '../helpers/humanBehavior';

async function isVisible(locator: Locator) {
  return locator.isVisible().catch(() => false);
}

async function findFirstVisible(candidates: Locator[]): Promise<Locator | null> {
  for (const candidate of candidates) {
    if (await isVisible(candidate)) {
      return candidate;
    }
  }
  return null;
}

async function waitForFollowConfirmation(page: Page, timeoutMs = 4000) {
  const startedAt = Date.now();
  const confirmation = page
    .locator('button:has-text("Following"), button:has-text("Pending"), button:has-text("Requested")')
    .first();

  while (Date.now() - startedAt < timeoutMs) {
    if (await isVisible(confirmation)) {
      return true;
    }
    await page.waitForTimeout(250);
  }

  return false;
}

export async function followProfile(page: Page, data: any, _lead: any) {
  await page.waitForTimeout(1000);

  const alreadyFollowing = page
    .locator('button:has-text("Following"), button:has-text("Pending"), button:has-text("Requested")')
    .first();
  if (await isVisible(alreadyFollowing)) {
    return { success: true, action: 'already_following' };
  }

  const followBtn = await findFirstVisible([
    page.locator('main button[aria-label^="Follow "]:not(.pvs-sticky-header-profile-actions__action)').first(),
    page.locator('button[aria-label^="Follow "]:not(.pvs-sticky-header-profile-actions__action)').first(),
    page.locator('button:has-text("Follow"):not(.pvs-sticky-header-profile-actions__action)').first(),
    page.locator('button[aria-label^="Follow "]').first(),
  ]);

  let followClicked = false;
  if (followBtn) {
    await humanClick(followBtn, { timeoutMs: 10000, retries: 6 });
    followClicked = true;
  } else {
    const fallbackFollowBtn = await findButtonByText(page, 'Follow');
    if (fallbackFollowBtn) {
      await humanClick(fallbackFollowBtn, { timeoutMs: 10000, retries: 6 });
      followClicked = true;
    }
  }

  if (followClicked) {
    await page.waitForTimeout(1000 + Math.random() * 900);
    if (await waitForFollowConfirmation(page, 5000)) {
      return { success: true, action: 'followed' };
    }

    if (data.fallbackToConnect === false) {
      return { success: true, action: 'follow_clicked_unverified' };
    }
  }

  if (data.fallbackToConnect !== false) {
    const connectBtn = await findFirstVisible([
      page.locator('main button:has-text("Connect"):not(.pvs-sticky-header-profile-actions__action)').first(),
      page.locator('button:has-text("Connect"):not(.pvs-sticky-header-profile-actions__action)').first(),
      page.locator('button[aria-label^="Invite"]').first(),
    ]);

    const resolvedConnectBtn = connectBtn || (await findButtonByText(page, 'Connect'));
    if (resolvedConnectBtn) {
      await humanClick(resolvedConnectBtn, { timeoutMs: 9000, retries: 5 });
      await page.waitForTimeout(1200 + Math.random() * 600);

      const sendNowBtn = await findFirstVisible([
        page
          .locator(
            'button:has-text("Send without a note"), button[aria-label="Send now"], button:has-text("Send")'
          )
          .first(),
      ]);

      if (sendNowBtn) {
        await humanClick(sendNowBtn, { timeoutMs: 8000, retries: 4 });
      }

      return { success: true, action: 'connection_sent' };
    }
  }

  if (followClicked) {
    return { success: true, action: 'follow_clicked_unverified' };
  }

  return { success: false, error: 'No follow or connect button found' };
}
