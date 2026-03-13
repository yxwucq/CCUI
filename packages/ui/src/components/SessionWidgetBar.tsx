import type { Session } from '@ccui/shared';
import { useWidgetStore } from '../stores/widgetStore';
import ContextWidget from './widgets/ContextWidget';
import GitStatusWidget from './widgets/GitStatusWidget';
import HistoryWidget from './widgets/HistoryWidget';
import UsageWidget from './widgets/UsageWidget';
import FileActivityWidget from './widgets/FileActivityWidget';
import NotesWidget from './widgets/NotesWidget';
import MemoryWidget from './widgets/MemoryWidget';

const WIDGET_COMPONENTS: Record<string, React.ComponentType<any>> = {
  context: ContextWidget,
  'git-status': GitStatusWidget,
  history: HistoryWidget,
  usage: UsageWidget,
  'file-activity': FileActivityWidget,
  notes: NotesWidget,
  memory: MemoryWidget,
};

interface Props {
  sessionId: string;
  session: Session;
  emptyMessage?: string;
}

export default function SessionWidgetBar({ sessionId, session, emptyMessage }: Props) {
  const enabledWidgets = useWidgetStore((s) => {
    const sw = s.sessionWidgets[sessionId];
    return sw ?? s.defaultWidgets;
  });

  if (enabledWidgets.length === 0) {
    return emptyMessage ? (
      <div className="flex-1 flex items-center justify-center text-xs text-gray-700">
        {emptyMessage}
      </div>
    ) : null;
  }

  return (
    <>
      {enabledWidgets.map(({ id, size }, idx) => {
        const Widget = WIDGET_COMPONENTS[id];
        if (!Widget) return null;
        return (
          <div
            key={id}
            style={{ flex: size === 'lg' ? 3 : 1 }}
            className={`min-h-0 p-3 overflow-hidden ${
              idx > 0 ? 'border-t border-gray-800/60' : ''
            }`}
          >
            <Widget sessionId={sessionId} session={session} size={size} />
          </div>
        );
      })}
    </>
  );
}
