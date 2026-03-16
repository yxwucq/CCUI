import { useState, useEffect } from 'react';
import { fetchProjectInfo, fetchGitBranches } from '../api/projects';
import { GitBranch, AlertTriangle, Link2, GitFork } from 'lucide-react';
import type { AgentConfig, Session } from '@ccui/shared';

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
              className="w-full bg-cc-bg-surface border border-cc-border rounded px-3 py-1.5 text-sm focus:outline-none focus:border-cc-accent"
            >
              {branches.filter((b) => !b.includes('--ccui-')).map((b) => (
                <option key={b} value={b}>{b}{b === currentBranch ? ' (current)' : ''}</option>
              ))}
              <option value="__new__">── Create new branch ──</option>
            </select>
          )}
        </div>

        {/* Session type toggle — hidden when creating new branch (always fork) */}
        {!isNewBranch && (
          <div className="self-end pb-0.5">
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
          <select
            value={selectedAgent}
            onChange={(e) => setSelectedAgent(e.target.value)}
            className="w-full bg-cc-bg-surface border border-cc-border rounded px-3 py-1.5 text-sm focus:outline-none focus:border-cc-accent"
          >
            <option value="">No agent</option>
            {agents.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        </div>

        <div className="self-end pb-0.5">
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
    </div>
  );
}
