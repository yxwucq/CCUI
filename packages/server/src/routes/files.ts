import { Router } from 'express';
import { readFile, writeFile } from '../core/file-manager.js';

const router = Router();

router.get('/', (req, res) => {
  const path = req.query.path as string;
  if (!path) return res.status(400).json({ error: 'path required' });
  try {
    const result = readFile(path);
    res.json(result);
  } catch (err: any) {
    res.status(404).json({ error: err.message });
  }
});

router.put('/', (req, res) => {
  const path = req.query.path as string;
  const { content } = req.body;
  if (!path) return res.status(400).json({ error: 'path required' });
  try {
    writeFile(path, content);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
