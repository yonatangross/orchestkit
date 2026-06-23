---
title: "Activation Status Classification"
impact: HIGH
impactDescription: "Mis-classifying a niche agent as dead gets a useful specialist pruned; mis-classifying a dead one as niche keeps catalog noise that dilutes routing"
tags: agents, activation, classification
---

# Activation Status Classification

Bucket each agent. Fired agents are `ACTIVE`. Every dormant (never-fired in the window) agent goes into exactly one of the buckets below — decided by its **references**, not its description.

## Buckets

| Bucket | Condition | Action |
|--------|-----------|--------|
| **ACTIVE** | fired ≥1× in the telemetry window | none — it works |
| **MIS-TRIGGERED** | dormant, BUT only referenced as a table row / narrative mention / deep-team member — has a real `subagent_type=` spawn in 0-1 high-traffic skills | wire a spawn from a busy skill (fix) |
| **NICHE** | dormant, legitimately specialized + rarely-needed domain (design, multimodal, perf, IaC, security-LLM), and is wired into at least one relevant skill | keep — low use is expected |
| **DEAD** | dormant AND no references in ANY skill or agent (truly unreachable) | prune candidate |

## Decision procedure (per dormant agent)

1. `grep -rl "ork:<name>" src/skills/ src/agents/` — any real spawn path?
2. If 0 references anywhere → **DEAD**.
3. If referenced only in tables/teams/narrative (no `subagent_type=` from a busy skill) → **MIS-TRIGGERED**.
4. Else if the domain is inherently rare and it IS wired → **NICHE**.

## Hard rules

- **Never bucket on description quality.** A/B testing showed description rewrites give Δ0 routing benefit — dormancy is a wiring problem, not a prose problem.
- **"Never fired" = absent from the available telemetry window**, which may have gaps. State the window; treat as strong signal, not proof of zero.
- **Watch near-duplicates** — two agents covering the same domain (e.g. `security-layer-auditor` vs `security-auditor`) trend toward DEAD; flag for consolidation before pruning.

**Incorrect** — "ai-safety-auditor never fired and its description is terse → prune."

**Correct** — "ai-safety-auditor never fired BUT is wired into the security-audit team and LLM-safety is a rare task → NICHE, keep."
