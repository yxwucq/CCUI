import { Router, type Router as IRouter } from 'express';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

export function createConfigRouter(projectPath: string): IRouter {
  const router = Router();
  const configDir = join(projectPath, '.ccui');
  const configFile = join(configDir, 'ui-config.json');

  function readConfig() {
    if (!existsSync(configFile)) return {};
    try {
      return JSON.parse(readFileSync(configFile, 'utf-8'));
    } catch {
      return {};
    }
  }

  function writeConfig(data: any) {
    mkdirSync(configDir, { recursive: true });
    writeFileSync(configFile, JSON.stringify(data, null, 2), 'utf-8');
  }

  router.get('/', (_req, res) => {
    res.json(readConfig());
  });

  router.put('/', (req, res) => {
    writeConfig(req.body);
    res.json({ ok: true });
  });

  // Patch a specific session's widget config
  router.patch('/sessions/:sessionId/widgets', (req, res) => {
    const config = readConfig();
    if (!config.sessions) config.sessions = {};
    config.sessions[req.params.sessionId] = {
      ...config.sessions[req.params.sessionId],
      widgets: req.body.widgets,
    };
    writeConfig(config);
    res.json({ ok: true });
  });

  return router;
}
