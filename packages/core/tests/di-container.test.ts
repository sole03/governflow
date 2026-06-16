/**
 * @file DI Container 单元测试
 * 覆盖率：生产容器、测试容器、默认值
 */

import { describe, it, expect } from "vitest";
import { createTestContainer } from "../src/di/container.js";

describe("DI Container", () => {
  it("creates a test container with all subsystems", () => {
    const c = createTestContainer();

    expect(c.eventBus).toBeDefined();
    expect(c.cognitionRepo).toBeDefined();
    expect(c.ruleRepo).toBeDefined();
    expect(c.diffLogRepo).toBeDefined();
    expect(c.conflictRepo).toBeDefined();
    expect(c.metricRepo).toBeDefined();
    expect(c.policyEngine).toBeDefined();
    expect(c.immuneEngine).toBeDefined();
    expect(c.workflowService).toBeDefined();
    expect(c.vectorStore).toBeDefined();
    expect(c.embeddingService).toBeDefined();
  });

  it("test container eventBus is functional", async () => {
    const c = createTestContainer();
    let called = false;
    c.eventBus.on("test", () => { called = true; });
    c.eventBus.emit({ type: "test", payload: {} }, true);
    expect(called).toBe(true);
  });

  it("test container policyEngine defaults to allow-all", () => {
    const c = createTestContainer();
    const result = c.policyEngine.evaluate({ toolName: "any" });
    expect(result.allowed).toBe(true);
    expect(result.requiresApproval).toBe(false);
  });

  it("test container cognitionRepo returns empty by default", async () => {
    const c = createTestContainer();
    const nodes = await c.cognitionRepo.findNodesBySemanticHash("any");
    expect(nodes).toEqual([]);
  });

  it("allows overriding specific subsystems", () => {
    const mockPolicy = {
      loadPolicies: () => {},
      evaluate: () => ({ allowed: false, requiresApproval: true, warnings: ["mock"], matchedPolicies: [] }),
      getActivePolicies: () => [],
      getAllPolicies: () => [],
    };

    const c = createTestContainer({ policyEngine: mockPolicy });
    const result = c.policyEngine.evaluate({ toolName: "test" });
    expect(result.allowed).toBe(false);
    expect(result.warnings).toEqual(["mock"]);

    // 其他子系统仍然是默认 mock
    expect(c.cognitionRepo).toBeDefined();
  });

  it("each container instance has independent eventBus", () => {
    const c1 = createTestContainer();
    const c2 = createTestContainer();

    let c1Called = false;
    let c2Called = false;
    c1.eventBus.on("test", () => { c1Called = true; });
    c2.eventBus.on("test", () => { c2Called = true; });

    c1.eventBus.emit({ type: "test", payload: {} }, true);
    expect(c1Called).toBe(true);
    expect(c2Called).toBe(false);
  });
});
