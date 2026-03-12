import { useEffect, useState } from 'react';
import { DollarSign } from 'lucide-react';

interface Props {
  sessionId: string;
}

interface SessionUsage {
  totalCost: number;
  inputTokens: number;
  outputTokens: number;
  requests: number;
  model: string;
}

export default function UsageWidget({ sessionId }: Props) {
  const [usage, setUsage] = useState<SessionUsage | null>(null);

  useEffect(() => {
    fetch(`/api/usage/sessions?sessionId=${sessionId}`)
      .then((r) => r.json())
      .then((records: any[]) => {
        if (!records || !Array.isArray(records)) {
          setUsage({ totalCost: 0, inputTokens: 0, outputTokens: 0, requests: 0, model: '' });
          return;
        }
        const totalCost = records.reduce((s, r) => s + (r.cost || 0), 0);
        const inputTokens = records.reduce((s, r) => s + (r.input_tokens || r.inputTokens || 0), 0);
        const outputTokens = records.reduce((s, r) => s + (r.output_tokens || r.outputTokens || 0), 0);
        const model = records[records.length - 1]?.model || '';
        setUsage({ totalCost, inputTokens, outputTokens, requests: records.length, model });
      })
      .catch(() => setUsage({ totalCost: 0, inputTokens: 0, outputTokens: 0, requests: 0, model: '' }));
  }, [sessionId]);

  if (!usage) return <div className="text-xs text-gray-600">Loading...</div>;

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center gap-2 text-xs text-gray-500 mb-3">
        <DollarSign size={12} />
        <span>Usage</span>
      </div>

      <div className="flex-1 flex flex-col gap-2">
        <div className="bg-gray-800/50 rounded p-3 text-center">
          <div className="text-2xl font-mono text-green-400">${usage.totalCost.toFixed(4)}</div>
          <div className="text-xs text-gray-500">Total cost</div>
        </div>

        <div className="grid grid-cols-2 gap-2 text-center">
          <div className="bg-gray-800/50 rounded p-2">
            <div className="text-sm font-mono text-gray-200">{formatTokens(usage.inputTokens)}</div>
            <div className="text-xs text-gray-500">Input</div>
          </div>
          <div className="bg-gray-800/50 rounded p-2">
            <div className="text-sm font-mono text-gray-200">{formatTokens(usage.outputTokens)}</div>
            <div className="text-xs text-gray-500">Output</div>
          </div>
        </div>

        <div className="text-xs text-gray-500 mt-auto space-y-0.5">
          <div>{usage.requests} API calls</div>
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
