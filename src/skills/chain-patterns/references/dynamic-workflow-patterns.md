# Dynamic Workflow Patterns

Reference for CC Dynamic Workflows (the `Workflow` tool / `ultracode`, shipped 2026-05-28).
A workflow is a harness Claude writes on the fly — a JS file that spawns and coordinates
subagents with per-agent isolation, model choice, and isolation level. This maps the **6
patterns** to ork's own flows so the right shape is reached for deliberately, picks the
right model tier per agent (#2233), and resolves the "use directly vs ship-as-template"
question.

> **Not a wrapper.** Per [[feedback_workflows_use_dont_wrap]], ork does NOT wrap workflows
> into skills as a forced fit. This is a *reference* — USE the `Workflow` tool directly for
> ork's bounded audits/sweeps. Grounded in two workflows run on 2026-06-05: the
> drift-register re-audit (caught a 60%-wrong audit) and the adversarial-verify design
> (found all 3 designs unsound on first pass).

## The 6 patterns → ork map

> These six are **ork's own taxonomy** for naming multi-agent shapes — not a Claude Code
> standard. CC documents the `Workflow` tool's *mechanics* (`agent()`/`parallel()`/`pipeline()`,
> `opts.model`, isolation levels); the pattern **names and the selection rule** below are ork
> conventions layered on top.

| Pattern | What it is | ork flow that uses it |
|---------|-----------|------------------------|
| **Classify-and-act** | a classifier routes work before doing it | `ci-debug` (10-pattern classifier), `errors` |
| **Fan-out-synthesize** | split → parallel agent per piece → merge (barrier) | `explore`, `audit-full`, the drift re-audit |
| **Adversarial verification** | a separate, blind agent refutes each finding | `assess` Phase 2.5, `shared/rules/adversarial-refutation.md` |
| **Generate-and-filter** | generate N ideas → filter by rubric/verify → dedup | `brainstorm` (divergent → keep/discard) |
| **Tournament** | pairwise comparison beats absolute scoring | *gap* — `prioritization`/`competitive-analysis` use absolute scores |
| **Loop-until-done** | spawn until a stop condition (K dry rounds) | `cover` (bounded heal); `ci-sentinel` could loop-until-dry |

## Failure mode → pattern (the selection rule)

Pick the pattern that **structurally prevents** the failure your task is hitting:

| Failure mode (single-context) | Pattern that fixes it |
|-------------------------------|------------------------|
| **Goal drift** — loses fidelity to the objective over many turns | Fan-out (each agent one focused goal) |
| **Self-preferential bias** — Claude favors its own work when judging it | Adversarial verification (blind refuter) |
| **Agentic laziness** — declares done after partial progress | Loop-until-done + `/goal` hard completion |
| **Hard-to-score** — taste/ranking quality degrades at scale | Tournament (pairwise) |

## Per-agent model tiers (#2233)

A workflow picks the model per agent. Default to **inheriting the session model**; tier only
when an agent's job is genuinely cheap or expensive:

| Agent job | Tier |
|-----------|------|
| Structural greps, file reads, classification, fan-out exploration | `haiku` |
| Synthesis, adversarial judgment, design, cross-cutting reasoning | `opus` |
| Everything in between / when unsure | inherit (omit `model`) |

In `agent()`, set `opts.model`. Example from the drift re-audit (improved): the 5 structural
refuters → `haiku`, the synthesis → `opus`. Don't over-optimize — a wrong-tier cheap agent
that misses a structural dependency costs more than the tokens it saved (the version-matrix
verdict needed a careful read, not a cheap grep).

## Use directly vs ship-as-template

The "don't wrap" memory and the article's "ship workflows as Skills" reconcile cleanly:

```
Bounded foreground task (most ork work) ........ USE the Workflow tool directly. Don't wrap.
Genuinely large-N / adversarial / repeated ..... may ship as a TEMPLATE skill (NOT a verbatim
  flow you'll run again (deep audit, swarm)       script) — prompt Claude to adapt the shape.
```

Decision test: would a regular Claude Code session finish this in five minutes? Then you don't
need a workflow at all (the article's own first warning). Reach for one only for the long,
parallel, structured, or adversarial classes above.

## Untrusted input → quarantine

Any workflow/skill that reads untrusted content (GitHub issue bodies, PR descriptions, CI
logs, scraped pages) must **quarantine** it: read-only reader agents with no high-privilege
tools extract structured facts; a separate actor agent — never exposed to the raw text —
acts. See `shared/rules/untrusted-input-quarantine.md` (#2232).

## Cost discipline

Workflows often use 5–10× the tokens. Set an explicit budget in the prompt ("use 10k
tokens"); pair loop patterns with `/goal` for hard completion; keep the bracket/stop-condition
in deterministic loop code, not in an agent's context.
