---
title: "Activation Checks"
impact: HIGH
impactDescription: "Without these computations the audit is vibes, not telemetry — wrong agents get pruned and the real wiring gap is missed"
tags: agents, activation, telemetry, metrics
---

# Activation Checks

What to compute for the activation audit. All counts come from the FRESH spawn stream `.claude/logs/subagent-spawns.jsonl` (NOT the dead `~/.claude/analytics/agent-usage.jsonl`).

## 1. Spawn split (the headline)

Classify every spawn's `subagent_type` into one of three buckets:

- **generic CC** — `Explore`, `general-purpose`, `Plan`, `workflow-subagent`, `statusline-setup`
- **ork catalog** — name (minus any `ork:` prefix) matches a file in `src/agents/`
- **other-plugin** — anything else (`candlekeep-cloud:*`, `claude-code-guide`, `hq-ext:*`)

Report each as count + % of total. A healthy catalog is NOT dominated by generic.

**Incorrect** — counting only ork spawns and reporting "20 agents fired" with no denominator (looks fine; hides that generic did 74%).

**Correct** — `generic 690 (74%) · ork 130 (14%) · other 107 (11%)` — the ratio is the finding.

## 2. Per-agent fire counts + never-fired set

Tally ork-catalog spawns by agent. Then `never-fired = inventory − fired`. List both.

## 3. Concentration

`top-5 agents / total spawns` as a %. High concentration (e.g. top-5 = 83%) means a few agents carry the catalog and the rest are dead weight or mis-wired.

## 4. Skill-naming cross-check (the root-cause signal)

For each agent, count how many `src/skills/**/SKILL.md` reference it via a `subagent_type=` spawn for `ork:<name>` (or an `agent: <name>` field). Agents fire ~1:1 with this count — an agent named by 0-1 skills will be dormant regardless of its description. This is what distinguishes "mis-triggered" from "niche".

```bash
grep -rl "subagent_type=\"ork:${name}\"\|subagent_type: ork:${name}" src/skills/ | wc -l
```
