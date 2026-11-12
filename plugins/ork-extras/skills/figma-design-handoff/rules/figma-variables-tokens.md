---
title: "Figma Variables to Design Tokens"
impact: "CRITICAL"
impactDescription: "Without structured token extraction, developers hardcode values from screenshots, causing design drift across themes and modes."
tags: [figma-variables, design-tokens, w3c-dtcg, style-dictionary, light-dark]
---

## Figma Variables to Design Tokens

Figma Variables (colors, numbers, strings, booleans) must be exported to W3C Design Tokens Community Group (DTCG) JSON format, then transformed via Style Dictionary into platform outputs (CSS custom properties, Tailwind theme, iOS/Android tokens).

**Incorrect:**
```css
/* Hardcoded values copied from Figma inspector */
:root {
  --primary: #3b82f6;
  --surface: #ffffff;
  --spacing-md: 16px;
}
/* No dark mode, no semantic aliases, breaks when design updates */
```

**Correct:**
```json
{
  "color": {
    "primary": {
      "$type": "color",
      "$value": "{color.blue.600}",
      "$description": "Primary brand color from Figma Variables"
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
  },
  "spacing": {
    "md": {
      "$type": "dimension",
      "$value": "16px"
    }
  }
}
```

```typescript
// Fetching Figma Variables via REST API
const response = await fetch(
  `https://api.figma.com/v1/files/${fileKey}/variables/local`,
  { headers: { 'X-Figma-Token': process.env.FIGMA_TOKEN } }
);
const { meta } = await response.json();

// Map Figma collections → W3C token groups
for (const collection of Object.values(meta.variableCollections)) {
  // Each collection = token group (e.g., "colors", "spacing")
  // Each mode = theme variant (e.g., "light", "dark")
}
```

**Key rules:**
- Always use W3C DTCG format (`$type`, `$value`, `$description`) — never flat key-value
- Map Figma Variable collections to token groups (colors, spacing, typography)
- Map Figma Variable modes to theme variants (light/dark, compact/comfortable)
- Use `$extensions.mode` for multi-mode values, not separate token files
- Reference aliases (`{color.blue.600}`) instead of raw values for semantic tokens
- Automate extraction via Figma REST API or Variables export plugin — never copy manually
- Run Style Dictionary build in CI to catch token schema errors before merge

Reference: [W3C Design Tokens Format](https://design-tokens.github.io/community-group/format/)
