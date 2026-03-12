import { useEffect, useState, useCallback, useRef } from 'react';
import { useSessionStore } from '../stores/sessionStore';
import FileTree from '../components/FileTree';
import {
  Save, GitBranch, FolderOpen, FileEdit, FilePlus, FileMinus,
  FileQuestion, ChevronDown, ChevronRight, RefreshCw,
} from 'lucide-react';

interface GitChange {
  file: string;
  status: string;
}

const STATUS_ICON: Record<string, typeof FileEdit> = {
  modified: FileEdit,
  added: FilePlus,
  deleted: FileMinus,
  untracked: FileQuestion,
};
const STATUS_COLOR: Record<string, string> = {
  modified: 'text-yellow-400',
  added: 'text-green-400',
  deleted: 'text-red-400',
  untracked: 'text-gray-500',
};

const EMPTY: never[] = [];

export default function Files() {
  const sessions = useSessionStore((s) => s.sessions);
  const fileActivities = useSessionStore((s) => s.fileActivities);

  // Session selector — pick which worktree to browse
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const activeSessions = sessions.filter((s) => s.status !== 'terminated');
  const selectedSession = activeSessions.find((s) => s.id === selectedSessionId) ?? activeSessions[0] ?? null;

  // File tree
  const [tree, setTree] = useState<any[]>([]);
  const [treeLoading, setTreeLoading] = useState(false);

  // File viewer — selectedFile is relative path (for API), selectedAbsPath for tree highlight
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [selectedAbsPath, setSelectedAbsPath] = useState<string | null>(null);
  const [content, setContent] = useState('');
  const [binary, setBinary] = useState(false);
  const [modified, setModified] = useState(false);

  // Git changes
  const [changes, setChanges] = useState<GitChange[]>([]);
  const [expandedDiff, setExpandedDiff] = useState<string | null>(null);
  const [diffContent, setDiffContent] = useState('');
  const [diffLoading, setDiffLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // View mode: 'tree' (file browser) or 'changes' (git status + diff)
  const [viewMode, setViewMode] = useState<'tree' | 'changes'>('changes');

  const sessionId = selectedSession?.id;

  // Auto-select first session
  useEffect(() => {
    if (!selectedSessionId && activeSessions.length > 0) {
      setSelectedSessionId(activeSessions[0].id);
    }
  }, [activeSessions, selectedSessionId]);

  // Fetch file tree when session changes
  const fetchTree = useCallback(async () => {
    if (!sessionId) return;
    setTreeLoading(true);
    try {
      const res = await fetch(`/api/sessions/${sessionId}/files/tree?depth=4`);
      if (res.ok) setTree(await res.json());
    } catch { /* ignore */ }
    setTreeLoading(false);
  }, [sessionId]);

  // Fetch git changes — flatten grouped status into flat array for change list
  const fetchChanges = useCallback(async () => {
    if (!sessionId) return;
    try {
      const res = await fetch(`/api/sessions/${sessionId}/git/status`);
      if (!res.ok) return;
      const data = await res.json();
      const flat: GitChange[] = [
        ...(data.staged || []),
        ...(data.unstaged || []).filter((u: GitChange) =>
          !(data.staged || []).some((s: GitChange) => s.file === u.file)
        ),
        ...(data.untracked || []).map((f: string) => ({ file: f, status: 'untracked' })),
      ];
      setChanges(flat);
    } catch { /* ignore */ }
  }, [sessionId]);

  // Initial fetch on session change
  useEffect(() => {
    setSelectedFile(null);
    setSelectedAbsPath(null);
    setContent('');
    setModified(false);
    setExpandedDiff(null);
    fetchTree();
    fetchChanges();
  }, [sessionId, fetchTree, fetchChanges]);

  // Real-time: re-fetch when file:activity writes happen for selected session
  const activities = sessionId ? (fileActivities[sessionId] ?? EMPTY) : EMPTY;
  const lastWriteCountRef = useRef(0);
  useEffect(() => {
    const writeCount = activities.filter((a) => a.op === 'write').length;
    if (writeCount <= lastWriteCountRef.current) {
      lastWriteCountRef.current = writeCount;
      return;
    }
    lastWriteCountRef.current = writeCount;
    const timer = setTimeout(() => {
      fetchChanges();
      fetchTree();
    }, 800);
    return () => clearTimeout(timer);
  }, [activities, fetchChanges, fetchTree]);

  // Re-fetch when session goes idle (Claude finished)
  const sessionStatus = selectedSession?.status;
  const prevStatusRef = useRef(sessionStatus);
  useEffect(() => {
    const prev = prevStatusRef.current;
    prevStatusRef.current = sessionStatus;
    if (prev === 'active' && sessionStatus === 'idle') {
      fetchChanges();
      fetchTree();
    }
  }, [sessionStatus, fetchChanges, fetchTree]);

  // Load file content (relative path — strip worktree prefix)
  const loadFile = async (absolutePath: string) => {
    if (!sessionId || !selectedSession) return;
    const cwd = selectedSession.worktreePath || selectedSession.projectPath;
    const relPath = absolutePath.startsWith(cwd)
      ? absolutePath.slice(cwd.length).replace(/^\//, '')
      : absolutePath;
    try {
      const res = await fetch(`/api/sessions/${sessionId}/files?path=${encodeURIComponent(relPath)}`);
      const data = await res.json();
      setSelectedFile(relPath);
      setSelectedAbsPath(absolutePath);
      setBinary(data.binary);
      setContent(data.content || '');
      setModified(false);
    } catch { /* ignore */ }
  };

  const saveFile = async () => {
    if (!selectedFile || !sessionId) return;
    await fetch(`/api/sessions/${sessionId}/files?path=${encodeURIComponent(selectedFile)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    });
    setModified(false);
    fetchChanges();
  };

  // Cmd+S to save
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        if (modified) saveFile();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [modified, content, selectedFile, sessionId]);

  // Load diff for a changed file
  const handleChangedFileClick = async (file: string) => {
    if (expandedDiff === file) {
      setExpandedDiff(null);
      setDiffContent('');
      return;
    }
    setExpandedDiff(file);
    setDiffLoading(true);
    try {
      const res = await fetch(`/api/sessions/${sessionId}/git/diff?path=${encodeURIComponent(file)}`);
      const data = await res.json();
      setDiffContent(data.diff || '(no diff available)');
    } catch {
      setDiffContent('(failed to load diff)');
    }
    setDiffLoading(false);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchChanges(), fetchTree()]);
    setRefreshing(false);
  };

  return (
    <div className="flex h-full flex-col">
      {/* Header: session selector + view mode */}
      <div className="border-b border-gray-800 px-4 py-2 flex items-center gap-3 shrink-0">
        <FolderOpen size={14} className="text-gray-500" />
        <select
          value={sessionId || ''}
          onChange={(e) => setSelectedSessionId(e.target.value)}
          className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm text-gray-300 focus:outline-none focus:border-blue-500"
        >
          {activeSessions.length === 0 && (
            <option value="">No active sessions</option>
          )}
          {activeSessions.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}{s.branch ? ` (${s.branch})` : ''}{s.worktreePath ? ' [worktree]' : ''}
            </option>
          ))}
        </select>

        {selectedSession?.branch && (
          <span className="flex items-center gap-1 text-xs text-purple-400 bg-purple-900/20 px-2 py-0.5 rounded-full">
            <GitBranch size={11} />
            {selectedSession.branch}
          </span>
        )}

        <div className="ml-auto flex items-center gap-1">
          <div className="flex bg-gray-800 rounded p-0.5">
            <button
              onClick={() => setViewMode('changes')}
              className={`px-2 py-0.5 rounded text-xs transition-colors ${viewMode === 'changes' ? 'bg-gray-600 text-white' : 'text-gray-500 hover:text-gray-300'}`}
            >
              Changes{changes.length > 0 ? ` (${changes.length})` : ''}
            </button>
            <button
              onClick={() => setViewMode('tree')}
              className={`px-2 py-0.5 rounded text-xs transition-colors ${viewMode === 'tree' ? 'bg-gray-600 text-white' : 'text-gray-500 hover:text-gray-300'}`}
            >
              Browse
            </button>
          </div>
          <button
            onClick={handleRefresh}
            className="p-1 text-gray-600 hover:text-gray-400 transition-colors"
            title="Refresh"
          >
            <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {!selectedSession ? (
        <div className="flex-1 flex items-center justify-center text-gray-600 text-sm">
          No active sessions. Create a session first.
        </div>
      ) : (
        <div className="flex flex-1 min-h-0">
          {/* Left panel: tree or changes list */}
          <div className="w-72 border-r border-gray-800 overflow-y-auto flex flex-col shrink-0">
            {viewMode === 'tree' && (
              <div className="p-2 flex-1 overflow-y-auto">
                {treeLoading ? (
                  <div className="text-xs text-gray-600 p-2">Loading...</div>
                ) : (
                  <FileTree nodes={tree} onSelect={loadFile} selectedPath={selectedAbsPath} />
                )}
              </div>
            )}

            {viewMode === 'changes' && (
              <div className="p-2 flex-1 overflow-y-auto">
                {changes.length === 0 ? (
                  <div className="text-xs text-gray-600 p-2 text-center">Working tree clean</div>
                ) : (
                  <div className="space-y-0.5">
                    {changes.map((c) => {
                      const Icon = STATUS_ICON[c.status] || FileEdit;
                      const isOpen = expandedDiff === c.file;
                      return (
                        <button
                          key={c.file}
                          onClick={() => handleChangedFileClick(c.file)}
                          className={`w-full flex items-center gap-1.5 text-xs py-1 px-1.5 rounded transition-colors text-left ${isOpen ? 'bg-gray-800' : 'hover:bg-gray-800/50'}`}
                        >
                          {isOpen
                            ? <ChevronDown size={10} className="text-gray-600 shrink-0" />
                            : <ChevronRight size={10} className="text-gray-600 shrink-0" />}
                          <Icon size={11} className={`shrink-0 ${STATUS_COLOR[c.status] || 'text-gray-400'}`} />
                          <span className="text-gray-300 truncate">{c.file}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right panel: file content or diff */}
          <div className="flex-1 flex flex-col min-w-0">
            {viewMode === 'changes' ? (
              // Diff viewer
              expandedDiff ? (
                <>
                  <div className="border-b border-gray-800 px-4 py-2 flex items-center gap-2 shrink-0">
                    <span className="text-sm text-gray-400 truncate">{expandedDiff}</span>
                    <button
                      onClick={() => {
                        // Switch to tree mode and open this file for editing
                        const cwd = selectedSession.worktreePath || selectedSession.projectPath;
                        loadFile(cwd + '/' + expandedDiff);
                        setViewMode('tree');
                      }}
                      className="ml-auto text-xs text-blue-400 hover:text-blue-300 transition-colors"
                    >
                      Open in editor
                    </button>
                  </div>
                  <div className="flex-1 overflow-auto bg-gray-950/50">
                    {diffLoading ? (
                      <div className="p-4 text-sm text-gray-600">Loading diff...</div>
                    ) : (
                      <DiffView diff={diffContent} />
                    )}
                  </div>
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center text-gray-600 text-sm">
                  Select a changed file to view diff
                </div>
              )
            ) : (
              // File editor
              selectedFile ? (
                <>
                  <div className="border-b border-gray-800 px-4 py-2 flex items-center justify-between shrink-0">
                    <span className="text-sm text-gray-400 truncate">{selectedFile}</span>
                    <div className="flex items-center gap-2">
                      {modified && <span className="text-xs text-yellow-400">Modified</span>}
                      <button
                        onClick={saveFile}
                        disabled={!modified}
                        className="flex items-center gap-1 text-xs bg-blue-600 hover:bg-blue-700 disabled:opacity-50 px-2 py-1 rounded transition-colors"
                      >
                        <Save size={12} /> Save
                      </button>
                    </div>
                  </div>
                  {binary ? (
                    <div className="flex-1 flex items-center justify-center text-gray-600">
                      Binary file — cannot display
                    </div>
                  ) : (
                    <textarea
                      value={content}
                      onChange={(e) => {
                        setContent(e.target.value);
                        setModified(true);
                      }}
                      className="flex-1 bg-transparent p-4 font-mono text-sm resize-none focus:outline-none"
                      spellCheck={false}
                    />
                  )}
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center text-gray-600 text-sm">
                  Select a file to view
                </div>
              )
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/** Syntax-highlighted diff viewer */
function DiffView({ diff }: { diff: string }) {
  if (!diff || diff.startsWith('(')) {
    return <div className="p-4 text-sm text-gray-600">{diff}</div>;
  }

  const lines = diff.split('\n');
  return (
    <div className="text-xs font-mono leading-relaxed">
      {lines.map((line, i) => {
        let cls = 'text-gray-500';
        if (line.startsWith('+') && !line.startsWith('+++')) {
          cls = 'text-green-400 bg-green-900/15';
        } else if (line.startsWith('-') && !line.startsWith('---')) {
          cls = 'text-red-400 bg-red-900/15';
        } else if (line.startsWith('@@')) {
          cls = 'text-cyan-400 bg-cyan-900/10';
        } else if (line.startsWith('diff ') || line.startsWith('index ') || line.startsWith('---') || line.startsWith('+++')) {
          cls = 'text-gray-600';
        }
        return (
          <div key={i} className={`px-4 py-px whitespace-pre ${cls}`}>
            {line || ' '}
          </div>
        );
      })}
    </div>
  );
}
