import { useRef, useEffect, useState, useCallback } from 'react';
import { Terminal } from '@xterm/xterm';
import { sendWsMessage } from '../hooks/useWebSocket';

const SLASH_COMMANDS = [
  { cmd: '/help', desc: 'Show help' },
  { cmd: '/compact', desc: 'Compact conversation' },
  { cmd: '/clear', desc: 'Clear conversation' },
  { cmd: '/model', desc: 'Switch model' },
  { cmd: '/cost', desc: 'Show usage cost' },
  { cmd: '/memory', desc: 'Edit memory' },
  { cmd: '/config', desc: 'Open config' },
  { cmd: '/permissions', desc: 'View permissions' },
  { cmd: '/mcp', desc: 'MCP servers' },
  { cmd: '/vim', desc: 'Toggle vim mode' },
];

/** Read xterm buffer and produce an array of {text, color} lines. */
function readBuffer(term: Terminal): { text: string; fg: string | null }[][] {
  const buf = term.buffer.active;
  const lines: { text: string; fg: string | null }[][] = [];

  for (let y = 0; y < buf.length; y++) {
    const line = buf.getLine(y);
    if (!line) continue;
    const spans: { text: string; fg: string | null }[] = [];
    let currentText = '';
    let currentFg: string | null = null;

    for (let x = 0; x < line.length; x++) {
      const cell = line.getCell(x);
      if (!cell) continue;
      const char = cell.getChars();
      if (!char) {
        // Wide char continuation or empty
        if (currentText) continue;
        currentText += ' ';
        continue;
      }

      // Get foreground color
      let fg: string | null = null;
      if (cell.isFgRGB()) {
        const r = (cell.getFgColor() >> 16) & 0xff;
        const g = (cell.getFgColor() >> 8) & 0xff;
        const b = cell.getFgColor() & 0xff;
        fg = `rgb(${r},${g},${b})`;
      } else if (cell.isFgPalette()) {
        fg = `pal-${cell.getFgColor()}`;
      }

      if (fg !== currentFg) {
        if (currentText) {
          spans.push({ text: currentText, fg: currentFg });
          currentText = '';
        }
        currentFg = fg;
      }
      currentText += char;
    }
    if (currentText) {
      spans.push({ text: currentText, fg: currentFg });
    }
    lines.push(spans);
  }

  // Trim trailing empty lines
  while (lines.length > 0) {
    const last = lines[lines.length - 1];
    if (last.length === 0 || (last.length === 1 && !last[0].text.trim())) {
      lines.pop();
    } else {
      break;
    }
  }

  return lines;
}

const PALETTE: Record<string, string> = {
  'pal-0': '#18181b', 'pal-1': '#f87171', 'pal-2': '#4ade80', 'pal-3': '#facc15',
  'pal-4': '#60a5fa', 'pal-5': '#c084fc', 'pal-6': '#22d3ee', 'pal-7': '#d4d4d8',
  'pal-8': '#71717a', 'pal-9': '#fca5a5', 'pal-10': '#86efac', 'pal-11': '#fde68a',
  'pal-12': '#93c5fd', 'pal-13': '#d8b4fe', 'pal-14': '#67e8f9', 'pal-15': '#fafafa',
};

function fgToColor(fg: string | null): string | undefined {
  if (!fg) return undefined;
  if (fg.startsWith('rgb')) return fg;
  return PALETTE[fg];
}

interface Props {
  sessionId: string;
}

export default function VirtualTerminal({ sessionId }: Props) {
  const [lines, setLines] = useState<{ text: string; fg: string | null }[][]>([]);
  const [input, setInput] = useState('');
  const [showSlash, setShowSlash] = useState(false);
  const [slashFilter, setSlashFilter] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const hiddenElRef = useRef<HTMLDivElement | null>(null);
  const [status, setStatus] = useState<'connecting' | 'connected' | 'exited'>('connecting');
  const rafRef = useRef<number>(0);

  // Setup hidden xterm instance
  useEffect(() => {
    const el = document.createElement('div');
    el.style.cssText = 'position:fixed;left:-9999px;top:-9999px;width:960px;height:600px;overflow:hidden;';
    document.body.appendChild(el);
    hiddenElRef.current = el;

    const term = new Terminal({
      cols: 120,
      rows: 50,
      scrollback: 1000,
      allowProposedApi: true,
    });
    term.open(el);
    termRef.current = term;

    return () => {
      term.dispose();
      document.body.removeChild(el);
      termRef.current = null;
      hiddenElRef.current = null;
    };
  }, []);

  // Create PTY on mount
  useEffect(() => {
    setLines([]);
    setStatus('connecting');
    const createTimer = setTimeout(() => {
      sendWsMessage({ type: 'terminal:create', sessionId, cols: 120, rows: 50 });
    }, 80);
    return () => clearTimeout(createTimer);
  }, [sessionId]);

  // Listen for PTY output → write to hidden xterm → read buffer
  useEffect(() => {
    const onOutput = (e: Event) => {
      const { sessionId: sid, data } = (e as CustomEvent).detail;
      if (sid !== sessionId || !termRef.current) return;

      setStatus('connected');
      termRef.current.write(data);

      // Throttled buffer read via rAF
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        if (termRef.current) {
          setLines(readBuffer(termRef.current));
        }
      });
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
      cancelAnimationFrame(rafRef.current);
    };
  }, [sessionId]);

  // Auto-scroll on new content
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lines]);

  const handleSend = useCallback((text?: string) => {
    const msg = text ?? input;
    if (!msg.trim()) return;
    sendWsMessage({ type: 'terminal:input', sessionId, data: msg + '\r' });
    if (!text) setInput('');
    setShowSlash(false);
  }, [input, sessionId]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInput(val);
    if (val.startsWith('/')) {
      setShowSlash(true);
      setSlashFilter(val);
    } else {
      setShowSlash(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    } else if (e.key === 'Escape') {
      setShowSlash(false);
    }
  };

  const filteredCommands = SLASH_COMMANDS.filter(
    (c) => c.cmd.startsWith(slashFilter) || slashFilter === '/'
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%' }}>
      {/* Output area */}
      <div
        ref={scrollRef}
        style={{ flex: 1, overflow: 'auto', padding: '16px', background: '#09090b', minHeight: 0 }}
      >
        {status === 'connecting' && lines.length === 0 && (
          <div style={{ color: '#6b7280', fontSize: '14px' }} className="animate-pulse">
            Starting Claude CLI...
          </div>
        )}
        <pre style={{
          fontFamily: '"JetBrains Mono", Menlo, Monaco, "Courier New", monospace',
          fontSize: '13px',
          lineHeight: '1.4',
          whiteSpace: 'pre',
          margin: 0,
          color: '#d4d4d8',
        }}>
          {lines.map((spans, y) => (
            <div key={y} style={{ minHeight: '1.4em' }}>
              {spans.map((span, x) => {
                const color = fgToColor(span.fg);
                return color ? (
                  <span key={x} style={{ color }}>{span.text}</span>
                ) : (
                  <span key={x}>{span.text}</span>
                );
              })}
            </div>
          ))}
        </pre>
      </div>

      {/* Input */}
      <div style={{ borderTop: '1px solid #1f2937', padding: '12px', background: 'rgba(17,24,39,0.3)', flexShrink: 0, position: 'relative' }}>
        {showSlash && filteredCommands.length > 0 && (
          <div style={{
            position: 'absolute',
            bottom: '100%',
            left: '12px',
            right: '12px',
            marginBottom: '4px',
            background: '#1f2937',
            border: '1px solid #374151',
            borderRadius: '8px',
            overflow: 'hidden',
            maxHeight: '192px',
            overflowY: 'auto',
          }}>
            {filteredCommands.map((c) => (
              <button
                key={c.cmd}
                onClick={() => {
                  handleSend(c.cmd);
                  setInput('');
                  inputRef.current?.focus();
                }}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '8px 12px',
                  fontSize: '14px',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  textAlign: 'left',
                  color: '#d4d4d8',
                }}
                className="hover:bg-gray-700/50"
              >
                <span style={{ fontFamily: 'monospace', color: '#60a5fa' }}>{c.cmd}</span>
                <span style={{ color: '#6b7280', fontSize: '12px' }}>{c.desc}</span>
              </button>
            ))}
          </div>
        )}
        <div style={{ display: 'flex', gap: '8px' }}>
          <input
            ref={inputRef}
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onBlur={() => setTimeout(() => setShowSlash(false), 150)}
            placeholder={status === 'exited' ? 'Session ended' : 'Type a message or / for commands...'}
            disabled={status === 'exited'}
            style={{
              flex: 1,
              background: '#1f2937',
              border: '1px solid #374151',
              borderRadius: '8px',
              padding: '8px 12px',
              fontSize: '14px',
              fontFamily: '"JetBrains Mono", Menlo, Monaco, monospace',
              color: '#d4d4d8',
              outline: 'none',
              opacity: status === 'exited' ? 0.5 : 1,
            }}
          />
          <button
            onClick={() => handleSend()}
            disabled={!input.trim() || status === 'exited'}
            style={{
              background: '#2563eb',
              border: 'none',
              borderRadius: '8px',
              padding: '8px 16px',
              fontSize: '14px',
              color: 'white',
              cursor: 'pointer',
              opacity: (!input.trim() || status === 'exited') ? 0.5 : 1,
            }}
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
