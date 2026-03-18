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
  if (session.status === 'terminated') return <Unplug size={11} className="text-cc-text-muted" />;
  if (cardStatus === 'done') return <CircleCheck size={11} className="text-cc-green-text" />;
  const state = activity?.state;
  if (state === 'waiting_input') return <MessageCircleQuestion size={11} className="text-cc-orange-text animate-pulse" />;
  if (state === 'thinking') return <Brain size={11} className="text-cc-amber-text animate-pulse" />;
  if (state === 'tool_use') return <Wrench size={11} className="text-cc-cyan-text animate-pulse" />;
  if (state === 'writing') return <Pen size={11} className="text-cc-blue-text animate-pulse" />;
  if (session.status === 'active') return <Loader size={11} className="text-cc-blue-text animate-spin" />;
  return <Circle size={11} className="text-cc-green-text" />;
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
  disconnected: { label: 'off', labelColor: 'text-cc-text-muted', labelBg: 'bg-cc-bg-surface', border: 'border-cc-border/50', tintColor: '', tintOpacity: 0, stripe: '', running: false },
  idle: { label: '', labelColor: '', labelBg: '', border: 'border-cc-border/60', tintColor: '', tintOpacity: 0, stripe: '', running: false },
  thinking: { label: 'thinking', labelColor: 'text-cc-amber-text', labelBg: 'bg-cc-amber-bg', border: 'border-cc-amber-border', tintColor: 'rgb(245,158,11)', tintOpacity: 0.06, stripe: 'bg-cc-amber-text', running: true },
  tool_use: { label: 'running', labelColor: 'text-cc-cyan-text', labelBg: 'bg-cc-cyan-bg', border: 'border-cc-cyan-border', tintColor: 'rgb(6,182,212)', tintOpacity: 0.06, stripe: 'bg-cc-cyan-text', running: true },
  writing: { label: 'writing', labelColor: 'text-cc-blue-text', labelBg: 'bg-cc-blue-bg', border: 'border-cc-blue-border', tintColor: 'rgb(59,130,246)', tintOpacity: 0.06, stripe: 'bg-cc-blue-text', running: true },
  done: { label: 'done', labelColor: 'text-cc-green-text', labelBg: 'bg-cc-green-bg', border: 'border-cc-green-border', tintColor: 'rgb(52,211,153)', tintOpacity: 0.06, stripe: '', running: false },
  waiting_input: { label: 'waiting', labelColor: 'text-cc-orange-text', labelBg: 'bg-cc-orange-bg', border: 'border-cc-orange-border', tintColor: 'rgb(251,146,60)', tintOpacity: 0.06, stripe: 'bg-cc-orange-text', running: false },
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
    if (isActive && !wasActive) {
      runStartedAtRef.current = Date.now();
      setJustDone(false);
    }

    if (wasActive && activityState === 'idle' && session.status !== 'terminated') {
      const elapsed = runStartedAtRef.current ? Date.now() - runStartedAtRef.current : 0;
      if (elapsed >= 5000) {
        const timer = setTimeout(() => {
          setJustDone(true);
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
      className={`relative text-left w-full rounded-lg border p-3 transition-all overflow-hidden focus:outline-none focus:ring-1 focus:ring-cc-accent ${
        isTerminated
          ? 'bg-cc-bg-surface/50 border-cc-border/40 opacity-60'
          : `bg-cc-bg-surface/60 border-cc-border/40 ${sc.running ? sc.border : 'hover:border-cc-border'} hover:bg-cc-bg-surface`
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
        <span className="text-xs font-medium text-cc-text truncate flex-1">{session.name}</span>
        {session.skipPermissions && (
          <span className="shrink-0" title="Skip permissions enabled">
            <AlertTriangle size={11} className="text-cc-yellow-text" />
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
          <GitBranch size={9} className={`shrink-0 ${session.sessionType === 'head' ? 'text-cc-green-text' : 'text-cc-text-muted'}`} />
          <span className={`text-xs truncate ${session.sessionType === 'head' ? 'text-cc-green-text' : 'text-cc-text-muted'}`}>
            {session.sessionType === 'head' ? `HEAD (${session.branch})` : session.branch}
          </span>
        </div>
      )}

      {/* Activity label — always occupies space to prevent height jump */}
      <p className={`relative text-xs truncate mb-2 ${label ? 'text-cc-text-secondary' : 'invisible'}`}>{label || '\u00A0'}</p>

      {/* Context bar */}
      <div className="relative mb-2">
        <div className="flex justify-between text-xs text-cc-text-muted mb-0.5">
          <span>ctx</span>
          <span>{contextPct}%</span>
        </div>
        <div className="h-1 bg-cc-bg-surface rounded-full overflow-hidden">
          <div className={`h-full rounded-full transition-all duration-500 ease-out ${pctBarColor(contextPct)}`} style={{ width: `${contextPct}%` }} />
        </div>
      </div>

      {/* Cost + time */}
      <div className="relative flex items-center justify-between text-xs">
        <span className="text-cc-green-text font-mono">
          {usage ? `$${usage.totalCost.toFixed(4)}` : '–'}
        </span>
        <LiveTimeAgo iso={session.lastActiveAt} className="text-cc-text-muted" />
      </div>

      {/* Git diff summary */}
      {diffStat && diffStat.totalFiles > 0 && (
        <div className="relative flex items-center gap-2 mt-2 pt-2 border-t border-cc-border/50 text-xs">
          <FileDiff size={10} className="text-cc-text-muted shrink-0" />
          <span className="text-cc-green-text font-mono">+{diffStat.totalAdded}</span>
          <span className="text-cc-red-text font-mono">-{diffStat.totalDeleted}</span>
          <span className="text-cc-text-muted">{diffStat.totalFiles} file{diffStat.totalFiles !== 1 ? 's' : ''}</span>
        </div>
      )}
    </button>
  );
}
