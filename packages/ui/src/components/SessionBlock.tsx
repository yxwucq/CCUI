import { useRef, useEffect, useState, useCallback, lazy, Suspense } from 'react';
import LiveTimeAgo from './LiveTimeAgo';
import { useSessionStore } from '../stores/sessionStore';
import { useWidgetStore } from '../stores/widgetStore';
import { sendWsMessage } from '../hooks/useWebSocket';
import ChatMessage from './ChatMessage';
import WidgetSelector from './widgets/WidgetSelector';
import ContextWidget from './widgets/ContextWidget';
import GitStatusWidget from './widgets/GitStatusWidget';
import HistoryWidget from './widgets/HistoryWidget';
import UsageWidget from './widgets/UsageWidget';
import FileActivityWidget from './widgets/FileActivityWidget';
import NotesWidget from './widgets/NotesWidget';
import {
  ChevronDown, ChevronRight, GitBranch, Square,
  Send, Trash2, Play, Brain, Wrench, Pen, SquareTerminal,
  MessageSquare, Unplug, CircleCheck, Loader, Circle,
  Maximize2, Minimize2, AlertTriangle, MessageCircleQuestion,
} from 'lucide-react';
import type { Session, SessionActivity } from '@ccui/shared';

const XTerminal = lazy(() => import('./XTerminal'));

interface Props {
  session: Session;
  highlighted?: boolean;
  scrollMode?: boolean;
  onToggleExpanded?: (id: string) => void;
}

const WIDGET_COMPONENTS: Record<string, React.ComponentType<any>> = {
  context: ContextWidget,
  'git-status': GitStatusWidget,
  history: HistoryWidget,
  usage: UsageWidget,
  'file-activity': FileActivityWidget,
  notes: NotesWidget,
};

const EMPTY_MSGS: never[] = [];

type ViewMode = 'terminal' | 'chat';

// Derive a unified display status from session + activity
type DisplayStatus = 'disconnected' | 'idle' | 'thinking' | 'tool_use' | 'writing' | 'done' | 'waiting_input';

function useDisplayStatus(session: Session, activity: SessionActivity | undefined): [DisplayStatus, () => void] {
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

// Status config: icon, colors, label, border
const STATUS_CONFIG: Record<DisplayStatus, {
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

export default function SessionBlock({ session, highlighted, scrollMode, onToggleExpanded }: Props) {
  const isExpanded = useSessionStore((s) => !!s.expandedSessions[session.id]);
  const isFocused = useSessionStore((s) => s.focusedSessionId === session.id);
  const toggleExpanded = useSessionStore((s) => s.toggleExpanded);
  const toggleFocus = useSessionStore((s) => s.toggleFocus);
  const terminateSession = useSessionStore((s) => s.terminateSession);
  const resumeSession = useSessionStore((s) => s.resumeSession);
  const sessionMessages = useSessionStore((s) => s.messages[session.id] ?? EMPTY_MSGS);
  const streaming = useSessionStore((s) => s.streamingContent[session.id] ?? '');
  const activity = useSessionStore((s) => s.activities[session.id]) as SessionActivity | undefined;
  const enabledWidgets = useWidgetStore((s) => {
    const sw = s.sessionWidgets[session.id];
    return sw ?? s.defaultWidgets;
  });
  const sendMessage = sendWsMessage;

  const jumpTarget = useSessionStore((s) => s.chatJumpTarget[session.id]);

  const [input, setInput] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('terminal');
  const [terminalMounted, setTerminalMounted] = useState(false);
  const [splitRatio, setSplitRatio] = useState(0.5); // 0-1, left panel fraction
  const splitContainerRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Drag-to-resize handler
  const handleDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDraggingRef.current = true;
    const container = splitContainerRef.current;
    if (!container) return;

    const onMove = (ev: MouseEvent) => {
      if (!isDraggingRef.current) return;
      const rect = container.getBoundingClientRect();
      const ratio = Math.min(0.8, Math.max(0.2, (ev.clientX - rect.left) / rect.width));
      setSplitRatio(ratio);
    };
    const onUp = () => {
      isDraggingRef.current = false;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, []);

  // Once expanded, keep terminal mounted forever (avoid PTY re-creation)
  // But don't mount for terminated sessions — require explicit resume first
  useEffect(() => {
    if (isExpanded && !terminalMounted && session.status !== 'terminated') setTerminalMounted(true);
  }, [isExpanded, terminalMounted, session.status]);

  // Esc to exit focus mode
  useEffect(() => {
    if (!isFocused) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') toggleFocus(session.id);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isFocused, session.id, toggleFocus]);

  const [displayStatus, clearDone] = useDisplayStatus(session, activity);
  const sc = STATUS_CONFIG[displayStatus];

  useEffect(() => {
    if (isExpanded && viewMode === 'chat') {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [sessionMessages, streaming, isExpanded, viewMode]);

  // Jump to a specific message from HistoryWidget
  useEffect(() => {
    if (!jumpTarget) return;
    useSessionStore.getState().setExpanded(session.id, true);
    setViewMode('chat');
    const msgId = jumpTarget;
    useSessionStore.getState().clearChatJumpTarget(session.id);
    const t = setTimeout(() => {
      document.querySelector(`[data-msg-id="${msgId}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 250);
    return () => clearTimeout(t);
  }, [jumpTarget, session.id]);

  const handleSend = () => {
    if (!input.trim()) return;
    clearDone();
    useSessionStore.getState().appendMessage(session.id, {
      id: crypto.randomUUID(),
      sessionId: session.id,
      role: 'user',
      content: input,
      timestamp: new Date().toISOString(),
    });
    sendMessage({ type: 'chat:input', sessionId: session.id, content: input });
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };


  const isRunning = displayStatus === 'thinking' || displayStatus === 'tool_use' || displayStatus === 'writing';
  const StatusIcon = sc.icon;

  return (
    <div className={`border rounded-lg overflow-hidden transition-all duration-300 flex flex-col ${isExpanded ? (scrollMode ? 'min-h-[480px]' : 'flex-1 min-h-[200px]') : 'shrink-0'} ${sc.border} ${isRunning ? 'session-glow' : ''} ${displayStatus === 'done' ? 'session-done-glow' : ''} ${highlighted ? 'session-activated' : ''} ${session.status === 'terminated' ? 'opacity-60' : ''}`}
      style={isRunning ? { '--glow-color': sc.dot.includes('amber') ? 'rgba(251,191,36,0.15)' : sc.dot.includes('cyan') ? 'rgba(34,211,238,0.15)' : 'rgba(96,165,250,0.15)' } as React.CSSProperties : undefined}
    >
      {/* Header — click to expand, double-click to focus */}
      <div
        className="relative flex items-center gap-2.5 px-3 py-2 bg-gray-900/50 cursor-pointer hover:bg-gray-900/80 transition-colors select-none shrink-0"
        onClick={() => { (onToggleExpanded ?? toggleExpanded)(session.id); if (!isExpanded) clearDone(); }}
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
                onClick={() => setViewMode('terminal')}
                className={`p-1 rounded transition-colors ${
                  viewMode === 'terminal' ? 'text-green-400 bg-green-900/40' : 'text-gray-500 hover:text-gray-300'
                }`}
                title="Terminal mode"
              >
                <SquareTerminal size={13} />
              </button>
              <button
                onClick={() => setViewMode('chat')}
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

      {/* Activity stripe — visible when collapsed and running */}
      {!isExpanded && isRunning && (
        <div className={`h-0.5 ${sc.dot} activity-stripe`} />
      )}

      {/* Expanded content — terminal stays mounted once opened (CSS hidden when collapsed) */}
      {(isExpanded || terminalMounted) && (
        <div
          className="border-t border-gray-800 flex-1 min-h-0 flex flex-col"
          style={{ display: isExpanded ? 'flex' : 'none' }}
        >
          {/* Terminal mode — always mounted once opened, toggled via display */}
          <div
            ref={splitContainerRef}
            className="flex flex-1 min-h-0"
            style={{ display: viewMode === 'terminal' ? 'flex' : 'none' }}
          >
            {/* Terminal pane */}
            <div className="min-h-0 overflow-hidden" style={{ width: `${splitRatio * 100}%` }}>
              {terminalMounted ? (
                <Suspense fallback={<div className="h-full flex items-center justify-center text-gray-600 text-sm">Starting Claude CLI...</div>}>
                  <XTerminal sessionId={session.id} />
                </Suspense>
              ) : session.status === 'terminated' ? (
                <div className="h-full flex flex-col items-center justify-center gap-3 text-gray-500">
                  <Unplug size={24} />
                  <p className="text-sm">Session terminated</p>
                  <button
                    onClick={() => resumeSession(session.id).catch((e: any) => alert(e.message))}
                    className="flex items-center gap-2 px-4 py-1.5 bg-green-700 hover:bg-green-600 text-white text-sm rounded-lg transition-colors"
                  >
                    <Play size={13} />
                    Resume
                  </button>
                </div>
              ) : null}
            </div>
            {/* Drag handle */}
            <div
              className="w-1 shrink-0 cursor-col-resize bg-gray-800 hover:bg-blue-500/50 active:bg-blue-500 transition-colors relative drag-handle"
              onMouseDown={handleDragStart}
            >
              <div className="absolute inset-y-0 -left-1.5 -right-1.5" />
            </div>
            {/* Widget pane */}
            <div className="min-h-0 flex flex-col overflow-hidden bg-gray-950/30" style={{ width: `${(1 - splitRatio) * 100}%` }}>
              {enabledWidgets.length > 0 ? (
                enabledWidgets.map(({ id, size }, idx) => {
                  const Widget = WIDGET_COMPONENTS[id];
                  if (!Widget) return null;
                  return (
                    <div
                      key={id}
                      style={{ flex: size === 'lg' ? 3 : 1 }}
                      className={`min-h-0 p-3 overflow-hidden ${
                        idx > 0 ? 'border-t border-gray-800/60' : ''
                      }`}
                    >
                      <Widget sessionId={session.id} session={session} size={size} />
                    </div>
                  );
                })
              ) : (
                <div className="flex-1 flex items-center justify-center text-xs text-gray-700">
                  Use widget selector to add panels
                </div>
              )}
            </div>
          </div>

          {/* Chat mode */}
          {viewMode === 'chat' && (
            <div className="flex flex-1 min-h-0">
              <div className="flex-1 flex flex-col min-w-0 border-r border-gray-800">
                <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-950/50 min-h-0">
                  {sessionMessages.length === 0 && !streaming && (
                    <div className="text-center text-gray-600 text-sm py-8">
                      {session.status !== 'terminated'
                        ? 'Send a message to start.'
                        : 'No messages.'}
                    </div>
                  )}
                  {sessionMessages.map((msg) => (
                    <ChatMessage key={msg.id} message={msg} />
                  ))}
                  {streaming && (
                    <ChatMessage
                      message={{
                        id: 'streaming',
                        sessionId: session.id,
                        role: 'assistant',
                        content: streaming,
                        timestamp: new Date().toISOString(),
                      }}
                      streaming
                    />
                  )}
                  <div ref={messagesEndRef} />
                </div>
                {session.status !== 'terminated' && (
                  <div className="border-t border-gray-800 p-3 bg-gray-900/30 shrink-0">
                    <div className="flex gap-2">
                      <textarea
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder={isRunning ? 'Claude is working...' : 'Type a message... (Shift+Enter for newline)'}
                        rows={1}
                        disabled={isRunning}
                        className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:border-blue-500 disabled:opacity-50"
                      />
                      <button
                        onClick={handleSend}
                        disabled={!input.trim() || isRunning}
                        className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 px-4 rounded-lg transition-colors"
                      >
                        <Send size={16} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
              {enabledWidgets.length > 0 && (
                <div className="w-72 shrink-0 flex flex-col overflow-hidden bg-gray-950/30">
                  {enabledWidgets.map(({ id, size }, idx) => {
                    const Widget = WIDGET_COMPONENTS[id];
                    if (!Widget) return null;
                    return (
                      <div
                        key={id}
                        style={{ flex: size === 'lg' ? 3 : 1 }}
                        className={`min-h-0 p-3 overflow-hidden ${
                          idx > 0 ? 'border-t border-gray-800/60' : ''
                        }`}
                      >
                        <Widget sessionId={session.id} session={session} size={size} />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
