import { useEffect, useRef, useState } from 'react';
import { useToastStore } from '../stores/toastStore';
import { pctBarColor } from '../utils';

const DAILY_BUDGET = 10; // USD

interface TodaySummary {
  cost: number;
  calls: number;
}

interface Props {
  usageRefreshKey: number;
}

export default function QuotaGauge({ usageRefreshKey }: Props) {
  const [today, setToday] = useState<TodaySummary | null>(null);
  const prevPctRef = useRef<number | null>(null);

  useEffect(() => {
    fetch('/api/usage/today')
      .then((r) => r.json())
      .then((data: TodaySummary) => {
        setToday(data);
        const pct = Math.min(100, Math.round((data.cost / DAILY_BUDGET) * 100));
        if (prevPctRef.current !== null && prevPctRef.current <= 80 && pct > 80) {
          useToastStore.getState().addToast(
            'warning',
            'Daily budget at 80%',
            `$${data.cost.toFixed(2)} / $${DAILY_BUDGET} used today`,
          );
        }
        prevPctRef.current = pct;
      })
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
        <div
          className={`h-full rounded-full transition-all duration-500 ${pctBarColor(pct)}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className={`text-xs font-mono ${warn ? 'text-red-400' : 'text-gray-500'}`}>
        ${today.cost.toFixed(2)}
      </span>
    </div>
  );
}
