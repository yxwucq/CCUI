import { useEffect, useState, useCallback, useRef } from 'react';
import { GitBranch, FileEdit, FilePlus, FileMinus, FileQuestion, RefreshCw, Circle } from 'lucide-react';
import type { Session } from '@ccui/shared';
import { useSessionStore } from '../../stores/sessionStore';
import { useContainerHeight, effectiveSize } from '../../hooks/useContainerHeight';

interface Props {
  sessionId: string;
  session: Session;
  size: 'sm' | 'lg';
}

interface GitStatus {
  staged: { file: string; status: string }[];
  unstaged: { file: string; status: string }[];
  untracked: string[];
}

const EMPTY_STATUS: GitStatus = { staged: [], unstaged: [], untracked: [] };

const STATUS_ICON: Record<string, typeof FileEdit> = {
  modified: FileEdit,
  added: FilePlus,
  deleted: FileMinus,
  renamed: FileEdit,
};
const STATUS_COLOR: Record<string, string> = {
  modified: 'text-yellow-400',
  added: 'text-green-400',
  deleted: 'text-red-400',
  renamed: 'text-blue-400',
};

export default function GitStatusWidget({ sessionId, session, size }: Props) {
  const [status, setStatus] = useState<GitStatus>(EMPTY_STATUS);
  const [refreshing, setRefreshing] = useState(false);
  const [containerRef, containerHeight] = useContainerHeight();
  const renderSize = effectiveSize(size, containerHeight);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch(`/api/sessions/${sessionId}/git/status`);
      if (res.ok) setStatus(await res.json());
    } catch { /* ignore */ }
  }, [sessionId]);

  // Fetch on mount
  useEffect(() => { fetchStatus(); }, [fetchStatus]);

  // Auto-refresh when session goes active → idle
  const sessionStatus = useSessionStore(
    (s) => s.sessions.find((sess) => sess.id === sessionId)?.status
  );
  const prevStatusRef = useRef(sessionStatus);
  useEffect(() => {
    const prev = prevStatusRef.current;
    prevStatusRef.current = sessionStatus;
    if (prev === 'active' && sessionStatus === 'idle') {
      fetchStatus();
    }
  }, [sessionStatus, fetchStatus]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchStatus();
    setRefreshing(false);
  };

  const { staged, unstaged, untracked } = status;
  const totalCount = staged.length + unstaged.length + untracked.length;
  const isClean = totalCount === 0;

  return (
    <div ref={containerRef} className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
        <GitBranch size={12} />
        <span className="font-mono text-purple-400">{session.branch || '?'}</span>
        {session.worktreePath && <span className="text-[10px] text-gray-600">worktree</span>}
        <button
          onClick={handleRefresh}
          className="ml-auto p-0.5 text-gray-600 hover:text-gray-400 transition-colors"
          title="Refresh"
        >
          <RefreshCw size={10} className={refreshing ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* sm: compact summary */}
      {renderSize === 'sm' && (
        <div className="text-xs text-gray-400">
          {isClean ? (
            <span className="text-green-400">Clean</span>
          ) : (
            <span>
              {staged.length > 0 && <span className="text-green-400">{staged.length} staged</span>}
              {staged.length > 0 && (unstaged.length > 0 || untracked.length > 0) && <span className="text-gray-600"> · </span>}
              {unstaged.length > 0 && <span className="text-yellow-400">{unstaged.length} modified</span>}
              {unstaged.length > 0 && untracked.length > 0 && <span className="text-gray-600"> · </span>}
              {untracked.length > 0 && <span className="text-gray-500">{untracked.length} untracked</span>}
            </span>
          )}
        </div>
      )}

      {/* lg: full grouped list */}
      {renderSize === 'lg' && (
        <div className="flex-1 overflow-y-auto min-h-0 space-y-2">
          {isClean && (
            <p className="text-xs text-gray-600">Working tree clean</p>
          )}

          {staged.length > 0 && (
            <FileGroup label="Staged" labelColor="text-green-500" files={staged} dot="bg-green-500" />
          )}
          {unstaged.length > 0 && (
            <FileGroup label="Changes" labelColor="text-yellow-500" files={unstaged} dot="bg-yellow-500" />
          )}
          {untracked.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 mb-1">
                <span className="w-1.5 h-1.5 rounded-full bg-gray-500 shrink-0" />
                <span className="text-[10px] text-gray-500 uppercase tracking-wider">Untracked</span>
                <span className="text-[10px] text-gray-600">({untracked.length})</span>
              </div>
              {untracked.map((file) => (
                <div key={file} className="flex items-center gap-1.5 text-[11px] py-px pl-3">
                  <FileQuestion size={11} className="text-gray-500 shrink-0" />
                  <span className="text-gray-400 truncate font-mono">{file}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function FileGroup({ label, labelColor, files, dot }: {
  label: string;
  labelColor: string;
  files: { file: string; status: string }[];
  dot: string;
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-1">
        <span className={`w-1.5 h-1.5 rounded-full ${dot} shrink-0`} />
        <span className={`text-[10px] uppercase tracking-wider ${labelColor}`}>{label}</span>
        <span className="text-[10px] text-gray-600">({files.length})</span>
      </div>
      {files.map((f) => {
        const Icon = STATUS_ICON[f.status] || FileEdit;
        const color = STATUS_COLOR[f.status] || 'text-gray-400';
        return (
          <div key={f.file + f.status} className="flex items-center gap-1.5 text-[11px] py-px pl-3">
            <Icon size={11} className={`shrink-0 ${color}`} />
            <span className="text-gray-300 truncate font-mono">{f.file}</span>
          </div>
        );
      })}
    </div>
  );
}
