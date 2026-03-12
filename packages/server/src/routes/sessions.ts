import { Router } from 'express';
import { sessionManager } from '../core/session-manager.js';

const router = Router();

router.get('/', (_req, res) => {
  const sessions = sessionManager.listSessions();
  res.json(sessions);
});

router.post('/', (req, res) => {
  const { projectPath, agentId, branch, name } = req.body;
  if (!projectPath) return res.status(400).json({ error: 'projectPath required' });
  try {
    const session = sessionManager.createSession(projectPath, { agentId, branch, name });
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

router.delete('/:id', (req, res) => {
  sessionManager.terminateSession(req.params.id);
  res.json({ ok: true });
});

export default router;
