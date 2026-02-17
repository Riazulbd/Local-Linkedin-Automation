import { create } from 'zustand';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';
import type { LinkedInProfile } from '@/types';

const PROFILE_SELECTION_KEY = 'linkedin-automator:selected-profile-id';

const supabase = createClient();
let profileRealtimeChannel: RealtimeChannel | null = null;
let initializationPromise: Promise<void> | null = null;

function getPersistedProfileId() {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(PROFILE_SELECTION_KEY);
}

function persistProfileId(profileId: string | null) {
  if (typeof window === 'undefined') return;
  if (profileId) {
    window.localStorage.setItem(PROFILE_SELECTION_KEY, profileId);
    return;
  }
  window.localStorage.removeItem(PROFILE_SELECTION_KEY);
}

function pickSelectedProfile(profiles: LinkedInProfile[], preferredProfileId: string | null) {
  if (!profiles.length) return null;
  if (preferredProfileId) {
    const matched = profiles.find((profile) => profile.id === preferredProfileId);
    if (matched) return matched;
  }
  return profiles[0];
}

interface ProfileState {
  profiles: LinkedInProfile[];
  selectedProfile: LinkedInProfile | null;
  isLoading: boolean;
  error: string | null;
  initialized: boolean;
  initialize: () => Promise<void>;
  refreshProfiles: () => Promise<void>;
  selectProfile: (profile: LinkedInProfile | null) => void;
  selectProfileById: (profileId: string | null) => void;
}

export const useProfileStore = create<ProfileState>((set, get) => ({
  profiles: [],
  selectedProfile: null,
  isLoading: false,
  error: null,
  initialized: false,

  initialize: async () => {
    if (get().initialized) return;
    if (initializationPromise) return initializationPromise;

    initializationPromise = (async () => {
      set({ initialized: true });
      await get().refreshProfiles();

      if (profileRealtimeChannel) {
        await supabase.removeChannel(profileRealtimeChannel).catch(() => undefined);
        profileRealtimeChannel = null;
      }

      profileRealtimeChannel = supabase
        .channel('profile-store-realtime')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'linkedin_profiles' },
          () => {
            get().refreshProfiles().catch(() => undefined);
          }
        )
        .subscribe();
    })().finally(() => {
      initializationPromise = null;
    });

    return initializationPromise;
  },

  refreshProfiles: async () => {
    set({ isLoading: true, error: null });

    const preferredProfileId = get().selectedProfile?.id ?? getPersistedProfileId();

    const { data, error } = await supabase
      .from('linkedin_profiles')
      .select('*')
      .order('created_at', { ascending: true });

    if (error) {
      const missingTableHint = "Could not find the table 'public.linkedin_profiles'";
      const message = error.message.includes(missingTableHint)
        ? "Missing Supabase table: linkedin_profiles. Run supabase/migrations/003_add_profiles_and_settings.sql, then refresh."
        : error.message;
      set({ isLoading: false, error: message });
      return;
    }

    const profiles = (data ?? []) as LinkedInProfile[];
    const selectedProfile = pickSelectedProfile(profiles, preferredProfileId);

    persistProfileId(selectedProfile?.id ?? null);

    set({
      profiles,
      selectedProfile,
      isLoading: false,
      error: null,
    });
  },

  selectProfile: (profile) => {
    persistProfileId(profile?.id ?? null);
    set({ selectedProfile: profile });
  },

  selectProfileById: (profileId) => {
    const profile = profileId
      ? get().profiles.find((entry) => entry.id === profileId) ?? null
      : null;
    persistProfileId(profile?.id ?? null);
    set({ selectedProfile: profile });
  },
}));
