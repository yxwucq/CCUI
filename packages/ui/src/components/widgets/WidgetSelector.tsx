import { useWidgetStore, AVAILABLE_WIDGETS } from '../../stores/widgetStore';
import { Settings, Check } from 'lucide-react';
import { useState } from 'react';

interface Props {
  sessionId: string;
}

export default function WidgetSelector({ sessionId }: Props) {
  const [open, setOpen] = useState(false);
  const toggleWidget = useWidgetStore((s) => s.toggleWidget);
  const enabled = useWidgetStore((s) => {
    const sw = s.sessionWidgets[sessionId];
    return sw ?? s.defaultWidgets;
  });

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
          <div className="absolute right-0 top-8 z-50 bg-gray-900 border border-gray-700 rounded-lg shadow-xl p-2 w-56">
            <p className="text-xs text-gray-500 px-2 py-1 mb-1">Widgets</p>
            {AVAILABLE_WIDGETS.map((w) => {
              const isEnabled = enabled.includes(w.id);
              return (
                <button
                  key={w.id}
                  onClick={() => toggleWidget(sessionId, w.id)}
                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm text-left hover:bg-gray-800 transition-colors"
                >
                  <span className={`w-4 h-4 rounded border flex items-center justify-center ${
                    isEnabled ? 'bg-blue-600 border-blue-500' : 'border-gray-600'
                  }`}>
                    {isEnabled && <Check size={10} />}
                  </span>
                  <div>
                    <div className="text-gray-200">{w.name}</div>
                    <div className="text-xs text-gray-500">{w.description}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
