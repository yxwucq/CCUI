import { create } from 'zustand';
import type { UsageSummary } from '@ccui/shared';

export interface SessionUsageRow {
  sessionId: string;
  sessionName: string;
  sessionStatus: string;
  lastActiveAt: string;
  totalCost: number;
  totalInput: number;
  totalOutput: number;
  totalCacheRead: number;
  totalCacheWrite: number;
  callCount: number;
  model: string;
}

interface UsageStore {
  summary: UsageSummary | null;
  daily: any[];
  modelUsage: any[];
  perSession: SessionUsageRow[];
  range: string;
  selectedSessionId: string | null;

  setRange: (range: string) => void;
  setSelectedSession: (id: string | null) => void;
  fetchAll: () => Promise<void>;
  fetchSummary: (range?: string, sessionId?: string | null) => Promise<void>;
  fetchDaily: (range?: string, sessionId?: string | null) => Promise<void>;
  fetchModelUsage: (sessionId?: string | null) => Promise<void>;
  fetchPerSession: () => Promise<void>;
}

export const useUsageStore = create<UsageStore>((set, get) => ({
  summary: null,
  daily: [],
  modelUsage: [],
  perSession: [],
  range: '7d',
  selectedSessionId: null,

  setRange: (range) => {
    set({ range });
    const sid = get().selectedSessionId;
    get().fetchSummary(range, sid);
    get().fetchDaily(range, sid);
  },

  setSelectedSession: (id) => {
    set({ selectedSessionId: id });
    const range = get().range;
    get().fetchSummary(range, id);
    get().fetchDaily(range, id);
    get().fetchModelUsage(id);
  },

  fetchAll: async () => {
    const { range, selectedSessionId: sid } = get();
    await Promise.all([
      get().fetchSummary(range, sid),
      get().fetchDaily(range, sid),
      get().fetchModelUsage(sid),
      get().fetchPerSession(),
    ]);
  },

  fetchSummary: async (range, sessionId) => {
    const r = range ?? get().range;
    const sid = sessionId !== undefined ? sessionId : get().selectedSessionId;
    const params = new URLSearchParams({ range: r });
    if (sid) params.set('sessionId', sid);
    const res = await fetch(`/api/usage/summary?${params}`);
    const summary = await res.json();
    set({ summary });
  },

  fetchDaily: async (range, sessionId) => {
    const r = range ?? get().range;
    const sid = sessionId !== undefined ? sessionId : get().selectedSessionId;
    const params = new URLSearchParams({ range: r });
    if (sid) params.set('sessionId', sid);
    const res = await fetch(`/api/usage/daily?${params}`);
    const daily = await res.json();
    set({ daily });
  },

  fetchModelUsage: async (sessionId) => {
    const sid = sessionId !== undefined ? sessionId : get().selectedSessionId;
    const params = sid ? `?sessionId=${sid}` : '';
    const res = await fetch(`/api/usage/models${params}`);
    const modelUsage = await res.json();
    set({ modelUsage });
  },

  fetchPerSession: async () => {
    const res = await fetch('/api/usage/per-session');
    const perSession = await res.json();
    set({ perSession });
  },
}));
