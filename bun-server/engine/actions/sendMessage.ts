import type { Page } from 'playwright';
import type { ActionResult, CampaignStep, Lead } from '../../../types';
import { LI, findFirst } from '../helpers/selectors';
import { actionDelay, humanClick, humanType } from '../helpers/humanBehavior';
import { withPopupGuard } from '../helpers/popupGuard';
import { interpolate } from '../helpers/templateEngine';
import { Logger } from '../../lib/logger';

type SendMessageData = Partial<CampaignStep['config']> & {
  messageTemplate?: string;
  runId?: string;
};

const actionLogger = new Logger(process.env.ACTION_LOG_RUN_ID ?? 'runtime_send_message');

type SelectorSample = {
  selector: string;
  total: number;
  visible: number;
};

async function collectSelectorStats(page: Page, selectors: readonly string[]): Promise<SelectorSample[]> {
  const out: SelectorSample[] = [];
  for (const selector of selectors) {
    try {
      const locator = page.locator(selector);
      const total = await locator.count();
      const scan = Math.min(total, 24);
      let visible = 0;
      for (let i = 0; i < scan; i += 1) {
        if (await locator.nth(i).isVisible().catch(() => false)) visible += 1;
      }
      out.push({ selector, total, visible });
    } catch {
      out.push({ selector, total: 0, visible: 0 });
    }
  }
  return out;
}

type MessageCandidateMeta = {
  ariaLabel: string;
  text: string;
  className: string;
  dataControlName: string;
  inMenu: boolean;
};

async function getMessageCandidateMeta(locator: import('playwright').Locator): Promise<MessageCandidateMeta | null> {
  try {
    return await locator.evaluate((el) => {
      const html = el as HTMLElement;
      return {
        ariaLabel: (html.getAttribute('aria-label') || '').trim(),
        text: (html.textContent || '').trim(),
        className: (html.className || '').trim(),
        dataControlName: (html.getAttribute('data-control-name') || '').trim(),
        inMenu: Boolean(html.closest('[role="menu"], .artdeco-dropdown__content, .artdeco-dropdown__item')),
      };
    });
  } catch {
    return null;
  }
}

function isValidMessageCandidate(meta: MessageCandidateMeta, fromMenu: boolean): boolean {
  const rawLabel = [meta.ariaLabel, meta.text].find((v) => v && v.trim().length > 0) || '';
  const label = rawLabel.toLowerCase().replace(/\s+/g, ' ').trim();

  if (!label.includes('message')) return false;

  // Exclude profile sharing / forwarding flows that don't open the direct composer.
  const blocked = [
    'send in a private message',
    'profile via message',
    'share in a message',
    'message this profile',
    'send this profile',
  ];
  if (blocked.some((token) => label.includes(token))) return false;

  if (fromMenu) {
    return label === 'message' || label.startsWith('message ') || label.includes('send message');
  }

  // Direct profile action should be either plain Message or an aria label like "Message Andrea Bunch".
  return (
    label === 'message' ||
    label.startsWith('message ') ||
    meta.dataControlName.toLowerCase() === 'message'
  );
}

async function findMessageAction(
  page: Page,
  selectors: readonly string[],
  options: { fromMenu: boolean; timeout: number }
) {
  for (const selector of selectors) {
    const locator = page.locator(selector);
    let total = 0;
    try {
      total = Math.min(await locator.count(), 25);
    } catch {
      continue;
    }

    for (let idx = 0; idx < total; idx += 1) {
      const candidate = locator.nth(idx);
      const visible = await candidate
        .isVisible({ timeout: idx === 0 ? options.timeout : 300 })
        .catch(() => false);
      if (!visible) continue;

      const meta = await getMessageCandidateMeta(candidate);
      if (!meta) continue;
      if (!isValidMessageCandidate(meta, options.fromMenu)) continue;
      return candidate;
    }
  }

  return null;
}

async function captureMessagingDomDiagnostics(page: Page): Promise<string> {
  try {
    const [composeStats, sendStats] = await Promise.all([
      collectSelectorStats(page, LI.messageComposeBox),
      collectSelectorStats(page, LI.messageSendBtn),
    ]);

    const domSummary = await page.evaluate(`(() => {
      const editorNodes = Array.from(document.querySelectorAll('[contenteditable="true"], textarea, [role="textbox"]'))
        .slice(0, 30)
        .map((el) => {
          const html = el;
          const r = html.getBoundingClientRect();
          const cs = window.getComputedStyle(html);
          const visible = cs.display !== 'none' && cs.visibility !== 'hidden' && Number(cs.opacity || '1') > 0 && r.width > 0 && r.height > 0;
          return {
            tag: html.tagName.toLowerCase(),
            role: html.getAttribute('role'),
            aria: html.getAttribute('aria-label'),
            placeholder: html.getAttribute('placeholder') || html.getAttribute('data-placeholder'),
            className: (html.className || '').slice(0, 140),
            contentEditable: html.getAttribute('contenteditable'),
            visible,
            inMsgShell: Boolean(
              html.closest('.msg-form, .msg-overlay-conversation-bubble, .msg-s-message-list-container, [data-view-name*="message"]')
            ),
          };
        });

      const sendCandidates = Array.from(document.querySelectorAll('button, [role="button"], input[type="submit"]'))
        .map((el) => {
          const html = el;
          const label = (html.getAttribute('aria-label') || html.textContent || html.value || '').trim().toLowerCase();
          const r = html.getBoundingClientRect();
          const cs = window.getComputedStyle(html);
          const visible = cs.display !== 'none' && cs.visibility !== 'hidden' && Number(cs.opacity || '1') > 0 && r.width > 0 && r.height > 0;
          return {
            label: label.slice(0, 90),
            className: (html.className || '').slice(0, 140),
            disabled: html.getAttribute('disabled') != null || html.getAttribute('aria-disabled') === 'true' || html.disabled === true,
            visible,
          };
        })
        .filter((entry) => entry.label.includes('send'))
        .slice(0, 20);

      return {
        title: document.title,
        hasMessagingOverlay: Boolean(document.querySelector('.msg-overlay-list-bubble')),
        hasMessageForm: Boolean(document.querySelector('.msg-form')),
        editorNodes,
        sendCandidates,
      };
    })()`);

    return JSON.stringify({
      url: page.url(),
      composeStats,
      sendStats,
      domSummary,
    });
  } catch (error) {
    return JSON.stringify({
      url: page.url(),
      diagnosticsError: error instanceof Error ? error.message : String(error),
    });
  }
}

async function resolveMessageButton(page: Page) {
  const direct = await findMessageAction(page, LI.messageBtn, { fromMenu: false, timeout: 2200 });
  if (direct) {
    return direct;
  }

  const moreActions = await findFirst(page, LI.moreActionsBtn, 1500);
  if (!moreActions) {
    return null;
  }

  await humanClick(page, moreActions);
  await actionDelay();

  const messageFromMenu = await findMessageAction(page, LI.messageInMoreMenu, { fromMenu: true, timeout: 2400 });
  if (messageFromMenu) {
    return messageFromMenu;
  }

  await page.keyboard.press('Escape').catch(() => undefined);
  return null;
}

async function waitForComposeBox(page: Page) {
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    const composeBox = await findFirst(page, LI.messageComposeBox, 3000);
    if (composeBox) {
      return composeBox;
    }
    await activateComposeBox(page);
    await actionDelay();
  }
  return null;
}

async function activateComposeBox(page: Page) {
  const activator = await findFirst(page, LI.messageComposeActivator, 1200);
  if (activator) {
    await humanClick(page, activator).catch(() => undefined);
    await actionDelay();
    return;
  }

  // Full-page messaging can open without selecting a thread immediately.
  if (page.url().includes('/messaging')) {
    const firstConversation = await findFirst(page, LI.messagingConversationItem, 1200);
    if (firstConversation) {
      await humanClick(page, firstConversation).catch(() => undefined);
      await actionDelay();
    }
  }
}

export async function sendMessage(page: Page, data: SendMessageData, lead: Lead): Promise<ActionResult> {
  const template = String(data.messageTemplate || '').trim();
  const messageText = template ? interpolate(template, lead).trim() : '';

  if (!messageText) {
    return { success: false, error: 'Message template is empty' };
  }

  await actionLogger.log('send_message', 'send_message', 'running', 'Opening message composer', lead.id);

  return withPopupGuard(page, async () => {
    const messageBtn = await resolveMessageButton(page);
    if (!messageBtn) {
      await actionLogger.log(
        'send_message',
        'send_message',
        'error',
        'Message button not found in profile actions or more-actions menu.',
        lead.id
      );
      return { success: false, error: 'Message button not found - may not be connected' };
    }

    await humanClick(page, messageBtn);
    await actionDelay();

    let composeBox = await waitForComposeBox(page);
    if (!composeBox) {
      // LinkedIn sometimes opens a shell first and needs a second click to focus the chat composer.
      await humanClick(page, messageBtn).catch(() => undefined);
      await actionDelay();
      await activateComposeBox(page);
      composeBox = await waitForComposeBox(page);
    }

    if (!composeBox) {
      const diagnostics = await captureMessagingDomDiagnostics(page);
      await actionLogger.log(
        'send_message',
        'send_message',
        'error',
        `Message compose box not found (url: ${page.url()}) diagnostics=${diagnostics}`,
        lead.id
      );
      return { success: false, error: 'Message compose box not found' };
    }

    await humanClick(page, composeBox).catch(() => undefined);
    await actionDelay();
    await humanType(page, composeBox, messageText);
    await actionDelay();

    const sendBtn = await findFirst(page, LI.messageSendBtn, 3500);
    if (!sendBtn) {
      const diagnostics = await captureMessagingDomDiagnostics(page);
      await actionLogger.log(
        'send_message',
        'send_message',
        'error',
        `Send button not found diagnostics=${diagnostics}`,
        lead.id
      );
      return { success: false, error: 'Send button not found' };
    }

    await humanClick(page, sendBtn);
    await actionDelay();

    await actionLogger.log('send_message', 'send_message', 'success', 'Message sent', lead.id);
    return {
      success: true,
      action: 'message_sent',
      data: { messageLength: messageText.length },
    };
  });
}
