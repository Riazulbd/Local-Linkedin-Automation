import { PlaywrightManager } from './PlaywrightManager';
import { humanClick, humanType, navigationDelay } from './helpers/humanBehavior';
import { withPopupGuard } from './helpers/popupGuard';
import { supabase } from '../lib/supabase';
import { logger } from '../logger';

interface LoginInput {
  profileId: string;
  email: string;
  password: string;
}

interface TwoFactorInput {
  profileId: string;
  code: string;
}

interface ProfileLoginRef {
  id: string;
  adspower_profile_id: string | null;
}

export class LoginManager {
  private manager = new PlaywrightManager();
  private pendingCodes = new Map<string, string>();
  private pendingStates = new Map<string, 'idle' | 'awaiting_2fa' | 'running'>();

  getStatus(profileId?: string) {
    if (profileId) {
      return {
        profileId,
        state: this.pendingStates.get(profileId) ?? 'idle',
        waitingFor2fa: this.pendingStates.get(profileId) === 'awaiting_2fa',
      };
    }

    return {
      states: Object.fromEntries(this.pendingStates.entries()),
    };
  }

  async login({ profileId, email, password }: LoginInput) {
    const profile = await this.getProfileRef(profileId);
    if (!profile) {
      throw new Error('Profile not found');
    }

    this.pendingStates.set(profileId, 'running');
    await this.recordAuthEvent(profileId, 'login_required', { email });

    try {
      const page = await this.manager.getPage({
        adspowerProfileId: profile.adspower_profile_id ?? undefined,
      });

      await withPopupGuard(page, async () => {
        await page.goto('https://www.linkedin.com/login', { waitUntil: 'domcontentloaded', timeout: 45000 });
        await navigationDelay();
      });

      const emailInput = page.locator('#username, input[name="session_key"], input[type="email"]').first();
      const passwordInput = page.locator('#password, input[name="session_password"], input[type="password"]').first();
      const submitBtn = page.locator('button[type="submit"], button:has-text("Sign in")').first();

      await humanType(page, emailInput, email);
      await humanType(page, passwordInput, password);
      await humanClick(page, submitBtn);
      await navigationDelay();

      const twoFactorInput = page
        .locator('input[name="pin"], input#input__phone_verification_pin, input[name="verificationCode"]')
        .first();

      if (await twoFactorInput.isVisible().catch(() => false)) {
        this.pendingStates.set(profileId, 'awaiting_2fa');
        await this.recordAuthEvent(profileId, '2fa_required', {});
        const code = await this.waitForTwoFactorCode(profileId, 180000);

        await humanType(page, twoFactorInput, code);
        const verifyButton = page.locator('button[type="submit"], button:has-text("Verify"), button:has-text("Submit")').first();
        await humanClick(page, verifyButton);
        await navigationDelay();
      }

      const success = await this.detectLoginSuccess(page);
      if (!success) {
        await this.recordAuthEvent(profileId, 'login_failed', {
          reason: 'Could not confirm LinkedIn authenticated session',
        });
        this.pendingStates.set(profileId, 'idle');
        return {
          success: false,
          error: 'Could not confirm LinkedIn authenticated session',
        };
      }

      await supabase
        .from('linkedin_profiles')
        .update({
          session_valid: true,
          last_login_at: new Date().toISOString(),
          linkedin_email_login: email,
          linkedin_password_enc: password,
          updated_at: new Date().toISOString(),
        })
        .eq('id', profileId);

      await this.recordAuthEvent(profileId, 'login_success', {});
      this.pendingStates.set(profileId, 'idle');

      return { success: true };
    } catch (error) {
      this.pendingStates.set(profileId, 'idle');
      await this.recordAuthEvent(profileId, 'login_failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async submitTwoFactor({ profileId, code }: TwoFactorInput) {
    if (!profileId || !code?.trim()) {
      throw new Error('profileId and code are required');
    }

    this.pendingCodes.set(profileId, code.trim());

    const { error } = await supabase.from('auth_events').insert({
      profile_id: profileId,
      event_type: '2fa_submitted',
      payload: {},
      code: code.trim(),
      resolved: true,
    });

    if (error) {
      throw new Error(error.message);
    }

    return { accepted: true };
  }

  private async getProfileRef(profileId: string): Promise<ProfileLoginRef | null> {
    const { data, error } = await supabase
      .from('linkedin_profiles')
      .select('id, adspower_profile_id')
      .eq('id', profileId)
      .single();
    if (error || !data) return null;

    return {
      id: String((data as Record<string, unknown>).id),
      adspower_profile_id:
        (data as Record<string, unknown>).adspower_profile_id == null
          ? null
          : String((data as Record<string, unknown>).adspower_profile_id),
    };
  }

  private async waitForTwoFactorCode(profileId: string, timeoutMs: number) {
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
      const inMemoryCode = this.pendingCodes.get(profileId);
      if (inMemoryCode) {
        this.pendingCodes.delete(profileId);
        return inMemoryCode;
      }

      const { data } = await supabase
        .from('auth_events')
        .select('id, code, resolved')
        .eq('profile_id', profileId)
        .eq('event_type', '2fa_submitted')
        .order('created_at', { ascending: false })
        .limit(1);

      const latest = (data?.[0] ?? null) as { id?: string; code?: string | null; resolved?: boolean } | null;
      if (latest?.code) {
        if (!latest.resolved && latest.id) {
          await supabase.from('auth_events').update({ resolved: true }).eq('id', latest.id);
        }
        return latest.code;
      }

      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    throw new Error('Timed out waiting for 2FA code');
  }

  private async detectLoginSuccess(page: import('playwright').Page) {
    const currentUrl = page.url();
    if (currentUrl.includes('/feed') || currentUrl.includes('/mynetwork')) {
      return true;
    }

    const navMarker = page.locator('header.global-nav, nav.global-nav, a[href*="/feed/"]').first();
    return navMarker.isVisible().catch(() => false);
  }

  private async recordAuthEvent(
    profileId: string,
    eventType: 'login_required' | '2fa_required' | '2fa_submitted' | 'login_success' | 'login_failed',
    payload: Record<string, unknown>
  ) {
    const { error } = await supabase.from('auth_events').insert({
      profile_id: profileId,
      event_type: eventType,
      payload,
      resolved: eventType === 'login_success' || eventType === 'login_failed',
    });

    if (error) {
      logger.warn('Failed writing auth event', {
        profileId,
        eventType,
        error: error.message,
      });
    }
  }
}
