import { create } from 'zustand';

export interface WidgetDef {
  id: string;
  name: string;
  description: string;
  defaultEnabled: boolean;
  defaultSize: 'sm' | 'lg';
}

export interface WidgetConfig {
  id: string;
  size: 'sm' | 'lg';
}

export const AVAILABLE_WIDGETS: WidgetDef[] = [
  { id: 'context',       name: 'Context',       description: 'Remaining context window & token usage',        defaultEnabled: true,  defaultSize: 'sm' },
  { id: 'git-status',    name: 'Git Status',    description: 'Branch info & changed files',                   defaultEnabled: true,  defaultSize: 'sm' },
  { id: 'history',       name: 'History',       description: 'Conversation stats & message count',            defaultEnabled: true,  defaultSize: 'sm' },
  { id: 'usage',         name: 'Usage',         description: 'Cost & token breakdown for this session',       defaultEnabled: true,  defaultSize: 'sm' },
  { id: 'file-activity', name: 'File Activity', description: 'Live feed of files Claude is reading & writing', defaultEnabled: false, defaultSize: 'sm' },
  { id: 'notes',         name: 'Notes',         description: 'Session goals & reminders in Markdown',          defaultEnabled: false, defaultSize: 'lg' },
];

const DEFAULT_WIDGETS: WidgetConfig[] = AVAILABLE_WIDGETS
  .filter((w) => w.defaultEnabled)
  .map((w) => ({ id: w.id, size: w.defaultSize }));

/** Migrate old string[] format → WidgetConfig[] */
function migrateWidgets(raw: any[]): WidgetConfig[] {
  return raw.map((item) =>
    typeof item === 'string' ? { id: item, size: 'sm' as const } : item
  );
}

interface WidgetStore {
  sessionWidgets: Record<string, WidgetConfig[]>;
  defaultWidgets: WidgetConfig[];
  loaded: boolean;

  loadConfig: () => Promise<void>;
  getWidgets: (sessionId: string) => WidgetConfig[];
  toggleWidget: (sessionId: string, widgetId: string) => void;
  setWidgetSize: (sessionId: string, widgetId: string, size: 'sm' | 'lg') => void;
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
        defaultWidgets: config.defaultWidgets
          ? migrateWidgets(config.defaultWidgets)
          : DEFAULT_WIDGETS,
        sessionWidgets: config.sessions
          ? Object.fromEntries(
              Object.entries(config.sessions).map(([k, v]: [string, any]) => [
                k,
                migrateWidgets(v.widgets || DEFAULT_WIDGETS),
              ])
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
    return sessionWidgets[sessionId] ?? defaultWidgets;
  },

  toggleWidget: (sessionId, widgetId) => {
    const current = get().getWidgets(sessionId);
    const isEnabled = current.some((wc) => wc.id === widgetId);
    const next = isEnabled
      ? current.filter((wc) => wc.id !== widgetId)
      : [...current, { id: widgetId, size: 'sm' as const }];
    set((s) => ({ sessionWidgets: { ...s.sessionWidgets, [sessionId]: next } }));
    get().saveConfig();
  },

  setWidgetSize: (sessionId, widgetId, size) => {
    const current = get().getWidgets(sessionId);
    const next = current.map((wc) => (wc.id === widgetId ? { ...wc, size } : wc));
    set((s) => ({ sessionWidgets: { ...s.sessionWidgets, [sessionId]: next } }));
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
