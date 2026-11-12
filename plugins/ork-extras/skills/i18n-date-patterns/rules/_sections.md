---
title: i18n & Date Patterns Rule Categories
version: 2.0.0
---

# Rule Categories

## 1. Translation Patterns (i18n) — CRITICAL — 1 rule

Correct string handling for internationalized applications.

- `i18n-formatting-antipatterns.md` — Never concatenate translated strings, use ICU MessageFormat placeholders

## 2. Message Format (i18n) — HIGH — 2 rules

ICU MessageFormat and React i18next component usage.

- `i18n-icu-plurals.md` — Proper ICU plural syntax with locale-aware plural categories
- `i18n-trans-component.md` — Embed JSX in translations with Trans component instead of splitting t() calls
