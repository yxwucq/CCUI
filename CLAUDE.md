# CCUI - Claude Code WebUI

## Development

After making code changes, restart the dev servers so the user can see the effect:

```bash
DEV_PORT="${DEV_PORT:-3456}"
lsof -ti:$DEV_PORT | xargs kill -9 2>/dev/null
DEV_PORT=$DEV_PORT npx concurrently --names server,ui -c blue,green "PROJECT_PATH=$PWD/test-project PORT=$DEV_PORT pnpm --filter @ccui/server dev" "DEV_PORT=$DEV_PORT pnpm --filter @ccui/ui dev"
```

`DEV_PORT` controls the server port (default: 3456). Vite dev server auto-picks a free port and proxies `/api` and `/ws` to the server port.

In a worktree, set `DEV_PORT` to a unique value to avoid port conflicts with other worktrees:

```bash
DEV_PORT=4000  # example: each worktree should use a different port
```

- **Server** at `http://localhost:$DEV_PORT` — points to `test-project/` via `PROJECT_PATH`.
- **UI** at Vite's auto-assigned port — check terminal output for the URL.

## Project Structure

pnpm monorepo with 3 packages:
- `packages/shared` — TypeScript types (imported directly as .ts, no build needed for dev)
- `packages/server` — Express + WebSocket + SQLite backend
- `packages/ui` — React + Vite + Tailwind frontend

`test-project/` is a sandboxed git repo for testing CCUI without affecting the main codebase.

## Key Conventions

- TypeScript strict mode, ES modules throughout
- Server uses `tsx` for dev (no compile step needed)
- Shared types are referenced directly from source (`main: "./src/types.ts"`)
- UI config persisted in `.ccui/ui-config.json` inside the target project
- Database stored at `{projectPath}/.ccui/data.db` (SQLite, WAL mode)
- Server auto-inits git repo and `.gitignore` if missing in the target project
