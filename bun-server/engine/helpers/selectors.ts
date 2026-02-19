import { safeContentEditableSelector, safeInputSelector } from './selectorHelpers';

export const LI = {
  // ── Profile Actions ──────────────────────────────────────────
  followBtn: [
    'button:has-text("Follow"):not(:has-text("Following"))',
    '[aria-label="Follow"]',
    'button[data-test-follow-btn]',
  ],
  followingBtn: [
    'button:has-text("Following")',
    '[aria-label="Following"]',
  ],
  connectBtn: [
    'button:has-text("Connect")',
    '[aria-label^="Connect"]',
    'button[data-test-connect-btn]',
  ],
  moreActionsBtn: [
    'button:has-text("More")',
    '[aria-label="More actions"]',
    'button[id*="overflow"]',
  ],
  connectInMoreMenu: [
    'li button:has-text("Connect")',
    '[aria-label*="Connect"] li',
  ],
  messageBtn: [
    'main button[aria-label^="Message "]',
    'button[aria-label^="Message "]',
    'button[aria-label^="Message"][class*="artdeco-button"]',
    'button.pvs-profile-actions__action:has-text("Message")',
    'button.pvs-sticky-header-profile-actions__action:has-text("Message")',
    '.pvs-profile-actions button:has-text("Message")',
    '.pvs-sticky-header-profile-actions button:has-text("Message")',
    '[data-control-name="message"]',
    '[data-control-name*="message"]',
  ],
  messageInMoreMenu: [
    'div[role="menu"] button:has-text("Message")',
    'ul[role="menu"] button:has-text("Message")',
    'li button:has-text("Message")',
    '[role="menuitem"]:has-text("Message")',
  ],
  pendingBtn: [
    'button:has-text("Pending")',
    '[aria-label*="Pending"]',
  ],

  // ── Connection Request Modal ──────────────────────────────────
  sendWithoutNoteBtn: [
    'button[aria-label="Send without a note"]',
    'button:has-text("Send without a note")',
    '[data-test-modal-container] button:has-text("Send")',
  ],
  addNoteBtn: [
    'button:has-text("Add a note")',
    'button[aria-label="Add a note"]',
  ],
  connectionNoteTextarea: [
    safeInputSelector('textarea[name="message"]'),
    safeInputSelector('#custom-message'),
    safeInputSelector('textarea[placeholder*="note"]'),
  ],
  sendInviteBtn: [
    'button[aria-label="Send invitation"]',
    'button:has-text("Send invitation")',
    '[data-test-modal-container] button[type="submit"]',
  ],

  // ── Messaging ─────────────────────────────────────────────────
  messageComposeBox: [
    // Primary - specific to open conversation bubble
    safeContentEditableSelector(
      '.msg-overlay-conversation-bubble:not(.msg-overlay-conversation-bubble--is-minimized) .msg-form__contenteditable[contenteditable="true"]'
    ),
    safeContentEditableSelector(
      '.msg-overlay-conversation-bubble:not(.msg-overlay-conversation-bubble--is-minimized) [role="textbox"][contenteditable="true"]'
    ),

    // Fallbacks
    safeContentEditableSelector('.msg-overlay-conversation-bubble [contenteditable="true"]'),
    safeContentEditableSelector('.msg-form__contenteditable[contenteditable="true"]'),
  ],
  messageComposeActivator: [
    '.msg-overlay-conversation-bubble:not(.msg-overlay-conversation-bubble--is-minimized) .msg-form__placeholder',
    '.msg-overlay-conversation-bubble:not(.msg-overlay-conversation-bubble--is-minimized) [aria-label*="Write a message"]',
  ],
  messageModalHeader: [
    '.msg-overlay-conversation-bubble:not(.msg-overlay-conversation-bubble--is-minimized) .msg-overlay-bubble-header__title',
    '.msg-overlay-conversation-bubble:not(.msg-overlay-conversation-bubble--is-minimized) a.ember-view.truncate',
    '.msg-overlay-conversation-bubble:not(.msg-overlay-conversation-bubble--is-minimized) h2',
  ],
  messagingConversationItem: [
    '.msg-conversation-listitem',
    '.msg-overlay-list-bubble li[role="listitem"]',
    '.msg-conversations-container__convo-item-link',
    '.msg-overlay-list-bubble__conversations-list li',
  ],
  messageSendBtn: [
    '.msg-form__send-button',
    '.msg-form__send-button:not([disabled])',
    'button.msg-form__send-button[aria-disabled="false"]',
    '.msg-form button[aria-label*="Send"]',
    '.msg-form__right-actions button[type="submit"]',
    'button[data-control-name*="send"]',
    'footer button[type="submit"]',
    'button[aria-label^="Send"]',
    'button[aria-label*="Send message"]',
    'button[type="submit"]:has-text("Send")',
    'button[aria-label="Send"]',
  ],

  // ── LinkedIn Inbox page (/messaging/) ────────────────────────
  inboxConversationList: [
    '.msg-conversations-container__conversations-list',
    '.scaffold-layout__list-container',
  ],
  inboxConversationItem: [
    '.msg-conversation-listitem',
    'li[data-test-list-item]',
  ],
  inboxMessageList: [
    '.msg-s-message-list',
    '.scaffold-layout__detail',
  ],
  inboxMessageItem: [
    '.msg-s-message-list__event',
    '[data-event-urn]',
  ],

  // ── Profile page ─────────────────────────────────────────────
  profileName: ['h1.text-heading-xlarge', 'h1.inline.t-24'],
  profileHeadline: ['.text-body-medium.break-words', '.pv-top-card--list .t-16'],
  profileConnectionDegree: [
    '.dist-value',
    '[data-test-connection-degree]',
  ],
} as const;

export async function findFirst(
  page: import('playwright').Page,
  selectors: readonly string[],
  timeout = 2000
): Promise<import('playwright').Locator | null> {
  const maxCandidatesPerSelector = 40;

  for (const sel of selectors) {
    try {
      const root = page.locator(sel);
      const count = Math.min(await root.count(), maxCandidatesPerSelector);
      if (count === 0) continue;

      for (let idx = 0; idx < count; idx += 1) {
        const candidate = root.nth(idx);
        const candidateTimeout = idx === 0 ? timeout : 250;
        if (await candidate.isVisible({ timeout: candidateTimeout })) {
          return candidate;
        }
      }
    } catch { }
  }
  return null;
}
