import type { GitFileStatus } from '@ccui/shared';

interface Props {
  files: GitFileStatus[];
}

const statusColor = {
  modified: 'text-yellow-400 bg-yellow-900/50',
  added: 'text-green-400 bg-green-900/50',
  deleted: 'text-red-400 bg-red-900/50',
  untracked: 'text-gray-400 bg-gray-800',
};

export default function GitStatus({ files }: Props) {
  if (files.length === 0) {
    return <p className="text-sm text-gray-600">No changes</p>;
  }

  return (
    <div className="space-y-1">
      {files.map((f) => (
        <div key={f.file} className="flex items-center gap-2 text-sm">
          <span className={`text-xs font-mono px-1.5 py-0.5 rounded ${statusColor[f.status]}`}>
            {f.status[0].toUpperCase()}
          </span>
          <span className="text-gray-300 truncate">{f.file}</span>
        </div>
      ))}
    </div>
  );
}
