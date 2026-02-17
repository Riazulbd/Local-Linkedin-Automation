import type { Page } from 'playwright';
import { humanClick, randomBetween, sleep } from '../helpers/humanBehavior';
import { dismissPopups, safeWaitForSettle } from '../helpers/linkedinGuard';
import { supabase } from '../../lib/supabase';

const INBOX_URL = 'https://www.linkedin.com/messaging/';

interface ScrapedThread {
  linkedinThreadId: string;
  participantName: string;
  participantUrl: string;
  participantAvatar: string;
  lastMessageText: string;
  lastMessageAt: string;
  unreadCount: number;
  messages: ScrapedMessage[];
}

interface ScrapedMessage {
  linkedinMsgId: string;
  direction: 'sent' | 'received';
  body: string;
  sentAt: string;
}

export async function syncInbox(page: Page, profileId: string): Promise<void> {
  await page.goto(INBOX_URL, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await safeWaitForSettle(page);
  await dismissPopups(page);

  const threads = await scrapeThreadList(page);

  for (const thread of threads) {
    await openThread(page, thread.linkedinThreadId, thread.participantName);
    thread.messages = await scrapeActiveThreadMessages(page);

    const { data: existing } = await supabase
      .from('message_threads')
      .select('id, last_message_at')
      .eq('linkedin_thread_id', thread.linkedinThreadId)
      .eq('profile_id', profileId)
      .maybeSingle();

    if (existing) {
      const lastKnown = new Date(existing.last_message_at ?? 0).getTime();
      const lastSeen = new Date(thread.lastMessageAt).getTime();

      if (lastSeen > lastKnown) {
        await supabase
          .from('message_threads')
          .update({
            participant_name: thread.participantName,
            participant_url: thread.participantUrl,
            participant_avatar: thread.participantAvatar,
            last_message_text: thread.lastMessageText,
            last_message_at: thread.lastMessageAt,
            unread_count: thread.unreadCount,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id);
      }

      await upsertMessages(existing.id, thread.messages);
    } else {
      const { data: newThread } = await supabase
        .from('message_threads')
        .insert({
          profile_id: profileId,
          linkedin_thread_id: thread.linkedinThreadId,
          participant_name: thread.participantName,
          participant_url: thread.participantUrl,
          participant_avatar: thread.participantAvatar,
          last_message_text: thread.lastMessageText,
          last_message_at: thread.lastMessageAt,
          unread_count: thread.unreadCount,
        })
        .select('id')
        .single();

      if (newThread) {
        await upsertMessages(newThread.id, thread.messages);
      }
    }

    await sleep(randomBetween(300, 900));
  }
}

async function scrapeThreadList(page: Page): Promise<ScrapedThread[]> {
  return page.evaluate(() => {
    const results: ScrapedThread[] = [];

    const threadEls = Array.from(
      document.querySelectorAll('.msg-conversations-container__convo-item-link, .msg-conversation-listitem')
    );

    for (const el of threadEls.slice(0, 60)) {
      const html = el as HTMLElement;
      const id =
        html.getAttribute('data-entity-urn') ||
        html.getAttribute('data-id') ||
        html.id ||
        '';

      const name =
        (html.querySelector('.msg-conversation-listitem__participant-names') as HTMLElement | null)
          ?.innerText
          ?.trim() ||
        (html.querySelector('.msg-conversation-card__participant-names') as HTMLElement | null)
          ?.innerText
          ?.trim() ||
        '';

      const url =
        (html.querySelector('a.app-aware-link') as HTMLAnchorElement | null)?.href ||
        '';

      const avatar = (html.querySelector('img') as HTMLImageElement | null)?.src || '';

      const lastMsg =
        (html.querySelector('.msg-conversation-listitem__message-snippet') as HTMLElement | null)
          ?.innerText
          ?.trim() ||
        (html.querySelector('.msg-conversation-card__message-snippet') as HTMLElement | null)
          ?.innerText
          ?.trim() ||
        '';

      const timeEl = html.querySelector('time') as HTMLTimeElement | null;
      const lastAt = timeEl?.getAttribute('datetime') || new Date().toISOString();

      const unreadRaw =
        (html.querySelector('.notification-badge__count, .msg-conversation-card__unread-count') as HTMLElement | null)
          ?.innerText ||
        '0';
      const unreadCount = Number.parseInt(unreadRaw.replace(/\D/g, ''), 10) || 0;

      if (!name) continue;

      results.push({
        linkedinThreadId: id || `fallback_${name.toLowerCase().replace(/\s+/g, '_')}`,
        participantName: name,
        participantUrl: url,
        participantAvatar: avatar,
        lastMessageText: lastMsg,
        lastMessageAt: lastAt,
        unreadCount,
        messages: [],
      });
    }

    return results;
  });
}

async function openThread(page: Page, threadId: string, participantName: string): Promise<void> {
  const byId = page
    .locator(
      `.msg-conversations-container__convo-item-link[data-entity-urn="${threadId}"], ` +
        `.msg-conversation-listitem[data-entity-urn="${threadId}"]`
    )
    .first();

  if (await byId.isVisible().catch(() => false)) {
    await humanClick(page, byId);
    await safeWaitForSettle(page);
    await dismissPopups(page);
    return;
  }

  const byText = page.locator('.msg-conversation-listitem, .msg-conversations-container__convo-item-link', {
    hasText: participantName,
  }).first();

  if (await byText.isVisible().catch(() => false)) {
    await humanClick(page, byText);
    await safeWaitForSettle(page);
    await dismissPopups(page);
  }
}

async function scrapeActiveThreadMessages(page: Page): Promise<ScrapedMessage[]> {
  return page.evaluate(() => {
    const out: ScrapedMessage[] = [];
    const rows = Array.from(document.querySelectorAll('.msg-s-message-list__event, [data-event-urn]')).slice(-100);

    for (const row of rows) {
      const html = row as HTMLElement;
      const body =
        (html.querySelector('.msg-s-event-listitem__body') as HTMLElement | null)?.innerText?.trim() ||
        (html.querySelector('.msg-s-event-listitem__message-bubble') as HTMLElement | null)?.innerText?.trim() ||
        html.textContent?.trim() ||
        '';

      if (!body) continue;

      const msgId = html.getAttribute('data-event-urn') || html.getAttribute('data-id') || '';
      const sentAt =
        (html.querySelector('time') as HTMLTimeElement | null)?.getAttribute('datetime') ||
        new Date().toISOString();

      const className = html.className || '';
      const direction: 'sent' | 'received' =
        className.includes('msg-s-event-listitem--self') || className.includes('self') ? 'sent' : 'received';

      out.push({
        linkedinMsgId: msgId || `${direction}_${sentAt}_${Math.random().toString(16).slice(2, 10)}`,
        direction,
        body,
        sentAt,
      });
    }

    return out;
  });
}

async function upsertMessages(threadDbId: string, messages: ScrapedMessage[]): Promise<void> {
  if (!messages.length) return;

  const rows = messages.map((msg) => ({
    thread_id: threadDbId,
    linkedin_msg_id: msg.linkedinMsgId,
    direction: msg.direction,
    body: msg.body,
    sent_at: msg.sentAt,
  }));

  await supabase.from('messages').upsert(rows, {
    onConflict: 'linkedin_msg_id',
    ignoreDuplicates: true,
  });
}
