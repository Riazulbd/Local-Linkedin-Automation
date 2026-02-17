import type { Page } from 'playwright';
import { PlaywrightManager } from './PlaywrightManager';
import { LI, findFirst } from './helpers/selectors';
import { actionDelay, humanClick, navigationDelay } from './helpers/humanBehavior';
import { withPopupGuard } from './helpers/popupGuard';
import { supabase } from '../lib/supabase';
import { logger } from '../logger';

interface ConversationSnapshot {
  threadId: string;
  contactName: string | null;
  preview: string | null;
  unreadCount: number;
}

interface MessageSnapshot {
  messageId: string | null;
  senderName: string | null;
  senderIsMe: boolean;
  body: string;
  sentAt: string | null;
}

interface SyncResult {
  profileId: string;
  conversationsSynced: number;
  messagesSynced: number;
  lastSyncedAt: string;
}

interface ProfileRef {
  id: string;
  adspower_profile_id: string | null;
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

    try {
      const profile = await this.getProfileRef(profileId);
      if (!profile) throw new Error('LinkedIn profile not found for unibox sync');

      const page = await this.manager.getPage({
        adspowerProfileId: profile.adspower_profile_id ?? undefined,
      });

      const conversations = await withPopupGuard(page, async () => {
        await page.goto('https://www.linkedin.com/messaging/', {
          waitUntil: 'domcontentloaded',
          timeout: 45000,
        });
        await navigationDelay();
        return this.captureConversations(page);
      });

      let conversationRows = 0;
      for (const convo of conversations) {
        const { error } = await supabase.from('unibox_conversations').upsert(
          {
            profile_id: profile.id,
            linkedin_thread_id: convo.threadId,
            contact_name: convo.contactName,
            last_message_text: convo.preview,
            unread_count: convo.unreadCount,
            last_synced_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'profile_id,linkedin_thread_id' }
        );
        if (!error) {
          conversationRows += 1;
        }
      }

      const activeMessages = await this.captureActiveConversationMessages(page);
      let messageRows = 0;

      if (conversations[0]?.threadId && activeMessages.length > 0) {
        const { data: convoRow } = await supabase
          .from('unibox_conversations')
          .select('id')
          .eq('profile_id', profile.id)
          .eq('linkedin_thread_id', conversations[0].threadId)
          .single();

        const conversationId = (convoRow as { id?: string } | null)?.id;
        if (conversationId) {
          for (const msg of activeMessages) {
            const { error } = await supabase.from('unibox_messages').upsert(
              {
                conversation_id: conversationId,
                linkedin_message_id: msg.messageId,
                sender_name: msg.senderName,
                sender_is_me: msg.senderIsMe,
                body: msg.body,
                sent_at: msg.sentAt,
              },
              { onConflict: 'conversation_id,linkedin_message_id' }
            );
            if (!error) {
              messageRows += 1;
            }
          }
        }
      }

      const syncedAt = new Date().toISOString();
      this.lastSyncByProfile.set(profile.id, syncedAt);

      logger.info('Unibox sync finished', {
        profileId: profile.id,
        conversationsSynced: conversationRows,
        messagesSynced: messageRows,
      });

      return {
        profileId: profile.id,
        conversationsSynced: conversationRows,
        messagesSynced: messageRows,
        lastSyncedAt: syncedAt,
      };
    } finally {
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
      } catch (syncError) {
        logger.warn('Unibox profile sync failed', {
          profileId: id,
          error: syncError instanceof Error ? syncError.message : String(syncError),
        });
      }
    }

    return {
      syncedProfiles: results.length,
      results,
    };
  }

  private async getProfileRef(profileId: string): Promise<ProfileRef | null> {
    const { data, error } = await supabase
      .from('linkedin_profiles')
      .select('id, adspower_profile_id')
      .eq('id', profileId)
      .single();

    if (error) return null;

    return {
      id: String((data as Record<string, unknown>).id),
      adspower_profile_id:
        (data as Record<string, unknown>).adspower_profile_id == null
          ? null
          : String((data as Record<string, unknown>).adspower_profile_id),
    };
  }

  private async captureConversations(page: Page): Promise<ConversationSnapshot[]> {
    const firstConversation = await findFirst(page, LI.inboxConversationItem, 4000);
    if (firstConversation) {
      await humanClick(page, firstConversation);
      await actionDelay();
    }

    return page.evaluate(() => {
      const rows = Array.from(
        document.querySelectorAll('.msg-conversation-listitem, li[data-test-list-item]')
      ).slice(0, 30);

      return rows.map((row) => {
        const html = row as HTMLElement;
        const threadCandidate =
          html.getAttribute('data-conversation-id') ||
          html.getAttribute('data-id') ||
          html.getAttribute('data-urn') ||
          html.dataset['conversationId'] ||
          '';
        const fallbackThreadId =
          threadCandidate && threadCandidate.trim().length > 0
            ? threadCandidate
            : (html.textContent || '').trim().slice(0, 80).toLowerCase().replace(/\s+/g, '_');

        const nameEl =
          html.querySelector('.msg-conversation-card__participant-names') ||
          html.querySelector('.msg-conversation-listitem__participant-names') ||
          html.querySelector('h3');

        const previewEl =
          html.querySelector('.msg-conversation-card__message-snippet') ||
          html.querySelector('.msg-conversation-listitem__summary') ||
          html.querySelector('p');

        const unreadEl = html.querySelector('.msg-conversation-card__unread-count, .msg-conversation-listitem__unread-count');
        const unreadRaw = unreadEl?.textContent?.replace(/[^\d]/g, '') || '0';

        return {
          threadId: fallbackThreadId || `thread_${Math.random().toString(16).slice(2, 10)}`,
          contactName: nameEl?.textContent?.trim() || null,
          preview: previewEl?.textContent?.trim() || null,
          unreadCount: Number(unreadRaw) || 0,
        };
      });
    });
  }

  private async captureActiveConversationMessages(page: Page): Promise<MessageSnapshot[]> {
    await findFirst(page, LI.inboxMessageList, 3000);

    return page.evaluate(() => {
      const rows = Array.from(
        document.querySelectorAll('.msg-s-message-list__event, [data-event-urn]')
      ).slice(-40);

      return rows
        .map((row) => {
          const html = row as HTMLElement;
          const bodyEl =
            html.querySelector('.msg-s-event-listitem__body') ||
            html.querySelector('.msg-s-event-listitem__message-bubble') ||
            html.querySelector('p');

          const senderEl =
            html.querySelector('.msg-s-message-group__name') ||
            html.querySelector('.msg-s-event-listitem__name') ||
            html.querySelector('h4');

          const timeEl =
            html.querySelector('time') ||
            html.querySelector('.msg-s-message-group__timestamp');

          const messageId =
            html.getAttribute('data-event-urn') ||
            html.getAttribute('data-id') ||
            null;

          const senderName = senderEl?.textContent?.trim() || null;
          const body = bodyEl?.textContent?.trim() || '';

          if (!body) return null;

          const className = html.className || '';
          const senderIsMe =
            className.includes('msg-s-event-listitem--self') ||
            className.includes('self');

          return {
            messageId,
            senderName,
            senderIsMe,
            body,
            sentAt: timeEl?.getAttribute('datetime') || null,
          };
        })
        .filter(Boolean) as MessageSnapshot[];
    });
  }
}
