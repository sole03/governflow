# MCP Rule Engine — Agent Rules

This file defines project-level rules for Codex sessions.
These rules are loaded automatically on each session start.

---

## License Headers

- All generated `.ts` files MUST include the Apache 2.0 license header at the top.
- The header format is:

  ```
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
  ```

## Test Files

- Test files MUST follow the naming convention `*.test.ts`.
- Tests MUST be placed under `tests/` mirroring the `src/` directory structure.
- Use `vitest` (not jest or mocha).

## Configuration Protection

- The `.licenserc.json` exclude list MUST NOT be modified.
- The `.github/workflows/license-check.yml` MUST NOT be modified.

## Pre-Commit Checklist

Before submitting changes, the following MUST be run and pass:

1. `npm run license:check` — verifies all files have Apache 2.0 headers
2. `npm test` — ensures all tests pass
3. `npx tsc --noEmit` — ensures TypeScript compilation succeeds

## Prohibited Changes

- Do NOT modify the `LICENSE`, `TRADEMARK.md`, or `.licenserc.json` files.
- Do NOT remove Apache 2.0 headers from existing files.
- Do NOT introduce dependencies with incompatible licenses (GPL, AGPL, etc.).

---

*These rules are enforced by CI. Violations will block PR merges.*