import { NavLink, useNavigate } from 'react-router-dom';
import { useSessionStore } from '../stores/sessionStore';
import {
  LayoutDashboard, MessageSquare, FolderOpen, Bot,
  BarChart3, FileCode, GitBranch,
} from 'lucide-react';

const navItems = [
  { to: '/', icon: MessageSquare, label: 'Sessions' },
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/projects', icon: FolderOpen, label: 'Projects' },
  { to: '/agents', icon: Bot, label: 'Agents' },
  { to: '/usage', icon: BarChart3, label: 'Usage' },
  { to: '/files', icon: FileCode, label: 'Files' },
];

export default function Sidebar() {
  const sessions = useSessionStore((s) => s.sessions);
  const activeSessionId = useSessionStore((s) => s.activeSessionId);
  const toggleExpanded = useSessionStore((s) => s.toggleExpanded);
  const navigate = useNavigate();

  const activeSessions = sessions.filter((s) => s.status === 'active');

  return (
    <aside className="w-56 border-r border-gray-800 flex flex-col shrink-0">
      <div className="p-4 border-b border-gray-800">
        <h1 className="text-lg font-bold text-white">CCUI</h1>
        <p className="text-xs text-gray-500">Claude Code WebUI</p>
      </div>

      <nav className="flex-1 p-2 space-y-1">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ${
                isActive
                  ? 'bg-gray-800 text-white'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/50'
              }`
            }
          >
            <Icon size={16} />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Active sessions quick list */}
      <div className="border-t border-gray-800 p-2">
        <p className="px-3 py-1 text-xs text-gray-500 uppercase tracking-wider">
          Active ({activeSessions.length})
        </p>
        <div className="max-h-48 overflow-y-auto space-y-0.5">
          {activeSessions.map((s) => (
            <button
              key={s.id}
              onClick={() => {
                navigate('/');
                toggleExpanded(s.id);
              }}
              className={`w-full text-left px-3 py-1.5 rounded text-xs transition-colors ${
                activeSessionId === s.id
                  ? 'bg-blue-600/20 text-blue-400'
                  : 'text-gray-400 hover:bg-gray-800/50'
              }`}
            >
              <div className="flex items-center gap-1.5">
                <span className="inline-block w-1.5 h-1.5 rounded-full shrink-0 bg-green-500" />
                <span className="truncate">{s.name}</span>
              </div>
              {s.branch && (
                <div className="flex items-center gap-1 text-purple-400/70 mt-0.5 ml-3">
                  <GitBranch size={10} />
                  <span className="truncate">{s.branch}</span>
                </div>
              )}
            </button>
          ))}
        </div>
      </div>
    </aside>
  );
}
