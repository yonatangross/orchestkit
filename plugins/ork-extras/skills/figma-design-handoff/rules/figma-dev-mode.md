---
title: "Figma Dev Mode Inspection"
impact: "HIGH"
impactDescription: "Without Dev Mode, developers estimate measurements from visual inspection, producing inconsistent spacing, wrong font weights, and incorrect asset sizes."
tags: [figma-dev-mode, inspection, measurements, asset-export, spacing, typography]
---

## Figma Dev Mode Inspection

Figma Dev Mode provides exact measurements, CSS code snippets, asset export, and redline overlays. Always use Dev Mode for implementation — never estimate values from the visual canvas.

**Incorrect:**
```css
/* Eyeballed from Figma canvas — wrong values */
.card {
  padding: 15px;           /* Actual: 16px (4-unit grid) */
  font-size: 13px;         /* Actual: 14px */
  font-weight: 500;        /* Actual: 600 */
  border-radius: 10px;     /* Actual: 8px */
  gap: 10px;               /* Actual: 12px */
}
```

**Correct:**
```css
/* Exact values from Dev Mode inspect panel */
.card {
  padding: var(--spacing-md);     /* 16px — from Dev Mode */
  font-size: var(--text-sm);      /* 14px — from typography section */
  font-weight: var(--font-semibold); /* 600 — from font details */
  border-radius: var(--radius-md);   /* 8px — from corner radius */
  gap: var(--spacing-sm);           /* 12px — from gap measurement */
}
```

**Dev Mode workflow:**
```markdown
## Dev Mode Inspection Checklist

### Spacing & Layout
- [ ] Read padding from the Auto Layout section (not manual measurement)
- [ ] Read gap from the Auto Layout section
- [ ] Check constraints for responsive behavior (Fill/Hug/Fixed)

### Typography
- [ ] Font family, size, weight, line height from the Type section
- [ ] Letter spacing if non-default
- [ ] Text decoration (underline, strikethrough)

### Colors
- [ ] Read fill colors — note Variable name if using Variables
- [ ] Read border/stroke colors
- [ ] Read shadow values (offset, blur, spread, color)

### Assets
- [ ] Export icons as SVG (not PNG) at 1x
- [ ] Export images at 1x, 2x for responsive
- [ ] Use "Copy as SVG" for inline icons
```

**Key rules:**
- Always use Dev Mode inspect panel — never measure visually on the canvas
- Read spacing values from Auto Layout section, not by measuring between elements
- Copy exact CSS snippets from Dev Mode and map to token variables
- Export SVG assets at 1x — framework tooling handles optimization
- Check the Variable name in color values — use the token reference, not the hex value
- Verify responsive constraints (Fill container, Hug contents, Fixed) for layout behavior
- Use the code panel (CSS/iOS/Android) as a starting point, then replace hardcoded values with tokens

Reference: [Figma Dev Mode Documentation](https://help.figma.com/hc/en-us/articles/15023124644247)
