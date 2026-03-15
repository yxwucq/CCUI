import { useEffect, useState, useCallback, useRef } from 'react';
import { GitBranch, FileEdit, FilePlus, FileMinus, FileQuestion, RefreshCw } from 'lucide-react';
import type { Session } from '@ccui/shared';
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
  modified: 'text-cc-yellow-text',
  added: 'text-cc-green-text',
  deleted: 'text-cc-red-text',
  renamed: 'text-cc-blue-text',
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
  const prevStatusRef = useRef(session.status);
  useEffect(() => {
    const prev = prevStatusRef.current;
    prevStatusRef.current = session.status;
    if (prev === 'active' && session.status === 'idle') {
      fetchStatus();
    }
  }, [session.status, fetchStatus]);

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
      <div className="flex items-center gap-2 text-xs font-medium text-cc-text-secondary mb-2">
        <GitBranch size={12} />
        <span className="font-mono text-cc-purple-text">{session.branch || '?'}</span>
        {session.worktreePath && <span className="text-xs font-normal text-cc-text-muted">worktree</span>}
        <button
          onClick={handleRefresh}
          className="ml-auto p-0.5 text-cc-text-muted hover:text-cc-text-secondary transition-colors"
          title="Refresh"
        >
          <RefreshCw size={10} className={refreshing ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* sm: compact summary */}
      {renderSize === 'sm' && (
        <div className="text-xs text-cc-text-secondary">
          {isClean ? (
            <span className="text-cc-green-text">Clean</span>
          ) : (
            <span>
              {staged.length > 0 && <span className="text-cc-green-text">{staged.length} staged</span>}
              {staged.length > 0 && (unstaged.length > 0 || untracked.length > 0) && <span className="text-cc-text-muted"> · </span>}
              {unstaged.length > 0 && <span className="text-cc-yellow-text">{unstaged.length} modified</span>}
              {unstaged.length > 0 && untracked.length > 0 && <span className="text-cc-text-muted"> · </span>}
              {untracked.length > 0 && <span className="text-cc-text-muted">{untracked.length} untracked</span>}
            </span>
          )}
        </div>
      )}

      {/* lg: full grouped list */}
      {renderSize === 'lg' && (
        <div className="flex-1 overflow-y-auto min-h-0 space-y-2">
          {isClean && (
            <p className="text-xs text-cc-text-muted">Working tree clean</p>
          )}

          {staged.length > 0 && (
            <FileGroup label="Staged" labelColor="text-cc-green-text" files={staged} dot="bg-cc-green-text" />
          )}
          {unstaged.length > 0 && (
            <FileGroup label="Changes" labelColor="text-cc-yellow-text" files={unstaged} dot="bg-cc-yellow-text" />
          )}
          {untracked.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 mb-1">
                <span className="w-1.5 h-1.5 rounded-full bg-cc-text-muted shrink-0" />
                <span className="text-xs text-cc-text-muted uppercase tracking-wider">Untracked</span>
                <span className="text-xs text-cc-text-muted">({untracked.length})</span>
              </div>
              {untracked.map((file) => (
                <div key={file} className="flex items-center gap-1.5 text-xs py-px pl-3">
                  <FileQuestion size={11} className="text-cc-text-muted shrink-0" />
                  <span className="text-cc-text-secondary truncate font-mono">{file}</span>
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
        <span className={`text-xs uppercase tracking-wider ${labelColor}`}>{label}</span>
        <span className="text-xs text-cc-text-muted">({files.length})</span>
      </div>
      {files.map((f) => {
        const Icon = STATUS_ICON[f.status] || FileEdit;
        const color = STATUS_COLOR[f.status] || 'text-cc-text-secondary';
        return (
          <div key={f.file + f.status} className="flex items-center gap-1.5 text-xs py-px pl-3">
            <Icon size={11} className={`shrink-0 ${color}`} />
            <span className="text-cc-text-secondary truncate font-mono">{f.file}</span>
          </div>
        );
      })}
    </div>
  );
}
