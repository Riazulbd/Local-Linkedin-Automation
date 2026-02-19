import type { Page } from 'playwright';
import type { ActionResult, Lead } from '../../../types';
import type { LiveEventEmitter } from '../../lib/LiveEventLogger';
import { analyzeProfileWithVision, type VisionButton, type VisionProfileState } from './visionDetector';

function normalizeProfileUrl(url: string): string {
  return url.replace(/[?#].*$/, '').replace(/\/+$/, '');
}

function isProfileUrl(url: string): boolean {
  return url.includes('linkedin.com/in/');
}

async function getNextVisitCount(supabase: any, leadId: string): Promise<number> {
  try {
    const { data } = await supabase.from('leads').select('visit_count').eq('id', leadId).maybeSingle();
    const current = Number((data as { visit_count?: unknown } | null)?.visit_count);
    if (Number.isFinite(current) && current >= 0) {
      return current + 1;
    }
  } catch {
    // fallback below
  }
  return 1;
}

async function updateLeadStatus(supabase: any, leadId: string, fields: Record<string, unknown>) {
  await supabase
    .from('leads')
    .update({
      ...fields,
      updated_at: new Date().toISOString(),
    })
    .eq('id', leadId);
}

function pickButton(
  state: VisionProfileState,
  matcher: (button: VisionButton) => boolean,
  minConfidence = 0.6
): VisionButton | null {
  return (
    state.buttons.find((button) => button.visible && button.confidence >= minConfidence && matcher(button)) || null
  );
}

function pickModalButton(
  state: VisionProfileState,
  matcher: (button: VisionButton) => boolean,
  minConfidence = 0.55
): VisionButton | null {
  return (
    state.modal_buttons.find((button) => button.visible && button.confidence >= minConfidence && matcher(button)) ||
    null
  );
}

export async function injectCursor(page: Page): Promise<void> {
  try {
    await page.addStyleTag({
      content: `
        #pw-cursor {
          position: fixed !important;
          width: 18px !important;
          height: 18px !important;
          background: rgba(255, 0, 0, 0.85) !important;
          border: 2px solid white !important;
          border-radius: 50% !important;
          pointer-events: none !important;
          z-index: 2147483647 !important;
          transform: translate(-50%, -50%) !important;
          transition: left 0.03s linear, top 0.03s linear !important;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.5) !important;
        }
        #pw-cursor.clicking {
          background: rgba(255, 220, 0, 0.95) !important;
          transform: translate(-50%, -50%) scale(0.75) !important;
        }
      `,
    });

    await page.evaluate(() => {
      document.getElementById('pw-cursor')?.remove();
      const dot = document.createElement('div');
      dot.id = 'pw-cursor';
      document.body.appendChild(dot);

      document.addEventListener(
        'mousemove',
        (event) => {
          dot.style.left = `${event.clientX}px`;
          dot.style.top = `${event.clientY}px`;
        },
        { passive: true }
      );
      document.addEventListener('mousedown', () => dot.classList.add('clicking'));
      document.addEventListener('mouseup', () => dot.classList.remove('clicking'));
    });
  } catch {
    // non-blocking visual helper
  }
}

export async function visionClick(page: Page, button: VisionButton, logger: LiveEventEmitter) {
  await logger.emit('mouse_move', `Moving to "${button.label}" at (${button.x}, ${button.y})`);
  await page.mouse.move(button.x, button.y, { steps: 15 });
  await page.waitForTimeout(200);
  await logger.emit('click', `Clicking "${button.label}"`, {
    x: button.x,
    y: button.y,
    action: button.action,
    confidence: button.confidence,
  });
  await page.mouse.click(button.x, button.y);
}

async function handlePostConnectModals(
  page: Page,
  supabase: any,
  leadId: string,
  logger: LiveEventEmitter
) {
  await page.waitForTimeout(1500);
  await logger.emit('ai_call_start', 'Checking for post-connect modals with vision');
  const state = await analyzeProfileWithVision(page, supabase, leadId, logger);

  if (!state?.modal_present || state.modal_buttons.length === 0) {
    await logger.emit('modal_dismissed', 'No modal detected after connect');
    await logger.emit('action_complete', '✓ Connection request sent successfully');
    return;
  }

  await logger.emit('modal_detected', `Modal detected with ${state.modal_buttons.length} buttons`, {
    modal_buttons: state.modal_buttons.map((button) => button.label),
  });

  const sendWithoutNote = pickModalButton(
    state,
    (button) => button.action === 'send_without_note' || button.label.toLowerCase().includes('send without')
  );
  if (sendWithoutNote) {
    await visionClick(page, sendWithoutNote, logger);
    await logger.emit('modal_dismissed', 'Clicked "Send without a note"');
    await page.waitForTimeout(1200);
  }

  await page.waitForTimeout(1000);
  const nextState = await analyzeProfileWithVision(page, supabase, leadId, logger);
  if (nextState?.modal_present) {
    const notNow = pickModalButton(
      nextState,
      (button) => button.action === 'not_now' || button.label.toLowerCase().includes('not now')
    );
    if (notNow) {
      await visionClick(page, notNow, logger);
      await logger.emit('modal_dismissed', 'Clicked "Not now"');
    }
  }

  await logger.emit('action_complete', '✓ Connection request sent successfully');
}

export async function visionSendConnection(
  page: Page,
  lead: Lead,
  supabase: any,
  logger: LiveEventEmitter
): Promise<ActionResult> {
  const state = await analyzeProfileWithVision(page, supabase, lead.id, logger);
  if (!state) {
    throw new Error('Vision analysis failed');
  }

  const detectedDegree = state.connection_degree;
  const nowIso = new Date().toISOString();
  const nextVisitCount = await getNextVisitCount(supabase, lead.id);

  if (state.is_already_invited || state.connection_status === 'pending') {
    await logger.emit('state_pending', 'Already invited — connection request is pending');
    await updateLeadStatus(supabase, lead.id, {
      last_visited_at: nowIso,
      visit_count: nextVisitCount,
      connection_degree_detected: detectedDegree,
      profile_open_to_connect: false,
      last_action_taken: 'none',
    });

    return {
      success: true,
      action: 'skipped',
      data: { reason: 'already_invited', connection_degree_detected: detectedDegree },
    };
  }

  if (state.is_connected || state.connection_degree === '1st' || state.connection_status === 'connected') {
    await logger.emit('state_connected', 'Already 1st degree connection');
    await updateLeadStatus(supabase, lead.id, {
      connection_accepted: true,
      connection_accepted_at: nowIso,
      connection_degree_detected: '1st',
      last_visited_at: nowIso,
      visit_count: nextVisitCount,
      profile_open_to_connect: false,
      last_action_taken: 'none',
    });
    return {
      success: true,
      action: 'skipped',
      data: { reason: 'already_connected', connection_degree_detected: '1st' },
    };
  }

  if (state.connect_button_location === 'not_found' && state.connection_status === 'no_connect_option') {
    await logger.emit('action_failed', `No Connect option available — ${state.notes}`);
    await updateLeadStatus(supabase, lead.id, {
      last_visited_at: nowIso,
      visit_count: nextVisitCount,
      connection_degree_detected: detectedDegree,
      profile_open_to_connect: false,
      last_action_taken: 'none',
    });
    return {
      success: false,
      action: 'none',
      error: 'no_connect_option',
      data: { connection_degree_detected: detectedDegree },
    };
  }

  let connectButton: VisionButton | null = null;

  if (state.connect_button_location === 'direct') {
    connectButton = pickButton(
      state,
      (button) =>
        button.action === 'connect' &&
        !button.inside_dropdown &&
        (button.label.toLowerCase().includes('connect') || button.label.toLowerCase().includes('invite')),
      0.7
    );

    if (connectButton) {
      await logger.emit(
        'button_found',
        `Connect button visible directly at (${connectButton.x}, ${connectButton.y})`,
        { confidence: connectButton.confidence }
      );
    }
  }

  if (!connectButton) {
    await logger.emit('button_not_found', 'Connect inside More dropdown — opening it');
    const moreButton = pickButton(
      state,
      (button) =>
        button.action === 'more' ||
        button.label.toLowerCase() === 'more' ||
        button.label.toLowerCase().includes('more actions'),
      0.5
    );

    if (!moreButton) {
      throw new Error('More button not found by vision');
    }

    await visionClick(page, moreButton, logger);
    await page.waitForTimeout(1500);

    await logger.emit('ai_call_start', 'Dropdown opened — re-analyzing with vision');
    const dropdownState = await analyzeProfileWithVision(page, supabase, lead.id, logger);
    if (!dropdownState) {
      throw new Error('Vision failed on dropdown screenshot');
    }

    connectButton = pickButton(
      dropdownState,
      (button) =>
        button.action === 'connect' &&
        (button.inside_dropdown ||
          button.label.toLowerCase().includes('connect') ||
          button.label.toLowerCase().includes('invite')),
      0.55
    );

    if (!connectButton) {
      throw new Error('Connect not found inside More dropdown by vision');
    }

    await logger.emit(
      'button_found',
      `Connect found in dropdown at (${connectButton.x}, ${connectButton.y})`,
      { confidence: connectButton.confidence }
    );
  }

  await visionClick(page, connectButton, logger);
  await page.waitForTimeout(2000);
  await handlePostConnectModals(page, supabase, lead.id, logger);

  const afterConnectVisitCount = await getNextVisitCount(supabase, lead.id);
  await updateLeadStatus(supabase, lead.id, {
    last_visited_at: new Date().toISOString(),
    visit_count: afterConnectVisitCount,
    connection_degree_detected: detectedDegree,
    last_action_taken: 'connect',
    connection_request_sent_at: new Date().toISOString(),
    profile_open_to_connect: true,
  });

  return {
    success: true,
    action: 'connect',
    data: {
      connection_degree_detected: detectedDegree,
      profile_open_to_connect: true,
    },
  };
}

export async function visionFollowProfile(
  page: Page,
  lead: Lead,
  supabase: any,
  logger: LiveEventEmitter
): Promise<ActionResult> {
  const state = await analyzeProfileWithVision(page, supabase, lead.id, logger);
  if (!state) {
    throw new Error('Vision analysis failed');
  }

  if (state.is_following) {
    await logger.emit('state_connected', 'Already following this profile');
    return {
      success: true,
      action: 'skipped',
      data: { reason: 'already_following' },
    };
  }

  let followButton = pickButton(
    state,
    (button) => button.action === 'follow' || button.label.toLowerCase() === 'follow',
    0.65
  );

  if (!followButton) {
    const moreButton = pickButton(
      state,
      (button) =>
        button.action === 'more' ||
        button.label.toLowerCase() === 'more' ||
        button.label.toLowerCase().includes('more actions'),
      0.5
    );

    if (moreButton) {
      await logger.emit('button_not_found', 'Follow not visible — checking More dropdown');
      await visionClick(page, moreButton, logger);
      await page.waitForTimeout(1500);

      const dropdownState = await analyzeProfileWithVision(page, supabase, lead.id, logger);
      followButton =
        dropdownState &&
        pickButton(
          dropdownState,
          (button) => button.action === 'follow' || button.label.toLowerCase() === 'follow',
          0.55
        );
    }
  }

  if (!followButton) {
    await logger.emit('action_failed', 'Follow button not found anywhere by vision');
    return {
      success: false,
      action: 'none',
      error: 'follow_button_not_found',
    };
  }

  await logger.emit('button_found', `Follow button at (${followButton.x}, ${followButton.y})`, {
    confidence: followButton.confidence,
  });
  await visionClick(page, followButton, logger);
  await page.waitForTimeout(1000);

  const nextVisitCount = await getNextVisitCount(supabase, lead.id);
  await updateLeadStatus(supabase, lead.id, {
    last_action_taken: 'follow',
    last_visited_at: new Date().toISOString(),
    visit_count: nextVisitCount,
    connection_degree_detected: state.connection_degree,
    profile_open_to_connect: state.connection_status === 'not_connected',
  });

  await logger.emit('action_complete', `✓ Followed ${lead.first_name || ''} ${lead.last_name || ''}`.trim());
  return {
    success: true,
    action: 'follow',
    data: { connection_degree_detected: state.connection_degree },
  };
}

export async function visionCheckConnectionAccepted(
  page: Page,
  lead: Lead,
  supabase: any,
  logger: LiveEventEmitter
): Promise<ActionResult & { isConnected: boolean }> {
  const profileUrl = normalizeProfileUrl(lead.linkedin_url || '');
  if (!profileUrl || !isProfileUrl(profileUrl)) {
    throw new Error(`Invalid profile URL for connection check: ${lead.linkedin_url}`);
  }

  await logger.emit('navigation', 'Revisiting profile to check connection status');
  await page.goto(profileUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForSelector('h1', { timeout: 12000 });
  await page.waitForTimeout(3000);

  const state = await analyzeProfileWithVision(page, supabase, lead.id, logger);
  if (!state) {
    await logger.emit('ai_call_failed', 'Vision failed during connection check');
    return {
      success: false,
      isConnected: false,
      action: 'not_connected',
      error: 'vision_check_failed',
      data: { degree: 'unknown', status: 'check_failed' },
    };
  }

  await logger.emit('ai_call_success', 'Connection check result', {
    degree: state.connection_degree,
    status: state.connection_status,
    is_connected: state.is_connected,
  });

  const isAccepted =
    state.connection_degree === '1st' || state.is_connected || state.connection_status === 'connected';

  const nextVisitCount = await getNextVisitCount(supabase, lead.id);
  if (isAccepted) {
    await logger.emit('state_connected', `✓ Connection ACCEPTED — now ${state.connection_degree} degree`);
    await updateLeadStatus(supabase, lead.id, {
      connection_accepted: true,
      connection_accepted_at: new Date().toISOString(),
      connection_degree_detected: state.connection_degree,
      last_visited_at: new Date().toISOString(),
      visit_count: nextVisitCount,
    });
    await logger.emit('db_update', 'Connection acceptance recorded in database', {
      connection_accepted: true,
      degree: state.connection_degree,
    });
  } else if (state.connection_status === 'pending') {
    await logger.emit('state_pending', 'Connection still pending — not yet accepted');
    await updateLeadStatus(supabase, lead.id, {
      connection_degree_detected: state.connection_degree,
      last_visited_at: new Date().toISOString(),
      visit_count: nextVisitCount,
    });
  } else {
    await logger.emit('button_not_found', `Unexpected state: ${state.connection_status} — ${state.notes}`);
    await updateLeadStatus(supabase, lead.id, {
      connection_degree_detected: state.connection_degree,
      last_visited_at: new Date().toISOString(),
      visit_count: nextVisitCount,
    });
  }

  return {
    success: true,
    isConnected: isAccepted,
    action: isAccepted ? 'connected' : 'not_connected',
    data: {
      accepted: isAccepted,
      degree: state.connection_degree,
      status: state.connection_status,
    },
  };
}
