import { Router, type Router as IRouter } from 'express';
import { join } from 'path';
import { sessionManager } from '../core/session-manager.js';
import { getDB } from '../db/database.js';
import { getFileTree } from '../core/project-scanner.js';
import { readFile, writeFile } from '../core/file-manager.js';
import { getGitStatus, getDiffStat, getDiff } from '../core/git-ops.js';
import { listMemories, saveMemory } from '../core/memory-manager.js';

const router: IRouter = Router();

router.get('/', (_req, res) => {
  res.json(sessionManager.listSessions());
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
  res.json(sessionManager.getMessages(req.params.id));
});

router.post('/:id/resume', (req, res) => {
  try {
    res.json(sessionManager.resumeSession(req.params.id));
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

router.get('/:id/memory', (req, res) => {
  const session = sessionManager.getSession(req.params.id);
  if (!session) return res.status(404).json({ error: 'Session not found' });
  try {
    res.json(listMemories(session.worktreePath || session.projectPath));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id/memory/:filename', (req, res) => {
  const session = sessionManager.getSession(req.params.id);
  if (!session) return res.status(404).json({ error: 'Session not found' });
  const { filename } = req.params;
  if (!filename.endsWith('.md') || filename.includes('/') || filename.includes('..')) {
    return res.status(400).json({ error: 'invalid filename' });
  }
  const { content } = req.body;
  if (typeof content !== 'string') return res.status(400).json({ error: 'content must be a string' });
  try {
    saveMemory(session.worktreePath || session.projectPath, filename, content);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', (req, res) => {
  sessionManager.terminateSession(req.params.id);
  res.json({ ok: true });
});

// --- Git routes (worktree-aware) ---

function getSessionCwd(id: string): string | null {
  const session = sessionManager.getSession(id);
  if (!session) return null;
  return session.worktreePath || session.projectPath;
}

router.get('/:id/git/status', (req, res) => {
  const cwd = getSessionCwd(req.params.id);
  if (!cwd) return res.status(404).json({ error: 'Session not found' });
  try {
    res.json(getGitStatus(cwd));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id/git/diff-stat', (req, res) => {
  const cwd = getSessionCwd(req.params.id);
  if (!cwd) return res.status(404).json({ error: 'Session not found' });
  try {
    res.json(getDiffStat(cwd));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id/git/diff', (req, res) => {
  const cwd = getSessionCwd(req.params.id);
  if (!cwd) return res.status(404).json({ error: 'Session not found' });
  try {
    res.json({ diff: getDiff(cwd, req.query.path as string | undefined) });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// --- File routes (worktree-aware) ---

router.get('/:id/files/tree', (req, res) => {
  const cwd = getSessionCwd(req.params.id);
  if (!cwd) return res.status(404).json({ error: 'Session not found' });
  res.json(getFileTree(cwd, parseInt(req.query.depth as string) || 3));
});

router.get('/:id/files', (req, res) => {
  const cwd = getSessionCwd(req.params.id);
  if (!cwd) return res.status(404).json({ error: 'Session not found' });
  const relPath = req.query.path as string;
  if (!relPath) return res.status(400).json({ error: 'path required' });
  if (relPath.includes('..')) return res.status(400).json({ error: 'invalid path' });
  try {
    res.json(readFile(join(cwd, relPath)));
  } catch (err: any) {
    res.status(404).json({ error: err.message });
  }
});

router.put('/:id/files', (req, res) => {
  const cwd = getSessionCwd(req.params.id);
  if (!cwd) return res.status(404).json({ error: 'Session not found' });
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
