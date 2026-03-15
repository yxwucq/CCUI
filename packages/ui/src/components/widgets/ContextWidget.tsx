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

const DEFAULT_CONTEXT = 200_000;

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

function contextLabel(n: number): string {
  return n >= 1_000_000 ? `${n / 1_000_000}M` : `${n / 1000}k`;
}

export default function ContextWidget({ sessionId, size, messages, streaming, sessionUsage, fetchSessionUsage }: Props) {
  const [containerRef, containerHeight] = useContainerHeight();
  const renderSize = effectiveSize(size, containerHeight);

  useEffect(() => {
    if (!sessionUsage) fetchSessionUsage(sessionId);
  }, [sessionId, fetchSessionUsage]);

  const maxContext = sessionUsage?.contextWindow ?? DEFAULT_CONTEXT;

  const stats = useMemo(() => {
    const hasReal = sessionUsage && sessionUsage.latestInputTokens > 0;
    const usedTokens = hasReal
      ? sessionUsage.latestInputTokens
      : Math.round(
          (messages.reduce((sum, m) => sum + m.content.length, 0) + streaming.length) / 4
        );
    const remaining = Math.max(0, maxContext - usedTokens);
    const pct = Math.round((usedTokens / maxContext) * 100);
    return { usedTokens, remaining, pct, isReal: hasReal };
  }, [messages, streaming, sessionUsage, maxContext]);

  const barColor = pctBarColor(stats.pct);

  return (
    <div ref={containerRef} className="h-full flex flex-col">
      <div className="flex items-center gap-2 text-xs font-medium text-cc-text-secondary mb-2">
        <Cpu size={12} />
        <span>Context {contextLabel(maxContext)}</span>
        {stats.isReal && <span className="ml-auto text-cc-green-text text-xs font-normal">actual</span>}
      </div>

      {/* Progress bar — always shown */}
      <div className={renderSize === 'sm' ? '' : 'mb-3'}>
        <div className="flex justify-between text-xs text-cc-text-secondary mb-1">
          <span>{stats.pct}%</span>
          {renderSize === 'sm' && (
            <span className="text-cc-text-muted">{formatTokens(stats.remaining)} left</span>
          )}
        </div>
        <div className="h-1.5 bg-cc-bg-surface rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${barColor}`}
            style={{ width: `${Math.min(stats.pct, 100)}%` }}
          />
        </div>
      </div>

      {/* lg only: stat boxes */}
      {renderSize === 'lg' && (
        <div className="grid grid-cols-2 gap-2 text-center">
          <div className="bg-cc-bg-surface/50 rounded p-2">
            <div className="text-lg font-mono text-cc-text">{formatTokens(stats.usedTokens)}</div>
            <div className="text-xs text-cc-text-muted">Used</div>
          </div>
          <div className="bg-cc-bg-surface/50 rounded p-2">
            <div className="text-lg font-mono text-cc-text">{formatTokens(stats.remaining)}</div>
            <div className="text-xs text-cc-text-muted">Left</div>
          </div>
        </div>
      )}
    </div>
  );
}
