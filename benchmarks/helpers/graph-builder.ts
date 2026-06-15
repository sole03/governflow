/**
 * Shared benchmark utilities: generate test graph data.
 * Copyright 2026 熊高锐 — Apache 2.0
 */
import { CognitionRepository, computeSemanticHash } from "../../src/storage/cognition-repository.js";
import { COGNITION_TYPES, EDGE_RELATIONS } from "../../src/storage/cognition-types.js";

const repo = new CognitionRepository();

/**
 * Build a chain of n nodes, each linked by PRECEDES edges.
 * Returns the ID of the first node.
 */
export async function buildChain(size: number): Promise<string> {
  const ids: string[] = [];
  for (let i = 0; i < size; i++) {
    const n = await repo.createNodeWithEdges({
      type: COGNITION_TYPES.HEURISTIC,
      semanticHash: computeSemanticHash("HEURISTIC", { benchIdx: i }),
      abstractionLevel: i % 4,
      payload: { benchIdx: i },
    });
    ids.push(n.id);
  }
  for (let i = 0; i < size - 1; i++) {
    await repo.createNodeWithEdges(
      { type: COGNITION_TYPES.CONSTRAINT, semanticHash: computeSemanticHash("CONSTRAINT", { benchEdge: i }), abstractionLevel: 0, payload: {} },
      [{ sourceId: ids[i], targetId: ids[i + 1], relation: EDGE_RELATIONS.PRECEDES }],
    );
  }
  return ids[0];
}

export async function cleanBenchData(): Promise<void> {
  const { getPrismaClient } = await import("../../src/storage/client.js");
  const prisma = getPrismaClient();
  await prisma.astTemplate.deleteMany();
  await prisma.cognitionEdge.deleteMany();
  await prisma.cognitionNode.deleteMany();
}
