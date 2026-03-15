import { useRef, useState, useEffect, useCallback } from 'react';
import type { Session, SessionActivity } from '@ccui/shared';
import {
  Brain, Wrench, Pen, Circle, CircleCheck,
  Unplug, MessageCircleQuestion,
} from 'lucide-react';

export type DisplayStatus = 'disconnected' | 'idle' | 'thinking' | 'tool_use' | 'writing' | 'done' | 'waiting_input';

export function useDisplayStatus(session: Session, activity: SessionActivity | undefined, isExpanded: boolean): [DisplayStatus, () => void] {
  const [justDone, setJustDone] = useState(false);
  const prevActivityRef = useRef<string | undefined>(undefined);
  const runStartedAtRef = useRef<number | null>(null);

  const activityState = activity?.state;
  const isRunning = activityState && activityState !== 'idle' && activityState !== 'waiting_input';

  useEffect(() => {
    const prev = prevActivityRef.current;
    prevActivityRef.current = activityState;

    // Track when running started
    const wasActive = prev && prev !== 'idle' && prev !== 'waiting_input';
    const nowActive = activityState && activityState !== 'idle' && activityState !== 'waiting_input';
    if (nowActive && !wasActive) {
      runStartedAtRef.current = Date.now();
    }

    // Detect transition: was running → now idle
    if (wasActive && activityState === 'idle' && session.status !== 'terminated') {
      // Expanded: user sees the terminal directly, no done flash needed
      // Collapsed + <5s: suppress short tasks, stay idle
      // Collapsed + >=5s: show done after 500ms delay, auto-clear after 3s
      if (!isExpanded) {
        const elapsed = runStartedAtRef.current ? Date.now() - runStartedAtRef.current : 0;
        if (elapsed >= 5000) {
          const timer = setTimeout(() => {
            setJustDone(true);
            setTimeout(() => setJustDone(false), 3000);
          }, 500);
          return () => clearTimeout(timer);
        }
      }
    }
    // Clear done state when entering waiting_input
    if (activityState === 'waiting_input') {
      setJustDone(false);
    }
  }, [activityState, session.status, isExpanded]);

  let displayStatus: DisplayStatus;
  if (session.status === 'terminated') displayStatus = 'disconnected';
  else if (activityState === 'waiting_input') displayStatus = 'waiting_input';
  else if (isRunning) displayStatus = activity!.state as DisplayStatus;
  else if (justDone) displayStatus = 'done';
  else displayStatus = 'idle';

  const clearDone = useCallback(() => setJustDone(false), []);
  return [displayStatus, clearDone];
}

export const STATUS_CONFIG: Record<DisplayStatus, {
  dot: string;
  dotPulse: boolean;
  label: string;
  labelColor: string;
  labelBg: string;
  border: string;
  icon: typeof Circle;
  iconColor: string;
  tintColor: string;
  tintOpacity: number;
}> = {
  disconnected: {
    dot: 'bg-cc-text-muted',
    dotPulse: false,
    label: 'terminated',
    labelColor: 'text-cc-text-muted',
    labelBg: 'bg-cc-bg-surface/50',
    border: 'border-cc-border/60',
    icon: Unplug,
    iconColor: 'text-cc-text-muted',
    tintColor: 'var(--cc-text-muted)',
    tintOpacity: 0.04,
  },
  idle: {
    dot: 'bg-cc-green-text',
    dotPulse: false,
    label: 'idle',
    labelColor: 'text-cc-green-text',
    labelBg: 'bg-cc-green-bg',
    border: 'border-cc-green-border',
    icon: Circle,
    iconColor: 'text-cc-green-text',
    tintColor: 'var(--cc-green-text)',
    tintOpacity: 0.06,
  },
  thinking: {
    dot: 'bg-cc-amber-text',
    dotPulse: true,
    label: 'thinking',
    labelColor: 'text-cc-amber-text',
    labelBg: 'bg-cc-amber-bg',
    border: 'border-cc-amber-border',
    icon: Brain,
    iconColor: 'text-cc-amber-text',
    tintColor: 'var(--cc-amber-text)',
    tintOpacity: 0.12,
  },
  tool_use: {
    dot: 'bg-cc-cyan-text',
    dotPulse: true,
    label: 'running',
    labelColor: 'text-cc-cyan-text',
    labelBg: 'bg-cc-cyan-bg',
    border: 'border-cc-cyan-border',
    icon: Wrench,
    iconColor: 'text-cc-cyan-text',
    tintColor: 'var(--cc-cyan-text)',
    tintOpacity: 0.12,
  },
  writing: {
    dot: 'bg-cc-blue-text',
    dotPulse: true,
    label: 'writing',
    labelColor: 'text-cc-blue-text',
    labelBg: 'bg-cc-blue-bg',
    border: 'border-cc-blue-border',
    icon: Pen,
    iconColor: 'text-cc-blue-text',
    tintColor: 'var(--cc-blue-text)',
    tintOpacity: 0.12,
  },
  done: {
    dot: 'bg-cc-green-text',
    dotPulse: false,
    label: 'done',
    labelColor: 'text-cc-green-text',
    labelBg: 'bg-cc-green-bg',
    border: 'border-cc-green-border',
    icon: CircleCheck,
    iconColor: 'text-cc-green-text',
    tintColor: 'var(--cc-green-text)',
    tintOpacity: 0.12,
  },
  waiting_input: {
    dot: 'bg-cc-orange-text',
    dotPulse: true,
    label: 'waiting',
    labelColor: 'text-cc-orange-text',
    labelBg: 'bg-cc-orange-bg',
    border: 'border-cc-orange-border',
    icon: MessageCircleQuestion,
    iconColor: 'text-cc-orange-text',
    tintColor: 'var(--cc-orange-text)',
    tintOpacity: 0.12,
  },
};
