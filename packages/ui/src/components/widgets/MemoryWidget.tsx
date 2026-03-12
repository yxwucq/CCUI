import { useState, useEffect, useRef, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Brain } from 'lucide-react';

interface MemoryEntry {
  filename: string;
  name: string;
  description: string;
  type: string;
  rawContent: string;
}

const TYPE_STYLE: Record<string, string> = {
  user:      'text-blue-400 bg-blue-900/30',
  feedback:  'text-amber-400 bg-amber-900/30',
  project:   'text-green-400 bg-green-900/30',
  reference: 'text-purple-400 bg-purple-900/30',
};

function typeStyle(type: string) {
  return TYPE_STYLE[type] ?? 'text-gray-400 bg-gray-800';
}

/** Strip YAML frontmatter, return just the body for markdown rendering */
function extractBody(raw: string): string {
  const m = raw.match(/^---\n[\s\S]*?\n---\n?([\s\S]*)$/);
  return m ? m[1].trim() : raw;
}

const MD_COMPONENTS = {
  h1: ({ children }: any) => <h1 className="text-sm font-semibold text-gray-100 mb-1 mt-1">{children}</h1>,
  h2: ({ children }: any) => <h2 className="text-xs font-semibold text-gray-200 mb-1 mt-1">{children}</h2>,
  h3: ({ children }: any) => <h3 className="text-xs font-medium text-gray-300 mb-0.5 mt-0.5">{children}</h3>,
  p:  ({ children }: any) => <p className="mb-1.5 text-gray-300 leading-relaxed">{children}</p>,
  ul: ({ children }: any) => <ul className="mb-1.5 space-y-0.5 pl-3">{children}</ul>,
  ol: ({ children }: any) => <ol className="mb-1.5 space-y-0.5 pl-3 list-decimal">{children}</ol>,
  li: ({ children }: any) => <li className="text-gray-300 list-disc">{children}</li>,
  code: ({ children }: any) => <code className="bg-gray-800 px-1 rounded text-[10px] text-green-400 font-mono">{children}</code>,
  pre:  ({ children }: any) => <pre className="bg-gray-800 rounded p-2 mb-1.5 overflow-x-auto text-[10px] font-mono">{children}</pre>,
  strong: ({ children }: any) => <strong className="text-gray-100 font-semibold">{children}</strong>,
  em: ({ children }: any) => <em className="text-gray-400">{children}</em>,
  blockquote: ({ children }: any) => <blockquote className="border-l-2 border-gray-600 pl-2 text-gray-500 italic mb-1.5">{children}</blockquote>,
  a: ({ href, children }: any) => <a href={href} className="text-blue-400 hover:underline" target="_blank" rel="noreferrer">{children}</a>,
  hr: () => <hr className="border-gray-700 my-2" />,
};

type SaveState = 'saved' | 'unsaved' | 'saving';

interface Props {
  sessionId: string;
  size: 'sm' | 'lg';
}

export default function MemoryWidget({ sessionId, size }: Props) {
  const [entries, setEntries] = useState<MemoryEntry[]>([]);
  const [selected, setSelected] = useState<MemoryEntry | null>(null);
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [saveState, setSaveState] = useState<SaveState>('saved');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    fetch(`/api/sessions/${sessionId}/memory`)
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setEntries(data); })
      .catch(() => {});
  }, [sessionId]);

  useEffect(() => {
    if (editing) textareaRef.current?.focus();
  }, [editing]);

  useEffect(() => () => { if (debounceRef.current) clearTimeout(debounceRef.current); }, []);

  const save = useCallback((content: string, entry: MemoryEntry) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setSaveState('saving');
    fetch(`/api/sessions/${sessionId}/memory/${entry.filename}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    })
      .then(() => {
        setSaveState('saved');
        const updated = { ...entry, rawContent: content };
        setEntries((prev) => prev.map((e) => e.filename === entry.filename ? updated : e));
        setSelected((prev) => prev?.filename === entry.filename ? updated : prev);
      })
      .catch(() => setSaveState('unsaved'));
  }, [sessionId]);

  const handleChange = (value: string) => {
    setEditContent(value);
    setSaveState('unsaved');
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (selected) debounceRef.current = setTimeout(() => save(value, selected), 800);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && e.ctrlKey) {
      e.preventDefault();
      if (selected) save(editContent, selected);
      setEditing(false);
    }
    if (e.key === 'Escape') setEditing(false);
  };

  const handleSelect = (entry: MemoryEntry) => {
    if (editing && selected) {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      save(editContent, selected);
    }
    setEditing(false);
    setSelected(entry);
    setEditContent(entry.rawContent);
    setSaveState('saved');
  };

  // sm: compact list only
  if (size === 'sm') {
    return (
      <div className="h-full flex flex-col">
        <div className="flex items-center gap-2 text-xs text-gray-500 mb-2 shrink-0">
          <Brain size={12} />
          <span>Memory</span>
          {entries.length > 0 && <span className="ml-auto text-[10px] text-gray-600">{entries.length}</span>}
        </div>
        <div className="flex-1 overflow-y-auto space-y-0.5">
          {entries.length === 0 ? (
            <div className="text-gray-700 text-[10px] text-center pt-2">No memory</div>
          ) : (
            entries.map((e) => (
              <div key={e.filename} className="flex items-center gap-1.5">
                <span className={`text-[9px] px-1 py-px rounded shrink-0 ${typeStyle(e.type)}`}>
                  {e.type[0].toUpperCase()}
                </span>
                <span className="text-[10px] text-gray-300 truncate">{e.name}</span>
              </div>
            ))
          )}
        </div>
      </div>
    );
  }

  // lg: list + detail editor
  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center gap-2 text-xs text-gray-500 mb-2 shrink-0">
        <Brain size={12} />
        <span>Memory</span>
        {entries.length > 0 && <span className="text-[10px] text-gray-600 ml-0.5">{entries.length}</span>}
        {editing && (
          <span className="ml-auto text-[10px] text-gray-600">Ctrl+Enter · Esc</span>
        )}
        {!editing && saveState !== 'saved' && (
          <span className={`ml-auto text-[10px] ${saveState === 'saving' ? 'text-gray-500' : 'text-yellow-600'}`}>
            {saveState === 'saving' ? 'saving…' : 'unsaved'}
          </span>
        )}
      </div>

      {/* Entry list */}
      <div className="shrink-0 overflow-y-auto space-y-px" style={{ maxHeight: '35%' }}>
        {entries.length === 0 ? (
          <div className="text-gray-700 text-[10px] text-center py-2">No memory entries</div>
        ) : (
          entries.map((e) => (
            <button
              key={e.filename}
              onClick={() => handleSelect(e)}
              className={`w-full text-left flex items-center gap-1.5 px-1.5 py-1 rounded transition-colors ${
                selected?.filename === e.filename ? 'bg-gray-800' : 'hover:bg-gray-800/50'
              }`}
            >
              <span className={`text-[9px] px-1 py-px rounded shrink-0 ${typeStyle(e.type)}`}>
                {e.type[0].toUpperCase()}
              </span>
              <span className="text-[10px] text-gray-300 truncate flex-1">{e.name}</span>
              {e.description && (
                <span className="text-[10px] text-gray-600 truncate max-w-[40%]">{e.description}</span>
              )}
            </button>
          ))
        )}
      </div>

      {/* Detail pane */}
      {selected ? (
        <div className="flex-1 min-h-0 flex flex-col border-t border-gray-800/60 pt-1.5 mt-1">
          <div className="flex items-center gap-1.5 mb-1 shrink-0">
            <span className={`text-[9px] px-1 py-px rounded ${typeStyle(selected.type)}`}>
              {selected.type}
            </span>
            <span className="text-[10px] text-gray-300 font-medium truncate">{selected.name}</span>
          </div>
          <div
            className="flex-1 min-h-0 overflow-y-auto cursor-text"
            onDoubleClick={() => !editing && setEditing(true)}
            title={editing ? undefined : 'Double-click to edit'}
          >
            {editing ? (
              <textarea
                ref={textareaRef}
                value={editContent}
                onChange={(e) => handleChange(e.target.value)}
                onKeyDown={handleKeyDown}
                className="w-full h-full bg-gray-900/50 border border-gray-700 rounded p-2 text-xs text-gray-200 resize-none focus:outline-none focus:border-gray-600 font-mono leading-relaxed"
              />
            ) : (
              <div className="text-[10px]">
                {selected.rawContent ? (
                  <ReactMarkdown remarkPlugins={[remarkGfm]} components={MD_COMPONENTS}>
                    {extractBody(selected.rawContent)}
                  </ReactMarkdown>
                ) : (
                  <span className="text-gray-700">Double-click to edit…</span>
                )}
              </div>
            )}
          </div>
        </div>
      ) : entries.length > 0 ? (
        <div className="flex-1 flex items-center justify-center text-[10px] text-gray-700">
          Select an entry
        </div>
      ) : null}
    </div>
  );
}
