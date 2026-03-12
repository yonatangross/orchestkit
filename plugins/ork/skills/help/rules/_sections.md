---
title: Help Rule Categories
version: 1.0.0
---

# Rule Categories

## 1. Data Freshness (freshness) — HIGH — 1 rule

Prevents the help skill from displaying skills that have been removed or renamed, avoiding "skill not found" user errors.

- `skill-metadata-freshness.md` — Cross-reference every displayed skill name against the live manifest before rendering any listing

## 2. Classification Accuracy (accuracy) — MEDIUM — 1 rule

Ensures skill category assignments stay in sync with actual skill tags, using tags as the source of truth when conflicts arise.

- `category-accuracy.md` — Verify category assignments against skill `tags` and `metadata.category` from SKILL.md frontmatter; tags override hardcoded mappings
