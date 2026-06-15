## Announcing Apache 2.0 Licensing and Trademark Policy

Today I'm happy to announce that **MCP Rule Engine** is now fully licensed under the **Apache License, Version 2.0**, with a formal Trademark Policy (see `TRADEMARK.md`) for the "Cognition Graph" brand.

This is the result of commit `8ea3944`, which added Apache 2.0 headers to all 53 source files (36 in `src/`, 17 in `tests/`) and established a GitHub Actions workflow to enforce compliance on every PR and push.

### Why Apache 2.0

Apache 2.0 was chosen over more permissive licenses (MIT, BSD) for three reasons:

- **Patent protection** — Apache 2.0 includes an express grant of patent rights from contributors to users, which is critical for a project that operates at the AST/cognition layer where novel algorithms may be involved.
- **Ecosystem trust** — Apache 2.0 is the standard for enterprise-grade open-source infrastructure (Kubernetes, Apache projects, etc.). It signals that this project takes licensing seriously.
- **Contributor clarity** — Contributions are automatically accepted under the same license (`Section 5`), eliminating ambiguity about intellectual property.

### What This Means for You

| Role | Impact |
|------|--------|
| **Individual developers** | Free to use, modify, and distribute the software in personal, academic, or commercial projects under Apache 2.0 terms. No additional permission needed. |
| **Enterprises** | Safe to adopt in internal toolchains and commercial products. The explicit patent grant and disclaimer of warranty (`Sections 3, 7, 8`) provide the legal clarity that corporate legal teams require. |
| **Contributors** | By submitting a PR, you agree that your contribution is licensed under Apache 2.0 (`Section 5`). You retain copyright over your contributions. |
| **Commercial vendors** | You may embed this engine in your products under Apache 2.0 terms. If you need to use the "Cognition Graph" trademark in your product name or marketing, refer to `TRADEMARK.md` or open a Commercial Licensing Discussion. |

### Permanent Open-Source Commitment

This project will **remain open-source under Apache 2.0 indefinitely**. The trademark policy exists solely to prevent brand confusion and consumer deception — it does not restrict your right to use the code.

Key commitments:
- The core cognition engine, graph traversal, AST constraint solver, and all MCP tools will always be Apache 2.0.
- The governance layer (injection approval, feedback loop, audit logging) will always be Apache 2.0.
- The Trademark Policy will not be retroactively tightened.

### Feedback and Questions

- **License or legal questions**: Open a Discussion in the Q&A category
- **Commercial trademark licensing**: See `TRADEMARK.md` → Commercial Licensing category
- **Report a license header issue**: The CI workflow (`.github/workflows/license-check.yml`) checks every PR — open an Issue if you find a file missing its header

Thanks to everyone who has contributed issues, ideas, and encouragement. This project started as a fork and has grown into something genuinely novel — a cognition graph engine with a trust governance layer that I believe will change how AI agents interact with codebases.

Let me know your thoughts in the comments.