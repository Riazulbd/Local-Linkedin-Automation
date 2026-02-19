import { createHash } from 'node:crypto';
import type { Page } from 'playwright';
import { getSupabaseClient } from '../../supabase';

export type AiConnectionDegree = '1st' | '2nd' | '3rd' | 'pending' | 'not_connected' | 'unknown';

export interface AiButtonDecision {
  connection_degree: AiConnectionDegree;
  available_actions: string[];
  recommended_action: 'connect' | 'follow' | 'message' | 'none';
  button_text: string;
  is_already_invited: boolean;
  notes: string;
  model: string;
  structure_hash: string;
  from_cache: boolean;
}

interface AppAiSettings {
  openrouter_api_key: string;
  primary_ai_model: string;
  fallback_ai_model: string;
}

interface OpenRouterUsage {
  prompt_tokens?: number;
  completion_tokens?: number;
  input_tokens?: number;
  output_tokens?: number;
  total_tokens?: number;
  cost?: number | string;
  total_cost?: number | string;
}

interface OpenRouterModelRecord {
  id?: unknown;
  pricing?: {
    prompt?: unknown;
    completion?: unknown;
  } | null;
}

interface ModelPricing {
  prompt: number | null;
  completion: number | null;
}

interface CacheEntry {
  createdAt: number;
  result: AiButtonDecision;
}

const STRUCTURE_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const SETTINGS_CACHE_TTL_MS = 30_000;
const MODEL_PRICING_CACHE_TTL_MS = 15 * 60 * 1000;
const BUTTON_DETECTION_ACTION = 'button_detection';

const structureCache = new Map<string, CacheEntry>();
let cachedSettings: AppAiSettings | null = null;
let lastSettingsFetchAt = 0;
let modelPricingFetchedAt = 0;
let modelPricingCache = new Map<string, ModelPricing>();

const SYSTEM_PROMPT =
  'You are a LinkedIn automation assistant. Analyze this LinkedIn profile action button HTML and return ONLY valid JSON with no markdown, no explanation, just raw JSON.';

function toNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parsePricingValue(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
    return value;
  }
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed >= 0) {
      return parsed;
    }
  }
  return null;
}

function sanitizeConnectionDegree(input: unknown): AiConnectionDegree {
  const value = typeof input === 'string' ? input.trim().toLowerCase() : '';
  if (value === '1st') return '1st';
  if (value === '2nd') return '2nd';
  if (value === '3rd') return '3rd';
  if (value === 'pending') return 'pending';
  if (value === 'not_connected') return 'not_connected';
  return 'unknown';
}

function sanitizeAction(input: unknown): 'connect' | 'follow' | 'message' | 'none' {
  const value = typeof input === 'string' ? input.trim().toLowerCase() : '';
  if (value === 'connect' || value === 'follow' || value === 'message') {
    return value;
  }
  return 'none';
}

function sanitizeAvailableActions(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const valid = new Set(['connect', 'follow', 'message']);
  return input
    .map((entry) => (typeof entry === 'string' ? entry.trim().toLowerCase() : ''))
    .filter((entry) => valid.has(entry));
}

function parseJsonObject(raw: unknown): Record<string, unknown> | null {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }

  if (typeof raw !== 'string') {
    return null;
  }

  const trimmed = raw.trim();
  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // fallback extraction below
  }

  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start < 0 || end <= start) return null;

  try {
    const parsed = JSON.parse(trimmed.slice(start, end + 1)) as unknown;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    return null;
  }

  return null;
}

function extractMessageContent(raw: unknown): unknown {
  if (typeof raw === 'string') {
    return raw;
  }

  if (Array.isArray(raw)) {
    const text = raw
      .map((part) => {
        if (typeof part === 'string') return part;
        if (part && typeof part === 'object') {
          const maybeText = (part as Record<string, unknown>).text;
          if (typeof maybeText === 'string') return maybeText;
        }
        return '';
      })
      .join('\n')
      .trim();
    return text;
  }

  return raw;
}

function normalizeDecision(
  data: Record<string, unknown>,
  model: string,
  structureHash: string,
  fromCache: boolean
): AiButtonDecision | null {
  const buttonText = typeof data.button_text === 'string' ? data.button_text.trim() : '';
  const recommendedAction = sanitizeAction(data.recommended_action);

  const normalized: AiButtonDecision = {
    connection_degree: sanitizeConnectionDegree(data.connection_degree),
    available_actions: sanitizeAvailableActions(data.available_actions),
    recommended_action: recommendedAction,
    button_text: buttonText,
    is_already_invited: Boolean(data.is_already_invited),
    notes: typeof data.notes === 'string' ? data.notes.trim() : '',
    model,
    structure_hash: structureHash,
    from_cache: fromCache,
  };

  if (normalized.recommended_action !== 'none' && !normalized.button_text) {
    return null;
  }

  return normalized;
}

function normalizeActionAreaForHash(html: string): string {
  return html.replace(/>[^<]+</g, '><').trim();
}

function buildStructureHash(html: string): string {
  return createHash('md5').update(normalizeActionAreaForHash(html)).digest('hex');
}

function readApiError(payload: unknown, status: number): string {
  if (payload && typeof payload === 'object') {
    const obj = payload as Record<string, unknown>;
    const nested = obj.error as Record<string, unknown> | undefined;
    const message =
      (nested && typeof nested.message === 'string' && nested.message) ||
      (typeof obj.message === 'string' && obj.message) ||
      (typeof obj.error === 'string' && obj.error) ||
      '';
    if (message) return message;
  }
  return `OpenRouter request failed (${status})`;
}

async function getAiSettings(force = false): Promise<AppAiSettings | null> {
  const now = Date.now();
  if (!force && cachedSettings && now - lastSettingsFetchAt < SETTINGS_CACHE_TTL_MS) {
    return cachedSettings;
  }

  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('app_settings')
    .select('openrouter_api_key, primary_ai_model, fallback_ai_model')
    .single();

  if (error) {
    console.error('[AI] Failed to fetch settings:', error);
    return cachedSettings;
  }

  const row = (data ?? {}) as Record<string, unknown>;
  const rawKey = typeof row.openrouter_api_key === 'string' ? row.openrouter_api_key.trim() : '';
  const normalizedKey = rawKey.replace(/^Bearer\s+/i, '');

  cachedSettings = {
    openrouter_api_key: normalizedKey,
    primary_ai_model: typeof row.primary_ai_model === 'string' ? row.primary_ai_model.trim() : '',
    fallback_ai_model: typeof row.fallback_ai_model === 'string' ? row.fallback_ai_model.trim() : '',
  };
  lastSettingsFetchAt = now;

  console.log('[AI] Settings loaded:', {
    hasKey: !!cachedSettings.openrouter_api_key,
    primaryModel: cachedSettings.primary_ai_model,
    fallbackModel: cachedSettings.fallback_ai_model,
  });

  return cachedSettings;
}

async function logAiUsage(params: {
  model: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  leadId?: string;
}) {
  try {
    const supabase = getSupabaseClient();
    await supabase.from('ai_usage_logs').insert({
      model: params.model,
      input_tokens: Math.max(0, Math.round(params.inputTokens)),
      output_tokens: Math.max(0, Math.round(params.outputTokens)),
      cost_usd: Math.max(0, Number(params.costUsd.toFixed(6))),
      action_type: BUTTON_DETECTION_ACTION,
      lead_id: params.leadId || null,
      created_at: new Date().toISOString(),
    });
  } catch (error) {
    console.warn(
      '[AiButtonDetection] Failed to persist ai_usage_logs:',
      error instanceof Error ? error.message : String(error)
    );
  }
}

async function loadModelPricing(apiKey: string): Promise<Map<string, ModelPricing>> {
  const now = Date.now();
  if (modelPricingCache.size > 0 && now - modelPricingFetchedAt < MODEL_PRICING_CACHE_TTL_MS) {
    return modelPricingCache;
  }

  const response = await fetch('https://openrouter.ai/api/v1/models', {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
      'X-Title': 'LinkedIn Automator Localhost',
    },
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(readApiError(payload, response.status));
  }

  const records = Array.isArray((payload as { data?: unknown[] }).data)
    ? ((payload as { data: OpenRouterModelRecord[] }).data ?? [])
    : [];

  const next = new Map<string, ModelPricing>();
  for (const record of records) {
    const modelId = typeof record?.id === 'string' ? record.id.trim() : '';
    if (!modelId) continue;

    const pricing = record.pricing ?? {};
    next.set(modelId, {
      prompt: parsePricingValue(pricing.prompt),
      completion: parsePricingValue(pricing.completion),
    });
  }

  modelPricingCache = next;
  modelPricingFetchedAt = now;
  return modelPricingCache;
}

async function getModelPricing(model: string, apiKey: string): Promise<ModelPricing | null> {
  try {
    const cache = await loadModelPricing(apiKey);
    return cache.get(model) ?? null;
  } catch (error) {
    console.warn(
      `[AiButtonDetection] Failed to fetch model pricing for ${model}:`,
      error instanceof Error ? error.message : String(error)
    );
    return null;
  }
}

async function estimateCost(
  model: string,
  inputTokens: number,
  outputTokens: number,
  apiKey: string,
  usage: OpenRouterUsage
): Promise<number> {
  const pricing = await getModelPricing(model, apiKey);
  if (pricing?.prompt != null && pricing.completion != null) {
    return Math.max(0, inputTokens * pricing.prompt + outputTokens * pricing.completion);
  }

  return toNumber(usage.cost ?? usage.total_cost);
}

async function callOpenRouter(params: {
  html: string;
  model: string;
  fallbackModel?: string;
  apiKey: string;
  structureHash: string;
  leadId?: string;
}): Promise<AiButtonDecision | null> {
  console.log('[AI] API key present:', !!params.apiKey, '| length:', params.apiKey?.length ?? 0);
  console.log('[AI] Using model:', params.model);

  const prompt = `Analyze this LinkedIn profile action button HTML. Return ONLY raw JSON, no markdown, no explanation.

{
  "connection_degree": "1st|2nd|3rd|unknown",
  "available_actions": ["connect","follow","message"],
  "recommended_action": "connect|follow|message|none",
  "button_text": "exact visible button text to click",
  "is_already_invited": false,
  "notes": ""
}

HTML:
${params.html}`;

  const modelCandidates = [params.model, params.fallbackModel].filter(
    (model): model is string => Boolean(model && model.trim())
  );

  for (const currentModel of modelCandidates) {
    let inputTokens = 0;
    let outputTokens = 0;
    let costUsd = 0;

    try {
      console.log('[AI] Calling OpenRouter with model:', currentModel);

      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${params.apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
          'X-Title': 'LinkedIn Automator',
        },
        body: JSON.stringify({
          model: currentModel,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: prompt },
          ],
          max_tokens: 300,
          temperature: 0,
          response_format: { type: 'json_object' },
        }),
      });

      console.log('[AI] Response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        console.error('[AI] API error:', response.status, errorText);
        continue;
      }

      const data = (await response.json().catch(() => ({}))) as {
        usage?: OpenRouterUsage;
        choices?: Array<{ message?: { content?: unknown } }>;
      };

      const usage = data.usage ?? {};
      inputTokens = toNumber(usage.prompt_tokens ?? usage.input_tokens);
      outputTokens = toNumber(usage.completion_tokens ?? usage.output_tokens);
      costUsd = await estimateCost(currentModel, inputTokens, outputTokens, params.apiKey, usage);

      const rawContent = data.choices?.[0]?.message?.content;
      const content = String(extractMessageContent(rawContent) ?? '');
      console.log('[AI] Raw response:', content);

      const cleaned = content.replace(/```json|```/g, '').trim();
      const parsed = parseJsonObject(cleaned);
      if (!parsed) {
        throw new Error('Model returned invalid JSON payload');
      }

      const normalized = normalizeDecision(parsed, currentModel, params.structureHash, false);
      if (!normalized) {
        throw new Error('Model returned incomplete decision payload');
      }

      return normalized;
    } catch (err) {
      console.error(`[AI] Model ${currentModel} threw error:`, err);
      continue;
    } finally {
      await logAiUsage({
        model: currentModel,
        inputTokens,
        outputTokens,
        costUsd,
        leadId: params.leadId,
      });
    }
  }

  console.warn('[AI] All models failed, returning null');
  return null;
}

function pruneCache() {
  const now = Date.now();
  for (const [key, value] of structureCache.entries()) {
    if (now - value.createdAt > STRUCTURE_CACHE_TTL_MS) {
      structureCache.delete(key);
    }
  }
}

export async function extractActionAreaHtml(page: Page): Promise<string | null> {
  return page
    .evaluate(() => {
      const selectors = [
        '.pvs-profile-actions',
        '.ph5.pb5',
        '[data-view-name="profile-action-bar"]',
      ];

      for (const selector of selectors) {
        const element = document.querySelector(selector) as HTMLElement | null;
        if (!element) continue;

        const actionCount = element.querySelectorAll('button, [role="button"]').length;
        if (actionCount > 0) {
          return element.outerHTML;
        }
      }

      const main = document.querySelector('main') as HTMLElement | null;
      if (!main) return null;

      const allButtons = Array.from(main.querySelectorAll('button, [role="button"]')) as HTMLElement[];
      if (!allButtons.length) return null;

      const html = allButtons.map((entry) => entry.outerHTML).join('\n');
      return `<div data-source="main-buttons">${html}</div>`;
    })
    .catch(() => null);
}

export async function detectProfileActionsWithAi(
  page: Page,
  options: {
    leadId?: string;
    profileUrl?: string;
  } = {}
): Promise<AiButtonDecision | null> {
  pruneCache();

  const html = await extractActionAreaHtml(page);
  if (!html || !html.trim()) {
    return null;
  }

  const structureHash = buildStructureHash(html);
  const cached = structureCache.get(structureHash);
  if (cached && Date.now() - cached.createdAt <= STRUCTURE_CACHE_TTL_MS) {
    return {
      ...cached.result,
      from_cache: true,
      structure_hash: structureHash,
    };
  }

  const settings = await getAiSettings();
  if (!settings?.openrouter_api_key) {
    return null;
  }

  const primaryModel = settings.primary_ai_model || settings.fallback_ai_model;
  const fallbackModel = settings.fallback_ai_model;

  if (!primaryModel) {
    return null;
  }

  const decision = await callOpenRouter({
    html,
    model: primaryModel,
    fallbackModel,
    apiKey: settings.openrouter_api_key,
    structureHash,
    leadId: options.leadId,
  });

  if (decision) {
    structureCache.set(structureHash, { createdAt: Date.now(), result: decision });
    return decision;
  }

  return null;
}
