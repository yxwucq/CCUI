import { Router, type Router as IRouter } from 'express';
import { execSync } from 'child_process';
import { readFileSync } from 'fs';
import { join } from 'path';
import { sessionManager } from '../core/session-manager.js';
import { getDB } from '../db/database.js';
import { getFileTree } from '../core/project-scanner.js';
import { readFile, writeFile } from '../core/file-manager.js';

const router: IRouter = Router();

router.get('/', (_req, res) => {
  const sessions = sessionManager.listSessions();
  res.json(sessions);
});

router.post('/', (req, res) => {
  const { projectPath, agentId, branch, name, skipPermissions } = req.body;
  if (!projectPath) return res.status(400).json({ error: 'projectPath required' });
  try {
    const session = sessionManager.createSession(projectPath, { agentId, branch, name, skipPermissions });
    res.status(201).json(session);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', (req, res) => {
  const session = sessionManager.getSession(req.params.id);
  if (!session) return res.status(404).json({ error: 'Session not found' });
  res.json(session);
});

router.get('/:id/messages', (req, res) => {
  const messages = sessionManager.getMessages(req.params.id);
  res.json(messages);
});

router.post('/:id/resume', (req, res) => {
  try {
    const session = sessionManager.resumeSession(req.params.id);
    res.json(session);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id/notes', (req, res) => {
  const db = getDB();
  const row = db.prepare('SELECT notes FROM sessions WHERE id = ?').get(req.params.id) as any;
  if (!row) return res.status(404).json({ error: 'Session not found' });
  res.json({ notes: row.notes ?? '' });
});

router.put('/:id/notes', (req, res) => {
  const { notes } = req.body;
  if (typeof notes !== 'string') return res.status(400).json({ error: 'notes must be a string' });
  const db = getDB();
  const result = db.prepare('UPDATE sessions SET notes = ? WHERE id = ?').run(notes, req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Session not found' });
  res.json({ ok: true });
});

router.delete('/:id', (req, res) => {
  sessionManager.terminateSession(req.params.id);
  res.json({ ok: true });
});

// Per-session git status (worktree-aware) — grouped by staged/unstaged/untracked
router.get('/:id/git/status', (req, res) => {
  const session = sessionManager.getSession(req.params.id);
  if (!session) return res.status(404).json({ error: 'Session not found' });
  const cwd = session.worktreePath || session.projectPath;
  try {
    const raw = execSync('git status --porcelain', { cwd, encoding: 'utf-8' });
    const staged: { file: string; status: string }[] = [];
    const unstaged: { file: string; status: string }[] = [];
    const untracked: string[] = [];

    for (const line of raw.split('\n').filter(Boolean)) {
      const x = line[0]; // index (staging area)
      const y = line[1]; // working tree
      const file = line.substring(3);

      if (x === '?' && y === '?') { untracked.push(file); continue; }

      // Staging area
      if (x === 'M') staged.push({ file, status: 'modified' });
      else if (x === 'A') staged.push({ file, status: 'added' });
      else if (x === 'D') staged.push({ file, status: 'deleted' });
      else if (x === 'R') staged.push({ file, status: 'renamed' });

      // Working tree
      if (y === 'M') unstaged.push({ file, status: 'modified' });
      else if (y === 'D') unstaged.push({ file, status: 'deleted' });
    }

    res.json({ staged, unstaged, untracked });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Per-session diff stat — line counts (for compact summary)
router.get('/:id/git/diff-stat', (req, res) => {
  const session = sessionManager.getSession(req.params.id);
  if (!session) return res.status(404).json({ error: 'Session not found' });
  const cwd = session.worktreePath || session.projectPath;
  try {
    // Tracked changes
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

    res.json({ files, totalAdded, totalDeleted, totalFiles: files.length });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Per-session git diff (worktree-aware)
router.get('/:id/git/diff', (req, res) => {
  const session = sessionManager.getSession(req.params.id);
  if (!session) return res.status(404).json({ error: 'Session not found' });
  const cwd = session.worktreePath || session.projectPath;
  const filePath = req.query.path as string | undefined;
  try {
    if (filePath) {
      // Try tracked diff first
      let diff = '';
      try {
        diff = execSync(`git diff HEAD -- "${filePath}"`, { cwd, encoding: 'utf-8' });
      } catch {
        try { diff = execSync(`git diff -- "${filePath}"`, { cwd, encoding: 'utf-8' }); } catch { /* */ }
      }
      // If empty, file might be untracked — show content as new file diff
      if (!diff.trim()) {
        try {
          const content = readFileSync(join(cwd, filePath), 'utf-8');
          const lines = content.split('\n');
          diff = `diff --git a/${filePath} b/${filePath}\nnew file\n--- /dev/null\n+++ b/${filePath}\n@@ -0,0 +1,${lines.length} @@\n` +
            lines.map((l) => `+${l}`).join('\n');
        } catch { /* binary or missing */ }
      }
      res.json({ diff });
    } else {
      let diff = '';
      try { diff = execSync('git diff HEAD', { cwd, encoding: 'utf-8' }); } catch { /* */ }
      if (!diff.trim()) {
        try { diff = execSync('git diff', { cwd, encoding: 'utf-8' }); } catch { /* */ }
      }
      res.json({ diff });
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Per-session file tree (worktree-aware)
router.get('/:id/files/tree', (req, res) => {
  const session = sessionManager.getSession(req.params.id);
  if (!session) return res.status(404).json({ error: 'Session not found' });
  const cwd = session.worktreePath || session.projectPath;
  const depth = parseInt(req.query.depth as string) || 3;
  const tree = getFileTree(cwd, depth);
  res.json(tree);
});

// Per-session file read (worktree-aware, relative paths)
router.get('/:id/files', (req, res) => {
  const session = sessionManager.getSession(req.params.id);
  if (!session) return res.status(404).json({ error: 'Session not found' });
  const cwd = session.worktreePath || session.projectPath;
  const relPath = req.query.path as string;
  if (!relPath) return res.status(400).json({ error: 'path required' });
  // Prevent path traversal
  if (relPath.includes('..')) return res.status(400).json({ error: 'invalid path' });
  try {
    const result = readFile(join(cwd, relPath));
    res.json(result);
  } catch (err: any) {
    res.status(404).json({ error: err.message });
  }
});

// Per-session file write (worktree-aware, relative paths)
router.put('/:id/files', (req, res) => {
  const session = sessionManager.getSession(req.params.id);
  if (!session) return res.status(404).json({ error: 'Session not found' });
  const cwd = session.worktreePath || session.projectPath;
  const relPath = req.query.path as string;
  const { content } = req.body;
  if (!relPath) return res.status(400).json({ error: 'path required' });
  if (relPath.includes('..')) return res.status(400).json({ error: 'invalid path' });
  try {
    writeFile(join(cwd, relPath), content);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
