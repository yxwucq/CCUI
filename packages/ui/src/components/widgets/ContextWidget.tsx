import { useEffect, useMemo } from 'react';
import { Cpu } from 'lucide-react';
import { pctBarColor } from '../../utils';
import { useContainerHeight, effectiveSize } from '../../hooks/useContainerHeight';
import type { ChatMessage } from '@ccui/shared';
import type { SessionUsageSummary } from '../../stores/sessionStore';

interface Props {
  sessionId: string;
  size: 'sm' | 'lg';
  messages: ChatMessage[];
  streaming: string;
  sessionUsage?: SessionUsageSummary;
  fetchSessionUsage: (sessionId: string) => Promise<void>;
}

const MAX_CONTEXT = 200000;

function formatTokens(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

export default function ContextWidget({ sessionId, size, messages, streaming, sessionUsage, fetchSessionUsage }: Props) {
  const [containerRef, containerHeight] = useContainerHeight();
  const renderSize = effectiveSize(size, containerHeight);

  useEffect(() => {
    if (!sessionUsage) fetchSessionUsage(sessionId);
  }, [sessionId, fetchSessionUsage]);

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

  const barColor = pctBarColor(stats.pct);

  return (
    <div ref={containerRef} className="h-full flex flex-col">
      <div className="flex items-center gap-2 text-xs font-medium text-gray-400 mb-2">
        <Cpu size={12} />
        <span>Context</span>
        {stats.isReal && <span className="ml-auto text-green-600 text-xs font-normal">actual</span>}
      </div>

      {/* Progress bar — always shown */}
      <div className={renderSize === 'sm' ? '' : 'mb-3'}>
        <div className="flex justify-between text-xs text-gray-400 mb-1">
          <span>{stats.pct}%</span>
          {renderSize === 'sm' && (
            <span className="text-gray-600">{formatTokens(stats.remaining)} left</span>
          )}
        </div>
        <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${barColor}`}
            style={{ width: `${Math.min(stats.pct, 100)}%` }}
          />
        </div>
      </div>

      {/* lg only: stat boxes */}
      {renderSize === 'lg' && (
        <div className="grid grid-cols-2 gap-2 text-center">
          <div className="bg-gray-800/50 rounded p-2">
            <div className="text-lg font-mono text-gray-200">{formatTokens(stats.usedTokens)}</div>
            <div className="text-xs text-gray-500">Used</div>
          </div>
          <div className="bg-gray-800/50 rounded p-2">
            <div className="text-lg font-mono text-gray-200">{formatTokens(stats.remaining)}</div>
            <div className="text-xs text-gray-500">Left</div>
          </div>
        </div>
      )}
    </div>
  );
}
