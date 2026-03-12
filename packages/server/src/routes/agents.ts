import { Router, type Router as IRouter } from 'express';
import { agentEngine } from '../core/agent-engine.js';

const router: IRouter = Router();

router.get('/', (_req, res) => {
  res.json(agentEngine.listAgents());
});

router.get('/templates', (_req, res) => {
  res.json(agentEngine.getTemplates());
});

router.post('/', (req, res) => {
  const { name, description, systemPrompt, allowedTools, maxTurns } = req.body;
  if (!name || !systemPrompt) return res.status(400).json({ error: 'name and systemPrompt required' });
  const agent = agentEngine.createAgent({
    name, description: description || '', systemPrompt,
    allowedTools: allowedTools || [], maxTurns,
  });
  res.status(201).json(agent);
});

router.get('/:id', (req, res) => {
  const agent = agentEngine.getAgent(req.params.id);
  if (!agent) return res.status(404).json({ error: 'Agent not found' });
  res.json(agent);
});

router.put('/:id', (req, res) => {
  const agent = agentEngine.updateAgent(req.params.id, req.body);
  if (!agent) return res.status(404).json({ error: 'Agent not found' });
  res.json(agent);
});

router.delete('/:id', (req, res) => {
  const ok = agentEngine.deleteAgent(req.params.id);
  if (!ok) return res.status(404).json({ error: 'Agent not found' });
  res.json({ ok: true });
});

export default router;
