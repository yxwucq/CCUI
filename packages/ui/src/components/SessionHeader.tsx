import { useState, useCallback, useRef, useEffect } from 'react';
import { DisplayStatus, STATUS_CONFIG } from './sessionStatus';
import WidgetSelector from './widgets/WidgetSelector';
import LiveTimeAgo from './LiveTimeAgo';
import ContextMenu, { type MenuItem } from './ContextMenu';
import {
  ChevronDown, ChevronRight, GitBranch, Square,
  Play, Trash2, SquareTerminal, MessageSquare,
  Maximize2, Minimize2, AlertTriangle, CircleCheck,
  Unplug, MessageCircleQuestion, XCircle, Link2,
  Tag, X, Copy, Pencil,
} from 'lucide-react';
import type { Session, SessionActivity } from '@ccui/shared';
import { useWidgetStore, getTagDef, PRESET_TAGS, type WidgetConfig } from '../stores/widgetStore';
import { useSessionStore } from '../stores/sessionStore';

type ViewMode = 'terminal' | 'chat';

interface Props {
  session: Session;
  displayStatus: DisplayStatus;
  viewMode: ViewMode;
  isExpanded: boolean;
  isFocused: boolean;
  activity?: SessionActivity;
  enabledWidgets: WidgetConfig[];
  onSetViewMode: (mode: ViewMode) => void;
  onClearDone: () => void;
  onToggleExpanded?: (id: string) => void;
  onToggleFocus: (id: string) => void;
  onStop: (id: string) => void;
  onTerminate: (id: string) => void;
  onDelete: (id: string) => void;
  onResume: (id: string) => Promise<void>;
  onToggleWidget: (sessionId: string, widgetId: string) => void;
  onSetWidgetSize: (sessionId: string, widgetId: string, size: 'sm' | 'lg') => void;
}

const EMPTY_TAGS: string[] = [];

export default function SessionHeader({ session, displayStatus, viewMode, isExpanded, isFocused, activity, enabledWidgets, onSetViewMode, onClearDone, onToggleExpanded, onToggleFocus, onStop, onTerminate, onDelete, onResume, onToggleWidget, onSetWidgetSize }: Props) {

  const tags = useWidgetStore((s) => s.sessionTags[session.id]) ?? EMPTY_TAGS;
  const addTag = useWidgetStore((s) => s.addTag);
  const removeTag = useWidgetStore((s) => s.removeTag);

  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const [customTag, setCustomTag] = useState('');
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const renameInputRef = useRef<HTMLInputElement>(null);
  const renameSession = useSessionStore((s) => s.renameSession);

  const startRename = useCallback(() => {
    if (session.sessionType === 'head') return;
    setRenameValue(session.name);
    setIsRenaming(true);
  }, [session.sessionType, session.name]);

  const commitRename = useCallback((value: string) => {
    const trimmed = value.trim();
    setIsRenaming(false);
    if (trimmed && trimmed !== session.name) {
      renameSession(session.id, trimmed);
    }
  }, [session.name, session.id, renameSession]);

  useEffect(() => {
    if (isRenaming && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [isRenaming]);

  const sc = STATUS_CONFIG[displayStatus];
  const isRunning = displayStatus === 'thinking' || displayStatus === 'tool_use' || displayStatus === 'writing';
  const StatusIcon = sc.icon;

  const closeMenu = useCallback(() => { setMenu(null); setCustomTag(''); }, []);

  const menuItems: MenuItem[] = [
    {
      label: 'Add Tag',
      icon: <Tag size={12} />,
      children: PRESET_TAGS
        .filter((t) => !tags.includes(t.label))
        .map((t) => ({
          label: t.label,
          icon: <span className={`w-2 h-2 rounded-full ${t.color}`} style={{ backgroundColor: 'currentColor', opacity: 0.7 }} />,
          onClick: () => addTag(session.id, t.label),
        })),
      customRender: (
        <input
          value={customTag}
          onChange={(e) => setCustomTag(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              const val = customTag.trim();
              if (val) { addTag(session.id, val); setCustomTag(''); closeMenu(); }
            }
            if (e.key === 'Escape') closeMenu();
          }}
          onClick={(e) => e.stopPropagation()}
          placeholder="Custom tag..."
          className="w-full bg-transparent text-xs text-cc-text placeholder:text-cc-text-muted/50 py-1 focus:outline-none"
          autoFocus
        />
      ),
    },
    ...(session.sessionType !== 'head' ? [{
      label: 'Rename',
      icon: <Pencil size={12} />,
      onClick: () => startRename(),
    }] : []),
    ...(session.branch ? [{
      label: 'Copy Branch Name',
      icon: <Copy size={12} />,
      onClick: () => { navigator.clipboard.writeText(session.branch!); },
    }] : []),
    ...(session.worktreePath ? [{
      label: 'Copy Worktree Path',
      icon: <Copy size={12} />,
      onClick: () => { navigator.clipboard.writeText(session.worktreePath!); },
    }] : []),
  ];

  return (
    <>
      <div
        className="relative flex items-center gap-2.5 px-3 py-2 cursor-pointer hover:bg-white/[0.03] transition-colors select-none shrink-0"
        onClick={() => { if (onToggleExpanded) onToggleExpanded(session.id); if (!isExpanded) onClearDone(); }}
        onContextMenu={(e) => { e.preventDefault(); setMenu({ x: e.clientX, y: e.clientY }); }}
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
          ? <ChevronDown size={14} className="text-cc-text-muted shrink-0" />
          : <ChevronRight size={14} className="text-cc-text-muted shrink-0" />
        }

        {/* Status dot */}
        <span className={`w-2 h-2 rounded-full shrink-0 transition-colors duration-300 ${sc.dot} ${sc.dotPulse ? 'animate-pulse' : ''} ${displayStatus === 'done' ? 'done-blink' : ''}`} />

        {/* Session name */}
        {isRenaming ? (
          <input
            ref={renameInputRef}
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); commitRename(e.currentTarget.value); }
              if (e.key === 'Escape') setIsRenaming(false);
              e.stopPropagation();
            }}
            onBlur={(e) => commitRename(e.currentTarget.value)}
            onClick={(e) => e.stopPropagation()}
            maxLength={100}
            className="font-medium text-sm text-cc-text bg-cc-bg-surface border border-cc-border rounded px-1.5 py-0.5 outline-none focus:border-cc-blue-text min-w-[80px] max-w-[200px]"
          />
        ) : (
          <span
            className="font-medium text-sm text-cc-text truncate"
            onDoubleClick={(e) => { e.stopPropagation(); startRename(); }}
          >
            {session.name}
          </span>
        )}

        {/* Skip permissions warning */}
        {session.skipPermissions && (
          <span className="flex items-center gap-1 text-xs text-cc-yellow-text bg-cc-yellow-bg px-1.5 py-0.5 rounded-full shrink-0" title="Skip permissions enabled">
            <AlertTriangle size={11} />
          </span>
        )}

        {/* Branch */}
        {(session.branch || session.targetBranch) && (
          <span
            className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full shrink-0 ${
              session.sessionType === 'head'
                ? 'text-cc-emerald-text bg-cc-emerald-bg'
                : session.sessionType === 'attach'
                  ? 'text-cc-blue-text bg-cc-blue-bg'
                  : 'text-cc-purple-text bg-cc-purple-bg'
            }`}
            title={session.sessionType === 'fork' && session.targetBranch ? `forked from ${session.targetBranch}` : undefined}
          >
            {session.sessionType === 'head' ? <GitBranch size={11} /> : session.sessionType === 'attach' ? <Link2 size={11} /> : <GitBranch size={11} />}
            {session.sessionType === 'head' ? `HEAD (${session.branch})` : (session.branch || session.targetBranch)}
          </span>
        )}

        {/* Tags */}
        {tags.map((tag) => {
          const def = getTagDef(tag);
          return (
            <span
              key={tag}
              className={`group/tag relative text-[10px] font-medium px-3 py-0.5 rounded-full shrink-0 ${def.color} ${def.bg}`}
            >
              <span className="inline-block transition-transform duration-150 group-hover/tag:-translate-x-1">
                {tag}
              </span>
              <button
                onClick={(e) => { e.stopPropagation(); removeTag(session.id, tag); }}
                className="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover/tag:opacity-100 transition-opacity duration-150"
              >
                <X size={10} />
              </button>
            </span>
          );
        })}

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
          <LiveTimeAgo iso={session.lastActiveAt} className="text-xs text-cc-text-muted shrink-0 ml-auto" />
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
            <div className="flex items-center bg-cc-bg-surface/50 rounded-md p-0.5 gap-0.5">
              <button
                onClick={() => onSetViewMode('terminal')}
                className={`p-1 rounded transition-colors ${
                  viewMode === 'terminal' ? 'text-cc-green-text bg-cc-green-bg' : 'text-cc-text-muted hover:text-cc-text'
                }`}
                title="Terminal mode"
              >
                <SquareTerminal size={13} />
              </button>
              <button
                onClick={() => onSetViewMode('chat')}
                className={`p-1 rounded transition-colors ${
                  viewMode === 'chat' ? 'text-cc-blue-text bg-cc-blue-bg' : 'text-cc-text-muted hover:text-cc-text'
                }`}
                title="Chat mode"
              >
                <MessageSquare size={13} />
              </button>
            </div>
          )}
          {isExpanded && <WidgetSelector sessionId={session.id} enabled={enabledWidgets} onToggleWidget={onToggleWidget} onSetWidgetSize={onSetWidgetSize} />}
          {/* Focus/unfocus button */}
          {isExpanded && (
            <button
              onClick={() => onToggleFocus(session.id)}
              className="p-1 text-cc-text-muted hover:text-cc-text hover:bg-cc-bg-surface rounded transition-colors"
              title={isFocused ? 'Exit focus (Esc)' : 'Focus this session'}
            >
              {isFocused ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
            </button>
          )}
          {/* Active → Stop button */}
          {session.status === 'active' && (
            <button
              onClick={() => onStop(session.id)}
              className="p-1 text-cc-red-text/60 hover:text-cc-red-text hover:bg-cc-red-bg rounded transition-colors"
              title="Stop (pause session)"
            >
              <Square size={13} />
            </button>
          )}
          {/* Idle → Resume + Terminate buttons (not for head session) */}
          {session.status === 'idle' && session.sessionType !== 'head' && (
            <>
              <button
                onClick={() => onTerminate(session.id)}
                className="p-1 text-cc-orange-text/60 hover:text-cc-orange-text hover:bg-cc-orange-bg rounded transition-colors"
                title="Terminate session"
              >
                <XCircle size={13} />
              </button>
            </>
          )}
          {/* Terminated → Resume + Delete buttons (not for head session) */}
          {session.status === 'terminated' && session.sessionType !== 'head' && (
            <>
              <button
                onClick={() => onResume(session.id).catch((e: any) => alert(e.message))}
                className="p-1 text-cc-green-text hover:bg-cc-green-bg rounded transition-colors"
                title="Resume session"
              >
                <Play size={13} />
              </button>
              <button
                onClick={() => onDelete(session.id)}
                className="p-1 text-cc-text-muted hover:text-cc-red-text hover:bg-cc-red-bg rounded transition-colors"
                title="Delete session"
              >
                <Trash2 size={13} />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Right-click context menu */}
      {menu && (
        <ContextMenu x={menu.x} y={menu.y} items={menuItems} onClose={closeMenu} />
      )}
    </>
  );
}
