import { create } from 'zustand';
import * as configApi from '../api/config';
import type { TerminalConfig } from '@ccui/shared';
import { applyTheme } from '../theme';

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
  { id: 'memory',        name: 'Memory',        description: 'Auto-memory entries for this project',            defaultEnabled: false, defaultSize: 'lg' },
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

/** Detect system color scheme preference */
function getSystemTheme(): string {
  if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: light)').matches) {
    return 'light';
  }
  return 'dark';
}

export interface TagDef {
  label: string;
  color: string; // tailwind text color class
  bg: string;    // tailwind bg color class
}

export const PRESET_TAGS: TagDef[] = [
  { label: 'TODO',       color: 'text-yellow-300', bg: 'bg-yellow-500/15' },
  { label: 'Due Today',  color: 'text-red-300',    bg: 'bg-red-500/15' },
  { label: 'Blocked',    color: 'text-orange-300',  bg: 'bg-orange-500/15' },
  { label: 'Review',     color: 'text-blue-300',   bg: 'bg-blue-500/15' },
  { label: 'In Progress', color: 'text-emerald-300', bg: 'bg-emerald-500/15' },
  { label: 'Low Priority', color: 'text-slate-300', bg: 'bg-slate-500/15' },
];

export function getTagDef(label: string): TagDef {
  return PRESET_TAGS.find((t) => t.label === label) || { label, color: 'text-violet-300', bg: 'bg-violet-500/15' };
}

interface WidgetStore {
  sessionWidgets: Record<string, WidgetConfig[]>;
  sessionTags: Record<string, string[]>;
  defaultWidgets: WidgetConfig[];
  appName: string;
  themeId: string;
  terminalConfig: TerminalConfig;
  dailyBudget: number;
  alertAt: number;
  loaded: boolean;

  loadConfig: () => Promise<void>;
  getWidgets: (sessionId: string) => WidgetConfig[];
  toggleWidget: (sessionId: string, widgetId: string) => void;
  setWidgetSize: (sessionId: string, widgetId: string, size: 'sm' | 'lg') => void;
  setAppName: (name: string) => void;
  setTheme: (themeId: string) => void;
  setQuota: (dailyBudget: number, alertAt?: number) => void;
  addTag: (sessionId: string, tag: string) => void;
  removeTag: (sessionId: string, tag: string) => void;
  getTags: (sessionId: string) => string[];
  saveConfig: () => Promise<void>;
}

const DEFAULT_APP_NAME = 'CCUI';

const DEFAULT_DAILY_BUDGET = 10;
const DEFAULT_ALERT_AT = 0.8;

export const useWidgetStore = create<WidgetStore>((set, get) => ({
  sessionWidgets: {},
  sessionTags: {},
  defaultWidgets: DEFAULT_WIDGETS,
  appName: DEFAULT_APP_NAME,
  themeId: 'dark',
  terminalConfig: {},
  dailyBudget: DEFAULT_DAILY_BUDGET,
  alertAt: DEFAULT_ALERT_AT,
  loaded: false,

  loadConfig: async () => {
    try {
      const config = await configApi.loadConfig();
      const appName = config.appName || DEFAULT_APP_NAME;
      const themeId = config.theme || getSystemTheme();
      document.title = appName;
      applyTheme(themeId);
      const quota = config.quota || {};
      set({
        appName,
        themeId,
        terminalConfig: config.terminal || {},
        dailyBudget: quota.dailyBudget ?? DEFAULT_DAILY_BUDGET,
        alertAt: quota.alertAt ?? DEFAULT_ALERT_AT,
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
        sessionTags: config.sessions
          ? Object.fromEntries(
              Object.entries(config.sessions)
                .filter(([, v]: [string, any]) => Array.isArray(v.tags) && v.tags.length > 0)
                .map(([k, v]: [string, any]) => [k, v.tags])
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

  setAppName: (name) => {
    const trimmed = name.trim() || DEFAULT_APP_NAME;
    document.title = trimmed;
    set({ appName: trimmed });
    get().saveConfig();
  },

  setTheme: (themeId) => {
    applyTheme(themeId);
    set({ themeId });
    get().saveConfig();
  },

  setQuota: (dailyBudget, alertAt) => {
    const updates: Partial<WidgetStore> = { dailyBudget };
    if (alertAt !== undefined) updates.alertAt = alertAt;
    set(updates as any);
    get().saveConfig();
  },

  getTags: (sessionId) => get().sessionTags[sessionId] ?? [],

  addTag: (sessionId, tag) => {
    const current = get().getTags(sessionId);
    if (current.includes(tag)) return;
    set((s) => ({ sessionTags: { ...s.sessionTags, [sessionId]: [...current, tag] } }));
    get().saveConfig();
  },

  removeTag: (sessionId, tag) => {
    const current = get().getTags(sessionId);
    set((s) => ({ sessionTags: { ...s.sessionTags, [sessionId]: current.filter((t) => t !== tag) } }));
    get().saveConfig();
  },

  saveConfig: async () => {
    const { defaultWidgets, sessionWidgets, sessionTags, appName, themeId, terminalConfig, dailyBudget, alertAt } = get();
    // Merge widgets and tags per session
    const allSessionIds = new Set([...Object.keys(sessionWidgets), ...Object.keys(sessionTags)]);
    const sessionsConfig: Record<string, any> = {};
    for (const id of allSessionIds) {
      const entry: any = {};
      if (sessionWidgets[id]) entry.widgets = sessionWidgets[id];
      if (sessionTags[id]?.length) entry.tags = sessionTags[id];
      sessionsConfig[id] = entry;
    }
    const config: Record<string, any> = {
      appName,
      theme: themeId,
      defaultWidgets,
      quota: { dailyBudget, alertAt },
      sessions: sessionsConfig,
    };
    if (Object.keys(terminalConfig).length > 0) {
      config.terminal = terminalConfig;
    }
    try {
      await configApi.saveConfig(config);
    } catch { /* best effort */ }
  },
}));
