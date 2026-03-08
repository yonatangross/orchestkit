---
title: Design System Tokens Rule Categories
version: 1.0.0
---

# Rule Categories

## 1. W3C Token Format (w3c) — CRITICAL — 1 rule

W3C Design Token Community Group specification compliance for interoperable token files.

- `tokens-w3c-format.md` — `$type`, `$value`, `$description`, token groups, file structure

## 2. Three-Tier Hierarchy (hierarchy) — HIGH — 1 rule

Global, alias, and component token layers for scalable design systems.

- `tokens-three-tier.md` — Global raw values, alias semantics, component-scoped tokens

## 3. OKLCH Color Space (oklch) — HIGH — 1 rule

Perceptually uniform color definitions using OKLCH for accessible shade generation.

- `tokens-oklch-color.md` — OKLCH syntax, shade scales, contrast ratios, gamut mapping

## 4. Style Dictionary (style-dictionary) — HIGH — 1 rule

Token transformation pipeline from W3C JSON to platform-specific outputs.

- `tokens-style-dictionary.md` — Config, custom transforms, W3C parser, multi-platform output

## 5. Theming & Dark Mode (theming) — HIGH — 1 rule

Token-based theme switching with CSS custom properties and data attributes.

- `tokens-theming-darkmode.md` — Theme maps, dark mode, `prefers-color-scheme`, system preference

## 6. Versioning (versioning) — HIGH — 1 rule

Token evolution, deprecation, and migration strategies.

- `tokens-versioning.md` — Semver, deprecation annotations, codemods, changelog
