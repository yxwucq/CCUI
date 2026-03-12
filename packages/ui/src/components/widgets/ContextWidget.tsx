import { useEffect, useMemo } from 'react';
import { useSessionStore } from '../../stores/sessionStore';
import { Cpu } from 'lucide-react';

interface Props {
  sessionId: string;
}

const MAX_CONTEXT = 200000;
const EMPTY: never[] = [];

export default function ContextWidget({ sessionId }: Props) {
  const messages = useSessionStore((s) => s.messages[sessionId] ?? EMPTY);
  const streaming = useSessionStore((s) => s.streamingContent[sessionId] ?? '');
  const sessionUsage = useSessionStore((s) => s.sessionUsage[sessionId]);
  const fetchSessionUsage = useSessionStore((s) => s.fetchSessionUsage);

  useEffect(() => {
    if (!sessionUsage) fetchSessionUsage(sessionId);
  }, [sessionId]);

  const stats = useMemo(() => {
    const hasReal = sessionUsage && sessionUsage.latestInputTokens > 0;
    const usedTokens = hasReal
      ? sessionUsage.latestInputTokens
      : Math.round(
          (messages.reduce((sum, m) => sum + m.content.length, 0) + streaming.length) / 4
        );
    const remaining = Math.max(0, MAX_CONTEXT - usedTokens);
    const pct = Math.round((usedTokens / MAX_CONTEXT) * 100);
    return { usedTokens, remaining, pct, isReal: hasReal };
  }, [messages, streaming, sessionUsage]);

  const barColor = stats.pct > 80 ? 'bg-red-500' : stats.pct > 50 ? 'bg-yellow-500' : 'bg-green-500';

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center gap-2 text-xs text-gray-500 mb-3">
        <Cpu size={12} />
        <span>Context Window</span>
        {stats.isReal && (
          <span className="ml-auto text-green-600 text-[10px]">actual</span>
        )}
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
            <div className="text-lg font-mono text-gray-200">{formatTokens(stats.usedTokens)}</div>
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
