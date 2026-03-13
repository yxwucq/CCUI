import { create } from 'zustand';
import type { UsageSummary } from '@ccui/shared';
import * as usageApi from '../api/usage';

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
  fetchPerSession: (range?: string) => Promise<void>;
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
    get().fetchPerSession(range);
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
    const summary = await usageApi.fetchUsageSummary(r, sid);
    set({ summary });
  },

  fetchDaily: async (range, sessionId) => {
    const r = range ?? get().range;
    const sid = sessionId !== undefined ? sessionId : get().selectedSessionId;
    const daily = await usageApi.fetchDailyUsage(r, sid);
    set({ daily });
  },

  fetchModelUsage: async (sessionId) => {
    const sid = sessionId !== undefined ? sessionId : get().selectedSessionId;
    const modelUsage = await usageApi.fetchModelUsage(sid);
    set({ modelUsage });
  },

  fetchPerSession: async (range) => {
    const r = range ?? get().range;
    const perSession = await usageApi.fetchPerSessionUsage(r);
    set({ perSession });
  },
}));
