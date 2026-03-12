import { execSync } from 'child_process';
import { readdirSync, readFileSync, statSync, existsSync } from 'fs';
import { join, basename } from 'path';
import type { ProjectInfo, GitFileStatus } from '@ccui/shared';

const IGNORE_DIRS = new Set([
  'node_modules', '.git', 'dist', '.ccui', '.next', '.nuxt',
  '__pycache__', '.venv', 'venv', 'target', 'build',
]);

export function scanProject(projectPath: string): ProjectInfo {
  const name = basename(projectPath);
  let gitBranch: string | undefined;
  let gitStatus: GitFileStatus[] | undefined;

  try {
    gitBranch = execSync('git branch --show-current', { cwd: projectPath, encoding: 'utf-8' }).trim();
  } catch { /* not a git repo */ }

  try {
    const raw = execSync('git status --porcelain', { cwd: projectPath, encoding: 'utf-8' });
    gitStatus = raw
      .split('\n')
      .filter(Boolean)
      .map((line) => {
        const code = line.substring(0, 2).trim();
        const file = line.substring(3);
        let status: GitFileStatus['status'] = 'modified';
        if (code === '??' || code === 'A') status = code === '??' ? 'untracked' : 'added';
        else if (code === 'D') status = 'deleted';
        return { file, status };
      });
  } catch { /* not a git repo */ }

  let claudeMd: string | undefined;
  const claudeMdPath = join(projectPath, 'CLAUDE.md');
  if (existsSync(claudeMdPath)) {
    claudeMd = readFileSync(claudeMdPath, 'utf-8');
  }

  const fileCount = countFiles(projectPath, 0, 3);
  let lastModified = new Date().toISOString();
  try {
    lastModified = statSync(projectPath).mtime.toISOString();
  } catch { /* ignore */ }

  return { path: projectPath, name, gitBranch, gitStatus, claudeMd, fileCount, lastModified };
}

function countFiles(dir: string, depth: number, maxDepth: number): number {
  if (depth > maxDepth) return 0;
  let count = 0;
  try {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (IGNORE_DIRS.has(entry.name)) continue;
      if (entry.isFile()) count++;
      else if (entry.isDirectory()) count += countFiles(join(dir, entry.name), depth + 1, maxDepth);
    }
  } catch { /* permission error */ }
  return count;
}

export function getFileTree(rootPath: string, depth = 3) {
  return buildTree(rootPath, 0, depth);
}

interface TreeNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: TreeNode[];
}

function buildTree(dir: string, depth: number, maxDepth: number): TreeNode[] {
  if (depth >= maxDepth) return [];
  const nodes: TreeNode[] = [];
  try {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (IGNORE_DIRS.has(entry.name) || entry.name.startsWith('.')) continue;
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        nodes.push({
          name: entry.name,
          path: fullPath,
          type: 'directory',
          children: buildTree(fullPath, depth + 1, maxDepth),
        });
      } else {
        nodes.push({ name: entry.name, path: fullPath, type: 'file' });
      }
    }
  } catch { /* permission error */ }
  return nodes.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}
