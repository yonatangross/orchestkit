---
name: design-stylecards
license: MIT
compatibility: "Claude Code 2.1.183+"
description: "Declarative catalog of named aesthetic recipes — exact shadow stacks, glass surfaces, gradient treatments, and type scales as copy-paste values with Use-When and Avoid rules. Use when the user asks for polished elevation, glassmorphism, a border gradient, a mesh background, or any 'make it look like X' request where taste should come from a versioned recipe instead of being reinvented per session."
argument-hint: "[list | <recipe-name> | apply <recipe> to <file>]"
tags: [design, stylecards, shadows, glass, gradients, typography, tailwind, css, aesthetics]
context: fork
version: 1.0.0
author: OrchestKit
user-invocable: true
complexity: low
persuasion-type: collaborative
model: sonnet
allowed-tools:
  - Read
  - Grep
  - Glob
  - Edit
  - Write
skills:
  - design-system-tokens
metadata:
  category: document-asset-creation
triggers:
  keywords: ["stylecard", "beautiful shadows", "glassmorphism", "glass card", "border gradient", "mesh gradient", "elevation recipe", "make it look polished"]
  examples:
    - "give the cards a polished layered shadow"
    - "apply a glass surface treatment to this panel"
    - "add a subtle border gradient like Linear"
  anti-triggers: [extract, screenshot, audit, tokens-from-source]
---

# Design Stylecards

Specs beat vibes. A stylecard is a named aesthetic recipe with **exact values** — the difference
between "add a nice shadow" (reinvented differently every session) and `elevation/md` (identical
every time, reviewed once, versioned forever).

```bash
/ork:design-stylecards list                      # Catalog index
/ork:design-stylecards elevation/md              # Show one recipe
/ork:design-stylecards apply glass/dark to src/components/Panel.tsx
```

## Why declarative recipes

Pipeline skills (`design-to-code`, `design-context-extract`) answer *how to produce* design output.
Stylecards answer *what good looks like* — as literal values an agent pastes, not adjectives it
interprets. Inspired by MengTo/Skills' stylecard micro-skills (MIT), consolidated into one catalog
to avoid manifest sprawl.

## Workflow

### 1. Resolve the request to a recipe

```python
Read("${CLAUDE_SKILL_DIR}/references/stylecards.md")   # The catalog — always read before choosing
# Match the user's intent to ONE recipe by its Use-When line.
# No match → say so and offer the closest two; never freehand values.
```

### 2. Show or apply

- **Show**: print the recipe verbatim — values, Use-When, Avoid. No paraphrasing values.
- **Apply**: edit the target file using the recipe's exact values. Adapt only the syntax
  (Tailwind arbitrary class ↔ plain CSS ↔ CSS custom property), never the numbers.

### 3. Respect the recipe's Avoid block

Every recipe ends with falsifiable Avoid rules (e.g. "never stack two elevation recipes on one
element"). Violating an Avoid rule to satisfy a user request requires saying so explicitly.

## Catalog index

Full recipes with exact values: `references/stylecards.md`.

| Recipe | Use when |
|--------|----------|
| `elevation/sm` `md` `lg` | Layered neutral shadows — compact controls / cards / hero surfaces |
| `glass/dark` | Frosted glass panel on a dark backdrop |
| `border/gradient` | 1px gradient border without a wrapper hack |
| `background/mesh` | 2–3 hue radial mesh page background |
| `type/editorial` | Display + body + mono role split with tracking values |
| `motion/budget` | The four allowed durations + the one-signature-moment rule |

## Authoring a new stylecard

Add to `references/stylecards.md` following the contract — a recipe without all three parts is
not shippable:

1. **Use when** — one line, concrete surfaces ("cards, panels, popovers"), not adjectives.
2. **Values** — copy-paste-ready code. Numbers, not descriptions.
3. **Avoid** — falsifiable don'ts observed from real misuse.

Source recipes from shipped, reviewed UI (this repo's playground standard, production apps you've
extracted with `design-context-extract`) — never from imagination.

## Anti-Patterns

- **NEVER** freehand shadow/gradient/blur values when a recipe exists — that defeats the catalog
- **NEVER** paraphrase a recipe's values ("roughly 6% black") — paste them exactly
- **NEVER** mix two recipes of the same category (two elevations, two glass treatments) on one element

## Quality Bar

Done means all of these hold:
- The chosen recipe's Use-When line actually matches the user's surface (quote both if challenged)
- Applied values are byte-identical to the catalog entry — only syntax adapted, never numbers
- No Avoid rule of the applied recipe is violated in the final diff
- New recipes carry all three contract parts: Use-When, exact values, Avoid

## Related Skills

- `ork:design-context-extract` — mines new recipe candidates from real apps
- `ork:design-system-tokens` — where recipes graduate into project token architecture
- `ork:design-to-code` — pipeline that consumes stylecards during generation
