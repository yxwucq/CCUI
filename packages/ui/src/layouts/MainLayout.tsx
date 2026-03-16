import { Outlet, useLocation } from 'react-router-dom';
import { useState, useRef, useCallback } from 'react';
import Sidebar from '../components/Sidebar';
import Chat from '../views/Chat';
import { useWebSocket } from '../hooks/useWebSocket';
import { useEffect } from 'react';
import { useSessionStore } from '../stores/sessionStore';
import { useWidgetStore } from '../stores/widgetStore';
import { motion } from 'framer-motion';
import { PanelLeftClose, PanelLeftOpen, Sun, Moon, Palette } from 'lucide-react';
import QuotaGauge from '../components/QuotaGauge';
import ToastContainer from '../components/ToastContainer';
import { applyTheme, themes } from '../theme';

function ThemeSwitcher() {
  const themeId = useWidgetStore((s) => s.themeId);
  const setTheme = useWidgetStore((s) => s.setTheme);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const themeList = Object.values(themes);
  const icon = themeId === 'light' ? <Sun size={14} /> : themeId === 'dark' ? <Moon size={14} /> : <Palette size={14} />;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="p-1 text-cc-text-muted hover:text-cc-text rounded transition-colors"
        title="Switch theme"
      >
        {icon}
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 bg-cc-bg-surface border border-cc-border rounded shadow-lg py-1 z-50 min-w-[120px]">
          {themeList.map((t) => (
            <button
              key={t.id}
              onClick={() => { setTheme(t.id); setOpen(false); }}
              className={`w-full text-left px-3 py-1.5 text-xs transition-colors ${
                t.id === themeId
                  ? 'text-cc-accent bg-cc-accent-muted'
                  : 'text-cc-text-secondary hover:text-cc-text hover:bg-cc-bg-overlay'
              }`}
            >
              {t.id === 'light' && <Sun size={12} className="inline mr-1.5 -mt-0.5" />}
              {t.id === 'dark' && <Moon size={12} className="inline mr-1.5 -mt-0.5" />}
              {t.id !== 'light' && t.id !== 'dark' && <Palette size={12} className="inline mr-1.5 -mt-0.5" />}
              {t.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function MainLayout() {
  const { status } = useWebSocket();
  const fetchSessions = useSessionStore((s) => s.fetchSessions);
  const sessions = useSessionStore((s) => s.sessions);
  const activeSessionId = useSessionStore((s) => s.activeSessionId);
  const toggleExpanded = useSessionStore((s) => s.toggleExpanded);
  const usageRefreshKey = useSessionStore((s) => s.usageRefreshKey);
  const loadConfig = useWidgetStore((s) => s.loadConfig);
  const appName = useWidgetStore((s) => s.appName);
  const setAppName = useWidgetStore((s) => s.setAppName);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [editing, setEditing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const commitName = useCallback(() => {
    if (inputRef.current) setAppName(inputRef.current.value);
    setEditing(false);
  }, [setAppName]);
  const location = useLocation();
  const isSessionsPage = location.pathname === '/';

  useEffect(() => {
    applyTheme('dark'); // initial paint before config loads
    fetchSessions();
    loadConfig();
  }, [fetchSessions, loadConfig]);

  return (
    <div className="flex h-screen bg-cc-bg text-cc-text">
      {/* Sidebar — collapsible */}
      <motion.div
        animate={{ width: sidebarOpen ? 224 : 0 }}
        transition={{ duration: 0.2, ease: 'easeInOut' }}
        className="shrink-0 overflow-hidden border-r border-cc-border"
      >
        <Sidebar sessions={sessions} activeSessionId={activeSessionId} onToggleExpanded={toggleExpanded} />
      </motion.div>

      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Top bar */}
        <header className="h-10 border-b border-cc-border flex items-center justify-between px-3 shrink-0">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSidebarOpen((v) => !v)}
              className="p-1 text-cc-text-muted hover:text-cc-text-secondary rounded transition-colors"
              title={sidebarOpen ? 'Hide sidebar' : 'Show sidebar'}
            >
              {sidebarOpen ? <PanelLeftClose size={16} /> : <PanelLeftOpen size={16} />}
            </button>
            {editing ? (
              <input
                ref={inputRef}
                defaultValue={appName}
                autoFocus
                onBlur={commitName}
                onKeyDown={(e) => { if (e.key === 'Enter') commitName(); if (e.key === 'Escape') setEditing(false); }}
                className="text-xs font-semibold text-cc-text-secondary bg-cc-bg-surface border border-cc-border rounded px-1.5 py-0.5 w-24 focus:outline-none focus:border-cc-accent"
              />
            ) : (
              <span
                className="text-xs font-semibold text-cc-text-muted cursor-pointer hover:text-cc-text-secondary transition-colors"
                onDoubleClick={() => setEditing(true)}
                title="Double-click to rename"
              >{appName}</span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <QuotaGauge usageRefreshKey={usageRefreshKey} />
            <ThemeSwitcher />
            <div className="flex items-center gap-1.5">
              <span className={`w-1.5 h-1.5 rounded-full ${
                status === 'connected' ? 'bg-cc-green-text' :
                status === 'connecting' ? 'bg-cc-yellow-text' : 'bg-cc-red-text'
              }`} />
              <span className="text-xs text-cc-text-muted">{status}</span>
            </div>
          </div>
        </header>

        {/* Content area — cross-fade between Sessions and other views */}
        <div className="flex-1 min-h-0 relative">
          {/* Sessions view — always mounted, faded out when not active */}
          <motion.div
            animate={{ opacity: isSessionsPage ? 1 : 0 }}
            transition={{ duration: 0.15 }}
            className="absolute inset-0 flex flex-col"
            style={{ pointerEvents: isSessionsPage ? 'auto' : 'none' }}
          >
            <Chat />
          </motion.div>

          {/* Other views via Outlet */}
          {!isSessionsPage && (
            <main className="absolute inset-0 overflow-auto">
              <Outlet />
            </main>
          )}
        </div>
      </div>
      <ToastContainer />
    </div>
  );
}
