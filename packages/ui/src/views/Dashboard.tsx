import { useEffect, useState } from 'react';
import { useUsageStore } from '../stores/usageStore';
import { X, ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  BarChart, Bar, CartesianGrid, Legend,
} from 'recharts';
import type { SessionUsageRow } from '../stores/usageStore';

function fmtK(n: number) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return String(n ?? 0);
}

type SortKey = 'totalCost' | 'callCount' | 'totalInput' | 'totalOutput';

function SortIcon({ col, sortKey, dir }: { col: SortKey; sortKey: SortKey; dir: 'asc' | 'desc' }) {
  if (col !== sortKey) return <ChevronsUpDown size={11} className="text-cc-text-muted" />;
  return dir === 'desc' ? <ChevronDown size={11} className="text-cc-blue-text" /> : <ChevronUp size={11} className="text-cc-blue-text" />;
}

export default function Dashboard() {
  const {
    summary, daily, modelUsage, perSession,
    range, selectedSessionId,
    setRange, setSelectedSession, fetchAll,
  } = useUsageStore();

  const [sortKey, setSortKey] = useState<SortKey>('totalCost');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  useEffect(() => { fetchAll(); }, []);

  const ranges = [
    { label: '7 Days', value: '7d' },
    { label: '30 Days', value: '30d' },
    { label: 'All', value: 'all' },
  ];

  const selectedSession = selectedSessionId
    ? perSession.find((r) => r.sessionId === selectedSessionId)
    : null;

  // Derived stats
  const totalCalls = perSession.reduce((s, r) => s + r.callCount, 0);
  const totalCost = summary?.totalCost ?? 0;
  const avgCostPerCall = totalCalls > 0 ? totalCost / totalCalls : 0;

  // Cache hit rate per day
  const cacheRateData = daily.map((d: any) => {
    const total = (d.inputTokens ?? 0) + (d.cacheRead ?? 0);
    const rate = total > 0 ? ((d.cacheRead ?? 0) / total) * 100 : 0;
    return { date: d.date, cacheHitRate: parseFloat(rate.toFixed(1)), cacheRead: d.cacheRead ?? 0, cacheWrite: d.cacheWrite ?? 0 };
  });

  // Sorted per-session rows
  const sortedRows = [...perSession].sort((a, b) => {
    const av = a[sortKey] as number;
    const bv = b[sortKey] as number;
    return sortDir === 'desc' ? bv - av : av - bv;
  });

  // Top sessions for cost bar chart (max 10)
  const topSessions = [...perSession]
    .sort((a, b) => b.totalCost - a.totalCost)
    .slice(0, 10)
    .map((r) => ({ name: r.sessionName.length > 16 ? r.sessionName.slice(0, 15) + '…' : r.sessionName, cost: r.totalCost }));

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'));
    else { setSortKey(key); setSortDir('desc'); }
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-bold">Dashboard</h2>
          {selectedSession && (
            <span className="flex items-center gap-1.5 text-sm bg-cc-blue-bg border border-cc-blue-border text-cc-blue-text px-2.5 py-1 rounded-full">
              {selectedSession.sessionName}
              <button onClick={() => setSelectedSession(null)} className="hover:text-cc-text transition-colors" title="Clear filter">
                <X size={12} />
              </button>
            </span>
          )}
        </div>
        <div className="flex gap-1 bg-cc-bg-surface rounded-lg p-0.5">
          {ranges.map((r) => (
            <button
              key={r.value}
              onClick={() => setRange(r.value)}
              className={`px-3 py-1 text-sm rounded-md transition-colors ${range === r.value ? 'bg-cc-bg-overlay text-cc-text' : 'text-cc-text-muted hover:text-cc-text'}`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* Summary cards */}
      {summary && (
        <div className="grid grid-cols-5 gap-4">
          <div className="bg-cc-bg rounded-lg p-4 border border-cc-border">
            <p className="text-xs text-cc-text-muted uppercase">Total Cost</p>
            <p className="text-2xl font-bold mt-1">${totalCost.toFixed(4)}</p>
          </div>
          <div className="bg-cc-bg rounded-lg p-4 border border-cc-border">
            <p className="text-xs text-cc-text-muted uppercase">Input Tokens</p>
            <p className="text-2xl font-bold mt-1">{fmtK(summary.totalInputTokens)}</p>
          </div>
          <div className="bg-cc-bg rounded-lg p-4 border border-cc-border">
            <p className="text-xs text-cc-text-muted uppercase">Output Tokens</p>
            <p className="text-2xl font-bold mt-1">{fmtK(summary.totalOutputTokens)}</p>
          </div>
          <div className="bg-cc-bg rounded-lg p-4 border border-cc-border">
            <p className="text-xs text-cc-text-muted uppercase">{selectedSessionId ? 'API Calls' : 'Sessions'}</p>
            <p className="text-2xl font-bold mt-1">
              {selectedSessionId ? (selectedSession?.callCount ?? 0) : summary.sessionCount}
            </p>
          </div>
          <div className="bg-cc-bg rounded-lg p-4 border border-cc-border">
            <p className="text-xs text-cc-text-muted uppercase">Avg Cost / Call</p>
            <p className="text-2xl font-bold mt-1">${avgCostPerCall.toFixed(4)}</p>
          </div>
        </div>
      )}

      {/* Cost trend (Area) + Token usage side by side */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-cc-bg rounded-lg p-4 border border-cc-border">
          <h3 className="text-sm font-medium text-cc-text-secondary mb-4">Cost Trend</h3>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={daily}>
              <defs>
                <linearGradient id="costGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--cc-border-subtle)" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--cc-text-muted)' }} />
              <YAxis tick={{ fontSize: 10, fill: 'var(--cc-text-muted)' }} />
              <Tooltip contentStyle={{ background: 'var(--cc-bg-surface)', border: '1px solid var(--cc-border)', borderRadius: 8 }} labelStyle={{ color: 'var(--cc-text-secondary)' }} />
              <Area type="monotone" dataKey="cost" stroke="#3b82f6" strokeWidth={2} fill="url(#costGrad)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-cc-bg rounded-lg p-4 border border-cc-border">
          <h3 className="text-sm font-medium text-cc-text-secondary mb-4">Daily Token Usage</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={daily}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--cc-border-subtle)" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--cc-text-muted)' }} />
              <YAxis tick={{ fontSize: 10, fill: 'var(--cc-text-muted)' }} />
              <Tooltip contentStyle={{ background: 'var(--cc-bg-surface)', border: '1px solid var(--cc-border)', borderRadius: 8 }} labelStyle={{ color: 'var(--cc-text-secondary)' }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="inputTokens" name="Input" fill="#3b82f6" stackId="a" />
              <Bar dataKey="outputTokens" name="Output" fill="#10b981" stackId="a" />
              <Bar dataKey="cacheRead" name="Cache Read" fill="#f59e0b" stackId="a" />
              <Bar dataKey="cacheWrite" name="Cache Write" fill="#8b5cf6" stackId="a" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Cache hit rate + Session cost bar chart side by side */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-cc-bg rounded-lg p-4 border border-cc-border">
          <h3 className="text-sm font-medium text-cc-text-secondary mb-1">Cache Hit Rate</h3>
          <p className="text-xs text-cc-text-muted mb-3">cache_read / (cache_read + input) per day</p>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={cacheRateData}>
              <defs>
                <linearGradient id="cacheGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--cc-border-subtle)" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--cc-text-muted)' }} />
              <YAxis unit="%" domain={[0, 100]} tick={{ fontSize: 10, fill: 'var(--cc-text-muted)' }} />
              <Tooltip
                contentStyle={{ background: 'var(--cc-bg-surface)', border: '1px solid var(--cc-border)', borderRadius: 8 }}
                labelStyle={{ color: 'var(--cc-text-secondary)' }}
                formatter={(v: any) => [`${v}%`, 'Cache Hit Rate']}
              />
              <Area type="monotone" dataKey="cacheHitRate" stroke="#f59e0b" strokeWidth={2} fill="url(#cacheGrad)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-cc-bg rounded-lg p-4 border border-cc-border">
          <h3 className="text-sm font-medium text-cc-text-secondary mb-1">Top Sessions by Cost</h3>
          <p className="text-xs text-cc-text-muted mb-3">top {topSessions.length}</p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={topSessions} layout="vertical" margin={{ left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--cc-border-subtle)" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 10, fill: 'var(--cc-text-muted)' }} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: 'var(--cc-text-secondary)' }} width={110} />
              <Tooltip
                contentStyle={{ background: 'var(--cc-bg-surface)', border: '1px solid var(--cc-border)', borderRadius: 8 }}
                labelStyle={{ color: 'var(--cc-text-secondary)' }}
                formatter={(v: any) => [`$${(v as number).toFixed(4)}`, 'Cost']}
              />
              <Bar dataKey="cost" fill="#3b82f6" radius={[0, 3, 3, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Model breakdown */}
      {modelUsage.length > 0 && (
        <div className="bg-cc-bg rounded-lg border border-cc-border">
          <div className="p-4 border-b border-cc-border">
            <h3 className="text-sm font-medium text-cc-text-secondary">Model Breakdown</h3>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-cc-text-muted border-b border-cc-border">
                <th className="text-left px-4 py-2">Model</th>
                <th className="text-right px-4 py-2">Requests</th>
                <th className="text-right px-4 py-2">Input Tokens</th>
                <th className="text-right px-4 py-2">Output Tokens</th>
                <th className="text-right px-4 py-2">Cost</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-cc-border">
              {modelUsage.map((m: any) => (
                <tr key={m.model}>
                  <td className="px-4 py-2 text-cc-text-secondary">{m.model}</td>
                  <td className="px-4 py-2 text-right text-cc-text-secondary">{m.requests}</td>
                  <td className="px-4 py-2 text-right text-cc-text-secondary">{m.inputTokens?.toLocaleString()}</td>
                  <td className="px-4 py-2 text-right text-cc-text-secondary">{m.outputTokens?.toLocaleString()}</td>
                  <td className="px-4 py-2 text-right text-cc-text-secondary">${(m.cost || 0).toFixed(4)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Per-session breakdown */}
      {perSession.length > 0 && (
        <div className="bg-cc-bg rounded-lg border border-cc-border">
          <div className="p-4 border-b border-cc-border">
            <h3 className="text-sm font-medium text-cc-text-secondary">
              Per-Session Breakdown
              <span className="ml-2 text-cc-text-muted font-normal text-xs">click row to filter · click header to sort</span>
            </h3>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-cc-text-muted border-b border-cc-border select-none">
                <th className="text-left px-4 py-2">Session</th>
                <th className="text-right px-4 py-2 cursor-pointer hover:text-cc-text" onClick={() => toggleSort('callCount')}>
                  <span className="inline-flex items-center gap-1 justify-end">Calls <SortIcon col="callCount" sortKey={sortKey} dir={sortDir} /></span>
                </th>
                <th className="text-right px-4 py-2 cursor-pointer hover:text-cc-text" onClick={() => toggleSort('totalInput')}>
                  <span className="inline-flex items-center gap-1 justify-end">Input <SortIcon col="totalInput" sortKey={sortKey} dir={sortDir} /></span>
                </th>
                <th className="text-right px-4 py-2 cursor-pointer hover:text-cc-text" onClick={() => toggleSort('totalOutput')}>
                  <span className="inline-flex items-center gap-1 justify-end">Output <SortIcon col="totalOutput" sortKey={sortKey} dir={sortDir} /></span>
                </th>
                <th className="text-right px-4 py-2">Cache</th>
                <th className="text-right px-4 py-2 cursor-pointer hover:text-cc-text" onClick={() => toggleSort('totalCost')}>
                  <span className="inline-flex items-center gap-1 justify-end">Cost <SortIcon col="totalCost" sortKey={sortKey} dir={sortDir} /></span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-cc-border">
              {sortedRows.map((row: SessionUsageRow) => {
                const isSelected = selectedSessionId === row.sessionId;
                return (
                  <tr
                    key={row.sessionId}
                    onClick={() => setSelectedSession(isSelected ? null : row.sessionId)}
                    className={`cursor-pointer transition-colors ${isSelected ? 'bg-cc-blue-bg hover:bg-cc-blue-bg' : 'hover:bg-cc-bg-surface/60'}`}
                  >
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-2">
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                          row.sessionStatus === 'active' ? 'bg-cc-amber-text' :
                          row.sessionStatus === 'idle' ? 'bg-cc-green-text' : 'bg-cc-text-muted'
                        }`} />
                        <span className={`font-medium truncate max-w-[200px] ${isSelected ? 'text-cc-blue-text' : 'text-cc-text'}`}>
                          {row.sessionName}
                        </span>
                        {row.model && (
                          <span className="text-xs text-cc-text-muted truncate hidden xl:block">
                            {row.model.replace(/-\d{8}$/, '')}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-2 text-right text-cc-text-secondary">{row.callCount}</td>
                    <td className="px-4 py-2 text-right text-cc-text-secondary">{fmtK(row.totalInput)}</td>
                    <td className="px-4 py-2 text-right text-cc-text-secondary">{fmtK(row.totalOutput)}</td>
                    <td className="px-4 py-2 text-right text-cc-text-muted text-xs">
                      {fmtK(row.totalCacheRead)}r / {fmtK(row.totalCacheWrite)}w
                    </td>
                    <td className="px-4 py-2 text-right font-medium text-cc-text">
                      ${row.totalCost.toFixed(4)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="border-t border-cc-border">
              <tr className="text-cc-text-secondary text-xs">
                <td className="px-4 py-2 text-cc-text-muted">{perSession.length} sessions total</td>
                <td className="px-4 py-2 text-right">{perSession.reduce((s, r) => s + r.callCount, 0)}</td>
                <td className="px-4 py-2 text-right">{fmtK(perSession.reduce((s, r) => s + r.totalInput, 0))}</td>
                <td className="px-4 py-2 text-right">{fmtK(perSession.reduce((s, r) => s + r.totalOutput, 0))}</td>
                <td />
                <td className="px-4 py-2 text-right font-bold text-sm text-cc-text">
                  ${perSession.reduce((s, r) => s + r.totalCost, 0).toFixed(4)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
