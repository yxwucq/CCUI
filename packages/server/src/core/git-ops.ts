import { execSync } from 'child_process';
import { readFileSync } from 'fs';
import { join } from 'path';

export interface GitStatusResult {
  staged: { file: string; status: string }[];
  unstaged: { file: string; status: string }[];
  untracked: string[];
}

/** Parse `git status --porcelain` into grouped status */
export function getGitStatus(cwd: string): GitStatusResult {
  const raw = execSync('git status --porcelain', { cwd, encoding: 'utf-8' });
  const staged: { file: string; status: string }[] = [];
  const unstaged: { file: string; status: string }[] = [];
  const untracked: string[] = [];

  for (const line of raw.split('\n').filter(Boolean)) {
    const x = line[0]; // index (staging area)
    const y = line[1]; // working tree
    const file = line.substring(3);

    if (x === '?' && y === '?') { untracked.push(file); continue; }

    if (x === 'M') staged.push({ file, status: 'modified' });
    else if (x === 'A') staged.push({ file, status: 'added' });
    else if (x === 'D') staged.push({ file, status: 'deleted' });
    else if (x === 'R') staged.push({ file, status: 'renamed' });

    if (y === 'M') unstaged.push({ file, status: 'modified' });
    else if (y === 'D') unstaged.push({ file, status: 'deleted' });
  }

  return { staged, unstaged, untracked };
}

export interface DiffStatResult {
  files: { file: string; added: number; deleted: number }[];
  totalAdded: number;
  totalDeleted: number;
  totalFiles: number;
}

/** Get line-count diff stats including untracked files */
export function getDiffStat(cwd: string): DiffStatResult {
  let raw = '';
  try { raw = execSync('git diff HEAD --numstat', { cwd, encoding: 'utf-8' }); } catch {
    try { raw = execSync('git diff --numstat', { cwd, encoding: 'utf-8' }); } catch { /* */ }
  }

  let totalAdded = 0, totalDeleted = 0;
  const files: { file: string; added: number; deleted: number }[] = [];

  for (const line of raw.split('\n').filter(Boolean)) {
    const parts = line.split('\t');
    if (parts.length < 3) continue;
    const added = parseInt(parts[0]) || 0;
    const deleted = parseInt(parts[1]) || 0;
    const file = parts.slice(2).join('\t');
    files.push({ file, added, deleted });
    totalAdded += added;
    totalDeleted += deleted;
  }

  // Untracked files — count their lines as additions
  try {
    const untrackedRaw = execSync('git ls-files --others --exclude-standard', { cwd, encoding: 'utf-8' });
    for (const file of untrackedRaw.split('\n').filter(Boolean)) {
      try {
        const content = readFileSync(join(cwd, file), 'utf-8');
        const lines = content.split('\n').length;
        files.push({ file, added: lines, deleted: 0 });
        totalAdded += lines;
      } catch { /* binary */ }
    }
  } catch { /* */ }

  return { files, totalAdded, totalDeleted, totalFiles: files.length };
}

/** Get unified diff, with fallback for untracked files */
export function getDiff(cwd: string, filePath?: string): string {
  if (filePath) {
    let diff = '';
    try { diff = execSync(`git diff HEAD -- "${filePath}"`, { cwd, encoding: 'utf-8' }); } catch {
      try { diff = execSync(`git diff -- "${filePath}"`, { cwd, encoding: 'utf-8' }); } catch { /* */ }
    }
    // Untracked file — show content as new file diff
    if (!diff.trim()) {
      try {
        const content = readFileSync(join(cwd, filePath), 'utf-8');
        const lines = content.split('\n');
        diff = `diff --git a/${filePath} b/${filePath}\nnew file\n--- /dev/null\n+++ b/${filePath}\n@@ -0,0 +1,${lines.length} @@\n` +
          lines.map((l) => `+${l}`).join('\n');
      } catch { /* binary or missing */ }
    }
    return diff;
  }

  let diff = '';
  try { diff = execSync('git diff HEAD', { cwd, encoding: 'utf-8' }); } catch { /* */ }
  if (!diff.trim()) {
    try { diff = execSync('git diff', { cwd, encoding: 'utf-8' }); } catch { /* */ }
  }
  return diff;
}

export interface GitCommit {
  hash: string;
  short: string;
  message: string;
  author: string;
  date: string;
  refs: string[];
  parents: string[];
}

/** Parse git log into structured commits */
export function getGitLog(cwd: string, limit: number): GitCommit[] {
  const raw = execSync(
    `git log --all --pretty=format:%H%x1f%h%x1f%s%x1f%an%x1f%ci%x1f%D%x1f%P -n ${limit}`,
    { cwd, encoding: 'utf-8' }
  );
  return raw.split('\n').filter(Boolean).map((line) => {
    const [hash, short, message, author, date, refsStr, parentsStr] = line.split('\x1f');
    return {
      hash: hash || '', short: short || '',
      message: message || '', author: author || '', date: date || '',
      refs: refsStr ? refsStr.split(', ').filter(Boolean) : [],
      parents: parentsStr ? parentsStr.trim().split(' ').filter(Boolean) : [],
    };
  });
}
