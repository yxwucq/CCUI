# CCUI - Claude Code WebUI

## Development

After making code changes, restart the dev servers so the user can see the effect:

```bash
lsof -ti:3456 | xargs kill -9 2>/dev/null; lsof -ti:5173 | xargs kill -9 2>/dev/null
pnpm dev  # run in background
```

Always kill ports 3456 and 5173 first, then start fresh. This avoids stale processes.

- **Server** at `http://localhost:3456` — points to `test-project/` via `PROJECT_PATH`.
- **UI** at `http://localhost:5173` — Vite dev server, proxies `/api` and `/ws` to the server.

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
