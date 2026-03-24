import { Router, type Router as IRouter } from 'express';
import { scanProject, getFileTree } from '../core/project-scanner.js';
import { listBranches, getCurrentBranch } from '../core/worktree-manager.js';
import { getGitStatus, getDiff, getGitLog } from '../core/git-ops.js';

export function createProjectRouter(projectPath: string): IRouter {
  const router = Router();

  router.get('/info', (_req, res) => {
    try {
      res.json(scanProject(projectPath));
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/tree', (req, res) => {
    res.json(getFileTree(projectPath, parseInt(req.query.depth as string) || 3));
  });

  router.get('/git/status', (_req, res) => {
    try {
      res.json(getGitStatus(projectPath));
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/git/branches', (_req, res) => {
    try {
      const branches = listBranches(projectPath).filter((b) => !b.includes('--ccui-'));
      const current = getCurrentBranch(projectPath);
      if (current && !branches.includes(current)) branches.unshift(current);
      res.json({ branches, current });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/git/diff', (req, res) => {
    try {
      res.json({ diff: getDiff(projectPath, req.query.path as string | undefined) });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/git/log', (req, res) => {
    try {
      res.json(getGitLog(projectPath, Math.min(parseInt(req.query.limit as string) || 100, 500)));
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}
