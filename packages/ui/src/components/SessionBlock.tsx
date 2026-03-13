import { useRef, useEffect, useState, useCallback, lazy, Suspense } from 'react';
import { useSessionStore } from '../stores/sessionStore';
import { useWidgetStore } from '../stores/widgetStore';
import { useDisplayStatus, STATUS_CONFIG } from './sessionStatus';
import SessionHeader from './SessionHeader';
import SessionMessages from './SessionMessages';
import SessionWidgetBar from './SessionWidgetBar';
import { Play, Unplug } from 'lucide-react';
import type { Session, SessionActivity } from '@ccui/shared';

const XTerminal = lazy(() => import('./XTerminal'));

interface Props {
  session: Session;
  highlighted?: boolean;
  scrollMode?: boolean;
  onToggleExpanded?: (id: string) => void;
}

export default function SessionBlock({ session, highlighted, scrollMode, onToggleExpanded }: Props) {
  const isExpanded = useSessionStore((s) => !!s.expandedSessions[session.id]);
  const isFocused = useSessionStore((s) => s.focusedSessionId === session.id);
  const toggleFocus = useSessionStore((s) => s.toggleFocus);
  const resumeSession = useSessionStore((s) => s.resumeSession);
  const activity = useSessionStore((s) => s.activities[session.id]) as SessionActivity | undefined;
  const jumpTarget = useSessionStore((s) => s.chatJumpTarget[session.id]);
  const enabledWidgets = useWidgetStore((s) => {
    const sw = s.sessionWidgets[session.id];
    return sw ?? s.defaultWidgets;
  });

  const [viewMode, setViewMode] = useState<'terminal' | 'chat'>('terminal');
  const [terminalMounted, setTerminalMounted] = useState(false);
  const [splitRatio, setSplitRatio] = useState(0.5);
  const splitContainerRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);

  const [displayStatus, clearDone] = useDisplayStatus(session, activity);
  const sc = STATUS_CONFIG[displayStatus];
  const isRunning = displayStatus === 'thinking' || displayStatus === 'tool_use' || displayStatus === 'writing';

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

  return (
    <div className={`border rounded-lg overflow-hidden transition-all duration-300 flex flex-col ${isExpanded ? (scrollMode ? 'min-h-[480px]' : 'flex-1 min-h-[200px]') : 'shrink-0'} ${sc.border} ${isRunning ? 'session-glow' : ''} ${displayStatus === 'done' ? 'session-done-glow' : ''} ${highlighted ? 'session-activated' : ''} ${session.status === 'terminated' ? 'opacity-60' : ''}`}
      style={isRunning ? { '--glow-color': sc.dot.includes('amber') ? 'rgba(251,191,36,0.15)' : sc.dot.includes('cyan') ? 'rgba(34,211,238,0.15)' : 'rgba(96,165,250,0.15)' } as React.CSSProperties : undefined}
    >
      <SessionHeader
        session={session}
        displayStatus={displayStatus}
        viewMode={viewMode}
        onSetViewMode={setViewMode}
        onClearDone={clearDone}
        onToggleExpanded={onToggleExpanded}
      />

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
              <SessionWidgetBar sessionId={session.id} session={session} emptyMessage="Use widget selector to add panels" />
            </div>
          </div>

          {/* Chat mode */}
          {viewMode === 'chat' && (
            <div className="flex flex-1 min-h-0">
              <SessionMessages session={session} isRunning={isRunning} onClearDone={clearDone} />
              {enabledWidgets.length > 0 && (
                <div className="w-72 shrink-0 flex flex-col overflow-hidden bg-gray-950/30">
                  <SessionWidgetBar sessionId={session.id} session={session} />
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
