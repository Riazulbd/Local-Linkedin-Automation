import type { Page } from 'playwright';
import { actionPause, glanceAtPage, humanClick, microPause } from '../helpers/humanBehavior';
import { detectRateLimit, dismissPopups, findVisibleButton } from '../helpers/linkedinGuard';

const FOLLOW_SELECTORS = [
  'button:has-text("Follow")',
  '[aria-label*="Follow"]',
  'button[data-control-name="follow"]',
];

const FOLLOWING_SELECTORS = [
  'button:has-text("Following")',
  '[aria-label*="Following"]',
];

export async function followProfileAction(
  page: Page
): Promise<{ success: boolean; action?: string; error?: string }> {
  await dismissPopups(page);

  if (await detectRateLimit(page)) {
    return { success: false, error: 'RATE_LIMITED' };
  }

  const alreadyFollowing = await findVisibleButton(page, FOLLOWING_SELECTORS, 1000);
  if (alreadyFollowing) {
    return { success: true, action: 'already_following' };
  }

  let followButton = await findVisibleButton(page, FOLLOW_SELECTORS, 2000);

  if (!followButton) {
    const moreButton = await findVisibleButton(
      page,
      ['button:has-text("More")', '[aria-label*="More actions"]'],
      1500
    );

    if (moreButton) {
      await humanClick(page, moreButton.locator);
      await microPause();
      await dismissPopups(page);
      followButton = await findVisibleButton(page, FOLLOW_SELECTORS, 2000);
    }
  }

  if (!followButton) {
    return { success: false, error: 'FOLLOW_BUTTON_NOT_FOUND' };
  }

  await glanceAtPage(page);
  await humanClick(page, followButton.locator);
  await actionPause();
  await dismissPopups(page);

  const nowFollowing = await findVisibleButton(page, FOLLOWING_SELECTORS, 2000);
  return {
    success: Boolean(nowFollowing),
    action: nowFollowing ? 'followed' : 'click_failed',
  };
}
