import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSessionStore } from '../stores/sessionStore';
import { useUsageStore } from '../stores/usageStore';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { DollarSign, Zap, Activity, TrendingUp } from 'lucide-react';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

export default function Dashboard() {
  const sessions = useSessionStore((s) => s.sessions);
  const { summary, daily, modelUsage, fetchSummary, fetchDaily, fetchModelUsage } = useUsageStore();
  const navigate = useNavigate();

  useEffect(() => {
    fetchSummary('7d');
    fetchDaily('7d');
    fetchModelUsage();
  }, []);

  const activeSessions = sessions.filter((s) => s.status !== 'terminated');

  const stats = [
    {
      label: 'Total Cost',
      value: `$${(summary?.totalCost || 0).toFixed(4)}`,
      icon: DollarSign,
      color: 'text-green-400',
    },
    {
      label: 'Total Tokens',
      value: ((summary?.totalInputTokens || 0) + (summary?.totalOutputTokens || 0)).toLocaleString(),
      icon: Zap,
      color: 'text-blue-400',
    },
    {
      label: 'Active Sessions',
      value: activeSessions.length,
      icon: Activity,
      color: 'text-yellow-400',
    },
    {
      label: 'Total Sessions',
      value: summary?.sessionCount || 0,
      icon: TrendingUp,
      color: 'text-purple-400',
    },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Stats cards */}
      <div className="grid grid-cols-4 gap-4">
        {stats.map((stat) => (
          <div key={stat.label} className="bg-gray-900 rounded-lg p-4 border border-gray-800">
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500 uppercase">{stat.label}</span>
              <stat.icon size={16} className={stat.color} />
            </div>
            <p className="text-2xl font-bold mt-1">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
          <h3 className="text-sm font-medium text-gray-400 mb-4">7-Day Cost Trend</h3>
          <ResponsiveContainer width="100%" height={200}>
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

        <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
          <h3 className="text-sm font-medium text-gray-400 mb-4">Model Usage</h3>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={modelUsage}
                dataKey="cost"
                nameKey="model"
                cx="50%" cy="50%"
                outerRadius={70}
                label={({ model }) => model ? model.split('-').slice(0, 3).join('-') : 'unknown'}
              >
                {modelUsage.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Recent sessions */}
      <div className="bg-gray-900 rounded-lg border border-gray-800">
        <div className="p-4 border-b border-gray-800 flex items-center justify-between">
          <h3 className="text-sm font-medium text-gray-400">Recent Sessions</h3>
          <button
            onClick={() => navigate('/')}
            className="text-xs bg-blue-600 hover:bg-blue-700 px-3 py-1 rounded transition-colors"
          >
            View All
          </button>
        </div>
        <div className="divide-y divide-gray-800">
          {sessions.slice(0, 5).map((s) => (
            <div
              key={s.id}
              className="px-4 py-3 flex items-center justify-between text-left"
            >
              <div className="min-w-0">
                <span className="text-sm text-gray-200">{s.name}</span>
                {s.branch && (
                  <span className="text-xs text-purple-400 ml-2">{s.branch}</span>
                )}
                <span className="text-xs text-gray-600 ml-2">
                  {new Date(s.createdAt).toLocaleDateString()}
                </span>
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${
                s.status === 'active' ? 'bg-green-900/50 text-green-400' :
                s.status === 'idle' ? 'bg-blue-900/50 text-blue-400' :
                'bg-gray-800 text-gray-500'
              }`}>
                {s.status}
              </span>
            </div>
          ))}
          {sessions.length === 0 && (
            <p className="px-4 py-6 text-center text-gray-600 text-sm">No sessions yet</p>
          )}
        </div>
      </div>
    </div>
  );
}
