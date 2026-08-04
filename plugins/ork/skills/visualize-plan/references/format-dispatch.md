---
title: Format Dispatch
description: How visualize-plan renders the selected sections in the chosen output format(s).
---

# Format Dispatch

The format front-door (STEP 0.5) picks **how** to render; STEP 2 picks **which** sections. Dispatch maps the one plan-viz model to the chosen surface(s). ASCII is the floor — always rendered first, never blocked on an async job.

## Capability probe (run once, before the front-door question)

Gate the format options by what's actually available, so the picker never offers a path that will fail:

Use the established MCP-probe pattern (`Read("${CLAUDE_SKILL_DIR}/../chain-patterns/references/mcp-detection.md")`) — not invented helpers:

```python
ToolSearch(query="select:mcp__notebooklm-mcp__studio_create")   # infographic gate
```

- **ascii** — always available (the floor).
- **playground** — available if the `playground` skill is installed (ships with ork).
- **infographic** — available if `mcp__notebooklm-mcp__studio_create` resolved via the `ToolSearch` above. If the server is undefined in `.mcp.json` or `nlm login` hasn't run, the tool won't resolve — treat infographic as unavailable.

Hide unavailable options from the AskUserQuestion list and add a one-line install/auth hint instead of failing:

| Unavailable | Hint to surface |
|-------------|-----------------|
| playground | "Playground needs the `playground` skill (ships with ork) — falling back to ASCII." |
| infographic | "NotebookLM infographic needs the notebooklm MCP server reachable + `nlm login` — falling back to ASCII." |

`All available` = the union of whatever passed the probe. If only ASCII passed, skip the question entirely and render ASCII.

## Dispatch table

| Format | How | Output | Blocks? |
|--------|-----|--------|---------|
| ASCII + emojis | Native — render sections per `rules/section-rendering.md` | In chat | n/a (always first) |
| Interactive playground | Classify archetype (§0 of the visual standard), build the plan brief, hand to the `playground` skill | `docs/<branch-dir>/plan-viz.html` | No — write then link |
| NotebookLM infographic/slides | Build a source doc, run the notebooklm `studio_create(artifact_type=infographic\|slides)` flow | `.png`/slides artifact | **No — fire-and-notify** |
| All available | Fan out: ASCII inline now + the others as they finish | all of the above | No |

`<branch-dir>` = current branch with `/` → `--` (matches the PR Playground CI gate path, so the playground also satisfies that gate for free).

> **Archetype before generation.** Most plan visualizations are a **DASHBOARD** (the default card grid).
> But a plan that demonstrates a *user-facing flow* or a *prioritization/decision* should be a
> **user-story-player** or **decision-board** — `Read("${CLAUDE_PLUGIN_ROOT}/skills/shared/rules/playground-visual-standard.md")`
> for the §0 routing rule, the token/glass/motion spec, and the exemplars to adapt
> (`skills/shared/assets/playground-exemplars/`). Brief the `playground` skill with archetype + persona, not raw HTML.
>
> **Decision-router variant.** When the board is a *backlog the user must both prioritize and dispatch*
> (issues to triage, PRD phases to schedule, a wave to route), use the **execution-router** board: each
> card routes to an ork strategy (single/workflow/nested/teams/swarm) over the full 36-agent registry and
> emits a **plan-only** invocation. Seeding recipe + strategy→tooling map: `Read("${CLAUDE_SKILL_DIR}/references/decision-router.md")`.

## Living-plan update mode

A plan that executes over multiple sessions/waves is a **living plan**: one plan = ONE html file that
carries its own state and gets updated in place. Exemplar: `living-plan.template.html` (§0 dashboard
sub-route in the visual standard). The contract:

1. **Detect by SLUG, never by path.** Path-keyed detection is broken by design: the target path is
   derived from the branch name, so renaming the branch moves the path, the check misses, and the
   plan forks. That is not hypothetical — `langchain-ecosystem-currency` shipped as two files with
   the same slug and the same `updated` date, under `docs/chore--…` and `docs/research--…`.

   Run this **before authoring**, not after:

   ```bash
   # SLUG = the plan's stable slug (kebab-case, derived from the plan title — NOT the branch)
   bash "$SKILL_DIR/scripts/find-living-plan.sh" "$SLUG"
   ```

   - **Exactly one hit** → you are UPDATING that file. Merge into it (step 2) wherever it lives.
   - **No hits** → you are AUTHORING. Write `docs/<branch-dir>/plan-viz.html` (step 5).
   - **More than one hit** → STOP. The plan already forked. Say so, name both paths, and ask which
     survives; `git mv` the survivor and delete the other in the same commit. Do not write a third.

   Renaming a branch is a `git mv` of the directory, never a new file. The slug is the identity;
   the path is an address that can change.
2. **Merge, never overwrite.** Parse the JSON, flip item `status` (`planned → in_progress → done`, or
   `dropped` with a changelog reason), append to `changelog` (append-only), bump `updated`. Removed work
   moves to `dropped`; items are never deleted.
3. **Evidence gate.** An item may only move to `done` when its `evidence` check ("done when: <command>")
   has actually been run this session. Done without evidence is a contract violation — leave it
   `in_progress` and say why.
4. **State renders, prose doesn't.** The "Now" column and wave counters are computed from item statuses
   by the file's own renderer. Update the JSON; do not hand-edit rendered progress.
5. **Git history is the timeline.** Each update is a normal commit; no side-channel progress files.
6. **The filename is `plan-viz.html`.** Not `index.html`, not a topic name. The spec has always said
   so and reality ran 5:1 against it (`index.html` ×79 vs `plan-viz.html` ×18, plus ~90 bespoke
   names), which is exactly what breaks slug lookup and leaves 191 artifacts unindexable. One
   filename, one glob, one `find-living-plan.sh` that works.

Minimal state shape (v1): `{lpp, slug, title, created, updated, score{composite,target},
waves[{id,title,status}], items[{id,wave,title,impact,effort,risk,status,detail,evidence,owner}],
changelog[{at,note}]}`.

## The plan brief (shared interchange, v1)

All non-ASCII renderers consume the same compact markdown brief built in STEP 1 — one source of truth, no per-format recomputation:

```
# Plan: <name> (<issue_ref>)
Risk: <level> | Confidence: <conf> | Reversible until <phase>

## Before/After Architecture
<pre-diff component map>  →  <post-diff component map>

## Sections
[selected sections, each as a short titled block]
```

> v2 (separate follow-up issue): replace this markdown brief with a json-render plan-viz Zod catalog so ASCII / HTML / PDF / OG-image render from one typed spec with parity (mirrors `assess`'s `assess-dashboard.json`). The markdown brief is a stable v1 interface, not a throwaway — v2 adds a typed layer behind it.

## ASCII floor rule

Always render the ASCII view **first and inline**, even when a richer format is selected. Rationale:
- NotebookLM `studio_create` is async — never `await` it inside the skill. Kick it off, then poll `studio_status` on a **bounded budget: up to 10 checks at 30s intervals** (~5 min ceiling). On `complete`, surface the artifact link via a hook `terminalSequence` (CC 2.1.141+ — the no-round-trip path, preferred) or `PushNotification`; on timeout, surface a "still rendering — open it in NotebookLM directly" link instead of hanging. The user already has the ASCII answer, so this never blocks.
- If a richer renderer fails mid-flight, the user still has a complete visualization.

## Progressive upgrade (STEP 5 action)

After ASCII renders, offer "upgrade this to [playground | infographic]" so format is also a *post-hoc* choice, not only a front-door one. Reuses the same plan brief — no recomputation.
