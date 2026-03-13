# CCUI 模块化架构方案

> 创建日期: 2026-03-13
> 状态: 已选定方案 A，渐进式分层清洁架构

## 背景

CCUI 当前 ~1万行 TypeScript，pnpm monorepo（shared/server/ui）。
核心痛点：god components（SessionBlock 591行, Chat 457行），stores 混合 HTTP 调用与状态管理，session-manager 职责过多。

---

## 方案 A：分层清洁架构（已选定）

### 模块划分

```
packages/ui/src/
├── views/          # 路由级容器，从 store 取数据，组合 components
├── components/     # 纯展示组件，只接 props，不知道 store 存在
├── stores/         # 纯状态管理，通过 api/ 层获取数据
├── api/            # 所有 HTTP/WS 调用的唯一出口（新增）
├── hooks/          # 通用 hooks
└── layouts/        # 布局组件

packages/server/src/
├── routes/         # HTTP 入口：参数校验 → 调 service → 返回结果
├── services/       # 业务逻辑（session 生命周期、agent 编排）
├── adapters/       # 包装外部系统（DB、文件、CLI、git）
├── db/             # SQLite 初始化与 schema
└── ws.ts           # WebSocket 服务
```

### 依赖方向

```
UI:     views → stores → api → server
        views → components（单向，components 不导入 store）

Server: routes → services → adapters → db
        禁止反向依赖
```

### 优点
- 迁移成本最低，可在现有代码上渐进重构
- 各层边界清晰，god component 自然消解
- store 与 HTTP 解耦，换 API 协议只动 api/ 层

### 缺点
- 无正式插件机制，需额外设计
- adapters 层在 server 端和 UI 端含义略有不同

---

## 方案 B：功能域（Feature Slice）架构

### 模块划分

```
packages/server/
├── core/            # 基础设施（DB、进程池、WS hub）
└── features/
    ├── sessions/    # session CRUD + claude-cli 驱动
    ├── git/         # git 操作封装
    ├── usage/       # 用量统计与持久化
    ├── agents/      # agent engine
    └── files/       # 文件树、diff

packages/ui/
├── shell/           # 全局布局、路由、WS 连接
└── features/
    ├── sessions/    # SessionList, SessionBlock, Chat
    ├── git/         # GitLog, BranchSelector
    ├── usage/       # Dashboard, UsageChart
    ├── agents/      # AgentPanel
    └── files/       # FileTree, FileDiff
```

### 依赖方向

```
ui/features/* → ui/shell（仅路由注册）
ui/features/* → shared
server/features/* → server/core → shared
feature 之间通过 server/core 的事件总线通信，禁止 feature 直接导入另一个 feature
```

### 优点
- 高度自治，新功能只新增目录不修改已有代码
- 插件化天然契合（feature = 插件雏形）
- 前后端功能域对称，认知负担低

### 缺点
- 初期迁移成本最高（需重组目录结构）
- feature 间通信依赖事件总线，设计不好容易隐式耦合

---

## 方案 C：微内核（Micro-kernel）架构

### 模块划分

```
packages/kernel/
├── plugin-host.ts   # 插件注册、生命周期管理
├── event-bus.ts     # 跨插件事件系统
└── storage.ts       # 统一持久化接口

packages/server/
├── kernel-bridge/   # 将 kernel 暴露为 HTTP/WS 接口
└── builtin-plugins/ # 内置插件（session, git, usage, files）

packages/ui/
├── kernel-bridge/   # WS 订阅 kernel 事件，暴露 context
└── plugin-renderer/ # 动态渲染插件注册的 UI 面板
```

### 依赖方向

```
builtin-plugins → kernel（通过 plugin-host API）
插件间 → kernel/event-bus（禁止直接导入）
ui/plugin-renderer → kernel-bridge → kernel/event-bus
```

### 优点
- 扩展性最强，Codex/其他 AI 接入变为插件安装
- 架构意图最清晰

### 缺点
- ~1万行项目用微内核属于过度设计
- kernel 包设计需要时间打磨，早期易成 God Kernel
- 调试跨插件事件链路复杂

---

## 三方案对比

| 维度 | 方案 A（分层） | 方案 B（功能域） | 方案 C（微内核） |
|------|-------------|--------------|---------------|
| 迁移成本 | 低（渐进重构） | 中（重组目录） | 高（新建 kernel 包） |
| 插件机制 | 弱 | 中（feature = 插件雏形） | 强（原生支持） |
| 适合当前规模 | ✓ | ✓ | ✗ |
| 适合未来规模 | 中 | 强 | 最强 |
| god component 解决效果 | 好 | 很好 | 很好 |

## 演进路径

**现在 → 方案 A → 6个月后 → 方案 B**

方案 A 的分层结构解决眼前纠缠问题，方案 B 的功能域结构在未来可平滑演变为方案 C 的 plugin-host 模式。
