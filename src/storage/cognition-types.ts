// ── Cognition Graph Type Definitions ───────────────────────
// Independent from src/types.ts. Do NOT modify existing types.
// Use String for JSON fields (SQLite limitation, consistent with codebase conventions).

/** Valid cognition node type values. */
export const COGNITION_TYPES = {
  INTENT: "INTENT",
  CONSTRAINT: "CONSTRAINT",
  HEURISTIC: "HEURISTIC",
  PATTERN: "PATTERN",
} as const;

export type CognitionTypeStr = (typeof COGNITION_TYPES)[keyof typeof COGNITION_TYPES];

/** Valid edge relation values. */
export const EDGE_RELATIONS = {
  CAUSES: "CAUSES",
  PRECEDES: "PRECEDES",
  MUTEX: "MUTEX",
  GENERALIZES: "GENERALIZES",
  REFINES: "REFINES",
} as const;

export type EdgeRelationStr = (typeof EDGE_RELATIONS)[keyof typeof EDGE_RELATIONS];

/** Abstraction levels for cognition nodes. */
export const ABSTRACTION_LEVELS = {
  CONCRETE: 0,
  FUNCTION: 1,
  MODULE: 2,
  ARCHITECTURE: 3,
} as const;

// ── Input types (for write operations) ─────────────────────

export interface CognitionNodeInput {
  type: CognitionTypeStr;
  semanticHash: string;
  abstractionLevel: number;
  /** Structured data only (AST template JSON, constraint expressions). NEVER natural language. */
  payload: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export interface CognitionEdgeInput {
  sourceId: string;
  targetId: string;
  relation: EdgeRelationStr;
  weight?: number;
  metadata?: Record<string, unknown>;
}

export interface AstTemplateInput {
  nodeId: string;
  language: string;
  /** DSL/JSON pattern for AST-level validation or transformation. NEVER natural language. */
  templateDsl: string;
  /** JSON Schema for validating templateDsl content. */
  validationSchema?: Record<string, unknown>;
}

// ── Output types (for read operations) ─────────────────────

export interface CognitionNodeData {
  id: string;
  type: CognitionTypeStr;
  semanticHash: string;
  abstractionLevel: number;
  payload: Record<string, unknown>;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
  astTemplate: AstTemplateData | null;
}

export interface CognitionEdgeData {
  id: string;
  sourceId: string;
  targetId: string;
  relation: EdgeRelationStr;
  weight: number;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
}

export interface AstTemplateData {
  id: string;
  nodeId: string;
  language: string;
  templateDsl: string;
  validationSchema: Record<string, unknown> | null;
  createdAt: Date;
}

/** Result of a subgraph traversal. */
export interface SubgraphResult {
  nodes: CognitionNodeData[];
  edges: CognitionEdgeData[];
}