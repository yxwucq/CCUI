<div align="center">

<br/>
<br/>

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://img.shields.io/badge/%E2%9A%A1-CCUI-black?style=for-the-badge&labelColor=000&color=7c3aed&logo=data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IndoaXRlIiBzdHJva2Utd2lkdGg9IjIiPjxwYXRoIGQ9Ik0xMyAyTDMgMTRoOWwtLTEgMTAgMTAtMTJoLTlsMSAtMTB6Ii8+PC9zdmc+">
  <img alt="CCUI" src="https://img.shields.io/badge/%E2%9A%A1-CCUI-white?style=for-the-badge&labelColor=f5f5f5&color=7c3aed&logo=data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiM3YzNhZWQiIHN0cm9rZS13aWR0aD0iMiI+PHBhdGggZD0iTTEzIDJMMyAxNGg5bC0xIDEwIDEwLTEyaC05bDEgLTEweiIvPjwvc3ZnPg==">
</picture>

# Claude Code WebUI

<br/>

```
  One codebase. Multiple Claude agents. Each on its own branch.
```

<br/>

<a href="#-quick-start"><img src="https://img.shields.io/badge/Quick_Start-000?style=flat-square&logo=rocket&logoColor=white" alt="Quick Start" /></a>
<a href="#-features"><img src="https://img.shields.io/badge/Features-000?style=flat-square&logo=sparkles&logoColor=white" alt="Features" /></a>
<a href="#-how-it-works"><img src="https://img.shields.io/badge/How_It_Works-000?style=flat-square&logo=git&logoColor=white" alt="How It Works" /></a>

<br/>
<br/>

<img src="docs/hero.png" width="820" alt="CCUI — Multiple Claude sessions running in parallel" />

<br/>

</div>

<br/>

## 🚀 Quick Start

> **You need:** Node.js 18+, [pnpm](https://pnpm.io/), [Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code) authenticated.

```bash
git clone https://github.com/yxwucq/CCUI.git
cd CCUI
pnpm install && pnpm build
```

Then point it at any project:

```bash
ccui                    # current directory
ccui --path ~/my-app    # specific project
ccui --port 8080        # custom port
```

<details>
<summary>All CLI options</summary>

```
--port <n>       Server port              default: 3456
--host <addr>    Bind address             default: localhost
--path <dir>     Project directory         default: cwd
--no-open        Don't auto-open browser
-v, --version    Version
-h, --help       Help
```

</details>

<br/>

## The Problem

You're deep in a project. You need Claude to fix a bug, add a feature, and refactor a module — all at the same time. But Claude Code runs one session at a time, in one directory, on one branch.

**CCUI removes that bottleneck.**

Spawn multiple Claude agents, each working in an isolated git worktree on its own branch. Watch them all from a single dashboard. Merge when ready.

```
main ────────────────────────────────────────────────► main
  │
  ├── 🔀 fork: fix-auth-bug ─────────► ✅ merge back
  │
  ├── 🔀 fork: add-search ───────────────────────── ► 🔄 working...
  │
  └── 🔗 attach: feature-xyz ────────► continue work
```

<br/>

## 📺 Demo

<div align="center">
<img src="docs/demo-fork.gif" width="740" alt="Create a fork session, watch Claude work, merge back" />
</div>

<br/>

## ✨ Features

<table>
<tr>
<td width="33%" valign="top">

#### 🧬 Session Management
Run multiple Claude sessions **in parallel**, each with its own interactive terminal.

**Fork** — isolated branch + worktree.
**Attach** — pick up existing work.
**Terminate** — merge or discard.

</td>
<td width="33%" valign="top">

#### 🖥 Terminal & Interface
Full **xterm.js** terminal per session — not a simulation, the real thing.

**Focus mode** — fullscreen with `⌘1-9` switching.
**8 themes** — from Dracula to Sakura.
**Tutorial** — built-in onboarding.

</td>
<td width="33%" valign="top">

#### 📊 Observability
**File browser** with live diff viewer across worktrees.

**Per-session cost tracking** with daily budget alerts.
**Custom agents** with system prompts & tool permissions.
All data **100% local**.

</td>
</tr>
</table>

<br/>

## 🔍 How It Works

Each session spawns a Claude Code process with its own terminal in the browser. Everything works — prompts, tool approvals, the full Claude CLI experience.

<table>
<tr>
<td width="50%" valign="top">

#### 🔀 Fork Mode
Creates a **new branch + git worktree** from any base. Claude works in complete isolation. When done:

- **Merge** — bring changes back to the target branch
- **Discard** — clean up the worktree and branch

</td>
<td width="50%" valign="top">

#### 🔗 Attach Mode
Connects to an **existing branch** directly. No fork, no copy. Multiple sessions can share a branch (with a warning).

Good for continuing work on a feature branch that already exists.

</td>
</tr>
</table>

<div align="center">
<img src="docs/fork-mode.png" width="640" alt="Fork mode — isolated session with its own branch" />
</div>

> **🔒 Privacy** — Everything runs locally. Sessions, usage data, and config live in `.ccui/` inside your project. Nothing leaves your machine.

<br/>

## 🎨 Themes

<div align="center">
<img src="docs/themes.png" width="720" alt="8 built-in themes" />

`Dark` · `Light` · `Nord` · `Dracula` · `Catppuccin` · `Solarized` · `Tokyo Night` · `Sakura`

</div>

<br/>

## 📄 License

MIT

---

<div align="center">

<br/>

**Built for developers who think one Claude isn't enough.**

[![GitHub stars](https://img.shields.io/github/stars/anthropics/ccui?style=social)](https://github.com/anthropics/ccui)

<br/>

</div>
