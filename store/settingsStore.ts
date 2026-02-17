import { create } from 'zustand';
import { createClient } from '@/lib/supabase/client';
import { DEFAULT_LIMITS, type AppLimits } from '@/lib/config/limits';

interface AppSettingsRow {
  id: string;
  daily_visit_limit: number;
  daily_connect_limit: number;
  daily_message_limit: number;
  daily_follow_limit: number;
  min_action_delay_sec: number;
  max_action_delay_sec: number;
  min_lead_delay_sec: number;
  max_lead_delay_sec: number;
}

interface SettingsState {
  limits: AppLimits;
  isLoading: boolean;
  error: string | null;
  settingsId: string | null;
  initialized: boolean;
  initialize: () => Promise<void>;
  loadSettings: () => Promise<void>;
  updateLimits: (updates: Partial<AppLimits>) => Promise<void>;
}

const supabase = createClient();
let initializationPromise: Promise<void> | null = null;

function mapRowToLimits(row: AppSettingsRow): AppLimits {
  return {
    dailyVisitLimit: row.daily_visit_limit,
    dailyConnectLimit: row.daily_connect_limit,
    dailyMessageLimit: row.daily_message_limit,
    dailyFollowLimit: row.daily_follow_limit,
    minActionDelaySec: row.min_action_delay_sec,
    maxActionDelaySec: row.max_action_delay_sec,
    minLeadDelaySec: row.min_lead_delay_sec,
    maxLeadDelaySec: row.max_lead_delay_sec,
  };
}

function mapLimitsToRow(limits: AppLimits) {
  return {
    daily_visit_limit: limits.dailyVisitLimit,
    daily_connect_limit: limits.dailyConnectLimit,
    daily_message_limit: limits.dailyMessageLimit,
    daily_follow_limit: limits.dailyFollowLimit,
    min_action_delay_sec: limits.minActionDelaySec,
    max_action_delay_sec: limits.maxActionDelaySec,
    min_lead_delay_sec: limits.minLeadDelaySec,
    max_lead_delay_sec: limits.maxLeadDelaySec,
  };
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  limits: DEFAULT_LIMITS,
  isLoading: false,
  error: null,
  settingsId: null,
  initialized: false,

  initialize: async () => {
    if (get().initialized) return;
    if (initializationPromise) return initializationPromise;

    initializationPromise = (async () => {
      set({ initialized: true });
      await get().loadSettings();
    })().finally(() => {
      initializationPromise = null;
    });

    return initializationPromise;
  },

  loadSettings: async () => {
    set({ isLoading: true, error: null });

    const { data, error } = await supabase
      .from('app_settings')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      const missingTableHint = "Could not find the table 'public.app_settings'";
      const message = error.message.includes(missingTableHint)
        ? "Missing Supabase table: app_settings. Run supabase/migrations/003_add_profiles_and_settings.sql, then refresh."
        : error.message;
      set({ isLoading: false, error: message });
      return;
    }

    if (!data) {
      set({ isLoading: false, settingsId: null, limits: DEFAULT_LIMITS });
      return;
    }

    const row = data as AppSettingsRow;

    set({
      limits: mapRowToLimits(row),
      settingsId: row.id,
      isLoading: false,
      error: null,
    });
  },

  updateLimits: async (updates) => {
    const previous = get().limits;
    const next = { ...previous, ...updates };
    set({ limits: next, error: null });

    let settingsId = get().settingsId;
    if (!settingsId) {
      await get().loadSettings();
      settingsId = get().settingsId;
    }

    if (!settingsId) {
      set({ limits: previous, error: 'No app_settings row found to update' });
      return;
    }

    const { error } = await supabase
      .from('app_settings')
      .update(mapLimitsToRow(next))
      .eq('id', settingsId);

    if (error) {
      set({ limits: previous, error: error.message });
    }
  },
}));
