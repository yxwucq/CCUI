import { useEffect, useRef, useMemo } from 'react';
import { DollarSign } from 'lucide-react';
import { AreaChart, Area, ResponsiveContainer, Tooltip } from 'recharts';
import { useContainerHeight, effectiveSize } from '../../hooks/useContainerHeight';
import type { SessionUsageSummary } from '../../stores/sessionStore';

import type { Session } from '@ccui/shared';

interface Props {
  sessionId: string;
  session?: Session;
  size: 'sm' | 'lg';
  usage?: SessionUsageSummary;
  callHistory: Array<{ cost: number }>;
  fetchSessionUsage: (sessionId: string) => Promise<void>;
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

export default function UsageWidget({ sessionId, session, size, usage, callHistory, fetchSessionUsage }: Props) {
  const [containerRef, containerHeight] = useContainerHeight();
  const renderSize = effectiveSize(size, containerHeight);

  useEffect(() => {
    fetchSessionUsage(sessionId);
  }, [sessionId]);

  // Track cost changes for flash animation
  const prevCostRef = useRef<string | undefined>(undefined);
  const costKey = usage?.totalCost.toFixed(4) ?? '0';
  const isNewCost = prevCostRef.current !== undefined && prevCostRef.current !== costKey;
  prevCostRef.current = costKey;

  // Cumulative cost chart data
  const chartData = useMemo(() => {
    let cum = 0;
    return callHistory.map((c, i) => {
      cum += c.cost;
      return { call: i + 1, cost: parseFloat(cum.toFixed(6)) };
    });
  }, [callHistory]);

  if (!usage) return (
    <div ref={containerRef} className="h-full flex flex-col">
      <div className="flex items-center gap-2 text-xs font-medium text-cc-text-secondary mb-2">
        <DollarSign size={12} /><span>Usage</span>
      </div>
      <div className="text-xs text-cc-text-muted">Loading...</div>
    </div>
  );

  return (
    <div ref={containerRef} className="h-full flex flex-col">
      <div className="flex items-center gap-2 text-xs font-medium text-cc-text-secondary mb-2">
        <DollarSign size={12} />
        <span>Usage</span>
      </div>

      {/* Pricing unknown warning */}
      {usage.pricingUnknown && (
        <div className="text-xs text-cc-yellow-text mb-1">
          Unknown pricing: {usage.model}
        </div>
      )}

      {/* Cost row */}
      <div className={`flex items-baseline justify-between ${renderSize === 'sm' ? 'mb-0' : 'mb-2'}`}>
        <div
          key={isNewCost ? costKey : undefined}
          className={`font-mono text-cc-green-text ${isNewCost ? 'cost-flash' : ''} ${renderSize === 'lg' ? 'text-xl' : 'text-lg'}`}
        >
          ${usage.totalCost.toFixed(4)}
          {session?.cliProvider === 'codex' && <span className="text-xs text-cc-text-muted ml-1">(Sub)</span>}
        </div>
        <div className="text-xs text-cc-text-muted">
          {usage.callCount} calls{usage.model ? ` · ${usage.model.split('-').slice(1, 3).join('-')}` : ''}
        </div>
      </div>

      {/* lg only: token grid + chart */}
      {renderSize === 'lg' && (
        <>
          <div className="grid grid-cols-4 gap-1 text-center mb-2">
            {[
              { label: 'In', value: usage.totalInput },
              { label: 'Out', value: usage.totalOutput },
              { label: 'Cache↓', value: usage.totalCacheRead ?? 0 },
              { label: 'Cache↑', value: usage.totalCacheWrite ?? 0 },
            ].map(({ label, value }) => (
              <div key={label} className="bg-cc-bg-surface/50 rounded px-1 py-1.5">
                <div className="text-xs font-mono text-cc-text">{formatTokens(value)}</div>
                <div className="text-xs text-cc-text-muted">{label}</div>
              </div>
            ))}
          </div>

          {/* Cumulative cost chart */}
          {chartData.length > 1 && (
            <div className="flex-1 min-h-0">
              <div className="text-xs text-cc-text-muted mb-1">Cost over time</div>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
                  <defs>
                    <linearGradient id={`cost-grad-${sessionId}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#4ade80" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#4ade80" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <Tooltip
                    contentStyle={{ background: '#111827', border: '1px solid #374151', borderRadius: 4, fontSize: 10 }}
                    formatter={(v: number) => [`$${v.toFixed(4)}`, 'cumulative']}
                    labelFormatter={(l) => `Call ${l}`}
                  />
                  <Area
                    type="monotone"
                    dataKey="cost"
                    stroke="#4ade80"
                    strokeWidth={1.5}
                    fill={`url(#cost-grad-${sessionId})`}
                    dot={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </>
      )}
    </div>
  );
}
