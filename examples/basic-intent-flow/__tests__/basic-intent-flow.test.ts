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

import { describe, it, expect } from "vitest";
import { analyzeCodeContext } from "../../../src/cognition-engine/index.js";

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

describe("basic-intent-flow example", () => {
  it("analyzes a multi-file diff and returns structured analysis", async () => {
    const result = await analyzeCodeContext(
      REFACTOR_DIFF,
      "src/user.ts",
      "typescript",
      SAMPLE_FILE,
    );

    expect(result.intent).toBeDefined();
    // The classifier may return BUGFIX (error-handling keywords) or REFACTOR (multi-file)
    // Both are valid — the important thing is confidence > 0.3
    expect(["BUGFIX", "REFACTOR", "BOILERPLATE"]).toContain(result.intent.intent);
    expect(result.intent.confidence).toBeGreaterThan(0.3);
    expect(result.intent.reasoning.length).toBeGreaterThan(0);
    expect(result.intent.stats.filesChanged).toBe(2);
    expect(result.intent.stats.addedLines).toBeGreaterThan(0);

    expect(result.traversal).toBeDefined();
    expect(Array.isArray(result.traversal.nodes)).toBe(true);

    expect(result.constraints).toBeDefined();
    expect(result.constraints.validations).toBeDefined();
    expect(result.constraints.patches).toBeDefined();

    expect(result.durationMs).toBeGreaterThan(0);
  });
});
