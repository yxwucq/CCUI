import * as pty from 'node-pty';
import * as fs from 'fs';
import { createRequire } from 'module';
import type { CliProviderType, SessionActivity } from '@ccui/shared';
import { usageTracker } from './usage-tracker.js';
import { getProvider, claudeJsonlPath, discoverCodexThread, findCodexRolloutPath, type CliProviderConfig } from './cli-providers.js';
import { getDB } from '../db/database.js';

const require = createRequire(import.meta.url);
const { Terminal: HeadlessTerminal } = require('@xterm/headless') as { Terminal: any };

const DEBUG = !!process.env.DEBUG;

type OutputListener = (sessionId: string, data: string) => void;
type ExitListener = (sessionId: string, code: number) => void;
type ActivityListener = (sessionId: string, activity: SessionActivity) => void;
type MessageCaptureListener = (sessionId: string, userMsg: string, assistantMsg: string) => void;

interface TerminalProcess {
  pty: pty.IPty;
  cwd: string;
  cols: number;
  provider: CliProviderConfig;
}

interface JSONLState {
  watcher: fs.FSWatcher | null;
  filePath: string;
  offset: number;
  seenRequestIds: Set<string>;
  parseMode: 'claude' | 'codex';
}

// Strip ANSI escape sequences for pattern matching
function stripAnsi(s: string): string {
  return s.replace(/\x1b\[[\x3c-\x3f]?[0-9;]*[a-zA-Z]|\x1b\].*?(?:\x07|\x1b\\)|\x1b[()][0-9A-B]/g, '');
}

function isWaitingForInput(recentOutput: string, patterns: RegExp[]): boolean {
  const clean = stripAnsi(recentOutput);
  const tail = clean.slice(-1024);
  return patterns.some((p) => p.test(tail));
}

/** Extract tool name from terminal output using provider-specific pattern */
function detectToolFromOutput(recentOutput: string, toolPattern: RegExp): { tool: string; preview: string } | null {
  const clean = stripAnsi(recentOutput);
  const tail = clean.slice(-1024);
  // Reset lastIndex for global regexes
  toolPattern.lastIndex = 0;
  const matches = [...tail.matchAll(toolPattern)];
  if (matches.length === 0) return null;
  const last = matches[matches.length - 1];
  return { tool: last[1], preview: last[2]?.trim().slice(0, 80) || '' };
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

  // JSONL usage tracking per session
  private jsonlWatchers = new Map<string, JSONLState>();

  // Tool transition throttling — minimum dwell time between tool-to-tool switches
  private static TOOL_MIN_DWELL_MS = 2000;
  private toolEmitTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private lastToolEmitTime = new Map<string, number>();

  // Message capture state
  private inputBuffer = new Map<string, string>();    // accumulates raw user keystrokes
  private outputBuffer = new Map<string, string>();   // accumulates CLI's response (post-stripAnsi)
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
    // On non-tool states, cancel any pending tool transition timer
    if (activity.state !== 'tool_use') {
      const timer = this.toolEmitTimers.get(sessionId);
      if (timer) { clearTimeout(timer); this.toolEmitTimers.delete(sessionId); }
      this.lastToolEmitTime.delete(sessionId);
    }

    // Skip duplicate emissions — include tool name so Read→Edit→Bash transitions emit
    const key = activity.state === 'tool_use'
      ? `tool_use:${(activity as any).tool || ''}`
      : activity.state;
    if (this.currentState.get(sessionId) === key) return;
    this.currentState.set(sessionId, key);

    for (const l of this.activityListeners) l(sessionId, activity);
  }

  /** Throttled tool_use emission — ensures each tool is displayed for at least TOOL_MIN_DWELL_MS */
  private emitToolActivity(sessionId: string, tool: string, preview: string) {
    // Same tool already displayed — nothing to do
    if (this.currentState.get(sessionId) === `tool_use:${tool}`) return;

    const now = Date.now();
    const lastEmit = this.lastToolEmitTime.get(sessionId) || 0;
    const elapsed = now - lastEmit;

    // Cancel any previously scheduled transition
    const existing = this.toolEmitTimers.get(sessionId);
    if (existing) { clearTimeout(existing); this.toolEmitTimers.delete(sessionId); }

    const doEmit = () => {
      this.toolEmitTimers.delete(sessionId);
      this.lastToolEmitTime.set(sessionId, Date.now());
      this.emitActivity(sessionId, { state: 'tool_use', tool, preview });
    };

    // Immediate transition from 'processing' placeholder or if enough time has passed
    const fromProcessing = this.currentState.get(sessionId) === 'tool_use:processing';
    if (fromProcessing || elapsed >= TerminalManager.TOOL_MIN_DWELL_MS) {
      doEmit();
    } else {
      // Delay until the current tool has been displayed long enough
      const delay = TerminalManager.TOOL_MIN_DWELL_MS - elapsed;
      this.toolEmitTimers.set(sessionId, setTimeout(doEmit, delay));
    }
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
  private static extractResponse(rendered: string, userMsg: string, agentMarker: string): string {
    const lines = rendered.split('\n').map((l) => l.trim()).filter(Boolean);

    // CLI marks response lines with agent marker (⏺ for Claude, • for Codex) — use those first
    const responseLines = lines
      .filter((l) => l.startsWith(agentMarker))
      .map((l) => l.slice(agentMarker.length).trim());

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

    const entry = this.terminals.get(sessionId);
    const cols = entry?.cols ?? 120;
    const agentMarker = entry?.provider.patterns.agentMarker ?? '⏺';
    const rendered = await TerminalManager.renderWithHeadless(raw, cols);
    const assistantMsg = TerminalManager.extractResponse(rendered, userMsg, agentMarker);
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
      const entry = this.terminals.get(sessionId);
      const patterns = entry?.provider.patterns.inputPrompts ?? [];
      const recent = this.recentOutput.get(sessionId) || '';
      if (isWaitingForInput(recent, patterns)) {
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
    const toolTimer = this.toolEmitTimers.get(sessionId);
    if (toolTimer) clearTimeout(toolTimer);
    this.toolEmitTimers.delete(sessionId);
    this.lastToolEmitTime.delete(sessionId);
    this.inputBuffer.delete(sessionId);
    this.outputBuffer.delete(sessionId);
    this.pendingUserMsg.delete(sessionId);
    const jsonl = this.jsonlWatchers.get(sessionId);
    if (jsonl) { jsonl.watcher?.close(); this.jsonlWatchers.delete(sessionId); }
  }

  /** Start polling a usage file (JSONL/rollout) for new records */
  private startUsageFileWatch(ccuiSessionId: string, filePath: string, parseMode: 'claude' | 'codex', readFromStart = false) {
    // Claude: skip existing content (historical). Codex: read from start (current session data).
    let initialOffset = 0;
    if (!readFromStart) {
      try { initialOffset = fs.statSync(filePath).size; } catch { /* file doesn't exist yet */ }
    }

    const state: JSONLState = { watcher: null, filePath, offset: initialOffset, seenRequestIds: new Set(), parseMode };
    this.jsonlWatchers.set(ccuiSessionId, state);

    const processNewLines = () => {
      try {
        const { size } = fs.statSync(filePath);
        if (size <= state.offset) return;
        const buf = Buffer.allocUnsafe(size - state.offset);
        const fd = fs.openSync(filePath, 'r');
        fs.readSync(fd, buf, 0, buf.length, state.offset);
        fs.closeSync(fd);
        state.offset = size;

        if (state.parseMode === 'claude') {
          this.parseClaudeUsageLines(ccuiSessionId, buf.toString('utf8'), state);
        } else {
          this.parseCodexUsageLines(ccuiSessionId, buf.toString('utf8'), state);
        }
      } catch { /* file not accessible yet */ }
    };

    const timer = setInterval(processNewLines, 2000);
    state.watcher = { close: () => clearInterval(timer) } as unknown as fs.FSWatcher;
    console.log(`[terminal:${ccuiSessionId.slice(0, 8)}] polling ${parseMode} usage: ${filePath}`);
  }

  /** Parse Claude JSONL lines for usage records */
  private parseClaudeUsageLines(ccuiSessionId: string, content: string, state: JSONLState) {
    // Collect the LAST entry per requestId (earlier entries are partial/streaming-start)
    const lastByReqId = new Map<string, { usage: any; model: string }>();
    const noReqId: Array<{ usage: any; model: string }> = [];
    for (const line of content.split('\n')) {
      if (!line.trim()) continue;
      try {
        const entry = JSON.parse(line);
        if (entry.type !== 'assistant' || !entry.message?.usage) continue;
        const reqId: string = entry.requestId || '';
        const record = { usage: entry.message.usage, model: entry.message.model || '' };
        if (reqId) {
          lastByReqId.set(reqId, record); // overwrite → keeps last
        } else {
          noReqId.push(record);
        }
      } catch { /* malformed JSON line */ }
    }

    // Record only unseen requestIds (last/complete entry for each)
    for (const [reqId, { usage, model }] of lastByReqId) {
      if (state.seenRequestIds.has(reqId)) continue;
      state.seenRequestIds.add(reqId);
      usageTracker.recordFromClaude(ccuiSessionId, usage, model);
    }
    for (const { usage, model } of noReqId) {
      usageTracker.recordFromClaude(ccuiSessionId, usage, model);
    }
  }

  /** Parse Codex rollout lines for usage records (token_count events) */
  private parseCodexUsageLines(ccuiSessionId: string, content: string, state: JSONLState) {
    let sessionModel = '';
    for (const line of content.split('\n')) {
      if (!line.trim()) continue;
      try {
        const entry = JSON.parse(line);
        // Capture model from turn_context (session_meta doesn't include it)
        if (entry.type === 'turn_context' && entry.payload?.model) {
          sessionModel = entry.payload.model;
        }
        // token_count events contain usage data
        if (entry.type === 'event_msg' && entry.payload?.type === 'token_count') {
          const total = entry.payload?.info?.total_token_usage;
          const last = entry.payload?.info?.last_token_usage;
          if (!last || !total) continue;
          // Deduplicate by total_tokens — Codex emits duplicate token_count events
          const totalKey = `total:${total.total_tokens || 0}`;
          if (state.seenRequestIds.has(totalKey)) continue;
          state.seenRequestIds.add(totalKey);
          // Build a Claude-compatible usage object
          const usage = {
            input_tokens: last.input_tokens || 0,
            output_tokens: last.output_tokens || 0,
            cache_read_input_tokens: last.cached_input_tokens || 0,
            cache_creation_input_tokens: 0,
          };
          usageTracker.recordFromClaude(ccuiSessionId, usage, sessionModel);
        }
      } catch { /* malformed line */ }
    }
  }

  /** Start usage tracking for a Codex session — discover thread ID and rollout file */
  private startCodexUsageWatch(ccuiSessionId: string, cwd: string) {
    let attempts = 0;
    const retryMs = 2000;
    const maxAttempts = 30;
    const spawnTime = Math.floor(Date.now() / 1000) - 10; // Allow clock skew and delayed thread persistence

    const tryDiscover = () => {
      attempts++;
      // Codex resolves symlinks, so /tmp → /private/tmp on macOS
      let resolvedCwd = cwd;
      try { resolvedCwd = fs.realpathSync(cwd); } catch { /* cwd may not exist yet */ }
      const thread = discoverCodexThread(resolvedCwd, spawnTime) || (resolvedCwd !== cwd ? discoverCodexThread(cwd, spawnTime) : null);
      if (!thread) {
        if (attempts < maxAttempts) {
          setTimeout(tryDiscover, retryMs);
        } else {
          console.log(`[terminal:${ccuiSessionId.slice(0, 8)}] failed to discover Codex thread after ${maxAttempts} attempts`);
        }
        return;
      }

      // Store thread ID in DB for future resume
      try {
        const db = getDB();
        db.prepare('UPDATE sessions SET claude_session_id = ? WHERE id = ?').run(thread.id, ccuiSessionId);
      } catch { /* best effort */ }

      // Newer Codex stores rollout_path directly in threads; keep a DB lookup fallback.
      const rolloutPath = thread.rolloutPath || findCodexRolloutPath(thread.id);
      if (rolloutPath) {
        this.startUsageFileWatch(ccuiSessionId, rolloutPath, 'codex', true);
      } else {
        console.log(`[terminal:${ccuiSessionId.slice(0, 8)}] Codex thread ${thread.id.slice(0, 8)} found but no rollout file yet`);
        if (attempts < maxAttempts) {
          setTimeout(tryDiscover, retryMs);
        }
      }
    };

    // Start discovery after a short delay to let Codex initialize its state DB entry.
    setTimeout(tryDiscover, 1000);
  }

  /**
   * Create an interactive CLI terminal for a session.
   * @param resumeId  — existing CLI session ID → resume
   * @param newSessionId — new UUID to assign (Claude only, Codex auto-generates)
   */
  create(sessionId: string, cwd: string, cols = 120, rows = 30, resumeId?: string, newSessionId?: string, skipPermissions?: boolean, cliProvider?: CliProviderType): boolean {
    if (this.terminals.has(sessionId)) {
      return false; // already exists
    }

    const provider = getProvider(cliProvider);

    const env = { ...process.env } as Record<string, string>;
    provider.envSetup(env);

    const args = provider.buildArgs({ resumeId, newSessionId, skipPermissions });

    console.log(`[terminal:${sessionId.slice(0, 8)}] spawning ${provider.binary} ${args.join(' ')} in ${cwd} (${cols}x${rows})`);

    try {
      const shell = pty.spawn(provider.binary, args, {
        name: 'xterm-256color',
        cols,
        rows,
        cwd,
        env,
      });

      const entry: TerminalProcess = { pty: shell, cwd, cols, provider };
      this.terminals.set(sessionId, entry);

      // Guard callbacks: only emit if this shell is still the current one for this session.
      shell.onData((data) => {
        if (this.terminals.get(sessionId) !== entry) {
          if (DEBUG) console.log(`[terminal:${sessionId.slice(0, 8)}] stale data ignored`);
          return;
        }
        if (DEBUG) console.log(`[terminal:${sessionId.slice(0, 8)}] data (${data.length} bytes)`);
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
          // Activity: detect real tool name from CLI output (throttled)
          const detected = detectToolFromOutput(this.recentOutput.get(sessionId) || '', provider.patterns.toolPrefix);
          this.emitToolActivity(
            sessionId,
            detected?.tool || 'processing',
            detected?.preview || '',
          );
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

      // Start usage tracking
      if (provider.type === 'claude') {
        const claudeId = resumeId || newSessionId;
        if (claudeId) this.startUsageFileWatch(sessionId, claudeJsonlPath(cwd, claudeId), 'claude');
      } else if (provider.type === 'codex') {
        if (resumeId) {
          // Resuming — we already know the thread ID, find the rollout file
          const rolloutPath = findCodexRolloutPath(resumeId);
          if (rolloutPath) {
            this.startUsageFileWatch(sessionId, rolloutPath, 'codex');
          } else {
            this.startCodexUsageWatch(sessionId, cwd);
          }
        } else {
          // New session — discover thread ID after Codex starts
          this.startCodexUsageWatch(sessionId, cwd);
        }
      }

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
