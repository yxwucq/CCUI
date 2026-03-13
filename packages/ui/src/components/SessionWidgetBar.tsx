import type { Session, ChatMessage } from '@ccui/shared';
import type { WidgetConfig } from '../stores/widgetStore';
import type { SessionUsageSummary } from '../stores/sessionStore';
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
  enabledWidgets: WidgetConfig[];
  messages: ChatMessage[];
  streaming: string;
  sessionUsage?: SessionUsageSummary;
  usageCalls: Array<{ cost: number }>;
  callCount: number;
  fetchSessionUsage: (sessionId: string) => Promise<void>;
  setChatJumpTarget: (sessionId: string, messageId: string) => void;
  emptyMessage?: string;
}

export default function SessionWidgetBar({ sessionId, session, enabledWidgets, messages, streaming, sessionUsage, usageCalls, callCount, fetchSessionUsage, setChatJumpTarget, emptyMessage }: Props) {

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
            <Widget
              sessionId={sessionId}
              session={session}
              size={size}
              messages={messages}
              streaming={streaming}
              sessionUsage={sessionUsage}
              usage={sessionUsage}
              callHistory={usageCalls}
              callCount={callCount}
              fetchSessionUsage={fetchSessionUsage}
              setChatJumpTarget={setChatJumpTarget}
            />
          </div>
        );
      })}
    </>
  );
}
