# Changelog

All notable changes to mcp-cognition-engine will be documented in this file.

## [1.0.0-alpha.2] — 2026-06-16

### Fixed
- **Clean Room startup failure**: Added `postinstall` script (`npx prisma generate`) so the Prisma client is generated automatically after `npm install`. Previously the package crashed immediately with "@prisma/client did not initialize yet" in clean environments.
- **Lazy Prisma client generation fallback**: Added runtime check in `dist/cli.js` that detects missing Prisma client and runs `prisma generate` automatically. Uses `stdio: "pipe"` to avoid polluting the MCP JSON-RPC stdout channel. This acts as a safety net if `postinstall` is skipped (e.g., CI with `--ignore-scripts`).
- **DATABASE_URL default injection**: `dist/index.js` now defaults `process.env.DATABASE_URL` to `"file:./mcp-cognition.db"` if not set, preventing crashes when the server is invoked directly without the CLI wrapper.

### Changed
- Moved `prisma` from `devDependencies` to `dependencies` to ensure it's available for the `postinstall` script in consumer installs.

## [1.0.0-alpha.1] — 2026-06-15

### Added
- Initial alpha release.
- Cognition Graph Engine with intent recognition, weighted graph traversal, and AST constraint solving.
- Trust Governance layer with three-tier knowledge base, injection approval workflow, and TTL-based proposals.
- Stdio and Streamable HTTP transport support.
- MCP tools: `cognition_query`, `cognition_validate`, `cognition_feedback`, `cognition_approve_injection`, `cognition_update_config`.
- MCP resources: `cognition://schema`, `cognition://stats`, `cognition://docs`, `cognition://rules-changelog`.
- Legacy rule engine tools: `analyze_workspace`, `capture_diff`, `query_rules`, `confirm_rule`, `resolve_conflict`, `list_rules`.
- SQLite storage via Prisma with WAL mode for concurrent read/write.
- Apache 2.0 licensing with trademark policy.
