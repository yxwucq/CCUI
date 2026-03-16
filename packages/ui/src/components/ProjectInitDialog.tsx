import { useState, useEffect } from 'react';
import { fetchInitInfo, saveProjectConfig } from '../api/projects';
import { FolderGit2, HardDrive, Loader2 } from 'lucide-react';

interface Props {
  onInitialized: () => void;
}

export default function ProjectInitDialog({ onInitialized }: Props) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [worktreeMode, setWorktreeMode] = useState<'managed' | 'external'>('managed');
  const [externalPath, setExternalPath] = useState('');
  const [hasWorktrees, setHasWorktrees] = useState(false);
  const [detectedBasePath, setDetectedBasePath] = useState('');

  useEffect(() => {
    fetchInitInfo()
      .then((info) => {
        // If worktrees exist outside .ccui, suggest external mode
        const externalWts = info.worktrees.filter(
          (wt) => !wt.path.includes('.ccui/worktrees')
        );
        if (externalWts.length > 0) {
          setHasWorktrees(true);
          // Detect common parent directory
          const paths = externalWts.map((wt) => wt.path);
          const parts = paths[0].split('/');
          let common = '';
          for (let i = 0; i < parts.length - 1; i++) {
            const prefix = parts.slice(0, i + 1).join('/');
            if (paths.every((p) => p.startsWith(prefix + '/'))) {
              common = prefix;
            }
          }
          if (common) {
            setDetectedBasePath(common);
            setExternalPath(common);
            setWorktreeMode('external');
          }
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleInit = async () => {
    setSaving(true);
    try {
      await saveProjectConfig({
        worktreeMode,
        worktreeBasePath: worktreeMode === 'external' ? externalPath : undefined,
      });
      onInitialized();
    } catch (err: any) {
      alert(`Failed to initialize: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
        <div className="bg-cc-bg-card border border-cc-border rounded-xl p-6 w-[420px] text-center">
          <Loader2 size={24} className="animate-spin mx-auto text-cc-text-muted" />
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-cc-bg-card border border-cc-border rounded-xl p-6 w-[420px] shadow-2xl">
        <h2 className="text-lg font-bold text-cc-text mb-1">Project Setup</h2>
        <p className="text-sm text-cc-text-muted mb-5">
          Choose how CCUI manages worktrees for this project.
        </p>

        <div className="flex flex-col gap-3 mb-5">
          {/* Managed mode */}
          <button
            onClick={() => setWorktreeMode('managed')}
            className={`flex items-start gap-3 p-3 rounded-lg border text-left transition-colors ${
              worktreeMode === 'managed'
                ? 'border-cc-accent bg-cc-accent/5'
                : 'border-cc-border hover:border-cc-border/80'
            }`}
          >
            <HardDrive size={18} className={`mt-0.5 shrink-0 ${worktreeMode === 'managed' ? 'text-cc-accent' : 'text-cc-text-muted'}`} />
            <div>
              <div className="text-sm font-medium text-cc-text">Managed</div>
              <div className="text-xs text-cc-text-muted mt-0.5">
                CCUI creates worktrees inside <code className="bg-cc-bg-surface px-1 rounded">.ccui/worktrees/</code>
              </div>
            </div>
          </button>

          {/* External mode */}
          <button
            onClick={() => setWorktreeMode('external')}
            className={`flex items-start gap-3 p-3 rounded-lg border text-left transition-colors ${
              worktreeMode === 'external'
                ? 'border-cc-accent bg-cc-accent/5'
                : 'border-cc-border hover:border-cc-border/80'
            }`}
          >
            <FolderGit2 size={18} className={`mt-0.5 shrink-0 ${worktreeMode === 'external' ? 'text-cc-accent' : 'text-cc-text-muted'}`} />
            <div>
              <div className="text-sm font-medium text-cc-text">External</div>
              <div className="text-xs text-cc-text-muted mt-0.5">
                Create worktrees alongside existing ones in a custom directory
              </div>
              {hasWorktrees && (
                <div className="text-xs text-cc-green-text mt-1">
                  Existing worktrees detected
                </div>
              )}
            </div>
          </button>
        </div>

        {/* External path input */}
        {worktreeMode === 'external' && (
          <div className="mb-5">
            <label className="block text-xs text-cc-text-muted mb-1">Worktree base path</label>
            <input
              value={externalPath}
              onChange={(e) => setExternalPath(e.target.value)}
              placeholder="/path/to/worktrees"
              className="w-full bg-cc-bg-surface border border-cc-border rounded px-3 py-1.5 text-sm focus:outline-none focus:border-cc-accent font-mono"
            />
            {detectedBasePath && (
              <p className="text-xs text-cc-text-muted mt-1">
                Auto-detected from existing worktrees
              </p>
            )}
          </div>
        )}

        <div className="flex justify-end gap-2">
          <button
            onClick={handleInit}
            disabled={saving || (worktreeMode === 'external' && !externalPath)}
            className="bg-cc-accent hover:bg-cc-accent-hover disabled:opacity-50 px-4 py-1.5 rounded-lg text-sm transition-colors"
          >
            {saving ? 'Initializing...' : 'Initialize'}
          </button>
        </div>
      </div>
    </div>
  );
}
