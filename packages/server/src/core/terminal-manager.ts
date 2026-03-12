import * as pty from 'node-pty';
import { createRequire } from 'module';
import type { SessionActivity } from '@ccui/shared';

const require = createRequire(import.meta.url);
const { Terminal: HeadlessTerminal } = require('@xterm/headless') as { Terminal: any };

type OutputListener = (sessionId: string, data: string) => void;
type ExitListener = (sessionId: string, code: number) => void;
type ActivityListener = (sessionId: string, activity: SessionActivity) => void;
type MessageCaptureListener = (sessionId: string, userMsg: string, assistantMsg: string) => void;

interface TerminalProcess {
  pty: pty.IPty;
  cwd: string;
  cols: number;
}

// Strip ANSI escape sequences for pattern matching
function stripAnsi(s: string): string {
  return s.replace(/\x1b\[[\x3c-\x3f]?[0-9;]*[a-zA-Z]|\x1b\].*?(?:\x07|\x1b\\)|\x1b[()][0-9A-B]/g, '');
}

// Detect Claude CLI permission/input prompts
const INPUT_PATTERNS = [
  /do you want to proceed/i,
  /esc to cancel/i,
  /\d+\.\s*(yes|no|deny|allow|reject|skip)/i,
  /allow once/i,
  /allow always/i,
];

function isWaitingForInput(recentOutput: string): boolean {
  const clean = stripAnsi(recentOutput);
  // Only check the tail end (last ~1KB) for prompt patterns
  const tail = clean.slice(-1024);
  return INPUT_PATTERNS.some((p) => p.test(tail));
}

class TerminalManager {
  private terminals = new Map<string, TerminalProcess>();
  private outputListeners: OutputListener[] = [];
  private exitListeners: ExitListener[] = [];
  private activityListeners: ActivityListener[] = [];
  private messageListeners: MessageCaptureListener[] = [];

  // Activity tracking per session
  private idleTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private currentState = new Map<string, string>(); // track last emitted state to avoid duplicates
  private recentOutput = new Map<string, string>(); // rolling buffer of recent output per session
  private waitingInputFlag = new Map<string, boolean>(); // sticky: once detected, stays until Enter
  private resizeSuppressUntil = new Map<string, number>(); // suppress activity after resize

  // Message capture state
  private inputBuffer = new Map<string, string>();    // accumulates raw user keystrokes
  private outputBuffer = new Map<string, string>();   // accumulates Claude's response (post-stripAnsi)
  private pendingUserMsg = new Map<string, string>(); // user message waiting to be paired

  onOutput(listener: OutputListener) {
    this.outputListeners.push(listener);
  }

  onExit(listener: ExitListener) {
    this.exitListeners.push(listener);
  }

  onActivity(listener: ActivityListener) {
    this.activityListeners.push(listener);
  }

  onMessage(listener: MessageCaptureListener) {
    this.messageListeners.push(listener);
  }

  private emitActivity(sessionId: string, activity: SessionActivity) {
    // Skip duplicate emissions
    const key = activity.state;
    if (this.currentState.get(sessionId) === key) return;
    this.currentState.set(sessionId, key);

    for (const l of this.activityListeners) l(sessionId, activity);
  }

  /**
   * Use @xterm/headless to properly render raw PTY output into clean text.
   * This correctly handles \r overwriting, cursor movements, and all ANSI codes
   * — exactly as a real terminal would display it.
   */
  private static async renderWithHeadless(raw: string, cols: number): Promise<string> {
    const term = new HeadlessTerminal({ cols, rows: 200, scrollback: 0, allowProposedApi: true });
    await new Promise<void>((resolve) => term.write(raw, resolve));

    const buf = term.buffer.active;
    const lines: string[] = [];
    for (let i = 0; i < buf.length; i++) {
      const line = buf.getLine(i);
      if (line) lines.push(line.translateToString(true));
    }
    term.dispose();

    // Trim trailing empty lines
    while (lines.length > 0 && !lines[lines.length - 1].trim()) lines.pop();
    return lines.join('\n');
  }

  /** Extract assistant response from rendered terminal output */
  private static extractResponse(rendered: string, userMsg: string): string {
    const lines = rendered.split('\n').map((l) => l.trim()).filter(Boolean);

    // Claude CLI marks response lines with ⏺ — use those first
    const responseLines = lines
      .filter((l) => l.startsWith('⏺'))
      .map((l) => l.slice(1).trim());

    if (responseLines.length > 0) {
      return responseLines.join('\n').trim();
    }

    // Fallback: filter known non-content lines
    return lines
      .filter((line) => {
        if (line.includes(userMsg)) return false;
        if (line.startsWith('●') || line.startsWith('✓') || line.startsWith('✗')) return false;
        if (line.startsWith('❯') || line.startsWith('?')) return false;
        if (/^[─═\-]+$/.test(line)) return false;
        if (/esc\s*to\s*interrupt/i.test(line)) return false;
        return true;
      })
      .join('\n')
      .trim();
  }

  private async flushCapturedMessage(sessionId: string) {
    if (!this.pendingUserMsg.has(sessionId)) return;
    const userMsg = this.pendingUserMsg.get(sessionId)!;
    const raw = this.outputBuffer.get(sessionId) || '';
    this.pendingUserMsg.delete(sessionId);
    this.outputBuffer.delete(sessionId);

    const cols = this.terminals.get(sessionId)?.cols ?? 120;
    const rendered = await TerminalManager.renderWithHeadless(raw, cols);
    const assistantMsg = TerminalManager.extractResponse(rendered, userMsg);
    if (assistantMsg) {
      for (const l of this.messageListeners) l(sessionId, userMsg, assistantMsg);
    }
  }

  private appendOutput(sessionId: string, data: string) {
    const buf = (this.recentOutput.get(sessionId) || '') + data;
    // Keep last 2KB
    this.recentOutput.set(sessionId, buf.length > 2048 ? buf.slice(-2048) : buf);
  }

  private resetIdleTimer(sessionId: string) {
    const existing = this.idleTimers.get(sessionId);
    if (existing) clearTimeout(existing);

    this.idleTimers.set(sessionId, setTimeout(() => {
      this.idleTimers.delete(sessionId);
      // Once waiting_input is detected, it stays sticky until user submits (Enter)
      if (this.waitingInputFlag.get(sessionId)) {
        this.emitActivity(sessionId, { state: 'waiting_input' });
        return;
      }
      const recent = this.recentOutput.get(sessionId) || '';
      if (isWaitingForInput(recent)) {
        this.waitingInputFlag.set(sessionId, true);
        this.emitActivity(sessionId, { state: 'waiting_input' });
      } else {
        this.emitActivity(sessionId, { state: 'idle' });
        this.flushCapturedMessage(sessionId).catch((err) =>
          console.error(`[terminal:${sessionId.slice(0, 8)}] message capture error:`, err)
        );
      }
    }, 2000));
  }

  private clearIdleTimer(sessionId: string) {
    const existing = this.idleTimers.get(sessionId);
    if (existing) clearTimeout(existing);
    this.idleTimers.delete(sessionId);
    this.currentState.delete(sessionId);
    this.recentOutput.delete(sessionId);
    this.waitingInputFlag.delete(sessionId);
    this.resizeSuppressUntil.delete(sessionId);
    this.inputBuffer.delete(sessionId);
    this.outputBuffer.delete(sessionId);
    this.pendingUserMsg.delete(sessionId);
  }

  /**
   * Create an interactive Claude CLI terminal for a session.
   * @param resumeId  — existing Claude session ID → pass --resume
   * @param newSessionId — new UUID to assign → pass --session-id (first run)
   */
  create(sessionId: string, cwd: string, cols = 120, rows = 30, resumeId?: string, newSessionId?: string, skipPermissions?: boolean): boolean {
    if (this.terminals.has(sessionId)) {
      return false; // already exists
    }

    // Strip CLAUDECODE to allow nested launch, keep auth token
    const env = { ...process.env } as Record<string, string>;
    delete env.CLAUDECODE;

    const args: string[] = [];
    if (skipPermissions) {
      args.push('--dangerously-skip-permissions');
    }
    if (resumeId) {
      args.push('--resume', resumeId);
    } else if (newSessionId) {
      args.push('--session-id', newSessionId);
    }

    console.log(`[terminal:${sessionId.slice(0, 8)}] spawning claude ${args.join(' ')} in ${cwd} (${cols}x${rows})`);

    try {
      const shell = pty.spawn('claude', args, {
        name: 'xterm-256color',
        cols,
        rows,
        cwd,
        env,
      });

      const entry: TerminalProcess = { pty: shell, cwd, cols };
      this.terminals.set(sessionId, entry);

      // Guard callbacks: only emit if this shell is still the current one for this session.
      shell.onData((data) => {
        if (this.terminals.get(sessionId) !== entry) {
          console.log(`[terminal:${sessionId.slice(0, 8)}] stale data ignored`);
          return;
        }
        console.log(`[terminal:${sessionId.slice(0, 8)}] data (${data.length} bytes)`);
        for (const l of this.outputListeners) l(sessionId, data);

        // Buffer output for input detection
        this.appendOutput(sessionId, data);

        // Capture raw PTY output for message history (headless terminal needs raw ANSI data)
        if (this.pendingUserMsg.has(sessionId)) {
          const prev = this.outputBuffer.get(sessionId) || '';
          this.outputBuffer.set(sessionId, prev + data);
        }

        // Suppress activity emission during resize window or waiting_input
        const suppressUntil = this.resizeSuppressUntil.get(sessionId) || 0;
        if (this.waitingInputFlag.get(sessionId) || Date.now() < suppressUntil) {
          this.resetIdleTimer(sessionId);
        } else {
          // Activity: output flowing → running
          this.emitActivity(sessionId, { state: 'tool_use', tool: 'processing', preview: '' });
          this.resetIdleTimer(sessionId);
        }
      });

      shell.onExit(({ exitCode }) => {
        if (this.terminals.get(sessionId) !== entry) {
          console.log(`[terminal:${sessionId.slice(0, 8)}] stale exit ignored (code=${exitCode})`);
          return;
        }
        console.log(`[terminal:${sessionId.slice(0, 8)}] exited (code=${exitCode})`);
        this.terminals.delete(sessionId);
        this.clearIdleTimer(sessionId);
        for (const l of this.exitListeners) l(sessionId, exitCode);
      });

      return true;
    } catch (err: any) {
      console.error(`[terminal:${sessionId.slice(0, 8)}] spawn failed:`, err.message);
      return false;
    }
  }

  write(sessionId: string, data: string) {
    const term = this.terminals.get(sessionId);
    if (term) {
      term.pty.write(data);

      if (data.includes('\r') || data.includes('\n')) {
        // Flush input buffer as pending user message
        const beforeEnter = data.split(/[\r\n]/)[0].replace(/[\x00-\x1f\x7f-\x9f]/g, '');
        const accumulated = (this.inputBuffer.get(sessionId) || '') + beforeEnter;
        const userMsg = accumulated.trim();
        if (userMsg) {
          this.pendingUserMsg.set(sessionId, userMsg);
          this.outputBuffer.set(sessionId, '');
        }
        this.inputBuffer.delete(sessionId);

        // Clear sticky flag and buffer, emit thinking
        this.waitingInputFlag.delete(sessionId);
        this.recentOutput.delete(sessionId);
        this.emitActivity(sessionId, { state: 'thinking', preview: '' });
        this.resetIdleTimer(sessionId);
      } else if (data === '\x7f') {
        // Backspace — remove last char from input buffer
        const buf = this.inputBuffer.get(sessionId) || '';
        if (buf.length > 0) this.inputBuffer.set(sessionId, buf.slice(0, -1));
      } else {
        // Accumulate printable characters — strip full ANSI sequences first,
        // then remove any remaining control chars
        const printable = stripAnsi(data).replace(/[\x00-\x1f\x7f-\x9f]/g, '');
        if (printable) {
          const buf = this.inputBuffer.get(sessionId) || '';
          this.inputBuffer.set(sessionId, buf + printable);
        }
      }
      // Arrow keys / other navigation: don't clear waiting state
    }
  }

  resize(sessionId: string, cols: number, rows: number) {
    const term = this.terminals.get(sessionId);
    if (term) {
      // Suppress activity for 500ms after resize to avoid flash from CLI redraw
      this.resizeSuppressUntil.set(sessionId, Date.now() + 500);
      term.pty.resize(cols, rows);
    }
  }

  kill(sessionId: string) {
    const term = this.terminals.get(sessionId);
    if (term) {
      this.terminals.delete(sessionId); // Remove from map FIRST so callbacks see it as stale
      this.clearIdleTimer(sessionId);
      term.pty.kill();
    }
  }

  has(sessionId: string): boolean {
    return this.terminals.has(sessionId);
  }

  cleanupAll() {
    for (const [id] of this.terminals) {
      this.kill(id);
    }
  }
}

export const terminalManager = new TerminalManager();
