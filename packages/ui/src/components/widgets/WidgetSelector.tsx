import { useWidgetStore, AVAILABLE_WIDGETS } from '../../stores/widgetStore';
import { Settings, Check } from 'lucide-react';
import { useState } from 'react';

interface Props {
  sessionId: string;
}

export default function WidgetSelector({ sessionId }: Props) {
  const [open, setOpen] = useState(false);
  const toggleWidget = useWidgetStore((s) => s.toggleWidget);
  const setWidgetSize = useWidgetStore((s) => s.setWidgetSize);
  const enabled = useWidgetStore((s) => s.sessionWidgets[sessionId] ?? s.defaultWidgets);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="p-1 text-gray-500 hover:text-gray-300 hover:bg-gray-800 rounded transition-colors"
        title="Configure widgets"
      >
        <Settings size={14} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-8 z-50 bg-gray-900 border border-gray-700 rounded-lg shadow-xl p-2 w-64">
            <p className="text-xs text-gray-500 px-2 py-1 mb-1">Widgets</p>
            {AVAILABLE_WIDGETS.map((w) => {
              const config = enabled.find((wc) => wc.id === w.id);
              const isEnabled = !!config;
              const size = config?.size ?? 'sm';

              return (
                <div key={w.id} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-gray-800 transition-colors">
                  {/* Checkbox toggle */}
                  <button
                    onClick={() => toggleWidget(sessionId, w.id)}
                    className="flex items-center gap-2 flex-1 min-w-0 text-left"
                  >
                    <span className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                      isEnabled ? 'bg-blue-600 border-blue-500' : 'border-gray-600'
                    }`}>
                      {isEnabled && <Check size={10} />}
                    </span>
                    <div className="min-w-0">
                      <div className="text-sm text-gray-200">{w.name}</div>
                      <div className="text-xs text-gray-500 truncate">{w.description}</div>
                    </div>
                  </button>

                  {/* S / L size toggle — only when enabled */}
                  {isEnabled && (
                    <div
                      className="flex bg-gray-800 rounded overflow-hidden shrink-0"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        onClick={() => setWidgetSize(sessionId, w.id, 'sm')}
                        className={`px-1.5 py-0.5 text-xs font-mono transition-colors ${
                          size === 'sm' ? 'bg-gray-600 text-white' : 'text-gray-500 hover:text-gray-300'
                        }`}
                        title="Compact"
                      >
                        S
                      </button>
                      <button
                        onClick={() => setWidgetSize(sessionId, w.id, 'lg')}
                        className={`px-1.5 py-0.5 text-xs font-mono transition-colors ${
                          size === 'lg' ? 'bg-gray-600 text-white' : 'text-gray-500 hover:text-gray-300'
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
