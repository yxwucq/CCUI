import { useState, useEffect } from 'react';
import { fetchProjectInfo, fetchGitBranches } from '../api/projects';
import { GitBranch, AlertTriangle } from 'lucide-react';
import type { AgentConfig, Session } from '@ccui/shared';

interface Props {
  onClose: () => void;
  agents: AgentConfig[];
  fetchAgents: () => Promise<void>;
  createSession: (projectPath: string, opts?: { agentId?: string; branch?: string; name?: string; skipPermissions?: boolean }) => Promise<Session>;
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
      });
      onClose();
    } catch (err: any) {
      alert(`Failed to create session: ${err.message}`);
    } finally {
      setCreating(false);
    }
  };

  return (
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
            onClick={onClose}
            className="bg-gray-700 hover:bg-gray-600 px-4 py-1.5 rounded text-sm transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
