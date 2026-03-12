# CCUI - Claude Code WebUI 完整实现计划

## 项目概述

CCUI 是一个本地 WebUI 工具，在项目目录运行 `npx ccui` 后自动启动本地服务器并打开浏览器，提供可视化的 Claude Code 管理界面，替代纯终端交互。

---

## 技术栈

- **前端**: React 18 + Vite + Tailwind CSS + Zustand (状态管理) + xterm.js (终端) + recharts (图表)
- **后端**: Express + ws (WebSocket) + better-sqlite3 + chokidar (文件监听)
- **语言**: TypeScript 全栈
- **包管理**: pnpm workspace (monorepo)
- **CLI 交互**: Node.js child_process spawn Claude Code CLI
- **发布**: npm 包，bin 入口

---

## 目录结构

```
ccui/
├── package.json                  # pnpm workspace root
├── pnpm-workspace.yaml           # workspace 配置
├── tsconfig.base.json            # 共享 TS 配置
├── bin/
│   └── cli.ts                    # npx ccui 入口脚本
├── packages/
│   ├── shared/                   # 共享类型定义
│   │   ├── package.json
│   │   └── src/
│   │       └── types.ts          # Session, Agent, Usage 等类型
│   ├── server/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── index.ts          # 服务启动入口
│   │       ├── app.ts            # Express app 创建
│   │       ├── ws.ts             # WebSocket server 设置
│   │       ├── db/
│   │       │   ├── schema.sql    # SQLite 建表语句
│   │       │   └── database.ts   # DB 初始化 + 查询封装
│   │       ├── core/
│   │       │   ├── session-manager.ts
│   │       │   ├── agent-engine.ts
│   │       │   ├── project-scanner.ts
│   │       │   ├── usage-tracker.ts
│   │       │   └── file-manager.ts
│   │       └── routes/
│   │           ├── sessions.ts   # /api/sessions
│   │           ├── agents.ts     # /api/agents
│   │           ├── projects.ts   # /api/projects
│   │           ├── usage.ts      # /api/usage
│   │           └── files.ts      # /api/files
│   └── ui/
│       ├── package.json
│       ├── tsconfig.json
│       ├── vite.config.ts
│       ├── index.html
│       ├── tailwind.config.js
│       └── src/
│           ├── main.tsx
│           ├── App.tsx
│           ├── router.tsx        # React Router 路由配置
│           ├── stores/
│           │   ├── sessionStore.ts
│           │   ├── agentStore.ts
│           │   └── usageStore.ts
│           ├── hooks/
│           │   ├── useWebSocket.ts
│           │   └── useApi.ts
│           ├── layouts/
│           │   └── MainLayout.tsx  # 侧边栏 + 顶栏 + 内容区
│           ├── views/
│           │   ├── Dashboard.tsx
│           │   ├── Chat.tsx
│           │   ├── Projects.tsx
│           │   ├── Agents.tsx
│           │   ├── AgentEditor.tsx
│           │   ├── Usage.tsx
│           │   └── Files.tsx
│           └── components/
│               ├── Sidebar.tsx
│               ├── SessionList.tsx
│               ├── ChatMessage.tsx
│               ├── FileTree.tsx
│               ├── CodeEditor.tsx
│               ├── UsageChart.tsx
│               ├── AgentCard.tsx
│               ├── GitStatus.tsx
│               └── Terminal.tsx
```

---

## Phase 0: 项目脚手架 (先做这步)

### 任务清单

1. **初始化 monorepo**
   - 创建根目录 `ccui/`
   - `pnpm init`，创建 `pnpm-workspace.yaml`：
     ```yaml
     packages:
       - 'packages/*'
       - 'bin'
     ```
   - 创建 `tsconfig.base.json` 共享配置（target: ES2022, module: ESNext, strict: true）

2. **创建 packages/shared**
   - `src/types.ts` 定义所有共享类型：
     ```typescript
     // Session 相关
     interface Session {
       id: string;
       projectPath: string;
       agentId?: string;
       status: 'active' | 'idle' | 'terminated';
       createdAt: string;
       lastActiveAt: string;
     }

     interface ChatMessage {
       id: string;
       sessionId: string;
       role: 'user' | 'assistant' | 'system';
       content: string;
       timestamp: string;
       tokenCount?: number;
       cost?: number;
     }

     // Agent 相关
     interface AgentConfig {
       id: string;
       name: string;
       description: string;
       systemPrompt: string;
       allowedTools: string[];
       maxTurns?: number;
       createdAt: string;
       updatedAt: string;
     }

     // 用量相关
     interface UsageRecord {
       id: string;
       sessionId: string;
       inputTokens: number;
       outputTokens: number;
       cacheRead: number;
       cacheWrite: number;
       cost: number;
       model: string;
       timestamp: string;
     }

     interface UsageSummary {
       totalCost: number;
       totalInputTokens: number;
       totalOutputTokens: number;
       sessionCount: number;
       dailyBreakdown: { date: string; cost: number; tokens: number }[];
     }

     // 项目相关
     interface ProjectInfo {
       path: string;
       name: string;
       gitBranch?: string;
       gitStatus?: GitFileStatus[];
       claudeMd?: string;       // CLAUDE.md 内容
       fileCount: number;
       lastModified: string;
     }

     interface GitFileStatus {
       file: string;
       status: 'modified' | 'added' | 'deleted' | 'untracked';
     }

     // WebSocket 消息
     type WSMessage =
       | { type: 'chat:input'; sessionId: string; content: string }
       | { type: 'chat:output'; sessionId: string; content: string; done: boolean }
       | { type: 'chat:error'; sessionId: string; error: string }
       | { type: 'session:status'; sessionId: string; status: Session['status'] }
       | { type: 'usage:update'; record: UsageRecord }
       | { type: 'file:changed'; path: string; event: string };
     ```

3. **创建 packages/server**
   - `pnpm init`，安装依赖：express, ws, better-sqlite3, chokidar, cors, open, uuid
   - 类型依赖：@types/express, @types/ws, @types/better-sqlite3
   - 开发依赖：tsx (用于开发时直接运行 ts)

4. **创建 packages/ui**
   - `pnpm create vite ui --template react-ts`
   - 安装依赖：react-router-dom, zustand, recharts, xterm, xterm-addon-fit, lucide-react
   - 安装 tailwindcss + postcss + autoprefixer，初始化 tailwind 配置
   - `vite.config.ts` 配置 proxy 到后端（开发模式）：
     ```typescript
     server: {
       proxy: {
         '/api': 'http://localhost:3456',
         '/ws': { target: 'ws://localhost:3456', ws: true }
       }
     }
     ```

5. **创建 bin/cli.ts**
   - 解析命令行参数（--port, --no-open）
   - 启动 server
   - 自动 `open(http://localhost:{port})`
   - 在根 package.json 中配置 `"bin": { "ccui": "./bin/cli.ts" }`

---

## Phase 1: 后端核心 — Session Manager + DB

**这是最核心的模块，优先实现。**

### 1.1 数据库 (`db/schema.sql` + `db/database.ts`)

```sql
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  project_path TEXT NOT NULL,
  agent_id TEXT,
  status TEXT DEFAULT 'idle',
  created_at TEXT DEFAULT (datetime('now')),
  last_active_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  token_count INTEGER DEFAULT 0,
  cost REAL DEFAULT 0,
  timestamp TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (session_id) REFERENCES sessions(id)
);

CREATE TABLE IF NOT EXISTS agents (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  system_prompt TEXT NOT NULL,
  allowed_tools TEXT DEFAULT '[]',  -- JSON array
  max_turns INTEGER,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS usage_records (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  input_tokens INTEGER DEFAULT 0,
  output_tokens INTEGER DEFAULT 0,
  cache_read INTEGER DEFAULT 0,
  cache_write INTEGER DEFAULT 0,
  cost REAL DEFAULT 0,
  model TEXT DEFAULT '',
  timestamp TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (session_id) REFERENCES sessions(id)
);
```

- `database.ts`：封装 `initDB()`, `query()`, `run()`, `get()` 辅助函数
- DB 文件路径：`{projectPath}/.ccui/data.db`，启动时自动创建目录和文件

### 1.2 Session Manager (`core/session-manager.ts`)

这是最关键的模块，负责管理 Claude Code CLI 子进程。

```
核心逻辑：
- createSession(projectPath, agentId?) → Session
  1. 生成 UUID 作为 sessionId
  2. 构建 spawn 参数:
     claude --dangerously-skip-permissions   (或用户选择是否加)
     如果有 agentId，注入 --system-prompt
  3. child = spawn('claude', args, { cwd: projectPath })
  4. 监听 child.stdout (流式数据 → 解析 → 通过 WebSocket 推送)
  5. 监听 child.stderr (错误处理)
  6. 监听 child.on('exit') (更新 session 状态)
  7. 将 child 进程引用存入 Map<sessionId, ChildProcess>
  8. 写入 DB

- sendMessage(sessionId, content)
  1. 从 Map 获取 child 进程
  2. child.stdin.write(content + '\n')
  3. 将 user message 写入 DB

- getOutput 处理逻辑：
  stdout 数据流处理:
  - 逐行解析 Claude Code 的输出
  - 识别 token usage 信息（Claude Code 输出末尾通常有 token 统计）
  - 通过正则或 JSON 解析提取 input_tokens, output_tokens, cost
  - 将解析结果传给 UsageTracker
  - 将聊天内容通过 WebSocket 推送给前端

- terminateSession(sessionId)
  1. child.kill('SIGTERM')
  2. 更新 DB 状态
  3. 通知前端

- resumeSession(sessionId)
  使用 claude --resume 参数恢复会话

- listSessions() → Session[]
  从 DB 查询所有 session
```

**重要实现细节：**
- 使用 `claude` 命令的 `--output-format stream-json` 参数（如果可用），这样输出是结构化 JSON，方便解析
- 如果不可用，fallback 到解析纯文本输出
- 需要处理 Claude Code 的交互式确认提示（如工具使用确认），通过 WebSocket 转发给前端让用户点击确认

### 1.3 WebSocket Server (`ws.ts`)

```
实现逻辑：
- 创建 ws.Server 挂载到 Express server
- 连接管理: Map<sessionId, Set<WebSocket>>
- 消息路由:
  收到 { type: 'chat:input', sessionId, content }
    → 调用 sessionManager.sendMessage(sessionId, content)
  收到 { type: 'session:create', projectPath, agentId? }
    → 调用 sessionManager.createSession(...)
  收到 { type: 'session:terminate', sessionId }
    → 调用 sessionManager.terminateSession(...)
- 广播: 当 session 有输出时，向订阅该 session 的所有 ws 连接推送
```

### 1.4 REST API Routes (`routes/sessions.ts`)

```
GET    /api/sessions              — 列出所有 session
POST   /api/sessions              — 创建新 session { projectPath, agentId? }
GET    /api/sessions/:id          — 获取 session 详情
GET    /api/sessions/:id/messages — 获取历史消息
DELETE /api/sessions/:id          — 终止 session
POST   /api/sessions/:id/resume   — 恢复 session
```

---

## Phase 2: 前端基础框架 + 聊天界面

### 2.1 布局 (`MainLayout.tsx`)

```
┌──────────────────────────────────────────────┐
│  CCUI                            [项目名]     │  ← 顶栏: logo + 当前项目 + 设置按钮
├──────────┬───────────────────────────────────┤
│ 仪表盘    │                                   │
│ 聊天      │         主内容区                   │
│ 项目      │      (React Router Outlet)        │
│ Agent    │                                   │
│ 用量      │                                   │
│ 文件      │                                   │
│          │                                   │
│ ──────── │                                   │
│ Sessions │                                   │
│  #1 ●    │                                   │
│  #2 ○    │                                   │
├──────────┴───────────────────────────────────┤
│ 状态栏: 活跃 session 数 | 今日用量 | 连接状态    │
└──────────────────────────────────────────────┘
```

- 侧边栏：导航菜单 + 底部 session 快速切换列表
- 颜色方案：深色主题（开发者偏好），用 Tailwind dark mode
- 响应式：移动端侧边栏可折叠

### 2.2 WebSocket Hook (`hooks/useWebSocket.ts`)

```typescript
功能：
- 自动连接 ws://localhost:{port}/ws
- 自动重连（指数退避）
- 提供 sendMessage(msg: WSMessage) 方法
- 根据消息 type 分发到对应 store
- 暴露 connectionStatus 状态
```

### 2.3 聊天视图 (`views/Chat.tsx`)

```
核心功能:
- 顶部: session 选择器 (下拉) + 新建 session 按钮 + Agent 选择
- 中间: 消息列表
  - 用户消息: 右对齐，蓝色背景
  - 助手消息: 左对齐，支持 Markdown 渲染 (用 react-markdown)
  - 系统消息: 居中，灰色
  - 工具调用: 可折叠的代码块展示
  - 流式输出: 打字机效果，光标闪烁
- 底部: 输入框 (支持 Shift+Enter 换行) + 发送按钮 + 停止按钮

组件拆分:
- ChatMessage.tsx: 单条消息渲染
- ChatInput.tsx: 输入区域
- SessionSelector.tsx: session 下拉选择
```

### 2.4 Zustand Store (`stores/sessionStore.ts`)

```typescript
interface SessionStore {
  sessions: Session[];
  activeSessionId: string | null;
  messages: Map<string, ChatMessage[]>;  // sessionId → messages
  streamingContent: string;  // 当前流式输出缓冲

  // actions
  fetchSessions: () => Promise<void>;
  createSession: (projectPath: string, agentId?: string) => Promise<void>;
  setActiveSession: (id: string) => void;
  appendMessage: (sessionId: string, msg: ChatMessage) => void;
  appendStreamChunk: (chunk: string) => void;
  finalizeStream: () => void;
}
```

---

## Phase 3: 项目管理 + 文件浏览

### 3.1 Project Scanner (`core/project-scanner.ts`)

```
功能：
- scanProject(path):
  1. 读取目录结构 (忽略 node_modules, .git, dist 等)
  2. 读取 CLAUDE.md 内容 (如果存在)
  3. 执行 git branch --show-current 获取当前分支
  4. 执行 git status --porcelain 获取文件变更状态
  5. 统计文件数量、最后修改时间
  6. 返回 ProjectInfo 对象

- watchProject(path, callback):
  使用 chokidar 监听文件变化
  变化时通过 WebSocket 通知前端
  忽略 .ccui/, node_modules/, .git/ 目录
```

### 3.2 File Manager (`core/file-manager.ts`)

```
API:
- getFileTree(path, depth=3) → 递归获取目录树结构
- readFile(filePath) → 文件内容 (带 MIME 检测，二进制文件不返回内容)
- writeFile(filePath, content) → 保存文件
- getGitDiff(filePath) → git diff 输出
```

### 3.3 Routes

```
GET  /api/projects/info            — 当前项目信息
GET  /api/projects/tree            — 文件树
GET  /api/files?path=xxx           — 读取文件内容
PUT  /api/files?path=xxx           — 保存文件
GET  /api/projects/git/status      — git 状态
GET  /api/projects/git/diff?path=  — 文件 diff
```

### 3.4 前端视图

**Projects.tsx:**
- 项目概览卡片: 名称、路径、git 分支、文件数
- CLAUDE.md 预览 (Markdown 渲染)
- Git 状态面板: 变更文件列表 + 状态图标

**Files.tsx:**
- 左侧: FileTree 组件 (可展开折叠的目录树)
- 右侧: CodeEditor 组件 (用 codemirror 或 monaco-editor-react 做语法高亮编辑)
- 支持保存 (Ctrl+S)

---

## Phase 4: Agent 系统

### 4.1 Agent Engine (`core/agent-engine.ts`)

```
功能:
- createAgent(config: AgentConfig) → 保存到 DB
- updateAgent(id, partial)
- deleteAgent(id)
- listAgents() → AgentConfig[]
- getAgent(id) → AgentConfig

Agent 配置存储为 JSON，核心字段:
- systemPrompt: 自定义系统提示词
- allowedTools: 允许使用的工具白名单 (如 ['Read', 'Write', 'Bash'])
- maxTurns: 最大对话轮数限制

创建 session 时如果指定了 agentId:
- 从 DB 加载 agent 配置
- 将 systemPrompt 通过 --system-prompt 参数传给 claude CLI
- 将 allowedTools 通过 --allowedTools 参数传给 claude CLI (如果支持)
```

### 4.2 预设 Agent 模板

系统内置几个 Agent 模板，用户可基于模板创建:

```
1. Code Reviewer
   - systemPrompt: "你是一个严格的代码审查员..."
   - 专注: 代码质量、安全性、性能

2. Bug Fixer
   - systemPrompt: "你是一个专注于调试的工程师..."
   - 专注: 定位和修复 bug

3. Docs Writer
   - systemPrompt: "你是一个技术文档撰写专家..."
   - 专注: README、API 文档

4. Refactorer
   - systemPrompt: "你是一个代码重构专家..."
   - 专注: 代码结构优化
```

### 4.3 Routes

```
GET    /api/agents           — 列出所有 agent (含预设模板)
POST   /api/agents           — 创建 agent
GET    /api/agents/:id       — 获取 agent 详情
PUT    /api/agents/:id       — 更新 agent
DELETE /api/agents/:id       — 删除 agent
GET    /api/agents/templates — 获取预设模板列表
```

### 4.4 前端视图

**Agents.tsx:**
- 卡片网格展示所有 Agent
- 每张卡片: 名称 + 描述 + 使用次数 + 快速启动按钮
- "新建 Agent" 按钮 → 打开 AgentEditor

**AgentEditor.tsx:**
- 表单:
  - 名称 (input)
  - 描述 (textarea)
  - System Prompt (大文本框，支持 Markdown 预览)
  - 允许的工具 (多选 checkbox)
  - 最大轮数 (number input)
- 模板选择: 下拉菜单选择预设模板，自动填充表单
- 保存 / 取消按钮
- 测试按钮: 快速创建一个使用该 Agent 的 session

---

## Phase 5: 用量分析仪表盘

### 5.1 Usage Tracker (`core/usage-tracker.ts`)

```
功能:
- recordUsage(record: UsageRecord) → 写入 DB
- getSummary(timeRange?) → UsageSummary
  - 总 token 数、总费用
  - 按天/周/月聚合
  - 按 model 分组统计
  - 按 session 分组统计
- getSessionUsage(sessionId) → 单个 session 的用量明细

解析逻辑:
Claude Code CLI 的 --output-format stream-json 模式下
输出中会包含 usage 信息:
{
  "type": "result",
  "usage": {
    "input_tokens": 1234,
    "output_tokens": 567,
    "cache_creation_input_tokens": 100,
    "cache_read_input_tokens": 200
  },
  "model": "claude-sonnet-4-20250514"
}

解析这些字段，计算 cost:
- 根据 model 映射价格 (维护一个 model→price 映射表)
- cost = (input_tokens * input_price + output_tokens * output_price) / 1_000_000
```

### 5.2 Routes

```
GET /api/usage/summary?range=7d|30d|all     — 用量汇总
GET /api/usage/daily?range=30d              — 每日明细
GET /api/usage/sessions                     — 按 session 统计
GET /api/usage/models                       — 按 model 统计
```

### 5.3 前端视图 (`views/Usage.tsx` + `views/Dashboard.tsx`)

**Dashboard.tsx (首页仪表盘):**
- 顶部统计卡片 (4个):
  - 今日费用 | 今日 token 数 | 活跃 session 数 | 本月总费用
- 中间:
  - 左: 7天费用趋势折线图 (recharts LineChart)
  - 右: Model 使用占比饼图 (recharts PieChart)
- 底部:
  - 最近 session 列表 (5条) + 快捷操作按钮

**Usage.tsx (详细用量页):**
- 时间范围选择器: 7天 | 30天 | 全部
- 费用趋势图 (可切换 token/cost 视角)
- 表格: 每个 session 的详细用量 (可排序)
- 导出按钮: 导出 CSV

---

## Phase 6: 打磨 + 发布

### 6.1 生产构建

```
构建流程 (在 bin/cli.ts 中):
1. 前端 vite build → 输出到 packages/ui/dist
2. 后端 tsc 编译 → 输出到 packages/server/dist
3. 服务启动时 express.static 托管前端 dist 目录
4. 这样只需启动一个端口同时服务前端和 API
```

### 6.2 CLI 完善 (`bin/cli.ts`)

```typescript
// 使用 commander 解析参数
import { Command } from 'commander';

const program = new Command();
program
  .name('ccui')
  .description('Claude Code WebUI')
  .option('-p, --port <port>', '端口号', '3456')
  .option('--no-open', '不自动打开浏览器')
  .option('--project <path>', '项目路径', process.cwd())
  .parse();

// 启动逻辑:
// 1. 检查 claude CLI 是否已安装 (which claude)
// 2. 检查端口是否占用
// 3. 创建 .ccui/ 目录
// 4. 启动 server
// 5. 打开浏览器
// 6. 优雅退出 (SIGINT → 清理所有子进程)
```

### 6.3 发布配置

```json
// package.json
{
  "name": "ccui",
  "version": "0.1.0",
  "bin": { "ccui": "./bin/cli.js" },
  "files": [
    "bin/",
    "packages/server/dist/",
    "packages/ui/dist/",
    "packages/shared/dist/"
  ],
  "scripts": {
    "dev": "concurrently \"pnpm --filter server dev\" \"pnpm --filter ui dev\"",
    "build": "pnpm --filter shared build && pnpm --filter ui build && pnpm --filter server build",
    "start": "node bin/cli.js"
  }
}
```

### 6.4 最终检查清单

- [ ] `npx ccui` 能正常启动
- [ ] 自动打开浏览器并显示仪表盘
- [ ] 能创建新 session 并与 Claude Code 对话
- [ ] 流式输出正常显示
- [ ] 能创建/编辑/删除 Agent
- [ ] 用量数据正确记录和展示
- [ ] 文件浏览器正常工作
- [ ] Git 状态正确显示
- [ ] 关闭终端时所有子进程正确清理
- [ ] .ccui/ 已加入默认 .gitignore 建议

---

## 实现顺序总结

```
Phase 0 → 脚手架搭建 (pnpm monorepo + 基础配置)
Phase 1 → Session Manager + DB + WebSocket (能跑通 CLI 对话)
Phase 2 → 前端布局 + 聊天界面 (能在浏览器中与 Claude 对话)
Phase 3 → 项目管理 + 文件浏览 (可视化项目状态)
Phase 4 → Agent 系统 (自定义 Agent 创建和使用)
Phase 5 → 用量仪表盘 (统计和可视化)
Phase 6 → 打磨 + 发布 (构建、CLI、npm 发布)
```

每个 Phase 完成后都应该是可运行的状态，逐步叠加功能。
