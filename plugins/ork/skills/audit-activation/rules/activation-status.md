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

## Definitions (apply before the procedure)

- **RARE-DOMAIN set** (low use is inherently expected): design (system/context/tokens), multimodal/media, frontend-perf, IaC/infra, deployment, security-LLM/AI-safety, demo, UI-annotation. An agent whose primary domain is in this set is a NICHE candidate.
- **WIRED** = referenced by ANY skill or agent in a way that can surface it: a real `subagent_type=`/`agent:` spawn, **OR** membership in an agent-team / agent-selection map / escalation table. Narrative-only prose mentions do NOT count as wired.
- **REAL BUSY-SKILL SPAWN** = a `subagent_type=ork:<name>` (or `agent: <name>`) issued by a *dispatchable* skill — NOT one whose frontmatter is `user-invocable: false` + `disable-model-invocation: true` (a doc skill can't dispatch).

## Decision procedure (per dormant agent — STOP at the first match)

1. Count references: `grep -rl "ork:<name>\|<name>" src/skills/ src/agents/`. If **0 references anywhere → DEAD** (prune candidate).
2. **Is its domain in the RARE-DOMAIN set AND is it WIRED?** → **NICHE** (keep — low use expected). Check this BEFORE step 3: a rare-domain agent is niche even if its only wiring is team/selection-map membership, not a busy-skill spawn.
3. Otherwise (non-rare domain) — has refs but **no REAL BUSY-SKILL SPAWN** → **MIS-TRIGGERED** (wire one from a high-traffic skill).
4. Otherwise (non-rare domain WITH a real busy-skill spawn but still dormant) → **MIS-TRIGGERED** if the spawn path is itself rarely-run; note the path.

> Ordering matters: step 2 (rare-domain NICHE) is checked before the mis-triggered test, so niche-domain agents (IaC, multimodal, security-LLM, frontend-perf) are not mislabeled mis-triggered just because they lack a busy-skill spawn.

## Hard rules

- **Never bucket on description quality.** A/B testing showed description rewrites give Δ0 routing benefit — dormancy is a wiring problem, not a prose problem.
- **"Never fired" = absent from the available telemetry window**, which may have gaps. State the window; treat as strong signal, not proof of zero.
- **Watch near-duplicates** — two agents covering the same domain (e.g. `security-layer-auditor` vs `security-auditor`) trend toward DEAD; flag for consolidation before pruning.

**Incorrect** — "ai-safety-auditor never fired and its description is terse → prune."

**Correct** — "ai-safety-auditor never fired BUT is wired into the security-audit team and LLM-safety is a rare task → NICHE, keep."
