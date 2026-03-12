import { useSessionStore } from '../stores/sessionStore';
import { GitBranch, Brain, Wrench, Pen, Circle, Unplug, Loader, AlertTriangle, MessageCircleQuestion } from 'lucide-react';
import type { Session, SessionActivity } from '@ccui/shared';
import { pctBarColor } from '../utils';
import LiveTimeAgo from './LiveTimeAgo';

interface Props {
  session: Session;
  onClick: () => void;
}

const MAX_CONTEXT = 200_000;

function StatusDot({ session, activity }: { session: Session; activity: SessionActivity | undefined }) {
  if (session.status === 'terminated') return <Unplug size={11} className="text-gray-600" />;
  const state = activity?.state;
  if (state === 'waiting_input') return <MessageCircleQuestion size={11} className="text-orange-400 animate-pulse" />;
  if (state === 'thinking') return <Brain size={11} className="text-purple-400 animate-pulse" />;
  if (state === 'tool_use') return <Wrench size={11} className="text-yellow-400 animate-pulse" />;
  if (state === 'writing') return <Pen size={11} className="text-blue-400 animate-pulse" />;
  if (session.status === 'active') return <Loader size={11} className="text-blue-400 animate-spin" />;
  return <Circle size={11} className="text-gray-500" />;
}

function activityLabel(activity: SessionActivity | undefined): string {
  if (!activity || activity.state === 'idle') return '';
  if (activity.state === 'waiting_input') return 'Waiting for input…';
  if (activity.state === 'thinking') return 'Thinking…';
  if (activity.state === 'writing') return 'Writing…';
  if (activity.state === 'tool_use') return activity.tool;
  return '';
}

export default function SessionOverviewCard({ session, onClick }: Props) {
  const activity = useSessionStore((s) => s.activities[session.id]);
  const usage = useSessionStore((s) => s.sessionUsage[session.id]);

  const contextPct = usage?.latestInputTokens
    ? Math.min(100, Math.round((usage.latestInputTokens / MAX_CONTEXT) * 100))
    : 0;
  const label = activityLabel(activity);
  const isTerminated = session.status === 'terminated';

  return (
    <button
      onClick={onClick}
      className={`text-left w-full rounded-lg border p-3 transition-all hover:border-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-500 ${
        isTerminated
          ? 'bg-gray-900/30 border-gray-800/50 opacity-60'
          : 'bg-gray-900 border-gray-700/60 hover:bg-gray-800/80'
      }`}
    >
      {/* Header row */}
      <div className="flex items-center gap-1.5 mb-2">
        <StatusDot session={session} activity={activity} />
        <span className="text-xs font-medium text-gray-200 truncate flex-1">{session.name}</span>
        {session.skipPermissions && (
          <span className="shrink-0" title="Skip permissions enabled">
            <AlertTriangle size={11} className="text-yellow-500" />
          </span>
        )}
        {session.branch && (
          <span className="flex items-center gap-0.5 text-[10px] text-gray-500 shrink-0">
            <GitBranch size={9} />
            <span className="max-w-[60px] truncate">{session.branch}</span>
          </span>
        )}
      </div>

      {/* Activity label — only rendered when active, no fixed-height spacer */}
      {label && (
        <p className="text-[10px] text-gray-400 truncate mb-2">{label}</p>
      )}

      {/* Context bar */}
      <div className="mb-2">
        <div className="flex justify-between text-[10px] text-gray-600 mb-0.5">
          <span>ctx</span>
          <span>{contextPct}%</span>
        </div>
        <div className="h-1 bg-gray-800 rounded-full overflow-hidden">
          <div className={`h-full rounded-full ${pctBarColor(contextPct)}`} style={{ width: `${contextPct}%` }} />
        </div>
      </div>

      {/* Cost + time */}
      <div className="flex items-center justify-between text-[10px]">
        <span className="text-green-600 font-mono">
          {usage ? `$${usage.totalCost.toFixed(4)}` : '–'}
        </span>
        <LiveTimeAgo iso={session.lastActiveAt} className="text-gray-600" />
      </div>
    </button>
  );
}
