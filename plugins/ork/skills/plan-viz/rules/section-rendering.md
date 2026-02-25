---
title: Section Rendering Conventions
impact: HIGH
category: visualization
description: Rules for rendering plan-viz sections with consistent style, annotations, and structure.
---

# Section Rendering Conventions

Each plan-viz section follows strict rendering rules to ensure consistency and reviewer utility.

## General Rules

1. **Every section answers ONE reviewer question** — if it doesn't answer a question, cut it
2. **Use scripts for precision** — run `analyze-impact.sh` for file/line counts, never estimate
3. **Annotations carry judgment** — `!!` for risk, `**` for new, `blocks` for dependencies
4. **Summary lines are mandatory** — every section ends with a one-line summary

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

## Section [4]: Decision Log

- ADR-lite format: Context, Decision, Alternatives, Tradeoff
- Only document non-obvious decisions (skip "we need a database table")
- Always show at least one rejected alternative
- Tradeoffs must be honest — show the cost, not just the benefit

## Section [5]: Impact Summary

- Table format with Categories (Added, Modified, Deleted, NET)
- Include: Tests coverage delta, API surface changes, dependency changes
- Use `assets/impact-dashboard.md` template
