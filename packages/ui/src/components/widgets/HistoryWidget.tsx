import { useMemo } from 'react';
import { useSessionStore } from '../../stores/sessionStore';
import { MessageSquare, User, Bot } from 'lucide-react';

interface Props {
  sessionId: string;
}

const EMPTY: never[] = [];

export default function HistoryWidget({ sessionId }: Props) {
  const messages = useSessionStore((s) => s.messages[sessionId] ?? EMPTY);

  const stats = useMemo(() => {
    const userMsgs = messages.filter((m) => m.role === 'user');
    const assistantMsgs = messages.filter((m) => m.role === 'assistant');
    const totalChars = messages.reduce((sum, m) => sum + m.content.length, 0);
    const firstMsg = messages[0];
    const lastMsg = messages[messages.length - 1];
    return {
      total: messages.length,
      user: userMsgs.length,
      assistant: assistantMsgs.length,
      totalChars,
      firstTime: firstMsg?.timestamp,
      lastTime: lastMsg?.timestamp,
    };
  }, [messages]);

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center gap-2 text-xs text-gray-500 mb-3">
        <MessageSquare size={12} />
        <span>History</span>
      </div>

      <div className="flex-1 flex flex-col gap-2">
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="bg-gray-800/50 rounded p-2">
            <div className="text-lg font-mono text-gray-200">{stats.total}</div>
            <div className="text-xs text-gray-500">Total</div>
          </div>
          <div className="bg-gray-800/50 rounded p-2">
            <div className="text-lg font-mono text-blue-400 flex items-center justify-center gap-1">
              <User size={12} /> {stats.user}
            </div>
            <div className="text-xs text-gray-500">You</div>
          </div>
          <div className="bg-gray-800/50 rounded p-2">
            <div className="text-lg font-mono text-purple-400 flex items-center justify-center gap-1">
              <Bot size={12} /> {stats.assistant}
            </div>
            <div className="text-xs text-gray-500">Claude</div>
          </div>
        </div>

        <div className="text-xs text-gray-500 space-y-1 mt-auto">
          {stats.firstTime && (
            <div>Started: {new Date(stats.firstTime).toLocaleString()}</div>
          )}
          {stats.lastTime && (
            <div>Last: {new Date(stats.lastTime).toLocaleString()}</div>
          )}
          <div>~{(stats.totalChars / 4).toFixed(0)} tokens exchanged</div>
        </div>
      </div>
    </div>
  );
}
