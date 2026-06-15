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
 * @file Basic Intent Flow — minimal example using the cognition engine.
 *
 * Run: npx tsx index.ts
 * Expected output:
 *   Intent: REFACTOR
 *   Confidence: 0.85
 *   Reasoning: multi-file change (2 files), ...
 *   File changes: 2 files, +7 / -1 lines
 */

import { analyzeCodeContext } from "../../src/cognition-engine/index.js";

// A sample multi-file refactor diff (similar to integration test data)
const REFACTOR_DIFF = [
  "diff --git a/src/user.ts b/src/user.ts",
  "--- a/src/user.ts",
  "+++ b/src/user.ts",
  "@@ -1,3 +1,7 @@",
  " function validateUser(input: string) {",
  "-  return input;",
  '+  if (!input) throw new Error("invalid");',
  "+  return input.trim();",
  " }",
  "diff --git a/src/order.ts b/src/order.ts",
  "--- a/src/order.ts",
  "+++ b/src/order.ts",
  "@@ -5,6 +5,7 @@",
  "+import { validateUser } from \"./user.js\";",
].join("\n");

const SAMPLE_FILE = "function validateUser(input: string) { return input; }";

async function main() {
  console.log("Analyzing diff...\n");

  const result = await analyzeCodeContext(
    REFACTOR_DIFF,
    "src/user.ts",
    "typescript",
    SAMPLE_FILE,
  );

  console.log("=== Analysis Result ===");
  console.log("");
  console.log("Intent:", result.intent.intent);
  console.log("Confidence:", result.intent.confidence.toFixed(2));
  console.log("Reasoning:");
  for (const r of result.intent.reasoning) {
    console.log("  -", r);
  }
  console.log("");
  console.log("Diff stats:");
  console.log(
    `  Files changed: ${result.intent.stats.filesChanged}, ` +
    `+${result.intent.stats.addedLines} / -${result.intent.stats.removedLines} lines`,
  );
  console.log("");
  console.log("Traversal:", result.traversal.nodes.length, "nodes in", result.traversal.durationMs.toFixed(0), "ms");
  console.log("Duration:", result.durationMs.toFixed(0), "ms total");
}

main().catch(console.error);
