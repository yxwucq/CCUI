import { Router, type Router as IRouter } from 'express';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { listBranches, listWorktrees, getCurrentBranch } from '../core/worktree-manager.js';
import type { ProjectConfig } from '@ccui/shared';

const CONFIG_FILE = 'project-config.json';

export function loadProjectConfig(projectPath: string): ProjectConfig {
  const configPath = join(projectPath, '.ccui', CONFIG_FILE);
  try {
    const raw = readFileSync(configPath, 'utf-8');
    return JSON.parse(raw) as ProjectConfig;
  } catch {
    return { worktreeMode: 'managed', initialized: false };
  }
}

function saveProjectConfigFile(projectPath: string, config: ProjectConfig): void {
  const dir = join(projectPath, '.ccui');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, CONFIG_FILE), JSON.stringify(config, null, 2), 'utf-8');
}

export function createProjectConfigRouter(projectPath: string): IRouter {
  const router = Router();

  // GET /api/project-config — read config (return defaults if missing)
  router.get('/', (_req, res) => {
    res.json(loadProjectConfig(projectPath));
  });

  // PUT /api/project-config — write config, set initialized: true
  router.put('/', (req, res) => {
    const { worktreeMode, worktreeBasePath } = req.body;
    if (worktreeMode && worktreeMode !== 'managed' && worktreeMode !== 'external') {
      return res.status(400).json({ error: 'worktreeMode must be "managed" or "external"' });
    }
    const config: ProjectConfig = {
      worktreeMode: worktreeMode || 'managed',
      worktreeBasePath: worktreeBasePath || undefined,
      initialized: true,
    };
    try {
      saveProjectConfigFile(projectPath, config);
      res.json(config);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /api/project-config/init-info — return branches, worktrees, currentBranch, initialized
  router.get('/init-info', (_req, res) => {
    try {
      const config = loadProjectConfig(projectPath);
      const branches = listBranches(projectPath).filter((b) => !b.includes('--ccui-'));
      const allWorktrees = listWorktrees(projectPath);
      // Exclude the main worktree (the project root itself)
      const worktrees = allWorktrees.filter((wt) => wt.path !== projectPath);
      const currentBranch = getCurrentBranch(projectPath);
      res.json({
        branches,
        worktrees,
        currentBranch,
        initialized: config.initialized,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}
