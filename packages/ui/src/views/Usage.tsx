import { useEffect } from 'react';
import { useUsageStore } from '../stores/usageStore';
import { X } from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  BarChart, Bar,
} from 'recharts';

function fmtK(n: number) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return String(n);
}

export default function Usage() {
  const {
    summary, daily, modelUsage, perSession,
    range, selectedSessionId,
    setRange, setSelectedSession, fetchAll,
  } = useUsageStore();

  useEffect(() => { fetchAll(); }, []);

  const ranges = [
    { label: '7 Days', value: '7d' },
    { label: '30 Days', value: '30d' },
    { label: 'All', value: 'all' },
  ];

  const selectedSession = selectedSessionId
    ? perSession.find((r) => r.sessionId === selectedSessionId)
    : null;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-bold">Usage Analytics</h2>
          {selectedSession && (
            <span className="flex items-center gap-1.5 text-sm bg-blue-900/40 border border-blue-700/50 text-blue-300 px-2.5 py-1 rounded-full">
              {selectedSession.sessionName}
              <button
                onClick={() => setSelectedSession(null)}
                className="hover:text-white transition-colors"
                title="Clear filter"
              >
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
              className={`px-3 py-1 text-sm rounded-md transition-colors ${
                range === r.value
                  ? 'bg-gray-700 text-white'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* Summary cards */}
      {summary && (
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
            <p className="text-xs text-gray-500 uppercase">Total Cost</p>
            <p className="text-2xl font-bold mt-1">${summary.totalCost.toFixed(4)}</p>
          </div>
          <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
            <p className="text-xs text-gray-500 uppercase">Input Tokens</p>
            <p className="text-2xl font-bold mt-1">{summary.totalInputTokens.toLocaleString()}</p>
          </div>
          <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
            <p className="text-xs text-gray-500 uppercase">Output Tokens</p>
            <p className="text-2xl font-bold mt-1">{summary.totalOutputTokens.toLocaleString()}</p>
          </div>
          <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
            <p className="text-xs text-gray-500 uppercase">
              {selectedSessionId ? 'API Calls' : 'Sessions'}
            </p>
            <p className="text-2xl font-bold mt-1">
              {selectedSessionId
                ? (selectedSession?.callCount ?? 0)
                : summary.sessionCount}
            </p>
          </div>
        </div>
      )}

      {/* Cost trend chart */}
      <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
        <h3 className="text-sm font-medium text-gray-400 mb-4">Cost Trend</h3>
        <ResponsiveContainer width="100%" height={250}>
          <LineChart data={daily}>
            <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#6b7280' }} />
            <YAxis tick={{ fontSize: 11, fill: '#6b7280' }} />
            <Tooltip
              contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
              labelStyle={{ color: '#9ca3af' }}
            />
            <Line type="monotone" dataKey="cost" stroke="#3b82f6" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Token usage bar chart */}
      <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
        <h3 className="text-sm font-medium text-gray-400 mb-4">Daily Token Usage</h3>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={daily}>
            <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#6b7280' }} />
            <YAxis tick={{ fontSize: 11, fill: '#6b7280' }} />
            <Tooltip
              contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
              labelStyle={{ color: '#9ca3af' }}
            />
            <Bar dataKey="inputTokens" fill="#3b82f6" name="Input" stackId="a" />
            <Bar dataKey="outputTokens" fill="#10b981" name="Output" stackId="a" />
          </BarChart>
        </ResponsiveContainer>
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
              <span className="ml-2 text-gray-600 font-normal text-xs">click a row to filter charts above</span>
            </h3>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-500 border-b border-gray-800">
                <th className="text-left px-4 py-2">Session</th>
                <th className="text-right px-4 py-2">Calls</th>
                <th className="text-right px-4 py-2">Input</th>
                <th className="text-right px-4 py-2">Output</th>
                <th className="text-right px-4 py-2">Cache</th>
                <th className="text-right px-4 py-2">Cost</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {perSession.map((row) => {
                const isSelected = selectedSessionId === row.sessionId;
                return (
                  <tr
                    key={row.sessionId}
                    onClick={() => setSelectedSession(isSelected ? null : row.sessionId)}
                    className={`cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-blue-900/25 hover:bg-blue-900/30'
                        : 'hover:bg-gray-800/60'
                    }`}
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
