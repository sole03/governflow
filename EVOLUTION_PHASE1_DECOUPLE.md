# EVOLUTION_PHASE1_DECOUPLE.md — 解耦与事件化

> **目标**：将 `mcp-cognition-engine` 从"嵌在 MCP 里的黑箱"重构为
> "协议无关的内核 + 薄适配器"架构，使认知引擎可被任意 Agent 运行时消费。

---

## 1. 问题诊断

### 1.1 当前耦合图

```
┌─────────────────────────────────────────────────────────┐
│  src/transport/index.ts  (235 lines)                    │
│  ┌───────────────────────────────────────────────────┐  │
│  │  Server + StdioServerTransport (MCP SDK)           │  │
│  │  ├── Tool 注册 (analyze_workspace, capture_diff...)│  │
│  │  ├── Policy 评估 (getPolicyEngine → evaluate)      │  │
│  │  ├── Schema 校验 (validateInput)                   │  │
│  │  ├── 模式获取 (getMode → AppConfig)               │  │
│  │  ├── 向量预热 (getVectorStore → embedUnembedded)   │  │
│  │  ├── 策略加载 (loadPolicies → DEFAULT_POLICIES)    │  │
│  │  └── 工具分发 (dispatchTool → 12个 case)          │  │
│  └───────────────────────────────────────────────────┘  │
├─────────────────────────────────────────────────────────┤
│  src/transport/http-server.ts  (238 lines)              │
│  ┌───────────────────────────────────────────────────┐  │
│  │  Server + StreamableHTTPServerTransport             │  │
│  │  ├── 同样全套逻辑 (Tool 注册 + Policy + Schema...) │  │
│  │  ├── GovernanceCore 门面                            │  │
│  │  └── 额外 Tool: workflow_submit/vote/status/escalate│  │
│  └───────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

**问题**：两个 transport 入口各自复制了全套启动逻辑。添加新传输协议 (如 CI Hook、
WebSocket、gRPC) 意味着第三次复制。这不是架构问题，而是建筑缺陷。

### 1.2 具体耦合点清单

| 文件 | 耦合项 | 严重度 |
|------|--------|--------|
| `transport/index.ts:45` | `process.env.DATABASE_URL` | 中 — 环境变量硬编码在入口 |
| `transport/index.ts:60-65` | `new RuleRepo()` 等 4 个 repo 实例化 | 高 — 无 DI |
| `transport/index.ts:77-93` | `buildPolicyContext()` | 中 — 业务逻辑在传输层 |
| `transport/index.ts:100-140` | Resources handler 包含 cognition stats 查询 | 中 — API 定义与实现混合 |
| `transport/index.ts:142-225` | Tools handler 包含策略拦截、模式判断、审计日志 | 高 — 核心流程耦合 |
| `transport/http-server.ts:47-60` | 相同 repo 实例化 | 高 — 代码复制 |
| `transport/http-server.ts:62` | `new GovernanceCore()` | 低 — 门面模式，可接受 |
| `data/cognition-repository.ts:118` | `getPrismaClient()` 直接调用 | 中 — 仓库与 Prisma 紧耦合 |
| `governance/policy-engine.ts:122` | 全局单例 `defaultEngine` | 中 — 阻碍测试隔离 |
| `governance/approval-workflow.ts:29` | `getPrismaClient()` 构造器默认值 | 中 — 可选注入但默认耦合 |
| `adapters/embedding/vector-store.ts:151` | 全局单例 `defaultStore` | 中 — 同上 |
| `adapters/embedding/openai-adapter.ts` | `getEmbeddingService()` 单例 | 中 — 同上 |

---

## 2. 目标架构

```
┌──────────────────────────────────────────────────┐
│              @sole03/rule-engine-core             │  ← 独立 npm 包
│                                                  │
│  src/core/         (IntentRec, GraphTraverser,   │
│                     AstSolver, ConstraintVal)     │
│  src/governance/   (PolicyEngine, Arbiter,       │
│                     ImmuneEngine, ApprovalWorkflow)│
│  src/data/         (Repository 接口 + Prisma 实现)│
│  src/sandbox/      (COW 快照 — Phase 2)          │
│  src/constraints/  (DSL 编译器 — Phase 3)        │
│  src/events/       (EventBus + Domain Events)     │  ← Phase 1 新建
│  src/di.ts         (依赖注入容器)                 │  ← Phase 1 新建
│                                                  │
│  依赖: @prisma/client, zod, pino                 │
│  不依赖: @modelcontextprotocol/sdk               │
└──────────────┬───────────────────────────────────┘
               │
   ┌───────────┼───────────┐
   │           │           │
   ▼           ▼           ▼
┌──────┐ ┌──────┐ ┌───────┐
│ MCP  │ │ CLI  │ │ CI    │  ← 薄适配器，每个 ~50 行
│Adapter│ │Adapter│ │Hook   │
└──────┘ └──────┘ └───────┘
```

MCP 适配器变为纯粹的路由层：

```typescript
// 改造后: packages/mcp/src/index.ts (~60 行)
import { CognitionCore, createContainer } from "@sole03/rule-engine-core";

const core = new CognitionCore(createContainer());
core.start();  // 策略加载 + DB连接 + 向量预热

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: args } = req.params;
  const result = await core.execute({ tool: name, input: args });
  return { content: [{ type: "text", text: JSON.stringify(result) }] };
});
```

---

## 3. 事件总线设计

### 3.1 为什么需要事件总线

当前组件间通过直接函数调用通信：

```
handleCognitionQuery()
  → new CognitionRepository()
  → new GraphTraverser(repo)
  → traverser.traverse(...)
  → repo.recordFeedbackEvent(...)  // 顺便记个日志
```

问题：
- 调用链固定，无法插拔中间件
- `cognition_tools.ts` 里多次 `new CognitionRepository()` — 没有实例复用
- 无法做优先级调度（杏仁核紧急信号 vs 普通认知查询）
- 无法做背压控制（大量并发遍历时无排队）

### 3.2 领域事件定义

```typescript
// src/core/events/domain-events.ts

// ── 认知域事件 ──
export interface CognitionQueryRequested {
  type: "cognition.query.requested";
  payload: {
    contextHash: string;
    intentHint?: "REFACTOR" | "BUGFIX" | "BOILERPLATE";
    maxDepth?: number;
    replyTo: string;  // MCP requestId or correlationId
  };
}

export interface CognitionQueryCompleted {
  type: "cognition.query.completed";
  payload: {
    correlationId: string;
    nodes: { id: string; type: string; abstractionLevel: number; relevanceScore: number }[];
    durationMs: number;
    truncated: boolean;
  };
}

export interface CognitionFeedbackRecorded {
  type: "cognition.feedback.recorded";
  payload: {
    nodeId: string;
    edgeId?: string;
    outcome: "ACCEPTED" | "REJECTED" | "MODIFIED";
    weightDelta: number;
  };
}

// ── 治理域事件 ──
export interface PolicyEvaluated {
  type: "governance.policy.evaluated";
  payload: {
    toolName: string;
    allowed: boolean;
    requiresApproval: boolean;
    matchedPolicyIds: string[];
    warnings: string[];
  };
}

export interface ProposalStatusChanged {
  type: "governance.proposal.status_changed";
  payload: {
    proposalId: string;
    from: string;
    to: "APPROVED" | "REJECTED" | "EXPIRED" | "OVERRIDDEN";
    at: string; // ISO timestamp
  };
}

export interface ImmuneCycleCompleted {
  type: "governance.immune.cycle_completed";
  payload: {
    coldStartImmune: number;
    autoRenewed: number;
    archived: number;
    revived: number;
    conflictLocked: boolean;
  };
}

// ── 杏仁核域事件 (Phase 2 使用) ──
export interface AmygdalaTriggered {
  type: "amygdala.triggered";
  payload: {
    diffSize: number;
    riskScore: number;
    reason: string;
  };
}

export type DomainEvent =
  | CognitionQueryRequested
  | CognitionQueryCompleted
  | CognitionFeedbackRecorded
  | PolicyEvaluated
  | ProposalStatusChanged
  | ImmuneCycleCompleted
  | AmygdalaTriggered;
```

### 3.3 EventBus 实现

```typescript
// src/core/events/bus.ts

export type Priority = "HIGH" | "NORMAL" | "LOW";
export type EventHandler<T> = (event: T) => void | Promise<void>;

interface QueueEntry<T> {
  event: T;
  priority: Priority;
  timestamp: number;
}

export class EventBus {
  private handlers = new Map<string, { handler: EventHandler<any>; priority: Priority }[]>();
  private highQueue: QueueEntry<any>[] = [];
  private normalQueue: QueueEntry<any>[] = [];
  private lowQueue: QueueEntry<any>[] = [];
  private processing = false;

  /**
   * 注册事件处理器
   * HIGH 优先级的 handler 会被先调用
   */
  on<T>(type: string, handler: EventHandler<T>, priority: Priority = "NORMAL"): void {
    const list = this.handlers.get(type) ?? [];
    list.push({ handler, priority });
    list.sort((a, b) => priorityOrder(b.priority) - priorityOrder(a.priority));
    this.handlers.set(type, list);
  }

  /**
   * 发布事件。默认放入优先级队列异步处理。
   * immediate=true 时同步执行 (用于必须立刻拿到结果的场景)。
   */
  emit<T extends { type: string }>(event: T, immediate = false): void {
    if (immediate) {
      this.invokeHandlers(event);
      return;
    }
    const entry: QueueEntry<T> = { event, priority: this.inferPriority(event), timestamp: Date.now() };
    this.enqueue(entry);
    this.drain();
  }

  /**
   * 背压消费：按优先级处理队列
   */
  async drain(): Promise<void> {
    if (this.processing) return;
    this.processing = true;
    try {
      while (this.highQueue.length > 0 || this.normalQueue.length > 0 || this.lowQueue.length > 0) {
        const entry = this.highQueue.shift()
          ?? this.normalQueue.shift()
          ?? this.lowQueue.shift();
        if (entry) {
          await this.invokeHandlers(entry.event);
        }
      }
    } finally {
      this.processing = false;
    }
  }

  /** 获取队列统计 */
  stats(): { high: number; normal: number; low: number; handlers: number } {
    return {
      high: this.highQueue.length,
      normal: this.normalQueue.length,
      low: this.lowQueue.length,
      handlers: [...this.handlers.values()].reduce((s, v) => s + v.length, 0),
    };
  }

  // ── Private ──

  private async invokeHandlers<T>(event: T): Promise<void> {
    const type = (event as any).type;
    const list = this.handlers.get(type);
    if (!list?.length) return;
    for (const { handler } of list) {
      try { await handler(event); } catch { /* 单个 handler 失败不影响其他 */ }
    }
  }

  private enqueue<T>(entry: QueueEntry<T>): void {
    switch (entry.priority) {
      case "HIGH": this.highQueue.push(entry); break;
      case "LOW": this.lowQueue.push(entry); break;
      default: this.normalQueue.push(entry);
    }
  }

  private inferPriority(event: DomainEvent): Priority {
    if (event.type.startsWith("amygdala")) return "HIGH";
    if (event.type.startsWith("governance.proposal")) return "HIGH";
    if (event.type.includes("feedback")) return "LOW";
    return "NORMAL";
  }
}

function priorityOrder(p: Priority): number {
  return p === "HIGH" ? 3 : p === "NORMAL" ? 2 : 1;
}
```

### 3.4 事件订阅示例

```typescript
// 治理层订阅认知查询事件，自动触发策略评估
bus.on("cognition.query.requested", async (event) => {
  const policyResult = policyEngine.evaluate({
    toolName: "cognition_query",
    contentHash: event.payload.contextHash,
  });
  bus.emit({
    type: "governance.policy.evaluated",
    payload: {
      toolName: "cognition_query",
      allowed: policyResult.allowed,
      requiresApproval: policyResult.requiresApproval,
      matchedPolicyIds: policyResult.matchedPolicies.map(p => p.policyId),
      warnings: policyResult.warnings,
    },
  });
}, "HIGH");

// 遥测层订阅治理决策，异步记录审计日志
bus.on("governance.policy.evaluated", async (event) => {
  await metricRepo.track("policy_evaluated", event.payload);
}, "LOW");
```

---

## 4. 依赖注入容器

### 4.1 当前单例问题

```typescript
// src/transport/index.ts:60-63 — 每次启动都要手动 new
const ruleRepo: IRuleRepository = new RuleRepo();
const diffLogRepo: IDiffLogRepository = new DiffLogRepo();
const metricRepo: IMetricRepository = new MetricRepo();
const conflictRepo: IConflictRepository = new ConflictRepo(ruleRepo);

// src/transport/mcp/cognition-tools.ts:75 — 每次调用都 new
const repo = new CognitionRepository();

// src/governance/policy-engine.ts:122 — 全局单例
let defaultEngine: PolicyEngine | null = null;
export function getPolicyEngine(): PolicyEngine { ... }
```

### 4.2 目标 DI 容器

```typescript
// src/core/di.ts

import type { ICognitionRepository } from "../data/repository-interfaces.js";
import type { IRuleRepository, IDiffLogRepository, IConflictRepository, IMetricRepository } from "../data/repository-interfaces.js";

export interface Container {
  cognitionRepo: ICognitionRepository;
  ruleRepo: IRuleRepository;
  diffLogRepo: IDiffLogRepository;
  conflictRepo: IConflictRepository;
  metricRepo: IMetricRepository;
  eventBus: EventBus;
  policyEngine: PolicyEngine;
  immuneEngine: RuleImmuneEngine;
  workflowService: ApprovalWorkflowService;
  vectorStore: VectorStore;
  embeddingService: IEmbeddingService;
}

/**
 * 默认容器 — 用于生产环境 (SQLite + Prisma)
 */
export function createContainer(overrides?: Partial<Container>): Container {
  const eventBus = overrides?.eventBus ?? new EventBus();
  const policyEngine = overrides?.policyEngine ?? new PolicyEngine(DEFAULT_POLICIES);
  const ruleRepo = overrides?.ruleRepo ?? new RuleRepo();
  const cognitionRepo = overrides?.cognitionRepo ?? new CognitionRepository();

  return {
    cognitionRepo,
    ruleRepo,
    diffLogRepo: overrides?.diffLogRepo ?? new DiffLogRepo(),
    conflictRepo: overrides?.conflictRepo ?? new ConflictRepo(ruleRepo),
    metricRepo: overrides?.metricRepo ?? new MetricRepo(),
    eventBus,
    policyEngine,
    immuneEngine: overrides?.immuneEngine ?? new RuleImmuneEngine(),
    workflowService: overrides?.workflowService ?? new ApprovalWorkflowService(),
    vectorStore: overrides?.vectorStore ?? new VectorStore(),
    embeddingService: overrides?.embeddingService ?? getEmbeddingService(),
  };
}

/**
 * 测试容器 — 用于单元测试 (内存实现)
 */
export function createTestContainer(): Container {
  return createContainer({
    // 可替换为 mock/memory 实现
  });
}
```

### 4.3 容器消费

```typescript
// src/core/cognition-core.ts — 内核主类，所有入口共享同一实例
export class CognitionCore {
  constructor(private c: Container) {}

  async start(): Promise<void> {
    this.c.eventBus.on("cognition.query.requested", this.handleQuery.bind(this), "NORMAL");
    this.c.eventBus.on("cognition.feedback.recorded", this.handleFeedback.bind(this), "LOW");
    // 预热 embeddings
    this.c.vectorStore.embedUnembeddedNodes(20).catch(() => {});
  }

  async execute(req: { tool: string; input: Record<string, unknown> }): Promise<unknown> {
    // 策略评估
    const policyResult = this.c.policyEngine.evaluate({
      toolName: req.tool,
      filePath: req.input.filePath as string,
      language: req.input.language as string,
      contentHash: req.input.contextHash as string,
    });
    if (!policyResult.allowed) {
      return { error: "Blocked by policy", warnings: policyResult.warnings };
    }
    // 路由到具体 handler
    return this.dispatch(req.tool, req.input);
  }
}
```

---

## 5. 迁移步骤

### Step 1: 抽取内核包 (不破坏现有代码)

```
mcp-cognition-engine/
├── packages/
│   └── core/
│       ├── package.json          ← { "name": "@sole03/rule-engine-core" }
│       ├── tsconfig.json
│       └── src/
│           ├── events/           ← 新建: EventBus + Domain Events
│           ├── di.ts             ← 新建: Container + createContainer
│           └── cognition-core.ts ← 新建: CognitionCore 主类
├── src/                          ← 现有代码不变，逐步迁移
└── ...
```

### Step 2: 在现有代码中引入 EventBus (不删旧代码)

```typescript
// src/transport/index.ts 增量修改：
import { EventBus, createContainer } from "../../packages/core/src/index.js";

const container = createContainer();
// 用 eventBus 替代直接调用，但保留原有 handler 作为 fallback
```

### Step 3: 逐个 handler 迁移

| 当前 handler | 迁移方式 |
|-------------|---------|
| `handleCognitionQuery` | 变为 `CognitionCore.handleQuery` + EventBus |
| `handleCognitionValidate` | 变为 `CognitionCore.handleValidate` |
| `handleCognitionFeedback` | 变为事件驱动：emit → handler → repo |
| `handleApproveInjection` | 保留但移除 `getPrismaClient` 直接调用 → 注入 |
| `handleCaptureDiff` | 同上 |
| `handleAnalyzeWorkspace` | 同上 |

### Step 4: 创建 CLI 适配器 (验证"一次编写多端运行")

```typescript
// packages/cli/src/cli.ts (~40 行)
import { CognitionCore, createContainer } from "@sole03/rule-engine-core";

const core = new CognitionCore(createContainer());
await core.start();

// 读取 stdin → execute → 输出 stdout
const input = JSON.parse(await readStdin());
const result = await core.execute(input);
process.stdout.write(JSON.stringify(result));
```

### Step 5: 发布与清理

- `npm publish packages/core` → `@sole03/rule-engine-core@0.1.0`
- 删除旧单例 (`getPolicyEngine`, `getVectorStore`, `resetXxx`)
- 删除 `src/transport/` 中的业务逻辑，仅保留 MCP 协议适配

---

## 6. 成功标准

- [ ] `npm install @sole03/rule-engine-core` 不依赖 `@modelcontextprotocol/sdk`
- [ ] `import { CognitionCore, createContainer } from "@sole03/rule-engine-core"` 可在任何 Node.js 项目中使用
- [ ] MCP 适配器 ≤ 80 行（仅路由 + 序列化）
- [ ] CLI 适配器 ≤ 50 行
- [ ] 现有 190 个测试全部通过（核心逻辑不变）
- [ ] 新增 EventBus 单元测试 ≥ 10 个
- [ ] 新增 DI 容器测试 ≥ 5 个

---

## 7. 风险与缓解

| 风险 | 缓解 |
|------|------|
| 事件驱动引入异步时序问题 | 关键路径保留 `immediate=true` 同步模式 |
| Prisma 实例数膨胀 | 容器单例管理，每个进程只有一个 PrismaClient |
| MCP 工具返回格式变化 | 适配器层保证向后兼容 |
| 测试数据库并发锁 | container 支持注入 mock repo |
