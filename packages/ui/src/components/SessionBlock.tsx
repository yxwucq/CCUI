import { useRef, useEffect, useState, useCallback, lazy, Suspense } from 'react';
import { useDisplayStatus, STATUS_CONFIG } from './sessionStatus';
import SessionHeader from './SessionHeader';
import SessionMessages from './SessionMessages';
import SessionWidgetBar from './SessionWidgetBar';
import { Play, Unplug } from 'lucide-react';
import type { Session, SessionActivity, ChatMessage } from '@ccui/shared';
import type { WidgetConfig } from '../stores/widgetStore';
import type { SessionUsageSummary } from '../stores/sessionStore';
import type { XTerminalHandle } from './XTerminal';

const XTerminal = lazy(() => import('./XTerminal'));

interface Props {
  session: Session;
  isExpanded: boolean;
  isFocused: boolean;
  activity?: SessionActivity;
  jumpTarget?: string | null;
  enabledWidgets: WidgetConfig[];
  messages: ChatMessage[];
  sessionUsage?: SessionUsageSummary;
  usageCalls: Array<{ cost: number }>;
  highlighted?: boolean;
  scrollMode?: boolean;
  onToggleExpanded?: (id: string) => void;
  onToggleFocus: (id: string) => void;
  onStop: (id: string) => void;
  onTerminate: (id: string) => void;
  onDelete: (id: string) => void;
  onResume: (id: string) => Promise<void>;
  onSetExpanded: (id: string, open: boolean) => void;
  onClearJumpTarget: (id: string) => void;
  fetchSessionUsage: (sessionId: string) => Promise<void>;
  setChatJumpTarget: (sessionId: string, messageId: string) => void;
  onToggleWidget: (sessionId: string, widgetId: string) => void;
  onSetWidgetSize: (sessionId: string, widgetId: string, size: 'sm' | 'lg') => void;
}

export default function SessionBlock({ session, isExpanded, isFocused, activity, jumpTarget, enabledWidgets, messages, sessionUsage, usageCalls, highlighted, scrollMode, onToggleExpanded, onToggleFocus, onStop, onTerminate, onDelete, onResume, onSetExpanded, onClearJumpTarget, fetchSessionUsage, setChatJumpTarget, onToggleWidget, onSetWidgetSize }: Props) {

  const [viewMode, setViewMode] = useState<'terminal' | 'history'>('terminal');
  const [terminalMounted, setTerminalMounted] = useState(false);
  const [splitRatio, setSplitRatio] = useState(0.5);
  const splitContainerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<XTerminalHandle>(null);
  const isDraggingRef = useRef(false);

  const [displayStatus, clearDone] = useDisplayStatus(session, activity, isExpanded);
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

  // Auto-focus terminal when session expands
  useEffect(() => {
    if (isExpanded && viewMode === 'terminal' && terminalRef.current) {
      const t = setTimeout(() => terminalRef.current?.focus(), 150);
      return () => clearTimeout(t);
    }
  }, [isExpanded, viewMode]);

  // Esc to exit focus mode
  useEffect(() => {
    if (!isFocused) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onToggleFocus(session.id);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isFocused, session.id, onToggleFocus]);

  // Jump to a specific message from HistoryWidget
  useEffect(() => {
    if (!jumpTarget) return;
    onSetExpanded(session.id, true);
    setViewMode('history');
    const msgId = jumpTarget;
    onClearJumpTarget(session.id);
    const t = setTimeout(() => {
      document.querySelector(`[data-msg-id="${msgId}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 250);
    return () => clearTimeout(t);
  }, [jumpTarget, session.id]);

  return (
    <div className={`border rounded-lg overflow-hidden transition-[border-color,box-shadow,opacity] duration-300 flex flex-col flex-1 min-h-0 ${sc.border} ${isRunning ? 'session-glow' : ''} ${displayStatus === 'done' ? 'session-done-glow' : ''} ${highlighted ? 'session-activated' : ''} ${session.status === 'terminated' ? 'opacity-60' : ''}`}
      style={isRunning ? { '--glow-color': sc.dot.includes('amber') ? 'rgba(251,191,36,0.15)' : sc.dot.includes('cyan') ? 'rgba(34,211,238,0.15)' : 'rgba(96,165,250,0.15)' } as React.CSSProperties : undefined}
    >
      <SessionHeader
        session={session}
        displayStatus={displayStatus}
        viewMode={viewMode}
        isExpanded={isExpanded}
        isFocused={isFocused}
        activity={activity}
        enabledWidgets={enabledWidgets}
        onSetViewMode={setViewMode}
        onClearDone={clearDone}
        onToggleExpanded={isFocused ? undefined : onToggleExpanded}
        onToggleFocus={onToggleFocus}
        onStop={onStop}
        onTerminate={onTerminate}
        onDelete={onDelete}
        onResume={onResume}
        onToggleWidget={onToggleWidget}
        onSetWidgetSize={onSetWidgetSize}
      />

      {/* Activity stripe — visible when collapsed and running */}
      {!isExpanded && isRunning && (
        <div className={`h-0.5 ${sc.dot} activity-stripe`} />
      )}

      {/* Expanded content — terminal stays mounted once opened (CSS hidden when collapsed) */}
      {(isExpanded || terminalMounted) && (
        <div
          className="border-t border-cc-border/50 flex-1 min-h-0 flex flex-col"
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
                <Suspense fallback={<div className="h-full flex items-center justify-center text-cc-text-muted text-sm">Starting Claude CLI...</div>}>
                  <XTerminal ref={terminalRef} sessionId={session.id} />
                </Suspense>
              ) : session.status === 'terminated' ? (
                <div className="h-full flex flex-col items-center justify-center gap-3 text-cc-text-muted">
                  <Unplug size={24} />
                  <p className="text-sm">Session terminated</p>
                  <button
                    onClick={() => onResume(session.id).catch((e: any) => alert(e.message))}
                    className="flex items-center gap-2 px-4 py-1.5 bg-cc-green-text hover:bg-cc-green-text text-white text-sm rounded-lg transition-colors"
                  >
                    <Play size={13} />
                    Resume
                  </button>
                </div>
              ) : null}
            </div>
            {/* Drag handle */}
            <div
              className="w-1 shrink-0 cursor-col-resize bg-cc-bg-surface hover:bg-cc-accent/50 active:bg-cc-accent transition-colors relative drag-handle"
              onMouseDown={handleDragStart}
            >
              <div className="absolute inset-y-0 -left-1.5 -right-1.5" />
            </div>
            {/* Widget pane */}
            <div className="min-h-0 flex flex-col overflow-hidden bg-transparent" style={{ width: `${(1 - splitRatio) * 100}%` }}>
              <SessionWidgetBar sessionId={session.id} session={session} enabledWidgets={enabledWidgets} messages={messages} sessionUsage={sessionUsage} usageCalls={usageCalls} callCount={sessionUsage?.callCount ?? 0} fetchSessionUsage={fetchSessionUsage} setChatJumpTarget={setChatJumpTarget} emptyMessage="Use widget selector to add panels" />
            </div>
          </div>

          {/* History mode — read-only message view */}
          {viewMode === 'history' && (
            <div className="flex flex-1 min-h-0">
              <SessionMessages session={session} messages={messages} />
              {enabledWidgets.length > 0 && (
                <div className="w-72 shrink-0 flex flex-col overflow-hidden bg-transparent">
                  <SessionWidgetBar sessionId={session.id} session={session} enabledWidgets={enabledWidgets} messages={messages} sessionUsage={sessionUsage} usageCalls={usageCalls} callCount={sessionUsage?.callCount ?? 0} fetchSessionUsage={fetchSessionUsage} setChatJumpTarget={setChatJumpTarget} />
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
