import { useMemo } from 'react';
import { useSessionStore } from '../../stores/sessionStore';
import { MessageSquare, User } from 'lucide-react';
import { useContainerHeight, effectiveSize } from '../../hooks/useContainerHeight';
import type { Session } from '@ccui/shared';

interface Props {
  sessionId: string;
  session?: Session;
  size: 'sm' | 'lg';
}

function formatDuration(ms: number): string {
  if (ms < 60_000) return '< 1m';
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  if (h === 0) return `${m}m`;
  return `${h}h ${m}m`;
}

const EMPTY: never[] = [];

export default function HistoryWidget({ sessionId, session, size }: Props) {
  const messages = useSessionStore((s) => s.messages[sessionId] ?? EMPTY);
  const callCount = useSessionStore((s) => s.sessionUsage[sessionId]?.callCount ?? 0);
  const setChatJumpTarget = useSessionStore((s) => s.setChatJumpTarget);
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
      <div className="flex items-center gap-2 text-xs text-gray-500 mb-2 shrink-0">
        <MessageSquare size={12} />
        <span>History</span>
      </div>

      {/* sm: compact single row */}
      {renderSize === 'sm' && (
        <div className="flex items-center gap-3 text-xs">
          <span className="font-mono text-blue-400">{callCount}</span>
          <span className="text-gray-600">turns</span>
          {messages.length > 0 && (
            <>
              <span className="font-mono text-gray-400 flex items-center gap-0.5">
                <User size={10} />{userMsgs.length}
              </span>
              <span className="text-gray-600">msgs</span>
            </>
          )}
          {duration && <span className="text-gray-600 ml-auto">{duration}</span>}
        </div>
      )}

      {/* lg: stats + recent user messages */}
      {renderSize === 'lg' && (
        <div className="flex-1 flex flex-col gap-2 min-h-0">
          {/* Stats row */}
          <div className="flex items-center gap-3 text-xs shrink-0">
            <span className="font-mono text-blue-400">{callCount}</span>
            <span className="text-gray-600">turns</span>
            {messages.length > 0 && (
              <>
                <span className="font-mono text-gray-400 flex items-center gap-0.5">
                  <User size={10} />{userMsgs.length}
                </span>
                <span className="text-gray-600">msgs</span>
              </>
            )}
            {duration && <span className="text-gray-500 ml-auto">{duration}</span>}
          </div>

          {/* Recent user messages — click to jump */}
          <div className="flex-1 overflow-y-auto space-y-0.5 min-h-0">
            {userMsgs.length === 0 ? (
              <div className="text-gray-700 text-[10px] text-center pt-2">
                {callCount > 0 ? 'Using terminal mode' : 'No messages yet'}
              </div>
            ) : (
              userMsgs.slice(-8).map((msg) => (
                <button
                  key={msg.id}
                  onClick={() => setChatJumpTarget(sessionId, msg.id)}
                  className="w-full text-left flex items-start gap-1.5 px-2 py-1 rounded hover:bg-gray-800/50 group transition-colors"
                >
                  <User size={9} className="text-blue-400 shrink-0 mt-0.5" />
                  <span className="text-[10px] text-gray-400 group-hover:text-gray-300 truncate leading-relaxed flex-1">
                    {msg.content.replace(/\n/g, ' ')}
                  </span>
                  <span className="text-[9px] text-gray-700 shrink-0 ml-1">
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
