import { execSync } from 'child_process';
import { join } from 'path';
import { mkdirSync, existsSync, rmSync, appendFileSync, writeFileSync } from 'fs';

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

/**
 * Create an isolated worktree with a unique work branch.
 * Every session gets its own branch: {targetBranch}--ccui-{shortId}
 */
export function createIsolatedWorktree(
  projectPath: string,
  sessionId: string,
  targetBranch: string,
): { worktreePath: string; workBranch: string } {
  const worktreeBase = join(projectPath, WORKTREE_DIR);
  mkdirSync(worktreeBase, { recursive: true });
  const worktreePath = join(worktreeBase, sessionId);
  const shortId = sessionId.slice(0, 6);
  const workBranch = `${targetBranch}--ccui-${shortId}`;

  // Always create a new branch from targetBranch — no conflicts possible
  execSync(`git worktree add -b "${workBranch}" "${worktreePath}" "${targetBranch}"`, {
    cwd: projectPath,
    encoding: 'utf-8',
  });

  // Create .claude directories for memory and rules
  const claudeDir = join(worktreePath, '.claude');
  mkdirSync(join(claudeDir, 'memory'), { recursive: true });
  mkdirSync(join(claudeDir, 'rules'), { recursive: true });

  // Write session scope rules
  writeFileSync(join(claudeDir, 'rules', 'session-scope.md'), `---
description: Session workspace isolation rules
---

# Workspace

You are working in an isolated git worktree.

- Work branch: ${workBranch}
- Target branch: ${targetBranch}
- Working directory: ${worktreePath}

# Rules

- All file modifications and writes must stay within this working directory
- All git operations (commit, add, reset, etc.) must stay on the current work branch
- Do not switch branches or modify git worktree configuration
- You may read files outside this worktree if needed

# Memory

You have a persistent memory system at \`${worktreePath}/.claude/memory/\`.
Use it to save important context about this session's work so it persists across conversations.

Save memories as markdown files with frontmatter:
\`\`\`
---
name: <name>
type: <user|project|feedback|reference>
---
<content>
\`\`\`

Keep an index in \`MEMORY.md\` (one line per memory file with description).
At the start of each conversation, check for relevant memories and load them.
Save discoveries about the codebase, decisions made, progress, and any context that would help resume work later.
`);

  // Exclude .claude/ from git via worktree-local exclude (never committed)
  const infoDir = join(projectPath, '.git', 'worktrees', sessionId, 'info');
  try {
    mkdirSync(infoDir, { recursive: true });
    appendFileSync(join(infoDir, 'exclude'), '\n.claude/\n');
  } catch { /* best effort */ }

  return { worktreePath, workBranch };
}

/**
 * Check worktree status: uncommitted changes and unmerged commits.
 */
export function getWorktreeStatus(
  worktreePath: string,
  workBranch: string,
  targetBranch: string,
): { hasUncommitted: boolean; unpushedCommits: number } {
  let hasUncommitted = false;
  let unpushedCommits = 0;

  try {
    const status = execSync('git status --porcelain', {
      cwd: worktreePath,
      encoding: 'utf-8',
    }).trim();
    hasUncommitted = status.length > 0;
  } catch { /* treat as no changes */ }

  try {
    const log = execSync(`git log "${targetBranch}..${workBranch}" --oneline`, {
      cwd: worktreePath,
      encoding: 'utf-8',
    }).trim();
    unpushedCommits = log ? log.split('\n').length : 0;
  } catch { /* treat as 0 */ }

  return { hasUncommitted, unpushedCommits };
}

/**
 * Merge work branch into target branch, then clean up.
 */
export function mergeWorktree(
  projectPath: string,
  worktreePath: string,
  workBranch: string,
  targetBranch: string,
): void {
  // Commit any uncommitted changes in worktree first
  try {
    const status = execSync('git status --porcelain', { cwd: worktreePath, encoding: 'utf-8' }).trim();
    if (status) {
      execSync('git add -A', { cwd: worktreePath, encoding: 'utf-8' });
      execSync('git commit -m "Auto-commit before merge"', { cwd: worktreePath, encoding: 'utf-8' });
    }
  } catch { /* best effort */ }

  // Ensure we're on the target branch before merging
  const currentBranch = getCurrentBranch(projectPath);
  if (currentBranch !== targetBranch) {
    execSync(`git checkout "${targetBranch}"`, { cwd: projectPath, encoding: 'utf-8' });
  }

  // Merge work branch into target branch
  execSync(`git merge "${workBranch}" --no-edit`, {
    cwd: projectPath,
    encoding: 'utf-8',
  });

  // Restore original branch if we switched
  if (currentBranch !== targetBranch) {
    execSync(`git checkout "${currentBranch}"`, { cwd: projectPath, encoding: 'utf-8' });
  }

  // Clean up worktree and work branch
  removeWorktree(projectPath, worktreePath);
  removeWorkBranch(projectPath, workBranch);
}

/**
 * Delete a work branch.
 */
export function removeWorkBranch(projectPath: string, branchName: string): void {
  try {
    execSync(`git branch -D "${branchName}"`, {
      cwd: projectPath,
      encoding: 'utf-8',
    });
  } catch { /* branch may already be deleted */ }
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
