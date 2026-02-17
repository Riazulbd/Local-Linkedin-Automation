import type { Page } from 'playwright';
import { actionPause, humanClick, humanType, randomBetween, sleep } from '../helpers/humanBehavior';
import { dismissPopups, findVisibleButton } from '../helpers/linkedinGuard';
import { supabase } from '../../lib/supabase';
import { decryptCredential } from '../helpers/crypto';

const LINKEDIN_LOGIN_URL = 'https://www.linkedin.com/login';

export type LoginOutcome =
  | 'already_logged_in'
  | 'logged_in'
  | '2fa_required'
  | 'wrong_credentials'
  | 'unknown_challenge'
  | 'error';

export async function ensureLoggedIn(
  page: Page,
  profileId: string,
  _adspowerProfileId: string
): Promise<LoginOutcome> {
  const url = page.url();
  if (url.includes('linkedin.com') && !url.includes('/login') && !url.includes('/authwall')) {
    const loggedInIndicator = await page
      .locator('.global-nav__me, a[href*="/feed/"]')
      .first()
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    if (loggedInIndicator) {
      return 'already_logged_in';
    }
  }

  const { data: profile } = await supabase
    .from('linkedin_profiles')
    .select('linkedin_email_encrypted, linkedin_password_encrypted')
    .eq('id', profileId)
    .single();

  if (!profile?.linkedin_email_encrypted || !profile?.linkedin_password_encrypted) {
    return 'error';
  }

  const email = decryptCredential(profile.linkedin_email_encrypted);
  const password = decryptCredential(profile.linkedin_password_encrypted);

  await page.goto(LINKEDIN_LOGIN_URL, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await sleep(randomBetween(1200, 2500));
  await dismissPopups(page);

  const emailField = page.locator('#username').first();
  if (!(await emailField.isVisible({ timeout: 3000 }))) {
    return 'error';
  }

  await humanType(page, emailField, email);
  await sleep(randomBetween(500, 1200));
  await dismissPopups(page);

  const passField = page.locator('#password').first();
  if (!(await passField.isVisible({ timeout: 3000 }))) {
    return 'error';
  }

  await humanType(page, passField, password);
  await sleep(randomBetween(400, 900));
  await dismissPopups(page);

  const signInBtn = await findVisibleButton(
    page,
    ['button[type="submit"]', 'button:has-text("Sign in")'],
    3000
  );

  if (!signInBtn) {
    return 'error';
  }

  await humanClick(page, signInBtn.locator);
  await sleep(randomBetween(3000, 5000));
  await dismissPopups(page);

  const newUrl = page.url();

  const is2FAPage =
    newUrl.includes('/checkpoint/') ||
    newUrl.includes('/two-step-verification') ||
    (await page.locator('text="two-step verification"').isVisible({ timeout: 2000 }).catch(() => false)) ||
    (await page.locator('[name="pin"]').isVisible({ timeout: 1000 }).catch(() => false)) ||
    (await page.locator('input[autocomplete="one-time-code"]').isVisible({ timeout: 1000 }).catch(() => false));

  if (is2FAPage) {
    const isEmailCode = await page.locator('text="email"').isVisible({ timeout: 1000 }).catch(() => false);
    const challengeType = isEmailCode ? 'email_code' : 'authenticator';

    await supabase
      .from('linkedin_profiles')
      .update({
        login_status: '2fa_pending',
        twofa_challenge_type: challengeType,
        twofa_requested_at: new Date().toISOString(),
      })
      .eq('id', profileId);

    const code = await waitFor2FACode(profileId);

    if (!code) {
      await supabase.from('linkedin_profiles').update({ login_status: 'error' }).eq('id', profileId);
      return '2fa_required';
    }

    const codeInput = page
      .locator('[name="pin"], input[autocomplete="one-time-code"], #input__phone_verification_pin')
      .first();

    if (await codeInput.isVisible({ timeout: 3000 })) {
      await humanType(page, codeInput, code);
      await sleep(randomBetween(500, 1000));
      await dismissPopups(page);

      const submitBtn = await findVisibleButton(
        page,
        ['button[type="submit"]', 'button:has-text("Submit")', 'button:has-text("Verify")'],
        3000
      );

      if (submitBtn) {
        await humanClick(page, submitBtn.locator);
        await sleep(randomBetween(3000, 5000));
        await dismissPopups(page);
      }
    }

    await supabase
      .from('linkedin_profiles')
      .update({
        twofa_challenge_type: null,
        twofa_requested_at: null,
      })
      .eq('id', profileId);
  }

  const wrongCredentials = await page
    .locator('text="Wrong email or password"')
    .isVisible({ timeout: 2000 })
    .catch(() => false);

  if (wrongCredentials) {
    await supabase.from('linkedin_profiles').update({ login_status: 'error' }).eq('id', profileId);
    return 'wrong_credentials';
  }

  const onFeed =
    page.url().includes('feed') ||
    page.url().includes('mynetwork') ||
    (await page.locator('.global-nav__me').isVisible({ timeout: 5000 }).catch(() => false));

  if (onFeed) {
    await supabase.from('linkedin_profiles').update({ login_status: 'logged_in' }).eq('id', profileId);
    await actionPause();
    return 'logged_in';
  }

  return 'unknown_challenge';
}

async function waitFor2FACode(profileId: string, timeoutMs = 300000): Promise<string | null> {
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    const { data } = await supabase
      .from('linkedin_profiles')
      .select('pending_2fa_code')
      .eq('id', profileId)
      .single();

    if (data?.pending_2fa_code) {
      await supabase
        .from('linkedin_profiles')
        .update({ pending_2fa_code: null })
        .eq('id', profileId);

      return data.pending_2fa_code;
    }

    await sleep(3000);
  }

  return null;
}
