---
title: Audit Status and Severity Guide
tags: [audit, severity, status]
---

# Status Severity Guide

## Status Levels

| Status | Meaning |
|--------|---------|
| PASS | All checks clean — skill is healthy |
| WARN | Non-blocking issues — skill loads but has quality gaps |
| FAIL | Blocking issues — skill may not load or behave correctly |

## Condition Table

| Condition | Severity |
|-----------|----------|
| lines >= 500 | FAIL |
| lines 401–499 | WARN |
| Missing required frontmatter field | WARN |
| 0 rules AND 0 refs | WARN |
| Not in any manifest | FAIL |
| Broken reference (file mentioned in SKILL.md but missing on disk) | WARN |

## Overall Skill Status

A skill is **FAIL** if any FAIL condition is met.
A skill is **WARN** if only WARN conditions are met.
A skill is **PASS** if no conditions are triggered.

## Totals

At the bottom of the audit report, show:
```
Total: N skills | PASS: X | WARN: Y | FAIL: Z
```
