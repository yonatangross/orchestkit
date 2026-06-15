---
title: Scope Appropriate Architecture Rule Categories
version: 1.0.0
---

# Rule Categories

## 1. Tier Detection (evidence) — HIGH — 1 rule

Requires codebase evidence for every tier signal to prevent wrong-tier detection from cascading into all downstream architecture decisions.

- `tier-detection-evidence.md` — Cite at least 3 signals from different categories, each referencing a specific file or metric, before assigning a tier

## 2. Over-Engineering Prevention (yagni) — HIGH — 1 rule

Flags patterns that are rated OVERKILL for the current tier and appropriate only 2+ tiers higher, requiring explicit user justification to proceed.

- `over-engineering-flag.md` — Apply the Tier + 2 Rule: flag any pattern appropriate only at current tier + 2 or higher and suggest the tier-appropriate alternative

## 3. Deferred-Debt Tracking (yagni) — MEDIUM — 1 rule

Records the deliberate under-engineering chosen to fit the current tier — the counterpart to over-engineering prevention — so each cut resurfaces when the condition that should trigger its upgrade is met.

- `deferred-debt-marker.md` — Mark deliberate simplifications with `// ork-debt: <choice>, upgrade to <path>, when <trigger>`; two hooks capture and surface the ledger automatically
