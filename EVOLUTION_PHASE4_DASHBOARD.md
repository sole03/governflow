# EVOLUTION_PHASE4_DASHBOARD.md — 认知可视化

> **目标**：构建认知负载仪表盘，让人类能实时观察"Agent 大脑"的健康状态。
> 将杏仁核触发率、自愈成功率、仲裁争议率等核心指标可视化，
> 从黑箱 AI Agent 治理跃升为可观测、可诊断、可干预的透明系统。

---

## 1. 问题诊断

### 1.1 当前可观测性现状

| 组件 | 当前输出 | 可读性 |
|------|----------|--------|
| `src/telemetry/logger.ts` | Pino JSON 日志 → stderr | 机器可读，人类需 `pino-pretty` |
| `MetricEvent` 表 | 结构化审计事件 | 需 SQL 查询 |
| `Proposal` 表 | 注入审批状态 | 无聚合视图 |
| `ConflictRecord` 表 | 冲突状态 | 无趋势分析 |
| `CognitionNode` / `CognitionEdge` | 认知图拓扑 | 无可视化 |

**当前问题**：
- 所有数据都在，但没有一个统一的"看板"
- 人类无法直观感知系统健康度
- Agent 行为异常无法及时发现
- 规则膨胀、冲突上升等趋势无预警

### 1.2 现有资产可利用

| 来源 | 数据 | 可聚合为 |
|------|------|----------|
| `PolicyEngine.evaluate()` | matchedPolicies, warnings | 策略命中率、TOP N 命中策略 |
| `RuleImmuneEngine.getStats()` | coldStartCount, expiringCount, conflictRate, conflictLocked | 规则生命周期仪表盘 |
| `ApprovalWorkflowService.listActive()` | 活跃审批数 | 审批队列深度 |
| `Proposal` 表 | status 分布 + TTL | 审批通过率/拒绝率/过期率 |
| `MetricEvent` 表 (eventType) | `rule_matched`, `cognition_feedback_pending`, `self_heal_*`, `policy_evaluated` | 所有关键 KPI |
| `CognitionNode` + `CognitionEdge` | 节点数、边数、边权重 | 认知图健康度 |
| `VectorStore` | embeddedNodes | 嵌入覆盖率 |
| `ConflictRecord` | 冲突率 + 解决率 | 多 Agent 协作健康度 |
| `GraphTraverser.traverse()` | durationMs, truncated | 遍历延迟分布 |
| `IntentRecognizer` | intent 分布 | 代码变更模式热力图 |

---

## 2. 仪表盘设计

### 2.1 四大面板

```
┌─────────────────────────────────────────────────────────────┐
│                  认知负载仪表盘                              │
├──────────────┬──────────────┬──────────────┬────────────────┤
│  直觉健康     │  自愈监控     │  仲裁概览     │  认知图拓扑     │
│  (杏仁核)     │  (小脑)       │  (前额叶)     │  (记忆)         │
├──────────────┼──────────────┼──────────────┼────────────────┤
│ • 风险评分    │ • 自愈总数    │ • 冲突率      │ • 节点数        │
│ • 触发率      │ • 成功率      │ • 仲裁裁决率  │ • 边数          │
│ • 疲劳等级    │ • 回滚率      │ • 申诉率      │ • 嵌入覆盖率    │
│ • 近期触发     │ • 平均耗时    │ • 争议率      │ • 遍历延迟      │
│              │ • 安全阀状态  │ • TOP 冲突模式 │ • 权重热力图    │
├──────────────┴──────────────┴──────────────┴────────────────┤
│                    审计时间线                                │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ 提案状态变更 · 策略命中 · 自愈尝试 · 仲裁裁决 · 免疫周期 │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 核心 KPI 定义

```typescript
// src/core/dashboard/metrics.ts

export interface DashboardSnapshot {
  timestamp: string;
  version: string;

  // ── 认知图 ──
  cognition: {
    nodeCount: number;
    edgeCount: number;
    embeddedNodeRatio: number;       // 0-1, 嵌入覆盖率
    avgTraversalMs: number;          // 平均遍历延迟
    traversalTruncationRate: number; // 遍历超时截断率
  };

  // ── 杏仁核直觉 ──
  amygdala: {
    triggeredCount24h: number;       // 24h 杏仁核触发次数
    avgRiskScore: number;            // 平均风险评分
    fatigueLevel: "NORMAL" | "ELEVATED" | "CRITICAL";
    highRiskEvents24h: { file: string; score: number }[];
  };

  // ── 自愈 ──
  selfHeal: {
    attempts24h: number;
    successRate: number;             // 0-1
    revertRate: number;              // 0-1, 回滚率
    avgDurationMs: number;
    safetyValveTripped: boolean;     // 安全阀是否被触发
    topHealedFiles: { path: string; count: number }[];
  };

  // ── 治理 ──
  governance: {
    activePolicies: number;
    policyHits24h: number;
    topPolicies: { name: string; hits: number }[];
    activeProposals: number;
    approvalRate: number;            // APPROVED / (APPROVED + REJECTED)
    expiredProposals24h: number;
  };

  // ── 仲裁 ──
  arbitration: {
    conflictRate: number;            // conflicts / totalRules
    conflictLocked: boolean;
    unresolvedConflicts: number;
    autoResolutionRate: number;      // 约束求解自动裁定的比例
    appealRate: number;              // 申诉比例
    topConflictPatterns: { pattern: string; count: number }[];
  };

  // ── 规则生命周期 ──
  ruleLifecycle: {
    activeRules: number;
    coldStartImmune: number;
    expiringIn30Days: number;
    coldStorageCount: number;
    autoRenewed24h: number;
    archived24h: number;
    revived24h: number;
  };

  // ── 意图分布 ──
  intentDistribution: {
    refactor: number;
    bugfix: number;
    boilerplate: number;
    period: "24h" | "7d" | "30d";
  };
}
```

---

## 3. 数据聚合层

### 3.1 MetricsCollector

```typescript
// src/core/dashboard/metrics-collector.ts

import { getPrismaClient } from "../../data/client.js";
import { GovernanceCore } from "../../transport/governance-core.js";
import type { DashboardSnapshot } from "./metrics.js";

export class MetricsCollector {
  constructor(private core: GovernanceCore) {}

  async snapshot(): Promise<DashboardSnapshot> {
    const prisma = getPrismaClient();
    const now = new Date();
    const last24h = new Date(now.getTime() - 24 * 3600 * 1000);

    const [
      nodeCount, edgeCount, embeddedCount,
      avgTraversalMs, truncatedTraversals, totalTraversals,
      amygdala24h, avgRisk,
      healAttempts, healSuccesses, healReverts, avgHealMs,
      safetyValveTripped,
      activePolicies, policyHits24h,
      activeProposals, approvedProposals, rejectedProposals, expired24h,
      totalRules, unresolvedConflicts, conflictLocked,
      coldStart, expiring30d, coldStorage, autoRenewed24h, archived24h, revived24h,
      refactorCount, bugfixCount, boilerplateCount,
    ] = await Promise.all([
      // 认知图
      prisma.cognitionNode.count(),
      prisma.cognitionEdge.count(),
      prisma.cognitionNode.count({ where: { metadata: { contains: "embedding" } } }),
      this.queryAvg("avgTraversalMs", last24h),
      this.queryCount("traversal_truncated", last24h),
      this.queryCount("traversal_completed", last24h),
      // 杏仁核
      this.queryCount("amygdala_triggered", last24h),
      this.queryAvgRisk(last24h),
      // 自愈
      this.queryCount("self_heal_attempt", last24h),
      this.queryCount("self_heal_success", last24h),
      this.queryCount("self_heal_revert", last24h),
      this.queryAvg("avgHealMs", last24h),
      this.querySafetyValve(),
      // 治理
      Promise.resolve(this.core.policyEngine.getActivePolicies().length),
      this.queryCount("policy_evaluated", last24h),
      // 提案
      prisma.proposal.count({ where: { status: "PENDING", expiresAt: { gt: now } } }),
      prisma.proposal.count({ where: { status: "APPROVED", updatedAt: { gte: last24h } } }),
      prisma.proposal.count({ where: { status: "REJECTED", updatedAt: { gte: last24h } } }),
      prisma.proposal.count({ where: { status: "EXPIRED", updatedAt: { gte: last24h } } }),
      // 规则 & 冲突
      prisma.rule.count({ where: { status: "active" } }),
      prisma.conflictRecord.count({ where: { resolvedAt: null } }),
      Promise.resolve(this.core.immuneEngine.getStats().then(s => s.conflictLocked)),
      // 免疫
      Promise.resolve(this.core.immuneEngine.getStats()),
      this.queryCount("rule_auto_renewed", last24h),
      this.queryCount("rule_archived", last24h),
      this.queryCount("rule_revived", last24h),
      // 意图
      this.queryCount("intent_refactor", last24h),
      this.queryCount("intent_bugfix", last24h),
      this.queryCount("intent_boilerplate", last24h),
    ]);

    const immuneStats = await this.core.immuneEngine.getStats();

    return {
      timestamp: now.toISOString(),
      version: "1.0.0",
      cognition: {
        nodeCount, edgeCount,
        embeddedNodeRatio: nodeCount > 0 ? embeddedCount / nodeCount : 0,
        avgTraversalMs: avgTraversalMs ?? 0,
        traversalTruncationRate: totalTraversals > 0 ? truncatedTraversals / totalTraversals : 0,
      },
      amygdala: {
        triggeredCount24h: amygdala24h,
        avgRiskScore: avgRisk ?? 0,
        fatigueLevel: this.core.immuneEngine ? "NORMAL" : "NORMAL", // 完成后从 SafetyValve 获取
        highRiskEvents24h: [],
      },
      selfHeal: {
        attempts24h: healAttempts,
        successRate: healAttempts > 0 ? healSuccesses / healAttempts : 0,
        revertRate: healAttempts > 0 ? healReverts / healAttempts : 0,
        avgDurationMs: avgHealMs ?? 0,
        safetyValveTripped,
        topHealedFiles: [],
      },
      governance: {
        activePolicies,
        policyHits24h,
        topPolicies: [],
        activeProposals,
        approvalRate: (approvedProposals + rejectedProposals) > 0
          ? approvedProposals / (approvedProposals + rejectedProposals) : 0,
        expiredProposals24h: expired24h,
      },
      arbitration: {
        conflictRate: totalRules > 0 ? unresolvedConflicts / totalRules : 0,
        conflictLocked,
        unresolvedConflicts,
        autoResolutionRate: 0, // Phase 3 完成后填充
        appealRate: 0,
        topConflictPatterns: [],
      },
      ruleLifecycle: {
        activeRules: totalRules,
        coldStartImmune: immuneStats.coldStartCount,
        expiringIn30Days: immuneStats.expiringCount,
        coldStorageCount: immuneStats.coldStorageCount,
        autoRenewed24h,
        archived24h,
        revived24h,
      },
      intentDistribution: {
        refactor: refactorCount,
        bugfix: bugfixCount,
        boilerplate: boilerplateCount,
        period: "24h",
      },
    };
  }

  // ── Helpers ──

  private async queryCount(eventType: string, since: Date): Promise<number> {
    const prisma = getPrismaClient();
    return prisma.metricEvent.count({
      where: { eventType, createdAt: { gte: since } },
    });
  }

  private async queryAvg(field: string, since: Date): Promise<number> {
    // 从 MetricEvent.properties JSON 中提取数值
    const prisma = getPrismaClient();
    const events = await prisma.metricEvent.findMany({
      where: { eventType: { startsWith: field.split("Avg")[0] ?? "" }, createdAt: { gte: since } },
      select: { properties: true },
      take: 1000,
    });

    if (events.length === 0) return 0;
    let sum = 0;
    let count = 0;
    for (const e of events) {
      try {
        const p = JSON.parse(e.properties ?? "{}");
        const val = p[field.replace("avg", "").replace("Avg", "") + "Ms"];
        if (typeof val === "number") { sum += val; count++; }
      } catch {}
    }
    return count > 0 ? sum / count : 0;
  }

  private async queryAvgRisk(since: Date): Promise<number> {
    const prisma = getPrismaClient();
    const events = await prisma.metricEvent.findMany({
      where: { eventType: "amygdala_triggered", createdAt: { gte: since } },
      select: { properties: true },
      take: 500,
    });
    if (events.length === 0) return 0;
    let sum = 0;
    let count = 0;
    for (const e of events) {
      try {
        const p = JSON.parse(e.properties ?? "{}");
        if (typeof p.riskScore === "number") { sum += p.riskScore; count++; }
      } catch {}
    }
    return count > 0 ? sum / count : 0;
  }

  private async querySafetyValve(): Promise<boolean> {
    const prisma = getPrismaClient();
    const count = await prisma.metricEvent.count({
      where: { eventType: "safety_valve_tripped", createdAt: { gte: new Date(Date.now() - 3600 * 1000) } },
    });
    return count > 0;
  }
}
```

---

## 4. Web 仪表盘入口

### 4.1 轻量级 HTTP API

```typescript
// packages/dashboard/src/server.ts

import { createServer } from "node:http";
import { GovernanceCore } from "../../../src/transport/governance-core.js";
import { MetricsCollector } from "../../../src/core/dashboard/metrics-collector.js";

export function startDashboardServer(core: GovernanceCore, port = 4000) {
  const collector = new MetricsCollector(core);

  const server = createServer(async (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");

    if (req.url === "/api/snapshot") {
      const snapshot = await collector.snapshot();
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(snapshot));
      return;
    }

    if (req.url === "/api/events" || req.url?.startsWith("/api/events?")) {
      const url = new URL(req.url, "http://localhost");
      const limit = parseInt(url.searchParams.get("limit") ?? "50");
      const prisma = (core as any).prisma ?? (await import("../../../src/data/client.js")).getPrismaClient();
      const events = await prisma.metricEvent.findMany({
        orderBy: { createdAt: "desc" },
        take: limit,
      });
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(events));
      return;
    }

    // 静态 HTML
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(DASHBOARD_HTML);
  });

  server.listen(port, () => {
    console.log(`Dashboard: http://localhost:${port}`);
  });
}
```

### 4.2 仪表盘 HTML + Chart.js

仪表盘使用 Chart.js 渲染四大面板的图表：

1. **杏仁核面板** — 风险评分折线图 + 疲劳等级指示器
2. **自愈面板** — 成功率环形图 + 回滚率柱状图 + 安全阀状态灯
3. **仲裁面板** — 冲突率趋势线 + 自动裁决 vs 人工裁决堆叠图
4. **认知图面板** — 节点/边计数 + 遍历延迟箱线图 + 嵌入覆盖率进度条
5. **审计时间线** — 实时事件流，颜色编码区分事件类型

---

## 5. 警告与通知

### 5.1 阈值告警

```typescript
export interface AlertRule {
  metric: string;
  threshold: number;
  operator: "gt" | "lt";
  severity: "INFO" | "WARN" | "CRITICAL";
  message: string;
}

export const DEFAULT_ALERTS: AlertRule[] = [
  { metric: "amygdala.fatigueLevel", threshold: 0, operator: "gt", severity: "CRITICAL", message: "杏仁核疲劳等级达到 CRITICAL" },
  { metric: "selfHeal.revertRate", threshold: 0.3, operator: "gt", severity: "WARN", message: "自愈回滚率超过 30%" },
  { metric: "selfHeal.safetyValveTripped", threshold: 0, operator: "gt", severity: "CRITICAL", message: "自愈安全阀已触发 — 手动介入" },
  { metric: "arbitration.conflictRate", threshold: 0.1, operator: "gt", severity: "CRITICAL", message: "冲突率超过 10% — 规则冻结" },
  { metric: "governance.approvalRate", threshold: 0.5, operator: "lt", severity: "WARN", message: "审批通过率低于 50%" },
  { metric: "cognition.embeddedNodeRatio", threshold: 0.5, operator: "lt", severity: "INFO", message: "嵌入覆盖率低于 50%" },
];
```

---

## 6. 测试策略

| 测试 | 内容 |
|------|------|
| 单元 | `MetricsCollector.snapshot()` 返回完整结构 |
| 单元 | 告警规则评估正确触发 |
| 集成 | `/api/snapshot` 返回有效 JSON |
| 集成 | `/api/events?limit=10` 返回最近事件 |
| E2E | 仪表盘 HTML 渲染四大面板图表 |
| 性能 | snapshot 查询 < 500ms (SQLite) |

---

## 7. 成功标准

- [ ] 仪表盘 `/api/snapshot` 在 < 500ms 内返回完整快照
- [ ] 所有 10 个 KPI 类别有数据支撑
- [ ] 杏仁核疲劳等级实时反映系统压力
- [ ] 自愈安全阀触发时自动发送告警
- [ ] 仲裁冲突率超过 10% 时规则冻结通知
- [ ] 审计时间线可回溯 30 天内任意时刻
