# Contributing to MCP Rule Engine

Thanks for your interest in contributing! This document outlines the guidelines for submitting issues, pull requests, and other contributions.

## How to Contribute

1. **Open an Issue** — Before starting work, open an issue to discuss the proposed change. This avoids wasted effort on changes that may not align with the project direction.
2. **Fork and Branch** — Fork the repository and create a feature branch from `main`.
3. **Implement** — Follow the existing code style (TypeScript strict mode, JSDoc on all public APIs).
4. **Test** — Ensure all tests pass (`npm test`). Add tests for new functionality.
5. **Submit a PR** — Keep PRs focused on a single concern. Link the related issue.


## Your First Contribution

Looking for a good place to start? Check out our [Good First Issues](https://github.com/sole03/mcp-rule-engine/issues?q=is%3Aissue+is%3Aopen+label%3A%22good+first+issue%22) — tagged issues that are well-scoped and include guidance on where to start.

### PR Checklist

Before submitting a pull request, verify all of the following:

- [ ] `npm run license:check` — all files have Apache 2.0 headers
- [ ] `npm test` — all 126+ tests pass
- [ ] `npx tsc --noEmit` — TypeScript compilation succeeds
- [ ] JSDoc added for any new public API
- [ ] Test added for any new functionality

Missing any of these? The CI pipeline will catch it, but running locally first saves time.

## Development Setup

```bash
git clone <repo-url> && cd mcp-rule-engine
npm install
npx prisma db push
npm run build
npm test
```

## Code Style

- TypeScript strict mode (`tsconfig.json`).
- 2-space indentation.
- JSDoc on all exported functions and types.
- No `any` — prefer `unknown` with type guards.

## Licensing & Trademarks

By contributing to this project, you agree to the following terms:

### Contribution License Grant

All contributions (code, documentation, or otherwise) are submitted under the terms of the **Apache License, Version 2.0**. You retain copyright over your contributions, but grant the project and its users a perpetual, worldwide, non-exclusive, royalty-free license to use, modify, and distribute them.

This is governed by Section 5 ("Submission of Contributions") of the Apache 2.0 license included in `LICENSE`.

### Prohibited Submissions

Do not submit:
- **Third-party trademarks or proprietary assets** (logos, brand names, or copyrighted materials) that you do not own or have explicit permission to use.
- **Code with incompatible licenses** (GPL, AGPL, or other copyleft licenses that conflict with Apache 2.0).

### Trademark Usage

The "Cognition Graph" name and associated logo are trademarks of the project author. Refer to `TRADEMARK.md` for permitted and prohibited uses. If you have questions about trademark usage in your contribution, open a Discussion before submitting.

### License Header

Every `.ts` file must include the Apache 2.0 license header. Run `npm run license:check` before committing. Missing headers will be caught by CI.

Thank you for helping make MCP Rule Engine better!


## Database Migrations

### Development
Schema changes are automatically synced via `prisma db push` on MCP server startup.
- Edit `prisma/schema.prisma`
- Run `npm run db:push` to apply changes locally
- The CLI auto-pushes on next start if NODE_ENV != production

### Production
Production deployments must use `prisma migrate deploy` for safe, versioned migrations.
1. Create a migration: `npx prisma migrate dev --name <description>`
2. Commit the generated `prisma/migrations/` directory
3. Deploy with: `node scripts/migrate-prod.js` or set `NODE_ENV=production`
4. The CLI automatically runs `migrate deploy` when `NODE_ENV=production`

### Manual Production Migration
```bash
# Windows
node scripts/migrate-prod.js

# Linux/macOS
DATABASE_URL="postgresql://..." npx prisma migrate deploy
```

> **Never use `db push` in production.** It skips migration history and can cause drift.
