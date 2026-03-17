import { useState, useRef, useEffect, useCallback } from 'react';
import { ChevronDown } from 'lucide-react';

export interface SelectOption {
  value: string;
  label: string;
  separator?: boolean;
}

interface Props {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  className?: string;
  placeholder?: string;
}

export default function Select({ value, onChange, options, className = '', placeholder }: Props) {
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.value === value);

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Scroll highlighted item into view
  useEffect(() => {
    if (!open || highlighted < 0) return;
    const list = listRef.current;
    const item = list?.children[highlighted] as HTMLElement | undefined;
    item?.scrollIntoView({ block: 'nearest' });
  }, [highlighted, open]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!open) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
        e.preventDefault();
        setOpen(true);
        const idx = options.findIndex((o) => o.value === value);
        setHighlighted(idx >= 0 ? idx : 0);
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlighted((h) => Math.min(h + 1, options.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlighted((h) => Math.max(h - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (highlighted >= 0 && highlighted < options.length) {
          onChange(options[highlighted].value);
          setOpen(false);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setOpen(false);
        break;
    }
  }, [open, highlighted, options, onChange, value]);

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => {
          setOpen((v) => !v);
          if (!open) {
            const idx = options.findIndex((o) => o.value === value);
            setHighlighted(idx >= 0 ? idx : 0);
          }
        }}
        onKeyDown={handleKeyDown}
        className="w-full flex items-center justify-between gap-2 bg-cc-bg-surface border border-cc-border rounded px-3 py-1.5 text-sm text-cc-text-secondary focus:outline-none focus:border-cc-accent transition-colors"
      >
        <span className="truncate text-left">
          {selected ? selected.label : (placeholder || 'Select...')}
        </span>
        <ChevronDown size={14} className={`shrink-0 text-cc-text-muted transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div
          ref={listRef}
          className="absolute z-50 mt-1 w-full min-w-[180px] max-h-60 overflow-y-auto bg-cc-bg-surface border border-cc-border rounded shadow-lg py-1"
        >
          {options.map((opt, i) => (
            <div
              key={opt.value}
              onClick={() => {
                onChange(opt.value);
                setOpen(false);
              }}
              onMouseEnter={() => setHighlighted(i)}
              className={`px-3 py-1.5 text-sm cursor-pointer transition-colors truncate ${
                opt.separator ? 'border-t border-cc-border mt-1 pt-2' : ''
              } ${
                opt.value === value
                  ? 'text-cc-accent bg-cc-accent/10'
                  : highlighted === i
                    ? 'bg-cc-bg-overlay text-cc-text'
                    : 'text-cc-text-secondary hover:bg-cc-bg-overlay'
              }`}
            >
              {opt.label}
            </div>
          ))}
          {options.length === 0 && (
            <div className="px-3 py-1.5 text-sm text-cc-text-muted">No options</div>
          )}
        </div>
      )}
    </div>
  );
}
