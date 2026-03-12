import { useEffect, useState, useCallback, useRef } from 'react';
import { useSessionStore } from '../stores/sessionStore';
import { useAgentStore } from '../stores/agentStore';
import SessionBlock from '../components/SessionBlock';
import SessionOverviewCard from '../components/SessionOverviewCard';
import ErrorBoundary from '../components/ErrorBoundary';
import { Plus, GitBranch, Minimize2, LayoutGrid, List, Search, X, Layers, PanelTop, AlertTriangle, ChevronRight } from 'lucide-react';
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
  const createSession = useSessionStore((s) => s.createSession);
  const fetchSessions = useSessionStore((s) => s.fetchSessions);
  const focusedSessionId = useSessionStore((s) => s.focusedSessionId);
  const toggleFocus = useSessionStore((s) => s.toggleFocus);
  const agents = useAgentStore((s) => s.agents);
  const fetchAgents = useAgentStore((s) => s.fetchAgents);

  const [showNewSession, setShowNewSession] = useState(false);
  const [newBranch, setNewBranch] = useState('');
  const [newName, setNewName] = useState('');
  const [selectedAgent, setSelectedAgent] = useState('');
  const [skipPermissions, setSkipPermissions] = useState(false);
  const [isNewBranch, setIsNewBranch] = useState(false);
  const [branches, setBranches] = useState<string[]>([]);
  const [currentBranch, setCurrentBranch] = useState('');
  const [projectPath, setProjectPath] = useState('');
  const [creating, setCreating] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const viewModeBeforeFocusRef = useRef<'list' | 'grid' | null>(null);
  const [layoutMode, setLayoutMode] = useState<'accordion' | 'scroll'>('accordion');
  const [search, setSearch] = useState('');
  const [highlightIds, setHighlightIds] = useState<ReadonlySet<string>>(new Set());
  const prevStatusesRef = useRef<Record<string, string>>({});

  useEffect(() => {
    fetchAgents();
    fetchSessions();
    fetch('/api/projects/info')
      .then((r) => r.json())
      .then((info) => setProjectPath(info.path || ''))
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
      // Cmd/Ctrl + 1-9: focus session by index
      if ((e.metaKey || e.ctrlKey) && e.key >= '1' && e.key <= '9') {
        e.preventDefault();
        const idx = parseInt(e.key) - 1;
        const allActive = sessions.filter((s) => s.status !== 'terminated');
        if (allActive[idx]) {
          toggleFocus(allActive[idx].id);
        }
      }
      // Esc: exit focus mode (handled globally, not just per-session)
      if (e.key === 'Escape' && focusedSessionId) {
        toggleFocus(focusedSessionId);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [sessions, focusedSessionId, toggleFocus]);

  // Restore viewMode when exiting focus (so grid users return to grid)
  const prevFocusedRef = useRef<string | null>(null);
  useEffect(() => {
    const wasFocused = prevFocusedRef.current;
    prevFocusedRef.current = focusedSessionId;
    // Entering focus → save current viewMode
    if (!wasFocused && focusedSessionId) {
      viewModeBeforeFocusRef.current = viewMode;
    }
    // Exiting focus → restore saved viewMode
    if (wasFocused && !focusedSessionId && viewModeBeforeFocusRef.current) {
      setViewMode(viewModeBeforeFocusRef.current);
      viewModeBeforeFocusRef.current = null;
    }
  }, [focusedSessionId, viewMode]);

  // Fetch branches when opening new session form
  useEffect(() => {
    if (showNewSession) {
      fetch('/api/projects/git/branches')
        .then((r) => r.json())
        .then((data) => {
          setBranches(data.branches || []);
          setCurrentBranch(data.current || '');
          setNewBranch(data.current || '');
        })
        .catch(() => {});
    }
  }, [showNewSession]);

  const handleCreate = async () => {
    if (!projectPath) {
      alert('Project path not loaded yet. Please wait a moment and try again.');
      return;
    }
    setCreating(true);
    try {
      await createSession(projectPath, {
        branch: newBranch || undefined,
        name: newName || undefined,
        agentId: selectedAgent || undefined,
        skipPermissions: skipPermissions || undefined,
      });
      setShowNewSession(false);
      setNewBranch('');
      setNewName('');
      setSelectedAgent('');
      setSkipPermissions(false);
      setIsNewBranch(false);
    } catch (err: any) {
      alert(`Failed to create session: ${err.message}`);
    } finally {
      setCreating(false);
    }
  };

  // Accordion mode: collapse all others before expanding the clicked session
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
            {/* Layout mode: accordion vs scroll */}
            <div className="flex bg-gray-800 rounded p-0.5">
              <button
                onClick={() => setLayoutMode('accordion')}
                className={`p-1 rounded transition-colors ${layoutMode === 'accordion' ? 'bg-gray-600 text-white' : 'text-gray-500 hover:text-gray-300'}`}
                title="Accordion — one session expanded at a time"
              >
                <PanelTop size={13} />
              </button>
              <button
                onClick={() => setLayoutMode('scroll')}
                className={`p-1 rounded transition-colors ${layoutMode === 'scroll' ? 'bg-gray-600 text-white' : 'text-gray-500 hover:text-gray-300'}`}
                title="Scroll — multiple sessions open, scroll to view"
              >
                <Layers size={13} />
              </button>
            </div>
            {/* View mode: list vs grid */}
            <div className="flex bg-gray-800 rounded p-0.5">
              <button
                onClick={() => setViewMode('list')}
                className={`p-1 rounded transition-colors ${viewMode === 'list' ? 'bg-gray-600 text-white' : 'text-gray-500 hover:text-gray-300'}`}
                title="List view"
              >
                <List size={13} />
              </button>
              <button
                onClick={() => setViewMode('grid')}
                className={`p-1 rounded transition-colors ${viewMode === 'grid' ? 'bg-gray-600 text-white' : 'text-gray-500 hover:text-gray-300'}`}
                title="Grid overview"
              >
                <LayoutGrid size={13} />
              </button>
            </div>
            <button
              onClick={() => setShowNewSession(!showNewSession)}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 px-3 py-1.5 rounded-lg text-xs transition-colors"
            >
              <Plus size={14} /> New Session
            </button>
          </div>
        </div>
      )}

      {/* Focus mode bar */}
      {isFocused && focusedSession && (
        <div className="border-b border-gray-800 px-3 py-1.5 flex items-center gap-2 shrink-0 bg-gray-900/50">
          <button
            onClick={() => toggleFocus(focusedSessionId!)}
            className="p-1 text-gray-400 hover:text-white hover:bg-gray-800 rounded transition-colors"
            title="Exit focus mode (Esc)"
          >
            <Minimize2 size={14} />
          </button>
          <span className="text-xs text-gray-500">Focus:</span>
          <span className="text-xs text-white font-medium">{focusedSession.name}</span>
        </div>
      )}

      {/* New session form */}
      {showNewSession && !isFocused && (
        <div className="border-b border-gray-800 px-5 py-3 bg-gray-900/50 shrink-0">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex-1 min-w-[200px]">
              <label className="block text-xs text-gray-500 mb-1">Session Name</label>
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. fix-login-bug"
                className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="min-w-[200px]">
              <label className="block text-xs text-gray-500 mb-1">
                <GitBranch size={12} className="inline mr-1" />
                Branch
              </label>
              {isNewBranch ? (
                <div className="flex gap-1">
                  <input
                    autoFocus
                    value={newBranch}
                    onChange={(e) => setNewBranch(e.target.value)}
                    placeholder="new-branch-name"
                    className="flex-1 bg-gray-800 border border-blue-600 rounded px-3 py-1.5 text-sm focus:outline-none"
                  />
                  <button
                    onClick={() => { setIsNewBranch(false); setNewBranch(currentBranch); }}
                    className="px-2 py-1.5 text-xs text-gray-500 hover:text-gray-300 bg-gray-800 border border-gray-700 rounded transition-colors"
                  >✕</button>
                </div>
              ) : (
                <select
                  value={newBranch}
                  onChange={(e) => {
                    if (e.target.value === '__new__') {
                      setIsNewBranch(true);
                      setNewBranch('');
                    } else {
                      setNewBranch(e.target.value);
                    }
                  }}
                  className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm focus:outline-none focus:border-blue-500"
                >
                  {branches.map((b) => (
                    <option key={b} value={b}>{b}{b === currentBranch ? ' (current)' : ''}</option>
                  ))}
                  <option value="__new__">── Create new branch ──</option>
                </select>
              )}
            </div>

            <div className="min-w-[150px]">
              <label className="block text-xs text-gray-500 mb-1">Agent</label>
              <select
                value={selectedAgent}
                onChange={(e) => setSelectedAgent(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm focus:outline-none focus:border-blue-500"
              >
                <option value="">No agent</option>
                {agents.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>

            <div className="self-end pb-0.5">
              <label className="block text-xs text-gray-500 mb-1">Permissions</label>
              <label className={`flex items-center gap-2 cursor-pointer select-none rounded px-3 py-1.5 transition-colors ${
                skipPermissions
                  ? 'bg-yellow-900/30 border border-yellow-600/50'
                  : 'bg-gray-800 border border-gray-700'
              }`}>
                <input
                  type="checkbox"
                  checked={skipPermissions}
                  onChange={(e) => setSkipPermissions(e.target.checked)}
                  className="w-3.5 h-3.5 accent-yellow-500"
                />
                {skipPermissions && <AlertTriangle size={13} className="text-yellow-500 shrink-0" />}
                <span className={`text-sm ${skipPermissions ? 'text-yellow-400' : 'text-gray-400'}`}>skip permissions</span>
              </label>
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleCreate}
                disabled={creating}
                className="bg-green-600 hover:bg-green-700 disabled:opacity-50 px-4 py-1.5 rounded text-sm transition-colors"
              >
                {creating ? 'Creating...' : 'Create'}
              </button>
              <button
                onClick={() => setShowNewSession(false)}
                className="bg-gray-700 hover:bg-gray-600 px-4 py-1.5 rounded text-sm transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main area — accordion: flex column fills viewport; scroll: overflow-y-auto */}
      <div className={`flex-1 p-2 gap-1.5 ${
        layoutMode === 'scroll'
          ? 'overflow-y-auto flex flex-col'
          : 'flex flex-col min-h-0'
      }`}>
        {sessions.length === 0 && (
          <div className="flex-1 flex items-center justify-center text-gray-600">
            <div className="text-center">
              <p className="text-lg mb-2">No sessions yet</p>
              <p className="text-sm">Click "New Session" to create one and start working.</p>
            </div>
          </div>
        )}

        {/* Focus mode — only show focused session */}
        {isFocused && focusedSession && (
          <ErrorBoundary><SessionBlock session={focusedSession} /></ErrorBoundary>
        )}

        {/* Grid overview mode */}
        {!isFocused && viewMode === 'grid' && (
          <div className="overflow-y-auto flex-1 p-1">
            {sessions.length === 0 && (
              <div className="flex items-center justify-center h-32 text-gray-600 text-sm">
                No sessions yet. Click "New Session" to create one.
              </div>
            )}
            {activeSessions.length > 0 && (
              <>
                <p className="text-xs text-gray-600 uppercase tracking-wider px-1 mb-2">Active</p>
                <div className="grid grid-cols-2 gap-2 mb-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}>
                  {activeSessions.map((s) => (
                    <SessionOverviewCard key={s.id} session={s} onClick={() => toggleFocus(s.id)} />
                  ))}
                </div>
              </>
            )}
            {terminatedSessions.length > 0 && (
              <>
                <p className="text-xs text-gray-600 uppercase tracking-wider px-1 mb-2">Terminated</p>
                <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}>
                  {terminatedSessions.map((s) => (
                    <SessionOverviewCard key={s.id} session={s} onClick={() => toggleFocus(s.id)} />
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* Normal list mode */}
        {!isFocused && viewMode === 'list' && (
          <>
            {activeSessions.map((s) => (
              <ErrorBoundary key={s.id}>
                <SessionBlock
                  session={s}
                  highlighted={highlightIds.has(s.id)}
                  scrollMode={layoutMode === 'scroll'}
                  onToggleExpanded={handleToggleExpanded}
                />
              </ErrorBoundary>
            ))}

            {terminatedSessions.length > 0 && (
              <TerminatedSection
                sessions={terminatedSessions}
                layoutMode={layoutMode}
                onToggleExpanded={handleToggleExpanded}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}
