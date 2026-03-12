import { useEffect, useState } from 'react';
import { GitBranch, FileText, Clock, FolderOpen } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import type { ProjectInfo } from '@ccui/shared';

export default function Projects() {
  const [project, setProject] = useState<ProjectInfo | null>(null);

  useEffect(() => {
    fetch('/api/projects/info').then((r) => r.json()).then(setProject);
  }, []);

  if (!project) return <div className="p-6 text-gray-500">Loading...</div>;

  return (
    <div className="p-6 space-y-6">
      {/* Project info card */}
      <div className="bg-gray-900 rounded-lg border border-gray-800 p-6">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2">
              <FolderOpen size={20} className="text-blue-400" />
              {project.name}
            </h2>
            <p className="text-sm text-gray-500 mt-1">{project.path}</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 mt-4">
          {project.gitBranch && (
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <GitBranch size={14} />
              <span>{project.gitBranch}</span>
            </div>
          )}
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <FileText size={14} />
            <span>{project.fileCount} files</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <Clock size={14} />
            <span>{new Date(project.lastModified).toLocaleDateString()}</span>
          </div>
        </div>
      </div>

      {/* Git status */}
      {project.gitStatus && project.gitStatus.length > 0 && (
        <div className="bg-gray-900 rounded-lg border border-gray-800">
          <div className="p-4 border-b border-gray-800">
            <h3 className="text-sm font-medium text-gray-400">Git Changes</h3>
          </div>
          <div className="divide-y divide-gray-800">
            {project.gitStatus.map((f) => (
              <div key={f.file} className="px-4 py-2 flex items-center gap-2 text-sm">
                <span className={`text-xs font-mono px-1.5 py-0.5 rounded ${
                  f.status === 'modified' ? 'bg-yellow-900/50 text-yellow-400' :
                  f.status === 'added' ? 'bg-green-900/50 text-green-400' :
                  f.status === 'deleted' ? 'bg-red-900/50 text-red-400' :
                  'bg-gray-800 text-gray-400'
                }`}>
                  {f.status[0].toUpperCase()}
                </span>
                <span className="text-gray-300">{f.file}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* CLAUDE.md */}
      {project.claudeMd && (
        <div className="bg-gray-900 rounded-lg border border-gray-800">
          <div className="p-4 border-b border-gray-800">
            <h3 className="text-sm font-medium text-gray-400">CLAUDE.md</h3>
          </div>
          <div className="p-4 prose prose-invert prose-sm max-w-none">
            <ReactMarkdown>{project.claudeMd}</ReactMarkdown>
          </div>
        </div>
      )}
    </div>
  );
}
