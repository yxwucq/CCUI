import { useEffect, useState } from 'react';
import { useSessionStore } from '../stores/sessionStore';
import { pctBarColor } from '../utils';

const DAILY_BUDGET = 10; // USD

interface TodaySummary {
  cost: number;
  calls: number;
}

export default function QuotaGauge() {
  const [today, setToday] = useState<TodaySummary | null>(null);
  const usageRefreshKey = useSessionStore((s) => s.usageRefreshKey);

  useEffect(() => {
    fetch('/api/usage/today')
      .then((r) => r.json())
      .then(setToday)
      .catch(() => {});
  }, [usageRefreshKey]);

  if (!today || today.cost === 0) return null;

  const pct = Math.min(100, Math.round((today.cost / DAILY_BUDGET) * 100));
  const warn = pct > 80;

  return (
    <div
      className="flex items-center gap-1.5"
      title={`Today: $${today.cost.toFixed(4)} / $${DAILY_BUDGET} budget`}
    >
      <div className="w-16 h-1.5 bg-gray-800 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${pctBarColor(pct)}`} style={{ width: `${pct}%` }} />
      </div>
      <span className={`text-[10px] font-mono ${warn ? 'text-red-400' : 'text-gray-500'}`}>
        ${today.cost.toFixed(2)}
      </span>
    </div>
  );
}
