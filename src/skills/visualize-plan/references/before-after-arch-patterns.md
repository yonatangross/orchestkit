---
title: Before/After Architecture Patterns
description: Section [0] — render the architecture before vs after the plan, per output format.
---

# Before/After Architecture — Section [0]

The default lead section. Answers the reviewer's first question: **"what does this change about the shape of the system?"** Computed once in STEP 1 from the Explore agent's component map (pre-diff `git stash`/base vs post-diff working tree), reused by every format.

## Data source

```python
Agent(subagent_type="Explore", model="haiku", prompt="""
Map the component architecture of {affected_dirs} at TWO points:
  (a) base = origin/main (pre-plan)
  (b) head = working tree (post-plan)
Return for each: components, their dependencies, and what MOVED/ADDED/REMOVED between (a) and (b).
Mark new components [+], removed [-], changed [~].
""")
```

If the plan touches **frontend** (detected via changed `*.tsx`/`*.css`/route files), also fire a `design-context-extract` pass so the design surface (tokens, key screens) is part of before/after — not just the module graph. Backend-only plans get architecture only.

## ASCII format (the floor)

Side-by-side, base on the left, head on the right, deltas marked:

```
BEFORE (origin/main)            AFTER (this plan)
─────────────────────           ─────────────────────
  ┌──────────┐                    ┌──────────┐
  │  API     │                    │  API     │
  └────┬─────┘                    └────┬─────┘
       │                               │
  ┌────▼─────┐                    ┌────▼─────┐   ┌───────────┐
  │ Auth     │                    │ Auth     │──▶│ OAuth svc │ [+]
  └────┬─────┘                    └────┬─────┘   └───────────┘
       │                               │
  ┌────▼─────┐                    ┌────▼─────┐
  │ Postgres │                    │ Postgres │
  └──────────┘                    └──────────┘
                                  [+] new   [~] changed   [-] removed
```

Keep both columns to the same component set so the eye diffs by position. Annotate only what changed; don't redraw-for-decoration.

## Playground (HTML) format

Render the two graphs as a side-by-side Mermaid `flowchart`, with changed nodes class-styled (`classDef added`, `removed`, `changed`) and a toggle to overlay only the delta. The `playground` skill wraps it in the standard single-file explorer. Write to `docs/<branch-dir>/plan-viz.html`.

## NotebookLM infographic format

Feed the before/after brief (module lists + deltas + the one-line "why") as a source doc, then `studio_create(artifact_type=infographic)`. The infographic is for **stakeholders** — lead with the delta narrative ("3 services become 4; auth gains an OAuth dependency"), not the full graph.

## Anti-slop

- No before/after when nothing structural changed (pure refactor within a module) — say so in one line and skip the section.
- Don't invent components to fill symmetry. If the plan only touches one module, show that module's internal before/after, not a fake system map.
