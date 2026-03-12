import { Router, type Router as IRouter } from 'express';
import { scanProject, getFileTree } from '../core/project-scanner.js';
import { execSync } from 'child_process';
import { listBranches, getCurrentBranch } from '../core/worktree-manager.js';

export function createProjectRouter(projectPath: string): IRouter {
  const router = Router();

  router.get('/info', (_req, res) => {
    try {
      const info = scanProject(projectPath);
      res.json(info);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/tree', (req, res) => {
    const depth = parseInt(req.query.depth as string) || 3;
    const tree = getFileTree(projectPath, depth);
    res.json(tree);
  });

  router.get('/git/status', (_req, res) => {
    try {
      const raw = execSync('git status --porcelain', { cwd: projectPath, encoding: 'utf-8' });
      res.json(raw.split('\n').filter(Boolean));
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/git/branches', (_req, res) => {
    try {
      const branches = listBranches(projectPath);
      const current = getCurrentBranch(projectPath);
      res.json({ branches, current });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/git/diff', (req, res) => {
    const path = req.query.path as string;
    try {
      const cmd = path ? `git diff -- "${path}"` : 'git diff';
      const diff = execSync(cmd, { cwd: projectPath, encoding: 'utf-8' });
      res.json({ diff });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/git/log', (req, res) => {
    const limit = Math.min(parseInt(req.query.limit as string) || 100, 500);
    try {
      const raw = execSync(
        `git log --all --pretty=format:%H%x1f%h%x1f%s%x1f%an%x1f%ci%x1f%D%x1f%P -n ${limit}`,
        { cwd: projectPath, encoding: 'utf-8' }
      );
      const commits = raw.split('\n').filter(Boolean).map((line) => {
        const [hash, short, message, author, date, refsStr, parentsStr] = line.split('\x1f');
        return {
          hash: hash || '',
          short: short || '',
          message: message || '',
          author: author || '',
          date: date || '',
          refs: refsStr ? refsStr.split(', ').filter(Boolean) : [],
          parents: parentsStr ? parentsStr.trim().split(' ').filter(Boolean) : [],
        };
      });
      res.json(commits);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}
