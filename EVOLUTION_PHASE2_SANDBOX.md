# EVOLUTION_PHASE2_SANDBOX.md — 自愈沙箱化

> **目标**：实现"试错内存化"——Patch 生成后在 COW 内存沙箱中验证，失败毫秒级回滚，
> 只有通过验证的 Patch 才写入持久化存储。借鉴 Anvil 的 COW 快照理念。

---

## 1. 问题诊断

### 1.1 当前自愈路径

```
AstConstraintSolver.generatePatchFromFailures(failures, ast)
  → TransformPatch[]  (REPLACE | INSERT | DELETE 操作)
  → 直接应用到代码 / 写入 DB
  → 如果 Patch 错误 → 只能事后回滚（如果有的话）
```

**问题**：
- `generatePatchFromFailures` 在 `src/core/ast-constraint-solver.ts:285-323` 只生成 Patch 描述，
  不执行也不验证
- 没有"先试再写"机制
- 如果 LLM 生成的 Patch 引入了新的约束违规 → 无检测 → 可能造成级联错误

### 1.2 相关已有资产

| 文件 | 模块 | 能做什么 | 还缺什么 |
|------|------|----------|----------|
| `ast-constraint-solver.ts:285` | `generatePatchFromFailures` | 从 ValidationFailure[] 生成 TransformPatch[] | 不执行 Patch，不验证结果 |
| `ast-constraint-solver.ts:308` | `solveConstraints` | 完整流水线：DSL→AST→绑定→验证→Patch | 结果直接返回，不写沙箱 |
| `constraint-validator.ts:48` | `validateCode` | 对代码内容运行约束检查 | 只能检测，不能修复 |
| `rule-immune.ts` | `RuleImmuneEngine` | 自愈免疫（冷启动/续期/冷存储/冲突锁） | 规则级免疫，非 Patch 级 |
| `governance-core.ts` | `GovernanceCore` | 聚合所有子系统 | 无沙箱子系统 |

---

## 2. 目标架构

```
LLM / Agent 生成 Patch
        │
        ▼
┌───────────────────────────────┐
│  SelfHealController           │  ← 控制器
│  ┌─────────────────────────┐  │
│  │ 1. 置信度门控            │  │  ← AstConstraintSolver 提供的 score
│  │    score < 0.7 → 拒绝    │  │
│  │    score < 0.85 → WARN   │  │
│  │    score ≥ 0.85 → 执行   │  │
│  ├─────────────────────────┤  │
│  │ 2. COW 沙箱快照          │  │  ← SandboxManager.snapshot()
│  │    structuredClone(code) │  │
│  ├─────────────────────────┤  │
│  │ 3. 应用 Patch            │  │  ← SandboxManager.apply()
│  ├─────────────────────────┤  │
│  │ 4. 沙箱内验证            │  │  ← SandboxManager.validate()
│  │    solveConstraints()    │  │
│  ├─────────────────────────┤  │
│  │ 5. 决策                  │  │
│  │    通过 → 写入 DB        │  │
│  │    失败 → COW revert     │  │  ← SandboxManager.revert()
│  │           重试(≤3)       │  │
│  └─────────────────────────┘  │
└───────────────────────────────┘
```

### 2.1 为什么不直接写 DB 再回滚

| 直接写 DB | COW 沙箱 |
|-----------|---------|
| 每次回滚 = SQL UPDATE + 可能触发级联 | 丢一个 JS 对象引用 |
| 回滚时间 ~10ms (SQLite) | 回滚时间 ~0.1ms (内存) |
| 会留下审计噪音 (delete+insert) | 只在最终 apply 时留一条审计记录 |
| 并发安全需要事务管理 | 单线程内存操作，天然并发安全 |

---

## 3. 实现设计

### 3.1 COW 沙箱管理器

```typescript
// src/core/sandbox/cow-sandbox.ts

import { parseToAST } from "../../analysis/parsers.js";
import type { ASTNode } from "../types.js";
import type { TransformPatch, TransformOp, ValidationResult } from "../cognition-types.js";

interface SandboxState {
  content: string;
  ast: ASTNode;
  snapshotId: string;
}

/**
 * COW (Copy-on-Write) 内存沙箱。
 * 对代码内容的每次修改都在 snapshot → modify → validate → revert/commit 循环中进行。
 * 不涉及任何 I/O 或 DB 操作。
 */
export class CowSandbox {
  private state: SandboxState | null = null;
  private snapshots = new Map<string, SandboxState>();

  // ── 快照管理 ──

  /**
   * 从代码内容创建沙箱状态。
   * 调用 AST 解析器，缓存结果避免重复解析。
   */
  async load(codeContent: string, language: string): Promise<string> {
    const { ast } = await parseToAST(codeContent, language);
    const snapshotId = this.generateSnapshotId();
    this.state = { content: codeContent, ast, snapshotId };
    this.snapshots.set(snapshotId, { content: codeContent, ast: structuredClone(ast), snapshotId });
    return snapshotId;
  }

  /**
   * 创建当前状态的快照，支持嵌套（Patch → 验证失败 → 回滚 → 重试）。
   */
  snapshot(): string {
    if (!this.state) throw new Error("Sandbox not loaded. Call load() first.");
    const snapshotId = this.generateSnapshotId();
    this.snapshots.set(snapshotId, {
      content: this.state.content,
      ast: structuredClone(this.state.ast),
      snapshotId,
    });
    return snapshotId;
  }

  /**
   * 回滚到指定快照。
   */
  revert(snapshotId: string): void {
    const saved = this.snapshots.get(snapshotId);
    if (!saved) throw new Error(`Snapshot not found: ${snapshotId}`);
    this.state = { ...saved, ast: structuredClone(saved.ast) };
    // 清理中间快照
    for (const [id] of this.snapshots) {
      if (id !== snapshotId) this.snapshots.delete(id);
    }
  }

  // ── Patch 应用 ──

  /**
   * 在沙箱中应用一个 TransformPatch。
   * 纯内存操作，不写磁盘、不写 DB。
   */
  apply(patch: TransformPatch): void {
    if (!this.state) throw new Error("Sandbox not loaded");

    let content = this.state.content;
    const lines = content.split("\n");

    for (const op of patch.operations) {
      switch (op.type) {
        case "REPLACE": {
          const oldText = op.originalText ?? "";
          const newText = op.value ?? "";
          content = content.replace(oldText, newText);
          break;
        }
        case "INSERT": {
          // 简单实现：在末尾追加。生产级需根据 path 定位。
          const value = op.value ?? "";
          content += "\n" + value;
          break;
        }
        case "DELETE": {
          const target = op.originalText ?? "";
          content = content.replace(target, "");
          break;
        }
      }
    }

    // 更新沙箱状态（COW：引用新 content 字符串）
    this.state.content = content;
    // AST 延迟重新解析（仅在 validate 时触发）
    this.state.ast = null as any; // invalidate
  }

  /**
   * 在沙箱中批量应用多个 Patch。
   * 返回成功/失败计数。
   */
  applyBatch(patches: TransformPatch[]): { applied: number; reverted: number } {
    const sid = this.snapshot();
    let applied = 0;

    for (const patch of patches) {
      try {
        this.apply(patch);
        applied++;
      } catch {
        this.revert(sid);
        return { applied: 0, reverted: patches.length };
      }
    }

    return { applied, reverted: 0 };
  }

  // ── 沙箱内验证 ──

  /**
   * 获取当前沙箱状态的代码内容。
   */
  getContent(): string {
    if (!this.state) throw new Error("Sandbox not loaded");
    return this.state.content;
  }

  /**
   * 获取当前沙箱状态（快照 ID + 代码内容）。
   * 供外部验证器（AstConstraintSolver）使用。
   */
  getState(): { snapshotId: string; content: string } {
    if (!this.state) throw new Error("Sandbox not loaded");
    return { snapshotId: this.state.snapshotId, content: this.state.content };
  }

  // ── Private ──

  private generateSnapshotId(): string {
    return `sandbox_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }
}
```

### 3.2 自愈循环控制器

```typescript
// src/core/sandbox/self-heal-loop.ts

import { CowSandbox } from "./cow-sandbox.js";
import { EventBus } from "../events/bus.js";
import { solveConstraints } from "../ast-constraint-solver.js";
import { CognitionRepository } from "../../data/cognition-repository.js";
import type { TransformPatch, ValidationResult } from "../cognition-types.js";
import type { CognitionNodeData } from "../../data/cognition-types.js";

export interface SelfHealConfig {
  minConfidence: number;       // 最低置信度，默认 0.7
  autoApplyThreshold: number;  // 自动应用阈值，默认 0.85
  maxRetries: number;          // 最大重试次数，默认 3
  maxDurationMs: number;       // 最大耗时，默认 5000
  language: string;            // 代码语言
  projectId?: string;          // 项目 ID
}

export interface SelfHealResult {
  /** 原始约束节点 */
  sourceNodes: string[];
  /** 原始验证失败 */
  originalFailures: number;
  /** 生成的 Patch 数量 */
  patchesGenerated: number;
  /** 成功应用的 Patch */
  patchesApplied: number;
  /** 回滚的 Patch */
  patchesReverted: number;
  /** 最终验证结果 */
  finalValidation: { passed: boolean; remainingFailures: number };
  /** 闭环状态 */
  status: "HEALED" | "PARTIAL" | "FAILED" | "SKIPPED";
  /** 耗时 */
  durationMs: number;
  /** 置信度 */
  confidence: number;
}

export class SelfHealController {
  constructor(
    private sandbox: CowSandbox,
    private eventBus: EventBus,
    private repo: CognitionRepository,
  ) {}

  /**
   * 执行自愈循环：
   *   1. 置信度门控
   *   2. COW 快照
   *   3. 应用 Patch
   *   4. 沙箱验证
   *   5. 决策：apply / retry / reject
   */
  async heal(
    codeContent: string,
    cognitionNodes: CognitionNodeData[],
    config: SelfHealConfig,
    /** 调用方传入的 Patch（如 LLM 生成）或由 AstConstraintSolver 自动生成 */
    externalPatches?: TransformPatch[],
  ): Promise<SelfHealResult> {
    const startTime = Date.now();
    const sourceNodes = cognitionNodes.map(n => n.id);

    // 1. 加载沙箱
    await this.sandbox.load(codeContent, config.language);

    // 2. 运行约束求解，获取 baseline
    const baseline = await solveConstraints(cognitionNodes, codeContent, config.language);
    const originalFailures = baseline.validations.reduce((s, v) => s + v.failures.length, 0);

    if (originalFailures === 0) {
      return this.result(sourceNodes, 0, 0, 0, { passed: true, remainingFailures: 0 }, "SKIPPED", startTime, 1.0);
    }

    // 3. 使用外部 Patch 或自动生成
    const patches = externalPatches ?? baseline.patches;

    // 4. 置信度门控
    // AstConstraintSolver 目前不返回置信度。使用启发式：
    //   - 约束匹配度高 → 置信度高
    //   - originalFailures 少 → 更确定
    const confidence = Math.max(0.5, Math.min(0.95, 1 - originalFailures * 0.1));

    if (confidence < config.minConfidence) {
      this.eventBus.emit({
        type: "amygdala.triggered",
        payload: { diffSize: originalFailures, riskScore: 1 - confidence, reason: "自我修复置信度过低" },
      });
      return this.result(sourceNodes, originalFailures, patches.length, 0,
        { passed: false, remainingFailures: originalFailures }, "SKIPPED", startTime, confidence);
    }

    // 5. 自愈循环
    let retries = 0;
    let applied = 0;
    let reverted = 0;

    while (retries < config.maxRetries && (Date.now() - startTime) < config.maxDurationMs) {
      const sid = this.sandbox.snapshot();

      // 5a. 应用 Patch
      const batch = this.sandbox.applyBatch(patches);
      applied = batch.applied;
      reverted = batch.reverted;

      if (batch.applied === 0) {
        retries++;
        continue;
      }

      // 5b. 沙箱内重新验证
      const newContent = this.sandbox.getContent();
      const recheck = await solveConstraints(cognitionNodes, newContent, config.language);
      const remaining = recheck.validations.reduce((s, v) => s + v.failures.length, 0);

      // 5c. 决策
      if (remaining === 0) {
        // 全部修复 → 成功
        return this.result(sourceNodes, originalFailures, applied, reverted,
          { passed: true, remainingFailures: 0 }, "HEALED", startTime, confidence);
      }

      if (remaining < originalFailures) {
        // 部分修复 + 置信度足够 → 接受部分结果
        if (confidence >= config.autoApplyThreshold) {
          return this.result(sourceNodes, originalFailures, applied, reverted,
            { passed: false, remainingFailures: remaining }, "PARTIAL", startTime, confidence);
        }
      }

      // 5d. 回滚并重试
      this.sandbox.revert(sid);
      reverted += applied;
      applied = 0;
      retries++;
    }

    // 6. 所有重试失败
    return this.result(sourceNodes, originalFailures, 0, reverted,
      { passed: false, remainingFailures: originalFailures }, "FAILED", startTime, confidence);
  }

  private result(
    sourceNodes: string[], of: number, applied: number, reverted: number,
    final: SelfHealResult["finalValidation"], status: SelfHealResult["status"],
    start: number, confidence: number,
  ): SelfHealResult {
    return {
      sourceNodes,
      originalFailures: of,
      patchesGenerated: applied + reverted,
      patchesApplied: applied,
      patchesReverted: reverted,
      finalValidation: final,
      status,
      durationMs: Date.now() - start,
      confidence: Math.round(confidence * 100) / 100,
    };
  }
}
```

### 3.3 安全阀机制

```typescript
// src/core/sandbox/safety-valve.ts

/**
 * 安全阀 — 防止自愈死循环。
 */
export class SafetyValve {
  private globalAttempts = 0;
  private perFileAttempts = new Map<string, number>();

  static readonly GLOBAL_LIMIT = 50;    // 全局最大自愈次数
  static readonly PER_FILE_LIMIT = 5;   // 单文件最大自愈次数
  static readonly COOLDOWN_MS = 60000;  // 冷却窗口

  /**
   * 检查是否允许执行自愈。
   */
  allow(filePath: string): { allowed: boolean; reason?: string } {
    if (this.globalAttempts >= SafetyValve.GLOBAL_LIMIT) {
      return { allowed: false, reason: "Global self-heal limit reached" };
    }
    const fileAttempts = this.perFileAttempts.get(filePath) ?? 0;
    if (fileAttempts >= SafetyValve.PER_FILE_LIMIT) {
      return { allowed: false, reason: `File self-heal limit reached: ${filePath}` };
    }
    return { allowed: true };
  }

  /**
   * 记录一次自愈尝试。
   */
  record(filePath: string): void {
    this.globalAttempts++;
    this.perFileAttempts.set(filePath, (this.perFileAttempts.get(filePath) ?? 0) + 1);

    // 冷却窗口后重置文件计数
    setTimeout(() => {
      this.perFileAttempts.set(filePath, (this.perFileAttempts.get(filePath) ?? 1) - 1);
    }, SafetyValve.COOLDOWN_MS);
  }

  /**
   * 疲劳恢复提示：当接近限制时发出警告。
   */
  fatigueLevel(): "NORMAL" | "ELEVATED" | "CRITICAL" {
    const ratio = this.globalAttempts / SafetyValve.GLOBAL_LIMIT;
    if (ratio > 0.8) return "CRITICAL";
    if (ratio > 0.5) return "ELEVATED";
    return "NORMAL";
  }

  /** 重置 */
  reset(): void {
    this.globalAttempts = 0;
    this.perFileAttempts.clear();
  }
}
```

---

## 4. 与现有代码的集成点

### 4.1 修改 `AstConstraintSolver.generatePatchFromFailures`

```typescript
// 在 src/core/ast-constraint-solver.ts:285 之后新增：

/**
 * 生成 Patch 并返回置信度。置信度基于：
 * - 失败约束的匹配精度
 * - AST 节点定位的确定性
 */
export function generatePatchWithConfidence(
  failures: ValidationFailure[],
  ast: ASTNode,
): { patches: TransformPatch[]; confidence: number } {
  const patches = generatePatchFromFailures(failures, ast);

  // 启发式置信度：
  // - 每个 failure 都有明确的 expected/actual → 高置信
  // - "no matching node" → 低置信
  const ambiguousCount = failures.filter(f => f.actual.includes("(no matching node)")).length;
  const confidence = failures.length > 0
    ? 1 - (ambiguousCount / failures.length) * 0.5
    : 1.0;

  return { patches, confidence: Math.round(confidence * 100) / 100 };
}
```

### 4.2 修改 `ConstraintValidator.validateCode`

当前 `src/core/constraint-validator.ts:48` 只检测不修复。增加可选的 `autoHeal` 参数：

```typescript
export interface ValidateOptions {
  autoHeal?: boolean;
  healConfig?: Partial<SelfHealConfig>;
}

export async function validateAndHeal(
  codeContent: string,
  language: string,
  options: ValidateOptions = {},
): Promise<{ report: ValidationReport; healResult?: SelfHealResult }> {
  const report = await validateCode(codeContent, language);

  if (!options.autoHeal || report.hardBlocks === 0) {
    return { report };
  }

  const sandbox = new CowSandbox();
  const healResult = await new SelfHealController(
    sandbox,
    /* eventBus */ undefined as any,  // 从 DI 容器获取
    new CognitionRepository(),
  ).heal(codeContent, /* nodes */ [], {
    minConfidence: 0.7,
    autoApplyThreshold: 0.85,
    maxRetries: 3,
    maxDurationMs: 5000,
    language,
    ...options.healConfig,
  });

  return { report, healResult };
}
```

---

## 5. 审计与可观测性

### 5.1 自愈审计事件

```typescript
// 每次自愈循环完成后，写入 MetricEvent
export interface SelfHealAuditEvent {
  eventType: "self_heal_attempt" | "self_heal_success" | "self_heal_revert";
  payload: {
    timestamp: string;
    filePath?: string;
    language: string;
    sourceNodes: string[];
    patchesAttempted: number;
    patchesApplied: number;
    patchesReverted: number;
    confidence: number;
    status: string;
    durationMs: number;
    fatigueLevel: string;
  };
}
```

### 5.2 指标聚合

```typescript
// 提供给 Phase 4 仪表盘使用
export interface SandboxMetrics {
  totalAttempts: number;
  successRate: number;
  averageDurationMs: number;
  averageConfidence: number;
  fatigueLevel: string;
  topHealedFiles: { path: string; count: number }[];
}
```

---

## 6. 测试策略

| 测试类型 | 测试内容 | 方法 |
|----------|---------|------|
| 单元测试 | `CowSandbox.load/snapshot/revert/apply` | 创建沙箱 → 载入代码 → 应用 Patch → 回滚 → 验证内容未变 |
| 单元测试 | `SelfHealController` 置信度门控 | low score → SKIPPED |
| 单元测试 | `SelfHealController` 修复成功 | valid patch → HEALED |
| 单元测试 | `SelfHealController` 修复失败+回滚 | invalid patch → FAILED + revert |
| 集成测试 | 完整流水线：constraint violation → auto-heal | 有违规的代码 → 自愈 → 再验证 |
| 集成测试 | 安全阀防死循环 | 连续触发 >5 次 → 被阻断 |
| 集成测试 | 并发安全 | 两个沙箱实例互不干扰 |

---

## 7. 成功标准

- [ ] `CowSandbox` 操作在 < 10ms 内完成（内存操作）
- [ ] 自愈成功率 ≥ 80%（基于 benchmark 数据集）
- [ ] Patch 注入前 100% 通过沙箱验证
- [ ] 安全阀全局上限 50 次 + 单文件上限 5 次正常工作
- [ ] 零 DB 污染 — 失败的 Patch 永远不会写入 Rule 或 DiffLog 表
