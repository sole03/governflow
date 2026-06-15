# Basic Intent Flow — Example

Minimal example demonstrating the MCP Rule Engine cognition pipeline: intent recognition, graph traversal, and AST constraint solving.

## Quick Start

\`\`\`bash
cd examples/basic-intent-flow
npm install
npx prisma db push --schema=../../prisma/schema.prisma
npx tsx index.ts
\`\`\`

## Expected Output

\`\`\`
Analyzing diff...

=== Analysis Result ===

Intent: BUGFIX  (or REFACTOR, depending on signal weights)
Confidence: 0.95
Reasoning:
  - multi-file change (2 files)
  - error-handling keywords present
  ...

Diff stats:
  Files changed: 2, +3 / -1 lines

Traversal: 0 nodes in 25 ms
Duration: 75 ms total
\`\`\`

## Running Tests

\`\`\`bash
cd examples/basic-intent-flow
npm test
\`\`\`

## How It Works

1. A unified git diff is passed to \`analyzeCodeContext()\`
2. The Intent Recognizer classifies the diff as REFACTOR / BUGFIX / BOILERPLATE
3. The Graph Traverser fetches relevant cognition nodes (biased by intent)
4. The AST Constraint Solver validates the target file against stored templates
