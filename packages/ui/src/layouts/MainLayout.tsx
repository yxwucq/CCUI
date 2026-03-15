import { Outlet, useLocation } from 'react-router-dom';
import { useState, useRef, useCallback } from 'react';
import Sidebar from '../components/Sidebar';
import Chat from '../views/Chat';
import { useWebSocket } from '../hooks/useWebSocket';
import { useEffect } from 'react';
import { useSessionStore } from '../stores/sessionStore';
import { useWidgetStore } from '../stores/widgetStore';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import QuotaGauge from '../components/QuotaGauge';
import ToastContainer from '../components/ToastContainer';
import { injectThemeVars } from '../theme';

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
    injectThemeVars();
    fetchSessions();
    loadConfig();
  }, [fetchSessions, loadConfig]);

  return (
    <div className="flex h-screen text-gray-100" style={{ backgroundColor: 'var(--cc-bg, #09090b)' }}>
      {/* Sidebar — collapsible */}
      {sidebarOpen && <Sidebar sessions={sessions} activeSessionId={activeSessionId} onToggleExpanded={toggleExpanded} />}

      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Top bar */}
        <header className="h-10 border-b border-gray-800 flex items-center justify-between px-3 shrink-0">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSidebarOpen((v) => !v)}
              className="p-1 text-gray-500 hover:text-gray-300 rounded transition-colors"
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
                className="text-xs font-semibold text-gray-300 bg-gray-800 border border-gray-600 rounded px-1.5 py-0.5 w-24 focus:outline-none focus:border-blue-500"
              />
            ) : (
              <span
                className="text-xs font-semibold text-gray-400 cursor-pointer hover:text-gray-200 transition-colors"
                onDoubleClick={() => setEditing(true)}
                title="Double-click to rename"
              >{appName}</span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <QuotaGauge usageRefreshKey={usageRefreshKey} />
            <div className="flex items-center gap-1.5">
              <span className={`w-1.5 h-1.5 rounded-full ${
                status === 'connected' ? 'bg-green-500' :
                status === 'connecting' ? 'bg-yellow-500' : 'bg-red-500'
              }`} />
              <span className="text-xs text-gray-500">{status}</span>
            </div>
          </div>
        </header>

        {/* Sessions view — always mounted, hidden via CSS when not on / */}
        <div className="flex-1 min-h-0" style={{ display: isSessionsPage ? 'flex' : 'none', flexDirection: 'column' }}>
          <Chat />
        </div>

        {/* Other views via Outlet */}
        {!isSessionsPage && (
          <main className="flex-1 overflow-auto">
            <Outlet />
          </main>
        )}
      </div>
      <ToastContainer />
    </div>
  );
}
