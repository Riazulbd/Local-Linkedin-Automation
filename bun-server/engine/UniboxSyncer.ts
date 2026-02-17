import { PlaywrightManager } from './PlaywrightManager';
import { syncInbox } from './actions/syncInbox';
import { ensureLoggedIn } from './actions/linkedinLogin';
import { replyInInbox } from './actions/replyInInbox';
import { dismissPopups, safeWaitForSettle } from './helpers/linkedinGuard';
import { supabase } from '../lib/supabase';
import { Logger } from '../lib/logger';

const INBOX_URL = 'https://www.linkedin.com/messaging/';

interface SyncResult {
  profileId: string;
  conversationsSynced: number;
  messagesSynced: number;
  lastSyncedAt: string;
}

interface ReplyResult {
  threadId: string;
  profileId: string;
  sentAt: string;
}

interface ProfileRef {
  id: string;
  adspower_profile_id: string | null;
}

interface ThreadRef {
  id: string;
  profile_id: string;
  linkedin_thread_id: string | null;
  participant_name: string | null;
}

export class UniboxSyncer {
  private manager = new PlaywrightManager();
  private syncingProfiles = new Set<string>();
  private lastSyncByProfile = new Map<string, string>();

  getStatus() {
    return {
      syncingProfiles: Array.from(this.syncingProfiles),
      lastSyncByProfile: Object.fromEntries(this.lastSyncByProfile.entries()),
    };
  }

  async syncProfile(profileId: string): Promise<SyncResult> {
    if (this.syncingProfiles.has(profileId)) {
      throw new Error(`Profile ${profileId} is already syncing`);
    }

    this.syncingProfiles.add(profileId);
    const logger = new Logger();

    try {
      const profile = await this.getProfileRef(profileId);
      if (!profile || !profile.adspower_profile_id) {
        throw new Error('LinkedIn profile not found or AdsPower profile is missing');
      }

      const page = await this.manager.getPage({ adspowerProfileId: profile.adspower_profile_id });

      const loginOutcome = await ensureLoggedIn(page, profile.id, profile.adspower_profile_id);
      if (loginOutcome === '2fa_required' || loginOutcome === 'wrong_credentials' || loginOutcome === 'error') {
        throw new Error(`LinkedIn login failed before inbox sync (${loginOutcome})`);
      }

      const beforeCounts = await this.getThreadMessageCounts(profile.id);
      await syncInbox(page, profile.id);
      const afterCounts = await this.getThreadMessageCounts(profile.id);

      const syncedAt = new Date().toISOString();
      this.lastSyncByProfile.set(profile.id, syncedAt);

      return {
        profileId: profile.id,
        conversationsSynced: Math.max(0, afterCounts.threads - beforeCounts.threads),
        messagesSynced: Math.max(0, afterCounts.messages - beforeCounts.messages),
        lastSyncedAt: syncedAt,
      };
    } catch (error) {
      await logger.log(
        'unibox_sync',
        'unibox',
        'error',
        error instanceof Error ? error.message : String(error),
        profileId
      );
      throw error;
    } finally {
      await this.manager.cleanup().catch(() => undefined);
      this.syncingProfiles.delete(profileId);
    }
  }

  async syncAllProfiles() {
    const { data, error } = await supabase
      .from('linkedin_profiles')
      .select('id')
      .order('created_at', { ascending: true });

    if (error) {
      throw new Error(error.message);
    }

    const results: SyncResult[] = [];

    for (const row of data ?? []) {
      const id = String((row as Record<string, unknown>).id || '');
      if (!id) continue;

      try {
        const result = await this.syncProfile(id);
        results.push(result);
      } catch {
        // Continue syncing remaining profiles.
      }
    }

    return {
      syncedProfiles: results.length,
      results,
    };
  }

  async replyToThread(threadId: string, message: string, profileId?: string): Promise<ReplyResult> {
    if (!threadId || !message.trim()) {
      throw new Error('threadId and message are required');
    }

    const thread = await this.getThreadRef(threadId);
    if (!thread) {
      throw new Error('Thread not found');
    }

    const resolvedProfileId = profileId || thread.profile_id;
    if (!resolvedProfileId) {
      throw new Error('Profile could not be resolved for thread');
    }

    if (this.syncingProfiles.has(resolvedProfileId)) {
      throw new Error(`Profile ${resolvedProfileId} is already busy`);
    }

    this.syncingProfiles.add(resolvedProfileId);
    const logger = new Logger();

    try {
      const profile = await this.getProfileRef(resolvedProfileId);
      if (!profile || !profile.adspower_profile_id) {
        throw new Error('LinkedIn profile not found or AdsPower profile is missing');
      }

      const page = await this.manager.getPage({ adspowerProfileId: profile.adspower_profile_id });
      const loginOutcome = await ensureLoggedIn(page, profile.id, profile.adspower_profile_id);
      if (loginOutcome === '2fa_required' || loginOutcome === 'wrong_credentials' || loginOutcome === 'error') {
        throw new Error(`LinkedIn login failed before reply (${loginOutcome})`);
      }

      await page.goto(INBOX_URL, { waitUntil: 'domcontentloaded', timeout: 20000 });
      await safeWaitForSettle(page);
      await dismissPopups(page);

      const result = await replyInInbox(
        page,
        message,
        thread.linkedin_thread_id || undefined,
        thread.participant_name || undefined
      );

      if (!result.success) {
        throw new Error(result.error || 'Failed to send reply');
      }

      const sentAt = new Date().toISOString();
      const syntheticId = `local_${Date.now()}_${Math.random().toString(16).slice(2, 10)}`;

      await supabase.from('messages').insert({
        thread_id: thread.id,
        linkedin_msg_id: syntheticId,
        direction: 'sent',
        body: message.trim(),
        sent_at: sentAt,
        is_read: true,
      });

      await supabase
        .from('message_threads')
        .update({
          last_message_text: message.trim(),
          last_message_at: sentAt,
          updated_at: sentAt,
        })
        .eq('id', thread.id);

      this.lastSyncByProfile.set(profile.id, sentAt);

      return {
        threadId: thread.id,
        profileId: profile.id,
        sentAt,
      };
    } catch (error) {
      await logger.log(
        'unibox_reply',
        'unibox',
        'error',
        error instanceof Error ? error.message : String(error),
        resolvedProfileId
      );
      throw error;
    } finally {
      await this.manager.cleanup().catch(() => undefined);
      this.syncingProfiles.delete(resolvedProfileId);
    }
  }

  private async getProfileRef(profileId: string): Promise<ProfileRef | null> {
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

  private async getThreadRef(threadId: string): Promise<ThreadRef | null> {
    const { data, error } = await supabase
      .from('message_threads')
      .select('id, profile_id, linkedin_thread_id, participant_name')
      .eq('id', threadId)
      .maybeSingle();

    if (error || !data) {
      return null;
    }

    return {
      id: String((data as Record<string, unknown>).id || ''),
      profile_id: String((data as Record<string, unknown>).profile_id || ''),
      linkedin_thread_id:
        (data as Record<string, unknown>).linkedin_thread_id == null
          ? null
          : String((data as Record<string, unknown>).linkedin_thread_id),
      participant_name:
        (data as Record<string, unknown>).participant_name == null
          ? null
          : String((data as Record<string, unknown>).participant_name),
    };
  }

  private async getThreadMessageCounts(profileId: string) {
    const [{ count: threadCount }, { count: messageCount }] = await Promise.all([
      supabase
        .from('message_threads')
        .select('id', { count: 'exact', head: true })
        .eq('profile_id', profileId),
      supabase
        .from('messages')
        .select('id', { count: 'exact', head: true }),
    ]);

    return {
      threads: threadCount || 0,
      messages: messageCount || 0,
    };
  }
}
