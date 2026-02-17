---
title: "WCAG: Color Contrast"
category: wcag
impact: CRITICAL
impactDescription: "Ensures text and UI components meet minimum 4.5:1 contrast ratio for readability"
tags: wcag, contrast, color, accessibility, readability
---

# Color Contrast (WCAG 1.4.3, 1.4.11)

## Contrast Requirements

| Element Type | Minimum Ratio | WCAG Criterion |
|-------------|---------------|----------------|
| Normal text (< 18pt / < 14pt bold) | 4.5:1 | 1.4.3 |
| Large text (>= 18pt / >= 14pt bold) | 3:1 | 1.4.3 |
| UI components (borders, icons, focus) | 3:1 | 1.4.11 |
| Focus indicators | 3:1 | 2.4.7 |

## CSS Custom Properties

```css
:root {
  --text-primary: #1a1a1a;   /* 16.1:1 on white - normal text */
  --text-secondary: #595959; /* 7.0:1 on white - secondary */
  --focus-ring: #0052cc;     /* 7.3:1 - focus indicator */
}

/* High visibility focus indicator */
:focus-visible {
  outline: 3px solid var(--focus-ring);
  outline-offset: 2px;
}

/* Button border 3:1 contrast */
.button {
  background: #ffffff;
  border: 2px solid #757575; /* 4.5:1 on white */
}

/* Minimum target size (WCAG 2.5.8) */
button, a[role="button"], input[type="checkbox"] {
  min-width: 24px;
  min-height: 24px;
}

/* Touch-friendly target size */
@media (hover: none) {
  button {
    min-width: 44px;
    min-height: 44px;
  }
}
```

## Non-Color Status Indicators

Never convey information through color alone:

```tsx
// FORBIDDEN: Color-only status
<span className="text-red-500">Error</span>

// CORRECT: Color + icon + text
<span className="text-red-500 flex items-center gap-1">
  <AlertIcon aria-hidden="true" />
  Error: Invalid email address
</span>
```

## Text Spacing (WCAG 1.4.12)

Content must remain usable when text spacing is adjusted:

```css
body {
  line-height: 1.5;        /* at least 1.5x font size */
}
p {
  margin-bottom: 2em;      /* at least 2x font size */
}
```

## Reflow (WCAG 1.4.10)

Content must reflow without horizontal scrolling at 320px width:

```css
/* Responsive design */
.card {
  width: 100%;
  max-width: 600px;
}

/* FORBIDDEN: Fixed width that forces horizontal scroll */
.card {
  width: 800px;
}
```

## Testing Tools

- **WebAIM Contrast Checker**: [webaim.org/resources/contrastchecker](https://webaim.org/resources/contrastchecker/)
- **Chrome DevTools**: Inspect > Color picker > Contrast ratio
- **Lighthouse**: Accessibility audit built into Chrome DevTools

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| Insufficient text contrast (#b3b3b3 = 2.1:1) | Use #595959 or darker (7.0:1+) |
| Removing focus outline globally | Use `:focus-visible` with custom outline |
| Color-only error indication | Add icon + text alongside color |
| Fixed-width layouts | Use responsive `max-width` + `width: 100%` |
| Tiny touch targets | Minimum 24px, 44px for touch devices |

**Incorrect — Insufficient text contrast:**
```css
.secondary-text {
  color: #b3b3b3;  /* 2.1:1 ratio on white - fails WCAG AA */
}
```

**Correct — Meeting 4.5:1 contrast minimum:**
```css
.secondary-text {
  color: #595959;  /* 7.0:1 ratio on white - passes WCAG AA */
}
```
