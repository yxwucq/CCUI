import { useEffect, useRef, useState } from 'react';
import { GitBranch, Brain, Wrench, Pen, Circle, Unplug, Loader, AlertTriangle, MessageCircleQuestion, FileDiff, CircleCheck } from 'lucide-react';
import type { Session, SessionActivity } from '@ccui/shared';
import type { SessionUsageSummary } from '../stores/sessionStore';
import { pctBarColor } from '../utils';
import LiveTimeAgo from './LiveTimeAgo';

interface Props {
  session: Session;
  activity?: SessionActivity;
  usage?: SessionUsageSummary;
  onClick: () => void;
}

const DEFAULT_CONTEXT = 200_000;

function StatusDot({ session, activity, cardStatus }: { session: Session; activity: SessionActivity | undefined; cardStatus: CardStatus }) {
  if (session.status === 'terminated') return <Unplug size={11} className="text-gray-600" />;
  if (cardStatus === 'done') return <CircleCheck size={11} className="text-emerald-400" />;
  const state = activity?.state;
  if (state === 'waiting_input') return <MessageCircleQuestion size={11} className="text-orange-400 animate-pulse" />;
  if (state === 'thinking') return <Brain size={11} className="text-amber-400 animate-pulse" />;
  if (state === 'tool_use') return <Wrench size={11} className="text-cyan-400 animate-pulse" />;
  if (state === 'writing') return <Pen size={11} className="text-blue-400 animate-pulse" />;
  if (session.status === 'active') return <Loader size={11} className="text-blue-400 animate-spin" />;
  return <Circle size={11} className="text-green-500" />;
}

function activityLabel(activity: SessionActivity | undefined): string {
  if (!activity || activity.state === 'idle') return '';
  if (activity.state === 'waiting_input') return 'Waiting for input…';
  if (activity.state === 'thinking') return 'Thinking…';
  if (activity.state === 'writing') return 'Writing…';
  if (activity.state === 'tool_use') return activity.tool;
  return '';
}

type CardStatus = 'disconnected' | 'idle' | 'thinking' | 'tool_use' | 'writing' | 'done' | 'waiting_input';

const CARD_STATUS: Record<CardStatus, {
  label: string;
  labelColor: string;
  labelBg: string;
  border: string;
  tintColor: string;
  tintOpacity: number;
  stripe: string;
  running: boolean;
}> = {
  disconnected: { label: 'off', labelColor: 'text-gray-500', labelBg: 'bg-gray-800', border: 'border-gray-800/50', tintColor: '', tintOpacity: 0, stripe: '', running: false },
  idle: { label: '', labelColor: '', labelBg: '', border: 'border-gray-700/60', tintColor: '', tintOpacity: 0, stripe: '', running: false },
  thinking: { label: 'thinking', labelColor: 'text-amber-400', labelBg: 'bg-amber-900/30', border: 'border-amber-800/50', tintColor: 'rgb(245,158,11)', tintOpacity: 0.06, stripe: 'bg-amber-500', running: true },
  tool_use: { label: 'running', labelColor: 'text-cyan-400', labelBg: 'bg-cyan-900/30', border: 'border-cyan-800/50', tintColor: 'rgb(6,182,212)', tintOpacity: 0.06, stripe: 'bg-cyan-500', running: true },
  writing: { label: 'writing', labelColor: 'text-blue-400', labelBg: 'bg-blue-900/30', border: 'border-blue-800/50', tintColor: 'rgb(59,130,246)', tintOpacity: 0.06, stripe: 'bg-blue-500', running: true },
  done: { label: 'done', labelColor: 'text-emerald-400', labelBg: 'bg-emerald-900/30', border: 'border-emerald-800/50', tintColor: 'rgb(52,211,153)', tintOpacity: 0.06, stripe: '', running: false },
  waiting_input: { label: 'waiting', labelColor: 'text-orange-400', labelBg: 'bg-orange-900/30', border: 'border-orange-800/50', tintColor: 'rgb(251,146,60)', tintOpacity: 0.06, stripe: 'bg-orange-400', running: false },
};

function useCardStatus(session: Session, activity: SessionActivity | undefined): CardStatus {
  const [justDone, setJustDone] = useState(false);
  const prevRef = useRef<string | undefined>(undefined);
  const runStartedAtRef = useRef<number | null>(null);
  const activityState = activity?.state;

  useEffect(() => {
    const prev = prevRef.current;
    prevRef.current = activityState;

    const isActive = activityState && activityState !== 'idle' && activityState !== 'waiting_input';
    const wasActive = prev && prev !== 'idle' && prev !== 'waiting_input';
    if (isActive && !wasActive) runStartedAtRef.current = Date.now();

    if (wasActive && activityState === 'idle' && session.status !== 'terminated') {
      const elapsed = runStartedAtRef.current ? Date.now() - runStartedAtRef.current : 0;
      if (elapsed >= 5000) {
        const timer = setTimeout(() => {
          setJustDone(true);
          setTimeout(() => setJustDone(false), 3000);
        }, 500);
        return () => clearTimeout(timer);
      }
    }
    if (activityState === 'waiting_input') setJustDone(false);
  }, [activityState, session.status]);

  if (session.status === 'terminated') return 'disconnected';
  if (activityState === 'waiting_input') return 'waiting_input';
  if (activityState && activityState !== 'idle') return activityState as CardStatus;
  if (justDone) return 'done';
  return 'idle';
}

interface DiffStat {
  totalAdded: number;
  totalDeleted: number;
  totalFiles: number;
}

function useGitDiffStat(sessionId: string, activity: SessionActivity | undefined): DiffStat | null {
  const [stat, setStat] = useState<DiffStat | null>(null);
  const prevStateRef = useRef('');

  useEffect(() => {
    // Fetch on mount and when activity transitions from active → idle
    const fetchStat = () => {
      fetch(`/api/sessions/${sessionId}/git/diff-stat`)
        .then((r) => r.ok ? r.json() : null)
        .then((data) => { if (data) setStat(data); })
        .catch(() => {});
    };
    fetchStat();
  }, [sessionId]);

  // Refresh when session goes idle (finished a run)
  useEffect(() => {
    const prev = prevStateRef.current;
    const cur = activity?.state || 'idle';
    prevStateRef.current = cur;
    if (prev && prev !== 'idle' && prev !== 'waiting_input' && (cur === 'idle' || cur === 'waiting_input')) {
      fetch(`/api/sessions/${sessionId}/git/diff-stat`)
        .then((r) => r.ok ? r.json() : null)
        .then((data) => { if (data) setStat(data); })
        .catch(() => {});
    }
  }, [activity?.state, sessionId]);

  return stat;
}

export default function SessionOverviewCard({ session, activity, usage, onClick }: Props) {
  const diffStat = useGitDiffStat(session.id, activity);
  const cardStatus = useCardStatus(session, activity);
  const sc = CARD_STATUS[cardStatus];

  const maxContext = usage?.contextWindow ?? DEFAULT_CONTEXT;
  const contextPct = usage?.latestInputTokens
    ? Math.min(100, Math.round((usage.latestInputTokens / maxContext) * 100))
    : 0;
  const label = activityLabel(activity);
  const isTerminated = session.status === 'terminated';

  return (
    <button
      onClick={onClick}
      className={`relative text-left w-full rounded-lg border p-3 transition-all overflow-hidden hover:border-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-500 ${
        isTerminated
          ? 'bg-gray-900/30 border-gray-800/50 opacity-60'
          : `bg-gray-900 ${sc.border} hover:bg-gray-800/80`
      }`}
    >
      {/* Tint overlay */}
      {sc.tintColor && (
        <div
          className="absolute inset-0 pointer-events-none rounded-lg"
          style={{ backgroundColor: sc.tintColor, opacity: sc.tintOpacity }}
        />
      )}

      {/* Activity stripe — top edge */}
      {sc.running && (
        <div className={`absolute top-0 left-0 right-0 h-0.5 ${sc.stripe} activity-stripe`} />
      )}

      {/* Header row */}
      <div className="relative flex items-center gap-1.5 mb-2">
        <StatusDot session={session} activity={activity} cardStatus={cardStatus} />
        <span className="text-xs font-medium text-gray-200 truncate flex-1">{session.name}</span>
        {session.skipPermissions && (
          <span className="shrink-0" title="Skip permissions enabled">
            <AlertTriangle size={11} className="text-yellow-500" />
          </span>
        )}
        {sc.label && (
          <span className={`text-[10px] px-1.5 py-0.5 rounded shrink-0 flex items-center gap-1 ${sc.labelColor} ${sc.labelBg}`}>
            {sc.running && <span className={`w-1 h-1 rounded-full animate-pulse ${sc.stripe}`} />}
            {cardStatus === 'done' && <CircleCheck size={9} />}
            {sc.label}
          </span>
        )}
      </div>

      {/* Branch */}
      {session.branch && (
        <div className="relative flex items-center gap-1 mb-2">
          <GitBranch size={9} className="text-gray-600 shrink-0" />
          <span className="text-xs text-gray-500 truncate">{session.branch}</span>
        </div>
      )}

      {/* Activity label — only rendered when active */}
      {label && (
        <p className="relative text-xs text-gray-400 truncate mb-2">{label}</p>
      )}

      {/* Context bar */}
      <div className="relative mb-2">
        <div className="flex justify-between text-xs text-gray-600 mb-0.5">
          <span>ctx</span>
          <span>{contextPct}%</span>
        </div>
        <div className="h-1 bg-gray-800 rounded-full overflow-hidden">
          <div className={`h-full rounded-full ${pctBarColor(contextPct)}`} style={{ width: `${contextPct}%` }} />
        </div>
      </div>

      {/* Cost + time */}
      <div className="relative flex items-center justify-between text-xs">
        <span className="text-green-600 font-mono">
          {usage ? `$${usage.totalCost.toFixed(4)}` : '–'}
        </span>
        <LiveTimeAgo iso={session.lastActiveAt} className="text-gray-600" />
      </div>

      {/* Git diff summary */}
      {diffStat && diffStat.totalFiles > 0 && (
        <div className="relative flex items-center gap-2 mt-2 pt-2 border-t border-gray-800/50 text-xs">
          <FileDiff size={10} className="text-gray-600 shrink-0" />
          <span className="text-green-500 font-mono">+{diffStat.totalAdded}</span>
          <span className="text-red-500 font-mono">-{diffStat.totalDeleted}</span>
          <span className="text-gray-600">{diffStat.totalFiles} file{diffStat.totalFiles !== 1 ? 's' : ''}</span>
        </div>
      )}
    </button>
  );
}
