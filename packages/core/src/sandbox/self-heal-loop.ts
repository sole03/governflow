/**
 * @file SelfHealController — 自愈循环控制器
 *
 * 完整的自愈流水线：
 *   1. 置信度门控 → score < 0.7 直接跳过
 *   2. COW 快照
 *   3. 应用 Patch
 *   4. 沙箱内约束验证
 *   5. 决策：HEALED / PARTIAL / REVERT → 重试(≤3) → FAILED
 *
 * 集成 CowSandbox + SafetyValve + AstConstraintSolver。
 */

import { CowSandbox } from "./cow-sandbox.js";
import { SafetyValve } from "./safety-valve.js";
import {
  solveConstraints,
  generatePatchFromFailures,
  generatePatchWithConfidence,
} from "../../../../src/core/ast-constraint-solver.js";
import { CognitionRepository } from "../../../../src/data/cognition-repository.js";
import type { TransformPatch, ValidationResult } from "../../../../src/core/cognition-types.js";
import type { CognitionNodeData } from "../../../../src/data/cognition-types.js";

// ── Types ──

export interface SelfHealConfig {
  /** 最低置信度阈值，低于此值直接跳过。默认 0.7 */
  minConfidence: number;
  /** 自动应用阈值，高于此值接受部分修复。默认 0.85 */
  autoApplyThreshold: number;
  /** 最大重试次数。默认 3 */
  maxRetries: number;
  /** 最大耗时（ms）。默认 5000 */
  maxDurationMs: number;
  /** 代码语言 */
  language: string;
  /** 文件路径（用于安全阀追踪） */
  filePath?: string;
}

export interface SelfHealResult {
  /** 原始约束节点 ID 列表 */
  sourceNodes: string[];
  /** 原始验证失败数 */
  originalFailures: number;
  /** 生成的 Patch 数量 */
  patchesGenerated: number;
  /** 成功应用的 Patch 数 */
  patchesApplied: number;
  /** 回滚的 Patch 数 */
  patchesReverted: number;
  /** 最终验证结果 */
  finalValidation: {
    passed: boolean;
    remainingFailures: number;
  };
  /** 闭环状态 */
  status: "HEALED" | "PARTIAL" | "FAILED" | "SKIPPED" | "BLOCKED";
  /** 耗时（ms） */
  durationMs: number;
  /** 置信度 0-1 */
  confidence: number;
  /** 安全阀疲劳等级 */
  fatigueLevel: string;
  /** 详细消息 */
  message: string;
}

// ── Controller ──

export class SelfHealController {
  private sandbox: CowSandbox;
  private valve: SafetyValve;
  private repo: CognitionRepository;

  constructor(
    sandbox?: CowSandbox,
    valve?: SafetyValve,
    repo?: CognitionRepository,
  ) {
    this.sandbox = sandbox ?? new CowSandbox();
    this.valve = valve ?? new SafetyValve();
    this.repo = repo ?? new CognitionRepository();
  }

  /**
   * 执行自愈循环。
   *
   * @param codeContent    待修复的代码内容
   * @param cognitionNodes 关联的认知节点（含 AstTemplate 约束）
   * @param config         自愈配置
   * @param externalPatches 外部提供的 Patch（如 LLM 生成），
   *                        若未提供则自动从约束求解器生成
   */
  async heal(
    codeContent: string,
    cognitionNodes: CognitionNodeData[],
    config: SelfHealConfig,
    externalPatches?: TransformPatch[],
  ): Promise<SelfHealResult> {
    const startTime = Date.now();
    const sourceNodes = cognitionNodes.map(n => n.id);
    const filePath = config.filePath ?? "unknown";

    // ── 安全阀检查 ──
    const valveCheck = this.valve.allow(filePath);
    if (!valveCheck.allowed) {
      return this.makeResult(
        sourceNodes, 0, 0, 0,
        { passed: false, remainingFailures: 0 },
        "BLOCKED", startTime, 0,
        valveCheck.reason ?? "Blocked by safety valve",
      );
    }

    // ── 1. 加载沙箱 ──
    await this.sandbox.load(codeContent, config.language);

    // ── 2. Baseline: 运行约束求解，获取违规列表 ──
    const baseline = await solveConstraints(cognitionNodes, codeContent, config.language);
    const originalFailures = baseline.validations.reduce(
      (sum, v) => sum + v.failures.length, 0,
    );

    // 无违规 → 不需要自愈
    if (originalFailures === 0) {
      return this.makeResult(
        sourceNodes, 0, 0, 0,
        { passed: true, remainingFailures: 0 },
        "HEALED", startTime, 1.0,
        "No violations detected",
      );
    }

    // ── 3. 获取 Patch ──
    const { patches, confidence } = this.getPatches(
      baseline.validations,
      externalPatches,
      codeContent,
      config.language,
    );

    // ── 4. 置信度门控 ──
    if (confidence < config.minConfidence) {
      return this.makeResult(
        sourceNodes, originalFailures, patches.length, 0,
        { passed: false, remainingFailures: originalFailures },
        "SKIPPED", startTime, confidence,
        `Confidence ${confidence.toFixed(2)} below threshold ${config.minConfidence}`,
      );
    }

    // ── 5. 自愈循环 ──
    let retries = 0;
    let totalApplied = 0;
    let totalReverted = 0;

    while (retries < config.maxRetries && (Date.now() - startTime) < config.maxDurationMs) {
      // 记录尝试
      this.valve.record(filePath);
      retries++;

      const sid = this.sandbox.snapshot();

      // 5a. 应用 Patch
      const batchResult = this.sandbox.applyBatch(patches);
      totalApplied += batchResult.applied;
      totalReverted += batchResult.reverted;

      if (batchResult.applied === 0 || batchResult.error) {
        // 应用失败 → 回滚（applyBatch 内部已回滚）
        continue;
      }

      // 5b. 沙箱内重新验证
      const newContent = this.sandbox.getContent();
      const recheck = await solveConstraints(cognitionNodes, newContent, config.language);
      const remaining = recheck.validations.reduce(
        (sum, v) => sum + v.failures.length, 0,
      );

      // 5c. 决策
      if (remaining === 0) {
        // 全部修复 → 成功
        // 注意：此时代码仍在沙箱中，调用方决定是否持久化
        return this.makeResult(
          sourceNodes, originalFailures, totalApplied, totalReverted,
          { passed: true, remainingFailures: 0 },
          "HEALED", startTime, confidence,
          `All ${originalFailures} violations fixed after ${retries} attempt(s)`,
        );
      }

      if (remaining < originalFailures && confidence >= config.autoApplyThreshold) {
        // 部分修复 + 置信度足够 → 接受部分结果
        return this.makeResult(
          sourceNodes, originalFailures, totalApplied, totalReverted,
          { passed: false, remainingFailures: remaining },
          "PARTIAL", startTime, confidence,
          `${originalFailures - remaining} violations fixed, ${remaining} remain`,
        );
      }

      // 5d. 回滚并重试
      this.sandbox.revert(sid);
      totalReverted += batchResult.applied;
      totalApplied -= batchResult.applied;
    }

    // ── 6. 所有重试失败 ──
    return this.makeResult(
      sourceNodes, originalFailures, 0, totalReverted,
      { passed: false, remainingFailures: originalFailures },
      "FAILED", startTime, confidence,
      `Failed after ${retries} retries`,
    );
  }

  /**
   * 获取沙箱中最新的代码内容（调用方决定是否持久化）。
   * 仅在 status=HEALED 时内容有意义。
   */
  getHealedContent(): string | null {
    if (!this.sandbox.isLoaded()) return null;
    return this.sandbox.getContent();
  }

  /** 获取安全阀统计。 */
  getValveStats() {
    return this.valve.stats();
  }

  /** 重置所有状态。 */
  reset(): void {
    this.sandbox.reset();
    this.valve.reset();
  }

  // ── Private ──

  private getPatches(
    validations: ValidationResult[],
    externalPatches: TransformPatch[] | undefined,
    codeContent: string,
    language: string,
  ): { patches: TransformPatch[]; confidence: number } {
    if (externalPatches && externalPatches.length > 0) {
      // 使用外部 Patch，置信度基于 Patch 数量
      const confidence = Math.min(0.95, 0.7 + externalPatches.length * 0.05);
      return { patches: externalPatches, confidence };
    }

    // 自动生成 Patch
    const allFailures = validations.flatMap(v => v.failures);
    return generatePatchWithConfidence(allFailures, null as any);
  }

  private makeResult(
    sourceNodes: string[],
    originalFailures: number,
    applied: number,
    reverted: number,
    finalValidation: SelfHealResult["finalValidation"],
    status: SelfHealResult["status"],
    startTime: number,
    confidence: number,
    message: string,
  ): SelfHealResult {
    return {
      sourceNodes,
      originalFailures,
      patchesGenerated: applied + reverted,
      patchesApplied: applied,
      patchesReverted: reverted,
      finalValidation,
      status,
      durationMs: Date.now() - startTime,
      confidence: Math.round(confidence * 100) / 100,
      fatigueLevel: this.valve.fatigueLevel(),
      message,
    };
  }
}
