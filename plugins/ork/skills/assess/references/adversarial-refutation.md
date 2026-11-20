# Adversarial Refutation — assess bindings

Thin adapter. Loads the shared engine, then binds it to assess's scoring model.

**Load the engine first:** `Read("${CLAUDE_PLUGIN_ROOT}/shared/rules/adversarial-refutation.md")`
— the blindness contract, independent-score-first, citation-verify, quorum, cross-file
UPHELD-default, deterministic-exemption, no-auto-flip, spawn-ceiling, ledger schema, and
isolated-spawn rules. This file only supplies what's assess-specific.

## Bindings

| Engine concept | assess binding |
|----------------|----------------|
| "finding" | a per-dimension 0-10 score from Phase 2 (`02-evaluation.json`) |
| rubric | `quality-gates/references/unified-scoring-framework.md` + `references/quality-model.md` |
| refuter agent | the same `subagent_type` that scored the dimension (code-quality-reviewer / security-auditor / *-performance-engineer / test-generator), spawned blind |
| code artifact | the Phase 1.5 scoped file list (`references/scope-discovery.md`) + the ≤12-tool-call budget |
| ledger | `02b-refutation.json` (new Phase Handoffs row) |
| revised output | recomputed composite + a "Refuted?" note in the Phase 7 report; `refuted` + `original_score` fields on the Phase 7b dashboard dimension objects |

## Scope filter (which scores get a refuter)

A dimension score qualifies only if decision-bearing — ANY of:
- score **≥8** (praise-inflation: the assessor patting the subject on the back) or **≤4** (over-penalty)
- **high-weight** dimension (Security 0.20; Correctness/Maintainability/Compliance 0.15)
- within **0.5 of a rubric gate**: the composite `min_pass` (5.5) or the dimension's own `min_blocker` (Security 4.0). Grade edges sit at every whole number from 5 to 9, so a 0.5 window around them would select every score from 4.5 to 9.5 and void this filter
- a Phase 5 **Quick Win** (effort ≤2, impact ≥4) that `/ork:implement` will act on

Skip: mid-band (5-7) scores on low-weight dimensions (Scalability/Simplicity 0.10) not near a
boundary, and descriptive pros/cons with no score. Bounds spawns to ~2-4 per assessment.

## Effort gate (assess-specific)

- `low` / `medium` → **skip Phase 2.5 entirely**
- `high` → up-to-4 **single** refuters, advisory only (a single refuter never auto-swings a
  score; OVERTURNED-with-verified-citation is surfaced for the user, not auto-applied)
- `xhigh` → **3-refuter majority** per qualifying score; auto-revise to the near band edge only
  on ≥2-of-3 VERIFIED overturns; a 1-of-3 dissent writes the existing `confidence`/`caveats`
  channel and drops that dimension's confidence to "low"

## Isolation note

Even when Phase 2 ran in Agent Teams mode, Phase 2.5 refuters are ALWAYS standalone
`Agent(...)` Task spawns with **no `team_name`** — fed only the serialized claim from
`02-evaluation.json`. Joining the mesh would leak producer reasoning (engine rule 9).

## What the workflow enforces vs the shell

`workflows/assess-fanout.js` (the default Phase 2 and 2.5 path) enforces in code: the scope
filter above, the effort gate, the ceiling (4 at `high`, 24 at `xhigh`, lowerable by
`maxRefuters`, never raisable, ranked by weight then distance from a gate, overflow in
`manualReview`), blindness (the refuter prompt carries the dimension, the scoped files and the
rubric bands only), independent-score-first (the refuter returns its own band, the script
compares), citation shape (an in-scope `file:line` plus a command, or the vote is upheld),
majority of PLANNED votes (a dead or throwing refuter is upheld), and no-auto-flip (a revision
that raises a score stays out of `chainVerdict` and lands in `confirmationNeeded`).

The shell still owns: re-opening each cited `file:line` (engine section 3, a script has no fs),
the user confirmation (section 7), writing `02b-refutation.json`, and the cross-model lane
(section 11, a script cannot shell out), which runs only on the Agent tool fallback.
