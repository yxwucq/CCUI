import { useRef } from 'react';
import { useSessionStore } from '../../stores/sessionStore';
import { FileText, FilePen, Terminal, Activity } from 'lucide-react';
import type { FileActivity } from '@ccui/shared';

interface Props {
  sessionId: string;
}

const EMPTY: never[] = [];

function OpIcon({ op }: { op: FileActivity['op'] }) {
  if (op === 'write') return <FilePen size={10} className="text-yellow-500 shrink-0" />;
  if (op === 'exec') return <Terminal size={10} className="text-blue-400 shrink-0" />;
  return <FileText size={10} className="text-gray-400 shrink-0" />;
}

function shortPath(path: string): string {
  if (path.length <= 36) return path;
  const parts = path.split('/');
  if (parts.length > 3) return '…/' + parts.slice(-2).join('/');
  return '…' + path.slice(-35);
}

function timeLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export default function FileActivityWidget({ sessionId }: Props) {
  const fileActivities = useSessionStore((s) => s.fileActivities[sessionId] ?? EMPTY);
  const prevLengthRef = useRef(fileActivities.length);
  const isGrowing = fileActivities.length > prevLengthRef.current;
  prevLengthRef.current = fileActivities.length;

  const reversed = [...fileActivities].reverse();

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center gap-2 text-xs text-gray-500 mb-3">
        <Activity size={12} />
        <span>File Activity</span>
        {fileActivities.length > 0 && (
          <span className="ml-auto text-gray-600 text-[10px]">{fileActivities.length}</span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto space-y-1 min-h-0">
        {reversed.length === 0 ? (
          <div className="text-[10px] text-gray-600 text-center pt-4">
            No file activity yet
          </div>
        ) : (
          reversed.map((a, revIdx) => {
            // The first item (newest) gets the slide-in animation when a new entry was added
            const isNewest = revIdx === 0 && isGrowing;
            return (
              <div
                key={a.timestamp}
                className={`flex items-start gap-1.5 group ${isNewest ? 'slide-in-top' : ''}`}
              >
                <OpIcon op={a.op} />
                <div className="min-w-0 flex-1">
                  <div className="text-[10px] text-gray-300 font-mono truncate" title={a.path}>
                    {shortPath(a.path)}
                  </div>
                  <div className="text-[9px] text-gray-600">{a.tool} · {timeLabel(a.timestamp)}</div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
