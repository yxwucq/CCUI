import { useEffect, useState } from 'react';
import { GitBranch, FileEdit, FilePlus, FileMinus, FileQuestion } from 'lucide-react';
import type { Session } from '@ccui/shared';

interface Props {
  sessionId: string;
  session: Session;
}

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

export default function GitStatusWidget({ session }: Props) {
  const [changes, setChanges] = useState<GitChange[]>([]);

  useEffect(() => {
    fetch('/api/projects/git/status')
      .then((r) => r.json())
      .then((lines: string[]) => {
        setChanges(
          lines.map((line) => {
            const code = line.substring(0, 2).trim();
            const file = line.substring(3);
            let status = 'modified';
            if (code === '??' ) status = 'untracked';
            else if (code === 'A' || code === 'AM') status = 'added';
            else if (code === 'D') status = 'deleted';
            return { file, status };
          })
        );
      })
      .catch(() => {});
  }, []);

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center gap-2 text-xs text-gray-500 mb-3">
        <GitBranch size={12} />
        <span>Git Status</span>
      </div>

      <div className="flex items-center gap-2 mb-3">
        <span className="text-sm font-mono text-purple-400 bg-purple-900/20 px-2 py-0.5 rounded">
          {session.branch || 'unknown'}
        </span>
        {session.worktreePath && (
          <span className="text-xs text-gray-600">worktree</span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto space-y-1 min-h-0">
        {changes.length === 0 ? (
          <p className="text-xs text-gray-600">Working tree clean</p>
        ) : (
          <>
            <p className="text-xs text-gray-500 mb-1">{changes.length} changes</p>
            {changes.slice(0, 8).map((c, i) => {
              const Icon = STATUS_ICON[c.status] || FileEdit;
              return (
                <div key={i} className="flex items-center gap-1.5 text-xs">
                  <Icon size={11} className={STATUS_COLOR[c.status] || 'text-gray-400'} />
                  <span className="text-gray-300 truncate">{c.file}</span>
                </div>
              );
            })}
            {changes.length > 8 && (
              <p className="text-xs text-gray-600">+{changes.length - 8} more</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
