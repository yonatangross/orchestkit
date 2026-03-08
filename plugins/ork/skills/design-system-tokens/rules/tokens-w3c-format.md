---
title: "Use W3C DTCG token format with $type and $value"
impact: CRITICAL
impactDescription: "Non-standard token formats break interoperability with Figma, Style Dictionary, and other tooling"
tags: [design-tokens, w3c-tokens, dtcg, json-format]
---

## W3C DTCG Token Format

All design tokens must follow the W3C Design Token Community Group specification. Every token requires `$type` and `$value` properties. Group tokens hierarchically using nested objects.

**Incorrect:**
```json
{
  "colors": {
    "primary": "#3b82f6",
    "secondary": "rgb(99, 102, 241)"
  },
  "spacing": {
    "small": 8,
    "medium": "16px"
  }
}
```

**Correct:**
```json
{
  "color": {
    "$type": "color",
    "primary": {
      "$value": "oklch(0.55 0.18 250)",
      "$description": "Primary brand color"
    },
    "secondary": {
      "$value": "oklch(0.50 0.17 280)",
      "$description": "Secondary accent color"
    }
  },
  "spacing": {
    "$type": "dimension",
    "sm": {
      "$value": "8px",
      "$description": "Compact spacing"
    },
    "md": {
      "$value": "16px",
      "$description": "Default spacing"
    }
  }
}
```

**Key rules:**
- Every token must have `$value`; `$type` can be set on the token or inherited from a parent group
- Valid `$type` values: `color`, `dimension`, `fontFamily`, `fontWeight`, `duration`, `cubicBezier`, `number`, `strokeStyle`, `border`, `transition`, `shadow`, `gradient`, `typography`, `fontStyle`
- Use `$description` for documentation; tooling can extract these for style guides
- File extension should be `.tokens.json` for tooling auto-detection
- Use `$extensions` for vendor-specific metadata (deprecation, figma-mapping, etc.)
- Token names use camelCase; group names use camelCase
- References use curly brace syntax: `"{color.primary}"` to alias another token

**W3C token group inheritance:**
```json
{
  "spacing": {
    "$type": "dimension",
    "xs": { "$value": "4px" },
    "sm": { "$value": "8px" },
    "md": { "$value": "16px" },
    "lg": { "$value": "24px" },
    "xl": { "$value": "32px" }
  }
}
```

All children inherit `$type: "dimension"` from the parent group — no need to repeat it.

Reference: [W3C Design Tokens Specification](https://design-tokens.github.io/community-group/format/)
