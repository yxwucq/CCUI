import { AVAILABLE_WIDGETS } from '../../stores/widgetStore';
import type { WidgetConfig } from '../../stores/widgetStore';
import { Settings, Check } from 'lucide-react';
import { useState } from 'react';

interface Props {
  sessionId: string;
  enabled: WidgetConfig[];
  onToggleWidget: (sessionId: string, widgetId: string) => void;
  onSetWidgetSize: (sessionId: string, widgetId: string, size: 'sm' | 'lg') => void;
}

export default function WidgetSelector({ sessionId, enabled, onToggleWidget, onSetWidgetSize }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="p-1 text-cc-text-muted hover:text-cc-text hover:bg-cc-bg-surface rounded transition-colors"
        title="Configure widgets"
      >
        <Settings size={14} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-8 z-50 bg-cc-bg border border-cc-border rounded-lg shadow-xl p-2 w-64">
            <p className="text-xs text-cc-text-muted px-2 py-1 mb-1">Widgets</p>
            {AVAILABLE_WIDGETS.map((w) => {
              const config = enabled.find((wc) => wc.id === w.id);
              const isEnabled = !!config;
              const size = config?.size ?? 'sm';

              return (
                <div key={w.id} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-cc-bg-surface transition-colors">
                  {/* Checkbox toggle */}
                  <button
                    onClick={() => onToggleWidget(sessionId, w.id)}
                    className="flex items-center gap-2 flex-1 min-w-0 text-left"
                  >
                    <span className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                      isEnabled ? 'bg-cc-accent border-cc-accent' : 'border-cc-border'
                    }`}>
                      {isEnabled && <Check size={10} />}
                    </span>
                    <div className="min-w-0">
                      <div className="text-sm text-cc-text">{w.name}</div>
                      <div className="text-xs text-cc-text-muted truncate">{w.description}</div>
                    </div>
                  </button>

                  {/* S / L size toggle — only when enabled */}
                  {isEnabled && (
                    <div
                      className="flex bg-cc-bg-surface rounded overflow-hidden shrink-0"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        onClick={() => onSetWidgetSize(sessionId, w.id, 'sm')}
                        className={`px-1.5 py-0.5 text-xs font-mono transition-colors ${
                          size === 'sm' ? 'bg-cc-bg-overlay text-cc-text' : 'text-cc-text-muted hover:text-cc-text'
                        }`}
                        title="Compact"
                      >
                        S
                      </button>
                      <button
                        onClick={() => onSetWidgetSize(sessionId, w.id, 'lg')}
                        className={`px-1.5 py-0.5 text-xs font-mono transition-colors ${
                          size === 'lg' ? 'bg-cc-bg-overlay text-cc-text' : 'text-cc-text-muted hover:text-cc-text'
                        }`}
                        title="Detailed"
                      >
                        L
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
