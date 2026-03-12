import { useEffect } from 'react';
import { useUsageStore } from '../stores/usageStore';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  BarChart, Bar,
} from 'recharts';

export default function Usage() {
  const { summary, daily, modelUsage, range, setRange, fetchSummary, fetchDaily, fetchModelUsage } = useUsageStore();

  useEffect(() => {
    fetchSummary();
    fetchDaily();
    fetchModelUsage();
  }, []);

  const ranges = [
    { label: '7 Days', value: '7d' },
    { label: '30 Days', value: '30d' },
    { label: 'All', value: 'all' },
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Usage Analytics</h2>
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
            <p className="text-xs text-gray-500 uppercase">Sessions</p>
            <p className="text-2xl font-bold mt-1">{summary.sessionCount}</p>
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
    </div>
  );
}
