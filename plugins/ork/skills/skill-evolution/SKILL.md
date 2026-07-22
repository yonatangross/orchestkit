---
name: skill-evolution
license: MIT
compatibility: "Claude Code 2.1.206+."
description: "Tracks skill usage patterns, edit frequency, and success rates to suggest improvements and optimizations. Manages skill versioning with safe rollback capability and confidence scoring for suggestions. Use when reviewing skill performance, applying auto-suggested changes, or rolling back problematic versions."
argument-hint: "[subcommand] [skill-id]"
context: inherit
version: 1.1.0
author: OrchestKit
tags: [skill-management, evolution, versioning, analytics]
user-invocable: false
disable-model-invocation: true
allowed-tools: [Read, Write, Edit, Grep, Glob]
complexity: medium
persuasion-type: collaborative
metadata:
  category: document-asset-creation
---

# Skill Evolution Manager

Enables skills to automatically improve based on usage patterns, user edits, and success rates. Provides version control with safe rollback capability.

## Overview

- Reviewing how skills are performing across sessions
- Identifying patterns in user edits to skill outputs
- Applying learned improvements to skill templates
- Rolling back problematic skill changes
- Tracking skill version history and success rates

## Quick Reference

| Command | Description |
|---------|-------------|
| `/ork:skill-evolution` | Show evolution report for all skills |
| `/ork:skill-evolution analyze <skill-id>` | Analyze specific skill patterns |
| `/ork:skill-evolution evolve <skill-id>` | Review and apply suggestions |
| `/ork:skill-evolution history <skill-id>` | Show version history |
| `/ork:skill-evolution rollback <skill-id> <version>` | Restore previous version |
| `/ork:skill-evolution promote <skill-id>` | Holdout bake-off: promote a candidate only if it beats champion by margin |

---

## How It Works

The skill evolution system operates in three phases:

```
COLLECT                    ANALYZE                    ACT
───────                    ───────                    ───
┌─────────────┐           ┌─────────────┐           ┌─────────────┐
│ PostTool    │──────────▶│ Evolution   │──────────▶│ /ork:skill- │
│ Edit        │  patterns │ Analyzer    │ suggest   │ evolution   │
│ Tracker     │           │ Engine      │           │ command     │
└─────────────┘           └─────────────┘           └─────────────┘
     │                          │                          │
     ▼                          ▼                          ▼
┌─────────────┐           ┌─────────────┐           ┌─────────────┐
│ edit-       │           │ evolution-  │           │ versions/   │
│ patterns.   │           │ registry.   │           │ snapshots   │
│ jsonl       │           │ json        │           │             │
└─────────────┘           └─────────────┘           └─────────────┘
```

Load details: `Read("${CLAUDE_SKILL_DIR}/rules/pattern-detection-heuristics.md")` for tracked edit patterns and detection regexes. Load details: `Read("${CLAUDE_SKILL_DIR}/rules/confidence-scoring.md")` for suggestion thresholds.

---

## Subcommands

Each subcommand is documented with implementation details, shell commands, and sample output. Load details: `Read("${CLAUDE_SKILL_DIR}/references/evolution-commands.md")`

### Report (Default)

`/ork:skill-evolution` — Shows evolution report for all tracked skills with usage counts, success rates, and pending suggestions.

### Analyze

`/ork:skill-evolution analyze <skill-id>` — Deep-dives into edit patterns for a specific skill, showing frequency, sample counts, and confidence scores.

### Evolve

`/ork:skill-evolution evolve <skill-id>` — Interactive review of improvement suggestions. Uses `AskUserQuestion` for each suggestion (Apply / Skip / Reject). Creates version snapshot before applying.

### History

`/ork:skill-evolution history <skill-id>` — Shows version history with performance metrics per version.

### Rollback

`/ork:skill-evolution rollback <skill-id> <version>` — Restores a previous version after confirmation. Current version is backed up automatically.

---

## Data Files

| File | Purpose | Format |
|------|---------|--------|
| `.claude/feedback/edit-patterns.jsonl` | Raw edit pattern events | JSONL (append-only) |
| `.claude/feedback/evolution-registry.json` | Aggregated suggestions | JSON |
| `.claude/feedback/metrics.json` | Skill usage metrics | JSON |
| `skills/<cat>/<name>/versions/` | Version snapshots | Directory |
| `skills/<cat>/<name>/versions/manifest.json` | Version metadata | JSON |

---

## Auto-Evolution Safety

Load details: `Read("${CLAUDE_SKILL_DIR}/rules/auto-evolution-triggers.md")` for full safety mechanisms, health monitoring, and trigger criteria.

Key safeguards: version snapshots before changes, auto-alert on >20% success rate drop, human review required, rejected suggestions never re-suggested.

---

## Holdout-Promotion Gate (Champion / Challenger)

`/ork:skill-evolution promote <skill-id>` — promote a candidate edit ONLY if it beats the current version on a **sealed holdout** eval set by a margin (default `0.5` on the 0–10 rubric). Both scores + the promote/reject decision append to an append-only `promotion-ledger.jsonl` for audit. This is the objective gate `evolve` was missing — an "Apply?" prompt is not proof the edit is better — and the native mechanism for "auto-evaluate all skills + agents to standard": a skill graduates by winning a bake-off, not by a human eyeballing a diff.

```
champion (HEAD) -- vs -- challenger (candidate)
        +--------+--------+
   SEALED HOLDOUT (hash-locked) -- bare-eval forked graders
                 v
   delta = challenger - champion >= margin ?  ->  PROMOTE : REJECT  (both logged)
```

Grading runs through `bare-eval` (`--bare --print`, `CLAUDE_CODE_FORK_SUBAGENT=1`) so champion and challenger see byte-identical, isolated conditions — the only variable is the SKILL.md version. Ties reject (incumbent wins); a per-dimension `min_blocker` auto-rejects a one-axis regression even when the composite improves.

**Anti-gaming:** the challenger generator never reads `evals/holdout.jsonl` (input allowlist = `edit-patterns.jsonl` only), and every bake-off + CI recomputes `LC_ALL=C sha256` of the holdout against `holdout.lock.json` — train-on-test or a silent holdout edit fails closed. Expensive by design (`2*N` grader calls; `--bare` requires `ANTHROPIC_API_KEY` and bills tokens), so it runs on-demand or in CI only, never in a background hook ($0 idle).

Load details: `Read("${CLAUDE_SKILL_DIR}/references/holdout-promotion-gate.md")` — ledger/lock JSON schemas, decision rule, run loop, `/goal` + CI wiring.

---

## References

Load on demand with `Read("${CLAUDE_SKILL_DIR}/references/<file>")`:

| File | Content |
|------|---------|
| `evolution-commands.md` | Subcommand implementation, shell commands, and sample output |
| `evolution-analysis.md` | Evolution analysis methodology |
| `version-management.md` | Version management guide |
| `holdout-promotion-gate.md` | Champion/challenger gate: sealed holdout, ledger schema, decision rule, /goal + CI wiring |

## Rules

Load on demand with `Read("${CLAUDE_SKILL_DIR}/rules/<file>")`:

| File | Content |
|------|---------|
| `pattern-detection-heuristics.md` | Edit pattern categories and regex detection |
| `confidence-scoring.md` | Suggestion thresholds and confidence criteria |
| `auto-evolution-triggers.md` | Safety mechanisms and trigger criteria |

---

## Related Skills

- `ork:configure` - Configure OrchestKit settings
- `ork:doctor` - Diagnose OrchestKit issues
- `feedback-dashboard` - View comprehensive feedback metrics
