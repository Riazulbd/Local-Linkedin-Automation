import type { Page } from 'playwright';
import { actionPause, glanceAtPage, humanClick, microPause } from '../helpers/humanBehavior';
import { detectRateLimit, dismissPopups, findVisibleButton } from '../helpers/linkedinGuard';

type VisibleMatch = { locator: import('playwright').Locator; selectorUsed: string };

const FOLLOW_SELECTORS = [
  // Primary button patterns used on LinkedIn profile pages.
  'button[aria-label^="Follow "]:not([aria-label*="Following"])',
  'button:has(use[href="#add-small"]):has(.artdeco-button__text:has-text("Follow"))',
  'button.artdeco-button:has(.artdeco-button__text:has-text("Follow"))',
  'button[aria-label*="Follow"][class*="artdeco-button"]:not([aria-label*="Following"])',
  'button:has-text("Follow"):not(:has-text("Following"))',
  '[aria-label*="Follow"]:not([aria-label*="Following"])',
  'button[data-control-name="follow"]',
  // Overflow menu variants.
  'div[role="menu"] button:has-text("Follow")',
  'ul[role="menu"] button:has-text("Follow")',
  '[role="menuitem"]:has-text("Follow")',
];

const FOLLOWING_SELECTORS = [
  'button:has-text("Following")',
  '[aria-label*="Following"]',
  'button[aria-pressed="true"][aria-label*="Follow"]',
  'button:has-text("Unfollow")',
  '[role="menuitem"]:has-text("Unfollow")',
];

async function isFollowingState(target: import('playwright').Locator): Promise<boolean> {
  try {
    const ariaLabel = (await target.getAttribute('aria-label')) || '';
    const text = ((await target.textContent()) || '').trim();
    const ariaPressed = (await target.getAttribute('aria-pressed')) || '';

    if (/following/i.test(ariaLabel) || /following/i.test(text)) return true;
    if (/unfollow/i.test(ariaLabel) || /unfollow/i.test(text)) return true;
    if (ariaPressed.toLowerCase() === 'true') return true;
    return false;
  } catch {
    return false;
  }
}

async function clickAndVerifyFollow(page: Page, followButton: VisibleMatch) {
  await glanceAtPage(page);
  await humanClick(page, followButton.locator);
  await actionPause();
  await dismissPopups(page);

  if (await detectRateLimit(page)) {
    return { success: false, error: 'RATE_LIMITED' } as const;
  }

  if (await isFollowingState(followButton.locator)) {
    return { success: true, action: 'followed' } as const;
  }

  const nowFollowing = await findVisibleButton(page, FOLLOWING_SELECTORS, 2200);
  if (nowFollowing) {
    return { success: true, action: 'followed' } as const;
  }

  return null;
}

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

  const primaryAttempt = await clickAndVerifyFollow(page, followButton);
  if (primaryAttempt) {
    return primaryAttempt;
  }

  // Retry once in case the first click hit a stale/secondary action row.
  await microPause();
  const retryButton = await findVisibleButton(page, FOLLOW_SELECTORS, 1200);
  if (retryButton) {
    const retryAttempt = await clickAndVerifyFollow(page, retryButton);
    if (retryAttempt) {
      return retryAttempt;
    }
  }

  // LinkedIn can replace action rows without rendering a visible "Following" label immediately.
  // If no follow CTA is visible anymore, treat click as accepted.
  const followStillVisible = await findVisibleButton(page, FOLLOW_SELECTORS, 1200);
  return {
    success: !followStillVisible,
    action: !followStillVisible ? 'followed_accepted' : 'click_failed',
  };
}
