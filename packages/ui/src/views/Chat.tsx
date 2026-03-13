import { useEffect, useState, useCallback, useRef } from 'react';
import { useSessionStore } from '../stores/sessionStore';
import SessionBlock from '../components/SessionBlock';
import SessionOverviewCard from '../components/SessionOverviewCard';
import NewSessionForm from '../components/NewSessionForm';
import ErrorBoundary from '../components/ErrorBoundary';
import { Plus, Minimize2, LayoutGrid, List, Search, X, Layers, PanelTop, ChevronRight } from 'lucide-react';
import { Session } from '@ccui/shared';

function TerminatedSection({ sessions, layoutMode, onToggleExpanded }: {
  sessions: Session[];
  layoutMode: 'accordion' | 'scroll';
  onToggleExpanded: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="shrink-0">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 w-full px-1 py-1 text-xs text-gray-600 uppercase tracking-wider hover:text-gray-500 transition-colors select-none"
      >
        <ChevronRight size={11} className={`transition-transform duration-200 ${open ? 'rotate-90' : ''}`} />
        Terminated ({sessions.length})
      </button>
      {open && (
        <div className="flex flex-col gap-1.5 mt-0.5">
          {sessions.map((s) => (
            <ErrorBoundary key={s.id}>
              <SessionBlock
                session={s}
                scrollMode={layoutMode === 'scroll'}
                onToggleExpanded={onToggleExpanded}
              />
            </ErrorBoundary>
          ))}
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

  const [showNewSession, setShowNewSession] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const viewModeBeforeFocusRef = useRef<'list' | 'grid' | null>(null);
  const [layoutMode, setLayoutMode] = useState<'accordion' | 'scroll'>('accordion');
  const [search, setSearch] = useState('');
  const [highlightIds, setHighlightIds] = useState<ReadonlySet<string>>(new Set());
  const prevStatusesRef = useRef<Record<string, string>>({});

  useEffect(() => { fetchSessions(); }, []);

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
  const activeSessions = filtered.filter((s) => s.status === 'active' || s.status === 'idle');
  const terminatedSessions = filtered.filter((s) => s.status === 'terminated');
  const isFocused = !!focusedSessionId;
  const focusedSession = isFocused ? sessions.find((s) => s.id === focusedSessionId) : null;

  return (
    <div className="h-full flex flex-col">
      {/* Header — hidden in focus mode */}
      {!isFocused && (
        <div className="border-b border-gray-800 px-5 py-3 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <h1 className="text-base font-bold text-white">Sessions</h1>
            <span className="text-xs text-gray-500">{activeSessions.length} active</span>
            <div className="relative">
              <Search size={11} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-600" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Filter…"
                className="bg-gray-800/60 border border-gray-700/50 rounded px-2 py-1 pl-6 text-xs text-gray-300 placeholder-gray-600 focus:outline-none focus:border-gray-600 w-28 focus:w-40 transition-all"
              />
              {search && (
                <button onClick={() => setSearch('')} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-600 hover:text-gray-400">
                  <X size={10} />
                </button>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex bg-gray-800 rounded p-0.5">
              <button onClick={() => setLayoutMode('accordion')} className={`p-1 rounded transition-colors ${layoutMode === 'accordion' ? 'bg-gray-600 text-white' : 'text-gray-500 hover:text-gray-300'}`} title="Accordion">
                <PanelTop size={13} />
              </button>
              <button onClick={() => setLayoutMode('scroll')} className={`p-1 rounded transition-colors ${layoutMode === 'scroll' ? 'bg-gray-600 text-white' : 'text-gray-500 hover:text-gray-300'}`} title="Scroll">
                <Layers size={13} />
              </button>
            </div>
            <div className="flex bg-gray-800 rounded p-0.5">
              <button onClick={() => setViewMode('list')} className={`p-1 rounded transition-colors ${viewMode === 'list' ? 'bg-gray-600 text-white' : 'text-gray-500 hover:text-gray-300'}`} title="List view">
                <List size={13} />
              </button>
              <button onClick={() => setViewMode('grid')} className={`p-1 rounded transition-colors ${viewMode === 'grid' ? 'bg-gray-600 text-white' : 'text-gray-500 hover:text-gray-300'}`} title="Grid overview">
                <LayoutGrid size={13} />
              </button>
            </div>
            <button onClick={() => setShowNewSession(!showNewSession)} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 px-3 py-1.5 rounded-lg text-xs transition-colors">
              <Plus size={14} /> New Session
            </button>
          </div>
        </div>
      )}

      {/* Focus mode bar */}
      {isFocused && focusedSession && (
        <div className="border-b border-gray-800 px-3 py-1.5 flex items-center gap-2 shrink-0 bg-gray-900/50">
          <button onClick={() => toggleFocus(focusedSessionId!)} className="p-1 text-gray-400 hover:text-white hover:bg-gray-800 rounded transition-colors" title="Exit focus mode (Esc)">
            <Minimize2 size={14} />
          </button>
          <span className="text-xs text-gray-500">Focus:</span>
          <span className="text-xs text-white font-medium">{focusedSession.name}</span>
        </div>
      )}

      {/* New session form */}
      {showNewSession && !isFocused && <NewSessionForm onClose={() => setShowNewSession(false)} />}

      {/* Main area */}
      <div className={`flex-1 p-2 gap-1.5 ${layoutMode === 'scroll' ? 'overflow-y-auto flex flex-col' : 'flex flex-col min-h-0'}`}>
        {sessions.length === 0 && (
          <div className="flex-1 flex items-center justify-center text-gray-600">
            <div className="text-center">
              <p className="text-lg mb-2">No sessions yet</p>
              <p className="text-sm">Click "New Session" to create one and start working.</p>
            </div>
          </div>
        )}

        {isFocused && focusedSession && (
          <ErrorBoundary><SessionBlock session={focusedSession} /></ErrorBoundary>
        )}

        {!isFocused && viewMode === 'grid' && (
          <div className="overflow-y-auto flex-1 p-1">
            {sessions.length === 0 && (
              <div className="flex items-center justify-center h-32 text-gray-600 text-sm">No sessions yet. Click "New Session" to create one.</div>
            )}
            {activeSessions.length > 0 && (
              <>
                <p className="text-xs text-gray-600 uppercase tracking-wider px-1 mb-2">Active</p>
                <div className="grid grid-cols-2 gap-2 mb-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}>
                  {activeSessions.map((s) => <SessionOverviewCard key={s.id} session={s} onClick={() => toggleFocus(s.id)} />)}
                </div>
              </>
            )}
            {terminatedSessions.length > 0 && (
              <>
                <p className="text-xs text-gray-600 uppercase tracking-wider px-1 mb-2">Terminated</p>
                <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}>
                  {terminatedSessions.map((s) => <SessionOverviewCard key={s.id} session={s} onClick={() => toggleFocus(s.id)} />)}
                </div>
              </>
            )}
          </div>
        )}

        {!isFocused && viewMode === 'list' && (
          <>
            {activeSessions.map((s) => (
              <ErrorBoundary key={s.id}>
                <SessionBlock session={s} highlighted={highlightIds.has(s.id)} scrollMode={layoutMode === 'scroll'} onToggleExpanded={handleToggleExpanded} />
              </ErrorBoundary>
            ))}
            {terminatedSessions.length > 0 && (
              <TerminatedSection sessions={terminatedSessions} layoutMode={layoutMode} onToggleExpanded={handleToggleExpanded} />
            )}
          </>
        )}
      </div>
    </div>
  );
}
