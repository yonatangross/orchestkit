---
name: figma-design-handoff
license: MIT
compatibility: "Claude Code 2.1.73+."
description: Figma-to-code design handoff patterns including Figma Variables to design tokens pipeline, component spec extraction, Dev Mode inspection, Auto Layout to CSS Flexbox/Grid mapping, and visual regression with Applitools. Use when converting Figma designs to code, documenting component specs, setting up design-dev workflows, or comparing production UI against Figma designs.
tags: [figma, design-handoff, design-to-code, figma-variables, dev-mode, auto-layout, component-specs, visual-regression, applitools, design-tokens]
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

# Figma Design Handoff

Figma dominates design tooling in 2026, with the majority of product teams using it as their primary design tool. A structured handoff workflow eliminates design drift — the gap between what designers create and what developers build. This skill covers the full pipeline: Figma Variables to design tokens, component spec extraction, Dev Mode inspection, Auto Layout to CSS mapping, and visual regression testing.

## Quick Reference

| Rule | File | Impact | When to Use |
|------|------|--------|-------------|
| Figma Variables & Tokens | `rules/figma-variables-tokens.md` | CRITICAL | Converting Figma Variables to W3C design tokens JSON |
| Component Specs | `rules/figma-component-specs.md` | HIGH | Extracting component props, variants, states from Figma |
| Dev Mode Inspection | `rules/figma-dev-mode.md` | HIGH | Measurements, spacing, typography, asset export |
| Auto Layout → CSS | `rules/figma-auto-layout.md` | HIGH | Mapping Auto Layout to Flexbox/Grid |
| Visual Regression | `rules/figma-visual-regression.md` | MEDIUM | Comparing production UI against Figma designs |

**Total: 5 rules across 1 category**

## Quick Start

```bash
# 1. Export Figma Variables → tokens.json (using Figma REST API)
curl -s -H "X-Figma-Token: $FIGMA_TOKEN" \
  "https://api.figma.com/v1/files/$FILE_KEY/variables/local" \
  | node scripts/figma-to-w3c-tokens.js > tokens/figma-raw.json

# 2. Transform with Style Dictionary
npx style-dictionary build --config sd.config.js

# 3. Output: CSS custom properties + Tailwind theme
# tokens/
#   figma-raw.json        ← W3C Design Tokens format
#   css/variables.css     ← --color-primary: oklch(0.65 0.15 250);
#   tailwind/theme.js     ← module.exports = { colors: { primary: ... } }
```

```json
// W3C Design Tokens Format (DTCG)
{
  "color": {
    "primary": {
      "$type": "color",
      "$value": "{color.blue.600}",
      "$description": "Primary brand color"
    },
    "surface": {
      "$type": "color",
      "$value": "{color.neutral.50}",
      "$extensions": {
        "mode": {
          "dark": "{color.neutral.900}"
        }
      }
    }
  }
}
```

```typescript
// Style Dictionary config for Figma Variables
import StyleDictionary from 'style-dictionary';

export default {
  source: ['tokens/figma-raw.json'],
  platforms: {
    css: {
      transformGroup: 'css',
      buildPath: 'tokens/css/',
      files: [{ destination: 'variables.css', format: 'css/variables' }],
    },
    tailwind: {
      transformGroup: 'js',
      buildPath: 'tokens/tailwind/',
      files: [{ destination: 'theme.js', format: 'javascript/module' }],
    },
  },
};
```

## Handoff Workflow

The design-to-code pipeline follows five stages:

1. **Design in Figma** — Designer creates components with Variables, Auto Layout, and proper naming
2. **Extract Specs** — Use Dev Mode to inspect spacing, typography, colors, and export assets
3. **Export Tokens** — Figma Variables → W3C tokens JSON via REST API or plugin
4. **Build Components** — Map Auto Layout to CSS Flexbox/Grid, apply tokens, implement variants
5. **Visual QA** — Compare production screenshots against Figma frames with Applitools

```
┌─────────────┐     ┌──────────────┐     ┌───────────────┐
│  Figma File  │────▶│  Dev Mode    │────▶│  tokens.json  │
│  (Variables, │     │  (Inspect,   │     │  (W3C DTCG    │
│  Auto Layout)│     │   Export)    │     │   format)     │
└─────────────┘     └──────────────┘     └───────┬───────┘
                                                  │
                                                  ▼
┌─────────────┐     ┌──────────────┐     ┌───────────────┐
│  Visual QA  │◀────│  Components  │◀────│ Style         │
│  (Applitools,│     │  (React +   │     │ Dictionary    │
│   Chromatic) │     │  Tailwind)   │     │ (CSS/Tailwind)│
└─────────────┘     └──────────────┘     └───────────────┘
```

## Rules

Each rule is loaded on-demand from the `rules/` directory:

<!-- load:rules/figma-variables-tokens.md -->
<!-- load:rules/figma-component-specs.md -->
<!-- load:rules/figma-dev-mode.md -->
<!-- load:rules/figma-auto-layout.md -->
<!-- load:rules/figma-visual-regression.md -->

## Auto Layout to CSS Mapping

Quick reference for the most common mappings:

| Figma Auto Layout | CSS Equivalent | Tailwind Class |
|-------------------|---------------|----------------|
| Direction: Horizontal | `flex-direction: row` | `flex-row` |
| Direction: Vertical | `flex-direction: column` | `flex-col` |
| Gap: 16 | `gap: 16px` | `gap-4` |
| Padding: 16 | `padding: 16px` | `p-4` |
| Padding: 16, 24 | `padding: 16px 24px` | `py-4 px-6` |
| Align: Center | `align-items: center` | `items-center` |
| Justify: Space between | `justify-content: space-between` | `justify-between` |
| Fill container | `flex: 1 1 0%` | `flex-1` |
| Hug contents | `width: fit-content` | `w-fit` |
| Fixed width: 200 | `width: 200px` | `w-[200px]` |
| Min width: 100 | `min-width: 100px` | `min-w-[100px]` |
| Max width: 400 | `max-width: 400px` | `max-w-[400px]` |
| Wrap | `flex-wrap: wrap` | `flex-wrap` |
| Absolute position | `position: absolute` | `absolute` |

## Visual QA Loop

```typescript
// Applitools Eyes + Figma Plugin — CI integration
import { Eyes, Target } from '@applitools/eyes-playwright';

const eyes = new Eyes();

await eyes.open(page, 'MyApp', 'Homepage — Figma Comparison');

// Capture full page
await eyes.check('Full Page', Target.window().fully());

// Capture specific component
await eyes.check(
  'Hero Section',
  Target.region('#hero').ignoreDisplacements()
);

await eyes.close();
```

The Applitools Figma Plugin overlays production screenshots on Figma frames to catch:
- Color mismatches (token not applied or wrong mode)
- Spacing drift (padding/margin deviations)
- Typography inconsistencies (font size, weight, line height)
- Missing states (hover, focus, disabled not implemented)

## Key Decisions

| Decision | Recommendation |
|----------|----------------|
| Token format | W3C Design Tokens Community Group (DTCG) JSON |
| Token pipeline | Figma REST API → Style Dictionary → CSS/Tailwind |
| Color format | OKLCH for perceptually uniform theming |
| Layout mapping | Auto Layout → CSS Flexbox (Grid for 2D layouts) |
| Visual QA tool | Applitools Eyes + Figma Plugin for design-dev diff |
| Spec format | TypeScript interfaces matching Figma component props |
| Mode handling | Figma Variable modes → CSS media queries / class toggles |

## Anti-Patterns (FORBIDDEN)

- **Hardcoded values**: Never hardcode colors, spacing, or typography — always reference tokens
- **Skipping Dev Mode**: Do not eyeball measurements — use Dev Mode for exact values
- **Manual token sync**: Do not manually copy values from Figma — automate with REST API
- **Ignoring modes**: Variables with light/dark modes must map to theme toggles, not separate files
- **Screenshot-only QA**: Visual comparison without structured regression testing misses subtle drift
- **Flat token structure**: Use nested W3C DTCG format, not flat key-value pairs

## References

| Resource | Description |
|----------|-------------|
| [references/figma-to-code-workflow.md](references/figma-to-code-workflow.md) | End-to-end workflow, toolchain options |
| [references/design-dev-communication.md](references/design-dev-communication.md) | PR templates, component status tracking |
| [references/applitools-figma-plugin.md](references/applitools-figma-plugin.md) | Setup, CI integration, comparison config |

## Related Skills

- `ork:design-system-tokens` — W3C token architecture and Style Dictionary transforms
- `ork:ui-components` — shadcn/ui and Radix component patterns
- `ork:accessibility` — WCAG compliance for components extracted from Figma
