import type { Page } from 'playwright';
import { actionPause, glanceAtPage, humanClick, microPause } from '../helpers/humanBehavior';
import { detectRateLimit, dismissPopups, findVisibleButton } from '../helpers/linkedinGuard';
import type { ActionResult } from '../../../types';

const FOLLOW_SELECTORS = [
  'button:has-text("Follow")',
  '[aria-label*="Follow"]',
  'button[data-control-name="follow"]',
];

const FOLLOWING_SELECTORS = [
  'button:has-text("Following")',
  '[aria-label*="Following"]',
];

export async function followProfile(
  page: Page,
  _data?: Record<string, unknown>,
  _lead?: { id?: string }
): Promise<ActionResult> {
  await dismissPopups(page);
  if (await detectRateLimit(page)) {
    return { success: false, error: 'RATE_LIMITED' };
  }

  const alreadyFollowing = await findVisibleButton(page, FOLLOWING_SELECTORS, 1000);
  if (alreadyFollowing) {
    return { success: true, action: 'already_following' };
  }

  let followBtn = await findVisibleButton(page, FOLLOW_SELECTORS, 2000);

  if (!followBtn) {
    const moreBtn = await findVisibleButton(
      page,
      ['button:has-text("More")', '[aria-label*="More actions"]'],
      1500
    );

    if (moreBtn) {
      await humanClick(page, moreBtn.locator);
      await microPause();
      await dismissPopups(page);
      followBtn = await findVisibleButton(page, FOLLOW_SELECTORS, 2000);
    }
  }

  if (!followBtn) {
    return { success: false, error: 'FOLLOW_BUTTON_NOT_FOUND' };
  }

  await glanceAtPage(page);
  await humanClick(page, followBtn.locator);
  await actionPause();
  await dismissPopups(page);

  const nowFollowing = await findVisibleButton(page, FOLLOWING_SELECTORS, 2000);
  return {
    success: Boolean(nowFollowing),
    action: nowFollowing ? 'followed' : 'click_failed',
  };
}
