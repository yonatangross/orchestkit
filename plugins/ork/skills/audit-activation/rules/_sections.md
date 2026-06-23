---
title: Audit Activation Rule Categories
version: 1.0.0
---

# Rule Categories

## 1. Activation Checks (checks) — HIGH — 1 rule

What to compute from the spawn telemetry: the generic-vs-specialist spawn split, per-agent fire counts, the never-fired set, concentration, and the per-agent skill-reference count (the root-cause signal).

- `activation-checks.md` — Metrics definitions, the fresh telemetry source, and the skill-naming cross-check

## 2. Activation Status Classification (status) — HIGH — 1 rule

How to bucket each agent into active / mis-triggered / niche / dead from its references (not its description), with the RARE-DOMAIN set and the STOP-at-first-match decision procedure.

- `activation-status.md` — Definitions, decision procedure, hard rules, and worked examples
