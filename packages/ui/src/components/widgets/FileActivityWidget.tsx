import { useEffect, useState, useCallback, useRef } from 'react';
import { Activity, Plus, Minus, FileCode } from 'lucide-react';
import { useContainerHeight, effectiveSize } from '../../hooks/useContainerHeight';
import type { Session } from '@ccui/shared';

interface Props {
  sessionId: string;
  session: Session;
  size: 'sm' | 'lg';
}

interface DiffStat {
  files: { file: string; added: number; deleted: number }[];
  totalAdded: number;
  totalDeleted: number;
  totalFiles: number;
}

const EMPTY_STAT: DiffStat = { files: [], totalAdded: 0, totalDeleted: 0, totalFiles: 0 };

export default function FileActivityWidget({ sessionId, session, size }: Props) {
  const [stat, setStat] = useState<DiffStat>(EMPTY_STAT);
  const [containerRef, containerHeight] = useContainerHeight();
  const renderSize = effectiveSize(size, containerHeight);

  const fetchStat = useCallback(async () => {
    try {
      const res = await fetch(`/api/sessions/${sessionId}/git/diff-stat`);
      if (res.ok) setStat(await res.json());
    } catch { /* ignore */ }
  }, [sessionId]);

  // Fetch on mount
  useEffect(() => { fetchStat(); }, [fetchStat]);

  // Auto-refresh when session goes active → idle (run finished)
  const prevStatusRef = useRef(session.status);
  useEffect(() => {
    const prev = prevStatusRef.current;
    prevStatusRef.current = session.status;
    if (prev === 'active' && session.status === 'idle') {
      fetchStat();
    }
  }, [session.status, fetchStat]);

  const { totalAdded, totalDeleted, totalFiles, files } = stat;
  const hasChanges = totalFiles > 0;

  return (
    <div ref={containerRef} className="h-full flex flex-col">
      <div className="flex items-center gap-2 text-xs font-medium text-cc-text-secondary mb-2">
        <Activity size={12} />
        <span>Impact</span>
      </div>

      {!hasChanges ? (
        <div className="text-xs text-cc-text-muted text-center pt-1">No changes yet</div>
      ) : (
        <>
          {/* Summary line */}
          <div className="flex items-center gap-3 mb-2">
            <span className="flex items-center gap-1 text-xs text-cc-green-text">
              <Plus size={10} />{totalAdded}
            </span>
            <span className="flex items-center gap-1 text-xs text-cc-red-text">
              <Minus size={10} />{totalDeleted}
            </span>
            <span className="flex items-center gap-1 text-xs text-cc-text-secondary">
              <FileCode size={10} />{totalFiles} file{totalFiles !== 1 ? 's' : ''}
            </span>
          </div>

          {/* Per-file breakdown (lg only) */}
          {renderSize === 'lg' && (
            <div className="flex-1 overflow-y-auto space-y-0.5 min-h-0">
              {files.map((f) => (
                <div key={f.file} className="flex items-center gap-1.5 text-xs">
                  <span className="text-cc-green-text w-7 text-right shrink-0">+{f.added}</span>
                  <span className="text-cc-red-text w-7 text-right shrink-0">-{f.deleted}</span>
                  <span className="text-cc-text-secondary truncate font-mono" title={f.file}>
                    {shortPath(f.file)}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* sm: just file list */}
          {renderSize === 'sm' && files.length > 0 && (
            <div className="text-xs text-cc-text-muted truncate">
              {files.slice(0, 3).map((f) => shortName(f.file)).join(', ')}
              {files.length > 3 && ` +${files.length - 3}`}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function shortPath(path: string): string {
  const parts = path.split('/');
  if (parts.length > 3) return '…/' + parts.slice(-2).join('/');
  return path;
}

function shortName(path: string): string {
  return path.split('/').pop() || path;
}
