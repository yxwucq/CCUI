import { useRef, useState, useEffect, useCallback } from 'react';
import type { Session, SessionActivity } from '@ccui/shared';
import {
  Brain, Wrench, Pen, Circle, CircleCheck,
  Unplug, MessageCircleQuestion,
} from 'lucide-react';

export type DisplayStatus = 'disconnected' | 'idle' | 'thinking' | 'tool_use' | 'writing' | 'done' | 'waiting_input';

export function useDisplayStatus(session: Session, activity: SessionActivity | undefined): [DisplayStatus, () => void] {
  const [justDone, setJustDone] = useState(false);
  const prevActivityRef = useRef<string | undefined>(undefined);

  const activityState = activity?.state;
  const isRunning = activityState && activityState !== 'idle' && activityState !== 'waiting_input';

  useEffect(() => {
    const prev = prevActivityRef.current;
    prevActivityRef.current = activityState;

    // Detect transition: was running → now idle (not waiting_input, which is a distinct state)
    if (prev && prev !== 'idle' && prev !== 'waiting_input' && activityState === 'idle' && session.status !== 'terminated') {
      setJustDone(true);
    }
    // Clear done state when entering waiting_input
    if (activityState === 'waiting_input') {
      setJustDone(false);
    }
  }, [activityState, session.status]);

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
    dot: 'bg-gray-600',
    dotPulse: false,
    label: 'terminated',
    labelColor: 'text-gray-600',
    labelBg: 'bg-gray-800/50',
    border: 'border-gray-800/60',
    icon: Unplug,
    iconColor: 'text-gray-600',
    tintColor: 'rgb(75,85,99)',
    tintOpacity: 0.04,
  },
  idle: {
    dot: 'bg-green-700',
    dotPulse: false,
    label: 'idle',
    labelColor: 'text-green-700',
    labelBg: 'bg-green-900/30',
    border: 'border-green-900/40',
    icon: Circle,
    iconColor: 'text-green-700',
    tintColor: 'rgb(21,128,61)',
    tintOpacity: 0.06,
  },
  thinking: {
    dot: 'bg-amber-500',
    dotPulse: true,
    label: 'thinking',
    labelColor: 'text-amber-400',
    labelBg: 'bg-amber-900/30',
    border: 'border-amber-900/50',
    icon: Brain,
    iconColor: 'text-amber-400',
    tintColor: 'rgb(245,158,11)',
    tintOpacity: 0.12,
  },
  tool_use: {
    dot: 'bg-cyan-500',
    dotPulse: true,
    label: 'running',
    labelColor: 'text-cyan-400',
    labelBg: 'bg-cyan-900/30',
    border: 'border-cyan-900/50',
    icon: Wrench,
    iconColor: 'text-cyan-400',
    tintColor: 'rgb(6,182,212)',
    tintOpacity: 0.12,
  },
  writing: {
    dot: 'bg-blue-500',
    dotPulse: true,
    label: 'writing',
    labelColor: 'text-blue-400',
    labelBg: 'bg-blue-900/30',
    border: 'border-blue-900/50',
    icon: Pen,
    iconColor: 'text-blue-400',
    tintColor: 'rgb(59,130,246)',
    tintOpacity: 0.12,
  },
  done: {
    dot: 'bg-green-300',
    dotPulse: false,
    label: 'done',
    labelColor: 'text-green-300',
    labelBg: 'bg-green-800/30',
    border: 'border-green-300/60',
    icon: CircleCheck,
    iconColor: 'text-green-300',
    tintColor: 'rgb(134,239,172)',
    tintOpacity: 0.12,
  },
  waiting_input: {
    dot: 'bg-orange-400',
    dotPulse: true,
    label: 'waiting',
    labelColor: 'text-orange-400',
    labelBg: 'bg-orange-900/30',
    border: 'border-orange-900/50',
    icon: MessageCircleQuestion,
    iconColor: 'text-orange-400',
    tintColor: 'rgb(251,146,60)',
    tintOpacity: 0.12,
  },
};
