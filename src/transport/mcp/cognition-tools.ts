/**
 * Copyright 2026 熊高锐
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * @file Cognition engine MCP Tool handlers.
 * Three new tools for the MCP protocol:
 *   cognition_query    — Query the cognition graph
 *   cognition_validate — Validate code against AST templates
 *   cognition_feedback — Provide feedback to update edge weights
 *
 * These are independent from legacy tools in this directory.
 */

import { GraphTraverser } from "../../core/graph-traverser.js";
import { recognizeIntent } from "../../core/intent-recognizer.js";
import { solveConstraints } from "../../core/ast-constraint-solver.js";
import { CognitionRepository } from "../../data/cognition-repository.js";
import type { TraversalOptions } from "../../core/cognition-types.js";

// ── Input Types ─────────────────────────────────────────────

interface CognitionQueryInput {
  contextHash?: string;
  semanticHash?: string;
  filePath?: string;
  language?: string;
  nodeType?: "INTENT" | "PATTERN" | "CONSTRAINT" | "HEURISTIC";
  intentHint?: "REFACTOR" | "BUGFIX" | "BOILERPLATE";
  maxDepth?: number;
  limit?: number;
}

interface CognitionValidateInput {
  nodeId: string;
  targetFileContent: string;
}

interface CognitionFeedbackInput {
  nodeId: string;
  edgeId?: string;
  outcome: "ACCEPTED" | "REJECTED" | "MODIFIED";
  comment?: string;
}

// ── Handlers ────────────────────────────────────────────────

/**
 * cognition_query — Traverse the cognition graph starting from a context hash.
 * If intentHint is omitted, first runs intent recognition on the content hash string.
 *
 * Supports multiple query modes:
 * 1. By semanticHash/contextHash (original mode)
 * 2. By filePath (new: finds nodes whose payload.filePath matches)
 * 3. By language (new: finds nodes whose payload.language matches)
 * 4. By nodeType (new: finds nodes by type: INTENT/PATTERN/CONSTRAINT/HEURISTIC)
 */
export async function handleCognitionQuery(
  input: CognitionQueryInput,
): Promise<{ content: { type: string; text: string }[] }> {
  try {
    const repo = new CognitionRepository();
    const limit = input.limit ?? 50;

    // ── Multi-mode query ─────────────────────────────────────
    let startNodes: { id: string; type: string; abstractionLevel: number; relevanceScore?: number }[] = [];
    let queryMode = "unknown";

    // Mode 1: By nodeType (direct DB query)
    if (input.nodeType) {
      queryMode = "nodeType";
      const nodes = await repo.findNodesByType(input.nodeType as any, limit);
      startNodes = nodes.map(n => ({
        id: n.id,
        type: n.type,
        abstractionLevel: n.abstractionLevel,
        relevanceScore: 1.0,
      }));
    }
    // Mode 2: By filePath (payload field search)
    else if (input.filePath) {
      queryMode = "filePath";
      const nodes = await repo.findNodesByPayloadField("filePath", input.filePath);
      startNodes = nodes.slice(0, limit).map(n => ({
        id: n.id,
        type: n.type,
        abstractionLevel: n.abstractionLevel,
        relevanceScore: 1.0,
      }));
    }
    // Mode 3: By language (payload field search)
    else if (input.language) {
      queryMode = "language";
      const nodes = await repo.findNodesByPayloadField("language", input.language);
      startNodes = nodes.slice(0, limit).map(n => ({
        id: n.id,
        type: n.type,
        abstractionLevel: n.abstractionLevel,
        relevanceScore: 1.0,
      }));
    }
    // Mode 4: By semanticHash/contextHash (original traversal mode)
    else if (input.contextHash || input.semanticHash) {
      queryMode = "semanticHash";
      const contextHash = input.contextHash || input.semanticHash || "";
      const traverser = new GraphTraverser(repo);

      let intentHint = input.intentHint;
      if (!intentHint && contextHash.includes("lint")) {
        intentHint = "BUGFIX";
      }

      const options: TraversalOptions = {
        maxDepth: input.maxDepth ?? 3,
        intentHint: intentHint as any,
      };

      const result = await traverser.traverse("*", "unknown.ts", contextHash, options, contextHash);
      repo.recordFeedbackEvent(result.nodes[0]?.node?.id ?? "unknown").catch(() => {});

      startNodes = result.nodes.map(n => ({
        id: n.node.id,
        type: n.node.type,
        abstractionLevel: n.node.abstractionLevel,
        relevanceScore: n.relevanceScore,
      }));

      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            nodes: startNodes,
            traversalMs: result.durationMs,
            truncated: result.truncated,
            queryMode,
          }),
        }],
      };
    }
    // No query criteria provided
    else {
      return { content: [{ type: "text", text: JSON.stringify({ error: "Provide at least one query criterion: nodeType, filePath, language, or semanticHash" }) }] };
    }

    // For non-traversal modes, return directly
    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          nodes: startNodes,
          traversalMs: 0,
          truncated: startNodes.length >= limit,
          queryMode,
        }),
      }],
    };
  } catch (err) {
    return { content: [{ type: "text", text: JSON.stringify({ error: String(err) }) }] };
  }
}

/**
 * cognition_validate — Validate code content against a cognition node's AST template.
 */
export async function handleCognitionValidate(
  input: CognitionValidateInput,
): Promise<{ content: { type: string; text: string }[] }> {
  try {
    if (!input.nodeId || !input.targetFileContent) {
      return { content: [{ type: "text", text: JSON.stringify({ error: "nodeId and targetFileContent are required" }) }] };
    }
    const repo = new CognitionRepository();
    const node = await repo.findNodeById(input.nodeId);
    if (!node) {
      return { content: [{ type: "text", text: JSON.stringify({ error: "Node not found: " + input.nodeId }) }] };
    }

    // Records feedback event (fire-and-forget)
    repo.recordFeedbackEvent(input.nodeId).catch(() => {});

    // If no template, return valid
    if (!node.astTemplate) {
      return {
        content: [{
          type: "text",
          text: JSON.stringify({ valid: true, violations: [] }),
        }],
      };
    }

    // Solve constraints
    const constraintResult = await solveConstraints([node], input.targetFileContent, node.astTemplate.language);

    const violations = constraintResult.validations.flatMap((v) =>
      v.failures.map((f) => ({
        constraintPath: f.constraintPath,
        expected: f.expected,
        actual: f.actual,
      })),
    );

    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          valid: violations.length === 0,
          violations,
          transformPatch: constraintResult.patches.length > 0 ? constraintResult.patches[0] : undefined,
        }),
      }],
    };
  } catch (err) {
    return { content: [{ type: "text", text: JSON.stringify({ error: String(err) }) }] };
  }
}

/**
 * cognition_feedback — Record user feedback and adjust edge weights.
 */
export async function handleCognitionFeedback(
  input: CognitionFeedbackInput,
): Promise<{ content: { type: string; text: string }[] }> {
  try {
    if (!input.nodeId || !input.outcome) {
      return { content: [{ type: "text", text: JSON.stringify({ error: "nodeId and outcome are required" }) }] };
    }
    const repo = new CognitionRepository();

    // Calculate weight delta
    let delta = 0;
    switch (input.outcome) {
      case "ACCEPTED": delta = 0.1; break;
      case "REJECTED": delta = -0.2; break;
      case "MODIFIED": delta = 0.05; break;
    }

    let updatedWeight: number | undefined;

    // Update edge weight if edgeId provided
    if (input.edgeId) {
      try {
        const result = await repo.updateEdgeWeight(input.edgeId, delta);
        updatedWeight = result.weight;
      } catch {
        // Edge may not exist; still record feedback
      }
    }

    // Record and resolve feedback event
    const { feedbackId } = await repo.recordFeedbackEvent(
      input.nodeId,
      input.edgeId,
      input.outcome,
      input.comment,
    );
    await repo.resolveFeedbackEvent(feedbackId, input.outcome, input.edgeId, delta);

    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          updatedWeight: updatedWeight ?? null,
          feedbackId,
        }),
      }],
    };
  } catch (err) {
    return { content: [{ type: "text", text: JSON.stringify({ error: String(err) }) }] };
  }
}
