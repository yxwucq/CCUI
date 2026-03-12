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
  if (col !== sortKey) return <ChevronsUpDown size={11} className="text-gray-600" />;
  return dir === 'desc' ? <ChevronDown size={11} className="text-blue-400" /> : <ChevronUp size={11} className="text-blue-400" />;
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
            <span className="flex items-center gap-1.5 text-sm bg-blue-900/40 border border-blue-700/50 text-blue-300 px-2.5 py-1 rounded-full">
              {selectedSession.sessionName}
              <button onClick={() => setSelectedSession(null)} className="hover:text-white transition-colors" title="Clear filter">
                <X size={12} />
              </button>
            </span>
          )}
        </div>
        <div className="flex gap-1 bg-gray-800 rounded-lg p-0.5">
          {ranges.map((r) => (
            <button
              key={r.value}
              onClick={() => setRange(r.value)}
              className={`px-3 py-1 text-sm rounded-md transition-colors ${range === r.value ? 'bg-gray-700 text-white' : 'text-gray-500 hover:text-gray-300'}`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* Summary cards */}
      {summary && (
        <div className="grid grid-cols-5 gap-4">
          <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
            <p className="text-xs text-gray-500 uppercase">Total Cost</p>
            <p className="text-2xl font-bold mt-1">${totalCost.toFixed(4)}</p>
          </div>
          <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
            <p className="text-xs text-gray-500 uppercase">Input Tokens</p>
            <p className="text-2xl font-bold mt-1">{fmtK(summary.totalInputTokens)}</p>
          </div>
          <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
            <p className="text-xs text-gray-500 uppercase">Output Tokens</p>
            <p className="text-2xl font-bold mt-1">{fmtK(summary.totalOutputTokens)}</p>
          </div>
          <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
            <p className="text-xs text-gray-500 uppercase">{selectedSessionId ? 'API Calls' : 'Sessions'}</p>
            <p className="text-2xl font-bold mt-1">
              {selectedSessionId ? (selectedSession?.callCount ?? 0) : summary.sessionCount}
            </p>
          </div>
          <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
            <p className="text-xs text-gray-500 uppercase">Avg Cost / Call</p>
            <p className="text-2xl font-bold mt-1">${avgCostPerCall.toFixed(4)}</p>
          </div>
        </div>
      )}

      {/* Cost trend (Area) + Token usage side by side */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
          <h3 className="text-sm font-medium text-gray-400 mb-4">Cost Trend</h3>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={daily}>
              <defs>
                <linearGradient id="costGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#6b7280' }} />
              <YAxis tick={{ fontSize: 10, fill: '#6b7280' }} />
              <Tooltip contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8 }} labelStyle={{ color: '#9ca3af' }} />
              <Area type="monotone" dataKey="cost" stroke="#3b82f6" strokeWidth={2} fill="url(#costGrad)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
          <h3 className="text-sm font-medium text-gray-400 mb-4">Daily Token Usage</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={daily}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#6b7280' }} />
              <YAxis tick={{ fontSize: 10, fill: '#6b7280' }} />
              <Tooltip contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8 }} labelStyle={{ color: '#9ca3af' }} />
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
        <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
          <h3 className="text-sm font-medium text-gray-400 mb-1">Cache Hit Rate</h3>
          <p className="text-xs text-gray-600 mb-3">cache_read / (cache_read + input) per day</p>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={cacheRateData}>
              <defs>
                <linearGradient id="cacheGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#6b7280' }} />
              <YAxis unit="%" domain={[0, 100]} tick={{ fontSize: 10, fill: '#6b7280' }} />
              <Tooltip
                contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
                labelStyle={{ color: '#9ca3af' }}
                formatter={(v: any) => [`${v}%`, 'Cache Hit Rate']}
              />
              <Area type="monotone" dataKey="cacheHitRate" stroke="#f59e0b" strokeWidth={2} fill="url(#cacheGrad)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
          <h3 className="text-sm font-medium text-gray-400 mb-1">Top Sessions by Cost</h3>
          <p className="text-xs text-gray-600 mb-3">top {topSessions.length}</p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={topSessions} layout="vertical" margin={{ left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 10, fill: '#6b7280' }} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: '#9ca3af' }} width={110} />
              <Tooltip
                contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
                labelStyle={{ color: '#9ca3af' }}
                formatter={(v: any) => [`$${(v as number).toFixed(4)}`, 'Cost']}
              />
              <Bar dataKey="cost" fill="#3b82f6" radius={[0, 3, 3, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Model breakdown */}
      {modelUsage.length > 0 && (
        <div className="bg-gray-900 rounded-lg border border-gray-800">
          <div className="p-4 border-b border-gray-800">
            <h3 className="text-sm font-medium text-gray-400">Model Breakdown</h3>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-500 border-b border-gray-800">
                <th className="text-left px-4 py-2">Model</th>
                <th className="text-right px-4 py-2">Requests</th>
                <th className="text-right px-4 py-2">Input Tokens</th>
                <th className="text-right px-4 py-2">Output Tokens</th>
                <th className="text-right px-4 py-2">Cost</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {modelUsage.map((m: any) => (
                <tr key={m.model}>
                  <td className="px-4 py-2 text-gray-300">{m.model}</td>
                  <td className="px-4 py-2 text-right text-gray-400">{m.requests}</td>
                  <td className="px-4 py-2 text-right text-gray-400">{m.inputTokens?.toLocaleString()}</td>
                  <td className="px-4 py-2 text-right text-gray-400">{m.outputTokens?.toLocaleString()}</td>
                  <td className="px-4 py-2 text-right text-gray-300">${(m.cost || 0).toFixed(4)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Per-session breakdown */}
      {perSession.length > 0 && (
        <div className="bg-gray-900 rounded-lg border border-gray-800">
          <div className="p-4 border-b border-gray-800">
            <h3 className="text-sm font-medium text-gray-400">
              Per-Session Breakdown
              <span className="ml-2 text-gray-600 font-normal text-xs">click row to filter · click header to sort</span>
            </h3>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-500 border-b border-gray-800 select-none">
                <th className="text-left px-4 py-2">Session</th>
                <th className="text-right px-4 py-2 cursor-pointer hover:text-gray-300" onClick={() => toggleSort('callCount')}>
                  <span className="inline-flex items-center gap-1 justify-end">Calls <SortIcon col="callCount" sortKey={sortKey} dir={sortDir} /></span>
                </th>
                <th className="text-right px-4 py-2 cursor-pointer hover:text-gray-300" onClick={() => toggleSort('totalInput')}>
                  <span className="inline-flex items-center gap-1 justify-end">Input <SortIcon col="totalInput" sortKey={sortKey} dir={sortDir} /></span>
                </th>
                <th className="text-right px-4 py-2 cursor-pointer hover:text-gray-300" onClick={() => toggleSort('totalOutput')}>
                  <span className="inline-flex items-center gap-1 justify-end">Output <SortIcon col="totalOutput" sortKey={sortKey} dir={sortDir} /></span>
                </th>
                <th className="text-right px-4 py-2">Cache</th>
                <th className="text-right px-4 py-2 cursor-pointer hover:text-gray-300" onClick={() => toggleSort('totalCost')}>
                  <span className="inline-flex items-center gap-1 justify-end">Cost <SortIcon col="totalCost" sortKey={sortKey} dir={sortDir} /></span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {sortedRows.map((row: SessionUsageRow) => {
                const isSelected = selectedSessionId === row.sessionId;
                return (
                  <tr
                    key={row.sessionId}
                    onClick={() => setSelectedSession(isSelected ? null : row.sessionId)}
                    className={`cursor-pointer transition-colors ${isSelected ? 'bg-blue-900/25 hover:bg-blue-900/30' : 'hover:bg-gray-800/60'}`}
                  >
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-2">
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                          row.sessionStatus === 'active' ? 'bg-amber-400' :
                          row.sessionStatus === 'idle' ? 'bg-green-600' : 'bg-gray-600'
                        }`} />
                        <span className={`font-medium truncate max-w-[200px] ${isSelected ? 'text-blue-300' : 'text-gray-200'}`}>
                          {row.sessionName}
                        </span>
                        {row.model && (
                          <span className="text-xs text-gray-600 truncate hidden xl:block">
                            {row.model.replace(/-\d{8}$/, '')}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-2 text-right text-gray-400">{row.callCount}</td>
                    <td className="px-4 py-2 text-right text-gray-400">{fmtK(row.totalInput)}</td>
                    <td className="px-4 py-2 text-right text-gray-400">{fmtK(row.totalOutput)}</td>
                    <td className="px-4 py-2 text-right text-gray-500 text-xs">
                      {fmtK(row.totalCacheRead)}r / {fmtK(row.totalCacheWrite)}w
                    </td>
                    <td className="px-4 py-2 text-right font-medium text-gray-200">
                      ${row.totalCost.toFixed(4)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="border-t border-gray-700">
              <tr className="text-gray-400 text-xs">
                <td className="px-4 py-2 text-gray-500">{perSession.length} sessions total</td>
                <td className="px-4 py-2 text-right">{perSession.reduce((s, r) => s + r.callCount, 0)}</td>
                <td className="px-4 py-2 text-right">{fmtK(perSession.reduce((s, r) => s + r.totalInput, 0))}</td>
                <td className="px-4 py-2 text-right">{fmtK(perSession.reduce((s, r) => s + r.totalOutput, 0))}</td>
                <td />
                <td className="px-4 py-2 text-right font-bold text-sm text-gray-200">
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
