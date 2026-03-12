#!/usr/bin/env node
import { execSync } from 'child_process';
import { createServer } from '../packages/server/src/index.js';

const args = process.argv.slice(2);
const portIdx = args.indexOf('--port');
const port = portIdx !== -1 ? parseInt(args[portIdx + 1], 10) : 3456;
const noOpen = args.includes('--no-open');
const projectPath = process.cwd();

// Check claude CLI
try {
  execSync('which claude', { stdio: 'ignore' });
} catch {
  console.error('Error: claude CLI not found. Please install it first.');
  process.exit(1);
}

async function main() {
  const server = await createServer({ port, projectPath });

  if (!noOpen) {
    const open = (await import('open')).default;
    open(`http://localhost:${port}`);
  }

  console.log(`CCUI running at http://localhost:${port}`);
  console.log(`Project: ${projectPath}`);

  process.on('SIGINT', () => {
    console.log('\nShutting down...');
    server.close();
    process.exit(0);
  });
}

main().catch(console.error);
