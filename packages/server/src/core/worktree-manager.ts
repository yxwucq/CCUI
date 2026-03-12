import { execSync } from 'child_process';
import { join } from 'path';
import { mkdirSync, existsSync, rmSync, appendFileSync } from 'fs';

const WORKTREE_DIR = '.ccui/worktrees';

export interface WorktreeInfo {
  path: string;
  branch: string;
  head: string;
}

export function listBranches(projectPath: string): string[] {
  try {
    const raw = execSync('git branch -a --format="%(refname:short)"', {
      cwd: projectPath,
      encoding: 'utf-8',
    });
    return raw.split('\n').filter(Boolean);
  } catch {
    return [];
  }
}

export function getCurrentBranch(projectPath: string): string {
  try {
    return execSync('git branch --show-current', {
      cwd: projectPath,
      encoding: 'utf-8',
    }).trim();
  } catch {
    return 'main';
  }
}

export function listWorktrees(projectPath: string): WorktreeInfo[] {
  try {
    const raw = execSync('git worktree list --porcelain', {
      cwd: projectPath,
      encoding: 'utf-8',
    });
    const worktrees: WorktreeInfo[] = [];
    let current: Partial<WorktreeInfo> = {};
    for (const line of raw.split('\n')) {
      if (line.startsWith('worktree ')) {
        if (current.path) worktrees.push(current as WorktreeInfo);
        current = { path: line.slice(9) };
      } else if (line.startsWith('HEAD ')) {
        current.head = line.slice(5);
      } else if (line.startsWith('branch ')) {
        current.branch = line.slice(7).replace('refs/heads/', '');
      }
    }
    if (current.path) worktrees.push(current as WorktreeInfo);
    return worktrees;
  } catch {
    return [];
  }
}

export function createWorktree(
  projectPath: string,
  sessionId: string,
  branch: string,
): string {
  const worktreeBase = join(projectPath, WORKTREE_DIR);
  mkdirSync(worktreeBase, { recursive: true });
  const worktreePath = join(worktreeBase, sessionId);

  // Check if branch exists
  const branches = listBranches(projectPath);
  const branchExists = branches.includes(branch);

  try {
    if (branchExists) {
      execSync(`git worktree add "${worktreePath}" "${branch}"`, {
        cwd: projectPath,
        encoding: 'utf-8',
      });
    } else {
      // Create new branch from current HEAD
      execSync(`git worktree add -b "${branch}" "${worktreePath}"`, {
        cwd: projectPath,
        encoding: 'utf-8',
      });
    }
  } catch (err: any) {
    // If branch is already checked out, try detached + switch
    if (err.message?.includes('already checked out')) {
      execSync(`git worktree add --detach "${worktreePath}"`, {
        cwd: projectPath,
        encoding: 'utf-8',
      });
      execSync(`git checkout "${branch}"`, {
        cwd: worktreePath,
        encoding: 'utf-8',
      });
    } else {
      throw err;
    }
  }

  // Create .claude/memory/ directory for per-session memory
  const memoryDir = join(worktreePath, '.claude', 'memory');
  mkdirSync(memoryDir, { recursive: true });

  // Exclude memory dir from git via worktree-local exclude (never committed)
  const infoDir = join(projectPath, '.git', 'worktrees', sessionId, 'info');
  try {
    mkdirSync(infoDir, { recursive: true });
    appendFileSync(join(infoDir, 'exclude'), '\n.claude/memory/\n');
  } catch { /* best effort */ }

  return worktreePath;
}

export function removeWorktree(projectPath: string, worktreePath: string): void {
  try {
    execSync(`git worktree remove "${worktreePath}" --force`, {
      cwd: projectPath,
      encoding: 'utf-8',
    });
  } catch {
    // Fallback: just delete the directory and prune
    if (existsSync(worktreePath)) {
      rmSync(worktreePath, { recursive: true, force: true });
    }
    try {
      execSync('git worktree prune', { cwd: projectPath, encoding: 'utf-8' });
    } catch { /* ignore */ }
  }
}
