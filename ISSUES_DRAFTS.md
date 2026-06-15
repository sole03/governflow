---
title: 'Add JSDoc to GraphTraverser class and public methods'
labels: ['good first issue', 'help wanted']
---

## Description
The `GraphTraverser` class in `src/cognition-engine/graph-traverser.ts` has no JSDoc on its public constructor or `traverse()` method. This makes it hard for new contributors to understand the traversal algorithm without reading the full implementation.

## Steps
1. Open `src/cognition-engine/graph-traverser.ts`
2. Add JSDoc to the class definition, constructor, and all public methods (`traverse`, `setRepo`)
3. Follow the existing JSDoc style in `src/cognition-engine/intent-recognizer.ts`

## Files
- `src/cognition-engine/graph-traverser.ts`
- `tests/cognition-engine/graph-traverser.test.ts`

## Suggested Fix
```typescript
/**
 * Performs a weighted BFS traversal over the cognition graph.
 * Biases traversal along CAUSES/PRECEDES edges with optional intent hint.
 */
export class GraphTraverser {
```



---
title: 'Improve graph-traverser test coverage (current: 4 tests)'
labels: ['good first issue', 'help wanted']
---

## Description
The `graph-traverser.test.ts` has only 4 tests — the lowest coverage of any engine module. Key scenarios to add:
- Empty graph returns empty result
- Single node graph returns that node
- Traversal respects maxDepth
- Truncation when maxDurationMs is reached

## Files
- `tests/cognition-engine/graph-traverser.test.ts`

## Acceptance
All new tests must pass with `npm test`. No changes to core logic required.



---
title: 'Verify all MCP tool schemas in cognition-tools.test.ts'
labels: ['good first issue', 'help wanted']
---

## Description
The `cognition-tools.test.ts` file tests the 3 core tools, but we need to add schema validation tests to ensure each tool's input/output matches the JSON Schema declared in the code. This protects against schema drift.

## Steps
1. Open `src/tools/cognition-tools.ts` and extract the input/output schemas
2. For each tool, add a test that validates a sample input against its schema
3. Add a test that verifies invalid input is rejected

## Files
- `src/tools/cognition-tools.ts`
- `tests/tools/cognition-tools.test.ts`

## Reference
See the MCP Specification v1.29.0 for JSON Schema expectations.



---
title: 'Add validator for AstTemplate DSL syntax'
labels: ['good first issue', 'help wanted']
---

## Description
The `ast-constraint-solver.ts` parses template DSL from `AstTemplate.templateDsl`, but there is no DSL syntax validator. Invalid templates are silently parsed and may produce cryptic errors.

## Steps
1. Create a `validateTemplateDsl(templateDsl: string): ValidationResult` function in `src/cognition-engine/`
2. Check for: valid JSON, required `nodeType` field, supported field constraint types
3. Wire it into `createAstTemplate` in `src/storage/cognition-repository.ts` (optional — just the validator function is sufficient for this issue)

## Files
- `src/cognition-engine/ast-constraint-solver.ts` (add function)
- `tests/cognition-engine/ast-constraint-solver.test.ts` (add tests)

## Acceptance
Validator returns clear error messages for invalid templates. New tests cover empty string, malformed JSON, missing nodeType, and unsupported constraint types.



---
title: 'Add JSDoc to all exported types in cognition-types.ts'
labels: ['good first issue', 'help wanted']
---

## Description
The type definitions in `src/storage/cognition-types.ts` define the core data model (CognitionNodeData, CognitionEdgeData, AstTemplateData, etc.) but many interfaces and type aliases lack JSDoc. This slows down onboarding for new contributors.

## Steps
1. Open `src/storage/cognition-types.ts`
2. Add JSDoc to each exported type, interface, and enum value
3. Document the semantics of each field (especially `abstractionLevel`, `payload`)

## Files
- `src/storage/cognition-types.ts`

## Style Guide
Use the same style as `src/types.ts`. Example:
```typescript
/** The abstraction level of a cognition node. 0=concrete code, 1=function, 2=module, 3=architecture. */
abstractionLevel: number;
```