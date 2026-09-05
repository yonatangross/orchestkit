---
title: "Activation Checks"
impact: HIGH
impactDescription: "Without these computations the audit is vibes, not telemetry — wrong agents get pruned and the real wiring gap is missed"
tags: agents, activation, telemetry, metrics
---

# Activation Checks

What to compute for the activation audit. Explicit consumer roots provide the spawn stream `.claude/logs/subagent-spawns.jsonl`; the restored `agent-usage.jsonl` stop feed is optional corroboration. Keep attempted, started, completed, and unattributed events separate because the streams have no stable common ID.

## 1. Spawn split (the headline)

Classify every `source:start` event's `subagent_type` into one of three buckets:

- **generic CC** — `Explore`, `general-purpose`, `Plan`, `workflow-subagent`, `statusline-setup`
- **ork catalog** — name (minus the configured namespace prefix) matches a file in the script-resolved catalog
- **other-plugin** — anything else (`candlekeep-cloud:*`, `claude-code-guide`, `hq-ext:*`)

Report each as count + % of total. A healthy catalog is NOT dominated by generic.

**Incorrect** — counting only ork spawns and reporting "20 agents fired" with no denominator (looks fine; hides that generic did 74%).

**Correct** — `generic 690 (74%) · ork 130 (14%) · other 107 (11%)` — the ratio is the finding.

## 2. Per-agent event counts + observed-zero-start set

Report per-agent attempted, started, and completed counts. `fires` is a backwards-compatible alias for `started`. When spawn coverage is `observed`, compute `observed-zero-start = inventory − started`; otherwise report no zero-start list. This is scoped to supplied roots, never an estate-wide dormant verdict.

## 3. Concentration

`top-5 agents / total spawns` as a %. High concentration (e.g. top-5 = 83%) means a few agents carry the catalog and the rest are dead weight or mis-wired.

## 4. Skill-naming cross-check (the root-cause signal)

For each agent, count how many `src/skills/**/SKILL.md` reference it via a `subagent_type=` spawn for `ork:<name>` (or an `agent: <name>` field). Agents fire ~1:1 with this count — an agent named by 0-1 skills will be dormant regardless of its description. This is what distinguishes "mis-triggered" from "niche".

```bash
grep -rl "subagent_type=\"ork:${name}\"\|subagent_type: ork:${name}" src/skills/ | wc -l
```
