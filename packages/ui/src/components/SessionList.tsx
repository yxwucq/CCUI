import { useSessionStore } from '../stores/sessionStore';
import { useNavigate } from 'react-router-dom';

export default function SessionList() {
  const sessions = useSessionStore((s) => s.sessions);
  const activeSessionId = useSessionStore((s) => s.activeSessionId);
  const navigate = useNavigate();

  return (
    <div className="space-y-1">
      {sessions.map((session) => (
        <button
          key={session.id}
          onClick={() => navigate(`/chat/${session.id}`)}
          className={`w-full text-left px-3 py-2 rounded-md text-sm flex items-center gap-2 transition-colors ${
            activeSessionId === session.id
              ? 'bg-blue-600/20 text-blue-400'
              : 'text-gray-400 hover:bg-gray-800/50'
          }`}
        >
          <span className={`w-2 h-2 rounded-full ${
            session.status === 'active' ? 'bg-green-500' :
            session.status === 'idle' ? 'bg-yellow-500' : 'bg-gray-600'
          }`} />
          <span className="truncate">{session.id.slice(0, 12)}...</span>
        </button>
      ))}
    </div>
  );
}
