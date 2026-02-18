import type { Page } from 'playwright';
import { ensureLoggedIn, type EnsureLoginOptions } from './actions/linkedinLogin';
import { encryptCredential } from './helpers/crypto';
import { supabase } from '../lib/supabase';
import { browserSessionManager } from './BrowserSessionManager';

interface LoginInput {
  profileId: string;
  email?: string;
  password?: string;
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
  private pendingStates = new Map<string, 'idle' | 'awaiting_2fa' | 'running'>();

  getStatus(profileId?: string) {
    if (profileId) {
      const state = this.pendingStates.get(profileId) ?? 'idle';
      return {
        profileId,
        state,
        waitingFor2fa: state === 'awaiting_2fa',
      };
    }

    return {
      states: Object.fromEntries(this.pendingStates.entries()),
    };
  }

  async login({ profileId, email, password }: LoginInput, options: EnsureLoginOptions = {}) {
    const profile = await this.getProfileRef(profileId);
    if (!profile || !profile.adspower_profile_id) {
      throw new Error('Profile not found or AdsPower profile ID is missing');
    }

    if (email && password) {
      await supabase
        .from('linkedin_profiles')
        .update({
          linkedin_email_encrypted: encryptCredential(email),
          linkedin_password_encrypted: encryptCredential(password),
        })
        .eq('id', profileId);
    }

    this.pendingStates.set(profileId, 'running');

    try {
      const page = await browserSessionManager.getSession(profileId, profile.adspower_profile_id);
      const outcome = await ensureLoggedIn(page, profileId, profile.adspower_profile_id, options);

      if (outcome === '2fa_required') {
        this.pendingStates.set(profileId, 'awaiting_2fa');
        return { success: false, requires2fa: true, outcome };
      }

      const success = outcome === 'logged_in' || outcome === 'already_logged_in';
      this.pendingStates.set(profileId, 'idle');

      return {
        success,
        outcome,
      };
    } catch (error) {
      this.pendingStates.set(profileId, 'idle');
      throw error;
    }
  }

  async loginProfile(
    profileId: string,
    adspowerProfileId: string,
    page: Page,
    options: EnsureLoginOptions = {}
  ): Promise<'success' | 'already_logged_in' | 'failed' | 'requires_2fa'> {
    this.pendingStates.set(profileId, 'running');

    try {
      const outcome = await ensureLoggedIn(page, profileId, adspowerProfileId, options);

      if (outcome === 'already_logged_in') {
        this.pendingStates.set(profileId, 'idle');
        return 'already_logged_in';
      }

      if (outcome === 'logged_in') {
        this.pendingStates.set(profileId, 'idle');
        return 'success';
      }

      if (outcome === '2fa_required') {
        this.pendingStates.set(profileId, 'awaiting_2fa');
        return 'requires_2fa';
      }

      this.pendingStates.set(profileId, 'idle');
      return 'failed';
    } catch {
      this.pendingStates.set(profileId, 'idle');
      return 'failed';
    }
  }

  async submitTwoFactor({ profileId, code }: TwoFactorInput) {
    if (!profileId || !code.trim()) {
      throw new Error('profileId and code are required');
    }

    const { error } = await supabase
      .from('linkedin_profiles')
      .update({ pending_2fa_code: code.trim() })
      .eq('id', profileId);

    if (error) {
      throw new Error(error.message);
    }

    this.pendingStates.set(profileId, 'running');

    return {
      accepted: true,
    };
  }

  private async getProfileRef(profileId: string): Promise<ProfileLoginRef | null> {
    const { data, error } = await supabase
      .from('linkedin_profiles')
      .select('id, adspower_profile_id')
      .eq('id', profileId)
      .single();

    if (error || !data) {
      return null;
    }

    return {
      id: String((data as Record<string, unknown>).id || ''),
      adspower_profile_id:
        (data as Record<string, unknown>).adspower_profile_id == null
          ? null
          : String((data as Record<string, unknown>).adspower_profile_id),
    };
  }
}
