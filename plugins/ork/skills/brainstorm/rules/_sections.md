---
title: Brainstorm Rule Categories
version: 1.0.0
---

# Rule Categories

## 1. Idea Quality (quality-gates) — HIGH — 2 rules

Filters out unfeasible or over-complex ideas before synthesis so the evaluation phase only spends tokens on actionable options.

- `feasibility-filter.md` — Score every idea 1-5 for feasibility during Phase 3; explicitly flag low-feasibility ideas before synthesis
- `complexity-ceiling.md` — Check every idea against the project's detected tier; flag ideas that exceed team or infra capacity

## 2. Agent Orchestration (orchestration) — MEDIUM — 1 rule

Caps the number of parallel brainstorm agents to avoid context overload and diminishing returns in the synthesis phase.

- `agent-count-limit.md` — Never spawn more than 5 parallel brainstorm agents; beyond 5 produces diminishing returns at high token cost

## 3. Convergence (synthesis) — HIGH — 1 rule

Ensures every brainstorm session ends with ranked, actionable recommendations rather than an unfiltered list of ideas.

- `convergence-requirement.md` — Brainstorm must converge to ranked options, a trade-off table, and explicit next steps before completing
