import { useEffect, useRef, useState } from 'react';
import { useToastStore } from '../stores/toastStore';
import { useWidgetStore } from '../stores/widgetStore';
import { pctBarColor } from '../utils';

interface TodaySummary {
  cost: number;
  calls: number;
}

interface Props {
  usageRefreshKey: number;
}

export default function QuotaGauge({ usageRefreshKey }: Props) {
  const dailyBudget = useWidgetStore((s) => s.dailyBudget);
  const alertAt = useWidgetStore((s) => s.alertAt);
  const setQuota = useWidgetStore((s) => s.setQuota);

  const [today, setToday] = useState<TodaySummary | null>(null);
  const [editing, setEditing] = useState(false);
  const prevPctRef = useRef<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch('/api/usage/today')
      .then((r) => r.json())
      .then((data: TodaySummary) => {
        setToday(data);
        const pct = Math.min(100, Math.round((data.cost / dailyBudget) * 100));
        const alertPct = Math.round(alertAt * 100);
        if (prevPctRef.current !== null && prevPctRef.current <= alertPct && pct > alertPct) {
          useToastStore.getState().addToast(
            'warning',
            `Daily budget at ${alertPct}%`,
            `$${data.cost.toFixed(2)} / $${dailyBudget} used today`,
          );
        }
        prevPctRef.current = pct;
      })
      .catch(() => {});
  }, [usageRefreshKey, dailyBudget, alertAt]);

  // Auto-select input on edit start
  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  if (!today) return null;

  const pct = Math.min(100, Math.round((today.cost / dailyBudget) * 100));
  const alertPct = Math.round(alertAt * 100);
  const warn = pct > alertPct;

  const commitBudget = () => {
    const val = parseFloat(inputRef.current?.value || '');
    if (!isNaN(val) && val > 0) setQuota(val);
    setEditing(false);
  };

  return (
    <div
      className="flex items-center gap-1.5"
      title={`Today: $${today.cost.toFixed(4)} / $${dailyBudget} budget`}
    >
      <div className="w-16 h-1.5 bg-cc-bg-surface rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${pctBarColor(pct)}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className={`text-xs font-mono ${warn ? 'text-cc-red-text' : 'text-cc-text-muted'}`}>
        ${today.cost.toFixed(2)}/
      </span>
      {editing ? (
        <input
          ref={inputRef}
          type="number"
          min="0.01"
          step="1"
          defaultValue={dailyBudget}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commitBudget();
            if (e.key === 'Escape') setEditing(false);
          }}
          onBlur={commitBudget}
          className="w-10 bg-transparent border-b border-cc-accent text-xs font-mono text-cc-text px-0 py-0 focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        />
      ) : (
        <span
          className="text-xs font-mono text-cc-text-muted cursor-pointer select-none hover:text-cc-text transition-colors"
          onDoubleClick={() => setEditing(true)}
          title="Double-click to edit daily budget"
        >
          ${dailyBudget}
        </span>
      )}
    </div>
  );
}
