---
title: Build a color system with OKLCH, 9-shade scales, and semantic categories
impact: HIGH
impactDescription: "A structured color system prevents accessibility failures, eye strain, and visual inconsistency across themes"
tags: color, oklch, color-scale, semantic-colors, dark-mode, contrast, accessibility, hsl
---

## Color System Architecture

**Incorrect — true black, pure grey, and unstructured colors:**
```css
/* WRONG: True black creates harsh contrast and eye strain */
color: #000000;

/* WRONG: Pure neutral grey feels lifeless (no brand personality) */
background: #808080;

/* WRONG: Unstructured hex soup — no scale, no semantics */
--primary: #0066cc;
--secondary: #aaaaaa;
--error: #ff0000;
```

**Correct — OKLCH scale with brand-tinted neutrals:**
```css
@theme {
  /* PRIMARY — 9-shade OKLCH scale (50→950) */
  --color-brand-50:  oklch(0.97 0.02 250);
  --color-brand-100: oklch(0.93 0.04 250);
  --color-brand-200: oklch(0.86 0.07 250);
  --color-brand-300: oklch(0.76 0.10 250);
  --color-brand-400: oklch(0.65 0.13 250);
  --color-brand-500: oklch(0.55 0.15 250);  /* base */
  --color-brand-600: oklch(0.46 0.15 248);  /* hue shift darker */
  --color-brand-700: oklch(0.38 0.14 246);
  --color-brand-800: oklch(0.30 0.12 244);
  --color-brand-950: oklch(0.18 0.08 240);

  /* NEUTRALS — tinted with brand hue (not pure grey) */
  --color-neutral-50:  oklch(0.98 0.005 250);  /* off-white, not #ffffff */
  --color-neutral-900: oklch(0.18 0.01  250);  /* dark text, not #000000 */

  /* SEMANTIC — success / error / warning / info */
  --color-success: oklch(0.55 0.15 145);
  --color-error:   oklch(0.55 0.18  25);
  --color-warning: oklch(0.65 0.15  75);
  --color-info:    oklch(0.55 0.12 230);

  /* SURFACE — temper max contrast */
  --color-background: oklch(0.98 0.005 250);  /* slate-50 equivalent */
  --color-foreground: oklch(0.18 0.01  250);  /* slate-900 equivalent */
}
```

### Color Categories

| Category | Purpose | Example Tokens |
|----------|---------|----------------|
| Brand/Accent | Primary identity, CTAs | `brand-500`, `brand-600` |
| Semantic | Status communication | `success`, `error`, `warning`, `info` |
| Neutral | Text, backgrounds, borders | `neutral-50` → `neutral-950` |

### Shade Scale Rules

| Shade | Lightness (OKLCH L) | Usage |
|-------|---------------------|-------|
| 50 | ~0.97 | Tinted backgrounds |
| 100–200 | 0.90–0.86 | Hover backgrounds |
| 300–400 | 0.76–0.65 | Borders, disabled states |
| 500 | ~0.55 | Base/default (AA on white) |
| 600–700 | 0.46–0.38 | Hover states for base |
| 800–950 | 0.30–0.18 | Dark mode surfaces, deep text |

### Key Decisions

| Decision | Recommendation |
|----------|----------------|
| Color notation | OKLCH — perceptually uniform, easy to adjust programmatically |
| Shade count | 9 shades per hue (50, 100, 200, 300, 400, 500, 600, 700, 800, 950) |
| True black | Never `#000000` — use `neutral-950` (oklch ~0.18) |
| Neutral tinting | Tint greys with brand hue (cool brand = cool neutrals) |
| Hue rotation | Shift hue 2–6° darker as lightness decreases to maintain saturation |
| Background | Off-white (`neutral-50`) not pure white — reduces eye strain |
| Max contrast | Body text `neutral-900` on `neutral-50` — not pure black on white |
