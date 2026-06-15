# API Reference

Auto-generated from JSDoc comments. Generated: 2026-06-15

---

## Module: `cognition-engine/ast-constraint-solver`

> Copyright 2026 熊高锐 Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0 Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License. /

### `parseConstraintDsl`

Copyright 2026 熊高锐 Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0 Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License. /

```typescript
/**
 * @file AST Constraint Solver
 * Transforms cognition AstTemplate DSL into executable AST constraints.
 * Outputs structured validation results and transform patches.
 * NEVER generates natural language — all output is machine-readable.
 *
 * Reuses: legacy-engine/ast-node.ts (computeSignature), legacy-engine/parsers.ts (parseToAST)
 */

import { computeSignature } from "../legacy-engine/ast-node.js";
import { parseToAST } from "../legacy-engine/parsers.js";
import type { ASTNode, NodeSignature } from "../types.js";
import type { CognitionNodeData } from "../storage/cognition-types.js";
import type {
  AstConstraint,
  FieldConstraint,
  ValidationResult,
  ValidationFailure,
  TransformPatch,
  TransformOp,
} from "./types.js";

// ── DSL Parser ────────────────────────────────────────────

/**
 * Parse templateDsl JSON string into AstConstraint array.
 */
export function parseConstraintDsl
```

### `bindConstraints`

Map of placeholder → bound value

```typescript
bindings: Record<string, string>;
}

/**
 * Bind {{placeholder}} values in a constraint to actual AST node text.
 * Walks the AST to find nodes matching each constraint's nodeType,
 * then extracts text values for placeholders.
 */
export function bindConstraints
```

### `validateConstraints`

Extract a field value from an AST node.Simplified: checks node type match, then children for field values./

```typescript
function extractFieldValue(ast: ASTNode, nodeType: string, field: string): string | null {
  const matchingNodes = findNodesByType(ast, nodeType);
  if (matchingNodes.length === 0) return null;

  const node = matchingNodes[0];
  // Check if any child's type matches the field name
  for (const child of node.children) {
    if (child.type === field) {
      return child.text;
    }
  }
  // Fallback: return node text itself
  return field === "name" ? node.text : null;
}

function findNodesByType(node: ASTNode, type: string): ASTNode[] {
  const results: ASTNode[] = [];
  if (node.type === type) results.push(node);
  for (const child of node.children) {
    results.push(...findNodesByType(child, type));
  }
  return results;
}

// ── Constraint Validation ─────────────────────────────────

/**
 * Validate an AST against a set of bound constraints.
 *
 * @param constraints  Parsed + bound AstConstraint array
 * @param nodeId       Source cognition node ID (for traceability)
 * @param templateDsl  Original template DSL string
 * @param ast          Target AST to validate
 * @returns Structured validation result
 */
export function validateConstraints
```

### `generatePatchFromFailures`

Generate a transform patch from validation failures.Creates operations that would fix the validation failures./

```typescript
export function generatePatchFromFailures
```

### `solveConstraints`

Run the full constraint-solving pipeline:  1. Parse templateDSL from cognition nodes  2. Parse file content to AST  3. Bind {{placeholder}} values  4. Validate constraints  5. Generate transform patches@param cognitionNodes  Nodes with astTemplate to check@param fileContent     Source code to validate against@param language        Language for AST parsing@returns Validation + patch results/

```typescript
export async function solveConstraints
```

**Parameters:**

| Name | Description |
|------|-------------|
| `cognitionNodes` | Nodes with astTemplate to check |
| `fileContent` | Source code to validate against |
| `language` | Language for AST parsing |

**Returns:** Validation + patch results

---

## Module: `cognition-engine/constraint-validator`

> Copyright 2026 熊高锐 Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0 Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License. / Reuses Phase 3 AstTemplate DSL parser for dual-mode validation. /

### `validateCode`

Copyright 2026 熊高锐 Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0 Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License. /

```typescript
/**
 * @file Constraint Validator — Trust & Governance Layer
 * Reuses Phase 3 AstTemplate DSL parser for dual-mode validation.
 */
import { parseConstraintDsl, validateConstraints } from "../cognition-engine/ast-constraint-solver.js";
import { CognitionRepository } from "../storage/cognition-repository.js";

export type ValidationMode = "REJECT" | "WARN";
export type RuleLevel = "GLOBAL" | "PROJECT";

export interface ConstraintViolation {
  ruleId: string;
  ruleLevel: RuleLevel;
  mode: ValidationMode;
  constraintPath: string;
  expected: string;
  actual: string;
  message: string;
}

export interface ValidationReport {
  passed: boolean;
  violations: ConstraintViolation[];
  hardBlocks: number;
  softWarnings: number;
}

/** Validate code content against constraints. */
export async function validateCode
```

---

## Module: `cognition-engine/index`

> Copyright 2026 熊高锐 Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0 Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License. /

### `analyzeCodeContext`

Copyright 2026 熊高锐 Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0 Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License. /

```typescript
/**
 * @file Cognition Engine — unified entry point.
 *
 * The cognition engine replaces the legacy rule-matcher with a
 * three-component pipeline:
 *
 *   1. IntentRecognizer — classifies diff type (REFACTOR / BUGFIX / BOILERPLATE)
 *   2. GraphTraverser  — weighted BFS over cognition graph
 *   3. AstConstraintSolver — transforms templates into AST-level checks
 *
 * Usage:
 *   import { analyzeCodeContext } from "./cognition-engine/index.js";
 *   const result = await analyzeCodeContext(lang, path, content);
 */

export { recognizeIntent } from "./intent-recognizer.js";
export type { IntentResult, IntentType } from "./types.js";

export { GraphTraverser } from "./graph-traverser.js";
export type { TraversalOptions, TraversalResult, ScoredCognitionNode } from "./types.js";

export {
  solveConstraints,
  parseConstraintDsl,
  bindConstraints,
  validateConstraints,
  generatePatchFromFailures,
} from "./ast-constraint-solver.js";
export type { AstConstraint, FieldConstraint, ValidationResult, TransformPatch } from "./types.js";

import { recognizeIntent } from "./intent-recognizer.js";
import { GraphTraverser } from "./graph-traverser.js";
import { solveConstraints } from "./ast-constraint-solver.js";
import type { TraversalResult, ValidationResult, TransformPatch, IntentResult } from "./types.js";

/**
 * Full pipeline: analyze diff → traverse graph → solve AST constraints.
 * The one-shot entry point for the cognition engine.
 */
export async function analyzeCodeContext
```

---

## Module: `cognition-engine/intent-recognizer`

> Copyright 2026 熊高锐 Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0 Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License. /

### `recognizeIntent`

Copyright 2026 熊高锐 Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0 Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License. /

```typescript
/**
 * @file Intent Recognizer
 * Analyzes code diffs and classifies the developer intent behind them.
 * Maps to three intent levels: REFACTOR, BUGFIX, BOILERPLATE.
 * The result biases Graph Traverser traversal strategy.
 *
 * Reuses: legacy-engine/parsers.ts (parseToAST) for optional AST analysis
 */

import { parseToAST } from "../legacy-engine/parsers.js";
import type { ASTNode } from "../types.js";
import type { IntentResult, IntentType } from "./types.js";

// ── Constants ─────────────────────────────────────────────

const REFACTOR_THRESHOLD = { minFiles: 2, minAddedRatio: 0.3, minNodeTypes: 3 };
const BUGFIX_THRESHOLD = { maxFiles: 2, maxChangedLines: 50, errorKeywordRatio: 0.1 };
const BOILERPLATE_THRESHOLD = { addRemoveRatio: 5.0, minAddedLines: 20 };

const ERROR_KEYWORDS = [
  "error", "undefined", "null", "catch", "throw", "try",
  "fail", "invalid", "missing", "fallback", "guard", "check",
  "assert", "validate", "optional", "??", "?. ", "??=",
];

const REFACTOR_KEYWORDS = [
  "extract", "rename", "move", "split", "merge", "inline",
  "abstract", "interface", "type",
];

// ── Diff Parsing ──────────────────────────────────────────

interface DiffStats {
  filesChanged: number;
  addedLines: number;
  removedLines: number;
  perFile: Map<string, { added: number; removed: number }>;
  hunks: number;
}

function parseDiffStats(diffContent: string): DiffStats {
  const stats: DiffStats = {
    filesChanged: 0,
    addedLines: 0,
    removedLines: 0,
    perFile: new Map(),
    hunks: 0,
  };

  let currentFile = "unknown";
  for (const line of diffContent.split("\n")) {
    if (line.startsWith("diff --git ")) {
      stats.filesChanged++;
      const match = line.match(/diff --git a\/(.+) b\//);
      if (match) currentFile = match[1];
      if (!stats.perFile.has(currentFile)) {
        stats.perFile.set(currentFile, { added: 0, removed: 0 });
      }
    } else if (line.startsWith("@@ ")) {
      stats.hunks++;
    } else if (line.startsWith("+") && !line.startsWith("+++")) {
      stats.addedLines++;
      const pf = stats.perFile.get(currentFile);
      if (pf) pf.added++;
    } else if (line.startsWith("-") && !line.startsWith("---")) {
      stats.removedLines++;
      const pf = stats.perFile.get(currentFile);
      if (pf) pf.removed++;
    }
  }
  return stats;
}

// ── Node Type Analysis ────────────────────────────────────

async function analyzeNodeTypes(
  diffContent: string,
  filePath?: string,
): Promise<string[]> {
  const nodeTypes = new Set<string>();
  const lines = diffContent.split("\n");

  // Try AST analysis on file content (best effort)
  if (filePath) {
    for (const line of lines) {
      if (line.startsWith("+") && !line.startsWith("+++")) {
        const code = line.slice(1).trim();
        if (code.length > 3) {
          try {
            const lang = filePath.endsWith(".ts") || filePath.endsWith(".tsx")
              ? "typescript" : filePath.endsWith(".py") ? "python" : "javascript";
            const result = await parseToAST(code, lang);
            collectNodeTypes(result.ast, nodeTypes);
          } catch {
            // Silently continue — AST analysis is best-effort
          }
        }
      }
    }
  }

  // Fallback: keyword-based detection
  const allText = lines.filter(l => l.startsWith("+") || l.startsWith("-")).join(" ").toLowerCase();
  if (!nodeTypes.size) {
    const keywordMap: Record<string, string[]> = {
      function_declaration: ["function", "=>", "=>"],
      class_declaration: ["class "],
      variable_declaration: ["const ", "let ", "var "],
      if_statement: ["if ", "else "],
      try_statement: ["try ", "catch ", "finally"],
      import_statement: ["import ", "require("],
      export_statement: ["export "],
      interface_declaration: ["interface "],
      type_alias: ["type ", "| ", "& "],
      return_statement: ["return "],
    };
    for (const [nt, keywords] of Object.entries(keywordMap)) {
      if (keywords.some(k => allText.includes(k))) {
        nodeTypes.add(nt);
      }
    }
  }

  return [...nodeTypes];
}

function collectNodeTypes(node: ASTNode, types: Set<string>): void {
  types.add(node.type);
  for (const child of node.children) {
    collectNodeTypes(child, types);
  }
}

// ── Intent Classification ─────────────────────────────────

function classifyIntent(
  stats: DiffStats,
  nodeTypes: string[],
  diffContent: string,
): { intent: IntentType; confidence: number; reasoning: string[] } {
  const totalChanged = stats.addedLines + stats.removedLines;
  const addRemoveRatio = stats.removedLines > 0
    ? stats.addedLines / stats.removedLines
    : stats.addedLines > 0 ? Infinity : 0;
  const allText = diffContent.toLowerCase();
  const errorHits = ERROR_KEYWORDS.filter(k => allText.includes(k)).length;
  const errorRatio = allText.length > 0 ? errorHits / (allText.split("\n").length) : 0;
  const refactorHits = REFACTOR_KEYWORDS.filter(k => allText.includes(k)).length;
  const uniqueNodeTypes = new Set(nodeTypes);

  const reasoning: string[] = [];
  let scores = { refactor: 0, bugfix: 0, boilerplate: 0 };

  // REFACTOR signals
  if (stats.filesChanged >= REFACTOR_THRESHOLD.minFiles) {
    scores.refactor += 0.3;
    reasoning.push(`multi-file change (${stats.filesChanged} files)`);
  }
  if (uniqueNodeTypes.size >= REFACTOR_THRESHOLD.minNodeTypes) {
    scores.refactor += 0.2;
    reasoning.push(`diverse AST types affected (${uniqueNodeTypes.size} types)`);
  }
  if (refactorHits > 2) {
    scores.refactor += 0.2;
    reasoning.push('refactoring keywords detected');
  }
  if (stats.hunks > 3 && stats.filesChanged > 1) {
    scores.refactor += 0.3;
    reasoning.push('cross-module structural changes');
  }

  // BUGFIX signals
  if (totalChanged <= BUGFIX_THRESHOLD.maxChangedLines) {
    scores.bugfix += 0.2;
    reasoning.push(`small change footprint (${totalChanged} lines)`);
  }
  if (stats.filesChanged <= BUGFIX_THRESHOLD.maxFiles) {
    scores.bugfix += 0.1;
  }
  if (errorRatio >= BUGFIX_THRESHOLD.errorKeywordRatio) {
    scores.bugfix += 0.3;
      reasoning.push('error-handling keywords present');
  }
  if (uniqueNodeTypes.has("try_statement") || uniqueNodeTypes.has("if_statement")) {
    scores.bugfix += 0.2;
    reasoning.push(`conditional / guard patterns`);
  }

  // BOILERPLATE signals
  if (addRemoveRatio >= BOILERPLATE_THRESHOLD.addRemoveRatio) {
    scores.boilerplate += 0.3;
    reasoning.push(`high add/remove ratio (${addRemoveRatio.toFixed(1)})`);
  }
  if (stats.addedLines >= BOILERPLATE_THRESHOLD.minAddedLines && stats.removedLines < 5) {
    scores.boilerplate += 0.3;
    reasoning.push('net-new code addition');
  }
  if (uniqueNodeTypes.size <= 2 && stats.addedLines > 10) {
    scores.boilerplate += 0.2;
    reasoning.push('repetitive / template-like structure');
  }
  
  const maxScore = Math.max(scores.refactor, scores.bugfix, scores.boilerplate);
  if (maxScore === 0) {
    return { intent: "BUGFIX", confidence: 0.3, reasoning: ["no clear signal"] };
  }
  
  let intent: IntentType;
  if (scores.refactor >= maxScore && scores.refactor >= 0.4) intent = "REFACTOR";
  else if (scores.boilerplate >= maxScore && scores.boilerplate >= 0.3) intent = "BOILERPLATE";
  else intent = "BUGFIX";

  const confidence = Math.min(0.95, maxScore + 0.2);

  if (reasoning.length === 0) reasoning.push("default classification");
  return { intent, confidence, reasoning };
}

// ── Public API ────────────────────────────────────────────

/**
 * Analyze a code diff and classify the developer intent.
 *
 * @param diffContent  Unified diff text (from git diff output)
 * @param filePath     Optional file path for AST analysis
 * @returns Structured intent classification
 */
export async function recognizeIntent
```

---

## Module: `cognition-engine/types`

> Copyright 2026 熊高锐 Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0 Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License. /

### `AstConstraint`

Copyright 2026 熊高锐 Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0 Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License. /

```typescript
/**
 * @file Cognition Engine — type definitions.
 * These types are specific to the cognition engine pipeline.
 * Shared types consumed by tools live in ../types.js.
 */

import type {
  CognitionNodeData,
  CognitionEdgeData,
  CognitionTypeStr,
  EdgeRelationStr,
} from "../storage/cognition-types.js";

// ── Intent Recognition ────────────────────────────────────

export type IntentType = "REFACTOR" | "BUGFIX" | "BOILERPLATE";

export interface IntentResult {
  intent: IntentType;
  confidence: number; // 0.0 – 1.0
  reasoning: string[];
  /** Diff statistics used for classification. */
  stats: {
    addedLines: number;
    removedLines: number;
    filesChanged: number;
    nodeTypeChanges: string[];
  };
}

// ── Graph Traversal ───────────────────────────────────────

export interface TraversalOptions {
  /** Max BFS depth. Default 5. */
  maxDepth?: number;
  /** Minimum relevance score [0, 1] to include in results. */
  minRelevance?: number;
  /** Optional intent hint to bias edge weights. */
  intentHint?: IntentType;
  /** If set, only include nodes at these abstraction levels. */
  abstractionLevelFilter?: number[];
  /** Hard timeout in ms. Default 500. */
  maxDurationMs?: number;
}

export interface ScoredCognitionNode {
  node: CognitionNodeData;
  relevanceScore: number;
  /** Path trace: how this node was reached (edge trail). */
  trace: string[];
}

export interface TraversalResult {
  nodes: ScoredCognitionNode[];
  edges: CognitionEdgeData[];
  durationMs: number;
  truncated: boolean;
}

// ── AST Constraint Solving ────────────────────────────────

/** DSL constraint: must be JSON-serializable for storage. */
export interface AstConstraint
```

---

## Module: `legacy-engine/parsers`

### `parseToAST`

Copyright 2026 熊高锐 Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0 Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License. /

```typescript
/**
 * @deprecated LEGACY ENGINE MODULE — Preserved for reference only.
 * Do NOT modify. The new cognition-engine module replaces this entire subsystem.
 * See src/cognition-engine/ for the replacement.
 */

import { fileURLToPath } from "node:url";
import path from "node:path";
import { ASTNode, AtomicOp, DiffResult } from "../types.js";
import { computeDiff } from "./ast-diff.js";
import { regexDiff } from "./regex-fallback.js";

// ── Path Resolution ──────────────────────────────────────────
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "../..");

const WASM_PATHS: Record<string, string> = {
  javascript: path.join(projectRoot, "node_modules", "tree-sitter-javascript", "tree-sitter-javascript.wasm"),
  typescript: path.join(projectRoot, "node_modules", "tree-sitter-typescript", "tree-sitter-typescript.wasm"),
  tsx:        path.join(projectRoot, "node_modules", "tree-sitter-typescript", "tree-sitter-tsx.wasm"),
  python:     path.join(projectRoot, "node_modules", "tree-sitter-python", "tree-sitter-python.wasm"),
};

function getLanguageForFile(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".tsx") return "tsx";
  if (ext === ".ts") return "typescript";
  if (ext === ".js" || ext === ".jsx" || ext === ".mjs" || ext === ".cjs") return "javascript";
  if (ext === ".py") return "python";
  return "javascript"; // default fallback
}

// ── Tree-sitter WASM Initialization ──────────────────────────
let tsInitialized = false;
let tsFailed = false;
const grammarCache = new Map<string, any>();
let ParserModule: any = null;

async function ensureTreeSitter(): Promise<boolean> {
  if (tsInitialized) return true;
  if (tsFailed) return false;
  try {
    ParserModule = await import("web-tree-sitter");
    await ParserModule.Parser.init();
    tsInitialized = true;
    return true;
  } catch (err) {
    tsFailed = true;
    console.error("[parsers] web-tree-sitter init failed:", err);
    return false;
  }
}

async function loadGrammar(language: string): Promise<any> {
  if (grammarCache.has(language)) return grammarCache.get(language);
  const wasmPath = WASM_PATHS[language];
  if (!wasmPath) throw new Error(`No WASM path for language: ${language}`);

  const fs = await import("node:fs");
  if (!fs.existsSync(wasmPath)) {
    throw new Error(`WASM file not found: ${wasmPath}`);
  }

  const lang = await ParserModule.Language.load(wasmPath);
  grammarCache.set(language, lang);
  return lang;
}

// ── Tree-sitter → ASTNode Conversion ────────────────────────
function treeSitterToAST(node: any): ASTNode {
  return {
    type: node.type,
    text: node.text,
    startByte: node.startIndex,
    endByte: node.endIndex,
    children: node.namedChildren.map((c: any) => treeSitterToAST(c)),
  };
}

// ── Public API ───────────────────────────────────────────────

export interface ParserResult {
  ast: ASTNode;
  language: string;
  parseSuccess: boolean;
}

/** Parse code to AST using web-tree-sitter, falling back to line-based AST on failure. */
export async function parseToAST
```

### `computeDiffWithFallback`

Compute diff with automatic AST → regex fallback chain.

```typescript
export async function computeDiffWithFallback
```

---

## Module: `resources/cognition-resources`

> Copyright 2026 熊高锐 Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0 Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License. /

### `readCognitionSchema`

Copyright 2026 熊高锐 Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0 Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License. /

```typescript
/**
 * @file Cognition Engine MCP Resources
 * Exposes three resources for Agent discovery:
 *   cognition://schema  — Graph data model JSON Schema
 *   cognition://stats   — Graph statistics (node/edge counts)
 *   cognition://docs    — Integration documentation
 */

import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { getPrismaClient } from "../storage/client.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, "../..");

// ── Resource Definitions ───────────────────────────────────

export const RESOURCES = [
  {
    uri: "cognition://schema",
    name: "Cognition Graph Schema",
    description: "JSON Schema of the cognition graph data model, including CognitionNode, CognitionEdge, and AstTemplate tables and their relationships.",
    mimeType: "application/json",
  },
  {
    uri: "cognition://stats",
    name: "Cognition Engine Statistics",
    description: "Current graph statistics: node count, edge count, feedback event count, and average traversal latency. Useful for health checks and capacity planning.",
    mimeType: "application/json",
  },
  {
    uri: "cognition://docs",
    name: "Cognition Engine Documentation",
    description: "Full MCP tool documentation from docs/phase4-mcp-feedback.md. Agents can read this to learn how to use cognition_query, cognition_validate, and cognition_feedback.",
    mimeType: "text/markdown",
  },
  {
    uri: "cognition://rules-changelog",
    name: "Rules Changelog",
    description: "Versioned changelog of global rule changes. Returns version = SHA-256 prefix of updated_at field. Agents must read this before making rule modifications.",
    mimeType: "application/json",
  },
];

// ── Resource Readers ──────────────────────────────────────

/** Return the JSON schema for the cognition graph data model. */
export async function readCognitionSchema
```

### `readCognitionStats`

Return current graph statistics with approval rate.

```typescript
export async function readCognitionStats
```

### `readCognitionDocs`

Return the integration documentation markdown.

```typescript
export async function readCognitionDocs
```

---

## Module: `storage/client`

### `resetPrismaClient`

Copyright 2026 熊高锐 Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0 Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License. /

```typescript
import { PrismaClient } from "@prisma/client";

let client: PrismaClient | null = null;

export function getPrismaClient(): PrismaClient {
  if (!client) {
    client = new PrismaClient({ log: ["warn", "error"] });
    // Enable SQLite WAL mode for concurrent read/write performance (P1)
    client.$queryRawUnsafe("PRAGMA journal_mode=WAL").catch(() => {});
  }
  return client;
}

export async function disconnectPrisma(): Promise<void> {
  if (client) {
    await client.$disconnect();
    client = null;
  }
}

/**
 * Reset the Prisma client singleton, optionally with a new DATABASE_URL.
 * Used by vitest setup to give each worker an isolated database file,
 * preventing cross-worker FK race conditions.
 * Calling with no URL re-creates the client with the current env var value.
 */
export async function resetPrismaClient
```

---

## Module: `storage/cognition-repository`

### `computeSemanticHash`

Copyright 2026 熊高锐 Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0 Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License. /

```typescript
import { Prisma } from "@prisma/client";
import { getPrismaClient } from "./client.js";
import {
  CognitionTypeStr,
  EdgeRelationStr,
  CognitionNodeInput,
  CognitionEdgeInput,
  AstTemplateInput,
  CognitionNodeData,
  CognitionEdgeData,
  AstTemplateData,
  SubgraphResult,
  COGNITION_TYPES,
  EDGE_RELATIONS,
} from "./cognition-types.js";

// ── Helpers ────────────────────────────────────────────────

/** Simple hash for semantic dedup. Consistent with ast-node.ts legacy style. */
function simpleHash(s: string): string {
  if (!s) return "0";
  let hash = 0;
  for (let i = 0; i < s.length; i++) {
    hash = ((hash << 5) - hash) + s.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(16);
}

/** Generate a semantic hash from type + payload for deduplication. */
export function computeSemanticHash
```

### `isValidCognitionType`

Validate that a type string is a valid CognitionType.

```typescript
export function isValidCognitionType
```

### `isValidEdgeRelation`

Validate that a relation string is a valid EdgeRelation.

```typescript
export function isValidEdgeRelation
```

---

## Module: `storage/cognition-types`

### `COGNITION_TYPES`

Copyright 2026 熊高锐 Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0 Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License. /

```typescript
// ── Cognition Graph Type Definitions ───────────────────────
// Independent from src/types.ts. Do NOT modify existing types.
// Use String for JSON fields (SQLite limitation, consistent with codebase conventions).

/** Valid cognition node type values. */
export const COGNITION_TYPES
```

### `EDGE_RELATIONS`

Valid edge relation values.

```typescript
export const EDGE_RELATIONS
```

### `ABSTRACTION_LEVELS`

Abstraction levels for cognition nodes.

```typescript
export const ABSTRACTION_LEVELS
```

### `SubgraphResult`

Structured data only (AST template JSON, constraint expressions). NEVER natural language.

```typescript
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
export interface SubgraphResult
```

---

## Module: `tools/cognition-tools`

> Copyright 2026 熊高锐 Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0 Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License. /

### `handleCognitionQuery`

Copyright 2026 熊高锐 Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0 Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License. /

```typescript
/**
 * @file Cognition engine MCP Tool handlers.
 * Three new tools for the MCP protocol:
 *   cognition_query    — Query the cognition graph
 *   cognition_validate — Validate code against AST templates
 *   cognition_feedback — Provide feedback to update edge weights
 *
 * These are independent from legacy tools in this directory.
 */

import { GraphTraverser } from "../cognition-engine/graph-traverser.js";
import { recognizeIntent } from "../cognition-engine/intent-recognizer.js";
import { solveConstraints } from "../cognition-engine/ast-constraint-solver.js";
import { CognitionRepository } from "../storage/cognition-repository.js";
import type { TraversalOptions } from "../cognition-engine/types.js";

// ── Input Types ─────────────────────────────────────────────

interface CognitionQueryInput {
  contextHash: string;
  intentHint?: "REFACTOR" | "BUGFIX" | "BOILERPLATE";
  maxDepth?: number;
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
 */
export async function handleCognitionQuery
```

### `handleCognitionValidate`

cognition_validate — Validate code content against a cognition node's AST template./

```typescript
export async function handleCognitionValidate
```

### `handleCognitionFeedback`

cognition_feedback — Record user feedback and adjust edge weights./

```typescript
export async function handleCognitionFeedback
```

---

## Module: `tools/config-tools`

> Copyright 2026 熊高锐 Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0 Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License. / Updates threshold values stored as CognitionNode(type=HEURISTIC). Old nodes marked with supersededBy field in metadata. Requires X-Expert-Mode header (simulated via input check). /

### `handleUpdateConfig`

Copyright 2026 熊高锐 Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0 Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License. /

```typescript
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
export async function handleUpdateConfig
```

---

## Module: `tools/injection-approval`

> Copyright 2026 熊高锐 Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0 Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License. / Manages proposal-based approval workflow with TTL. Proposal lifecycle: implicit CREATE (via query/validate) -> explicit APPROVE/REJECT/OVERRIDE. /

### `createProposal`

Copyright 2026 熊高锐 Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0 Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License. /

```typescript
/**
 * @file Injection Approval Tool
 * Manages proposal-based approval workflow with TTL.
 * Proposal lifecycle: implicit CREATE (via query/validate) -> explicit APPROVE/REJECT/OVERRIDE.
 */

import { CognitionRepository } from "../storage/cognition-repository.js";
import { getPrismaClient } from "../storage/client.js";
import { writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const LOG_DIR = join(__dirname, "../../logs");
const TTL_MS = 5 * 60 * 1000; // 5 minutes

interface Proposal {
  proposalId: string;
  contextHash: string;
  createdAt: number;
  expiresAt: number;
  status: "PENDING" | "APPROVED" | "REJECTED" | "OVERRIDDEN" | "EXPIRED";
  nodeIds: string[];
}

const proposals = new Map<string, Proposal>();

function generateId(): string {
  return "prop_" + Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
}

/** Create a new proposal implicitly (called after query/validate). */
export function createProposal
```

### `handleApproveInjection`

Handle cognition_approve_injection MCP Tool call.

```typescript
export async function handleApproveInjection
```

### `getProposalStats`

Record audit event (async, non-blocking).

```typescript
async function recordAuditLog(eventType: string, props: Record<string, unknown>): Promise<void> {
  try {
    const prisma = getPrismaClient();
    await prisma.metricEvent.create({ data: { eventType, properties: JSON.stringify({ ...props, timestamp: new Date().toISOString() }) } });
  } catch {
    // Fallback to local log file
    try {
      if (!existsSync(LOG_DIR)) mkdirSync(LOG_DIR, { recursive: true });
      writeFileSync(join(LOG_DIR, "fallback.log"), JSON.stringify({ eventType, props, timestamp: new Date().toISOString() }) + "\n", { flag: "a" });
    } catch { /* silent */ }
  }
}

/** Get proposal stats. */
export function getProposalStats
```

---

## Module: `types`

### `ASTNode`

Copyright 2026 熊高锐 Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0 Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License. /

```typescript
export interface ASTNode
```

### `SKIP_PATTERNS`

Optional file content for pattern matching. If empty, content-based matching is skipped.

```typescript
fileContent?: string;
}

export interface ScoredRule {
  rule: Rule;
  score: number;
  matchReasons: string[];
}

export interface MatchResult {
  rules: ScoredRule[];
  totalTokens: number;
  truncated: boolean;
  queryDurationMs: number;
}

export type ConflictResolution = "keep_a" | "keep_b" | "merge" | "skip";

export interface ConflictInfo {
  id: string;
  ruleA: Rule;
  ruleB: Rule;
  scopeKey: string;
  resolution?: ConflictResolution;
  createdAt: Date;
}

export interface CaptureDiffInput {
  filePath: string;
  originalContent: string;
  modifiedContent: string;
  language: string;
  projectId?: string;
}

export interface QueryRulesInput {
  language: string;
  filePath: string;
  projectId?: string;
  tags?: string[];
  taskId?: string;
}

export interface ConfirmRuleInput {
  ruleId: string;
  action: "accept" | "reject" | "edit" | "skip";
  editedPattern?: string;
  editedSuggestion?: string;
}

export interface ResolveConflictInput {
  conflictId: string;
  resolution: ConflictResolution;
  batchAllSession?: boolean;
}

export interface ListRulesInput {
  language?: string;
  scope?: RuleScope;
  status?: RuleStatus;
  projectId?: string;
  limit?: number;
  offset?: number;
}

export const DEFAULT_WEIGHTS = {
  typeWeight: 0.4,
  timeWeight: 0.3,
  matchWeight: 0.3,
  timeDecayLambda: 0.01,
} as const;

export const SCOPE_PRIORITIES: Record<RuleScope, number> = {
  project: 1.0,
  user: 0.8,
  global: 0.5,
};

export const TOKEN_LIMITS = {
  maxInjectionTokens: 2000,
  maxSingleRuleTokens: 100,
  maxRulesPerProject: 2000,
  maxRulesGlobal: 3000,
} as const;

export const RULE_GENERATION_THRESHOLDS = {
  minDistinctFiles: 3,
  minRepeatsInDays: 5,
  repeatWindowDays: 7,
} as const;
 
export interface AnalyzeWorkspaceInput {
  baseCommit: string;
  headCommit?: string;
  paths?: string[];
  taskId?: string;
  /** Concurrent analysis: max files processed in parallel. Defaults to 5 or CPU core count. */
  concurrency?: number;
  fileContents?: { path: string; originalContent?: string; modifiedContent: string }[];
}
 
 export interface AnalyzeResult {
   analyzedFiles: number;
   skippedFiles: number;
   generatedRules: { rule: RuleSpec; filePath: string }[];
   conflicts: { ruleA: RuleSpec; ruleB: RuleSpec; reason: string }[];
   errors: { filePath: string; error: string }[];
 }
 
 /** File extensions to skip in workspace analysis */
 export const SKIP_PATTERNS
```

---
