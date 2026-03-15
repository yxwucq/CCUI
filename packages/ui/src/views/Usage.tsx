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
            <span className="flex items-center gap-1.5 text-sm bg-cc-blue-bg border border-cc-blue-border text-cc-blue-text px-2.5 py-1 rounded-full">
              {selectedSession.sessionName}
              <button
                onClick={() => setSelectedSession(null)}
                className="hover:text-cc-text transition-colors"
                title="Clear filter"
              >
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
              className={`px-3 py-1 text-sm rounded-md transition-colors ${
                range === r.value
                  ? 'bg-cc-bg-overlay text-cc-text'
                  : 'text-cc-text-muted hover:text-cc-text'
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
          <div className="bg-cc-bg rounded-lg p-4 border border-cc-border">
            <p className="text-xs text-cc-text-muted uppercase">Total Cost</p>
            <p className="text-2xl font-bold mt-1">${summary.totalCost.toFixed(4)}</p>
          </div>
          <div className="bg-cc-bg rounded-lg p-4 border border-cc-border">
            <p className="text-xs text-cc-text-muted uppercase">Input Tokens</p>
            <p className="text-2xl font-bold mt-1">{summary.totalInputTokens.toLocaleString()}</p>
          </div>
          <div className="bg-cc-bg rounded-lg p-4 border border-cc-border">
            <p className="text-xs text-cc-text-muted uppercase">Output Tokens</p>
            <p className="text-2xl font-bold mt-1">{summary.totalOutputTokens.toLocaleString()}</p>
          </div>
          <div className="bg-cc-bg rounded-lg p-4 border border-cc-border">
            <p className="text-xs text-cc-text-muted uppercase">
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
      <div className="bg-cc-bg rounded-lg p-4 border border-cc-border">
        <h3 className="text-sm font-medium text-cc-text-secondary mb-4">Cost Trend</h3>
        <ResponsiveContainer width="100%" height={250}>
          <LineChart data={daily}>
            <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--cc-text-muted)' }} />
            <YAxis tick={{ fontSize: 11, fill: 'var(--cc-text-muted)' }} />
            <Tooltip
              contentStyle={{ background: 'var(--cc-bg-surface)', border: '1px solid var(--cc-border)', borderRadius: 8 }}
              labelStyle={{ color: 'var(--cc-text-secondary)' }}
            />
            <Line type="monotone" dataKey="cost" stroke="#3b82f6" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Token usage bar chart */}
      <div className="bg-cc-bg rounded-lg p-4 border border-cc-border">
        <h3 className="text-sm font-medium text-cc-text-secondary mb-4">Daily Token Usage</h3>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={daily}>
            <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--cc-text-muted)' }} />
            <YAxis tick={{ fontSize: 11, fill: 'var(--cc-text-muted)' }} />
            <Tooltip
              contentStyle={{ background: 'var(--cc-bg-surface)', border: '1px solid var(--cc-border)', borderRadius: 8 }}
              labelStyle={{ color: 'var(--cc-text-secondary)' }}
            />
            <Bar dataKey="inputTokens" fill="#3b82f6" name="Input" stackId="a" />
            <Bar dataKey="outputTokens" fill="#10b981" name="Output" stackId="a" />
          </BarChart>
        </ResponsiveContainer>
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
              <span className="ml-2 text-cc-text-muted font-normal text-xs">click a row to filter charts above</span>
            </h3>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-cc-text-muted border-b border-cc-border">
                <th className="text-left px-4 py-2">Session</th>
                <th className="text-right px-4 py-2">Calls</th>
                <th className="text-right px-4 py-2">Input</th>
                <th className="text-right px-4 py-2">Output</th>
                <th className="text-right px-4 py-2">Cache</th>
                <th className="text-right px-4 py-2">Cost</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-cc-border">
              {perSession.map((row) => {
                const isSelected = selectedSessionId === row.sessionId;
                return (
                  <tr
                    key={row.sessionId}
                    onClick={() => setSelectedSession(isSelected ? null : row.sessionId)}
                    className={`cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-cc-blue-bg hover:bg-cc-blue-bg'
                        : 'hover:bg-cc-bg-surface/60'
                    }`}
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
