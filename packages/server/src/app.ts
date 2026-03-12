import express, { type Express } from 'express';
import cors from 'cors';
import { join, dirname } from 'path';
import { existsSync } from 'fs';
import sessionsRouter from './routes/sessions.js';
import agentsRouter from './routes/agents.js';
import { createProjectRouter } from './routes/projects.js';
import usageRouter from './routes/usage.js';
import filesRouter from './routes/files.js';
import { createConfigRouter } from './routes/config.js';

export function createApp(projectPath: string): Express {
  const app = express();
  app.use(cors());
  app.use(express.json());

  // API routes
  app.use('/api/sessions', sessionsRouter);
  app.use('/api/agents', agentsRouter);
  app.use('/api/projects', createProjectRouter(projectPath));
  app.use('/api/usage', usageRouter);
  app.use('/api/files', filesRouter);
  app.use('/api/config', createConfigRouter(projectPath));

  // Serve frontend static files in production
  const uiDistPath = join(dirname(new URL(import.meta.url).pathname), '../../ui/dist');
  if (existsSync(uiDistPath)) {
    app.use(express.static(uiDistPath));
    app.get('*', (_req, res) => {
      res.sendFile(join(uiDistPath, 'index.html'));
    });
  }

  return app;
}
