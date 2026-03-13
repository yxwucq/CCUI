import { spawn, ChildProcess } from 'child_process';
import { v4 as uuid } from 'uuid';
import { getDB } from '../db/database.js';
import { createWorktree, removeWorktree, getCurrentBranch } from './worktree-manager.js';
import { BranchWatcher } from './branch-watcher.js';
import { StreamParser } from './stream-parser.js';
import type { Session, ChatMessage, SessionActivity, FileActivity } from '@ccui/shared';

interface SessionProcess { child: ChildProcess; session: Session }

type OutputListener = (sessionId: string, content: string, done: boolean) => void;
type ErrorListener = (sessionId: string, error: string) => void;
type StatusListener = (sessionId: string, status: Session['status'], lastActiveAt: string) => void;
type ActivityListener = (sessionId: string, activity: SessionActivity) => void;
type FileActivityListener = (sessionId: string, activity: FileActivity) => void;

function buildMemoryPrompt(worktreePath: string): string {
  return `You have a persistent memory system at \`${worktreePath}/.claude/memory/\`. Use it to save important context about this session's work so it persists across conversations.

Save memories as markdown files with frontmatter:
\`\`\`
---
name: <name>
type: <user|project|feedback|reference>
---
<content>
\`\`\`

Keep an index in \`MEMORY.md\` (one line per memory file with description). At the start of each conversation, check for relevant memories and load them. Save discoveries about the codebase, decisions made, progress, and any context that would help resume work later.`;
}

class SessionManager {
  private processes = new Map<string, SessionProcess>();
  private outputListeners: OutputListener[] = [];
  private errorListeners: ErrorListener[] = [];
  private statusListeners: StatusListener[] = [];
  private activityListeners: ActivityListener[] = [];
  private fileActivityListeners: FileActivityListener[] = [];
  private sessionActivity = new Map<string, { activity: SessionActivity; timer: ReturnType<typeof setTimeout> | null }>();

  readonly branchWatcher = new BranchWatcher();
  private streamParser: StreamParser;

  constructor() {
    this.streamParser = new StreamParser({
      emitOutput: (id, c, d) => this.emitOutput(id, c, d),
      emitError: (id, e) => this.emitError(id, e),
      emitActivity: (id, a, i) => this.emitActivity(id, a, i),
      emitFileActivity: (id, a) => this.emitFileActivity(id, a),
      getActivityTool: (id) => (this.sessionActivity.get(id)?.activity as any)?.tool,
    });
  }

  onOutput(listener: OutputListener) { this.outputListeners.push(listener); }
  onError(listener: ErrorListener) { this.errorListeners.push(listener); }
  onStatus(listener: StatusListener) { this.statusListeners.push(listener); }
  onActivity(listener: ActivityListener) { this.activityListeners.push(listener); }
  onBranch(listener: Parameters<BranchWatcher['onBranch']>[0]) { this.branchWatcher.onBranch(listener); }
  onFileActivity(listener: FileActivityListener) { this.fileActivityListeners.push(listener); }
  startBranchPolling() { this.branchWatcher.start(); }

  private emitOutput(sessionId: string, content: string, done: boolean) {
    for (const l of this.outputListeners) l(sessionId, content, done);
  }
  private emitError(sessionId: string, error: string) {
    for (const l of this.errorListeners) l(sessionId, error);
  }
  private emitStatus(sessionId: string, status: Session['status'], lastActiveAt: string) {
    for (const l of this.statusListeners) l(sessionId, status, lastActiveAt);
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
    const timer = setTimeout(() => {
      for (const l of this.activityListeners) l(sessionId, activity);
    }, 150);
    this.sessionActivity.set(sessionId, { activity, timer });
  }

  createSession(projectPath: string, opts?: { agentId?: string; branch?: string; name?: string; skipPermissions?: boolean }): Session {
    const id = uuid();
    const now = new Date().toISOString();
    const { agentId, branch, name, skipPermissions } = opts || {};
    let worktreePath: string | undefined;
    const currentBranch = getCurrentBranch(projectPath);
    if (branch && branch !== currentBranch) worktreePath = createWorktree(projectPath, id, branch);

    const sessionName = name || branch || `session-${id.slice(0, 8)}`;
    const session: Session = {
      id, name: sessionName, projectPath,
      branch: branch || currentBranch, worktreePath, agentId,
      skipPermissions: skipPermissions || false,
      status: 'idle', createdAt: now, lastActiveAt: now,
    };

    const db = getDB();
    db.prepare(
      'INSERT INTO sessions (id, name, project_path, branch, worktree_path, agent_id, skip_permissions, status, claude_session_id, created_at, last_active_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(id, sessionName, projectPath, session.branch || null, worktreePath || null, agentId || null, skipPermissions ? 1 : 0, 'idle', null, now, now);
    return session;
  }

  resumeSession(sessionId: string): Session {
    if (this.processes.has(sessionId)) return this.processes.get(sessionId)!.session;
    const db = getDB();
    const row = db.prepare('SELECT * FROM sessions WHERE id = ?').get(sessionId) as any;
    if (!row) throw new Error('Session not found');
    const session = this.mapSession(row);
    session.status = 'idle';
    const now = new Date().toISOString();
    db.prepare('UPDATE sessions SET status = ?, last_active_at = ? WHERE id = ?').run('idle', now, sessionId);
    this.emitStatus(sessionId, 'idle', now);
    return session;
  }

  sendMessage(sessionId: string, content: string) {
    if (this.processes.has(sessionId)) {
      this.emitError(sessionId, 'Claude is still processing the previous message. Please wait.');
      return;
    }
    const db = getDB();
    const row = db.prepare('SELECT * FROM sessions WHERE id = ?').get(sessionId) as any;
    if (!row) throw new Error('Session not found');

    db.prepare('INSERT INTO messages (id, session_id, role, content, timestamp) VALUES (?, ?, ?, ?, ?)')
      .run(uuid(), sessionId, 'user', content, new Date().toISOString());

    const activeNow = new Date().toISOString();
    db.prepare('UPDATE sessions SET last_active_at = ?, status = ? WHERE id = ?').run(activeNow, 'active', sessionId);
    this.emitStatus(sessionId, 'active', activeNow);

    const cwd = row.worktree_path || row.project_path;
    const args = ['-p', content, '--output-format', 'stream-json', '--verbose'];
    if (row.skip_permissions) args.push('--dangerously-skip-permissions');
    if (row.claude_session_id) args.push('--resume', row.claude_session_id);

    if (row.agent_id) {
      const agent = db.prepare('SELECT * FROM agents WHERE id = ?').get(row.agent_id) as any;
      if (agent) {
        args.push('--system-prompt', agent.system_prompt);
        if (agent.max_turns) args.push('--max-turns', String(agent.max_turns));
      }
    }
    if (row.worktree_path) {
      const memoryPrompt = buildMemoryPrompt(row.worktree_path);
      const spIdx = args.indexOf('--system-prompt');
      if (spIdx !== -1) args[spIdx + 1] += `\n\n${memoryPrompt}`;
      else args.push('--system-prompt', memoryPrompt);
    }
    this.spawnClaude(sessionId, this.mapSession(row), args, cwd);
  }

  private spawnClaude(sessionId: string, session: Session, args: string[], cwd: string) {
    const env = { ...process.env };
    delete env.CLAUDECODE;
    console.log(`[claude:${sessionId.slice(0, 8)}] spawning in ${cwd}`);

    const child = spawn('claude', args, { cwd, stdio: ['ignore', 'pipe', 'pipe'], env, detached: true });
    let buffer = '';

    child.stdout?.on('data', (data: Buffer) => {
      buffer += data.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const line of lines) {
        if (line.trim()) this.streamParser.handleLine(sessionId, line.trim());
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
      this.streamParser.clearSession(sessionId);
      if (buffer.trim()) { this.streamParser.handleLine(sessionId, buffer.trim()); buffer = ''; }
      const db = getDB();
      const idleNow = new Date().toISOString();
      db.prepare('UPDATE sessions SET status = ?, last_active_at = ? WHERE id = ?').run('idle', idleNow, sessionId);
      this.emitStatus(sessionId, 'idle', idleNow);
      this.emitActivity(sessionId, { state: 'idle' }, true);
    });

    this.processes.set(sessionId, { child, session });
  }

  terminateSession(sessionId: string) {
    const proc = this.processes.get(sessionId);
    if (proc) { proc.child.kill('SIGTERM'); this.processes.delete(sessionId); }
    this.streamParser.clearSession(sessionId);
    const db = getDB();
    const row = db.prepare('SELECT project_path, worktree_path FROM sessions WHERE id = ?').get(sessionId) as any;
    if (row?.worktree_path) {
      try { removeWorktree(row.project_path, row.worktree_path); } catch { /* best effort */ }
    }
    const termNow = new Date().toISOString();
    db.prepare('UPDATE sessions SET status = ?, last_active_at = ? WHERE id = ?').run('terminated', termNow, sessionId);
    this.emitStatus(sessionId, 'terminated', termNow);
  }

  listSessions(): Session[] {
    const db = getDB();
    return (db.prepare('SELECT * FROM sessions ORDER BY last_active_at DESC').all() as any[]).map(this.mapSession);
  }

  getSession(sessionId: string): Session | null {
    const db = getDB();
    const row = db.prepare('SELECT * FROM sessions WHERE id = ?').get(sessionId) as any;
    return row ? this.mapSession(row) : null;
  }

  getMessages(sessionId: string): ChatMessage[] {
    const db = getDB();
    return (db.prepare('SELECT * FROM messages WHERE session_id = ? ORDER BY timestamp ASC').all(sessionId) as any[]).map((r) => ({
      id: r.id, sessionId: r.session_id, role: r.role,
      content: r.content, timestamp: r.timestamp,
      tokenCount: r.token_count, cost: r.cost,
    }));
  }

  isActive(sessionId: string): boolean { return this.processes.has(sessionId); }

  cleanupAll() {
    for (const [, proc] of this.processes) proc.child.kill('SIGTERM');
    this.processes.clear();
  }

  private mapSession(row: any): Session {
    return {
      id: row.id, name: row.name || row.id.slice(0, 8),
      projectPath: row.project_path, branch: row.branch || undefined,
      worktreePath: row.worktree_path || undefined, agentId: row.agent_id || undefined,
      skipPermissions: !!row.skip_permissions, status: row.status,
      createdAt: row.created_at, lastActiveAt: row.last_active_at,
    };
  }
}

export const sessionManager = new SessionManager();
