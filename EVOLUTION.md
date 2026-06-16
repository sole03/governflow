# EVOLUTION.md — mcp-cognition-engine 进化蓝图

> **一份活的架构宣言，而非过时的 README。**
>
> 本文档定义 `mcp-cognition-engine` 从 v1.0.0-alpha 向 AI-Native 代码治理基础设施的
> 战略进化路径。它不与当前代码状态一一对应，而是描摹一条从"精心打造的 MCP 工具"
> 蜕变为"植入代码库的法律意识"的完整轨迹。

---

## 0. 核心定位重塑

```
┌────────────────────────────────────────────────────────┐
│              你构建的不是工具，而是……                  │
│                                                       │
│   植入代码库的 "法律意识"                    │
│                                                       │
│   70% 确定性逻辑内核  +  30% 柔性分发接口              │
│   ──────────────────     ────────────────              │
│   规则 / 状态 / 事件       MCP / CLI / CI / Web        │
│   (协议无关的独立 Library)  (可替换薄适配器)            │
└────────────────────────────────────────────────────────┘
```

MCP 只是触手之一，绝非地基。真正的价值在于 **协议无关的认知中枢**：
一个可以被任何 Agent 运行时消费的独立内核。

这个内核的四大支柱：

| 支柱 | 隐喻 | 外源灵感 | 当前对应 |
|------|------|----------|----------|
| **事件驱动通信** | 神经递质 | lrnev | `MetricEvent` (审计日志) → 待升级为正式事件总线 |
| **COW 内存快照** | 小脑 | Anvil | 缺失 → Phase 2 建设 |
| **声明式约束 DSL** | 前额叶 | @rigour-labs/core | `AstTemplate.templateDsl` + `ConstraintValidator` |
| **MCP/CLI 薄适配器** | 嘴与耳 | — | `src/transport/cli.ts` + `http-server.ts` |

---

## 1. 当前架构评估：我们站在哪里

### 1.1 已有资产 (v1.0.0-alpha.2)

**认知图引擎** (`src/core/`)
- `IntentRecognizer` — 将代码 diff 分类为 REFACTOR / BUGFIX / BOILERPLATE
- `GraphTraverser` — 加权 BFS 遍历认知图，边权重乘数 + 意图偏差 + 抽象层级过滤
- `AstConstraintSolver` — 将 AstTemplate DSL 转化为 AST 级约束验证 + Patch 生成

**治理系统** (`src/governance/`)
- `PolicyEngine` — 策略即代码：按优先级评估工具调用上下文，返回决策
- `RuleImmuneEngine` — 规则免疫四机制：冷启动缓冲(7d) / 自动续期(90d) / 冷存储(30d) / 冲突锁(>10%)
- `ApprovalWorkflowService` — 多阶段审批：ANY / ALL / QUORUM 三策略 + 升级 + Webhook
- `Arbitrator` — 规则冲突检测与仲裁 (keep_a / keep_b / merge / skip)

**数据层** (`src/data/`)
- 12 张 Prisma 表，SQLite 持久化
- `CognitionRepository` — 认知图 CRUD + 双 LRU 缓存 (node/neighbor)
- `VectorStore` — 基于 cosine similarity 的向量搜索 (无 pgvector 依赖)
- `LRUCache` — TTL + 容量驱逐

**适配器** (`src/adapters/`)
- `IEmbeddingService` 接口 + OpenAI / 本地 ONNX 双实现
- Zod Schema 验证 (11 个工具输入 schema)
- `VectorStore` 嵌入预热 (启动时 fire-and-forget)

**传输层** (`src/transport/`)
- Stdio MCP Server → `cli.ts` + `index.ts`
- HTTP Streamable MCP Server → `http-server.ts`
- `GovernanceCore` 门面类 — 聚合所有子系统，供 HTTP 模式使用

**测试** 
- 26 个测试文件，190 个通过 (23 个失败仅因 SQLite 并行文件锁)

### 1.2 结构性瓶颈

| 瓶颈 | 现状 | 影响 |
|------|------|------|
| **紧耦合 MCP** | `transport/index.ts` 是业务逻辑的实际入口 | 内核无法独立发布为 `@sole03/rule-engine-core` |
| **无 COW 沙箱** | 自愈/验证直接操作 Prisma DB | 无快速回滚能力，试错成本高 |
| **无事件总线** | `MetricEvent` 是唯一异步通道 | 组件间通过直接函数调用耦合，扩展性受限 |
| **单例泛滥** | `getPolicyEngine()` / `getVectorStore()` 等全局单例 | DI 困难，测试隔离靠全局 reset |
| **无约束 DSL** | `AstTemplate.templateDsl` 是纯 JSON | 缺少声明式语法糖，人机可读性差 |

---

## 2. 三位一体的工程化落地矩阵

### 2.1 自主进化 (Anvil 路线)

```
发现违规 → 认知图约束求解 → 生成 TransformPatch → COW 快照 → 沙箱内验证
                                                   ↓ 失败
                                              毫秒级 Revert
```

**当前状态**：
- `AstConstraintSolver.generatePatchFromFailures()` 已能生成 `TransformPatch[]`
- `RuleImmuneEngine` 已实现规则生命周期管理

**待建设**：
1. **COW 状态沙箱管理器** (`src/core/sandbox/`)：基于 `structuredClone` + `Map<nodeId, snapshot>` 实现快照
2. **自愈循环控制器**：置信度阈值门控 (≥0.85)、最大循环次数 (≤3)、静默回滚
3. **自愈审计日志**：每次 Patch 尝试记录到 `MetricEvent`，含 `patchHash` + `validationResult`

```typescript
// 目标 API 形态
interface SelfHealResult {
  patches: TransformPatch[];
  applied: number;
  reverted: number;
  score: number;           // 置信度
  reverted: boolean;       // 是否被静默回滚
}
interface SandboxManager {
  snapshot(): string;                  // 返回 snapshotId
  apply(patch: TransformPatch): void;  // 写入沙箱
  validate(): ValidationResult;        // 约束验证
  revert(snapshotId: string): void;    // Revert
}
```

### 2.2 多 Agent 仲裁 (Rigour 路线)

```
Agent A 提案 → 约束求解器 (确定性校验) → 通过 → 进入仲裁
Agent B 提案 → 约束求解器 (确定性校验) → 冲突 → Arbiter 裁决
                                          ↓
                              申诉 → 人工抗辩 → 规则进化
```

**当前状态**：
- `Arbitrator.detectConflict()` 已能检测同 language / type / pattern 下的语义冲突
- `PolicyEngine.evaluate()` 已实现条件评估 + 决策返回
- `ConstraintValidator` 已实现 REJECT (硬块) / WARN (软警告) 双模式

**待建设**：
1. **轻量级约束 DSL**：为 `AstTemplate.templateDsl` 设计声明式语法
2. **契约即代码模板库**：预置跨模块不变量模板 (如 "import 只允许从 src/ 路径")
3. **Blame 追踪**：每个规则关联 `createdBy` + `lastModifiedBy`，形成责任链
4. **申诉抗辩协议**：Agent 可对仲裁结果发起 Appeal，携带反驳证据 (AST 反例)

```
# 目标 DSL 形态
@constraint no-direct-state-mutation
  .language = "typescript"
  .nodeType = "call_expression"
  .pattern  = "setState("
  .scope    = GLOBAL
  .severity = REJECT
  .message  = "Use dispatcher instead of direct setState"
```

### 2.3 杏仁核直觉 (lrnev 路线)

```
Diff > 30 行 → 紧急避险 → 跳过深度 AST 分析 → 走简化决策路径
                                    ↓
                            异步深检 (后台) + 疲劳恢复提示
```

**当前状态**：
- `PolicyEngine` 已能检测 `diff_size > 200` 触发 `require_approval`
- 无背压队列、无优先级调度、无紧急通道

**待建设**：
1. **事件总线** (`src/core/events/`)：类型安全的轻量级 EventBus，替换直接函数调用
2. **优先级背压队列**：HIGH (紧急避险) / NORMAL (认知查询) / LOW (后台嵌入)
3. **动态风险评分模型**：基于 `diffSize` + `nodeTypeChanges` + `filesChanged` 计算风险分
4. **异步深检通道**：高风控操作先占返回，后台持续 AST 分析

```typescript
// 事件总线 API
interface EventBus {
  emit<T>(event: DomainEvent<T>): void;
  on<T>(type: string, handler: EventHandler<T>, priority?: Priority): void;
  drain(): Promise<void>;  // 背压消费
}
// 杏仁核快速通路
if (riskScore > 0.7) {
  eventBus.emit({ type: "amygdala.triggered", payload: { diffSize, riskScore } });
  return { decision: "HALT", reason: "深检排队中，先暂停高风险操作" };
}
```

---

## 3. 破局 MCP 限制的架构原则

### 3.1 内核绝对纯净

```
┌────────────────────────────────────┐
│  @sole03/rule-engine-core          │  ← 独立 npm 包
│  ├── core/     (认知引擎)          │    零 MCP 依赖
│  ├── governance/ (治理引擎)        │    零传输协议依赖
│  ├── data/     (仓库接口)          │    仅依赖 Prisma (可替换)
│  └── events/   (事件总线)          │    纯 TypeScript
├────────────────────────────────────┤
│  @sole03/rule-engine-mcp           │  ← 薄适配器
│  └── transport/ (MCP tools)        │    仅做翻译
├────────────────────────────────────┤
│  @sole03/rule-engine-cli           │  ← 薄适配器
│  └── transport/cli.ts              │
└────────────────────────────────────┘
```

### 3.2 适配器薄如蝉翼

当前 `transport/index.ts` 包含了大量业务逻辑 (policy 评估、模式获取、上下文构建)，
需改造为纯粹的路由层：

```typescript
// 改造后：适配器只做路由，不变业务
server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: args } = req.params;
  // 1. 薄校验
  const input = validateInput(schema, args);
  // 2. 委托内核
  const result = await core.execute({ tool: name, input });
  // 3. 序列化返回
  return formatResponse(result);
});
```

### 3.3 通信事件驱动化

当前同步 RPC 模式：
```
Agent → MCP Server → (同步) → CognitionRepository.findNodesBySemanticHash()
                              → GraphTraverser.traverse()
                              → handleCognitionQuery()
```

改造后事件驱动模式：
```
Agent → MCP Server → EventBus.emit("cognition.query")
                           ↓
                      EventBus.on("cognition.query", priority=LOW)
                      → GraphTraverser.traverse()
                      → EventBus.emit("cognition.result")
                           ↓
                      MCP Server 收到结果 → 返回 Agent
```

### 3.4 试错内存化

当前：`AstConstraintSolver.generatePatchFromFailures()` 生成 Patch → 直接写 DB  
目标：生成 Patch → 写入 COW 沙箱 → 沙箱内验证 → 通过才写 DB

### 3.5 约束声明化

当前约束 DSL (JSON 格式)：
```json
{ "nodeType": "call_expression", "fields": { "function": { "match": "eval" } } }
```

目标声明式 DSL：
```
@constraint ban-eval
  .nodeType = "call_expression"
  .fields.function.match = "eval"
  .severity = REJECT
  .message = "eval() is forbidden — use structured parsing instead"
```

---

## 4. 分阶段路线图

### Phase 1：解耦与事件化 (基于 lrnev)

| 任务 | 文件 | 描述 |
|------|------|------|
| 1.1 抽取 Core 包 | `packages/core/` | 将 `src/core/` + `src/governance/` 移入独立包 |
| 1.2 实现 EventBus | `src/core/events/bus.ts` | 类型安全的轻量级 Pub/Sub |
| 1.3 定义 Domain Events | `src/core/events/domain-events.ts` | `cognition.*`, `governance.*`, `sandbox.*` |
| 1.4 重构 MCP 适配器 | `packages/mcp/` | 薄路由层，移除业务逻辑 |
| 1.5 创建 CLI 适配器 | `packages/cli/` | 复用 Core，验证一次编写多端运行 |
| 1.6 DI 容器 | `src/core/di.ts` | 替换全局单例，容器化注入 |

**成功标准**：`npm install @sole03/rule-engine-core` → 独立运行，不依赖 MCP SDK

### Phase 2：自愈沙箱化 (基于 Anvil)

| 任务 | 文件 | 描述 |
|------|------|------|
| 2.1 COW 沙箱管理器 | `src/core/sandbox/cow-sandbox.ts` | `structuredClone` 快照 + revert |
| 2.2 自愈循环控制器 | `src/core/sandbox/self-heal-loop.ts` | 置信度门控 + 循环上限 + 回滚 |
| 2.3 沙箱验证器 | `src/core/sandbox/sandbox-validator.ts` | 在沙箱中运行约束求解 |
| 2.4 自愈审计 | 扩展 `MetricEvent` | `self_heal_attempt` / `self_heal_revert` |

**成功标准**：生成错误 Patch → 沙箱内检测失败 → 毫秒级回滚 → 零 DB 污染

### Phase 3：仲裁确定化 (基于 @rigour-labs/core)

| 任务 | 文件 | 描述 |
|------|------|------|
| 3.1 约束 DSL 编译器 | `src/core/constraints/dsl-compiler.ts` | 声明式语法 → AstTemplate |
| 3.2 模板库 | `src/core/constraints/templates/` | 预置跨模块不变量 |
| 3.3 多 Agent 仲裁器升级 | `src/governance/arbitrator.ts` | 约束求解 + Blame + 申诉 |
| 3.4 契约即代码运行时 | `src/core/constraints/runtime.ts` | 机器可证明的轻量级约束执行 |

**成功标准**：两个 Agent 产生同位置冲突 Patch → 确定性仲裁 → 可选人工抗辩

### Phase 4：认知可视化

| 任务 | 描述 |
|------|------|
| 4.1 认知仪表盘 | 杏仁核触发率 / 自愈成功率 / 仲裁争议率 |
| 4.2 图可视化 | 认知图节点 + 边权重的实时拓扑视图 |
| 4.3 审计路径 | 任意规则/提案的完整溯源链 |

---

## 5. 包结构规划

```
mcp-cognition-engine/
├── packages/
│   ├── core/                          ← @sole03/rule-engine-core
│   │   ├── src/
│   │   │   ├── cognition/             (IntentRec, GraphTraverser, AstSolver)
│   │   │   ├── governance/            (PolicyEngine, Arbiter, Immune, Approval)
│   │   │   ├── data/                  (Repository 接口 + SQLite 实现)
│   │   │   ├── sandbox/               (COW 快照 + 自愈循环)
│   │   │   ├── constraints/           (DSL 编译器 + 模板库 + 运行时)
│   │   │   ├── events/                (EventBus + Domain Events)
│   │   │   └── di.ts                  (依赖注入容器)
│   │   └── package.json               (零 MCP 依赖)
│   ├── mcp/                           ← @sole03/rule-engine-mcp
│   │   ├── src/                       (transport/ 全部 MCP handler)
│   │   └── package.json               (仅 MCP SDK + core)
│   ├── cli/                           ← @sole03/rule-engine-cli
│   │   └── src/cli.ts                 (独立 CLI 入口)
│   └── dashboard/                     (可选 Web 仪表盘)
├── tests/
├── benchmarks/
├── prisma/
└── EVOLUTION.md                       ← 你正在读的这份文档
```

---

## 6. 当前代码到目标的迁移映射

| 当前文件 | Phase | 目标位置 |
|----------|-------|----------|
| `src/transport/index.ts` | Phase 1 | `packages/mcp/src/index.ts` (薄路由) |
| `src/transport/mcp/*.ts` | Phase 1 | `packages/mcp/src/tools/*.ts` |
| `src/core/*.ts` | Phase 1 | `packages/core/src/cognition/*.ts` |
| `src/governance/*.ts` | Phase 1 | `packages/core/src/governance/*.ts` |
| `src/data/*.ts` | Phase 1 | `packages/core/src/data/*.ts` |
| `src/adapters/schemas.ts` | Phase 1 | `packages/core/src/validation/` |
| `src/adapters/embedding/*.ts` | Phase 1 | `packages/core/src/embedding/` |
| — | Phase 1 | `packages/core/src/events/bus.ts` (新建) |
| — | Phase 2 | `packages/core/src/sandbox/cow-sandbox.ts` (新建) |
| — | Phase 3 | `packages/core/src/constraints/dsl-compiler.ts` (新建) |
| `src/governance/default-policies.ts` | Phase 3 | `packages/core/src/constraints/templates/` |
| `src/governance/arbitrator.ts` | Phase 3 | 扩展为多 Agent 仲裁器 |
| `src/data/cognition-repository.ts` | Phase 4 | 添加拓扑可视化 API |

---

## 7. 设计原则复述

> **MCP 是嘴耳，Anvil 是小脑，Rigour 是前额叶，lrnev 是神经递质。**

- **内核绝对纯净**：认知核心是零外部协议依赖的独立 Library
- **适配器薄如蝉翼**：MCP / CLI / CI 仅是翻译层，不含任何业务逻辑
- **通信事件驱动化**：类型安全的事件总线替代同步 RPC，天然支持优先级与背压
- **试错内存化**：Patch 验证在 COW 沙箱中完成，避免频繁 I/O
- **约束声明化**：模糊规则 → 机器可证明的约束 → LLM 生成 Patch 前的确定性守门员

---

## 8. 版本对齐

| 版本 | 阶段 | 标志 |
|------|------|------|
| `v1.0.0-alpha.2` | 当前 | 单包 MCP Server，功能完整，测试 190 通过 |
| `v1.0.0-beta` | Phase 1 完成 | 三包架构，Core 独立发布 |
| `v1.1.0` | Phase 2 完成 | COW 沙箱 + 自愈循环上线 |
| `v1.2.0` | Phase 3 完成 | 声明式约束 DSL + 多 Agent 仲裁 |
| `v2.0.0` | Phase 4 完成 | 认知可视化仪表盘 + 完整 AI-Native 治理栈 |
