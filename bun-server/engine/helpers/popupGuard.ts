import type { Page } from 'playwright';
import { microPause } from './humanBehavior';
import { detectLoggedOut, detectRateLimit, dismissPopups } from './linkedinGuard';

export class PopupError extends Error {
  constructor(public type: 'captcha' | 'login_wall' | 'unknown', message: string) {
    super(message);
    this.name = 'PopupError';
  }
}

export async function withPopupGuard<T>(page: Page, action: () => Promise<T>, retries = 2): Promise<T> {
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    await dismissPopups(page);

    if (await detectRateLimit(page)) {
      throw new PopupError('captcha', 'Blocked by LinkedIn security check');
    }

    if (await detectLoggedOut(page)) {
      throw new PopupError('login_wall', 'LinkedIn session appears logged out');
    }

    try {
      return await action();
    } catch (error) {
      if (error instanceof PopupError) {
        throw error;
      }

      if (attempt >= retries) {
        throw error;
      }

      await dismissPopups(page);
      await microPause();
    }
  }

  throw new PopupError('unknown', 'withPopupGuard exhausted retries');
}

export { dismissPopups };
