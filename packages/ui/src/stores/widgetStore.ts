import { create } from 'zustand';

export interface WidgetDef {
  id: string;
  name: string;
  description: string;
  defaultEnabled: boolean;
}

export const AVAILABLE_WIDGETS: WidgetDef[] = [
  { id: 'context', name: 'Context', description: 'Remaining context window & token usage', defaultEnabled: true },
  { id: 'git-status', name: 'Git Status', description: 'Branch info & changed files', defaultEnabled: true },
  { id: 'history', name: 'History', description: 'Conversation stats & message count', defaultEnabled: true },
  { id: 'usage', name: 'Usage', description: 'Cost & token breakdown for this session', defaultEnabled: true },
  { id: 'file-activity', name: 'File Activity', description: 'Live feed of files Claude is reading & writing', defaultEnabled: false },
];

const DEFAULT_WIDGETS = AVAILABLE_WIDGETS.filter((w) => w.defaultEnabled).map((w) => w.id);

interface WidgetStore {
  // Per-session widget config: sessionId -> enabled widget ids
  sessionWidgets: Record<string, string[]>;
  defaultWidgets: string[];
  loaded: boolean;

  loadConfig: () => Promise<void>;
  getWidgets: (sessionId: string) => string[];
  toggleWidget: (sessionId: string, widgetId: string) => void;
  saveConfig: () => Promise<void>;
}

export const useWidgetStore = create<WidgetStore>((set, get) => ({
  sessionWidgets: {},
  defaultWidgets: DEFAULT_WIDGETS,
  loaded: false,

  loadConfig: async () => {
    try {
      const res = await fetch('/api/config');
      const config = await res.json();
      set({
        defaultWidgets: config.defaultWidgets || DEFAULT_WIDGETS,
        sessionWidgets: config.sessions
          ? Object.fromEntries(
              Object.entries(config.sessions).map(([k, v]: [string, any]) => [k, v.widgets || DEFAULT_WIDGETS])
            )
          : {},
        loaded: true,
      });
    } catch {
      set({ loaded: true });
    }
  },

  getWidgets: (sessionId) => {
    const { sessionWidgets, defaultWidgets } = get();
    return sessionWidgets[sessionId] || defaultWidgets;
  },

  toggleWidget: (sessionId, widgetId) => {
    const current = get().getWidgets(sessionId);
    const next = current.includes(widgetId)
      ? current.filter((id) => id !== widgetId)
      : [...current, widgetId];
    set((s) => ({
      sessionWidgets: { ...s.sessionWidgets, [sessionId]: next },
    }));
    // Save in background
    get().saveConfig();
  },

  saveConfig: async () => {
    const { defaultWidgets, sessionWidgets } = get();
    const config = {
      defaultWidgets,
      sessions: Object.fromEntries(
        Object.entries(sessionWidgets).map(([k, v]) => [k, { widgets: v }])
      ),
    };
    try {
      await fetch('/api/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
    } catch { /* best effort */ }
  },
}));
