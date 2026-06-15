/**
 * @file Protocol compliance tests for MCP resources and schemas.
 */
import { describe, it, expect } from "vitest";
import { RESOURCES, readCognitionSchema, readCognitionStats, readCognitionDocs } from "../../src/resources/cognition-resources.js";

describe("Resource Definitions", () => {
 it("exposes 3 resources with cognition:// URIs", () => {
    expect(RESOURCES.length).toBeGreaterThanOrEqual(3);
    for (const r of RESOURCES) {
      expect(r.uri).toMatch(/^cognition:\/\//);
    }
  });

  it("resources have proper descriptions and mime types", () => {
    const schema = RESOURCES.find(r => r.uri === "cognition://schema");
    expect(schema).toBeDefined();
    expect(schema?.mimeType).toBe("application/json");

    const docs = RESOURCES.find(r => r.uri === "cognition://docs");
    expect(docs).toBeDefined();
    expect(docs?.mimeType).toBe("text/markdown");
  });
});

describe("readCognitionSchema", () => {
  it("returns valid JSON schema", async () => {
    const result = await readCognitionSchema();
    const parsed = JSON.parse(result);
    expect(parsed.title).toBe("CognitionGraph");
    expect(parsed.properties).toBeDefined();
    expect(parsed.properties.CognitionNode).toBeDefined();
  });
});

describe("readCognitionStats", () => {
  it("returns stats with expected fields", async () => {
    const result = await readCognitionStats();
    const parsed = JSON.parse(result);
    expect(typeof parsed.nodeCount).toBe("number");
    expect(typeof parsed.edgeCount).toBe("number");
    expect(typeof parsed.feedbackCount).toBe("number");
    expect(parsed.timestamp).toBeDefined();
  });
});

describe("readCognitionDocs", () => {
  it("returns markdown content", async () => {
    const result = await readCognitionDocs();
    expect(result.length).toBeGreaterThan(100);
    expect(result).toContain("cognition_query");
  });
});
