import { create } from 'zustand';
import type { Lead } from '@/types';
import { useProfileStore } from './profileStore';

interface LeadsState {
  leads: Lead[];
  selectedLeadIds: string[];
  activeProfileId: string | null;
  isLoading: boolean;
  error: string | null;
  setLeads: (leads: Lead[]) => void;
  refreshLeads: () => Promise<void>;
  toggleLeadSelection: (leadId: string) => void;
  setSelectedLeadIds: (ids: string[]) => void;
  clearSelection: () => void;
  pendingCount: () => number;
}

export const useLeadsStore = create<LeadsState>((set, get) => ({
  leads: [],
  selectedLeadIds: [],
  activeProfileId: null,
  isLoading: false,
  error: null,

  setLeads: (leads) => set({ leads }),

  refreshLeads: async () => {
    set({ isLoading: true, error: null });
    try {
      const profileId = useProfileStore.getState().selectedProfile?.id ?? null;
      if (!profileId) {
        set({
          leads: [],
          selectedLeadIds: [],
          activeProfileId: null,
          isLoading: false,
          error: null,
        });
        return;
      }

      const response = await fetch(`/api/leads?profileId=${encodeURIComponent(profileId)}`, { cache: 'no-store' });
      if (!response.ok) {
        throw new Error(`Failed to load leads: ${response.status}`);
      }
      const payload = await response.json();
      const leads: Lead[] = payload.leads ?? [];

      const selected = new Set(
        get().activeProfileId === profileId
          ? get().selectedLeadIds
          : []
      );
      const validSelected = leads.filter((lead) => selected.has(lead.id)).map((lead) => lead.id);

      set({
        leads,
        selectedLeadIds: validSelected,
        activeProfileId: profileId,
        isLoading: false,
      });
    } catch (error) {
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Unknown error while loading leads',
      });
    }
  },

  toggleLeadSelection: (leadId) => {
    const current = new Set(get().selectedLeadIds);
    if (current.has(leadId)) {
      current.delete(leadId);
    } else {
      current.add(leadId);
    }
    set({ selectedLeadIds: Array.from(current) });
  },

  setSelectedLeadIds: (ids) => set({ selectedLeadIds: ids }),

  clearSelection: () => set({ selectedLeadIds: [] }),

  pendingCount: () => get().leads.filter((lead) => lead.status === 'pending').length,
}));
