---
title: Rules and References Requirement
impact: MEDIUM
tags: [audit, rules, references, skill-quality]
---

# Rules and References Requirement

## Rule

Every skill should have at least one of:
- One or more files in `rules/` (excluding `_sections.md` and `_template.md`)
- One or more files in `references/`

A skill with 0 rules AND 0 refs likely has all content inline in SKILL.md — a sign it needs restructuring.

## Exceptions

Orchestration skills (`implement`, `explore`, `verify`, `brainstorming`, `plan-viz`, etc.) may legitimately have 0 rules if they use `references/` instead. Do not flag unless both counts are 0.

## Severity

| Condition | Status |
|-----------|--------|
| rules > 0 OR refs > 0 | PASS |
| rules == 0 AND refs == 0 | WARN |

## Fix

Extract prescriptive "always do X" content into `rules/*.md`. Extract explanatory/conceptual content into `references/*.md`. Update SKILL.md to reference them in a Rules/References table.
