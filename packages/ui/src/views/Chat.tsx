import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useSessionStore, type SessionUsageSummary } from '../stores/sessionStore';
import { useAgentStore } from '../stores/agentStore';
import { useWidgetStore, SORT_FIELDS, type SortField, type SortDirection } from '../stores/widgetStore';
import SessionBlock from '../components/SessionBlock';
import SessionOverviewCard from '../components/SessionOverviewCard';
import NewSessionForm from '../components/NewSessionForm';
import ProjectInitDialog from '../components/ProjectInitDialog';
import ErrorBoundary from '../components/ErrorBoundary';
import { Plus, Minimize2, LayoutGrid, List, Search, X, Layers, PanelTop, ChevronRight, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { Session, SessionActivity } from '@ccui/shared';
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
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
            className="overflow-hidden"
          >
            <div className="flex flex-col gap-1.5 mt-0.5">
              {sessions.map((s) => children(s))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function GridTerminatedSection({ sessions, allActivities, allSessionUsage, onFocus }: {
  sessions: Session[];
  allActivities: Record<string, SessionActivity | undefined>;
  allSessionUsage: Record<string, SessionUsageSummary | undefined>;
  onFocus: (id: string) => void;
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
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
            className="overflow-hidden"
          >
            <motion.div
              className="grid gap-2 mt-1"
              style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}
              variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.04 } } }}
              initial="hidden"
              animate="visible"
            >
              {sessions.map((s) => (
                <motion.div key={s.id}
                  variants={{ hidden: { opacity: 0, y: 8 }, visible: { opacity: 1, y: 0 } }}
                >
                  <SessionOverviewCard session={s} activity={allActivities[s.id]} usage={allSessionUsage[s.id]} onClick={() => onFocus(s.id)} />
                </motion.div>
              ))}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function SortControl({ sortField, sortDirection, onSetField, onToggleDirection }: {
  sortField: SortField; sortDirection: SortDirection;
  onSetField: (f: SortField) => void; onToggleDirection: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const label = SORT_FIELDS.find((f) => f.value === sortField)?.label ?? 'Sort';

  return (
    <div className="relative flex bg-cc-bg-surface rounded p-0.5" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-1.5 px-1.5 py-0.5 rounded text-xs transition-colors ${open ? 'bg-cc-bg-overlay text-cc-text' : 'text-cc-text-muted hover:text-cc-text-secondary'}`}
        title="Sort by"
      >
        <ArrowUpDown size={11} />
        {label}
      </button>
      <button
        onClick={onToggleDirection}
        className="p-1 rounded text-cc-text-muted hover:text-cc-text-secondary transition-colors"
        title={sortDirection === 'asc' ? 'Ascending' : 'Descending'}
      >
        {sortDirection === 'asc' ? <ArrowUp size={11} /> : <ArrowDown size={11} />}
      </button>
      {open && (
        <div className="absolute top-full mt-1 bg-cc-bg-surface border border-cc-border rounded shadow-lg py-1 z-50 min-w-[100px]">
          {SORT_FIELDS.map((f) => (
            <button
              key={f.value}
              onClick={() => { onSetField(f.value); setOpen(false); }}
              className={`w-full text-left px-3 py-1.5 text-xs transition-colors ${
                f.value === sortField
                  ? 'text-cc-accent bg-cc-accent-muted'
                  : 'text-cc-text-secondary hover:text-cc-text hover:bg-cc-bg-overlay'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function sortSessions(sessions: Session[], field: SortField, direction: SortDirection): Session[] {
  const dir = direction === 'asc' ? 1 : -1;
  return [...sessions].sort((a, b) => {
    if (a.sessionType === 'head') return -1;
    if (b.sessionType === 'head') return 1;
    switch (field) {
      case 'active':
        return dir * a.lastActiveAt.localeCompare(b.lastActiveAt);
      case 'name':
        return dir * a.name.localeCompare(b.name);
      case 'created':
      default:
        return dir * a.createdAt.localeCompare(b.createdAt);
    }
  });
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
  const clearChatJumpTarget = useSessionStore((s) => s.clearChatJumpTarget);
  const fetchSessionUsage = useSessionStore((s) => s.fetchSessionUsage);
  const setChatJumpTarget = useSessionStore((s) => s.setChatJumpTarget);
  const allMessages = useSessionStore((s) => s.messages);
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
  const allSessionTags = useWidgetStore((s) => s.sessionTags);
  const sortField = useWidgetStore((s) => s.sortField);
  const setSortField = useWidgetStore((s) => s.setSortField);
  const sortDirection = useWidgetStore((s) => s.sortDirection);
  const toggleSortDirection = useWidgetStore((s) => s.toggleSortDirection);

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

  const [showHidden, setShowHidden] = useState(false);

  const q = search.toLowerCase().trim();
  const filtered = q
    ? sessions.filter((s) =>
        s.name.toLowerCase().includes(q) ||
        (s.branch || '').toLowerCase().includes(q) ||
        (allSessionTags[s.id] || []).some((t) => t.toLowerCase().includes(q))
      )
    : sessions;
  const hiddenCount = filtered.filter((s) => s.hidden && (s.status === 'active' || s.status === 'idle')).length;
  const activeSessions = sortSessions(
    filtered.filter((s) => (s.status === 'active' || s.status === 'idle') && (showHidden || !s.hidden)),
    sortField, sortDirection,
  );
  const terminatedSessions = sortSessions(
    filtered.filter((s) => s.status === 'terminated'),
    sortField, sortDirection,
  );

  // Cmd held state — show shortcut badges after holding for 300ms
  const [cmdHeld, setCmdHeld] = useState(false);
  const cmdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shortcutMap = useMemo(() => {
    if (!cmdHeld || focusedSessionId) return {};
    const map: Record<string, number> = {};
    activeSessions.forEach((s, i) => { if (i < 9) map[s.id] = i + 1; });
    return map;
  }, [cmdHeld, focusedSessionId, activeSessions]);

  // Keyboard shortcuts: Cmd/Ctrl+1-9 to focus session, Esc to unfocus, Cmd/Ctrl hold for badges
  useEffect(() => {
    const clearTimer = () => {
      if (cmdTimerRef.current) { clearTimeout(cmdTimerRef.current); cmdTimerRef.current = null; }
    };
    const onDown = (e: KeyboardEvent) => {
      if ((e.key === 'Meta' || e.key === 'Control') && !focusedSessionId) {
        clearTimer();
        cmdTimerRef.current = setTimeout(() => setCmdHeld(true), 500);
      }
      if ((e.metaKey || e.ctrlKey) && e.key >= '1' && e.key <= '9') {
        e.preventDefault();
        const idx = parseInt(e.key) - 1;
        if (activeSessions[idx]) toggleFocus(activeSessions[idx].id);
      }
      if (e.key === 'Escape' && focusedSessionId) toggleFocus(focusedSessionId);
    };
    const onUp = (e: KeyboardEvent) => {
      if (e.key === 'Meta' || e.key === 'Control') { clearTimer(); setCmdHeld(false); }
    };
    const onBlur = () => { clearTimer(); setCmdHeld(false); };
    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);
    window.addEventListener('blur', onBlur);
    return () => {
      clearTimer();
      window.removeEventListener('keydown', onDown);
      window.removeEventListener('keyup', onUp);
      window.removeEventListener('blur', onBlur);
    };
  }, [activeSessions, focusedSessionId, toggleFocus]);

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
    sessionUsage: allSessionUsage[s.id],
    usageCalls: allUsageCalls[s.id] ?? EMPTY_CALLS,
    onToggleFocus: toggleFocus,
    onStop: stopSession,
    onTerminate: (id: string) => terminateSession(id, 'discard'),
    onDelete: deleteSession,
    onResume: resumeSession,
    onSetExpanded: setExpanded,
    onClearJumpTarget: clearChatJumpTarget,
    fetchSessionUsage,
    setChatJumpTarget,
    onToggleWidget: toggleWidget,
    onSetWidgetSize: setWidgetSize,
  }), [expandedSessions, focusedSessionId, allActivities, allJumpTargets, allSessionWidgets, defaultWidgets, allMessages, allSessionUsage, allUsageCalls, toggleFocus, stopSession, terminateSession, deleteSession, resumeSession, setExpanded, clearChatJumpTarget, fetchSessionUsage, setChatJumpTarget, toggleWidget, setWidgetSize]);

  return (
    <div className="h-full flex flex-col">
      {/* Project init dialog */}
      {showInitDialog && (
        <ProjectInitDialog onInitialized={() => {
          setShowInitDialog(false);
          // Trigger tutorial after init dialog closes (if not completed)
          if (!localStorage.getItem('ccui-tour-completed')) {
            setTimeout(() => {
              import('../components/TutorialOverlay').then((m) => m.startTutorial());
            }, 500);
          }
        }} />
      )}

      {/* Header / Focus bar — animated swap */}
      <AnimatePresence mode="wait" initial={false}>
        {!isFocused ? (
          <motion.div
            key="header"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
            className="border-b border-cc-border px-5 py-3 flex items-center justify-between shrink-0"
          >
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
              <SortControl sortField={sortField} sortDirection={sortDirection} onSetField={setSortField} onToggleDirection={toggleSortDirection} />
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
          </motion.div>
        ) : focusedSession ? (
          <motion.div
            key="focus-bar"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
            className="border-b border-cc-border/50 px-3 py-1.5 flex items-center gap-2 shrink-0"
          >
            <button onClick={() => toggleFocus(focusedSessionId!)} className="p-1 text-cc-text-secondary hover:text-cc-text hover:bg-cc-bg-surface rounded transition-colors" title="Exit focus mode (Esc)">
              <Minimize2 size={14} />
            </button>
            <span className="text-xs text-cc-text-muted">Focus:</span>
            <span className="text-xs text-cc-text font-medium">{focusedSession.name}</span>
          </motion.div>
        ) : null}
      </AnimatePresence>

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

        {!isFocused && viewMode === 'grid' && (
          <motion.div
            className="overflow-y-auto flex-1 p-1"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
          >
            {sessions.length === 0 && (
              <div className="flex items-center justify-center h-32 text-cc-text-muted text-sm">No sessions yet. Click "New Session" to create one.</div>
            )}
            {activeSessions.length > 0 && (
              <>
                <div className="flex items-center gap-2 px-1 mb-2">
                  <p className="text-xs text-cc-text-muted uppercase tracking-wider">Active</p>
                  {hiddenCount > 0 && (
                    <button
                      onClick={() => setShowHidden(!showHidden)}
                      className="text-[10px] text-cc-text-muted hover:text-cc-text-secondary transition-colors"
                    >
                      {showHidden ? 'hide' : `+${hiddenCount} hidden`}
                    </button>
                  )}
                </div>
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
                        <SessionOverviewCard session={s} activity={allActivities[s.id]} usage={allSessionUsage[s.id]} onClick={() => toggleFocus(s.id)} shortcutIndex={shortcutMap[s.id]} />
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </motion.div>
              </>
            )}
            {terminatedSessions.length > 0 && (
              <GridTerminatedSection sessions={terminatedSessions} allActivities={allActivities} allSessionUsage={allSessionUsage} onFocus={toggleFocus} />
            )}
          </motion.div>
        )}

        {/* SessionBlocks always rendered — visibility controlled by CSS + opacity animation */}
        <AnimatePresence mode="popLayout">
          {activeSessions.map((s) => {
            const isThisFocused = isFocused && focusedSessionId === s.id;
            const hidden = (!isFocused && viewMode === 'grid') || (isFocused && !isThisFocused);
            const exp = (expandedSessions[s.id] && layoutMode === 'accordion') || isThisFocused;
            return (
            <motion.div key={s.id} layout
              className="flex flex-col min-h-0 transition-[flex-grow] duration-300 ease-in-out"
              style={{
                display: hidden ? 'none' : undefined,
                flexGrow: exp ? 1 : 0,
                flexShrink: exp ? 1 : 0,
                flexBasis: exp ? '0%' : 'auto',
              }}
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: hidden ? 0 : 1, y: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: hidden ? 0 : 0.25, ease: 'easeOut' }}
            >
              <ErrorBoundary>
                <SessionBlock {...sessionBlockProps(s)} highlighted={highlightIds.has(s.id)} scrollMode={layoutMode === 'scroll'} onToggleExpanded={handleToggleExpanded} shortcutIndex={shortcutMap[s.id]} />
              </ErrorBoundary>
            </motion.div>
            );
          })}
        </AnimatePresence>
        {!isFocused && viewMode !== 'grid' && terminatedSessions.length > 0 && (
          <TerminatedSection sessions={terminatedSessions} layoutMode={layoutMode}>
            {(s) => (
              <ErrorBoundary key={s.id}>
                <SessionBlock {...sessionBlockProps(s)} scrollMode={layoutMode === 'scroll'} onToggleExpanded={handleToggleExpanded} />
              </ErrorBoundary>
            )}
          </TerminatedSection>
        )}
      </div>
    </div>
  );
}
