---
title: "Use Style Dictionary 4.x to transform W3C tokens"
impact: HIGH
impactDescription: "Manual token transformation is error-prone and creates drift between platforms (web, iOS, Android)"
tags: [style-dictionary, token-pipeline, css-variables, tailwind, multi-platform]
---

## Style Dictionary Integration

Use Style Dictionary 4.x with the W3C DTCG parser to transform design tokens into platform-specific outputs. A single token source generates CSS custom properties, Tailwind theme config, iOS Swift constants, and Android XML resources.

**Incorrect:**
```js
// Manually maintaining separate files per platform
// tokens.css
:root { --color-primary: #3b82f6; }

// tokens.swift
struct Colors { static let primary = UIColor(hex: "#3b82f6") }

// tokens.xml
<color name="colorPrimary">#3b82f6</color>
```

**Correct:**
```js
// config.mjs — Style Dictionary 4.x
import { register } from '@tokens-studio/sd-transforms';
import StyleDictionary from 'style-dictionary';

register(StyleDictionary);

const sd = new StyleDictionary({
  source: ['tokens/**/*.tokens.json'],
  parsers: ['tokens-studio'],
  platforms: {
    css: {
      transformGroup: 'tokens-studio',
      buildPath: 'build/css/',
      files: [{
        destination: 'variables.css',
        format: 'css/variables',
        options: { outputReferences: true }
      }]
    },
    tailwind: {
      transformGroup: 'tokens-studio',
      buildPath: 'build/',
      files: [{
        destination: 'tailwind-tokens.js',
        format: 'javascript/es6'
      }]
    }
  }
});

await sd.buildAllPlatforms();
```

**Key rules:**
- Use Style Dictionary 4.x (ESM) — v3 does not support W3C format natively
- Enable `outputReferences: true` to preserve alias chains in CSS output
- Use `@tokens-studio/sd-transforms` for Tokens Studio / Figma Variables compatibility
- Run token builds in CI to catch reference errors before merge
- Custom transforms go in `config.mjs` — never patch generated output files
- Separate source files by tier: `tokens/global/`, `tokens/alias/`, `tokens/component/`

Reference: [references/style-dictionary-config.md](../references/style-dictionary-config.md)
