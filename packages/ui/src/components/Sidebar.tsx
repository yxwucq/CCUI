import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, MessageSquare, FolderOpen, Bot,
  FileCode, GitBranch,
} from 'lucide-react';
import type { Session } from '@ccui/shared';

const navItems = [
  { to: '/', icon: MessageSquare, label: 'Sessions' },
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/projects', icon: FolderOpen, label: 'Projects' },
  { to: '/agents', icon: Bot, label: 'Agents' },
  { to: '/files', icon: FileCode, label: 'Files' },
];

interface Props {
  sessions: Session[];
  activeSessionId: string | null;
  onToggleExpanded: (id: string) => void;
}

export default function Sidebar({ sessions, activeSessionId, onToggleExpanded }: Props) {
  const navigate = useNavigate();

  const activeSessions = sessions.filter((s) => s.status === 'active');

  return (
    <aside className="w-56 border-r border-cc-border flex flex-col shrink-0">
      <div className="p-4 border-b border-cc-border">
        <h1 className="text-lg font-bold text-cc-text">CCUI</h1>
        <p className="text-xs text-cc-text-muted">Claude Code WebUI</p>
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
                  ? 'bg-cc-bg-surface text-cc-text'
                  : 'text-cc-text-secondary hover:text-cc-text hover:bg-cc-bg-surface/50'
              }`
            }
          >
            <Icon size={16} />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Active sessions quick list */}
      <div className="border-t border-cc-border p-2">
        <p className="px-3 py-1 text-xs text-cc-text-muted uppercase tracking-wider">
          Active ({activeSessions.length})
        </p>
        <div className="max-h-48 overflow-y-auto space-y-0.5">
          {activeSessions.map((s) => (
            <button
              key={s.id}
              onClick={() => {
                navigate('/');
                onToggleExpanded(s.id);
              }}
              className={`w-full text-left px-3 py-1.5 rounded text-xs transition-colors ${
                activeSessionId === s.id
                  ? 'bg-cc-accent-muted text-cc-accent'
                  : 'text-cc-text-secondary hover:bg-cc-bg-surface/50'
              }`}
            >
              <div className="flex items-center gap-1.5">
                <span className="inline-block w-1.5 h-1.5 rounded-full shrink-0 bg-cc-green-text" />
                <span className="truncate">{s.name}</span>
              </div>
              {s.branch && (
                <div className="flex items-center gap-1 text-cc-purple-text/70 mt-0.5 ml-3">
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
