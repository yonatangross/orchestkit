---
title: Section Rendering Conventions
impact: HIGH
impactDescription: "Inconsistent section rendering makes plan visualizations confusing and hard to review"
tags: visualization, rendering, plan-review, consistency
category: visualization
description: Rules for rendering visualize-plan sections with consistent style, annotations, and structure.
---

# Section Rendering Conventions

Each visualize-plan section follows strict rendering rules to ensure consistency and reviewer utility.

## General Rules

1. **Every section answers ONE reviewer question** — if it doesn't answer a question, cut it
2. **Use scripts for precision** — run `analyze-impact.sh` for file/line counts, never estimate
3. **Annotations carry judgment** — `!!` for risk, `**` for new, `blocks` for dependencies
4. **Summary lines are mandatory** — every section ends with a one-line summary

**Incorrect:**
```
Files Changed:
- auth.py (modified)
- utils.py (new)
```

**Correct:**
```
[M] src/auth.py       +42 -8   !! security-critical
[A] src/utils.py      +65 -0   **new**
Summary: +107 -8 | 1 new | 1 modified | 0 deleted
```

## Section [1]: Change Manifest

- Use `[A]`/`[M]`/`[D]` prefix symbols (Terraform convention)
- Show `+N -N` line counts per file
- Flag high-risk files with `!!` and annotation
- Mark new files with `**`
- Always end with a summary line: `Summary: +N -N | X new | Y modified | Z deleted`

## Section [2]: Execution Swimlane

- `===` for active work, `---` for blocked/waiting
- Vertical `|` for dependencies with `blocks` annotations
- Identify and label the critical path
- Show parallel opportunities explicitly

## Section [3]: Risk Dashboard

- Part A: Reversibility timeline with `[====]` bars
- Always identify the point of no return with `--- POINT OF NO RETURN ---`
- Part B: Exactly 3 pre-mortem scenarios (most likely, most severe, most subtle)
- Each scenario needs a concrete mitigation, not generic advice

### Name the phase, do not imply it

Measured failure, not hypothetical: a 2026-08-04 eval graded real output as
*"Four execution phases shown but no explicit statement of which phase is the
irreversible point"*. The rule above was already present and still not followed,
so it now carries a test.

The point of no return is a *phase identifier*, not a mood. If a reader cannot
answer "after which phase can I no longer undo this?" by pointing at one token,
the section failed.

```
❌ WRONG   "later phases are harder to reverse"
❌ WRONG   "merging to main makes this permanent"      ← implied, unnamed
✅ RIGHT   --- POINT OF NO RETURN (after P3) ---
           P4 drops the legacy column; data is unrecoverable from that point.
```

Test: does the literal phase id appear on the same line as the marker?

For the second measured failure — pre-mortems that name a *category* instead of a
*mechanism* — see the "state a MECHANISM, not a category" rule in
`references/risk-dashboard-patterns.md`, which is where the pre-mortem patterns live.

## Section [4]: Decision Log

- ADR-lite format: Context, Decision, Alternatives, Tradeoff
- Only document non-obvious decisions (skip "we need a database table")
- Always show at least one rejected alternative
- Tradeoffs must be honest — show the cost, not just the benefit

## Section [5]: Impact Summary

- Table format with Categories (Added, Modified, Deleted, NET)
- Include: Tests coverage delta, API surface changes, dependency changes
- Use `assets/impact-dashboard.md` template
