import { Router, type Router as IRouter } from 'express';
import { usageTracker } from '../core/usage-tracker.js';

const router: IRouter = Router();

router.get('/summary', (req, res) => {
  const range = req.query.range as string;
  res.json(usageTracker.getSummary(range));
});

router.get('/daily', (req, res) => {
  const range = req.query.range as string;
  res.json(usageTracker.getDailyUsage(range));
});

router.get('/sessions', (req, res) => {
  const sessionId = req.query.sessionId as string;
  if (sessionId) {
    res.json(usageTracker.getSessionUsage(sessionId));
  } else {
    res.json(usageTracker.getSummary());
  }
});

router.get('/today', (_req, res) => {
  res.json(usageTracker.getTodaySummary());
});

router.get('/session-summary', (req, res) => {
  const sessionId = req.query.sessionId as string;
  if (!sessionId) return res.status(400).json({ error: 'sessionId required' });
  res.json(usageTracker.getSessionSummary(sessionId));
});

router.get('/models', (_req, res) => {
  res.json(usageTracker.getModelUsage());
});

export default router;
