import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { ChevronRight } from 'lucide-react';

export interface MenuItem {
  label: string;
  icon?: ReactNode;
  disabled?: boolean;
  children?: MenuItem[];
  customRender?: ReactNode;
  onClick?: () => void;
}

interface Props {
  x: number;
  y: number;
  items: MenuItem[];
  onClose: () => void;
}

function SubMenu({ item, onClose }: { item: MenuItem; onClose: () => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  const enter = () => { clearTimeout(timerRef.current); setOpen(true); };
  const leave = () => { timerRef.current = setTimeout(() => setOpen(false), 150); };

  return (
    <div
      ref={ref}
      className="relative"
      onMouseEnter={enter}
      onMouseLeave={leave}
    >
      <div className="flex items-center justify-between gap-4 px-2.5 py-1.5 text-xs text-cc-text hover:bg-cc-bg-overlay transition-colors cursor-default rounded-sm mx-0.5">
        <span className="flex items-center gap-2">
          {item.icon && <span className="w-3 flex justify-center shrink-0">{item.icon}</span>}
          {item.label}
        </span>
        <ChevronRight size={10} className="text-cc-text-muted" />
      </div>
      {open && (
        <div
          className="absolute left-full top-0 ml-0.5 bg-cc-bg-surface border border-cc-border rounded shadow-lg py-1 z-[60] min-w-[140px]"
          onMouseEnter={enter}
          onMouseLeave={leave}
        >
          {item.children?.map((child) => (
            <button
              key={child.label}
              disabled={child.disabled}
              onClick={() => { child.onClick?.(); onClose(); }}
              className="w-full text-left px-2.5 py-1.5 text-xs text-cc-text hover:bg-cc-bg-overlay transition-colors flex items-center gap-2 disabled:opacity-40 disabled:pointer-events-none rounded-sm mx-0.5"
            >
              {child.icon && <span className="w-3 flex justify-center shrink-0">{child.icon}</span>}
              {child.label}
            </button>
          ))}
          {item.customRender && (
            <div className="border-t border-cc-border mt-1 pt-1 px-2">
              {item.customRender}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function ContextMenu({ x, y, items, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x, y });

  // Adjust position if menu overflows viewport
  useEffect(() => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const nx = x + rect.width > window.innerWidth ? x - rect.width : x;
    const ny = y + rect.height > window.innerHeight ? y - rect.height : y;
    setPos({ x: Math.max(0, nx), y: Math.max(0, ny) });
  }, [x, y]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  return createPortal(
    <div
      ref={ref}
      className="fixed bg-cc-bg-surface border border-cc-border rounded shadow-lg py-1 z-50 min-w-[160px]"
      style={{ left: pos.x, top: pos.y }}
    >
      {items.map((item) => {
        if (item.children) {
          return <SubMenu key={item.label} item={item} onClose={onClose} />;
        }
        return (
          <button
            key={item.label}
            disabled={item.disabled}
            onClick={() => { item.onClick?.(); onClose(); }}
            className="w-full text-left px-2.5 py-1.5 text-xs text-cc-text hover:bg-cc-bg-overlay transition-colors flex items-center gap-2 disabled:opacity-40 disabled:pointer-events-none rounded-sm mx-0.5"
          >
            {item.icon && <span className="w-3 flex justify-center shrink-0">{item.icon}</span>}
            {item.label}
          </button>
        );
      })}
    </div>,
    document.body,
  );
}
