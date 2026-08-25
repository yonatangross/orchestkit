---
name: ork-implement
description: Make an approved, scoped change and prove the affected behavior. Use when a request asks to implement, build, add, or land a feature that already has an agreed approach. Do not use to explore, review, or verify existing work, or to choose between approaches.
---

# Ork Implement

Implement only the agreed scope. Read repository instructions first and use an isolated worktree whenever a shared primary checkout may be active.

Before writing against an unfamiliar third-party API, confirm its current surface through the context7 MCP server (call `resolve-library-id`, then `query-docs`) rather than recalling it.

Keep the diff small. Add focused tests when behavior changes, and report the exact verification output. Do not self-certify a high-impact change: request `$ork-verify` (or `ork_verifier` when installed) after implementation.

Prefer `ork_implementer` when installed; otherwise implement in this context. Delegate only independent, bounded units; keep integration in one place.
