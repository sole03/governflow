/**
 * @file Dashboard Types — 仪表盘核心类型定义
 *
 * DashboardSnapshot 是 Phase 4 仪表盘的统一数据模型。
 * 所有 KPI 聚合到此结构中，供 HTTP API 和 Web UI 消费。
 * 本文件协议无关，零外部依赖。
 */

// ── Snapshot ──

export interface DashboardSnapshot {
  timestamp: string;
  version: string;
  cognition: CognitionMetrics;
  amygdala: AmygdalaMetrics;
  selfHeal: SelfHealMetrics;
  arbitration: ArbitrationMetrics;
  governance: GovernanceMetrics;
  alerts: Alert[];
}

// ── Cognition ──

export interface CognitionMetrics {
  nodeCount: number;
  edgeCount: number;
  embeddedNodeRatio: number;
  avgTraversalMs: number;
  traversalTruncationRate: number;
  topIntentDistribution: { intent: string; count: number }[];
}

// ── Amygdala ──

export interface AmygdalaMetrics {
  triggeredCount24h: number;
  avgRiskScore: number;
  fatigueLevel: "NORMAL" | "ELEVATED" | "CRITICAL";
  recentTriggers: { reason: string; riskScore: number; timestamp: string }[];
}

// ── Self-Heal ──

export interface SelfHealMetrics {
  totalAttempts: number;
  successRate: number;
  revertRate: number;
  avgDurationMs: number;
  avgConfidence: number;
  safetyValveTripped: boolean;
  topHealedFiles: { path: string; count: number }[];
}

// ── Arbitration ──

export interface ArbitrationMetrics {
  totalConflicts: number;
  conflictRate: number;
  autoResolveRate: number;
  humanRequiredRate: number;
  appealRate: number;
  appealAcceptRate: number;
  topConflictPatterns: { pattern: string; count: number }[];
}

// ── Governance ──

export interface GovernanceMetrics {
  activeRuleCount: number;
  pendingProposalCount: number;
  approvalRate: number;
  rejectionRate: number;
  immuneStats: {
    coldStartCount: number;
    expiringCount: number;
    coldStorageCount: number;
    conflictRate: number;
    conflictLocked: boolean;
  };
  topMatchedPolicies: { policyId: string; hits: number }[];
}

// ── Alerts ──

export interface Alert {
  id: string;
  metric: string;
  severity: "INFO" | "WARN" | "CRITICAL";
  message: string;
  currentValue: number;
  threshold: number;
  operator: "gt" | "lt";
  timestamp: string;
}

export interface AlertRule {
  metric: string;
  threshold: number;
  operator: "gt" | "lt";
  severity: "INFO" | "WARN" | "CRITICAL";
  message: string;
}

// ── Event Stream ──

export interface AuditEvent {
  id: string;
  eventType: string;
  properties: Record<string, unknown> | null;
  createdAt: string;
}
