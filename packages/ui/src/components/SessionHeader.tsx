import { useSessionStore } from '../stores/sessionStore';
import { DisplayStatus, STATUS_CONFIG } from './sessionStatus';
import WidgetSelector from './widgets/WidgetSelector';
import LiveTimeAgo from './LiveTimeAgo';
import {
  ChevronDown, ChevronRight, GitBranch, Square,
  Play, Trash2, SquareTerminal, MessageSquare,
  Maximize2, Minimize2, AlertTriangle, CircleCheck,
  Unplug, MessageCircleQuestion,
} from 'lucide-react';
import type { Session, SessionActivity } from '@ccui/shared';

type ViewMode = 'terminal' | 'chat';

interface Props {
  session: Session;
  displayStatus: DisplayStatus;
  viewMode: ViewMode;
  onSetViewMode: (mode: ViewMode) => void;
  onClearDone: () => void;
  onToggleExpanded?: (id: string) => void;
}

export default function SessionHeader({ session, displayStatus, viewMode, onSetViewMode, onClearDone, onToggleExpanded }: Props) {
  const isExpanded = useSessionStore((s) => !!s.expandedSessions[session.id]);
  const isFocused = useSessionStore((s) => s.focusedSessionId === session.id);
  const toggleExpanded = useSessionStore((s) => s.toggleExpanded);
  const toggleFocus = useSessionStore((s) => s.toggleFocus);
  const terminateSession = useSessionStore((s) => s.terminateSession);
  const resumeSession = useSessionStore((s) => s.resumeSession);
  const activity = useSessionStore((s) => s.activities[session.id]) as SessionActivity | undefined;

  const sc = STATUS_CONFIG[displayStatus];
  const isRunning = displayStatus === 'thinking' || displayStatus === 'tool_use' || displayStatus === 'writing';
  const StatusIcon = sc.icon;

  return (
    <div
      className="relative flex items-center gap-2.5 px-3 py-2 bg-gray-900/50 cursor-pointer hover:bg-gray-900/80 transition-colors select-none shrink-0"
      onClick={() => { (onToggleExpanded ?? toggleExpanded)(session.id); if (!isExpanded) onClearDone(); }}
    >
      {/* Status tint overlay */}
      <div
        className={`absolute inset-0 pointer-events-none ${!isExpanded && isRunning ? 'status-breathe' : ''}`}
        style={{
          backgroundColor: sc.tintColor,
          opacity: isExpanded ? 0.03 : (isRunning ? undefined : sc.tintOpacity),
          transition: 'opacity 0.6s ease, background-color 0.8s ease',
        }}
      />

      {isExpanded
        ? <ChevronDown size={14} className="text-gray-500 shrink-0" />
        : <ChevronRight size={14} className="text-gray-500 shrink-0" />
      }

      {/* Status dot */}
      <span className={`w-2 h-2 rounded-full shrink-0 transition-colors duration-300 ${sc.dot} ${sc.dotPulse ? 'animate-pulse' : ''} ${displayStatus === 'done' ? 'done-blink' : ''}`} />

      {/* Session name */}
      <span className="font-medium text-sm text-gray-200 truncate">
        {session.name}
      </span>

      {/* Skip permissions warning */}
      {session.skipPermissions && (
        <span className="flex items-center gap-1 text-xs text-yellow-400 bg-yellow-900/30 px-1.5 py-0.5 rounded-full shrink-0" title="Skip permissions enabled">
          <AlertTriangle size={11} />
        </span>
      )}

      {/* Branch */}
      {session.branch && (
        <span className="flex items-center gap-1 text-xs text-purple-400 bg-purple-900/30 px-2 py-0.5 rounded-full shrink-0">
          <GitBranch size={11} />
          {session.branch}
        </span>
      )}

      {/* Activity preview — when running */}
      {isRunning && activity && activity.state !== 'idle' && (
        <span className={`flex items-center gap-1.5 text-xs truncate max-w-[40%] ml-auto ${sc.labelColor}`}>
          <StatusIcon size={12} className={`shrink-0 ${displayStatus === 'tool_use' ? 'animate-spin' : 'animate-pulse'}`}
            style={displayStatus === 'tool_use' ? { animationDuration: '2s' } : undefined} />
          <span className="truncate opacity-70 font-mono">
            {activity.state === 'thinking' && (activity.preview || 'Thinking...')}
            {activity.state === 'tool_use' && ((activity as any).tool + (activity.preview ? `: ${activity.preview}` : ''))}
            {activity.state === 'writing' && (activity.preview || 'Writing...')}
          </span>
        </span>
      )}

      {/* Waiting for input indicator */}
      {displayStatus === 'waiting_input' && (
        <span className={`flex items-center gap-1.5 text-xs ml-auto ${sc.labelColor}`}>
          <MessageCircleQuestion size={12} className="shrink-0 animate-pulse" />
          <span className="opacity-70">Needs input</span>
        </span>
      )}

      {/* Time — when not running */}
      {!isRunning && displayStatus !== 'waiting_input' && (
        <LiveTimeAgo iso={session.lastActiveAt} className="text-xs text-gray-600 shrink-0 ml-auto" />
      )}

      {/* Status badge */}
      <span className={`text-xs px-1.5 py-0.5 rounded shrink-0 flex items-center gap-1.5 transition-colors duration-300 ${sc.labelColor} ${sc.labelBg}`}>
        {sc.dotPulse && (
          <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${sc.dot}`} />
        )}
        {displayStatus === 'done' && <CircleCheck size={11} />}
        {displayStatus === 'disconnected' && <Unplug size={11} />}
        {displayStatus === 'waiting_input' && <MessageCircleQuestion size={11} />}
        {sc.label}
      </span>

      {/* Action buttons */}
      <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
        {isExpanded && (
          <div className="flex items-center bg-gray-800/50 rounded-md p-0.5 gap-0.5">
            <button
              onClick={() => onSetViewMode('terminal')}
              className={`p-1 rounded transition-colors ${
                viewMode === 'terminal' ? 'text-green-400 bg-green-900/40' : 'text-gray-500 hover:text-gray-300'
              }`}
              title="Terminal mode"
            >
              <SquareTerminal size={13} />
            </button>
            <button
              onClick={() => onSetViewMode('chat')}
              className={`p-1 rounded transition-colors ${
                viewMode === 'chat' ? 'text-blue-400 bg-blue-900/40' : 'text-gray-500 hover:text-gray-300'
              }`}
              title="Chat mode"
            >
              <MessageSquare size={13} />
            </button>
          </div>
        )}
        {isExpanded && <WidgetSelector sessionId={session.id} />}
        {/* Focus/unfocus button */}
        {isExpanded && (
          <button
            onClick={() => toggleFocus(session.id)}
            className="p-1 text-gray-500 hover:text-gray-300 hover:bg-gray-800 rounded transition-colors"
            title={isFocused ? 'Exit focus (Esc)' : 'Focus this session'}
          >
            {isFocused ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
          </button>
        )}
        {session.status !== 'terminated' && (
          <button
            onClick={() => terminateSession(session.id)}
            className="p-1 text-red-400/60 hover:text-red-400 hover:bg-red-900/30 rounded transition-colors"
            title="Stop session"
          >
            <Square size={13} />
          </button>
        )}
        {session.status === 'terminated' && (
          <>
            <button
              onClick={() => resumeSession(session.id).catch((e: any) => alert(e.message))}
              className="p-1 text-green-400 hover:bg-green-900/30 rounded transition-colors"
              title="Resume session"
            >
              <Play size={13} />
            </button>
            <button
              onClick={() => terminateSession(session.id)}
              className="p-1 text-gray-500 hover:bg-gray-800 rounded transition-colors"
              title="Remove session"
            >
              <Trash2 size={13} />
            </button>
          </>
        )}
      </div>
    </div>
  );
}
