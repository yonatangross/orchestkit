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

## Model weight (orthogonal second dimension)

Intent picks **who** does the work. Weight picks **how expensive that worker should be**. A route is `{intent} @ {weight}`. Weight never changes the intent and never replaces it. The taxonomy above and the 7 disambiguation rules are untouched by it.

Tiers are the ones already declared in `src/agents/*.md` frontmatter (`haiku` 7 · `sonnet` 10 · `opus` 6 · `inherit` 13). No parallel taxonomy.

| weight | tier | the task is… |
|---|---|---|
| **Light** | `haiku` | mechanical or IO-bound, single file, deterministic output, trivially revertible |
| **Standard** | `sonnet` | the default: bounded judgment, known pattern |
| **Heavy** | `opus` | adversarial, security, safety, architecture, cross-cutting, or ambiguous |

**Resolution is asymmetric:** ANY heavy signal ⇒ Heavy; Light requires ALL light signals; everything else is Standard. Under-powering a security review yields a confident wrong answer nobody catches; over-powering a rename only wastes money.

Weight is **per leg, not per route**. A PR review can be a Heavy security leg plus a Light lint leg. Full signal table, per-intent defaults, and the honest limits of this lever: `references/routing-rules.md`.

> **This is the selector, not the cap.** `src/hooks/src/pretool/task/team-size-gate.ts` is an ex-post, per-session counter keyed on `ORK_TEAM_OPUS_MAX` (default 8). Its default posture is advisory (`outputWarning`); with `ORK_TEAM_SIZE_HARD=1` it escalates to `outputDeny` and refuses the spawn outright. Either way it reads the model read-only: it can refuse a premium spawn, but it cannot *choose* a cheaper one for you. Routing is what chooses. The two compose, cap as backstop and routing as selector; never duplicate the cap's counting here.

## The flow

```
  CLASSIFY  ->  CONFIRM  ->  HAND OFF
     |            |             |
  intent       show the     invoke the
  + weight     route        target skill;
  out loud     + nod        follow ITS phases
```

### 1. Classify (reason out loud first)

State your reasoning **before** committing to a route — this triggers chain-of-thought and is the single biggest accuracy lever (Anthropic, *Writing Effective Tools for Agents*). Example: *"'get latency under 200ms' names a metric + a direction → optimize, not fix."*

Apply the disambiguation rules (most specific wins; explicit verb beats inferred intent). **The load-bearing one: explicit verb wins** — "Fix the slow query" → `fix`, not `optimize`. For the full ordered ruleset (all 7, including the truly-ambiguous fallback), `references/routing-rules.md` is canonical.

Then classify **weight in the same pass**, naming the signal that decided it: *"touches auth and models an attacker → Heavy."* Intent first, weight second; a weight call never rewrites the intent you just committed to.

### 2. Confirm (low ceremony)

Show the chosen route in one line and get a nod before handing off:

```
Goal:   "{original goal}"
Intent: {category}
Weight: {Light|Standard|Heavy} ({tier}), decided by: {signal}
Route:  {/ork:skill or loop} {extracted args}
        [run] · [adjust] · [cancel]
```

For low-risk single-pass routes (`verify`, `review`), an inline "routing you to /ork:verify — ok?" is enough. Never hand off without a nod.

**Premium spend is never silent.** Routing down (Light/Standard) needs no approval, because spending less is not a decision the user has to make. Routing **up to Heavy** is premium spend and gets its own line the user must accept:

```
⚠️  Heavy route: {N} opus-tier leg(s), triggered by: {heavy signal}
    [approve premium] · [run Standard instead] · [cancel]
```

If they decline, run Standard and say plainly which check is weakened. Never upgrade mid-handoff or inside a spawned agent the user did not see.

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
- **No silent upgrade.** A Heavy (opus/fable) leg is premium spend and requires an explicit nod on its own line. Downgrades stay silent.
- **The cap is not the router's to move.** Never read, set, or suggest raising `ORK_TEAM_OPUS_MAX`. That is the user's budget.
- **A gate denial is not a re-route trigger.** If `team-size-gate` denies a spawn, do NOT relabel a Heavy leg as Standard to slip under the cap. Report the denial and let the user decide.
- **Weight is a hint, not an override.** The router cannot change an agent's declared `model:`. It selects skills and agents, and sets the caller's model that the 13 `inherit` agents adopt. It never overrides a target skill's own agent selection.

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
- Weight is classified in the same pass as intent, naming the signal that decided it, and resolves asymmetrically (ANY heavy signal ⇒ Heavy; Light needs ALL light signals; else Standard).
- The confirm block names one of the taxonomy's intent categories, its target skill or `/goal` loop, and the extracted args — on one line.
- Every Heavy (opus/fable) leg is surfaced for explicit approval before handoff; no premium spend is silent, and declining it runs Standard with the weakened check named.
- Adversarial, security, safety, architecture, and cross-cutting work is never routed below opus tier; mechanical single-file IO-bound work is not routed above haiku tier.
- The router neither counts spawns nor touches `ORK_TEAM_OPUS_MAX`, and never downgrades a Heavy leg to evade a `team-size-gate` denial.
- No target skill is invoked without an explicit nod (or `-y`); handoff never precedes confirmation.
- When two categories are equally plausible, exactly ONE clarifying question is asked — the fallback is never silently guessed.
- `optimize` routes to a `/goal` loop and `improve-skill` to the evolution gate; neither claims a dedicated skill that does not exist.
- The router does none of the target work itself and never routes to `/ork:auto` (no recursion).

## Related skills

- `/ork:help` — static categorized directory (browse, don't route)
- `/ork:prd-to-goal` — decompose a spec into a `/goal` line (the `optimize` route's engine)
- `/ork:fix-issue` · `/ork:cover` · `/ork:brainstorm` · `/ork:implement` · `/ork:review-pr` · `/ork:verify` — the route targets
- `/ork:assess` — champion/challenger holdout gate (the `improve-skill` route)
