# Legacy Engine — @deprecated

> **Status:** @deprecated — preserved as reference for the cognition-engine rewrite.
> **Do NOT modify.** The new src/cognition-engine/ module replaces this entire subsystem.

## Purpose

The legacy engine was the original matching/rules subsystem of the MCP Rule Engine. It used a combination of:

- **Tree-sitter AST parsing** (via web-tree-sitter WASM) for code structure analysis
- **Structural signature matching** (Merkle-tree style) for diff computation
- **Rule scoring** with tag/path/content-based matching and time decay
- **Token budgeting** for session-level LLM context injection
- **Regex fallback** when WASM parsing was unavailable

## Files

| File | Role | Reuse Potential |
|------|------|----------------|
| st-node.ts | computeSignature(), uildSignatureMap() — structural hashing | **HIGH** — signature computation reusable in AST Constraint Solver |
| st-diff.ts | computeDiff() — tree diff with MOVE detection | **HIGH** — diff algorithm informs Graph Traverser |
| parsers.ts | parseToAST() — Tree-sitter WASM wrapper with fallback | **HIGH** — parsing layer fully reusable as-is |
| egex-fallback.ts | Line-based diff when WASM fails | **LOW** — replaced by AST-native fallback |
| ule-matcher.ts | Tag/path scoring, matchRules() | **REPLACED** — replaced by Graph Traverser |
| ule-generator.ts | Pattern-based rule candidate eval | **REPLACED** — replaced by Intent Recognizer |
| 	oken-controller.ts | Session token budgeting for LLM injection | **KEPT** — moved to storage layer (already cross-cutting) |

## Dependency Flow (original)

parsers.ts → ast-node.ts → ast-diff.ts → rule-matcher.ts / rule-generator.ts
                                                    ↓
                                              token-controller.ts (shared utility)