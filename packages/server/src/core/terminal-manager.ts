import * as pty from 'node-pty';
import type { SessionActivity } from '@ccui/shared';

type OutputListener = (sessionId: string, data: string) => void;
type ExitListener = (sessionId: string, code: number) => void;
type ActivityListener = (sessionId: string, activity: SessionActivity) => void;

interface TerminalProcess {
  pty: pty.IPty;
  cwd: string;
}

class TerminalManager {
  private terminals = new Map<string, TerminalProcess>();
  private outputListeners: OutputListener[] = [];
  private exitListeners: ExitListener[] = [];
  private activityListeners: ActivityListener[] = [];

  // Activity tracking per session
  private idleTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private currentState = new Map<string, string>(); // track last emitted state to avoid duplicates

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

  private resetIdleTimer(sessionId: string) {
    const existing = this.idleTimers.get(sessionId);
    if (existing) clearTimeout(existing);

    this.idleTimers.set(sessionId, setTimeout(() => {
      this.idleTimers.delete(sessionId);
      this.emitActivity(sessionId, { state: 'idle' });
    }, 2000));
  }

  private clearIdleTimer(sessionId: string) {
    const existing = this.idleTimers.get(sessionId);
    if (existing) clearTimeout(existing);
    this.idleTimers.delete(sessionId);
    this.currentState.delete(sessionId);
  }

  /**
   * Create an interactive Claude CLI terminal for a session.
   * The session must already exist in the DB.
   */
  create(sessionId: string, cwd: string, cols = 120, rows = 30): boolean {
    if (this.terminals.has(sessionId)) {
      return false; // already exists
    }

    // Strip CLAUDECODE to allow nested launch, keep auth token
    const env = { ...process.env } as Record<string, string>;
    delete env.CLAUDECODE;

    console.log(`[terminal:${sessionId.slice(0, 8)}] spawning claude in ${cwd} (${cols}x${rows})`);

    try {
      const shell = pty.spawn('claude', [], {
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

        // Activity: output flowing → running
        this.emitActivity(sessionId, { state: 'tool_use', tool: 'processing', preview: '' });
        this.resetIdleTimer(sessionId);
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

      // If user pressed Enter, mark as "thinking" (waiting for Claude to respond)
      if (data.includes('\r') || data.includes('\n')) {
        this.emitActivity(sessionId, { state: 'thinking', preview: '' });
        this.resetIdleTimer(sessionId);
      }
    }
  }

  resize(sessionId: string, cols: number, rows: number) {
    const term = this.terminals.get(sessionId);
    if (term) {
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
