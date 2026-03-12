import { useMemo } from 'react';
import { useSessionStore } from '../../stores/sessionStore';
import { Cpu } from 'lucide-react';

interface Props {
  sessionId: string;
}

const MAX_CONTEXT = 200000; // Claude's context window
const EMPTY: never[] = [];

export default function ContextWidget({ sessionId }: Props) {
  const messages = useSessionStore((s) => s.messages[sessionId] ?? EMPTY);
  const streaming = useSessionStore((s) => s.streamingContent[sessionId] ?? '');

  const stats = useMemo(() => {
    // Rough token estimation: ~4 chars per token
    const totalChars = messages.reduce((sum, m) => sum + m.content.length, 0) + streaming.length;
    const estimatedTokens = Math.round(totalChars / 4);
    const remaining = Math.max(0, MAX_CONTEXT - estimatedTokens);
    const pct = Math.round((estimatedTokens / MAX_CONTEXT) * 100);
    return { estimatedTokens, remaining, pct };
  }, [messages, streaming]);

  const barColor = stats.pct > 80 ? 'bg-red-500' : stats.pct > 50 ? 'bg-yellow-500' : 'bg-green-500';

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center gap-2 text-xs text-gray-500 mb-3">
        <Cpu size={12} />
        <span>Context Window</span>
      </div>

      <div className="flex-1 flex flex-col justify-center gap-3">
        <div>
          <div className="flex justify-between text-xs text-gray-400 mb-1">
            <span>{stats.pct}% used</span>
            <span>~{formatTokens(stats.remaining)} left</span>
          </div>
          <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${barColor}`}
              style={{ width: `${Math.min(stats.pct, 100)}%` }}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 text-center">
          <div className="bg-gray-800/50 rounded p-2">
            <div className="text-lg font-mono text-gray-200">{formatTokens(stats.estimatedTokens)}</div>
            <div className="text-xs text-gray-500">Used</div>
          </div>
          <div className="bg-gray-800/50 rounded p-2">
            <div className="text-lg font-mono text-gray-200">{formatTokens(stats.remaining)}</div>
            <div className="text-xs text-gray-500">Remaining</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function formatTokens(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}
