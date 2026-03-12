import { Outlet, useLocation } from 'react-router-dom';
import { useState } from 'react';
import Sidebar from '../components/Sidebar';
import Chat from '../views/Chat';
import { useWebSocket } from '../hooks/useWebSocket';
import { useEffect } from 'react';
import { useSessionStore } from '../stores/sessionStore';
import { useWidgetStore } from '../stores/widgetStore';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import QuotaGauge from '../components/QuotaGauge';
import ToastContainer from '../components/ToastContainer';

export default function MainLayout() {
  const { status } = useWebSocket();
  const fetchSessions = useSessionStore((s) => s.fetchSessions);
  const loadConfig = useWidgetStore((s) => s.loadConfig);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const location = useLocation();
  const isSessionsPage = location.pathname === '/';

  useEffect(() => {
    fetchSessions();
    loadConfig();
  }, [fetchSessions, loadConfig]);

  return (
    <div className="flex h-screen bg-gray-950 text-gray-100">
      {/* Sidebar — collapsible */}
      {sidebarOpen && <Sidebar />}

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
            <span className="text-xs font-semibold text-gray-400">CCUI</span>
          </div>
          <div className="flex items-center gap-3">
            <QuotaGauge />
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
