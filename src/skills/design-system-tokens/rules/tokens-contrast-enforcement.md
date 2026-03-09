---
title: "Enforce contrast ratios at token definition time, not per component"
impact: CRITICAL
impactDescription: "Per-component contrast checks scale poorly — a single bad text token value propagates failures across every component that uses it"
tags: [accessibility, contrast, wcag, a11y, tokens, dark-mode]
---

## Token-Level Contrast Enforcement

Validate contrast ratios when tokens are defined, not when components are reviewed. If `--color-text-muted` is `4.3:1` on its paired background, every component using it fails WCAG AA — and no per-component audit will fix the root cause.

**Incorrect:**
```json
{
  "color": {
    "text": {
      "muted": { "$type": "color", "$value": "oklch(0.60 0.00 0)" }
    }
  }
}
```
```css
/* No declared background pairing, no contrast metadata — silent failure */
--color-text-muted: oklch(0.60 0.00 0);
```

**Correct — W3C DTCG token with contrast metadata:**
```json
{
  "color": {
    "text": {
      "primary": {
        "$type": "color",
        "$value": "oklch(0.15 0.00 0)",
        "$description": "Primary body text",
        "$extensions": {
          "a11y": {
            "pairedBackground": "{color.bg.primary}",
            "contrastRatio": 12.6,
            "wcagLevel": "AAA"
          }
        }
      },
      "muted": {
        "$type": "color",
        "$value": "oklch(0.45 0.00 0)",
        "$description": "Secondary/muted text — must still meet AA",
        "$extensions": {
          "a11y": {
            "pairedBackground": "{color.bg.primary}",
            "contrastRatio": 4.7,
            "wcagLevel": "AA"
          }
        }
      }
    }
  }
}
```

**Correct — Style Dictionary build-time contrast check:**
```js
// style-dictionary.config.js
StyleDictionary.registerAction({
  name: 'validate/contrast',
  do(dictionary) {
    dictionary.allTokens
      .filter(t => t.$extensions?.a11y?.contrastRatio !== undefined)
      .forEach(t => {
        const { contrastRatio, wcagLevel } = t.$extensions.a11y;
        const threshold = wcagLevel === 'AAA' ? 7 : 4.5;
        if (contrastRatio < threshold) {
          throw new Error(
            `Token ${t.name}: contrast ${contrastRatio} < ${threshold} (${wcagLevel})`
          );
        }
      });
  },
  undo() {}
});
```

**Key rules:**

Minimum ratios at token definition level:
- `--color-text-*` against paired background: >= 4.5:1 (WCAG AA)
- `--color-text-muted` / `--color-text-subtle`: >= 4.5:1 — "muted" describes tone, not an a11y exemption
- `--color-border-*` against adjacent background: >= 3:1 (WCAG 1.4.11 non-text contrast)
- `--color-icon-*` conveying information: >= 3:1
- `--color-interactive-*` (links, button labels): >= 4.5:1 against background; >= 3:1 against surrounding body text

Dark mode:
- Recalculate every pair independently for dark theme tokens — do not assume inversion produces valid contrast
- Pure white (`oklch(1.00 0 0)`) on dark backgrounds often exceeds 15:1 and causes eye strain; target 9-12:1
- Document the dark-mode pairing in `$extensions.a11y` just as you do for light mode

Process:
- Every text-role token declares its intended background pair in `$extensions.a11y.pairedBackground`
- Run `style-dictionary build` as a CI gate — contrast failures block the build
- Review the generated contrast table in pull requests alongside visual diffs

Reference: [references/w3c-token-spec.md](../references/w3c-token-spec.md)
