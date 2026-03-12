import { useEffect, useState } from 'react';
import { useSessionStore } from '../stores/sessionStore';

const DEFAULT_DAILY_BUDGET = 10; // USD

interface TodaySummary {
  cost: number;
  inputTokens: number;
  outputTokens: number;
  calls: number;
}

export default function QuotaGauge() {
  const [today, setToday] = useState<TodaySummary | null>(null);
  const [budget] = useState(DEFAULT_DAILY_BUDGET);
  const sessionUsage = useSessionStore((s) => s.sessionUsage);

  // Fetch today's summary on mount and whenever sessionUsage changes (new usage recorded)
  useEffect(() => {
    const load = () =>
      fetch('/api/usage/today')
        .then((r) => r.json())
        .then(setToday)
        .catch(() => {});
    load();
  }, [Object.keys(sessionUsage).length]);

  if (!today || today.cost === 0) return null;

  const pct = Math.min(100, Math.round((today.cost / budget) * 100));
  const barColor = pct > 80 ? 'bg-red-500' : pct > 50 ? 'bg-yellow-500' : 'bg-green-500';
  const warn = pct > 80;

  return (
    <div className="flex items-center gap-2" title={`Today: $${today.cost.toFixed(4)} / $${budget} budget`}>
      <div className="flex items-center gap-1.5 min-w-[80px]">
        <div className="w-16 h-1.5 bg-gray-800 rounded-full overflow-hidden">
          <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
        </div>
        <span className={`text-[10px] font-mono ${warn ? 'text-red-400' : 'text-gray-500'}`}>
          ${today.cost.toFixed(2)}
        </span>
      </div>
    </div>
  );
}
