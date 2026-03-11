---
name: design-system-tokens
license: MIT
compatibility: "Claude Code 2.1.73+."
description: Design token management with W3C Design Token Community Group specification, three-tier token hierarchy (global/alias/component), OKLCH color spaces, Style Dictionary transformation, and dark mode theming. Use when creating design token files, implementing theme systems, managing token versioning, or building design-to-code pipelines.
tags: [design-tokens, w3c-tokens, oklch, style-dictionary, theming, dark-mode, css-variables, tailwind-theme, design-system, color-spaces]
context: fork
agent: frontend-ui-developer
version: 1.0.0
author: OrchestKit
user-invocable: false
disable-model-invocation: true
complexity: medium
metadata:
  category: document-asset-creation
allowed-tools:
  - Read
  - Glob
  - Grep
  - WebFetch
  - WebSearch
---

# Design System Tokens

Design token management following the W3C Design Token Community Group (DTCG) specification. Tokens provide a single source of truth for design decisions — colors, spacing, typography, elevation — shared between design tools (Figma, Penpot) and code (CSS, Tailwind, iOS, Android). Major adopters include Figma (Variables API), Google (Material Design 3), Microsoft (Fluent UI), and Shopify (Polaris).

## Quick Reference

| Category | Rule File | Impact | When to Use |
|----------|-----------|--------|-------------|
| W3C Token Format | `tokens-w3c-format.md` | CRITICAL | Creating or reading `.tokens.json` files |
| Contrast Enforcement | `tokens-contrast-enforcement.md` | CRITICAL | Validating WCAG contrast at token definition time |
| Three-Tier Hierarchy | `tokens-three-tier.md` | HIGH | Organizing tokens into global/alias/component layers |
| OKLCH Color Space | `tokens-oklch-color.md` | HIGH | Defining colors with perceptual uniformity |
| Spacing & Depth | `tokens-spacing-depth.md` | HIGH | Defining elevation shadows and spacing scales as tokens |
| Style Dictionary | `tokens-style-dictionary.md` | HIGH | Transforming tokens to CSS/Tailwind/iOS/Android |
| Theming & Dark Mode | `tokens-theming-darkmode.md` | HIGH | Implementing theme switching and dark mode |
| Versioning | `tokens-versioning.md` | HIGH | Evolving tokens without breaking consumers |

**Total: 8 rules across 8 categories**

## Quick Start

W3C DTCG token format (`.tokens.json`):

```json
{
  "color": {
    "primary": {
      "50": {
        "$type": "color",
        "$value": "oklch(0.97 0.01 250)",
        "$description": "Lightest primary shade"
      },
      "500": {
        "$type": "color",
        "$value": "oklch(0.55 0.18 250)",
        "$description": "Base primary"
      },
      "900": {
        "$type": "color",
        "$value": "oklch(0.25 0.10 250)",
        "$description": "Darkest primary shade"
      }
    }
  },
  "spacing": {
    "sm": {
      "$type": "dimension",
      "$value": "8px"
    },
    "md": {
      "$type": "dimension",
      "$value": "16px"
    },
    "lg": {
      "$type": "dimension",
      "$value": "24px"
    }
  }
}
```

## Three-Tier Token Hierarchy

Tokens are organized in three layers — each referencing the layer below:

| Tier | Purpose | Example |
|------|---------|---------|
| **Global** | Raw values | `color.blue.500 = oklch(0.55 0.18 250)` |
| **Alias** | Semantic meaning | `color.primary = {color.blue.500}` |
| **Component** | Scoped usage | `button.bg = {color.primary}` |

This separation enables theme switching (swap alias mappings) without touching component tokens.

```json
{
  "color": {
    "blue": {
      "500": { "$type": "color", "$value": "oklch(0.55 0.18 250)" }
    },
    "primary": { "$type": "color", "$value": "{color.blue.500}" },
    "action": {
      "default": { "$type": "color", "$value": "{color.primary}" }
    }
  }
}
```

## OKLCH Color Space

OKLCH (Oklab Lightness, Chroma, Hue) provides perceptual uniformity — equal numeric changes produce equal visual changes. This solves HSL's problems where `hsl(60, 100%, 50%)` (yellow) appears far brighter than `hsl(240, 100%, 50%)` (blue) at the same lightness.

```css
/* OKLCH: L (0-1 lightness), C (0-0.4 chroma/saturation), H (0-360 hue) */
--color-primary: oklch(0.55 0.18 250);
--color-primary-hover: oklch(0.50 0.18 250);  /* Just reduce L for darker */
```

Key advantage: adjusting lightness channel alone creates accessible shade scales with consistent contrast ratios.

## Detailed Rules

Each rule file contains incorrect/correct code pairs and implementation guidance.

Read("${CLAUDE_SKILL_DIR}/rules/tokens-w3c-format.md")

Read("${CLAUDE_SKILL_DIR}/rules/tokens-contrast-enforcement.md")

Read("${CLAUDE_SKILL_DIR}/rules/tokens-three-tier.md")

Read("${CLAUDE_SKILL_DIR}/rules/tokens-oklch-color.md")

Read("${CLAUDE_SKILL_DIR}/rules/tokens-spacing-depth.md")

Read("${CLAUDE_SKILL_DIR}/rules/tokens-style-dictionary.md")

Read("${CLAUDE_SKILL_DIR}/rules/tokens-theming-darkmode.md")

Read("${CLAUDE_SKILL_DIR}/rules/tokens-versioning.md")

## Style Dictionary Integration

Style Dictionary transforms W3C tokens into platform-specific outputs (CSS custom properties, Tailwind theme, iOS Swift, Android XML). Configure a single `config.json` to generate all platform outputs from one token source.

See `rules/tokens-style-dictionary.md` for configuration patterns and custom transforms.

## Dark Mode & Theming

Token-based theming maps alias tokens to different global values per theme. Dark mode is one theme — you can support any number (high contrast, brand variants, seasonal).

```css
:root {
  --color-surface: oklch(0.99 0.00 0);
  --color-on-surface: oklch(0.15 0.00 0);
}

[data-theme="dark"] {
  --color-surface: oklch(0.15 0.00 0);
  --color-on-surface: oklch(0.95 0.00 0);
}
```

See `rules/tokens-theming-darkmode.md` for full theme switching patterns.

## Versioning & Migration

Tokens evolve. Use semantic versioning for your token packages, deprecation annotations in token files, and codemods for breaking changes.

```json
{
  "color": {
    "brand": {
      "$type": "color",
      "$value": "oklch(0.55 0.18 250)",
      "$extensions": {
        "com.tokens.deprecated": {
          "since": "2.0.0",
          "replacement": "color.primary.500",
          "removal": "3.0.0"
        }
      }
    }
  }
}
```

See `rules/tokens-versioning.md` for migration strategies.

## Key Decisions

| Decision | Recommendation |
|----------|----------------|
| Token format | W3C DTCG `.tokens.json` with `$type`/`$value` |
| Color space | OKLCH for perceptual uniformity |
| Hierarchy | Three-tier: global, alias, component |
| Build tool | Style Dictionary 4.x with W3C parser |
| Theming | CSS custom properties with `data-theme` attribute |
| Token references | Use `{path.to.token}` alias syntax |

## Anti-Patterns (FORBIDDEN)

- **Hardcoded values in components**: Always reference tokens, never raw `#hex` or `16px`
- **Flat token structure**: Use three-tier hierarchy for theme-ability
- **HSL for shade scales**: OKLCH produces perceptually uniform scales; HSL does not
- **Skipping `$type`**: Every token must declare its type for tooling compatibility
- **Theme via class toggling raw values**: Use semantic alias tokens that remap per theme
- **Unversioned token packages**: Token changes break consumers; use semver

## References

| Resource | Description |
|----------|-------------|
| [references/w3c-token-spec.md](references/w3c-token-spec.md) | W3C DTCG specification overview |
| [references/style-dictionary-config.md](references/style-dictionary-config.md) | Style Dictionary 4.x configuration guide |
| [references/token-naming-conventions.md](references/token-naming-conventions.md) | Naming patterns and conventions |

## Agent Integration

The `design-system-architect` agent orchestrates token workflows end-to-end — from Figma Variables extraction through Style Dictionary transformation to theme deployment. When working on token architecture decisions, the agent coordinates with `frontend-ui-developer` for component token consumption and `accessibility` skills for contrast validation.

## Related Skills

- `ork:ui-components` — Component library patterns (shadcn/ui, Radix)
- `ork:accessibility` — WCAG compliance, contrast ratios
- `ork:responsive-patterns` — Responsive breakpoints, fluid typography
- `ork:figma-design-handoff` — Figma Variables to tokens pipeline
