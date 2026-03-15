import { useRef, useEffect, useState, useCallback, useImperativeHandle, forwardRef } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import '@xterm/xterm/css/xterm.css';
import { sendWsMessage } from '../hooks/useWebSocket';
import { terminalTheme } from '../theme';
import { useWidgetStore } from '../stores/widgetStore';
import { RotateCcw } from 'lucide-react';

const FONT_DEFAULTS = {
  fontFamily: '"JetBrains Mono", Menlo, Monaco, "Courier New", monospace',
  fontSize: 13,
  lineHeight: 1.35,
};

interface Props {
  sessionId: string;
}

export interface XTerminalHandle {
  focus: () => void;
}

const XTerminal = forwardRef<XTerminalHandle, Props>(function XTerminal({ sessionId }, ref) {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const [status, setStatus] = useState<'connecting' | 'connected' | 'exited'>('connecting');
  const [isFocused, setIsFocused] = useState(false);
  const terminalConfig = useWidgetStore((s) => s.terminalConfig);

  // Expose focus() to parent
  useImperativeHandle(ref, () => ({
    focus: () => termRef.current?.focus(),
  }));

  // Restart: kill existing PTY, clear xterm, create fresh
  const restart = useCallback(() => {
    setStatus('connecting');
    if (termRef.current) {
      sendWsMessage({ type: 'session:terminate', sessionId });
      termRef.current.reset();
      setTimeout(() => {
        if (termRef.current) {
          const { cols, rows } = termRef.current;
          sendWsMessage({ type: 'terminal:create', sessionId, cols, rows });
        }
      }, 100);
    }
  }, [sessionId]);

  // Initialize xterm + request PTY
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const font = { ...FONT_DEFAULTS, ...terminalConfig };

    const term = new Terminal({
      cursorBlink: false,
      cursorStyle: 'bar',
      cursorInactiveStyle: 'none',
      fontSize: font.fontSize,
      lineHeight: font.lineHeight,
      letterSpacing: 0.5,
      fontFamily: font.fontFamily,
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

    // Focus tracking via xterm's textarea
    const textarea = el.querySelector('textarea.xterm-helper-textarea');
    const onFocus = () => setIsFocused(true);
    const onBlur = () => setIsFocused(false);
    if (textarea) {
      textarea.addEventListener('focus', onFocus);
      textarea.addEventListener('blur', onBlur);
    }

    // WebGL renderer (dynamic import, auto-fallback to DOM)
    (async () => {
      try {
        const { WebglAddon } = await import('@xterm/addon-webgl');
        if (!termRef.current) return;
        const webgl = new WebglAddon();
        webgl.onContextLoss(() => { webgl.dispose(); });
        term.loadAddon(webgl);
      } catch { /* WebGL unavailable — DOM renderer is fine */ }
    })();

    // Request PTY
    const { cols, rows } = term;
    const createTimer = setTimeout(() => {
      sendWsMessage({ type: 'terminal:create', sessionId, cols, rows });
    }, 80);

    const inputDisposable = term.onData((data) => {
      sendWsMessage({ type: 'terminal:input', sessionId, data });
    });

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
      if (textarea) {
        textarea.removeEventListener('focus', onFocus);
        textarea.removeEventListener('blur', onBlur);
      }
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

  return (
    <div className="flex flex-col h-full" style={{ backgroundColor: 'var(--cc-bg, #09090b)' }}>
      {/* Terminal body — fills entire area */}
      <div className={`flex-1 min-h-0 relative xterm-container ${isFocused ? 'focused' : ''}`}>
        <div ref={containerRef} className="absolute inset-0" />

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

      {/* Hint bar — borderless, transparent, with status dot */}
      <div className="flex items-center gap-3 px-3 py-1 shrink-0 overflow-x-auto">
        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
          status === 'exited' ? 'bg-red-500' :
          status === 'connected' ? 'bg-green-500' :
          'bg-yellow-500 animate-pulse'
        }`} />
        {['/help', '/compact', '/clear', '/model', '/cost', '/memory'].map((cmd) => (
          <button
            key={cmd}
            onClick={() => {
              sendWsMessage({ type: 'terminal:input', sessionId, data: cmd + '\r' });
              termRef.current?.focus();
            }}
            className="text-xs text-zinc-600 hover:text-violet-400 font-mono whitespace-nowrap transition-colors"
          >
            {cmd}
          </button>
        ))}
      </div>
    </div>
  );
});

export default XTerminal;
