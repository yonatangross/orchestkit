---
title: "Organize tokens in global, alias, and component tiers"
impact: HIGH
impactDescription: "Flat token structures prevent theme switching and create tight coupling between components and raw values"
tags: [design-tokens, token-hierarchy, alias-tokens, component-tokens]
---

## Three-Tier Token Hierarchy

Organize tokens into three layers: global (raw values), alias (semantic meaning), and component (scoped usage). Components reference aliases, aliases reference globals. This enables theme switching by remapping aliases without touching components.

**Incorrect:**
```json
{
  "button": {
    "background": { "$type": "color", "$value": "#3b82f6" },
    "text": { "$type": "color", "$value": "#ffffff" },
    "border-radius": { "$type": "dimension", "$value": "8px" }
  },
  "card": {
    "background": { "$type": "color", "$value": "#ffffff" },
    "border": { "$type": "color", "$value": "#e5e7eb" }
  }
}
```

**Correct:**
```json
{
  "global": {
    "color": {
      "blue": {
        "$type": "color",
        "500": { "$value": "oklch(0.55 0.18 250)" },
        "600": { "$value": "oklch(0.48 0.18 250)" }
      },
      "neutral": {
        "$type": "color",
        "0": { "$value": "oklch(1.00 0 0)" },
        "100": { "$value": "oklch(0.96 0.00 0)" },
        "800": { "$value": "oklch(0.27 0.00 0)" }
      }
    }
  },
  "alias": {
    "color": {
      "$type": "color",
      "action": { "$value": "{global.color.blue.500}" },
      "actionHover": { "$value": "{global.color.blue.600}" },
      "surface": { "$value": "{global.color.neutral.0}" },
      "onSurface": { "$value": "{global.color.neutral.800}" }
    }
  },
  "component": {
    "button": {
      "bg": { "$type": "color", "$value": "{alias.color.action}" },
      "bgHover": { "$type": "color", "$value": "{alias.color.actionHover}" },
      "text": { "$type": "color", "$value": "{global.color.neutral.0}" }
    }
  }
}
```

**Key rules:**
- Global tokens are raw values — colors, sizes, font stacks — never used directly in components
- Alias tokens add semantic meaning — `action`, `surface`, `onSurface`, `danger` — and reference globals
- Component tokens scope usage — `button.bg`, `card.border` — and reference aliases
- Theme switching remaps alias layer only; component tokens stay unchanged
- Keep global palette complete (all shades); keep alias layer minimal (only used semantics)
- A component token referencing a global directly is a code smell — add an alias

Reference: [references/token-naming-conventions.md](../references/token-naming-conventions.md)
