---
name: auto
license: MIT
compatibility: "Claude Code 2.1.206+."
description: "Intent-classified router — the front door to OrchestKit and the DEFAULT entry point for any goal-shaped request. Takes a plain-English goal, classifies it into one intent category, and routes to the right specialist skill (/ork:fix-issue, /ork:cover, /ork:brainstorm, /ork:implement, /ork:review-pr, /ork:verify, a /goal optimization loop, or the skill-evolution gate). A goal that maps unambiguously to one skill short-circuits straight to it — routing is never overhead, so use it even when you think you know the target skill. Skip only when already executing inside another skill (no recursion). Triggers on: auto, do this, figure out, just make, get it to, I want, help me, fix, build, improve, any goal description."
argument-hint: "[plain-english goal]"
context: inherit
version: 1.0.0
author: OrchestKit
tags: [router, intent, orchestration, discovery, meta, front-door]
user-invocable: true
allowed-tools: [AskUserQuestion, Read, Grep, Glob, Skill, Task]
complexity: medium
persuasion-type: collaborative
model: sonnet
metadata:
  category: workflow-automation
triggers:
  keywords: [auto, "do this", "figure out", "just make", "get it to", "i want", "help me with", "not sure which", "what should i", "can you make"]
  examples:
    - "get coverage above 90%"
    - "why isn't the build green"
    - "just make the login page work"
    - "I want the API faster"
  anti-triggers: ["/ork:help", "list skills", "what skills exist"]
---

# /ork:auto — Intent Router

The front door to OrchestKit. **You describe a goal in plain English; the router classifies it and hands off to the right specialist.** One entry point, many execution paths.

> **Why this exists:** OrchestKit has 112 skills, but usage telemetry shows users fire only the handful they can name by memory (10 distinct skills across thousands of sessions). The dominant cause of "dead" skills is **no front door** — not low quality. This router turns "you must know the exact `/ork:<name>`" into "describe what you want."

**Core principle:** routing is a *deterministic workflow*, not an autonomous agent (Anthropic, *Building Effective Agents*). Classify → confirm → hand off. The router never does the work itself — it picks who does.

## When to use

**By default, for any goal-shaped request.** An unambiguous goal is a 1-step
route: auto classifies, confirms in one line, and hands off — no extra hops,
so there is no "too obvious for auto".

| Use `/ork:auto` for… | Skip only when… |
|---|---|
| Any goal description ("fix X", "get Y to Z") | Already executing inside another skill (no recursion) |
| The right skill isn't obvious | Chaining a known multi-skill workflow you're mid-way through |
| You think you know the skill — auto confirms & short-circuits | |

> **Design note (2026-07-12):** this table previously said "Go direct when you
> already know the skill / the request maps unambiguously to one". That inverted
> instruction made the front door structurally unreachable — a competent model
> always believes it knows the target, so the router recorded near-zero
> invocations across thousands of sessions (the exact dead-skill problem the
> "Why this exists" note above describes). Routers must be framed as the
> default path, not an escape hatch for confusion.

## Intent categories → OrchestKit skill

| intent | signal words | routes to |
|---|---|---|
| **fix** | fix, debug, broken, failing, error, crash, regression | `/ork:fix-issue` |
| **diagnose** | why, why isn't, why does, why can't, investigate | `/ork:fix-issue` (investigation-first) |
| **optimize** | faster, reduce, latency, bundle, minimize, below N ms | a **`/goal` optimization loop** (see Gaps) |
| **cover** | coverage, untested, get to N% | `/ork:cover --target N` |
| **design** | design, architect, how should we, explore, idea | `/ork:brainstorm` |
| **build** | build, implement, create, add feature, from ticket | `/ork:implement` |
| **review** | review, PR, MR, pull request, #N | `/ork:review-pr` |
| **verify** | verify, check, make sure, passes, green | `/ork:verify` |
| **improve-skill** | improve the skill, optimize the prompt, SKILL.md | the **skill-evolution / holdout gate** (see Gaps) |
| **(fallback)** | no confident category | clarify with ONE question |

Full per-category parameter extraction + edge cases: `references/routing-rules.md`.

## The flow

```
  CLASSIFY  ->  CONFIRM  ->  HAND OFF
     |            |             |
  reason       show the     invoke the
  out loud     route        target skill;
  (CoT)        + nod        follow ITS phases
```

### 1. Classify (reason out loud first)

State your reasoning **before** committing to a route — this triggers chain-of-thought and is the single biggest accuracy lever (Anthropic, *Writing Effective Tools for Agents*). Example: *"'get latency under 200ms' names a metric + a direction → optimize, not fix."*

Apply the disambiguation rules (most specific wins; explicit verb beats inferred intent). **The load-bearing one: explicit verb wins** — "Fix the slow query" → `fix`, not `optimize`. For the full ordered ruleset (all 7, including the truly-ambiguous fallback), `references/routing-rules.md` is canonical.

### 2. Confirm (low ceremony)

Show the chosen route in one line and get a nod before handing off:

```
Goal:   "{original goal}"
Intent: {category}
Route:  {/ork:skill or loop} {extracted args}
        [run] · [adjust] · [cancel]
```

For low-risk single-pass routes (`verify`, `review`), an inline "routing you to /ork:verify — ok?" is enough. Never hand off without a nod.

### 3. Hand off

Invoke the target skill with the extracted parameters and **follow that skill's own phases and guardrails** — do not override them. The router's job ends at the handoff; the specialist owns execution and its own report.

## Fallback + honest gaps

- **Fallback category.** If no category clears a confident threshold, ask exactly ONE clarifying question rather than guessing. A rising fallback rate is the leading indicator that the taxonomy needs work — surface it, don't bury it.
- **`optimize` has no dedicated skill (yet).** OrchestKit's metric-driven optimization runs as a **`/goal` loop** using the loop recipe library (`/ork:prd-to-goal` → `references/recipe-library.md`). Route `optimize` there and say so plainly — don't pretend a `/ork:experiment` skill exists.
- **`improve-skill` routes to the evolution gate.** Self-optimizing a `SKILL.md` goes through the champion/challenger **holdout-promotion gate** (`/ork:assess` evals + `evolution-engine`), not a one-shot edit. It requires a benchmark + holdout set first.

## Stacked invocation (CC 2.1.199+)

`/skill-a /skill-b <goal>` loads all leading skills (up to 5) into context at once; the trailing args belong to the whole stack. So `/ork:auto /ork:brainstorm <goal>` pre-loads the specialist alongside the router — useful when the user already knows part of the route. The router still owns classification and handoff; a pre-loaded specialist does not bypass the confirm step.

## Guardrails

- **No recursion.** `/ork:auto` must not route to itself, directly or via a spawned agent.
- **No bypass.** Routing does not skip the target skill's guardrails, readonly enforcement, or confirmation steps.
- **Classification quality is the whole job.** A misroute that fails silently is worse than a fallback question. When two categories are equally plausible, ask — don't gamble.

## Validation

Routing accuracy is gateable, not vibes. `routing-benchmark.json` holds 50 labeled `goal → category` pairs (easy + genuinely ambiguous). Validate after any change to the category table or disambiguation rules:

```bash
# isolated classification check via the bare-eval harness
/ork:bare-eval   # grade router output against routing-benchmark.json
```

Target ≥95% category accuracy; track the fallback rate as a degradation alarm as the skill library grows.

## References

- `references/routing-rules.md` — per-category parameter extraction, edge cases, disambiguation
- `routing-benchmark.json` — 50 labeled goal→category pairs for accuracy validation

## Quality Bar

Done means all of these hold:
- Classification reasoning is stated out loud BEFORE a route is committed, naming the chosen intent category and the signal words that triggered it.
- The confirm block names one of the taxonomy's intent categories, its target skill or `/goal` loop, and the extracted args — on one line.
- No target skill is invoked without an explicit nod (or `-y`); handoff never precedes confirmation.
- When two categories are equally plausible, exactly ONE clarifying question is asked — the fallback is never silently guessed.
- `optimize` routes to a `/goal` loop and `improve-skill` to the evolution gate; neither claims a dedicated skill that does not exist.
- The router does none of the target work itself and never routes to `/ork:auto` (no recursion).

## Related skills

- `/ork:help` — static categorized directory (browse, don't route)
- `/ork:prd-to-goal` — decompose a spec into a `/goal` line (the `optimize` route's engine)
- `/ork:fix-issue` · `/ork:cover` · `/ork:brainstorm` · `/ork:implement` · `/ork:review-pr` · `/ork:verify` — the route targets
- `/ork:assess` — champion/challenger holdout gate (the `improve-skill` route)
