# 方案 A 实施计划：分层清洁架构

> 创建日期: 2026-03-13
> 状态: 待开始

## 目标架构

```
UI:     views → stores → api/ → server       （单向）
        views → components（props only）       （单向）
Server: routes → services → adapters → db     （单向）
```

---

## Step 1: UI — 新增 api/ 适配层

**目标：** 将散落在 stores 中的 fetch() 调用收敛到 `packages/ui/src/api/` 目录

**新建文件：**
- [ ] `api/sessions.ts` — 提取 sessionStore 中所有 `/api/sessions/*` 的 fetch 调用
- [ ] `api/agents.ts` — 提取 agentStore 中所有 `/api/agents/*` 的 fetch 调用
- [ ] `api/usage.ts` — 提取 usageStore 中所有 `/api/usage/*` 的 fetch 调用
- [ ] `api/config.ts` — 提取 widgetStore 中的 `/api/config` 读写调用
- [ ] `api/projects.ts` — 提取各处的 `/api/projects/*` 调用

**修改文件：**
- [ ] `stores/sessionStore.ts` — 删除内联 fetch，改为调用 `api/sessions`
- [ ] `stores/agentStore.ts` — 删除内联 fetch，改为调用 `api/agents`
- [ ] `stores/usageStore.ts` — 删除内联 fetch，改为调用 `api/usage`
- [ ] `stores/widgetStore.ts` — 删除内联 fetch，改为调用 `api/config`

**清理：**
- [ ] 评估 `hooks/useApi.ts` 是否废弃或合并进 api/ 层

**验收标准：** stores/ 目录中不再有任何 `fetch(` 调用

---

## Step 2: UI — 拆分 god components

**目标：** 将大组件拆为 <200 行的子组件

### 2a: 拆分 views/Chat.tsx（~457行）
- [ ] 提取 `components/SessionInput.tsx` — 底部输入框 + 发送逻辑
- [ ] 提取 `components/MessageList.tsx` — 消息滚动区域
- [ ] Chat.tsx 只保留组合逻辑，目标 <150 行

### 2b: 拆分 components/SessionBlock.tsx（~591行）
- [ ] 提取 `components/SessionHeader.tsx` — 标题栏（状态灯、branch、操作按钮）
- [ ] 提取 `components/SessionMessages.tsx` — 消息渲染区域
- [ ] 提取 `components/SessionWidgetBar.tsx` — widget 栏
- [ ] SessionBlock.tsx 只保留卡片外壳 + 折叠/展开逻辑，目标 <150 行

**验收标准：** 单个文件不超过 200 行，每个子组件职责单一

---

## Step 3: UI — 组件去 store 依赖

**目标：** `components/` 下的文件不再直接 import store，全部通过 props 接收数据

**需要检查并修改的文件：**
- [ ] `components/Sidebar.tsx` — 去掉 useSessionStore，改由 MainLayout 传入 props
- [ ] `components/SessionBlock.tsx` — 去掉 store 直接引用，改为 props
- [ ] `components/widgets/*.tsx` — 检查所有 widget 是否直接引用 store
- [ ] 其他 components/ 下文件逐一扫描

**修改方式：**
- 在对应的 view 或 layout 中读取 store
- 通过 props 传递给 component
- component 只负责渲染

**验收标准：** `grep -r "useSessionStore\|useAgentStore\|useUsageStore\|useWidgetStore" packages/ui/src/components/` 返回空

---

## Step 4: Server — session-manager 职责拆分

**目标：** 将 session-manager.ts（~505行）中的非核心职责抽出

**新建文件：**
- [ ] `core/file-activity-detector.ts` — 从 session-manager 抽出文件活动检测逻辑
- [ ] `core/branch-watcher.ts` — 从 session-manager 抽出 branch 轮询检测

**修改文件：**
- [ ] `core/session-manager.ts` — 只保留 claude-cli spawn/resume/terminate 和 stream 处理

**验收标准：** session-manager.ts 行数 <300，每个新文件职责单一

---

## Step 5: Server — routes 瘦身

**目标：** routes 只做参数校验 → 调用 core → 格式化响应

**需要检查的文件：**
- [ ] `routes/sessions.ts` — 检查是否有业务逻辑混入，抽到 session-manager
- [ ] `routes/projects.ts` — 检查 git 相关逻辑是否应属于 worktree-manager
- [ ] `routes/files.ts` — 检查是否有超出格式化的逻辑

**验收标准：** 每个 route handler 不超过 20 行（不含错误处理）

---

## 执行顺序与风险

| Step | 估计改动量 | 风险 | 前置依赖 |
|------|----------|------|---------|
| Step 1 | 新建5 + 改4 | 低（纯搬迁） | 无 |
| Step 2 | 新建6 + 改2 | 中（UI 行为需验证） | 无 |
| Step 3 | 改5-8个 | 中（props 穿透设计） | Step 2 完成后更容易 |
| Step 4 | 新建2 + 改1 | 低（服务端逻辑搬迁） | 无 |
| Step 5 | 改2-3个 | 低 | Step 4 完成后更容易 |

**建议：** Step 1 和 Step 4 互相独立，可以并行。Step 2/3 建议在 Step 1 之后做。

---

## 完成标志

- [ ] UI: stores/ 中无 fetch 调用
- [ ] UI: components/ 中无 store 导入
- [ ] UI: 无超过 200 行的组件文件
- [ ] Server: session-manager.ts < 300 行
- [ ] Server: routes handler < 20 行
- [ ] 全部功能与重构前行为一致
