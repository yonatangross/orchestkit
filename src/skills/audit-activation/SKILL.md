---
name: audit-activation
compatibility: "Claude Code 2.1.206+"
description: Audits OrchestKit sub-agent activation from real spawn telemetry — computes the generic-vs-specialist spawn split, flags dormant agents (never fired), and classifies each as fires/mis-triggered/niche. The agent-side analogue of audit-skills. Use when specialized agents feel under-used, before pruning the catalog, or after wiring new agent spawn paths.
tags: [audit, agents, activation, telemetry, orchestkit]
version: 1.0.0
author: OrchestKit
user-invocable: true
disable-model-invocation: true
argument-hint: "[--json]"
context: fork
complexity: medium
persuasion-type: discipline
allowed-tools:
  - Read
  - Glob
  - Grep
  - Bash
  - TaskCreate
  - TaskUpdate
  - TaskList
---

# audit-activation

Reports whether OrchestKit's specialized sub-agents are actually being activated, from **real spawn telemetry** — not vibes. The agent-side analogue of `audit-skills` (which audits skill *quality*; this audits agent *activation*).

It answers: "Do my specialized agents get spawned, or does the model default to generic Explore/general-purpose?" Read-only — it never edits agents.

> **Why this exists:** a 2026-06 audit found only ~14% of agent spawns hit the 37-agent catalog vs ~74% generic, with 17/37 agents dormant — and that agents fire ~1:1 with how often a high-traffic skill names them via `subagent_type=`. Description rewrites ("use proactively") were A/B-tested and gave Δ0, so this skill measures **wiring + usage**, not description prose. See `docs/feat--activation-audit/`.

## Quick Reference

| Category | File | Impact | When to Use |
|----------|------|--------|-------------|
| Activation Checks | `${CLAUDE_SKILL_DIR}/rules/activation-checks.md` | HIGH | What to compute per agent |
| Classification | `${CLAUDE_SKILL_DIR}/rules/activation-status.md` | HIGH | fires / mis-triggered / niche / dead buckets |
| Output Format | `${CLAUDE_SKILL_DIR}/references/output-format.md` | MEDIUM | Report layout + the spawn-split summary |

## CRITICAL: Task Management is MANDATORY (CC 2.1.16)

```python
TaskCreate(subject="Audit activation: agent spawn analysis",
  description="Computing generic-vs-specialist split + dormancy from spawn telemetry",
  activeForm="Auditing agent activation")
TaskCreate(subject="Read spawn telemetry", activeForm="Reading subagent-spawns.jsonl")
TaskCreate(subject="Compute split + dormancy", activeForm="Computing split and dormant agents")
TaskCreate(subject="Classify & render", activeForm="Classifying agents and rendering report")
TaskUpdate(taskId="3", addBlockedBy=["2"])
TaskUpdate(taskId="4", addBlockedBy=["3"])
```

## Workflow

1. **Run the script FIRST** — every audit starts by running (or, when execution is impossible, explicitly referencing) the deterministic collector:

   ```bash
   bash "${CLAUDE_SKILL_DIR}/scripts/run-activation-audit.sh"   # add --json for machine output
   ```

   It reads the spawn telemetry, joins it against `src/agents/`, and prints the split, per-agent fire counts, never-fired list, and top-5 concentration. Never eyeball the JSONL by hand when the script exists.
2. **Inventory** — Glob `src/agents/*.md` (exclude README/INDEX/CONTRIBUTING) for the catalog.
3. **Read telemetry** — the FRESH stream is `.claude/logs/subagent-spawns.jsonl` (writers: `pretool/task/spawn-intent-logger` + `subagent-start/subagent-validator`). The legacy `~/.claude/analytics/agent-usage.jsonl` is DEAD (orphaned in a refactor) — never read it.
4. **Compute** — all checks from `Read("${CLAUDE_SKILL_DIR}/rules/activation-checks.md")`; the Report Contract below lists the mandatory ones.
5. **Classify** — bucket every agent using the Four Buckets below (full procedure: `Read("${CLAUDE_SKILL_DIR}/rules/activation-status.md")`).
6. **Render** — output per `Read("${CLAUDE_SKILL_DIR}/references/output-format.md")`, satisfying the Report Contract.

## Report Contract (every audit MUST include all six)

1. **Data-source line (first line of the report)** — verbatim form: `Data: scripts/run-activation-audit.sh over .claude/logs/subagent-spawns.jsonl (window: <start> → <end>)`. The literal path `.claude/logs/subagent-spawns.jsonl` MUST appear in this line — "telemetry from the spawn log" or any paraphrase is a contract violation. Also state, once, that the legacy `~/.claude/analytics/agent-usage.jsonl` was NOT read (dead stream). A report that presents numbers without citing the script and the literal file path is invalid.
2. **Spawn split** — generic (Explore/general-purpose/Plan) vs **ork-catalog** vs other-plugin, as **counts AND percentages** (e.g. "412 generic (74%) / 78 ork-catalog (14%) / 67 other (12%)"). Never percentages alone.
3. **Concentration** — the **top-5 agents' share of all catalog spawns** as a percentage (e.g. "top-5 = 81% of catalog spawns"), plus the top-5 list with fire counts.
4. **Never-fired list — COMPLETE, by name.** Enumerate EVERY catalog agent absent from the telemetry, one per line with its reference count and bucket. Never truncate to "17 dormant, e.g. these 4" — all names, every time.
5. **Window caveat — verbatim, in every report:** *"Never fired" means absent from the available telemetry window — a strong signal, but NOT proof of zero lifetime use; the window may have gaps.* State the window dates next to it.
6. **Four-bucket classification table** (below) + **fix recommendations** — wiring changes only (see Hard Rules).

## Classification: the Four Buckets (`rules/activation-status.md`)

Bucket by **reference counts**, never by description quality. For each dormant agent, count its real spawn references: `grep -rc "subagent_type=ork:<name>" src/skills/` (plus `agent:`/team-map mentions in `src/agents/`). **Show the evidence**: cite that grep command in the report and put each agent's ref-count (with an example source file, e.g. `src/skills/cover/SKILL.md`) in the classification table — telemetry proves firing, only the grep proves wiring. **Always render all four buckets** — including ACTIVE, and including empty buckets as "(0)" — even when the question asks only about dormant agents, citing `rules/activation-status.md` as the procedure.

| Bucket | Condition | Action |
|--------|-----------|--------|
| **ACTIVE** | fired ≥1× in the telemetry window | none — it works |
| **MIS-TRIGGERED** | dormant, has references but no real `subagent_type=` spawn from a busy skill | wire a spawn from a high-traffic skill |
| **NICHE** | dormant, rare-by-nature domain (design, multimodal, perf, IaC, security-LLM) AND wired somewhere | keep — low use expected |
| **DEAD** | dormant AND **zero references in ANY skill or agent** | prune candidate |

**DEAD requires zero references anywhere** — an agent with even one reference is never DEAD; it is mis-triggered or niche. Only DEAD agents are prune candidates.

## Hard Rules

- **Never recommend rewriting agent descriptions.** A/B-tested: description rewrites gave Δ0 routing benefit. Dormancy is a **skill-wiring problem** — the fix is always adding a `subagent_type=ork:<name>` spawn from a high-traffic skill (e.g. implement, cover, review-pr), never prose changes.
- **Classify by reference count, not description quality.** The grep above is the evidence; "the description is vague" is not.
- **State the telemetry window AND the never-fired caveat in EVERY answer** — including classification-only or prune-decision answers, not just full reports. If the words "never fired" or "dormant" appear anywhere in your output, the caveat sentence from Report Contract #5 must appear too.
- **Name the telemetry file by its literal path in every answer.** The string `.claude/logs/subagent-spawns.jsonl` must appear verbatim in your data-source line (it is the fresh stream you read); never substitute a paraphrase like "the spawn telemetry", and never cite the dead `agent-usage.jsonl` as a source.
- **Answer with the report itself, never with only a description of the process.** Even when you cannot execute the script in the current context, render the full contract-format report (state which numbers are from the latest available run vs illustrative).
- Read-only: this skill never edits agents.

## Example report shape (illustrative numbers — imitate the FORM exactly)

```markdown
Data: scripts/run-activation-audit.sh over .claude/logs/subagent-spawns.jsonl (window: 2026-05-23 → 2026-07-14)
Not read: ~/.claude/analytics/agent-usage.jsonl (dead stream — orphaned writer)

## Spawn split
Total 560 spawns: 412 generic (74%) / 78 ork-catalog (14%) / 70 other-plugin (12%)

## Concentration
Top-5 = 63/78 catalog spawns (81%): web-research-analyst 26, code-quality-reviewer 21,
test-generator 8, debug-investigator 5, backend-system-architect 3

## Never-fired agents (6 of 20 — ALL listed, refs via grep -rc "subagent_type=ork:<name>" src/skills/)
- emulate-engineer      (3 refs)  -> MIS-TRIGGERED
- expect-agent          (3 refs)  -> MIS-TRIGGERED
- design-system-architect (2 refs) -> NICHE (rare domain, wired)
- multimodal-specialist (1 ref)   -> NICHE (rare domain, wired)
- infrastructure-architect (2 refs) -> NICHE (rare domain, wired)
- event-driven-architect (1 ref)  -> MIS-TRIGGERED

Caveat: "Never fired" means absent from the available telemetry window — a strong
signal, but NOT proof of zero lifetime use; the window may have gaps.

## Buckets (rules/activation-status.md)
ACTIVE (14) | MIS-TRIGGERED (3) | NICHE (3) | DEAD (0 — none: every agent has >=1 reference)

## Fixes (wiring only — never description rewrites)
- emulate-engineer: add subagent_type=ork:emulate-engineer spawn from cover (src/skills/cover/SKILL.md)
- expect-agent: add subagent_type=ork:expect-agent spawn from review-pr
```

## Chain

After this audit, run the deeper experiment if you suspect descriptions: `docs/feat--activation-audit/agent-routing-experiment.mjs` (isolated A/B selection harness).

## Related Skills

- `audit-skills` — quality audit for skills (this skill's sibling, agent-side)
- `telemetry-inspect` — validates the telemetry data-plane this skill reads from
- `analytics` — raw usage queries across projects
- `doctor` — broader plugin health (manifests, hooks, memory budget)

> Eval note: this skill is direct-only (`disable-model-invocation: true`), so quality evals run in TIER-1 unit mode (`--force-skill`) — routed evals are impossible by construction.
