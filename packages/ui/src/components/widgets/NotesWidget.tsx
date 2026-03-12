import { useState, useEffect, useRef, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { NotebookPen } from 'lucide-react';
import { useContainerHeight, effectiveSize } from '../../hooks/useContainerHeight';

interface Props {
  sessionId: string;
  size: 'sm' | 'lg';
}

type SaveState = 'saved' | 'unsaved' | 'saving';

export default function NotesWidget({ sessionId, size }: Props) {
  const [notes, setNotes] = useState('');
  const [editing, setEditing] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>('saved');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [containerRef, containerHeight] = useContainerHeight();
  const renderSize = effectiveSize(size, containerHeight);

  useEffect(() => {
    fetch(`/api/sessions/${sessionId}/notes`)
      .then((r) => r.json())
      .then((d) => setNotes(d.notes ?? ''))
      .catch(() => {});
  }, [sessionId]);

  // Focus textarea when entering edit mode
  useEffect(() => {
    if (editing) textareaRef.current?.focus();
  }, [editing]);

  const save = useCallback((value: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setSaveState('saving');
    fetch(`/api/sessions/${sessionId}/notes`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes: value }),
    })
      .then(() => setSaveState('saved'))
      .catch(() => setSaveState('unsaved'));
  }, [sessionId]);

  const handleChange = (value: string) => {
    setNotes(value);
    setSaveState('unsaved');
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => save(value), 800);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && e.ctrlKey) {
      e.preventDefault();
      save(notes);
      setEditing(false);
    }
    if (e.key === 'Escape') {
      setEditing(false);
    }
  };

  useEffect(() => () => { if (debounceRef.current) clearTimeout(debounceRef.current); }, []);

  const mdContent = (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        h1: ({ children }) => <h1 className="text-sm font-semibold text-gray-100 mb-1 mt-1">{children}</h1>,
        h2: ({ children }) => <h2 className="text-xs font-semibold text-gray-200 mb-1 mt-1">{children}</h2>,
        h3: ({ children }) => <h3 className="text-xs font-medium text-gray-300 mb-0.5 mt-0.5">{children}</h3>,
        p: ({ children }) => <p className="mb-1.5 text-gray-300 leading-relaxed">{children}</p>,
        ul: ({ children }) => <ul className="mb-1.5 space-y-0.5 pl-3">{children}</ul>,
        ol: ({ children }) => <ol className="mb-1.5 space-y-0.5 pl-3 list-decimal">{children}</ol>,
        li: ({ children }) => <li className="text-gray-300 list-disc">{children}</li>,
        code: ({ children }) => <code className="bg-gray-800 px-1 rounded text-[10px] text-green-400 font-mono">{children}</code>,
        pre: ({ children }) => <pre className="bg-gray-800 rounded p-2 mb-1.5 overflow-x-auto text-[10px] font-mono">{children}</pre>,
        strong: ({ children }) => <strong className="text-gray-100 font-semibold">{children}</strong>,
        em: ({ children }) => <em className="text-gray-400">{children}</em>,
        blockquote: ({ children }) => <blockquote className="border-l-2 border-gray-600 pl-2 text-gray-500 italic mb-1.5">{children}</blockquote>,
        a: ({ href, children }) => <a href={href} className="text-blue-400 hover:underline" target="_blank" rel="noreferrer">{children}</a>,
        hr: () => <hr className="border-gray-700 my-2" />,
      }}
    >
      {notes}
    </ReactMarkdown>
  );

  return (
    <div ref={containerRef} className="h-full flex flex-col">
      <div className="flex items-center gap-2 text-xs text-gray-500 mb-2 shrink-0">
        <NotebookPen size={12} />
        <span>Notes</span>
        {editing && (
          <span className="ml-auto text-[10px] text-gray-600">Ctrl+Enter to save · Esc to cancel</span>
        )}
        {!editing && saveState !== 'saved' && (
          <span className={`ml-auto text-[10px] ${saveState === 'saving' ? 'text-gray-500' : 'text-yellow-600'}`}>
            {saveState === 'saving' ? 'saving…' : 'unsaved'}
          </span>
        )}
      </div>

      <div
        className="flex-1 min-h-0 flex flex-col"
        onDoubleClick={() => !editing && setEditing(true)}
      >
        {editing ? (
          <textarea
            ref={textareaRef}
            value={notes}
            onChange={(e) => handleChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Write your goals…\n\nSupports **markdown** syntax.`}
            className="flex-1 w-full bg-gray-900/50 border border-gray-700 rounded p-2 text-xs text-gray-200 resize-none focus:outline-none focus:border-gray-600 font-mono leading-relaxed"
          />
        ) : (
          <div
            className={`flex-1 overflow-y-auto cursor-text select-text ${renderSize === 'sm' ? 'overflow-hidden' : ''}`}
            title="Double-click to edit"
          >
            {notes ? (
              <div className={renderSize === 'sm' ? 'line-clamp-4 text-[10px]' : 'text-xs'}>
                {mdContent}
              </div>
            ) : (
              <div className="text-gray-700 text-[10px] text-center pt-2">
                Double-click to add notes…
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
