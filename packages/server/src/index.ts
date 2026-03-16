import { createServer as createHttpServer } from 'http';
import { execSync } from 'child_process';
import { existsSync, readFileSync, appendFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { createApp } from './app.js';
import { setupWebSocket } from './ws.js';
import { initDB } from './db/database.js';
import { sessionManager } from './core/session-manager.js';
import { terminalManager } from './core/terminal-manager.js';

interface ServerOptions {
  port: number;
  projectPath: string;
}

function ensureGit(projectPath: string) {
  const gitDir = join(projectPath, '.git');
  if (!existsSync(gitDir)) {
    execSync('git init', { cwd: projectPath, stdio: 'pipe' });
    console.log(`Initialized git repo at ${projectPath}`);
  }

  // Ensure .gitignore includes CCUI data files
  const ignorePath = join(projectPath, '.gitignore');
  const ccuiEntries = ['.ccui/', '*.db', '*.db-shm', '*.db-wal'];
  let content = '';
  if (existsSync(ignorePath)) {
    content = readFileSync(ignorePath, 'utf-8');
  }
  const missing = ccuiEntries.filter((e) => !content.split('\n').some((line) => line.trim() === e));
  if (missing.length > 0) {
    const addition = (content && !content.endsWith('\n') ? '\n' : '') +
      '# CCUI data\n' + missing.join('\n') + '\n';
    appendFileSync(ignorePath, addition, 'utf-8');
    console.log(`Added to .gitignore: ${missing.join(', ')}`);
  }
}

export async function createServer(options: ServerOptions) {
  const { port, projectPath } = options;

  // Ensure git repo and .gitignore
  ensureGit(projectPath);

  // Initialize database
  const db = initDB(projectPath);

  // Clean up stale sessions: any "active" sessions from a previous run are now idle (no process)
  const stale = db.prepare("UPDATE sessions SET status = 'idle' WHERE status = 'active'").run();
  if (stale.changes > 0) {
    console.log(`Reset ${stale.changes} stale session(s) to idle from previous run`);
  }

  // Initialize head session (auto-create or update existing)
  sessionManager.initHeadSession(projectPath);

  // Create Express app and HTTP server
  const app = createApp(projectPath);
  const server = createHttpServer(app);

  // Setup WebSocket
  setupWebSocket(server);

  // Start listening
  return new Promise<ReturnType<typeof createHttpServer>>((resolve) => {
    server.listen(port, () => {
      console.log(`CCUI server listening on port ${port}`);
      resolve(server);
    });
  });
}

// Allow running directly
const isMain = process.argv[1]?.endsWith('index.ts') || process.argv[1]?.endsWith('index.js');
if (isMain) {
  const port = parseInt(process.env.PORT || '3456', 10);
  const projectPath = process.env.PROJECT_PATH || process.cwd();
  createServer({ port, projectPath }).then(() => {
    console.log(`Project: ${projectPath}`);

    process.on('SIGINT', () => {
      console.log('\nShutting down...');
      sessionManager.cleanupAll();
      terminalManager.cleanupAll();
      process.exit(0);
    });
  });
}
