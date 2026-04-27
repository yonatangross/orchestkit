---
title: Dev Rule Categories
version: 1.0.0
---

# Rule Categories

## 1. Lab-Stack Prerequisites (prerequisites) — CRITICAL — 1 rule

Required binaries must be on PATH before boot. Half-stacks confuse more than help.

- `lab-stack-prerequisites.md` — All-or-nothing prereq check, install hints, CI escape hatch

## 2. Subdomain Naming (naming) — HIGH — 1 rule

Branch slug determines the URL — must be deterministic, DNS-safe, and worktree-isolated.

- `branch-named-subdomain.md` — Slug rules (case, slash → dash, length cap), DNS reservation policy

## 3. Idempotency (idempotency) — HIGH — 1 rule

Re-running `/ork:dev` while live must not double-boot or corrupt state.

- `idempotent-boot.md` — Liveness probe, state-file gating, recovery from stale state

## 4. Teardown Order (teardown) — MEDIUM — 1 rule

SIGTERM must propagate in reverse boot order so nothing holds connections to dead peers.

- `teardown-order.md` — Why agent-browser → dev-server → emulate → portless, SIGKILL fallback
