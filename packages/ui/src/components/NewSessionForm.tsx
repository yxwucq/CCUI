import { useState, useEffect, useMemo } from 'react';
import { fetchProjectInfo, fetchGitBranches } from '../api/projects';
import { GitBranch, AlertTriangle, Link2, GitFork } from 'lucide-react';
import type { AgentConfig, Session } from '@ccui/shared';
import { useSessionStore } from '../stores/sessionStore';
import Select from './Select';

interface Props {
  onClose: () => void;
  agents: AgentConfig[];
  fetchAgents: () => Promise<void>;
  createSession: (projectPath: string, opts?: { agentId?: string; branch?: string; name?: string; skipPermissions?: boolean; sessionType?: 'fork' | 'attach' }) => Promise<Session>;
}

export default function NewSessionForm({ onClose, agents, fetchAgents, createSession }: Props) {

  const [newBranch, setNewBranch] = useState('');
  const [newName, setNewName] = useState('');
  const [selectedAgent, setSelectedAgent] = useState('');
  const [skipPermissions, setSkipPermissions] = useState(false);
  const [isNewBranch, setIsNewBranch] = useState(false);
  const [branches, setBranches] = useState<string[]>([]);
  const [currentBranch, setCurrentBranch] = useState('');
  const [projectPath, setProjectPath] = useState('');
  const [creating, setCreating] = useState(false);
  const [sessionType, setSessionType] = useState<'fork' | 'attach'>('attach');
  const sessions = useSessionStore((s) => s.sessions);

  // Warn when attaching to a branch that already has active sessions
  const branchConflict = useMemo(() => {
    if (isNewBranch || sessionType !== 'attach' || !newBranch) return null;
    const existing = sessions.filter(
      (s) => s.branch === newBranch && s.status !== 'terminated'
    );
    return existing.length > 0 ? existing : null;
  }, [sessions, newBranch, sessionType, isNewBranch]);

  useEffect(() => {
    fetchAgents();
    fetchProjectInfo()
      .then((info) => setProjectPath(info.path || ''))
      .catch(() => {});
    fetchGitBranches()
      .then((data) => {
        setBranches(data.branches || []);
        setCurrentBranch(data.current || '');
        setNewBranch(data.current || '');
      })
      .catch(() => {});
  }, []);

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
        sessionType: isNewBranch ? 'fork' : sessionType,
      });
      onClose();
    } catch (err: any) {
      alert(`Failed to create session: ${err.message}`);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="border-b border-cc-border/50 px-5 py-3 shrink-0">
      <div className="flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs text-cc-text-muted mb-1">Session Name</label>
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="e.g. fix-login-bug"
            className="w-full bg-cc-bg-surface border border-cc-border rounded px-3 py-1.5 text-sm focus:outline-none focus:border-cc-accent"
          />
        </div>

        <div className="min-w-[200px]">
          <label className="block text-xs text-cc-text-muted mb-1">
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
                className="flex-1 bg-cc-bg-surface border border-cc-accent rounded px-3 py-1.5 text-sm focus:outline-none"
              />
              <button
                onClick={() => { setIsNewBranch(false); setNewBranch(currentBranch); }}
                className="px-2 py-1.5 text-xs text-cc-text-muted hover:text-cc-text bg-cc-bg-surface border border-cc-border rounded transition-colors"
              >&#x2715;</button>
            </div>
          ) : (
            <Select
              value={newBranch}
              onChange={(v) => {
                if (v === '__new__') {
                  setIsNewBranch(true);
                  setNewBranch('');
                } else {
                  setNewBranch(v);
                }
              }}
              options={[
                ...branches.filter((b) => !b.includes('--ccui-')).map((b) => ({
                  value: b,
                  label: `${b}${b === currentBranch ? ' (current)' : ''}`,
                })),
                { value: '__new__', label: '── Create new branch ──', separator: true },
              ]}
            />
          )}
        </div>

        {/* Session type toggle — hidden when creating new branch (always fork) */}
        {!isNewBranch && (
          <div>
            <label className="block text-xs text-cc-text-muted mb-1">Mode</label>
            <div className="flex bg-cc-bg-surface border border-cc-border rounded overflow-hidden">
              <button
                type="button"
                onClick={() => setSessionType('attach')}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-sm transition-colors ${
                  sessionType === 'attach'
                    ? 'bg-cc-blue-bg text-cc-blue-text'
                    : 'text-cc-text-muted hover:text-cc-text-secondary'
                }`}
                title="Work directly on the selected branch"
              >
                <Link2 size={13} />
                Attach
              </button>
              <button
                type="button"
                onClick={() => setSessionType('fork')}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-sm transition-colors ${
                  sessionType === 'fork'
                    ? 'bg-cc-purple-bg text-cc-purple-text'
                    : 'text-cc-text-muted hover:text-cc-text-secondary'
                }`}
                title="Create a new branch forked from the selected branch"
              >
                <GitFork size={13} />
                Fork
              </button>
            </div>
          </div>
        )}

        <div className="min-w-[150px]">
          <label className="block text-xs text-cc-text-muted mb-1">Agent</label>
          <Select
            value={selectedAgent}
            onChange={(v) => setSelectedAgent(v)}
            options={[
              { value: '', label: 'No agent' },
              ...agents.map((a) => ({ value: a.id, label: a.name })),
            ]}
          />
        </div>

        <div>
          <label className="block text-xs text-cc-text-muted mb-1">Permissions</label>
          <label className={`flex items-center gap-2 cursor-pointer select-none rounded px-3 py-1.5 transition-colors ${
            skipPermissions
              ? 'bg-cc-yellow-bg border border-cc-yellow-border'
              : 'bg-cc-bg-surface border border-cc-border'
          }`}>
            <input
              type="checkbox"
              checked={skipPermissions}
              onChange={(e) => setSkipPermissions(e.target.checked)}
              className="w-3.5 h-3.5 accent-yellow-500"
            />
            {skipPermissions && <AlertTriangle size={13} className="text-cc-yellow-text shrink-0" />}
            <span className={`text-sm ${skipPermissions ? 'text-cc-yellow-text' : 'text-cc-text-secondary'}`}>skip permissions</span>
          </label>
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleCreate}
            disabled={creating}
            className="bg-cc-green-text hover:bg-cc-green-text disabled:opacity-50 px-4 py-1.5 rounded text-sm transition-colors"
          >
            {creating ? 'Creating...' : 'Create'}
          </button>
          <button
            onClick={onClose}
            className="bg-cc-bg-overlay hover:bg-cc-bg-overlay px-4 py-1.5 rounded text-sm transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
      {branchConflict && (
        <div className="flex items-center gap-2 mt-2 px-3 py-2 bg-cc-yellow-bg border border-cc-yellow-border rounded text-xs text-cc-yellow-text">
          <AlertTriangle size={13} className="shrink-0" />
          <span>
            Branch <strong>{newBranch}</strong> already has {branchConflict.length} active session{branchConflict.length > 1 ? 's' : ''} ({branchConflict.map((s) => s.name).join(', ')}). They will share the same working directory.
          </span>
        </div>
      )}
    </div>
  );
}
