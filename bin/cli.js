#!/usr/bin/env node

// Compiled CLI entry point — runs the built server directly
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(resolve(__dirname, '..', 'package.json'), 'utf-8'));

const args = process.argv.slice(2);

function getArg(flag, short) {
  for (let i = 0; i < args.length; i++) {
    if (args[i] === flag || (short && args[i] === short)) {
      return args[i + 1];
    }
  }
  return undefined;
}

function hasFlag(flag, short) {
  return args.includes(flag) || (short ? args.includes(short) : false);
}

// --help / -h
if (hasFlag('--help', '-h')) {
  console.log(`
ccui v${pkg.version} — Claude Code WebUI

Usage: ccui [options]

Options:
  --port <number>    Port to listen on (default: 3456)
  --host <address>   Host to bind to (default: localhost)
  --path <dir>       Project directory (default: current directory)
  --no-open          Don't open browser on start
  -v, --version      Show version
  -h, --help         Show this help
`.trim());
  process.exit(0);
}

// --version / -v
if (hasFlag('--version', '-v')) {
  console.log(pkg.version);
  process.exit(0);
}

const port = parseInt(getArg('--port') || '3456', 10);
const host = getArg('--host');
const projectPath = getArg('--path') ? resolve(getArg('--path')) : process.cwd();
const noOpen = hasFlag('--no-open');

async function main() {
  const { createServer } = await import('../packages/server/dist/index.js');
  const server = await createServer({ port, host, projectPath });

  if (!noOpen) {
    const open = (await import('open')).default;
    open(`http://${host || 'localhost'}:${port}`);
  }

  console.log(`CCUI running at http://${host || 'localhost'}:${port}`);
  console.log(`Project: ${projectPath}`);

  process.on('SIGINT', () => {
    console.log('\nShutting down...');
    server.close();
    process.exit(0);
  });
}

main().catch(console.error);
