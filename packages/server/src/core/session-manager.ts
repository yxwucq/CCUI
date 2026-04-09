import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { v4 as uuid } from 'uuid';
import { getDB } from '../db/database.js';
import { createIsolatedWorktree, removeWorktree, removeWorkBranch, getWorktreeStatus, mergeWorktree, getCurrentBranch, attachToBranch, resolveWorktreeBase } from './worktree-manager.js';
import { loadProjectConfig } from '../routes/project-config.js';
import { BranchWatcher } from './branch-watcher.js';
import type { Session, ChatMessage, SessionActivity, FileActivity, CliProviderType } from '@ccui/shared';

type StatusListener = (sessionId: string, status: Session['status'], lastActiveAt: string) => void;
type ActivityListener = (sessionId: string, activity: SessionActivity) => void;
type FileActivityListener = (sessionId: string, activity: FileActivity) => void;


class SessionManager {
  private statusListeners: StatusListener[] = [];
  private activityListeners: ActivityListener[] = [];
  private fileActivityListeners: FileActivityListener[] = [];
  private sessionActivity = new Map<string, { activity: SessionActivity; timer: ReturnType<typeof setTimeout> | null }>();

  readonly branchWatcher = new BranchWatcher();

  onStatus(listener: StatusListener) { this.statusListeners.push(listener); }
  onActivity(listener: ActivityListener) { this.activityListeners.push(listener); }
  onBranch(listener: Parameters<BranchWatcher['onBranch']>[0]) { this.branchWatcher.onBranch(listener); }
  onFileActivity(listener: FileActivityListener) { this.fileActivityListeners.push(listener); }
  startBranchPolling() { this.branchWatcher.start(); }

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
   * Initialize or update head sessions for the project.
   * Called at server startup — creates one per CLI provider if missing, updates branch if existing.
   */
  initHeadSession(projectPath: string): Session {
    const db = getDB();
    const currentBranch = getCurrentBranch(projectPath);

    // Find all existing head sessions
    const existingHeads = db.prepare("SELECT * FROM sessions WHERE session_type = 'head' AND project_path = ?").all(projectPath) as any[];

    // Update all existing heads with current branch
    for (const existing of existingHeads) {
      db.prepare('UPDATE sessions SET branch = ?, status = ?, last_active_at = ? WHERE id = ?')
        .run(currentBranch, 'idle', new Date().toISOString(), existing.id);
      console.log(`Head session updated: ${existing.id} (${existing.cli_provider || 'claude'})`);
    }

    // Ensure a Claude head session exists (default)
    const claudeHead = existingHeads.find((h: any) => (h.cli_provider || 'claude') === 'claude');
    if (!claudeHead) {
      const id = uuid();
      const now = new Date().toISOString();
      db.prepare(
        'INSERT INTO sessions (id, name, project_path, branch, target_branch, worktree_path, agent_id, skip_permissions, session_type, worktree_owned, cli_provider, status, claude_session_id, created_at, last_active_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
      ).run(id, 'HEAD', projectPath, currentBranch, null, null, null, 0, 'head', 0, 'claude', 'idle', null, now, now);
      console.log(`Head session created: ${id} (claude)`);
    }

    // Return the first head session (Claude)
    const primary = claudeHead || db.prepare("SELECT * FROM sessions WHERE session_type = 'head' AND project_path = ? ORDER BY created_at ASC LIMIT 1").get(projectPath) as any;
    return this.mapSession({ ...primary, branch: currentBranch, status: 'idle' });
  }

  /**
   * Create a head session for a specific CLI provider.
   * Returns existing one if already exists for that provider.
   */
  createHeadSession(projectPath: string, cliProvider: CliProviderType): Session {
    const db = getDB();
    const currentBranch = getCurrentBranch(projectPath);

    // Check if head session for this provider already exists
    const existing = db.prepare("SELECT * FROM sessions WHERE session_type = 'head' AND project_path = ? AND cli_provider = ?")
      .get(projectPath, cliProvider) as any;
    if (existing) {
      return this.mapSession(existing);
    }

    const id = uuid();
    const now = new Date().toISOString();
    const name = cliProvider === 'codex' ? 'HEAD (Codex)' : 'HEAD';
    db.prepare(
      'INSERT INTO sessions (id, name, project_path, branch, target_branch, worktree_path, agent_id, skip_permissions, session_type, worktree_owned, cli_provider, status, claude_session_id, created_at, last_active_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(id, name, projectPath, currentBranch, null, null, null, 0, 'head', 0, cliProvider, 'idle', null, now, now);
    console.log(`Head session created: ${id} (${cliProvider})`);

    const row = db.prepare('SELECT * FROM sessions WHERE id = ?').get(id) as any;
    return this.mapSession(row);
  }

  createSession(projectPath: string, opts?: { agentId?: string; branch?: string; name?: string; skipPermissions?: boolean; sessionType?: 'fork' | 'attach'; cliProvider?: CliProviderType }): Session {
    const id = uuid();
    const now = new Date().toISOString();
    const { agentId, branch, name, skipPermissions, sessionType = 'fork', cliProvider } = opts || {};
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
      cliProvider: cliProvider || 'claude',
      status: 'idle', createdAt: now, lastActiveAt: now,
    };

    const db = getDB();
    db.prepare(
      'INSERT INTO sessions (id, name, project_path, branch, target_branch, worktree_path, agent_id, skip_permissions, session_type, worktree_owned, cli_provider, status, claude_session_id, created_at, last_active_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(id, sessionName, projectPath, workBranch, targetBranch, worktreePath || null, agentId || null, skipPermissions ? 1 : 0, effectiveSessionType, worktreeOwned ? 1 : 0, cliProvider || 'claude', 'idle', null, now, now);
    return session;
  }

  resumeSession(sessionId: string): Session {
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

  /**
   * Stop: set session idle. Terminal process is killed separately by terminalManager.
   */
  stopSession(sessionId: string) {
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

  cleanupAll() {
    // No-op: terminal processes are managed by terminalManager
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
      cliProvider: row.cli_provider || 'claude',
      hidden: !!row.hidden,
      cleanupStatus: row.cleanup_status || undefined,
      createdAt: row.created_at, lastActiveAt: row.last_active_at,
    };
  }
}

export const sessionManager = new SessionManager();
