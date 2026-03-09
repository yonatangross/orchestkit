---
title: "Define colors in OKLCH for perceptual uniformity"
impact: HIGH
impactDescription: "HSL and hex produce uneven shade scales where equal numeric steps create visually unequal changes"
tags: [oklch, color-space, perceptual-uniformity, accessibility, contrast]
---

## OKLCH Color Space

Use OKLCH (Oklab Lightness, Chroma, Hue) for all color token definitions. OKLCH is perceptually uniform — equal numeric changes in lightness produce equal visual changes, unlike HSL where yellow at 50% lightness appears far brighter than blue at 50%.

**Incorrect:**
```json
{
  "color": {
    "primary": {
      "$type": "color",
      "100": { "$value": "#dbeafe" },
      "500": { "$value": "#3b82f6" },
      "900": { "$value": "#1e3a5f" }
    }
  }
}
```

```css
/* HSL shade scale — uneven perception */
--blue-100: hsl(214, 95%, 93%);
--blue-500: hsl(217, 91%, 60%);
--blue-900: hsl(224, 64%, 33%);
```

**Correct:**
```json
{
  "color": {
    "primary": {
      "$type": "color",
      "50":  { "$value": "oklch(0.97 0.01 250)" },
      "100": { "$value": "oklch(0.93 0.04 250)" },
      "200": { "$value": "oklch(0.85 0.08 250)" },
      "300": { "$value": "oklch(0.75 0.12 250)" },
      "400": { "$value": "oklch(0.65 0.16 250)" },
      "500": { "$value": "oklch(0.55 0.18 250)" },
      "600": { "$value": "oklch(0.48 0.16 250)" },
      "700": { "$value": "oklch(0.40 0.14 250)" },
      "800": { "$value": "oklch(0.32 0.10 250)" },
      "900": { "$value": "oklch(0.25 0.08 250)" }
    }
  }
}
```

**Key rules:**
- OKLCH format: `oklch(L C H)` — L: 0-1 lightness, C: 0-0.4 chroma, H: 0-360 hue
- Generate shade scales by varying L (lightness) while keeping H (hue) constant
- Reduce C (chroma) slightly at extremes (very light/dark) to stay within sRGB gamut
- For accessible contrast: ensure 4.5:1 ratio between text and background tokens (WCAG AA)
- Light shades (50-200): L > 0.80; mid shades (300-500): L 0.45-0.75; dark shades (600-900): L < 0.50
- Use CSS `color-mix(in oklch, ...)` for runtime blending if needed
- All modern browsers support OKLCH natively (Chrome 111+, Safari 15.4+, Firefox 113+)

Reference: [references/w3c-token-spec.md](../references/w3c-token-spec.md)
