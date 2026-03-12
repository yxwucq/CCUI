import { useEffect, useState } from 'react';
import FileTree from '../components/FileTree';
import { Save } from 'lucide-react';

export default function Files() {
  const [tree, setTree] = useState<any[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [content, setContent] = useState<string>('');
  const [binary, setBinary] = useState(false);
  const [modified, setModified] = useState(false);

  useEffect(() => {
    fetch('/api/projects/tree').then((r) => r.json()).then(setTree);
  }, []);

  const loadFile = async (path: string) => {
    const res = await fetch(`/api/files?path=${encodeURIComponent(path)}`);
    const data = await res.json();
    setSelectedFile(path);
    setBinary(data.binary);
    setContent(data.content || '');
    setModified(false);
  };

  const saveFile = async () => {
    if (!selectedFile) return;
    await fetch(`/api/files?path=${encodeURIComponent(selectedFile)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    });
    setModified(false);
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        if (modified) saveFile();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [modified, content, selectedFile]);

  return (
    <div className="flex h-full">
      {/* File tree */}
      <div className="w-64 border-r border-gray-800 overflow-y-auto p-2">
        <FileTree nodes={tree} onSelect={loadFile} selectedPath={selectedFile} />
      </div>

      {/* Editor */}
      <div className="flex-1 flex flex-col">
        {selectedFile ? (
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
                Binary file - cannot display
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
          <div className="flex-1 flex items-center justify-center text-gray-600">
            Select a file to view
          </div>
        )}
      </div>
    </div>
  );
}
