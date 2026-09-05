---
description: Audits sub-agent activation from explicit consumer telemetry roots. It separates attempted, started, completed, and unattributed events, reports coverage, and identifies observed zero starts without making an estate-wide dormancy claim. Use when specialized agents feel under-used, before pruning the catalog, or after wiring new agent spawn paths.
argument-hint: "[--json]"
disable-model-invocation: false
context: fork
user-invocable: true
name: audit-activation
background: false
allowed-tools: [Bash, Read, Write, Edit, Glob, Grep]
---

# Auto-generated from skills/audit-activation/SKILL.md
# Source: https://github.com/yonatangross/orchestkit


# audit-activation

Reports whether OrchestKit's specialized sub-agents are actually being activated, from **real spawn telemetry** — not vibes. Scope is agent *activation*, not skill *quality*.

It answers: "Do my specialized agents get spawned, or does the model default to generic Explore/general-purpose?" Read-only — it never edits agents.

> **Why this exists:** a 2026-06 audit found only ~14% of agent spawns hit the 36-agent catalog vs ~74% generic, with 17/36 agents dormant — and that agents fire ~1:1 with how often a high-traffic skill names them via `subagent_type=`. Description rewrites ("use proactively") were A/B-tested and gave Δ0, so this skill measures **wiring + usage**, not description prose. See `docs/feat--activation-audit/`.

## Quick Reference

| Category | File | Impact | When to Use |
|----------|------|--------|-------------|
| Activation Checks | `${CLAUDE_PLUGIN_ROOT}/skills/audit-activation/rules/activation-checks.md` | HIGH | What to compute per agent |
| Classification | `${CLAUDE_PLUGIN_ROOT}/skills/audit-activation/rules/activation-status.md` | HIGH | fires / mis-triggered / niche / dead buckets |
| Output Format | `${CLAUDE_PLUGIN_ROOT}/skills/audit-activation/references/output-format.md` | MEDIUM | Report layout + the spawn-split summary |

## CRITICAL: Task Management is MANDATORY (CC 2.1.16)

```python
TaskCreate(subject="Audit activation: agent spawn analysis",
  description="Computing generic-vs-specialist split + dormancy from spawn telemetry",
  activeForm="Auditing agent activation")
TaskCreate(subject="Read spawn telemetry", activeForm="Reading subagent-spawns.jsonl")
TaskCreate(subject="Compute split + observed zero starts", activeForm="Computing activation events and coverage")
TaskCreate(subject="Classify & render", activeForm="Classifying agents and rendering report")
TaskUpdate(taskId="3", addBlockedBy=["2"])
TaskUpdate(taskId="4", addBlockedBy=["3"])
```

## Workflow

1. **Run the script FIRST** — every audit starts by running (or, when execution is impossible, explicitly referencing) the deterministic collector:

   ```bash
   bash "${CLAUDE_PLUGIN_ROOT}/skills/audit-activation/scripts/run-activation-audit.sh" \
     --telemetry-root /path/to/consumer-project \
     --stop-feed "$HOME/.claude/analytics/agent-usage.jsonl" \
     --days 30 --json
   ```

   It resolves the catalog beside its source or installed script, while every consumer telemetry root is explicit. It reports attempts, starts, and stop-feed completions separately. Never eyeball JSONL by hand when the script exists.
2. **Inventory** — let the script resolve its own source or installed `agents/` catalog. Do not point it at a consumer project's agent directory.
3. **Read telemetry** — `.claude/logs/subagent-spawns.jsonl` carries pretool intent and start events. Triangulate it with the restored global `~/.claude/analytics/agent-usage.jsonl` stop feed when available. The streams have no stable common event ID, so never add them together or infer unique spawns.
4. **Compute** — all checks from `Read("${CLAUDE_PLUGIN_ROOT}/skills/audit-activation/rules/activation-checks.md")`; the Report Contract below lists the mandatory ones.
5. **Classify** — bucket every agent using the Four Buckets below (full procedure: `Read("${CLAUDE_PLUGIN_ROOT}/skills/audit-activation/rules/activation-status.md")`).
6. **Render** — output per `Read("${CLAUDE_PLUGIN_ROOT}/skills/audit-activation/references/output-format.md")`, satisfying the Report Contract.

## Report Contract (every audit MUST include all six)

1. **Data-source line (first line of the report)** — name `scripts/run-activation-audit.sh`, every explicit consumer `.claude/logs/subagent-spawns.jsonl` root, the UTC window, and the spawn coverage state (`observed`, `missing`, `empty`, or `partial`). State whether `~/.claude/analytics/agent-usage.jsonl` was supplied as a stop feed. A report that presents numbers without these coverage facts is invalid.
2. **Spawn split** — generic (Explore/general-purpose/Plan) vs **ork-catalog** vs other-plugin, as **counts AND percentages** (e.g. "412 generic (74%) / 78 ork-catalog (14%) / 67 other (12%)"). Never percentages alone.
3. **Concentration** — the **top-5 agents' share of all catalog spawns** as a percentage (e.g. "top-5 = 81% of catalog spawns"), plus the top-5 list with fire counts.
4. **Observed-zero-start list** — only when spawn coverage is `observed`, enumerate every catalog agent with zero start events in the supplied roots, one per line with its reference count and bucket. This is not an estate-wide or lifetime dormancy claim. Do not render the list when coverage is missing, empty, or partial.
5. **Window caveat** — state that observed-zero-start names are absent only from the supplied roots and UTC window. They are a routing signal, not proof of zero estate-wide or lifetime use.
6. **Four-bucket classification table** (below) + **fix recommendations** — wiring changes only (see Hard Rules).

## Classification: the Four Buckets (`rules/activation-status.md`)

Bucket by **reference counts**, never by description quality. For each observed-zero-start agent, count its real spawn references: `grep -rc "subagent_type=ork:<name>" src/skills/` (plus `agent:`/team-map mentions in `src/agents/`). **Show the evidence**: cite that grep command in the report and put each agent's ref-count (with an example source file, e.g. `src/skills/cover/SKILL.md`) in the classification table. The telemetry observation proves only starts in supplied roots; the grep proves wiring. Render classification only when coverage is `observed`.

| Bucket | Condition | Action |
|--------|-----------|--------|
| **ACTIVE** | fired ≥1× in the telemetry window | none — it works |
| **MIS-TRIGGERED** | observed zero starts, has references but no real `subagent_type=` spawn from a busy skill | wire a spawn from a high-traffic skill |
| **NICHE** | observed zero starts, rare-by-nature domain (design, multimodal, perf, IaC, security-LLM) AND wired somewhere | keep - low use expected |
| **DEAD** | observed zero starts AND **zero references in ANY skill or agent** | prune candidate |

**DEAD requires zero references anywhere** — an agent with even one reference is never DEAD; it is mis-triggered or niche. Only DEAD agents are prune candidates.

## Hard Rules

- **Never recommend rewriting agent descriptions.** A/B-tested: description rewrites gave Δ0 routing benefit. Dormancy is a **skill-wiring problem** — the fix is always adding a `subagent_type=ork:<name>` spawn from a high-traffic skill (e.g. implement, cover, review-pr), never prose changes.
- **Classify by reference count, not description quality.** The grep above is the evidence; "the description is vague" is not.
- **State the telemetry window, supplied roots, and coverage state in EVERY answer** — including classification-only or prune-decision answers. Observed-zero-start is never an estate-wide dormancy claim.
- **Keep event semantics separate.** Pretool is attempted intent, `source:start` is started activation, and `agent-usage.jsonl` is a stop/completion observation. Cite all supplied sources and never sum them into a unique-spawn claim.
- **Answer with the report itself, never with only a description of the process.** Even when you cannot execute the script in the current context, render the full contract-format report (state which numbers are from the latest available run vs illustrative).
- Read-only: this skill never edits agents.

## Example report shape (illustrative numbers — imitate the FORM exactly)

```markdown
Data: scripts/run-activation-audit.sh over /consumer/.claude/logs/subagent-spawns.jsonl (window: 2026-05-23T00:00:00Z to 2026-07-14T00:00:00Z; coverage: observed)
Stop feed: ~/.claude/analytics/agent-usage.jsonl supplied separately; it is not joined to starts.

## Spawn split
Total 560 spawns: 412 generic (74%) / 78 ork-catalog (14%) / 70 other-plugin (12%)

## Concentration
Top-5 = 63/78 catalog spawns (81%): web-research-analyst 26, code-quality-reviewer 21,
test-generator 8, debug-investigator 5, backend-system-architect 3

## Observed zero-start agents (6 of 20 in the supplied roots, refs via grep -rc "subagent_type=ork:<name>" src/skills/)
- emulate-engineer      (3 refs)  -> MIS-TRIGGERED
- expect-agent          (3 refs)  -> MIS-TRIGGERED
- design-system-architect (2 refs) -> NICHE (rare domain, wired)
- multimodal-specialist (1 ref)   -> NICHE (rare domain, wired)
- infrastructure-architect (2 refs) -> NICHE (rare domain, wired)
- event-driven-architect (1 ref)  -> MIS-TRIGGERED

Caveat: observed zero starts are absent only from the supplied telemetry roots and
window. They are not proof of zero estate-wide or lifetime use.

## Buckets (rules/activation-status.md)
ACTIVE (14) | MIS-TRIGGERED (3) | NICHE (3) | DEAD (0 — none: every agent has >=1 reference)

## Fixes (wiring only — never description rewrites)
- emulate-engineer: add subagent_type=ork:emulate-engineer spawn from cover (src/skills/cover/SKILL.md)
- expect-agent: add subagent_type=ork:expect-agent spawn from review-pr
```

## Chain

After this audit, run the deeper experiment if you suspect descriptions: `docs/feat--activation-audit/agent-routing-experiment.mjs` (isolated A/B selection harness).

## Related Skills

- `telemetry-inspect` — validates the telemetry data-plane this skill reads from
- `analytics` — raw usage queries across projects
- `doctor` — broader plugin health (manifests, hooks, memory budget)

> Eval note: this skill is direct-only (`disable-model-invocation: true`), so quality evals run in TIER-1 unit mode (`--force-skill`) — routed evals are impossible by construction.
