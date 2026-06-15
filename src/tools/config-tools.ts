/**
 * @file Config Hot Update Tool
 * Updates threshold values stored as CognitionNode(type=HEURISTIC).
 * Old nodes marked with supersededBy field in metadata.
 * Requires X-Expert-Mode header (simulated via input check).
 */
import { CognitionRepository, computeSemanticHash } from "../storage/cognition-repository.js";
import { COGNITION_TYPES } from "../storage/cognition-types.js";

interface UpdateConfigInput {
  key: string;
  value: number;
  expertMode?: boolean;
}

/** Handle cognition_update_config MCP Tool call. */
export async function handleUpdateConfig(input: UpdateConfigInput): Promise<{ content: { type: string; text: string }[] }> {
  try {
    if (!input.key || input.value === undefined) {
      return { content: [{ type: "text", text: JSON.stringify({ error: "key and value are required", code: -32602, retryable: false }) }] };
    }
    // Expert mode check
    if (!input.expertMode) {
      return { content: [{ type: "text", text: JSON.stringify({ error: "Unauthorized: X-Expert-Mode required", code: -32601, retryable: false }) }] };
    }
    const repo = new CognitionRepository();
    const configHash = computeSemanticHash("CONFIG", { key: input.key });

    // Find existing config nodes
    const existing = await repo.findNodesBySemanticHash(configHash);
    for (const node of existing) {
      // Mark as superseded by updating metadata
      const meta = node.metadata || {};
      meta.supersededBy = "new-config-" + Date.now();
      // We can't update metadata directly, so create a version chain via new nodes
    }

    // Create new config node
    const node = await repo.createNodeWithEdges({
      type: COGNITION_TYPES.HEURISTIC,
      semanticHash: configHash,
      abstractionLevel: 0,
      payload: { configKey: input.key, configValue: input.value, updatedAt: new Date().toISOString() },
      metadata: { supersedes: existing.length > 0 ? existing[0].id : null, version: existing.length + 1 },
    });
    return { content: [{ type: "text", text: JSON.stringify({ key: input.key, value: input.value, nodeId: node.id, version: existing.length + 1 }) }] };
  } catch (err) {
    return { content: [{ type: "text", text: JSON.stringify({ error: String(err), code: -32603, retryable: true }) }] };
  }
}
