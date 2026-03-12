import { create } from 'zustand';
import type { Session, ChatMessage, SessionActivity, UsageRecord, FileActivity } from '@ccui/shared';

export interface SessionUsageSummary {
  latestInputTokens: number;
  totalCost: number;
  totalInput: number;
  totalOutput: number;
  callCount: number;
  model: string;
}

interface SessionStore {
  sessions: Session[];
  activeSessionId: string | null;
  focusedSessionId: string | null;
  expandedSessions: Record<string, boolean>;
  messages: Record<string, ChatMessage[]>;
  streamingContent: Record<string, string>;
  activities: Record<string, SessionActivity>;
  sessionUsage: Record<string, SessionUsageSummary>;
  fileActivities: Record<string, FileActivity[]>;
  usageRefreshKey: number;

  fetchSessions: () => Promise<void>;
  createSession: (projectPath: string, opts?: { agentId?: string; branch?: string; name?: string }) => Promise<Session>;
  setActiveSession: (id: string | null) => void;
  toggleFocus: (id: string) => void;
  toggleExpanded: (id: string) => void;
  setExpanded: (id: string, expanded: boolean) => void;
  appendMessage: (sessionId: string, msg: ChatMessage) => void;
  appendStreamChunk: (sessionId: string, chunk: string) => void;
  finalizeStream: (sessionId: string) => void;
  fetchMessages: (sessionId: string) => Promise<void>;
  updateSessionStatus: (sessionId: string, status: Session['status']) => void;
  updateActivity: (sessionId: string, activity: SessionActivity) => void;
  updateSessionBranch: (sessionId: string, branch: string) => void;
  resumeSession: (sessionId: string) => Promise<void>;
  terminateSession: (sessionId: string) => Promise<void>;
  updateSessionUsage: (sessionId: string, record: UsageRecord) => void;
  fetchSessionUsage: (sessionId: string) => Promise<void>;
  addFileActivity: (sessionId: string, activity: FileActivity) => void;
}

export const useSessionStore = create<SessionStore>((set, get) => ({
  sessions: [],
  activeSessionId: null,
  focusedSessionId: null,
  expandedSessions: {},
  messages: {},
  streamingContent: {},
  activities: {},
  sessionUsage: {},
  fileActivities: {},
  usageRefreshKey: 0,

  fetchSessions: async () => {
    const res = await fetch('/api/sessions');
    const sessions = await res.json();
    set({ sessions });
  },

  createSession: async (projectPath, opts) => {
    const res = await fetch('/api/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectPath, ...opts }),
    });
    const session = await res.json();
    if (!res.ok || session.error) {
      throw new Error(session.error || 'Failed to create session');
    }
    set((s) => ({
      sessions: [session, ...s.sessions],
      activeSessionId: session.id,
      expandedSessions: { ...s.expandedSessions, [session.id]: true },
    }));
    return session;
  },

  setActiveSession: (id) => set({ activeSessionId: id }),

  toggleFocus: (id) => {
    const current = get().focusedSessionId;
    set({
      focusedSessionId: current === id ? null : id,
      expandedSessions: { ...get().expandedSessions, [id]: true },
      activeSessionId: id,
    });
    if (current === id) return; // unfocusing
    get().fetchMessages(id);
  },

  toggleExpanded: (id) => {
    const wasExpanded = get().expandedSessions[id];
    set((s) => ({
      expandedSessions: { ...s.expandedSessions, [id]: !wasExpanded },
      activeSessionId: id,
    }));
    if (!wasExpanded) {
      get().fetchMessages(id);
    }
  },

  setExpanded: (id, expanded) => {
    set((s) => ({
      expandedSessions: { ...s.expandedSessions, [id]: expanded },
    }));
    if (expanded) get().fetchMessages(id);
  },

  appendMessage: (sessionId, msg) => {
    set((s) => ({
      messages: {
        ...s.messages,
        [sessionId]: [...(s.messages[sessionId] || []), msg],
      },
    }));
  },

  appendStreamChunk: (sessionId, chunk) => {
    set((s) => ({
      streamingContent: {
        ...s.streamingContent,
        [sessionId]: (s.streamingContent[sessionId] || '') + chunk,
      },
    }));
  },

  finalizeStream: (sessionId) => {
    const content = get().streamingContent[sessionId];
    if (content) {
      const msg: ChatMessage = {
        id: crypto.randomUUID(),
        sessionId,
        role: 'assistant',
        content,
        timestamp: new Date().toISOString(),
      };
      set((s) => ({
        messages: {
          ...s.messages,
          [sessionId]: [...(s.messages[sessionId] || []), msg],
        },
        streamingContent: { ...s.streamingContent, [sessionId]: '' },
      }));
    }
  },

  fetchMessages: async (sessionId) => {
    try {
      const res = await fetch(`/api/sessions/${sessionId}/messages`);
      const messages = await res.json();
      set((s) => ({ messages: { ...s.messages, [sessionId]: messages } }));
    } catch { /* ignore */ }
  },

  updateSessionStatus: (sessionId, status) => {
    set((s) => ({
      sessions: s.sessions.map((sess) =>
        sess.id === sessionId ? { ...sess, status } : sess
      ),
    }));
  },

  updateActivity: (sessionId, activity) => {
    set((s) => ({
      activities: { ...s.activities, [sessionId]: activity },
    }));
  },

  updateSessionBranch: (sessionId, branch) => {
    set((s) => ({
      sessions: s.sessions.map((sess) =>
        sess.id === sessionId ? { ...sess, branch } : sess
      ),
    }));
  },

  resumeSession: async (sessionId) => {
    const res = await fetch(`/api/sessions/${sessionId}/resume`, { method: 'POST' });
    const session = await res.json();
    if (!res.ok || session.error) {
      throw new Error(session.error || 'Failed to resume session');
    }
    set((s) => ({
      sessions: s.sessions.map((sess) =>
        sess.id === sessionId ? { ...sess, status: 'idle' as const } : sess
      ),
      expandedSessions: { ...s.expandedSessions, [sessionId]: true },
      activeSessionId: sessionId,
    }));
    get().fetchMessages(sessionId);
  },

  terminateSession: async (sessionId) => {
    await fetch(`/api/sessions/${sessionId}`, { method: 'DELETE' });
    set((s) => ({
      sessions: s.sessions.map((sess) =>
        sess.id === sessionId ? { ...sess, status: 'terminated' as const } : sess
      ),
    }));
  },

  updateSessionUsage: (sessionId, record) => {
    set((s) => {
      const prev = s.sessionUsage[sessionId];
      return {
        usageRefreshKey: s.usageRefreshKey + 1,
        sessionUsage: {
          ...s.sessionUsage,
          [sessionId]: {
            latestInputTokens: record.inputTokens,
            totalCost: (prev?.totalCost ?? 0) + record.cost,
            totalInput: (prev?.totalInput ?? 0) + record.inputTokens,
            totalOutput: (prev?.totalOutput ?? 0) + record.outputTokens,
            callCount: (prev?.callCount ?? 0) + 1,
            model: record.model || prev?.model || '',
          },
        },
      };
    });
  },

  fetchSessionUsage: async (sessionId) => {
    try {
      const res = await fetch(`/api/usage/session-summary?sessionId=${sessionId}`);
      const data = await res.json();
      if (!data.error) {
        set((s) => ({
          sessionUsage: { ...s.sessionUsage, [sessionId]: data },
        }));
      }
    } catch { /* ignore */ }
  },

  addFileActivity: (sessionId, activity) => {
    set((s) => {
      const prev = s.fileActivities[sessionId] ?? [];
      // Keep last 30 entries
      const next = [...prev, activity].slice(-30);
      return { fileActivities: { ...s.fileActivities, [sessionId]: next } };
    });
  },
}));
