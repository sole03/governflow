# EVOLUTION_PHASE3_ARBITRATION.md — 仲裁确定化

> **目标**：将多 Agent 冲突仲裁从"LLM 猜测 + 人工拍板"升级为
> "声明式约束求解 (确定性) + LLM 解释 (柔性)"。
> 借鉴 @rigour-labs/core 的约束 DSL 哲学，让规则从"自然语言建议"进化为"机器可证明的契约"。

---

## 1. 问题诊断

### 1.1 当前仲裁路径

```
Agent A → confirm_rule (ACCEPT)  ──┐
                                    ├→ ConflictRecord (ruleAId, ruleBId, scopeKey)
Agent B → confirm_rule (ACCEPT)  ──┘
                                    ↓
                              resolve_conflict → keep_a | keep_b | merge | skip
                                    ↓
                              Arbitrator.applyResolution → 合成规则
```

### 1.2 当前仲裁能力

| 文件 | 功能 | 局限 |
|------|------|------|
| `arbitrator.ts:14` | `detectConflict` — 检测同 type + language + pattern 下的冲突 | 仅字符串比较，不理解语义 |
| `arbitrator.ts:24` | `applyResolution` — keep_a / keep_b / merge / skip | 无约束验证，merge 只是拼接文本 |
| `conflict-repo.ts` | `ConflictRepo` — CRUD + 批量选择 | 无冲突成因分析 |
| `policy-engine.ts:65` | `evaluate` — 策略条件匹配 | 条件类型单一，无约束组合 |
| `ast-constraint-solver.ts` | 约束求解流水线 | 约束是 JSON 格式，人机可读性差 |

**核心问题**：仲裁依赖外部（LLM 或人类）决定。对两个 Agent 提出的冲突规则，
系统只能说"它们冲突了"，不能说"根据不变量 X，A 正确而 B 违反契约"。

---

## 2. 目标架构

```
Agent A 提案 ──→ ┌──────────────────────────────┐
Agent B 提案 ──→ │  确定性约束校验层              │
                 │  1. 加载契约 (contracts/)     │
                 │  2. 静态分析 (AST)            │
                 │  3. 约束求解                  │
                 │  4. 判定: A 有效 / B 违反     │
                 └──────────┬───────────────────┘
                            │
                    ┌───────┴───────┐
                    │               │
                    ▼               ▼
            确定性可判        无法确定定判
                    │               │
                    ▼               ▼
          自动仲裁通过      → LLM 解释 + 人工抗辩
                                    │
                                    ▼
                          规则库进化（新约束）
```

---

## 3. 约束 DSL 设计

### 3.1 从 JSON 到声明式 DSL

当前 AstTemplate 的约束格式 (`src/core/ast-constraint-solver.ts:35-69`)：

```json
{
  "nodeType": "call_expression",
  "fields": {
    "function": { "match": "eval" }
  }
}
```

目标声明式 DSL：

```
@constraint ban-eval
  .language    = "typescript"
  .nodeType    = "call_expression"
  .field.function.match = "eval"
  .severity    = REJECT
  .scope       = GLOBAL
  .evidence    = "CWE-95: Improper Neutralization of Directives in Dynamically Evaluated Code"
  .message     = "eval() is forbidden. Use structured parsing (e.g., JSON.parse) instead."
```

### 3.2 DSL 语法规范

```
@constraint <constraint-name>
  .language    = "<typescript|javascript|python>"
  .nodeType    = "<AST node type>"
  .field.<name>.match      = "<literal>"
  .field.<name>.exists     = <true|false>
  .field.<name>.childType  = "<AST node type>"
  .field.<name>.childCount = { min: <int>, max: <int> }
  .severity    = <REJECT|WARN>
  .scope       = <GLOBAL|PROJECT>
  .evidence    = "<citation or rationale>"
  .message     = "<human-readable explanation>"
  .dependsOn   = [<constraint-name>, ...]     ← 约束间依赖
  .conflicts   = [<constraint-name>, ...]     ← 显式互斥声明
  .appliesTo   = <path-pattern>               ← 适用范围
```

### 3.3 DSL 编译器

```typescript
// src/core/constraints/dsl-compiler.ts

import type { AstConstraint, FieldConstraint } from "../cognition-types.js";

export interface ParsedConstraint {
  name: string;
  description: string;
  constraints: AstConstraint[];
  severity: "REJECT" | "WARN";
  scope: "GLOBAL" | "PROJECT";
  evidence?: string;
  message: string;
  dependsOn: string[];
  conflicts: string[];
  appliesTo?: string;
}

/**
 * 将声明式 DSL 文本编译为 AstConstraint 数组。
 */
export function compileConstraint(dslSource: string): ParsedConstraint[] {
  const results: ParsedConstraint[] = [];
  const blocks = dslSource.split(/^@constraint\s+/m).filter(Boolean);

  for (const block of blocks) {
    const lines = block.trim().split("\n");
    const name = lines[0].trim();
    const constraint: AstConstraint = { nodeType: "", fields: {} };
    const parsed: ParsedConstraint = {
      name,
      description: "",
      constraints: [constraint],
      severity: "WARN",
      scope: "PROJECT",
      message: "",
      dependsOn: [],
      conflicts: [],
    };

    for (const line of lines.slice(1)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;

      // .<prop> = <value>
      const propMatch = trimmed.match(/^\.(\S+)\s*=\s*(.+)$/);
      if (!propMatch) continue;

      const path = propMatch[1];
      const value = propMatch[2].replace(/^"(.*)"$/, "$1").replace(/^'(.*)'$/, "$1");

      switch (path) {
        case "language": constraint.nodeType = constraint.nodeType || value; break; // placeholder
        case "nodeType": constraint.nodeType = value; break;
        case "severity": parsed.severity = value as "REJECT" | "WARN"; break;
        case "scope": parsed.scope = value as "GLOBAL" | "PROJECT"; break;
        case "evidence": parsed.evidence = value; break;
        case "message": parsed.message = value; break;
        case "appliesTo": parsed.appliesTo = value; break;
        case "dependsOn": parsed.dependsOn = value.split(",").map(s => s.trim()); break;
        case "conflicts": parsed.conflicts = value.split(",").map(s => s.trim()); break;
        default: {
          // .field.<name>.match = <value>
          const fieldMatch = path.match(/^field\.(\S+)\.(match|exists|childType|childCount\.min|childCount\.max)$/);
          if (fieldMatch) {
            const fieldName = fieldMatch[1];
            const fieldProp = fieldMatch[2];
            if (!constraint.fields[fieldName]) constraint.fields[fieldName] = {};

            if (fieldProp === "match") constraint.fields[fieldName].match = value;
            else if (fieldProp === "exists") constraint.fields[fieldName].exists = value === "true";
            else if (fieldProp === "childType") constraint.fields[fieldName].childType = value;
            else if (fieldProp === "childCount.min") {
              if (!constraint.fields[fieldName].childCount) constraint.fields[fieldName].childCount = {};
              constraint.fields[fieldName].childCount!.min = parseInt(value);
            }
            else if (fieldProp === "childCount.max") {
              if (!constraint.fields[fieldName].childCount) constraint.fields[fieldName].childCount = {};
              constraint.fields[fieldName].childCount!.max = parseInt(value);
            }
          }
        }
      }
    }

    if (constraint.nodeType) results.push(parsed);
  }

  return results;
}

/**
 * 将 ParsedConstraint 存入 AstTemplate，供 AstConstraintSolver 使用。
 */
export function constraintsToAstTemplate(parsed: ParsedConstraint[]): string {
  const allConstraints = parsed.flatMap(p => p.constraints);
  return JSON.stringify(allConstraints);
}
```

---

## 4. 契约模板库

### 4.1 预置不变量

```typescript
// src/core/constraints/templates/security.contracts
@constraint no-eval
  .language    = "typescript"
  .nodeType    = "call_expression"
  .field.function.match = "eval"
  .severity    = REJECT
  .scope       = GLOBAL
  .evidence    = "CWE-95: Arbitrary code execution via eval()"
  .message     = "eval() is forbidden in this codebase"

@constraint no-innerHTML
  .language    = "typescript"
  .nodeType    = "member_expression"
  .field.property.match = "innerHTML"
  .severity    = REJECT
  .scope       = GLOBAL
  .evidence    = "CWE-79: Cross-site Scripting (XSS)"
  .message     = "Avoid innerHTML — use textContent or DOM APIs"

@constraint no-dangerouslySetInnerHTML
  .language    = "typescript"
  .nodeType    = "jsx_attribute"
  .field.name.match = "dangerouslySetInnerHTML"
  .severity    = REJECT
  .scope       = GLOBAL
  .evidence    = "React XSS: dangerouslySetInnerHTML bypasses React XSS protection"
  .message     = "Never use dangerouslySetInnerHTML without sanitization"

@constraint no-any-type
  .language    = "typescript"
  .nodeType    = "type_annotation"
  .field.type.match = "any"
  .severity    = WARN
  .scope       = PROJECT
  .evidence    = "TypeScript best practice: any defeats type safety"
  .message     = "Prefer unknown or specific types over any"

@constraint import-boundary
  .language    = "typescript"
  .nodeType    = "import_statement"
  .field.source.match  = "{{relative-import}}"
  .severity    = REJECT
  .scope       = PROJECT
  .appliesTo   = "src/components/**"
  .evidence    = "Architecture: components must not import from data layer directly"
  .message     = "Components must use domain services, not direct data layer imports"
```

### 4.2 模板分类

| 类别 | 模板数 | 覆盖 |
|------|--------|------|
| 安全 (security) | 3 | eval, innerHTML, dangerouslySetInnerHTML |
| 架构 (architecture) | 1 | 依赖方向 |
| 类型安全 (type-safety) | 1 | no-any |
| 代码风格 (style) | 0 (待扩展) | |
| 性能 (performance) | 0 (待扩展) | |

---

## 5. 多 Agent 仲裁器升级

### 5.1 从文本比较到约束求解

当前 `Arbitrator.detectConflict`:

```typescript
// 仅比较字符串
if (ruleA.pattern !== ruleB.pattern) return { hasConflict: false };
```

升级后：

```typescript
// src/governance/arbitrator-v2.ts

import { compileConstraint } from "../../constraints/dsl-compiler.js";
import { solveConstraints } from "../../ast-constraint-solver.js";
import type { Rule } from "../../types.js";

export interface ArbitrationResult {
  verdict: "A_VALID" | "B_VALID" | "BOTH_VALID" | "BOTH_INVALID" | "UNDECIDABLE";
  reason: string;
  violatingConstraints: string[];
  suggestion?: string;
  /** 是否需要人工介入 */
  requiresHumanReview: boolean;
}

/**
 * 升级版仲裁：基于约束求解而非字符串比较。
 */
export async function arbitrateWithConstraints(
  ruleA: Rule,
  ruleB: Rule,
  contracts: string[],  // 已编译的约束 DSL
): Promise<ArbitrationResult> {
  const parsed = compileConstraint(contracts.join("\n"));
  const constraints = parsed.flatMap(p => p.constraints);

  // 对两个规则分别运行约束求解
  const resultA = await solveConstraints(
    /* 构建虚拟 CognitionNode */ [],
    ruleA.suggestion ?? ruleA.pattern,
    ruleA.language,
  );
  const resultB = await solveConstraints(
    [],
    ruleB.suggestion ?? ruleB.pattern,
    ruleB.language,
  );

  const violationsA = resultA.validations.flatMap(v => v.failures).length;
  const violationsB = resultB.validations.flatMap(v => v.failures).length;

  if (violationsA === 0 && violationsB > 0) {
    return {
      verdict: "A_VALID",
      reason: `Rule B violates ${violationsB} constraint(s)`,
      violatingConstraints: resultB.validations.flatMap(v =>
        v.failures.map(f => f.constraintPath)
      ),
      requiresHumanReview: false,
    };
  }

  if (violationsB === 0 && violationsA > 0) {
    return {
      verdict: "B_VALID",
      reason: `Rule A violates ${violationsA} constraint(s)`,
      violatingConstraints: resultA.validations.flatMap(v =>
        v.failures.map(f => f.constraintPath)
      ),
      requiresHumanReview: false,
    };
  }

  if (violationsA === 0 && violationsB === 0) {
    return {
      verdict: "BOTH_VALID",
      reason: "Both rules pass all constraints — should be merged",
      suggestion: `${ruleA.suggestion}\n// ── Alternative approach ──\n${ruleB.suggestion}`,
      violatingConstraints: [],
      requiresHumanReview: true,
    };
  }

  return {
    verdict: "UNDECIDABLE",
    reason: "Both rules violate constraints — LLM explanation needed",
    violatingConstraints: [
      ...resultA.validations.flatMap(v => v.failures.map(f => f.constraintPath)),
      ...resultB.validations.flatMap(v => v.failures.map(f => f.constraintPath)),
    ],
    requiresHumanReview: true,
  };
}
```

### 5.2 Blame 追踪

```typescript
// 扩展 Rule 模型，追踪责任链
export interface BlameRecord {
  ruleId: string;
  createdBy: string;       // Agent ID or "human"
  createdAt: Date;
  lastModifiedBy: string;
  lastModifiedAt: Date;
  arbitrationHistory: {
    conflictId: string;
    verdict: string;
    reviewedBy?: string;
    reviewedAt?: Date;
  }[];
}

/**
 * 构建规则的责任链。
 * 当前 Rule 模型已有 createdAt/updatedAt，
 * 需要增加 createdBy 和 lastModifiedBy 字段（存储在 metadata JSON 中）。
 */
export function buildBlameChain(rule: Rule, conflictRepo: ConflictRepo): BlameRecord {
  // 从 metadata 提取创建者和修改者
  const metadata = (rule as any).metadata ? JSON.parse((rule as any).metadata) : {};
  return {
    ruleId: rule.id,
    createdBy: metadata.createdBy ?? "unknown",
    createdAt: rule.createdAt,
    lastModifiedBy: metadata.lastModifiedBy ?? metadata.createdBy ?? "unknown",
    lastModifiedAt: rule.updatedAt,
    arbitrationHistory: [],  // 从 MetricEvent 中查询
  };
}
```

### 5.3 申诉抗辩协议

```
Agent → Arbitrator.arbitrateWithConstraints()
        │
        ├── VERDICT: A_VALID / B_VALID → 自动采纳
        │
        └── VERDICT: BOTH_VALID / UNDECIDABLE
              │
              ▼
         Agent.raiseAppeal(conflictId, {
           evidence: "AST反例" | "契约误判" | "语义等价",
           proposedResolution: "MERGE" | "KEEP_A" | "KEEP_B"
         })
              │
              ▼
         人类审查 → 最终裁定 + 契约更新
```

```typescript
export interface Appeal {
  appealId: string;
  conflictId: string;
  raisedBy: string;
  reason: "AST_FALSE_POSITIVE" | "CONTRACT_MISJUDGED" | "SEMANTIC_EQUIVALENT";
  evidence: {
    counterCode: string;          // AST 反例代码
    counterConstraint?: string;   // 误判的约束名
    equivalentPattern?: string;   // 语义等价证据
  };
  proposedResolution: "KEEP_A" | "KEEP_B" | "MERGE" | "NEW";
  status: "PENDING" | "ACCEPTED" | "REJECTED";
  reviewedBy?: string;
  reviewedAt?: Date;
  resolutionNote?: string;
}
```

---

## 6. 与现有代码的集成点

| 现有文件 | 修改 |
|----------|------|
| `src/governance/arbitrator.ts` | 保留 `detectConflict` 作为初筛，新增 `arbitrateWithConstraints` |
| `src/core/ast-constraint-solver.ts` | 新增 `solveConstraints` 接受约束数组 + 代码 → 验证结果（已有） |
| `src/data/conflict-repo.ts` | 新增 `findByResolution`、`getAppealHistory` |
| `Prisma schema` | Rule 表可选新增 `createdBy` 字段（或在 metadata JSON 中） |
| — 新建 | `src/core/constraints/dsl-compiler.ts` |
| — 新建 | `src/core/constraints/templates/` (security, architecture, style, performance) |
| — 新建 | `src/governance/appeal-handler.ts` |

---

## 7. 测试策略

| 测试 | 内容 |
|------|------|
| 单元 | DSL 编译器解析各语法元素 |
| 单元 | 约束 → AstTemplate 往返转换 |
| 单元 | `arbitrateWithConstraints` 四种判决 |
| 单元 | 申诉协议状态机 |
| 集成 | 两个 Agent 提出冲突规则 → 约束求解 → 自动仲裁 |
| 集成 | 契约模板库对所有语言生效 |
| 集成 | Blame 链可追溯到创建者 |

---

## 8. 成功标准

- [ ] 80% 的冲突可通过约束求解自动裁定（无需 LLM）
- [ ] 约束 DSL 覆盖 4 类模板（安全/架构/类型/风格）各 ≥ 3 条
- [ ] 申诉协议支持 3 种抗辩理由
- [ ] Blame 链可追查任意规则的完整仲裁历史
- [ ] DSL 编译器 AST 往返无信息丢失
