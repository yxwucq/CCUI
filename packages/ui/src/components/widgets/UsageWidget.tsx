import { useEffect, useRef } from 'react';
import { useSessionStore } from '../../stores/sessionStore';
import { DollarSign } from 'lucide-react';

interface Props {
  sessionId: string;
}

export default function UsageWidget({ sessionId }: Props) {
  const usage = useSessionStore((s) => s.sessionUsage[sessionId]);
  const fetchSessionUsage = useSessionStore((s) => s.fetchSessionUsage);

  useEffect(() => {
    fetchSessionUsage(sessionId);
  }, [sessionId]);

  // Track cost changes to drive the CSS flash animation via key-reset
  const prevCostRef = useRef<string | undefined>(undefined);
  const costKey = usage?.totalCost.toFixed(4) ?? '0';
  const isNewCost = prevCostRef.current !== undefined && prevCostRef.current !== costKey;
  prevCostRef.current = costKey;

  if (!usage) return <div className="text-xs text-gray-600">Loading...</div>;

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center gap-2 text-xs text-gray-500 mb-3">
        <DollarSign size={12} />
        <span>Usage</span>
      </div>

      <div className="flex-1 flex flex-col gap-2">
        <div className="bg-gray-800/50 rounded p-3 text-center">
          {/* key-reset on cost change triggers the CSS animation */}
          <div
            key={isNewCost ? costKey : undefined}
            className={`text-2xl font-mono text-green-400 ${isNewCost ? 'cost-flash' : ''}`}
          >
            ${usage.totalCost.toFixed(4)}
          </div>
          <div className="text-xs text-gray-500">Total cost</div>
        </div>

        <div className="grid grid-cols-2 gap-2 text-center">
          <div className="bg-gray-800/50 rounded p-2">
            <div className="text-sm font-mono text-gray-200">{formatTokens(usage.totalInput)}</div>
            <div className="text-xs text-gray-500">Input</div>
          </div>
          <div className="bg-gray-800/50 rounded p-2">
            <div className="text-sm font-mono text-gray-200">{formatTokens(usage.totalOutput)}</div>
            <div className="text-xs text-gray-500">Output</div>
          </div>
        </div>

        <div className="text-xs text-gray-500 mt-auto space-y-0.5">
          <div>{usage.callCount} API calls</div>
          {usage.model && <div className="truncate">Model: {usage.model}</div>}
        </div>
      </div>
    </div>
  );
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}
