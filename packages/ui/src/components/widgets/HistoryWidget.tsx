import { useMemo } from 'react';
import { MessageSquare, User } from 'lucide-react';
import { useContainerHeight, effectiveSize } from '../../hooks/useContainerHeight';
import type { Session, ChatMessage } from '@ccui/shared';

interface Props {
  sessionId: string;
  session?: Session;
  size: 'sm' | 'lg';
  messages: ChatMessage[];
  callCount: number;
  setChatJumpTarget: (sessionId: string, messageId: string) => void;
}

function formatDuration(ms: number): string {
  if (ms < 60_000) return '< 1m';
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  if (h === 0) return `${m}m`;
  return `${h}h ${m}m`;
}

export default function HistoryWidget({ sessionId, session, size, messages, callCount, setChatJumpTarget }: Props) {
  const [containerRef, containerHeight] = useContainerHeight();
  const renderSize = effectiveSize(size, containerHeight);

  const { userMsgs, duration } = useMemo(() => {
    const start = session?.createdAt ?? messages[0]?.timestamp;
    const end = session?.lastActiveAt ?? messages[messages.length - 1]?.timestamp;
    const durationMs = start && end ? new Date(end).getTime() - new Date(start).getTime() : null;
    return {
      userMsgs: messages.filter((m) => m.role === 'user'),
      duration: durationMs != null ? formatDuration(durationMs) : null,
    };
  }, [session?.createdAt, session?.lastActiveAt, messages]);

  return (
    <div ref={containerRef} className="h-full flex flex-col">
      <div className="flex items-center gap-2 text-xs font-medium text-cc-text-secondary mb-2 shrink-0">
        <MessageSquare size={12} />
        <span>History</span>
      </div>

      {/* sm: compact single row */}
      {renderSize === 'sm' && (
        <div className="flex items-center gap-3 text-xs">
          <span className="font-mono text-cc-blue-text">{callCount}</span>
          <span className="text-cc-text-muted">turns</span>
          {messages.length > 0 && (
            <>
              <span className="font-mono text-cc-text-secondary flex items-center gap-0.5">
                <User size={10} />{userMsgs.length}
              </span>
              <span className="text-cc-text-muted">msgs</span>
            </>
          )}
          {duration && <span className="text-cc-text-muted ml-auto">{duration}</span>}
        </div>
      )}

      {/* lg: stats + recent user messages */}
      {renderSize === 'lg' && (
        <div className="flex-1 flex flex-col gap-2 min-h-0">
          {/* Stats row */}
          <div className="flex items-center gap-3 text-xs shrink-0">
            <span className="font-mono text-cc-blue-text">{callCount}</span>
            <span className="text-cc-text-muted">turns</span>
            {messages.length > 0 && (
              <>
                <span className="font-mono text-cc-text-secondary flex items-center gap-0.5">
                  <User size={10} />{userMsgs.length}
                </span>
                <span className="text-cc-text-muted">msgs</span>
              </>
            )}
            {duration && <span className="text-cc-text-muted ml-auto">{duration}</span>}
          </div>

          {/* Recent user messages — click to jump */}
          <div className="flex-1 overflow-y-auto space-y-0.5 min-h-0">
            {userMsgs.length === 0 ? (
              <div className="text-cc-text-muted text-xs text-center pt-2">
                {callCount > 0 ? 'Using terminal mode' : 'No messages yet'}
              </div>
            ) : (
              userMsgs.slice(-8).map((msg) => (
                <button
                  key={msg.id}
                  onClick={() => setChatJumpTarget(sessionId, msg.id)}
                  className="w-full text-left flex items-start gap-1.5 px-2 py-1 rounded hover:bg-cc-bg-surface/50 group transition-colors"
                >
                  <User size={9} className="text-cc-blue-text shrink-0 mt-0.5" />
                  <span className="text-xs text-cc-text-secondary group-hover:text-cc-text truncate leading-relaxed flex-1">
                    {msg.content.replace(/\n/g, ' ')}
                  </span>
                  <span className="text-[10px] text-cc-text-muted shrink-0 ml-1">
                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
