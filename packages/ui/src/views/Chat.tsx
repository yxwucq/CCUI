import { useEffect, useState, useCallback, useRef } from 'react';
import { useSessionStore } from '../stores/sessionStore';
import { useAgentStore } from '../stores/agentStore';
import { useWidgetStore } from '../stores/widgetStore';
import SessionBlock from '../components/SessionBlock';
import SessionOverviewCard from '../components/SessionOverviewCard';
import NewSessionForm from '../components/NewSessionForm';
import ProjectInitDialog from '../components/ProjectInitDialog';
import ErrorBoundary from '../components/ErrorBoundary';
import { Plus, Minimize2, LayoutGrid, List, Search, X, Layers, PanelTop, ChevronRight } from 'lucide-react';
import { Session } from '@ccui/shared';
import { motion, AnimatePresence } from 'framer-motion';
import { fetchProjectConfig } from '../api/projects';

const EMPTY_MSGS: never[] = [];
const EMPTY_CALLS: never[] = [];

function TerminatedSection({ sessions, layoutMode, children }: {
  sessions: Session[];
  layoutMode: 'accordion' | 'scroll';
  children: (s: Session) => React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="shrink-0">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 w-full px-1 py-1 text-xs text-cc-text-muted uppercase tracking-wider hover:text-cc-text-muted transition-colors select-none"
      >
        <ChevronRight size={11} className={`transition-transform duration-200 ${open ? 'rotate-90' : ''}`} />
        Terminated ({sessions.length})
      </button>
      {open && (
        <div className="flex flex-col gap-1.5 mt-0.5">
          {sessions.map((s) => children(s))}
        </div>
      )}
    </div>
  );
}

export default function Chat() {
  const sessions = useSessionStore((s) => s.sessions);
  const fetchSessions = useSessionStore((s) => s.fetchSessions);
  const focusedSessionId = useSessionStore((s) => s.focusedSessionId);
  const toggleFocus = useSessionStore((s) => s.toggleFocus);
  const expandedSessions = useSessionStore((s) => s.expandedSessions);
  const stopSession = useSessionStore((s) => s.stopSession);
  const terminateSession = useSessionStore((s) => s.terminateSession);
  const deleteSession = useSessionStore((s) => s.deleteSession);
  const resumeSession = useSessionStore((s) => s.resumeSession);
  const setExpanded = useSessionStore((s) => s.setExpanded);
  const appendMessage = useSessionStore((s) => s.appendMessage);
  const clearChatJumpTarget = useSessionStore((s) => s.clearChatJumpTarget);
  const fetchSessionUsage = useSessionStore((s) => s.fetchSessionUsage);
  const setChatJumpTarget = useSessionStore((s) => s.setChatJumpTarget);
  const allMessages = useSessionStore((s) => s.messages);
  const allStreaming = useSessionStore((s) => s.streamingContent);
  const allActivities = useSessionStore((s) => s.activities);
  const allSessionUsage = useSessionStore((s) => s.sessionUsage);
  const allUsageCalls = useSessionStore((s) => s.usageCalls);
  const allJumpTargets = useSessionStore((s) => s.chatJumpTarget);

  const agents = useAgentStore((s) => s.agents);
  const fetchAgents = useAgentStore((s) => s.fetchAgents);
  const createSession = useSessionStore((s) => s.createSession);

  const toggleWidget = useWidgetStore((s) => s.toggleWidget);
  const setWidgetSize = useWidgetStore((s) => s.setWidgetSize);
  const allSessionWidgets = useWidgetStore((s) => s.sessionWidgets);
  const defaultWidgets = useWidgetStore((s) => s.defaultWidgets);

  const [showNewSession, setShowNewSession] = useState(false);
  const [showInitDialog, setShowInitDialog] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const viewModeBeforeFocusRef = useRef<'list' | 'grid' | null>(null);
  const [layoutMode, setLayoutMode] = useState<'accordion' | 'scroll'>('accordion');
  const [search, setSearch] = useState('');
  const [highlightIds, setHighlightIds] = useState<ReadonlySet<string>>(new Set());
  const prevStatusesRef = useRef<Record<string, string>>({});

  useEffect(() => {
    fetchSessions();
    fetchProjectConfig()
      .then((config) => {
        if (!config.initialized) setShowInitDialog(true);
      })
      .catch(() => {});
  }, []);

  // Highlight sessions that just became active (status idle → active)
  useEffect(() => {
    const prev = prevStatusesRef.current;
    const justActivated = sessions
      .filter((s) => prev[s.id] === 'idle' && s.status === 'active')
      .map((s) => s.id);
    prevStatusesRef.current = Object.fromEntries(sessions.map((s) => [s.id, s.status]));
    if (justActivated.length === 0) return;
    setHighlightIds(new Set(justActivated));
    const t = setTimeout(() => setHighlightIds(new Set()), 1500);
    return () => clearTimeout(t);
  }, [sessions]);

  // Keyboard shortcuts: Cmd+1-9 to focus session, Esc to unfocus
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key >= '1' && e.key <= '9') {
        e.preventDefault();
        const idx = parseInt(e.key) - 1;
        const allActive = sessions.filter((s) => s.status !== 'terminated');
        if (allActive[idx]) toggleFocus(allActive[idx].id);
      }
      if (e.key === 'Escape' && focusedSessionId) toggleFocus(focusedSessionId);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [sessions, focusedSessionId, toggleFocus]);

  // Restore viewMode when exiting focus
  const prevFocusedRef = useRef<string | null>(null);
  useEffect(() => {
    const wasFocused = prevFocusedRef.current;
    prevFocusedRef.current = focusedSessionId;
    if (!wasFocused && focusedSessionId) viewModeBeforeFocusRef.current = viewMode;
    if (wasFocused && !focusedSessionId && viewModeBeforeFocusRef.current) {
      setViewMode(viewModeBeforeFocusRef.current);
      viewModeBeforeFocusRef.current = null;
    }
  }, [focusedSessionId, viewMode]);

  // Accordion mode: collapse all others before expanding
  const handleToggleExpanded = useCallback((id: string) => {
    if (layoutMode === 'accordion') {
      const { expandedSessions, setExpanded, toggleExpanded } = useSessionStore.getState();
      const wasExpanded = expandedSessions[id];
      if (!wasExpanded) {
        Object.entries(expandedSessions).forEach(([sid, open]) => {
          if (open && sid !== id) setExpanded(sid, false);
        });
      }
      toggleExpanded(id);
    } else {
      useSessionStore.getState().toggleExpanded(id);
    }
  }, [layoutMode]);

  const q = search.toLowerCase().trim();
  const filtered = q
    ? sessions.filter((s) => s.name.toLowerCase().includes(q) || (s.branch || '').toLowerCase().includes(q))
    : sessions;
  const activeSessions = filtered
    .filter((s) => s.status === 'active' || s.status === 'idle')
    .sort((a, b) => {
      if (a.sessionType === 'head') return -1;
      if (b.sessionType === 'head') return 1;
      return 0;
    });
  const terminatedSessions = filtered.filter((s) => s.status === 'terminated');
  const isFocused = !!focusedSessionId;
  const focusedSession = isFocused ? sessions.find((s) => s.id === focusedSessionId) : null;

  const sessionBlockProps = useCallback((s: Session) => ({
    session: s,
    isExpanded: !!expandedSessions[s.id],
    isFocused: focusedSessionId === s.id,
    activity: allActivities[s.id],
    jumpTarget: allJumpTargets[s.id],
    enabledWidgets: allSessionWidgets[s.id] ?? defaultWidgets,
    messages: allMessages[s.id] ?? EMPTY_MSGS,
    streaming: allStreaming[s.id] ?? '',
    sessionUsage: allSessionUsage[s.id],
    usageCalls: allUsageCalls[s.id] ?? EMPTY_CALLS,
    onToggleFocus: toggleFocus,
    onStop: stopSession,
    onTerminate: (id: string) => terminateSession(id, 'discard'),
    onDelete: deleteSession,
    onResume: resumeSession,
    onSetExpanded: setExpanded,
    onAppendMessage: appendMessage,
    onClearJumpTarget: clearChatJumpTarget,
    fetchSessionUsage,
    setChatJumpTarget,
    onToggleWidget: toggleWidget,
    onSetWidgetSize: setWidgetSize,
  }), [expandedSessions, focusedSessionId, allActivities, allJumpTargets, allSessionWidgets, defaultWidgets, allMessages, allStreaming, allSessionUsage, allUsageCalls, toggleFocus, stopSession, terminateSession, deleteSession, resumeSession, setExpanded, appendMessage, clearChatJumpTarget, fetchSessionUsage, setChatJumpTarget, toggleWidget, setWidgetSize]);

  return (
    <div className="h-full flex flex-col">
      {/* Project init dialog */}
      {showInitDialog && (
        <ProjectInitDialog onInitialized={() => setShowInitDialog(false)} />
      )}

      {/* Header — hidden in focus mode */}
      {!isFocused && (
        <div className="border-b border-cc-border px-5 py-3 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <h1 className="text-base font-bold text-cc-text">Sessions</h1>
            <span className="text-xs text-cc-text-muted">{activeSessions.length} active</span>
            <div className="relative">
              <Search size={11} className="absolute left-2 top-1/2 -translate-y-1/2 text-cc-text-muted" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Filter…"
                className="bg-cc-bg-surface border border-cc-border rounded px-2 py-1 pl-6 text-xs text-cc-text-secondary placeholder-cc-text-muted focus:outline-none focus:border-cc-accent w-28 focus:w-40 transition-all"
              />
              {search && (
                <button onClick={() => setSearch('')} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-cc-text-muted hover:text-cc-text-secondary">
                  <X size={10} />
                </button>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex bg-cc-bg-surface rounded p-0.5">
              <button onClick={() => setLayoutMode('accordion')} className={`p-1 rounded transition-colors ${layoutMode === 'accordion' ? 'bg-cc-bg-overlay text-cc-text' : 'text-cc-text-muted hover:text-cc-text-secondary'}`} title="Accordion">
                <PanelTop size={13} />
              </button>
              <button onClick={() => setLayoutMode('scroll')} className={`p-1 rounded transition-colors ${layoutMode === 'scroll' ? 'bg-cc-bg-overlay text-cc-text' : 'text-cc-text-muted hover:text-cc-text-secondary'}`} title="Scroll">
                <Layers size={13} />
              </button>
            </div>
            <div className="flex bg-cc-bg-surface rounded p-0.5">
              <button onClick={() => setViewMode('list')} className={`p-1 rounded transition-colors ${viewMode === 'list' ? 'bg-cc-bg-overlay text-cc-text' : 'text-cc-text-muted hover:text-cc-text-secondary'}`} title="List view">
                <List size={13} />
              </button>
              <button onClick={() => setViewMode('grid')} className={`p-1 rounded transition-colors ${viewMode === 'grid' ? 'bg-cc-bg-overlay text-cc-text' : 'text-cc-text-muted hover:text-cc-text-secondary'}`} title="Grid overview">
                <LayoutGrid size={13} />
              </button>
            </div>
            <button onClick={() => setShowNewSession(!showNewSession)} className="flex items-center gap-2 bg-cc-accent hover:bg-cc-accent-hover px-3 py-1.5 rounded-lg text-xs transition-colors">
              <Plus size={14} /> New Session
            </button>
          </div>
        </div>
      )}

      {/* Focus mode bar */}
      {isFocused && focusedSession && (
        <div className="border-b border-cc-border/50 px-3 py-1.5 flex items-center gap-2 shrink-0">
          <button onClick={() => toggleFocus(focusedSessionId!)} className="p-1 text-cc-text-secondary hover:text-cc-text hover:bg-cc-bg-surface rounded transition-colors" title="Exit focus mode (Esc)">
            <Minimize2 size={14} />
          </button>
          <span className="text-xs text-cc-text-muted">Focus:</span>
          <span className="text-xs text-cc-text font-medium">{focusedSession.name}</span>
        </div>
      )}

      {/* New session form */}
      {showNewSession && !isFocused && <NewSessionForm onClose={() => setShowNewSession(false)} agents={agents} fetchAgents={fetchAgents} createSession={createSession} />}

      {/* Main area */}
      <div className={`flex-1 p-2 gap-1.5 ${layoutMode === 'scroll' ? 'overflow-y-auto flex flex-col' : 'flex flex-col min-h-0'}`}>
        {sessions.length === 0 && (
          <div className="flex-1 flex items-center justify-center text-cc-text-muted">
            <div className="text-center">
              <p className="text-lg mb-2">No sessions yet</p>
              <p className="text-sm">Click "New Session" to create one and start working.</p>
            </div>
          </div>
        )}

        {isFocused && focusedSession && (
          <ErrorBoundary><SessionBlock {...sessionBlockProps(focusedSession)} /></ErrorBoundary>
        )}

        {!isFocused && viewMode === 'grid' && (
          <div className="overflow-y-auto flex-1 p-1">
            {sessions.length === 0 && (
              <div className="flex items-center justify-center h-32 text-cc-text-muted text-sm">No sessions yet. Click "New Session" to create one.</div>
            )}
            {activeSessions.length > 0 && (
              <>
                <p className="text-xs text-cc-text-muted uppercase tracking-wider px-1 mb-2">Active</p>
                <motion.div
                  className="grid grid-cols-2 gap-2 mb-4"
                  style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}
                  variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.05 } } }}
                  initial="hidden"
                  animate="visible"
                >
                  <AnimatePresence mode="popLayout">
                    {activeSessions.map((s) => (
                      <motion.div key={s.id} layout
                        variants={{ hidden: { opacity: 0, scale: 0.95, y: 10 }, visible: { opacity: 1, scale: 1, y: 0 } }}
                        exit={{ opacity: 0, scale: 0.95 }}
                      >
                        <SessionOverviewCard session={s} activity={allActivities[s.id]} usage={allSessionUsage[s.id]} onClick={() => toggleFocus(s.id)} />
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </motion.div>
              </>
            )}
            {terminatedSessions.length > 0 && (
              <>
                <p className="text-xs text-cc-text-muted uppercase tracking-wider px-1 mb-2">Terminated</p>
                <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}>
                  {terminatedSessions.map((s) => <SessionOverviewCard key={s.id} session={s} activity={allActivities[s.id]} usage={allSessionUsage[s.id]} onClick={() => toggleFocus(s.id)} />)}
                </div>
              </>
            )}
          </div>
        )}

        {!isFocused && viewMode === 'list' && (
          <>
            <AnimatePresence mode="popLayout">
              {activeSessions.map((s) => (
                <motion.div key={s.id} layout
                  className={expandedSessions[s.id] && layoutMode === 'accordion' ? 'flex-1 min-h-0 flex flex-col' : 'shrink-0'}
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.2 }}
                >
                  <ErrorBoundary>
                    <SessionBlock {...sessionBlockProps(s)} highlighted={highlightIds.has(s.id)} scrollMode={layoutMode === 'scroll'} onToggleExpanded={handleToggleExpanded} />
                  </ErrorBoundary>
                </motion.div>
              ))}
            </AnimatePresence>
            {terminatedSessions.length > 0 && (
              <TerminatedSection sessions={terminatedSessions} layoutMode={layoutMode}>
                {(s) => (
                  <ErrorBoundary key={s.id}>
                    <SessionBlock {...sessionBlockProps(s)} scrollMode={layoutMode === 'scroll'} onToggleExpanded={handleToggleExpanded} />
                  </ErrorBoundary>
                )}
              </TerminatedSection>
            )}
          </>
        )}
      </div>
    </div>
  );
}
