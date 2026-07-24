---
name: project-execute-strategy-selector-2516
description: Design decision for the per-card execution-strategy selector on the #2516 cool-glass decision board
metadata:
  type: project
---

Per-card EXECUTE selector for the #2516 cool-glass decision board (single-file HTML, vanilla JS, zero deps).

**Decision:** Inline block at the END of the existing Details tab — NOT a new "Execute" tab. Drawer already has Details/Comments/Activity.

**Why:** A new tab hides the act-on-it affordance; #2516's thesis is "let you act on the decision, not just read it" — keep read→decide→act in one flow.

**How to apply:** Slot under existing tokens from `src/skills/shared/assets/playground-exemplars/decision-board.template.html` (`--pg-glass`, `--pg-accent`, `--pg-r-md`, 4-tier motion budget, roving-tabindex keyboard idiom, aria-live announce, RTL via logical props).

**The control (3 parts):**
1. 5-row radio-card list (`role=radiogroup`) — closed `z.enum` of the 5 primitives; each row shows reliability band + cost multiplier + constraint badge. Replaces a bare dropdown so the 2026 tradeoff is inline, not memorized.
2. Progressive config — only the selected row's knobs render: topology segmented enum, specialists multi-select from a CLOSED `ork:*` list (no free text), agent-cap integer stepper hard-clamped ≤4 (mesh auto-rejected >4 = structural reliability-cliff rule).
3. Read-only `<pre>` emitted-invocation panel = single source of truth, recomputed live, copy button copies exactly what's shown.

**Plan-only is hard-baked:** `--plan-only` is never a user toggle. Council verdict (9-agent ork) = router EMITS an inspectable artifact, never auto-executes. Copied text carries a `# Strategy: … reliability … cost …` comment header so the artifact self-documents the accepted tradeoff.

**Auto-recommend = deterministic decision table, never an LLM call** (see [[reference-execution-primitive-tradeoffs]]). Pure client fn over card.impact/effort/tags; pre-selects the radio + stamps ★ recommended + prints a `why` string.

**AI-safe-generation framing:** strategies/topology/specialists/cap are all closed enums/clamped — the catalog IS the guard rail, same as a json-render catalog stopping hallucinated components. No user/AI input can produce an un-runnable invocation or over-budget mesh.
