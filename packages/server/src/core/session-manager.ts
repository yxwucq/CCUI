import { spawn, ChildProcess } from 'child_process';
import { v4 as uuid } from 'uuid';
import { getDB } from '../db/database.js';
import { usageTracker } from './usage-tracker.js';
import { createWorktree, removeWorktree, getCurrentBranch } from './worktree-manager.js';
import type { Session, ChatMessage, SessionActivity, FileActivity } from '@ccui/shared';

interface SessionProcess {
  child: ChildProcess;
  session: Session;
}

type OutputListener = (sessionId: string, content: string, done: boolean) => void;
type ErrorListener = (sessionId: string, error: string) => void;
type StatusListener = (sessionId: string, status: Session['status']) => void;
type ActivityListener = (sessionId: string, activity: SessionActivity) => void;
type BranchListener = (sessionId: string, branch: string) => void;
type FileActivityListener = (sessionId: string, activity: FileActivity) => void;

function extractFileOp(tool: string, input: any): { op: FileActivity['op'] | null; path: string | null } {
  switch (tool) {
    case 'Read':
      return { op: 'read', path: input.file_path || input.path || null };
    case 'Write': case 'Edit': case 'MultiEdit':
      return { op: 'write', path: input.file_path || input.path || null };
    case 'LS': case 'Glob':
      return { op: 'read', path: input.path || input.pattern || null };
    case 'Grep':
      return { op: 'read', path: input.path || input.pattern || null };
    case 'Bash':
      return { op: 'exec', path: ((input.command as string) || '').slice(0, 80) };
    default:
      return { op: null, path: null };
  }
}

class SessionManager {
  private processes = new Map<string, SessionProcess>();
  private outputListeners: OutputListener[] = [];
  private errorListeners: ErrorListener[] = [];
  private statusListeners: StatusListener[] = [];
  private activityListeners: ActivityListener[] = [];
  private branchListeners: BranchListener[] = [];
  private fileActivityListeners: FileActivityListener[] = [];
  private sessionActivity = new Map<string, { activity: SessionActivity; timer: ReturnType<typeof setTimeout> | null }>();
  private branchPollTimer: ReturnType<typeof setInterval> | null = null;
  private knownBranches = new Map<string, string>(); // sessionId → last known branch
  // key: `${sessionId}:${blockIndex}`, tracks tool_use input JSON as it streams in
  private toolInputBuffers = new Map<string, { name: string; json: string }>();
  private lastModel = new Map<string, string>(); // sessionId → last known model

  onOutput(listener: OutputListener) {
    this.outputListeners.push(listener);
  }
  onError(listener: ErrorListener) {
    this.errorListeners.push(listener);
  }
  onStatus(listener: StatusListener) {
    this.statusListeners.push(listener);
  }
  onActivity(listener: ActivityListener) {
    this.activityListeners.push(listener);
  }
  onBranch(listener: BranchListener) {
    this.branchListeners.push(listener);
  }
  onFileActivity(listener: FileActivityListener) {
    this.fileActivityListeners.push(listener);
  }

  /** Start polling git branches for active sessions every 5s */
  startBranchPolling() {
    if (this.branchPollTimer) return;
    this.branchPollTimer = setInterval(() => this.pollBranches(), 5000);
  }

  private pollBranches() {
    const db = getDB();
    const rows = db.prepare("SELECT id, project_path, worktree_path, branch FROM sessions WHERE status != 'terminated'").all() as any[];

    for (const row of rows) {
      try {
        const cwd = row.worktree_path || row.project_path;
        const actual = getCurrentBranch(cwd);
        if (!actual) continue;

        const known = this.knownBranches.get(row.id) ?? row.branch;
        if (actual !== known) {
          this.knownBranches.set(row.id, actual);
          // Update DB
          db.prepare('UPDATE sessions SET branch = ? WHERE id = ?').run(actual, row.id);
          // Notify clients
          for (const l of this.branchListeners) l(row.id, actual);
        }
      } catch { /* git command failed, skip */ }
    }
  }

  private emitOutput(sessionId: string, content: string, done: boolean) {
    for (const l of this.outputListeners) l(sessionId, content, done);
  }
  private emitError(sessionId: string, error: string) {
    for (const l of this.errorListeners) l(sessionId, error);
  }
  private emitStatus(sessionId: string, status: Session['status']) {
    for (const l of this.statusListeners) l(sessionId, status);
  }
  private emitFileActivity(sessionId: string, activity: FileActivity) {
    for (const l of this.fileActivityListeners) l(sessionId, activity);
  }

  private emitActivity(sessionId: string, activity: SessionActivity, immediate = false) {
    const entry = this.sessionActivity.get(sessionId);
    if (entry?.timer) clearTimeout(entry.timer);

    if (immediate) {
      this.sessionActivity.set(sessionId, { activity, timer: null });
      for (const l of this.activityListeners) l(sessionId, activity);
      return;
    }
    // Throttle preview updates to ~150ms
    const timer = setTimeout(() => {
      for (const l of this.activityListeners) l(sessionId, activity);
    }, 150);
    this.sessionActivity.set(sessionId, { activity, timer });
  }

  /** Create a new session (idle until first message is sent) */
  createSession(projectPath: string, opts?: { agentId?: string; branch?: string; name?: string; skipPermissions?: boolean }): Session {
    const id = uuid();
    const now = new Date().toISOString();
    const { agentId, branch, name, skipPermissions } = opts || {};

    let worktreePath: string | undefined;
    const currentBranch = getCurrentBranch(projectPath);

    if (branch && branch !== currentBranch) {
      worktreePath = createWorktree(projectPath, id, branch);
    }

    const sessionName = name || branch || `session-${id.slice(0, 8)}`;
    const session: Session = {
      id,
      name: sessionName,
      projectPath,
      branch: branch || currentBranch,
      worktreePath,
      agentId,
      skipPermissions: skipPermissions || false,
      status: 'idle',
      createdAt: now,
      lastActiveAt: now,
    };

    const db = getDB();
    db.prepare(
      'INSERT INTO sessions (id, name, project_path, branch, worktree_path, agent_id, skip_permissions, status, claude_session_id, created_at, last_active_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(id, sessionName, projectPath, session.branch || null, worktreePath || null, agentId || null, skipPermissions ? 1 : 0, 'idle', null, now, now);

    return session;
  }

  /** Resume a terminated session — marks it as idle so messages can be sent again */
  resumeSession(sessionId: string): Session {
    if (this.processes.has(sessionId)) {
      return this.processes.get(sessionId)!.session;
    }

    const db = getDB();
    const row = db.prepare('SELECT * FROM sessions WHERE id = ?').get(sessionId) as any;
    if (!row) throw new Error('Session not found');

    const session = this.mapSession(row);
    session.status = 'idle';
    db.prepare('UPDATE sessions SET status = ?, last_active_at = ? WHERE id = ?')
      .run('idle', new Date().toISOString(), sessionId);

    this.emitStatus(sessionId, 'idle');
    return session;
  }

  /** Send a message — spawns a claude process for this single exchange */
  sendMessage(sessionId: string, content: string) {
    // If a process is already running for this session, queue error
    if (this.processes.has(sessionId)) {
      this.emitError(sessionId, 'Claude is still processing the previous message. Please wait.');
      return;
    }

    const db = getDB();
    const row = db.prepare('SELECT * FROM sessions WHERE id = ?').get(sessionId) as any;
    if (!row) throw new Error('Session not found');

    // Save user message
    const msgId = uuid();
    db.prepare(
      'INSERT INTO messages (id, session_id, role, content, timestamp) VALUES (?, ?, ?, ?, ?)'
    ).run(msgId, sessionId, 'user', content, new Date().toISOString());

    // Update status to active
    db.prepare('UPDATE sessions SET last_active_at = ?, status = ? WHERE id = ?')
      .run(new Date().toISOString(), 'active', sessionId);
    this.emitStatus(sessionId, 'active');

    // Determine CWD
    const cwd = row.worktree_path || row.project_path;

    // Build args
    const args = ['-p', content, '--output-format', 'stream-json', '--verbose'];

    if (row.skip_permissions) {
      args.push('--dangerously-skip-permissions');
    }

    // Resume from previous claude session if available
    const claudeSessionId = row.claude_session_id;
    if (claudeSessionId) {
      args.push('--resume', claudeSessionId);
    }

    // Agent config
    if (row.agent_id) {
      const agent = db.prepare('SELECT * FROM agents WHERE id = ?').get(row.agent_id) as any;
      if (agent) {
        args.push('--system-prompt', agent.system_prompt);
        if (agent.max_turns) {
          args.push('--max-turns', String(agent.max_turns));
        }
      }
    }

    this.spawnClaude(sessionId, this.mapSession(row), args, cwd);
  }

  private spawnClaude(sessionId: string, session: Session, args: string[], cwd: string) {
    // Only remove CLAUDECODE to allow nested launch (keep CLAUDE_CODE_SESSION_ACCESS_TOKEN for auth)
    const env = { ...process.env };
    delete env.CLAUDECODE;

    console.log(`[claude:${sessionId.slice(0, 8)}] spawning in ${cwd}`);

    const child = spawn('claude', args, {
      cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
      env,
      detached: true,
    });

    let buffer = '';

    child.stdout?.on('data', (data: Buffer) => {
      buffer += data.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.trim()) continue;
        this.handleOutputLine(sessionId, line.trim());
      }
    });

    child.stderr?.on('data', (data: Buffer) => {
      const text = data.toString().trim();
      if (text) {
        console.log(`[claude:${sessionId.slice(0, 8)}] stderr: ${text.slice(0, 200)}`);
        this.emitError(sessionId, text);
      }
    });

    child.on('exit', (code) => {
      console.log(`[claude:${sessionId.slice(0, 8)}] process exited (code=${code})`);
      this.processes.delete(sessionId);
      this.clearToolBuffers(sessionId);

      // Flush remaining buffer
      if (buffer.trim()) {
        this.handleOutputLine(sessionId, buffer.trim());
        buffer = '';
      }

      const db = getDB();
      // Normal exit → idle (ready for next message). Error exit → still idle but show error
      db.prepare('UPDATE sessions SET status = ?, last_active_at = ? WHERE id = ?')
        .run('idle', new Date().toISOString(), sessionId);
      this.emitStatus(sessionId, 'idle');
      this.emitActivity(sessionId, { state: 'idle' }, true);
    });

    this.processes.set(sessionId, { child, session });
  }

  private handleOutputLine(sessionId: string, line: string) {
    try {
      const msg = JSON.parse(line);
      const db = getDB();

      // Capture claude session ID from init message
      if (msg.type === 'system' && msg.subtype === 'init' && msg.session_id) {
        console.log(`[claude:${sessionId.slice(0, 8)}] captured claude session: ${msg.session_id}`);
        db.prepare('UPDATE sessions SET claude_session_id = ? WHERE id = ?')
          .run(msg.session_id, sessionId);
        return;
      }

      if (msg.type === 'content_block_start') {
        const blockType = msg.content_block?.type;
        if (blockType === 'thinking') {
          this.emitActivity(sessionId, { state: 'thinking', preview: '' }, true);
        } else if (blockType === 'tool_use') {
          const toolName = msg.content_block?.name || 'tool';
          const bufKey = `${sessionId}:${msg.index}`;
          this.toolInputBuffers.set(bufKey, { name: toolName, json: '' });
          this.emitActivity(sessionId, { state: 'tool_use', tool: toolName, preview: '' }, true);
        } else if (blockType === 'text') {
          this.emitActivity(sessionId, { state: 'writing', preview: '' }, true);
        }
      } else if (msg.type === 'content_block_delta') {
        const deltaType = msg.delta?.type;
        if (deltaType === 'thinking_delta' && msg.delta?.thinking) {
          const text = msg.delta.thinking;
          const preview = text.length > 80 ? '…' + text.slice(-80) : text;
          this.emitActivity(sessionId, { state: 'thinking', preview });
        } else if (deltaType === 'input_json_delta' && msg.delta?.partial_json) {
          const bufKey = `${sessionId}:${msg.index}`;
          const buf = this.toolInputBuffers.get(bufKey);
          if (buf) buf.json += msg.delta.partial_json;
          const entry = this.sessionActivity.get(sessionId);
          const tool = (entry?.activity as any)?.tool || 'tool';
          const json = msg.delta.partial_json;
          const preview = json.length > 60 ? json.slice(0, 60) + '…' : json;
          this.emitActivity(sessionId, { state: 'tool_use', tool, preview });
        } else if (msg.delta?.text) {
          const text = msg.delta.text;
          this.emitOutput(sessionId, text, false);
          const preview = text.length > 80 ? '…' + text.slice(-80) : text;
          this.emitActivity(sessionId, { state: 'writing', preview });
        }
      } else if (msg.type === 'content_block_stop') {
        // Resolve tool_use input and emit file activity if applicable
        const bufKey = `${sessionId}:${msg.index}`;
        const buf = this.toolInputBuffers.get(bufKey);
        if (buf) {
          this.toolInputBuffers.delete(bufKey);
          try {
            const input = JSON.parse(buf.json || '{}');
            const { op, path } = extractFileOp(buf.name, input);
            if (op && path) {
              this.emitFileActivity(sessionId, { op, path, tool: buf.name, timestamp: new Date().toISOString() });
            }
          } catch { /* malformed partial JSON, skip */ }
        }
      } else if (msg.type === 'assistant' && msg.message) {
        // Capture model name from assistant message
        if (msg.message.model) {
          this.lastModel.set(sessionId, msg.message.model);
        }
        // Save aggregated assistant message to DB for history (text already streamed via deltas)
        const textBlocks = Array.isArray(msg.message.content)
          ? msg.message.content.filter((b: any) => b.type === 'text')
          : [];
        const content = typeof msg.message === 'string'
          ? msg.message
          : textBlocks.map((b: any) => b.text || '').join('');

        if (content) {
          const msgId = uuid();
          db.prepare(
            'INSERT INTO messages (id, session_id, role, content, timestamp) VALUES (?, ?, ?, ?, ?)'
          ).run(msgId, sessionId, 'assistant', content, new Date().toISOString());
        }
        // Don't re-emit — content was already streamed via content_block_delta
      } else if (msg.type === 'result') {
        if (msg.usage) {
          const model = msg.model || this.lastModel.get(sessionId) || '';
          usageTracker.recordFromClaude(sessionId, msg.usage, model);
        }
        // Signal stream completion (content already sent via deltas)
        this.emitOutput(sessionId, '', true);
        this.emitActivity(sessionId, { state: 'idle' }, true);
      } else if (msg.type === 'error') {
        const content = msg.message || msg.error || JSON.stringify(msg);
        this.emitError(sessionId, content);
      }
      // Ignore other message types (rate_limit_event, etc.)
    } catch {
      if (line) {
        this.emitOutput(sessionId, line, false);
      }
    }
  }

  private clearToolBuffers(sessionId: string) {
    for (const key of this.toolInputBuffers.keys()) {
      if (key.startsWith(`${sessionId}:`)) this.toolInputBuffers.delete(key);
    }
    this.lastModel.delete(sessionId);
  }

  terminateSession(sessionId: string) {
    const proc = this.processes.get(sessionId);
    if (proc) {
      proc.child.kill('SIGTERM');
      this.processes.delete(sessionId);
    }
    this.clearToolBuffers(sessionId);
    const db = getDB();

    const row = db.prepare('SELECT project_path, worktree_path FROM sessions WHERE id = ?').get(sessionId) as any;
    if (row?.worktree_path) {
      try {
        removeWorktree(row.project_path, row.worktree_path);
      } catch { /* best effort */ }
    }

    db.prepare('UPDATE sessions SET status = ?, last_active_at = ? WHERE id = ?')
      .run('terminated', new Date().toISOString(), sessionId);
    this.emitStatus(sessionId, 'terminated');
  }

  listSessions(): Session[] {
    const db = getDB();
    const rows = db.prepare('SELECT * FROM sessions ORDER BY last_active_at DESC').all() as any[];
    return rows.map(this.mapSession);
  }

  getSession(sessionId: string): Session | null {
    const db = getDB();
    const row = db.prepare('SELECT * FROM sessions WHERE id = ?').get(sessionId) as any;
    return row ? this.mapSession(row) : null;
  }

  getMessages(sessionId: string): ChatMessage[] {
    const db = getDB();
    const rows = db.prepare(
      'SELECT * FROM messages WHERE session_id = ? ORDER BY timestamp ASC'
    ).all(sessionId) as any[];
    return rows.map((r) => ({
      id: r.id,
      sessionId: r.session_id,
      role: r.role,
      content: r.content,
      timestamp: r.timestamp,
      tokenCount: r.token_count,
      cost: r.cost,
    }));
  }

  isActive(sessionId: string): boolean {
    return this.processes.has(sessionId);
  }

  cleanupAll() {
    for (const [, proc] of this.processes) {
      proc.child.kill('SIGTERM');
    }
    this.processes.clear();
  }

  private mapSession(row: any): Session {
    return {
      id: row.id,
      name: row.name || row.id.slice(0, 8),
      projectPath: row.project_path,
      branch: row.branch || undefined,
      worktreePath: row.worktree_path || undefined,
      agentId: row.agent_id || undefined,
      skipPermissions: !!row.skip_permissions,
      status: row.status,
      createdAt: row.created_at,
      lastActiveAt: row.last_active_at,
    };
  }
}

export const sessionManager = new SessionManager();
