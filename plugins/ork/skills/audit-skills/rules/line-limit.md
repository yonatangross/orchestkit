---
title: SKILL.md Line Limit
impact: HIGH
impactDescription: "Files over 500 lines exceed Anthropic's official limit and will not load fully"
tags: [audit, line-limit, skill-quality]
---

# SKILL.md Line Limit

## Rule

Every `SKILL.md` must be **fewer than 500 lines**.

## Severity

| Condition | Status |
|-----------|--------|
| lines <= 400 | PASS |
| 401–499 | WARN — approaching limit |
| >= 500 | FAIL — exceeds Anthropic hard limit |

## Fix

Extract inline content into `rules/*.md` or `references/*.md` files, then reference them from SKILL.md. The SKILL.md should be an index, not an encyclopedia.

## Background

Anthropic's official skill documentation states SKILL.md body must be under 500 lines. Exceeding this causes truncation at load time, silently dropping content the model needs.
