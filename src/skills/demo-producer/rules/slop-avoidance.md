---
title: Slop Avoidance Patterns
impact: HIGH
category: quality
description: Rules for eliminating verbose, generic, or redundant text in demo videos.
---

# Slop Avoidance Patterns

Demo videos have limited screen time. Every line of terminal text must earn its place.

## Common Slop to Eliminate

| Slop Pattern | Example | Fix |
|-------------|---------|-----|
| Verbose phase names | "Divergent Exploration" | "Ideas" or "Generating 12 ideas" |
| Redundant sub-descriptions | Phase title + description | Combine into single line |
| Repetitive completions | "✓ Task #2 completed: patterns analyzed" | "✓ #2 patterns" |
| Generic transitions | "Now let's see..." | Cut directly |
| Empty lines for spacing | Multiple blank lines | CSS padding instead |

## Text Density Rules

```
TERMINAL TEXT DENSITY
=====================
✓ "Analyzing topic → 3 patterns found"     (action → result)
✗ "Phase 1: Topic Analysis"                (title only)
✗ "   └─ Keywords: real-time, notifications" (sub-detail)

✓ "✓ #2 patterns"                          (compact completion)
✗ "✓ Task #2 completed: patterns analyzed" (verbose completion)
```

## Timing Compression

```
15-SECOND VIDEO BREAKDOWN
=========================
0-7s:   Terminal demo (action-packed)
7-11s:  Result visualization (payoff)
11-15s: CTA (install command + stats)

Rule: If content doesn't earn its screen time, cut it.
```

## Hook Styles

Choose one per video:

- **Question**: "Tired of [pain point]?"
- **Statistic**: "[X]% of developers miss this"
- **Contrarian**: "Stop [common practice]"
- **Transformation**: "From [bad] to [good] in [time]"
