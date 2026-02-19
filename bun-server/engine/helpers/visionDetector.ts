import type { Page } from 'playwright';
import type { LiveEventEmitter } from '../../lib/LiveEventLogger';

export type LinkedInAction =
  | 'connect'
  | 'follow'
  | 'unfollow'
  | 'message'
  | 'more'
  | 'pending'
  | 'send_without_note'
  | 'not_now'
  | 'add_note'
  | 'dismiss'
  | 'other';

export type ConnectionDegree = '1st' | '2nd' | '3rd' | 'unknown';

export type ConnectionStatus =
  | 'not_connected'
  | 'pending'
  | 'connected'
  | 'following'
  | 'no_connect_option';

export interface VisionButton {
  label: string;
  action: LinkedInAction;
  x: number;
  y: number;
  confidence: number;
  visible: boolean;
  inside_dropdown: boolean;
}

export interface VisionProfileState {
  connection_degree: ConnectionDegree;
  connection_status: ConnectionStatus;
  is_already_invited: boolean;
  is_connected: boolean;
  is_following: boolean;
  connect_button_location: 'direct' | 'in_more_dropdown' | 'not_found';
  recommended_action: 'connect' | 'follow' | 'message' | 'none';
  buttons: VisionButton[];
  modal_present: boolean;
  modal_buttons: VisionButton[];
  notes: string;
}

const VISION_SYSTEM_PROMPT = `You are analyzing a screenshot of a LinkedIn profile page.

Your job is to:
1. Identify the connection degree between the viewer and this profile (1st, 2nd, 3rd)
2. Detect all action buttons visible in the profile action bar
3. Return exact pixel coordinates (center X, Y) for every button you see
4. Detect if any modal dialog is currently open on screen
5. Determine the current connection status

Connection degree clues:
- "1st" badge near their name = 1st degree (already connected)
- "2nd" badge = 2nd degree connection
- "3rd" badge = 3rd degree connection
- No badge or "Connect" as primary action = likely 2nd or 3rd degree

Connection status clues:
- "Connect" button visible = not_connected
- "Pending" button visible = pending (request sent, not yet accepted)
- "Message" as primary button = connected (1st degree)
- Only "Follow" and no "Connect" = no_connect_option

Button location clues:
- Profile action bar is the row of buttons directly below the profile name/headline
- "More" or "···" button means some actions are hidden in a dropdown
- If you see a dropdown menu open, list its items as buttons with inside_dropdown: true

Modal detection:
- If a dialog/popup is visible over the page, set modal_present: true
- List all buttons inside the modal in modal_buttons array
- Common modals: "Send without a note" / "Add a note" / "Not now" / "Connect"

Return ONLY raw JSON. No markdown. No explanation. No code fences.`;

const VISION_USER_PROMPT = `Analyze this LinkedIn profile screenshot and return this exact JSON structure:

{
  "connection_degree": "1st|2nd|3rd|unknown",
  "connection_status": "not_connected|pending|connected|following|no_connect_option",
  "is_already_invited": false,
  "is_connected": false,
  "is_following": false,
  "connect_button_location": "direct|in_more_dropdown|not_found",
  "recommended_action": "connect|follow|message|none",
  "buttons": [
    {
      "label": "Connect",
      "action": "connect",
      "x": 1055,
      "y": 27,
      "confidence": 0.98,
      "visible": true,
      "inside_dropdown": false
    }
  ],
  "modal_present": false,
  "modal_buttons": [],
  "notes": "describe what you see"
}

Rules:
- x and y must be CENTER pixel coordinates of each button
- Only include buttons you can clearly see
- confidence: 0.0 to 1.0 — how certain you are about location
- If Connect is hidden in More dropdown, set connect_button_location to "in_more_dropdown"
- If a modal is open, list ALL buttons inside it in modal_buttons
- is_already_invited = true only if you see a "Pending" button`;

const DEFAULT_VIEWPORT = { width: 1340, height: 660 };

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function asNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function asBoolean(value: unknown, fallback = false): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function asConnectionDegree(value: unknown): ConnectionDegree {
  const normalized = asString(value).toLowerCase();
  if (normalized === '1st' || normalized === '2nd' || normalized === '3rd') return normalized;
  return 'unknown';
}

function asConnectionStatus(value: unknown): ConnectionStatus {
  const normalized = asString(value).toLowerCase();
  if (
    normalized === 'not_connected' ||
    normalized === 'pending' ||
    normalized === 'connected' ||
    normalized === 'following' ||
    normalized === 'no_connect_option'
  ) {
    return normalized;
  }
  return 'not_connected';
}

function asRecommendedAction(value: unknown): VisionProfileState['recommended_action'] {
  const normalized = asString(value).toLowerCase();
  if (normalized === 'connect' || normalized === 'follow' || normalized === 'message') {
    return normalized;
  }
  return 'none';
}

function asLinkedInAction(value: unknown, label: string): LinkedInAction {
  const normalized = asString(value).toLowerCase();
  if (
    normalized === 'connect' ||
    normalized === 'follow' ||
    normalized === 'unfollow' ||
    normalized === 'message' ||
    normalized === 'more' ||
    normalized === 'pending' ||
    normalized === 'send_without_note' ||
    normalized === 'not_now' ||
    normalized === 'add_note' ||
    normalized === 'dismiss' ||
    normalized === 'other'
  ) {
    return normalized;
  }

  const labelLower = label.toLowerCase();
  if (labelLower.includes('connect') || labelLower.includes('invite')) return 'connect';
  if (labelLower.includes('follow') && !labelLower.includes('unfollow')) return 'follow';
  if (labelLower.includes('unfollow')) return 'unfollow';
  if (labelLower.includes('message')) return 'message';
  if (labelLower.includes('more')) return 'more';
  if (labelLower.includes('pending')) return 'pending';
  if (labelLower.includes('send without')) return 'send_without_note';
  if (labelLower.includes('not now')) return 'not_now';
  if (labelLower.includes('add a note')) return 'add_note';
  if (labelLower.includes('dismiss') || labelLower.includes('close')) return 'dismiss';
  return 'other';
}

function sanitizeButton(raw: unknown): VisionButton | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  const label = asString(row.label).trim();
  if (!label) return null;

  const confidence = Math.min(1, Math.max(0, asNumber(row.confidence, 0.75)));
  return {
    label,
    action: asLinkedInAction(row.action, label),
    x: Math.round(asNumber(row.x)),
    y: Math.round(asNumber(row.y)),
    confidence,
    visible: asBoolean(row.visible, true),
    inside_dropdown: asBoolean(row.inside_dropdown, false),
  };
}

function sanitizeButtons(raw: unknown, forceInsideDropdown = false): VisionButton[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map(sanitizeButton)
    .filter((entry): entry is VisionButton => Boolean(entry))
    .map((entry) =>
      forceInsideDropdown
        ? {
            ...entry,
            inside_dropdown: true,
          }
        : entry
    );
}

function normalizeConnectLocation(value: unknown): VisionProfileState['connect_button_location'] {
  const normalized = asString(value).toLowerCase();
  if (normalized === 'direct' || normalized === 'in_more_dropdown') return normalized;
  return 'not_found';
}

function extractJsonObject(raw: string): Record<string, unknown> | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const stripped = trimmed.replace(/```json|```/gi, '').trim();
  try {
    const parsed = JSON.parse(stripped) as unknown;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // try best-effort object extraction below
  }

  const start = stripped.indexOf('{');
  const end = stripped.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    const parsed = JSON.parse(stripped.slice(start, end + 1)) as unknown;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    return null;
  }
  return null;
}

function sanitizeVisionState(raw: Record<string, unknown>): VisionProfileState {
  const buttons = sanitizeButtons(raw.buttons);
  const modalButtons = sanitizeButtons(raw.modal_buttons, true);

  return {
    connection_degree: asConnectionDegree(raw.connection_degree),
    connection_status: asConnectionStatus(raw.connection_status),
    is_already_invited: asBoolean(raw.is_already_invited),
    is_connected: asBoolean(raw.is_connected),
    is_following: asBoolean(raw.is_following),
    connect_button_location: normalizeConnectLocation(raw.connect_button_location),
    recommended_action: asRecommendedAction(raw.recommended_action),
    buttons,
    modal_present: asBoolean(raw.modal_present, modalButtons.length > 0),
    modal_buttons: modalButtons,
    notes: asString(raw.notes),
  };
}

function safeClip(page: Page, captureRegion?: { x: number; y: number; width: number; height: number }) {
  const viewport = page.viewportSize() ?? DEFAULT_VIEWPORT;
  const candidate = captureRegion ?? {
    x: 0,
    y: 0,
    width: viewport.width,
    height: Math.min(viewport.height, DEFAULT_VIEWPORT.height),
  };

  const x = Math.max(0, Math.floor(candidate.x));
  const y = Math.max(0, Math.floor(candidate.y));
  const width = Math.max(20, Math.floor(Math.min(candidate.width, viewport.width - x)));
  const height = Math.max(20, Math.floor(Math.min(candidate.height, viewport.height - y)));

  return { x, y, width, height };
}

export async function analyzeProfileWithVision(
  page: Page,
  supabase: any,
  leadId: string,
  logger: LiveEventEmitter,
  captureRegion?: { x: number; y: number; width: number; height: number }
): Promise<VisionProfileState | null> {
  await logger.emit('ai_call_start', 'Capturing screenshot for vision analysis');

  const clip = safeClip(page, captureRegion);
  const screenshotBuffer = await page.screenshot({ type: 'png', clip });
  const base64Image = screenshotBuffer.toString('base64');
  const sizeKB = Math.round(base64Image.length / 1024);

  await logger.emit('ai_call_start', `Screenshot ready — ${sizeKB}KB, sending to GPT-4o Vision`);

  const { data: settings, error: settingsError } = await supabase
    .from('app_settings')
    .select('openrouter_api_key, vision_ai_model')
    .single();

  if (settingsError) {
    await logger.emit('ai_call_failed', `Failed to load AI settings: ${settingsError.message}`);
    return null;
  }

  const apiKey = asString(settings?.openrouter_api_key).trim().replace(/^Bearer\s+/i, '');
  const visionModel = asString(settings?.vision_ai_model).trim() || 'openai/gpt-4o-mini';

  if (!apiKey) {
    await logger.emit('ai_call_failed', 'No OpenRouter API key in settings');
    return null;
  }

  await logger.emit('ai_call_start', `Calling vision model: ${visionModel}`);

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'http://localhost:3000',
        'X-Title': 'LinkedIn Automator',
      },
      body: JSON.stringify({
        model: visionModel,
        messages: [
          {
            role: 'system',
            content: VISION_SYSTEM_PROMPT,
          },
          {
            role: 'user',
            content: [
              {
                type: 'image_url',
                image_url: {
                  url: `data:image/png;base64,${base64Image}`,
                  detail: 'high',
                },
              },
              {
                type: 'text',
                text: VISION_USER_PROMPT,
              },
            ],
          },
        ],
        max_tokens: 600,
        temperature: 0,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'unknown error');
      await logger.emit('ai_call_failed', `Vision API ${response.status}: ${errorText.substring(0, 200)}`);
      return null;
    }

    const payload = (await response.json().catch(() => ({}))) as {
      usage?: { prompt_tokens?: number; completion_tokens?: number };
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = asString(payload.choices?.[0]?.message?.content);
    const usage = payload.usage ?? {};
    const inputTokens = asNumber(usage.prompt_tokens);
    const outputTokens = asNumber(usage.completion_tokens);
    const cost = calculateVisionCost(visionModel, inputTokens, outputTokens);

    await supabase.from('ai_usage_logs').insert({
      model: visionModel,
      input_tokens: Math.round(inputTokens),
      output_tokens: Math.round(outputTokens),
      cost_usd: Number(cost.toFixed(6)),
      action_type: 'vision_profile_analysis',
      lead_id: leadId,
      created_at: new Date().toISOString(),
    });

    await logger.emit('ai_cost', `Vision cost: $${cost.toFixed(6)}`, {
      model: visionModel,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      cost_usd: Number(cost.toFixed(6)),
    });

    const parsed = extractJsonObject(content);
    if (!parsed) {
      await logger.emit('ai_call_failed', 'Vision response was not valid JSON');
      return null;
    }

    const state = sanitizeVisionState(parsed);

    await logger.emit('ai_call_success', 'Vision analysis complete', {
      degree: state.connection_degree,
      status: state.connection_status,
      connect_location: state.connect_button_location,
      recommended: state.recommended_action,
      buttons_found: state.buttons.length,
      modal_present: state.modal_present,
    });

    return state;
  } catch (error) {
    await logger.emit('ai_call_failed', `Vision threw: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

export function calculateVisionCost(model: string, input = 0, output = 0): number {
  const pricing: Record<string, { input: number; output: number }> = {
    'gpt-4o-mini': { input: 0.00015, output: 0.0006 },
    'gpt-4o': { input: 0.005, output: 0.015 },
    'gemini-flash': { input: 0.000075, output: 0.0003 },
    'claude-3-haiku': { input: 0.00025, output: 0.00125 },
  };

  const key = Object.keys(pricing).find((entry) => model.includes(entry)) || 'gpt-4o-mini';
  const selected = pricing[key];
  return (input / 1000) * selected.input + (output / 1000) * selected.output;
}
