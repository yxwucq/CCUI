import { spawn, ChildProcess } from 'child_process';
import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { v4 as uuid } from 'uuid';
import { getDB } from '../db/database.js';
import { createIsolatedWorktree, removeWorktree, removeWorkBranch, getWorktreeStatus, mergeWorktree, getCurrentBranch, attachToBranch, resolveWorktreeBase } from './worktree-manager.js';
import { loadProjectConfig } from '../routes/project-config.js';
import { BranchWatcher } from './branch-watcher.js';
import { StreamParser } from './stream-parser.js';
import type { Session, ChatMessage, SessionActivity, FileActivity } from '@ccui/shared';

interface SessionProcess { child: ChildProcess; session: Session }

type OutputListener = (sessionId: string, content: string, done: boolean) => void;
type ErrorListener = (sessionId: string, error: string) => void;
type StatusListener = (sessionId: string, status: Session['status'], lastActiveAt: string) => void;
type ActivityListener = (sessionId: string, activity: SessionActivity) => void;
type FileActivityListener = (sessionId: string, activity: FileActivity) => void;


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

  /**
   * Initialize or update the head session for the project.
   * Called at server startup — creates one if missing, updates branch if existing.
   */
  initHeadSession(projectPath: string): Session {
    const db = getDB();
    const currentBranch = getCurrentBranch(projectPath);
    const existing = db.prepare("SELECT * FROM sessions WHERE session_type = 'head' AND project_path = ?").get(projectPath) as any;

    if (existing) {
      // Update branch and ensure idle status
      db.prepare('UPDATE sessions SET branch = ?, status = ?, last_active_at = ? WHERE id = ?')
        .run(currentBranch, 'idle', new Date().toISOString(), existing.id);
      console.log(`Head session updated: ${existing.id} (${currentBranch})`);
      return this.mapSession({ ...existing, branch: currentBranch, status: 'idle' });
    }

    // Create new head session
    const id = uuid();
    const now = new Date().toISOString();
    const session: Session = {
      id, name: 'HEAD', projectPath,
      branch: currentBranch,
      sessionType: 'head',
      worktreeOwned: false,
      skipPermissions: false,
      status: 'idle', createdAt: now, lastActiveAt: now,
    };

    db.prepare(
      'INSERT INTO sessions (id, name, project_path, branch, target_branch, worktree_path, agent_id, skip_permissions, session_type, worktree_owned, status, claude_session_id, created_at, last_active_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(id, 'HEAD', projectPath, currentBranch, null, null, null, 0, 'head', 0, 'idle', null, now, now);

    console.log(`Head session created: ${id} (${currentBranch})`);
    return session;
  }

  createSession(projectPath: string, opts?: { agentId?: string; branch?: string; name?: string; skipPermissions?: boolean; sessionType?: 'fork' | 'attach' }): Session {
    const id = uuid();
    const now = new Date().toISOString();
    const { agentId, branch, name, skipPermissions, sessionType = 'fork' } = opts || {};
    const currentBranch = getCurrentBranch(projectPath);
    const targetBranch = branch || currentBranch;
    const config = loadProjectConfig(projectPath);

    let worktreePath: string | undefined;
    let workBranch: string;
    let worktreeOwned = true;
    let effectiveSessionType = sessionType;

    if (effectiveSessionType === 'attach') {
      const result = attachToBranch(projectPath, targetBranch, config);
      worktreePath = result.worktreePath || undefined;
      worktreeOwned = result.worktreeOwned;
      workBranch = targetBranch;

      // Write session scope rules only if we own the worktree
      if (worktreeOwned && worktreePath) {
        const claudeDir = join(worktreePath, '.claude');
        mkdirSync(join(claudeDir, 'memory'), { recursive: true });
        mkdirSync(join(claudeDir, 'rules'), { recursive: true });
        writeFileSync(join(claudeDir, 'rules', 'session-scope.md'), `---
description: Session workspace rules (attached)
---

# Workspace

You are working on an existing branch (attached mode).

- Branch: ${workBranch}
- Working directory: ${worktreePath}

# Rules

- All file modifications and writes must stay within this working directory
- Stay on the current branch
- You may read files outside this worktree if needed
`);
      }
    } else {
      // Fork mode: create isolated worktree with unique work branch
      const base = resolveWorktreeBase(projectPath, config);
      const result = createIsolatedWorktree(projectPath, id, targetBranch, base);
      worktreePath = result.worktreePath;
      workBranch = result.workBranch;
      worktreeOwned = true;
    }

    const sessionName = name || branch || `session-${id.slice(0, 8)}`;
    const session: Session = {
      id, name: sessionName, projectPath,
      branch: workBranch, targetBranch, worktreePath, agentId,
      skipPermissions: skipPermissions || false,
      sessionType: effectiveSessionType,
      worktreeOwned,
      status: 'idle', createdAt: now, lastActiveAt: now,
    };

    const db = getDB();
    db.prepare(
      'INSERT INTO sessions (id, name, project_path, branch, target_branch, worktree_path, agent_id, skip_permissions, session_type, worktree_owned, status, claude_session_id, created_at, last_active_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(id, sessionName, projectPath, workBranch, targetBranch, worktreePath || null, agentId || null, skipPermissions ? 1 : 0, effectiveSessionType, worktreeOwned ? 1 : 0, 'idle', null, now, now);
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

  /**
   * Stop: kill processes but keep worktree and all state. Session goes idle.
   */
  stopSession(sessionId: string) {
    const proc = this.processes.get(sessionId);
    if (proc) { proc.child.kill('SIGTERM'); this.processes.delete(sessionId); }
    this.streamParser.clearSession(sessionId);
    const now = new Date().toISOString();
    const db = getDB();
    db.prepare('UPDATE sessions SET status = ?, last_active_at = ? WHERE id = ?').run('idle', now, sessionId);
    this.emitStatus(sessionId, 'idle', now);
    this.emitActivity(sessionId, { state: 'idle' }, true);
  }

  /**
   * Terminate: stop + handle worktree cleanup.
   * action: 'check' returns status, 'merge' merges then cleans, 'discard' force cleans.
   */
  terminateSession(sessionId: string, action?: 'check' | 'merge' | 'discard') {
    const db = getDB();
    const row = db.prepare('SELECT * FROM sessions WHERE id = ?').get(sessionId) as any;
    if (!row) return { error: 'Session not found' };
    if (row.session_type === 'head') return { error: 'Cannot terminate the head session' };

    // For 'check', just return worktree status without terminating
    if (action === 'check' && row.worktree_path && row.branch && row.target_branch) {
      const status = getWorktreeStatus(row.worktree_path, row.branch, row.target_branch);
      return { ...status, workBranch: row.branch, targetBranch: row.target_branch };
    }

    // Kill processes
    const proc = this.processes.get(sessionId);
    if (proc) { proc.child.kill('SIGTERM'); this.processes.delete(sessionId); }
    this.streamParser.clearSession(sessionId);

    // Handle worktree based on action and session type
    const isAttach = row.session_type === 'attach';

    if (isAttach) {
      // Attach mode: never delete the branch, only remove worktree if we own it
      if (row.worktree_path && row.worktree_owned) {
        try { removeWorktree(row.project_path, row.worktree_path); } catch { /* best effort */ }
      }
      // Always mark as cleaned for attach sessions
    } else if (row.worktree_path) {
      // Fork mode: original behavior
      if (action === 'merge' && row.branch && row.target_branch) {
        try {
          mergeWorktree(row.project_path, row.worktree_path, row.branch, row.target_branch);
        } catch (err: any) {
          // If merge fails, keep worktree as pending
          const termNow = new Date().toISOString();
          db.prepare('UPDATE sessions SET status = ?, cleanup_status = ?, last_active_at = ? WHERE id = ?')
            .run('terminated', 'pending', termNow, sessionId);
          this.emitStatus(sessionId, 'terminated', termNow);
          return { error: `Merge failed: ${err.message}` };
        }
      } else if (action === 'discard') {
        try { removeWorktree(row.project_path, row.worktree_path); } catch { /* best effort */ }
        if (row.branch) {
          try { removeWorkBranch(row.project_path, row.branch); } catch { /* best effort */ }
        }
      } else if (!action) {
        // Default: check if there are changes, set pending if so
        const hasChanges = row.branch && row.target_branch
          ? getWorktreeStatus(row.worktree_path, row.branch, row.target_branch)
          : { hasUncommitted: false, unpushedCommits: 0 };
        if (hasChanges.hasUncommitted || hasChanges.unpushedCommits > 0) {
          const termNow = new Date().toISOString();
          db.prepare('UPDATE sessions SET status = ?, cleanup_status = ?, last_active_at = ? WHERE id = ?')
            .run('terminated', 'pending', termNow, sessionId);
          this.emitStatus(sessionId, 'terminated', termNow);
          return { pending: true, ...hasChanges };
        }
        // No changes, safe to clean up
        try { removeWorktree(row.project_path, row.worktree_path); } catch { /* best effort */ }
        if (row.branch) {
          try { removeWorkBranch(row.project_path, row.branch); } catch { /* best effort */ }
        }
      }
    }

    const termNow = new Date().toISOString();
    const cleanupStatus = (isAttach || action === 'merge' || action === 'discard' || !row.worktree_path) ? 'cleaned' : null;
    db.prepare('UPDATE sessions SET status = ?, cleanup_status = ?, last_active_at = ? WHERE id = ?')
      .run('terminated', cleanupStatus, termNow, sessionId);
    this.emitStatus(sessionId, 'terminated', termNow);
    return { ok: true };
  }

  /**
   * Delete: permanently remove session and all related data from database.
   */
  deleteSession(sessionId: string) {
    const db = getDB();
    const row = db.prepare('SELECT project_path, worktree_path, branch, session_type, worktree_owned FROM sessions WHERE id = ?').get(sessionId) as any;
    if (row?.session_type === 'head') return;

    // Stop any running processes first
    const proc = this.processes.get(sessionId);
    if (proc) { proc.child.kill('SIGTERM'); this.processes.delete(sessionId); }
    this.streamParser.clearSession(sessionId);

    // Clean up worktree if still exists
    if (row?.worktree_path) {
      if (row.session_type === 'attach') {
        // Attach: only remove worktree if we own it, never delete branch
        if (row.worktree_owned) {
          try { removeWorktree(row.project_path, row.worktree_path); } catch { /* best effort */ }
        }
      } else {
        // Fork: remove worktree + branch
        try { removeWorktree(row.project_path, row.worktree_path); } catch { /* best effort */ }
        if (row.branch) {
          try { removeWorkBranch(row.project_path, row.branch); } catch { /* best effort */ }
        }
      }
    }

    // Delete all related records
    db.prepare('DELETE FROM usage_records WHERE session_id = ?').run(sessionId);
    db.prepare('DELETE FROM messages WHERE session_id = ?').run(sessionId);
    db.prepare('DELETE FROM sessions WHERE id = ?').run(sessionId);

    this.emitStatus(sessionId, 'terminated', new Date().toISOString());
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
      targetBranch: row.target_branch || undefined,
      worktreePath: row.worktree_path || undefined, agentId: row.agent_id || undefined,
      skipPermissions: !!row.skip_permissions, status: row.status,
      sessionType: row.session_type || 'fork',
      worktreeOwned: row.worktree_owned !== 0,
      cleanupStatus: row.cleanup_status || undefined,
      createdAt: row.created_at, lastActiveAt: row.last_active_at,
    };
  }
}

export const sessionManager = new SessionManager();
