import { useEffect, useState } from 'react';
import { GitBranch, FileText, Clock, FolderOpen, GitCommitHorizontal } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import type { ProjectInfo } from '@ccui/shared';
import GitLog from '../components/GitLog';

export default function Projects() {
  const [project, setProject] = useState<ProjectInfo | null>(null);

  useEffect(() => {
    fetch('/api/projects/info').then((r) => r.json()).then(setProject);
  }, []);

  if (!project) return <div className="p-6 text-cc-text-muted">Loading...</div>;

  return (
    <div className="p-6 space-y-6">
      {/* Project info card */}
      <div className="bg-cc-bg rounded-lg border border-cc-border p-6">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2">
              <FolderOpen size={20} className="text-cc-blue-text" />
              {project.name}
            </h2>
            <p className="text-sm text-cc-text-muted mt-1">{project.path}</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 mt-4">
          {project.gitBranch && (
            <div className="flex items-center gap-2 text-sm text-cc-text-secondary">
              <GitBranch size={14} />
              <span>{project.gitBranch}</span>
            </div>
          )}
          <div className="flex items-center gap-2 text-sm text-cc-text-secondary">
            <FileText size={14} />
            <span>{project.fileCount} files</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-cc-text-secondary">
            <Clock size={14} />
            <span>{new Date(project.lastModified).toLocaleDateString()}</span>
          </div>
        </div>
      </div>

      {/* Git status */}
      {project.gitStatus && project.gitStatus.length > 0 && (
        <div className="bg-cc-bg rounded-lg border border-cc-border">
          <div className="p-4 border-b border-cc-border">
            <h3 className="text-sm font-medium text-cc-text-secondary">Git Changes</h3>
          </div>
          <div className="divide-y divide-cc-border">
            {project.gitStatus.map((f) => (
              <div key={f.file} className="px-4 py-2 flex items-center gap-2 text-sm">
                <span className={`text-xs font-mono px-1.5 py-0.5 rounded ${
                  f.status === 'modified' ? 'bg-cc-yellow-bg text-cc-yellow-text' :
                  f.status === 'added' ? 'bg-cc-green-bg text-cc-green-text' :
                  f.status === 'deleted' ? 'bg-cc-red-bg text-cc-red-text' :
                  'bg-cc-bg-surface text-cc-text-secondary'
                }`}>
                  {f.status[0].toUpperCase()}
                </span>
                <span className="text-cc-text-secondary">{f.file}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Git Log */}
      <div className="bg-cc-bg rounded-lg border border-cc-border">
        <div className="p-4 border-b border-cc-border flex items-center gap-2">
          <GitCommitHorizontal size={14} className="text-cc-text-muted" />
          <h3 className="text-sm font-medium text-cc-text-secondary">Git Log</h3>
        </div>
        <div className="overflow-y-auto" style={{ maxHeight: '60vh' }}>
          <GitLog />
        </div>
      </div>

      {/* CLAUDE.md */}
      {project.claudeMd && (
        <div className="bg-cc-bg rounded-lg border border-cc-border">
          <div className="p-4 border-b border-cc-border">
            <h3 className="text-sm font-medium text-cc-text-secondary">CLAUDE.md</h3>
          </div>
          <div className="p-4 prose prose-invert prose-sm max-w-none">
            <ReactMarkdown>{project.claudeMd}</ReactMarkdown>
          </div>
        </div>
      )}
    </div>
  );
}
