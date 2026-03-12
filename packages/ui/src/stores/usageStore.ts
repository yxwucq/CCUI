import { create } from 'zustand';
import type { UsageSummary } from '@ccui/shared';

interface UsageStore {
  summary: UsageSummary | null;
  daily: any[];
  modelUsage: any[];
  range: string;
  setRange: (range: string) => void;
  fetchSummary: (range?: string) => Promise<void>;
  fetchDaily: (range?: string) => Promise<void>;
  fetchModelUsage: () => Promise<void>;
}

export const useUsageStore = create<UsageStore>((set, get) => ({
  summary: null,
  daily: [],
  modelUsage: [],
  range: '7d',

  setRange: (range) => {
    set({ range });
    get().fetchSummary(range);
    get().fetchDaily(range);
  },

  fetchSummary: async (range) => {
    const r = range || get().range;
    const res = await fetch(`/api/usage/summary?range=${r}`);
    const summary = await res.json();
    set({ summary });
  },

  fetchDaily: async (range) => {
    const r = range || get().range;
    const res = await fetch(`/api/usage/daily?range=${r}`);
    const daily = await res.json();
    set({ daily });
  },

  fetchModelUsage: async () => {
    const res = await fetch('/api/usage/models');
    const modelUsage = await res.json();
    set({ modelUsage });
  },
}));
