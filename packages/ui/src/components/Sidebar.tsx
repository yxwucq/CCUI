import { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  LayoutDashboard, MessageSquare, FolderOpen, Bot,
  FileCode, GitBranch,
} from 'lucide-react';
import type { Session } from '@ccui/shared';
import { useSessionStore } from '../stores/sessionStore';
import { fetchProjectInfo } from '../api/projects';
import { useWidgetStore } from '../stores/widgetStore';
import { pctBarColor } from '../utils';

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

export default function Sidebar({ sessions }: Props) {
  const usageRefreshKey = useSessionStore((s) => s.usageRefreshKey);
  const dailyBudget = useWidgetStore((s) => s.dailyBudget);
  const alertAt = useWidgetStore((s) => s.alertAt);

  // Project info
  const [projectName, setProjectName] = useState('');
  const [gitBranch, setGitBranch] = useState('');

  useEffect(() => {
    fetchProjectInfo()
      .then((info) => {
        setProjectName(info.name || info.path.split('/').pop() || '');
        setGitBranch(info.gitBranch || '');
      })
      .catch(() => {});
  }, []);

  // Usage
  const [todayCost, setTodayCost] = useState(0);

  useEffect(() => {
    fetch('/api/usage/today')
      .then((r) => r.json())
      .then((data) => setTodayCost(data.cost || 0))
      .catch(() => {});
  }, [usageRefreshKey]);

  // Session counts
  const alive = sessions.filter((s) => s.status !== 'terminated').length;
  const terminated = sessions.filter((s) => s.status === 'terminated').length;

  const pct = Math.min(100, Math.round((todayCost / dailyBudget) * 100));

  return (
    <aside className="w-56 h-full flex flex-col shrink-0">
      <div className="p-4 border-b border-cc-border">
        <h1 className="text-lg font-bold text-cc-text">CCUI</h1>
        <p className="text-xs text-cc-text-muted">Claude Code WebUI</p>
      </div>

      <nav className="p-2 space-y-1">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `relative flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ${
                isActive
                  ? 'text-cc-text'
                  : 'text-cc-text-secondary hover:text-cc-text hover:bg-cc-bg-surface/50'
              }`
            }
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <motion.div
                    layoutId="sidebar-nav-indicator"
                    className="absolute inset-0 bg-cc-bg-surface rounded-md"
                    style={{ zIndex: -1 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                  />
                )}
                <Icon size={16} />
                {label}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Global status panel — pinned to bottom */}
      <div className="mt-auto border-t border-cc-border px-4 py-4 space-y-4">
        {/* Project & branch */}
        <div>
          <p className="text-[10px] uppercase tracking-wider text-cc-text-muted mb-1">Project</p>
          <p className="text-sm font-medium text-cc-text truncate">{projectName}</p>
          {gitBranch && (
            <div className="flex items-center gap-1.5 text-cc-purple-text mt-1">
              <GitBranch size={12} />
              <span className="text-xs truncate">{gitBranch}</span>
            </div>
          )}
        </div>

        {/* Session counts */}
        <div>
          <p className="text-[10px] uppercase tracking-wider text-cc-text-muted mb-1.5">Sessions</p>
          <div className="flex items-center gap-3 text-xs">
            <span className="flex items-center gap-1.5 text-cc-green-text">
              <span className="w-2 h-2 rounded-full bg-cc-green-text" />
              {alive} active
            </span>
            {terminated > 0 && (
              <span className="flex items-center gap-1.5 text-cc-text-muted">
                <span className="w-2 h-2 rounded-full bg-cc-text-muted" />
                {terminated}
              </span>
            )}
          </div>
        </div>

        {/* Today's usage */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-[10px] uppercase tracking-wider text-cc-text-muted">Today</p>
            <span className={`text-xs font-mono ${pct > alertAt * 100 ? 'text-cc-red-text' : 'text-cc-text-muted'}`}>
              ${todayCost.toFixed(2)} / ${dailyBudget}
            </span>
          </div>
          <div className="h-1.5 bg-cc-bg-surface rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${pctBarColor(pct)}`}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        <button
          onClick={() => {
            import('./TutorialOverlay').then((m) => m.startTutorial());
          }}
          className="text-[10px] uppercase tracking-wider text-cc-text-muted/40 hover:text-cc-text-muted transition-colors"
        >
          ? Tutorial
        </button>
      </div>
    </aside>
  );
}
