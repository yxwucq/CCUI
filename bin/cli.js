#!/usr/bin/env node

// Compiled CLI entry point — runs the built server directly
import { createServer } from '../packages/server/dist/index.js';

const args = process.argv.slice(2);
const portIdx = args.indexOf('--port');
const port = portIdx !== -1 ? parseInt(args[portIdx + 1], 10) : 3456;
const noOpen = args.includes('--no-open');
const projectPath = process.cwd();

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
