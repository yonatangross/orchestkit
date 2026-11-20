---
title: Grep-able anti-patterns detectable via static code analysis without a browser
category: wcag
impact: HIGH
impactDescription: "Catch common accessibility regressions at lint/review time before they reach users"
tags: wcag, anti-patterns, static-analysis, grep, lint, code-review
---

# Accessibility Anti-Patterns: Static Detection

These patterns are detectable by grep, ESLint, or code review — no browser required.

## Anti-Pattern Table

| Anti-Pattern | Detection Regex | WCAG | Fix |
|---|---|---|---|
| Focus removal | `outline:\s*(none\|0)` without `:focus-visible` companion | 2.4.11 | Add `:focus-visible` ring with 3:1 contrast |
| Non-descriptive links | Link text `/^(click here\|read more\|here\|more\|learn more)$/i` | 2.4.4 | Use descriptive text meaningful out of context |
| Autoplay media | `<(video\|audio)[^>]*autoplay` without `muted` | 1.4.2 | Add `muted` or remove `autoplay` |
| Missing language | `<html(?![^>]*lang)` | 3.1.1 | Add `<html lang="en">` (or correct BCP 47 tag) |
| Disabled zoom | `(user-scalable=no\|maximum-scale=1)` in viewport meta | 1.4.4 | Remove these restrictions entirely |
| SR content hidden wrong | `display:\s*none\|visibility:\s*hidden` on ARIA-role elements | 1.3.1 | Use `.sr-only` (visually hidden, SR accessible) |
| Placeholder as label | `<input[^>]*placeholder` without nearby `<label` | 3.3.2 | Add `<label for="id">` linked via matching `id` |
| Heading skip | `<h[1-6]` followed later by level +2 or more | 1.3.1 | Maintain sequential hierarchy (h1 > h2 > h3) |
| Image without alt | `<img(?![^>]*\balt\b)` | 1.1.1 | Add `alt="description"` or `alt=""` for decorative |
| Button without text | `<button[^>]*>(\s*<[^/])` with no `aria-label` | 4.1.2 | Add `aria-label="Action name"` |
| Positive tabindex | `tabindex="[1-9]` | 2.4.3 | Use `tabindex="0"` or `-1` only |
| Div/span click handler | `<(div\|span)[^>]*onClick` | 4.1.2 | Replace with `<button>` or add `role="button"` + keyboard handler |

## Detailed Fixes

### Focus Removal

**Incorrect:**
```css
/* Removes focus for all users including keyboard-only users */
* { outline: none; }
button:focus { outline: 0; }
```

**Correct:**
```css
/* Only hide outline for mouse users; preserve for keyboard users */
button:focus:not(:focus-visible) { outline: none; }
button:focus-visible {
  outline: 3px solid #0052cc;
  outline-offset: 2px;
}
```

### Placeholder as Label

**Incorrect:**
```html
<input type="email" placeholder="Email address" />
```

**Correct:**
```html
<label for="email">Email address</label>
<input id="email" type="email" placeholder="you@example.com" aria-required="true" />
```

### Autoplay Media

**Incorrect:**
```html
<video autoplay src="intro.mp4"></video>
```

**Correct:**
```html
<!-- Muted autoplay is allowed (no audio disruption) -->
<video autoplay muted loop src="intro.mp4"></video>
<!-- Or: remove autoplay entirely and provide play control -->
<video controls src="intro.mp4"></video>
```

### Icon-Only Button

**Incorrect:**
```html
<button><svg><!-- search icon --></svg></button>
```

**Correct:**
```html
<button aria-label="Search">
  <svg aria-hidden="true" focusable="false"><!-- search icon --></svg>
</button>
```

### Visually Hidden Content (SR-only)

**Incorrect:**
```css
/* Hides from screen readers too */
.hidden-label { display: none; }
```

**Correct:**
```css
/* Visible to screen readers, hidden visually */
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
```

## ESLint Rule Mapping

| Anti-Pattern | ESLint Rule (`eslint-plugin-jsx-a11y`) |
|---|---|
| Image without alt | `jsx-a11y/alt-text` |
| Missing label | `jsx-a11y/label-has-associated-control` |
| Non-descriptive links | `jsx-a11y/anchor-ambiguous-text` |
| Div with click handler | `jsx-a11y/click-events-have-key-events` + `jsx-a11y/no-static-element-interactions` |
| Button without text | `jsx-a11y/accessible-emoji` + custom rule |
| Autoplay | `jsx-a11y/media-has-caption` |
