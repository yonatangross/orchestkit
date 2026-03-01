---
name: skill-evolution
license: MIT
compatibility: "Claude Code 2.1.59+."
description: "Analyzes skill usage patterns and suggests improvements. Use when reviewing skill performance, applying auto-suggested changes, or rolling back versions."
argument-hint: "[subcommand] [skill-id]"
context: inherit
version: 1.0.0
author: OrchestKit
tags: [skill-management, evolution, versioning, analytics]
user-invocable: false
disable-model-invocation: true
allowed-tools: [Read, Write, Edit, Grep, Glob]
complexity: medium
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

See [Pattern Detection Heuristics](rules/pattern-detection-heuristics.md) for tracked edit patterns and detection regexes. See [Confidence Scoring](rules/confidence-scoring.md) for suggestion thresholds.

---

## Subcommands

Each subcommand is documented with implementation details, shell commands, and sample output in the [Evolution Commands Reference](references/evolution-commands.md).

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

See [Auto-Evolution Triggers](rules/auto-evolution-triggers.md) for full safety mechanisms, health monitoring, and trigger criteria.

Key safeguards: version snapshots before changes, auto-alert on >20% success rate drop, human review required, rejected suggestions never re-suggested.

---

## References

- [Evolution Commands Reference](references/evolution-commands.md) — Subcommand implementation, shell commands, and sample output
- [Evolution Analysis Methodology](references/evolution-analysis.md)
- [Version Management Guide](references/version-management.md)

## Rules

- [Pattern Detection Heuristics](rules/pattern-detection-heuristics.md) — Edit pattern categories and regex detection
- [Confidence Scoring](rules/confidence-scoring.md) — Suggestion thresholds and confidence criteria
- [Auto-Evolution Triggers](rules/auto-evolution-triggers.md) — Safety mechanisms and trigger criteria

---

## Related Skills

- `ork:configure` - Configure OrchestKit settings
- `ork:doctor` - Diagnose OrchestKit issues
- `feedback-dashboard` - View comprehensive feedback metrics
