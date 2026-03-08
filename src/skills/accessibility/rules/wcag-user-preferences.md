---
title: Honor all user preferences including motion, color scheme, contrast, and zoom
category: modern-web
impact: HIGH
impactDescription: "Respecting OS-level user preferences for motion, color scheme, contrast, and text size prevents vestibular triggers, eye strain, and usability barriers"
tags: wcag, prefers-reduced-motion, prefers-color-scheme, forced-colors, prefers-contrast, zoom, accessibility
---

# User Preferences (2026 Best Practices)

## Principle

Users configure their OS for a reason. Honor every preference: reduced motion, color scheme, high contrast, contrast level, and text zoom. These are not optional enhancements — they are accessibility requirements.

## `prefers-reduced-motion`

Disable or shorten animations for users with vestibular disorders.

**Incorrect — Ignoring motion preference:**
```css
.card {
  transition: transform 0.5s ease;
}
.card:hover {
  transform: scale(1.1) rotate(2deg);
}
```

**Correct — Respecting reduced motion:**
```css
.card {
  transition: transform 0.3s ease;
}
.card:hover {
  transform: scale(1.05);
}

@media (prefers-reduced-motion: reduce) {
  .card {
    transition: none;
  }
  .card:hover {
    transform: none;
  }
}
```

For JS: check `window.matchMedia('(prefers-reduced-motion: reduce)').matches` before animating.

## `prefers-color-scheme`

**Incorrect:** `body { background: #ffffff; color: #1a1a1a; }` — ignores user preference.

**Correct — Adaptive color scheme with CSS custom properties:**
```css
:root { color-scheme: light dark; --bg: #ffffff; --text: #1a1a1a; }
@media (prefers-color-scheme: dark) {
  :root { --bg: #111827; --text: #f3f4f6; }
}
body { background: var(--bg); color: var(--text); }
```

## `forced-colors` (Windows High Contrast)

**Incorrect — Ignoring forced-colors mode:**
```css
.button {
  background: var(--brand-blue);
  border: none;
}
/* In High Contrast mode: button becomes invisible */
```

**Correct — Supporting forced-colors mode:**
```css
.button {
  background: var(--brand-blue);
  border: 2px solid transparent; /* becomes visible in forced-colors */
}

@media (forced-colors: active) {
  .button {
    border-color: ButtonText;
    forced-color-adjust: none; /* Opt out only when custom treatment needed */
  }

  .icon {
    forced-color-adjust: auto; /* Let system colors apply */
  }
}
```

Key `forced-colors` rules:
- Always use `border` (not just `background`) for interactive elements
- Test with Windows High Contrast Mode enabled
- Use system color keywords: `ButtonText`, `Canvas`, `LinkText`, `Highlight`

## `prefers-contrast`

Increase or decrease contrast beyond WCAG minimums on user request.

```css
@media (prefers-contrast: more) {
  :root {
    --text: #000000;
    --bg: #ffffff;
    --border: #000000;
  }
  button {
    border-width: 3px;
  }
}

@media (prefers-contrast: less) {
  :root {
    --text: #333333;
    --bg: #fafafa;
    --border: #cccccc;
  }
}
```

## Text Size and Zoom

Content must remain usable at 200% zoom (WCAG 1.4.4) and with user font-size overrides.

**Incorrect:** `width: 960px; font-size: 14px;` — fixed sizes break zoom.

**Correct — Relative units that respect zoom:**
```css
.container { max-width: 60rem; width: 100%; }
.text { font-size: 0.875rem; line-height: 1.5; }
.content { overflow-wrap: break-word; overflow: visible; }
```

## Audit Checklist

- [ ] All animations wrapped in `prefers-reduced-motion` check
- [ ] Dark mode supported via `prefers-color-scheme`
- [ ] Tested in Windows High Contrast Mode (`forced-colors: active`)
- [ ] `prefers-contrast: more` increases border widths and text contrast
- [ ] Page usable at 200% browser zoom without horizontal scroll
- [ ] All text uses `rem`/`em` units, never `px` for font-size
