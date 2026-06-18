---
title: Decision-Router Board
description: The execution-router variant of the decision-board archetype — turns a real backlog into per-item ork/Workflow invocations. How visualize-plan seeds it and what it emits.
---

# Decision-Router Board

A **decision-board** (Now/Next/Later triage + RICE) where every card also opens a full-screen
**Execute** panel that routes the task to an ork execution strategy and emits a **plan-only**
invocation. It is the bridge from "what to do" → "how to run it" → a copy-pasteable command.

Use it (over the plain `decision-board.template.html`) when the plan is a **backlog the user must
both prioritize and dispatch** — issues to triage, PRD phases to schedule, a wave of work to route.
Plain prioritization with no execution step → use `decision-board.template.html`. A single linear
flow → `user-story-player`. <2 decision signals → dashboard (the standard doesn't apply).

Reference artifact to copy + reseed: `docs/<branch-dir>/decision-router-board.html` (committed
example). Swap the `CARDS` array; keep the engine. (Promoting this to a pristine, de-branded
`decision-router.template.html` in `playground-exemplars/` is a clean follow-up.)

## STEP A — seed CARDS from real data

The board is data-driven via one `CARDS` array. Each card:

```js
{ id:'2475',                    // stable key (issue number / slug)
  ico:'🔧', ttl:'Re-architect InstructionsLoaded hooks',
  why:'one line — why it matters / the decision at stake',
  impact:5, effort:3,            // 1–5 each → RICE + Impact/Effort meters
  rec:'now',                     // now | next | later (initial bucket)
  badges:[['risk0','zero-risk']] }
```

Sources (pick what the user gave you):

| Source | How |
|--------|-----|
| GitHub issues | `gh issue list --json number,title,body,labels --limit 20` → one card each; `impact`/`effort` from labels or a quick estimate; `rec` from your triage |
| PRD / spec | one card per requirement or phase; `why` = the acceptance criterion |
| The plan brief | visualize-plan's STEP 1 execution phases → one card per phase |

For defensible `impact`/`effort`/RICE, run the `prioritization` skill's RICE rubric rather than
guessing — the board renders whatever scores you pass.

## STEP B — the Execute panel (already built into the engine)

Each card's drawer offers five strategies. **They map 1:1 to real ork/Workflow tooling** — this
mapping is the whole point:

| Strategy | Emits / runs as | Reliability · cost |
|----------|-----------------|--------------------|
| single | `/ork:<skill>` (fans out ork agents internally) | ~85–95% · 1× |
| workflow | the **Workflow** tool — `pipeline` or `orchestrator-worker` | ~80–90% · 1× |
| nested | an ork lead agent → sub-agents (Task/Agent), recurse ≤depth | ~70–80% · ~1.5× |
| teams | **Agent Teams** — `TeamCreate` + `SendMessage` mesh | ~60–70% · ~3× |
| swarm | LLM council — parallel → blind review → chairman | ~50–65% · ~3–4× |

Specialist picker = the **full 37-agent ork registry** (`all`/`none` bulk select). Caps are
**structural, not arbitrary**: workflow is uncapped (parallel work queues past 16); nested 6 / teams
6 / swarm 7 because nesting is depth-bounded and mesh/council reliability collapses with N. Topology
preview renders the chosen shape live.

## STEP C — the plan-only invocation (the bridge to execution)

"Copy invocation" yields a **plan-only** instruction, e.g.:

```
Run a Workflow (pipeline) for "Re-architect InstructionsLoaded hooks" with
ork:backend-system-architect, ork:test-generator. Plan-only: show me the script before executing.
```

Paste it back into Claude Code → it runs the chosen strategy, plan-first. Plan-only by design: the
board decides *how*, the user approves before anything spawns. Never auto-execute from the board.
