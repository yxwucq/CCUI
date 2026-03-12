import { useRef, useEffect, useState, useCallback } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import '@xterm/xterm/css/xterm.css';
import { sendWsMessage } from '../hooks/useWebSocket';
import { terminalTheme } from '../theme';
import { Circle, RotateCcw, X, Maximize2, Minimize2 } from 'lucide-react';

interface Props {
  sessionId: string;
  onClose?: () => void;
}

export default function XTerminal({ sessionId, onClose }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const [status, setStatus] = useState<'connecting' | 'connected' | 'exited'>('connecting');
  const [expanded, setExpanded] = useState(false);

  // Restart: kill existing PTY, clear xterm, create fresh
  const restart = useCallback(() => {
    setStatus('connecting');
    if (termRef.current) {
      // Kill old PTY on server
      sendWsMessage({ type: 'session:terminate', sessionId });
      termRef.current.reset();
      // Create new after brief delay for kill to propagate
      setTimeout(() => {
        if (termRef.current) {
          const { cols, rows } = termRef.current;
          sendWsMessage({ type: 'terminal:create', sessionId, cols, rows });
        }
      }, 100);
    }
  }, [sessionId]);

  // Initialize xterm + request PTY (server reuses existing if alive)
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const term = new Terminal({
      cursorBlink: false,
      cursorStyle: 'bar',
      cursorInactiveStyle: 'none',
      fontSize: 13,
      lineHeight: 1.35,
      letterSpacing: 0.5,
      fontFamily: '"JetBrains Mono", Menlo, Monaco, "Courier New", monospace',
      scrollback: 5000,
      theme: terminalTheme,
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.loadAddon(new WebLinksAddon());
    term.open(el);

    termRef.current = term;
    fitRef.current = fitAddon;

    fitAddon.fit();

    // Request PTY — server creates only if not already running
    const { cols, rows } = term;
    const createTimer = setTimeout(() => {
      sendWsMessage({ type: 'terminal:create', sessionId, cols, rows });
    }, 80);

    // Forward user keystrokes to server
    const inputDisposable = term.onData((data) => {
      sendWsMessage({ type: 'terminal:input', sessionId, data });
    });

    // Auto-fit on container resize + notify server
    const observer = new ResizeObserver(() => {
      fitAddon.fit();
      const { cols: c, rows: r } = term;
      sendWsMessage({ type: 'terminal:resize', sessionId, cols: c, rows: r });
    });
    observer.observe(el);

    return () => {
      clearTimeout(createTimer);
      observer.disconnect();
      inputDisposable.dispose();
      term.dispose();
      termRef.current = null;
      fitRef.current = null;
    };
  }, [sessionId]);

  // Listen for server → terminal output / exit
  useEffect(() => {
    const onOutput = (e: Event) => {
      const { sessionId: sid, data } = (e as CustomEvent).detail;
      if (sid === sessionId && termRef.current) {
        setStatus('connected');
        termRef.current.write(data);
      }
    };
    const onExit = (e: Event) => {
      const { sessionId: sid } = (e as CustomEvent).detail;
      if (sid === sessionId) setStatus('exited');
    };
    window.addEventListener('terminal:output', onOutput);
    window.addEventListener('terminal:exit', onExit);
    return () => {
      window.removeEventListener('terminal:output', onOutput);
      window.removeEventListener('terminal:exit', onExit);
    };
  }, [sessionId]);

  // Refit on fullscreen toggle
  useEffect(() => {
    requestAnimationFrame(() => fitRef.current?.fit());
  }, [expanded]);

  return (
    <div className={`flex flex-col h-full bg-[#09090b] ${expanded ? 'fixed inset-0 z-50' : ''}`}>
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-3 py-1.5 bg-zinc-900/80 border-b border-zinc-800/60 shrink-0">
        <div className="flex items-center gap-1.5 mr-1">
          <button
            onClick={onClose}
            className="group w-3 h-3 rounded-full bg-red-500/80 hover:bg-red-500 transition-colors flex items-center justify-center"
            title="Close terminal"
          >
            <X size={7} className="text-red-900 opacity-0 group-hover:opacity-100 transition-opacity" />
          </button>
          <button
            onClick={restart}
            className="group w-3 h-3 rounded-full bg-yellow-500/80 hover:bg-yellow-500 transition-colors flex items-center justify-center"
            title="Restart"
          >
            <RotateCcw size={7} className="text-yellow-900 opacity-0 group-hover:opacity-100 transition-opacity" />
          </button>
          <button
            onClick={() => setExpanded((v) => !v)}
            className="group w-3 h-3 rounded-full bg-green-500/80 hover:bg-green-500 transition-colors flex items-center justify-center"
            title={expanded ? 'Exit fullscreen' : 'Fullscreen'}
          >
            {expanded
              ? <Minimize2 size={6} className="text-green-900 opacity-0 group-hover:opacity-100 transition-opacity" />
              : <Maximize2 size={6} className="text-green-900 opacity-0 group-hover:opacity-100 transition-opacity" />
            }
          </button>
        </div>

        <div className="flex-1 text-center">
          <span className="text-xs text-zinc-500 font-medium">Claude CLI</span>
        </div>

        <div className="flex items-center gap-1.5">
          <Circle size={6} className={`shrink-0 ${
            status === 'exited' ? 'fill-red-500 text-red-500' :
            status === 'connected' ? 'fill-green-500 text-green-500' :
            'fill-yellow-500 text-yellow-500 animate-pulse'
          }`} />
          <span className="text-[10px] text-zinc-600">{status}</span>
        </div>
      </div>

      {/* Terminal body */}
      <div className="flex-1 min-h-0 relative">
        <div ref={containerRef} className="absolute inset-0 p-1.5" />

        {status === 'exited' && (
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <span className="text-sm text-zinc-400">Process exited</span>
              <button
                onClick={restart}
                className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white text-sm rounded-lg transition-colors"
              >
                <RotateCcw size={14} />
                Restart
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Hint bar */}
      <div className="flex items-center gap-3 px-3 py-1 bg-zinc-900/50 border-t border-zinc-800/40 shrink-0 overflow-x-auto">
        {['/help', '/compact', '/clear', '/model', '/cost', '/memory'].map((cmd) => (
          <button
            key={cmd}
            onClick={() => {
              sendWsMessage({ type: 'terminal:input', sessionId, data: cmd + '\r' });
              termRef.current?.focus();
            }}
            className="text-[10px] text-zinc-600 hover:text-violet-400 font-mono whitespace-nowrap transition-colors"
          >
            {cmd}
          </button>
        ))}
      </div>
    </div>
  );
}
