import { useRef, useEffect, useState, useCallback, useImperativeHandle, forwardRef } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import '@xterm/xterm/css/xterm.css';
import { sendWsMessage } from '../hooks/useWebSocket';
import { getTerminalTheme, onThemeChange } from '../theme';
import { useWidgetStore } from '../stores/widgetStore';
import { RotateCcw } from 'lucide-react';

const FONT_DEFAULTS = {
  fontFamily: '"JetBrains Mono", Menlo, Monaco, "Courier New", monospace',
  fontSize: 13,
  lineHeight: 1.35,
};

interface Props {
  sessionId: string;
  interceptEscape?: boolean;
}

export interface XTerminalHandle {
  focus: () => void;
}

const XTerminal = forwardRef<XTerminalHandle, Props>(function XTerminal({ sessionId, interceptEscape = false }, ref) {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const interceptEscapeRef = useRef(interceptEscape);
  const [status, setStatus] = useState<'connecting' | 'connected' | 'exited'>('connecting');
  const [isFocused, setIsFocused] = useState(false);
  const terminalConfig = useWidgetStore((s) => s.terminalConfig);

  // Keep ref in sync with prop
  useEffect(() => { interceptEscapeRef.current = interceptEscape; }, [interceptEscape]);

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
      theme: getTerminalTheme(),
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.loadAddon(new WebLinksAddon());
    term.open(el);

    // Intercept ESC in focus mode — prevent xterm from sending \x1b to PTY
    term.attachCustomKeyEventHandler((ev) => {
      if (ev.key === 'Escape' && ev.type === 'keydown' && interceptEscapeRef.current) {
        return false;
      }
      return true;
    });

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

    // Listen for theme changes and update terminal colors
    const unsubTheme = onThemeChange(() => {
      term.options.theme = getTerminalTheme();
    });

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

    let resizeTimer: ReturnType<typeof setTimeout>;
    const observer = new ResizeObserver(() => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        fitAddon.fit();
        const { cols: c, rows: r } = term;
        sendWsMessage({ type: 'terminal:resize', sessionId, cols: c, rows: r });
      }, 150);
    });
    observer.observe(el);

    return () => {
      clearTimeout(createTimer);
      clearTimeout(resizeTimer);
      observer.disconnect();
      inputDisposable.dispose();
      unsubTheme();
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
    <div className="flex flex-col h-full bg-cc-bg">
      {/* Terminal body — fills entire area */}
      <div className={`flex-1 min-h-0 relative xterm-container ${isFocused ? 'focused' : ''}`}>
        <div ref={containerRef} className="absolute inset-0" />

        {status === 'exited' && (
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <span className="text-sm text-cc-text-secondary">Process exited</span>
              <button
                onClick={restart}
                className="flex items-center gap-2 px-4 py-2 bg-cc-accent hover:bg-cc-accent-hover text-cc-text text-sm rounded-lg transition-colors"
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
          status === 'exited' ? 'bg-cc-red-text' :
          status === 'connected' ? 'bg-cc-green-text' :
          'bg-cc-yellow-text animate-pulse'
        }`} />
        {['/help', '/compact', '/clear', '/model', '/cost', '/memory'].map((cmd) => (
          <button
            key={cmd}
            onClick={() => {
              sendWsMessage({ type: 'terminal:input', sessionId, data: cmd + '\r' });
              termRef.current?.focus();
            }}
            className="text-xs text-cc-text-muted hover:text-cc-accent font-mono whitespace-nowrap transition-colors"
          >
            {cmd}
          </button>
        ))}
      </div>
    </div>
  );
});

export default XTerminal;
