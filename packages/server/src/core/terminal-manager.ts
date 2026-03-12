import * as pty from 'node-pty';
import type { SessionActivity } from '@ccui/shared';

type OutputListener = (sessionId: string, data: string) => void;
type ExitListener = (sessionId: string, code: number) => void;
type ActivityListener = (sessionId: string, activity: SessionActivity) => void;

interface TerminalProcess {
  pty: pty.IPty;
  cwd: string;
}

// Strip ANSI escape sequences for pattern matching
function stripAnsi(s: string): string {
  return s.replace(/\x1b\[[0-9;]*[a-zA-Z]|\x1b\].*?(?:\x07|\x1b\\)|\x1b[()][0-9A-B]|\x1b\[[\?]?[0-9;]*[hlm]/g, '');
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

  // Activity tracking per session
  private idleTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private currentState = new Map<string, string>(); // track last emitted state to avoid duplicates
  private recentOutput = new Map<string, string>(); // rolling buffer of recent output per session
  private waitingInputFlag = new Map<string, boolean>(); // sticky: once detected, stays until Enter
  private resizeSuppressUntil = new Map<string, number>(); // suppress activity after resize

  onOutput(listener: OutputListener) {
    this.outputListeners.push(listener);
  }

  onExit(listener: ExitListener) {
    this.exitListeners.push(listener);
  }

  onActivity(listener: ActivityListener) {
    this.activityListeners.push(listener);
  }

  private emitActivity(sessionId: string, activity: SessionActivity) {
    // Skip duplicate emissions
    const key = activity.state;
    if (this.currentState.get(sessionId) === key) return;
    this.currentState.set(sessionId, key);

    for (const l of this.activityListeners) l(sessionId, activity);
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
  }

  /**
   * Create an interactive Claude CLI terminal for a session.
   * @param resumeId  — existing Claude session ID → pass --resume
   * @param newSessionId — new UUID to assign → pass --session-id (first run)
   */
  create(sessionId: string, cwd: string, cols = 120, rows = 30, resumeId?: string, newSessionId?: string): boolean {
    if (this.terminals.has(sessionId)) {
      return false; // already exists
    }

    // Strip CLAUDECODE to allow nested launch, keep auth token
    const env = { ...process.env } as Record<string, string>;
    delete env.CLAUDECODE;

    const args: string[] = [];
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

      const entry: TerminalProcess = { pty: shell, cwd };
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

      // Enter/Return = user submitted a choice → clear sticky flag and buffer
      if (data.includes('\r') || data.includes('\n')) {
        this.waitingInputFlag.delete(sessionId);
        this.recentOutput.delete(sessionId);
        this.emitActivity(sessionId, { state: 'thinking', preview: '' });
        this.resetIdleTimer(sessionId);
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
