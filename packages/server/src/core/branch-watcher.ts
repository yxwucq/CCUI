import { getDB } from '../db/database.js';
import { getCurrentBranch } from './worktree-manager.js';

type BranchListener = (sessionId: string, branch: string) => void;

export class BranchWatcher {
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private knownBranches = new Map<string, string>(); // sessionId → last known branch
  private listeners: BranchListener[] = [];

  onBranch(listener: BranchListener) {
    this.listeners.push(listener);
  }

  /** Start polling git branches for active sessions every 5s */
  start() {
    if (this.pollTimer) return;
    this.pollTimer = setInterval(() => this.poll(), 5000);
  }

  stop() {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  private poll() {
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
          db.prepare('UPDATE sessions SET branch = ? WHERE id = ?').run(actual, row.id);
          for (const l of this.listeners) l(row.id, actual);
        }
      } catch { /* git command failed, skip */ }
    }
  }
}
