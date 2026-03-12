import { useEffect, useState, useCallback } from 'react';
import { useSessionStore } from '../stores/sessionStore';
import { useAgentStore } from '../stores/agentStore';
import SessionBlock from '../components/SessionBlock';
import ErrorBoundary from '../components/ErrorBoundary';
import { Plus, GitBranch, Minimize2 } from 'lucide-react';

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
  const [branches, setBranches] = useState<string[]>([]);
  const [currentBranch, setCurrentBranch] = useState('');
  const [projectPath, setProjectPath] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetchAgents();
    fetchSessions();
    fetch('/api/projects/info')
      .then((r) => r.json())
      .then((info) => setProjectPath(info.path || ''))
      .catch(() => {});
  }, []);

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
      });
      setShowNewSession(false);
      setNewBranch('');
      setNewName('');
      setSelectedAgent('');
    } catch (err: any) {
      alert(`Failed to create session: ${err.message}`);
    } finally {
      setCreating(false);
    }
  };

  const activeSessions = sessions.filter((s) => s.status === 'active' || s.status === 'idle');
  const terminatedSessions = sessions.filter((s) => s.status === 'terminated');
  const isFocused = !!focusedSessionId;
  const focusedSession = isFocused ? sessions.find((s) => s.id === focusedSessionId) : null;

  return (
    <div className="h-full flex flex-col">
      {/* Header — hidden in focus mode */}
      {!isFocused && (
        <div className="border-b border-gray-800 px-5 py-3 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
            <h1 className="text-sm font-semibold text-white">Sessions</h1>
            <span className="text-xs text-gray-500">
              {activeSessions.length} active
            </span>
          </div>
          <button
            onClick={() => setShowNewSession(!showNewSession)}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 px-3 py-1.5 rounded-lg text-xs transition-colors"
          >
            <Plus size={14} /> New Session
          </button>
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
              <div className="flex gap-1">
                <select
                  value={newBranch}
                  onChange={(e) => setNewBranch(e.target.value)}
                  className="bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm focus:outline-none focus:border-blue-500"
                >
                  {branches.map((b) => (
                    <option key={b} value={b}>
                      {b}{b === currentBranch ? ' (current)' : ''}
                    </option>
                  ))}
                </select>
                <input
                  value={newBranch}
                  onChange={(e) => setNewBranch(e.target.value)}
                  placeholder="or type new branch..."
                  className="flex-1 bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm focus:outline-none focus:border-blue-500"
                />
              </div>
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

      {/* Main area — flex column, expanded sessions share space */}
      <div className="flex-1 flex flex-col min-h-0 p-2 gap-1.5">
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

        {/* Normal mode */}
        {!isFocused && (
          <>
            {activeSessions.map((s) => (
              <ErrorBoundary key={s.id}><SessionBlock session={s} /></ErrorBoundary>
            ))}

            {terminatedSessions.length > 0 && (
              <>
                {activeSessions.length > 0 && (
                  <p className="text-[10px] text-gray-600 uppercase tracking-wider pt-0.5 px-1 shrink-0">Terminated</p>
                )}
                {terminatedSessions.map((s) => (
                  <ErrorBoundary key={s.id}><SessionBlock session={s} /></ErrorBoundary>
                ))}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
