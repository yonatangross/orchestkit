---
name: execution-strategy-selector
description: Per-card Execute-tab router design for the #2516 decision board — plan-only, decision-table auto-recommend, emits inspectable copy-paste invocation
metadata:
  type: project
---

Design (2026-06-18) for the per-card EXECUTION-STRATEGY SELECTOR in the #2516 cool-glass decision board drawer (single-file HTML, vanilla JS).

Decision: a new **Execute** drawer tab (4th, after Details/Comments/Activity), NOT inline in Details — execution is a distinct mode and inline would overload the primary tier (violates §3 hierarchy). It is a PLAN-ONLY router: it computes a recommended strategy from the card's impact/effort/tags via a deterministic decision table, shows the 2026 reliability/cost tradeoff inline, and emits a copy-paste-runnable artifact into a read-only `<pre>`. It NEVER auto-executes (council verdict [[swarm-decomposer-decision]]).

Decision table (auto-recommend, first match wins):
- tags include debate|critique|review|verdict|council  -> Swarm (council), mesh capped <=4
- tags include migrate|rename|same-transform OR title ~ "x N" -> swarm-migrate (deterministic batch)
- single ork:* skill verb match (write-prd|implement|remember|assess) -> ork skill
- effort>3 AND independent subtasks (default for Big bet / multi-tag) -> Workflow pipeline (orchestrator-worker)
- else (Quick win / Fill-in, single transform) -> Workflow pipeline (highest reliability, cheapest)

Reliability ladder shown inline (2026): pipeline ~90% > orchestrator-worker ~80% > mesh ~60-70% > free-swarm 35-55%. Mesh ~3x cost. The selector DEFAULTS to the highest-reliability strategy that fits; escalation to mesh/swarm is an explicit user override with a cost/reliability warning.

Control: a segmented radio (5 primitives) = the strategy, with a progressive-disclosure config region under it (topology preview + specialist multi-select for Workflow/mesh + cost·reliability preview bar). The emitted-invocation `<pre>` updates live on every change. "Recommended" badge marks the auto-pick; changing away from it shows a delta note ("mesh = 3x cost, ~20pt lower reliability than recommended pipeline").

How to apply: if asked to extend the board's drawer or build a strategy picker, reuse this — Execute tab, decision-table default, plan-only emit, override-with-warning. The emitted artifact must be runnable as-is (real Workflow JSON / real /ork: command / real Agent Teams roster), keyed off the live card object.
