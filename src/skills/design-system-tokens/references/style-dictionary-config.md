# Style Dictionary 4.x Configuration Guide

## Overview

Style Dictionary is a build system for transforming design tokens into platform-specific outputs. Version 4.x introduces ESM configuration, the W3C DTCG parser, and improved reference resolution.

## Basic Configuration

```js
// config.mjs
import StyleDictionary from 'style-dictionary';

const sd = new StyleDictionary({
  source: ['tokens/**/*.tokens.json'],
  platforms: {
    css: {
      transformGroup: 'css',
      buildPath: 'build/css/',
      files: [{
        destination: 'variables.css',
        format: 'css/variables',
        options: { outputReferences: true }
      }]
    }
  }
});

await sd.buildAllPlatforms();
```

## Multi-Platform Output

Add platform entries for each target. Supported transform groups: `css`, `js`, `ios`, `android`.

```js
// Add to platforms object alongside css:
js:      { transformGroup: 'js',      buildPath: 'build/js/',      files: [{ destination: 'tokens.js', format: 'javascript/es6' }] },
ios:     { transformGroup: 'ios',     buildPath: 'build/ios/',     files: [{ destination: 'Colors.swift', format: 'ios-swift/class.swift', filter: { type: 'color' } }] },
android: { transformGroup: 'android', buildPath: 'build/android/', files: [{ destination: 'colors.xml', format: 'android/colors', filter: { type: 'color' } }] },
```

## Tokens Studio Integration

When using Tokens Studio (Figma plugin), use `@tokens-studio/sd-transforms`:

```js
import { register } from '@tokens-studio/sd-transforms';
import StyleDictionary from 'style-dictionary';

// Register Tokens Studio transforms and parsers
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
    }
  }
});
```

## Custom Transforms

```js
StyleDictionary.registerTransform({
  name: 'oklch/css',
  type: 'value',
  filter: (token) => token.$type === 'color',
  transform: (token) => {
    // Custom color transformation logic
    return token.$value;
  }
});
```

## Theming with Multiple Files

Generate separate CSS files per theme:

```js
const themes = ['light', 'dark', 'high-contrast'];

for (const theme of themes) {
  const sd = new StyleDictionary({
    source: [
      'tokens/global/**/*.tokens.json',
      `tokens/alias/${theme}.tokens.json`,
      'tokens/component/**/*.tokens.json'
    ],
    platforms: {
      css: {
        transformGroup: 'css',
        buildPath: 'build/css/',
        files: [{
          destination: `${theme}.css`,
          format: 'css/variables',
          options: {
            outputReferences: true,
            selector: theme === 'light' ? ':root' : `[data-theme="${theme}"]`
          }
        }]
      }
    }
  });
  await sd.buildAllPlatforms();
}
```

## Key Options

| Option | Description |
|--------|-------------|
| `outputReferences: true` | Preserve alias chains in output (`var(--color-primary)`) |
| `selector` | CSS selector for the variables block (default: `:root`) |
| `filter` | Filter tokens by type, path, or custom function |
| `transformGroup` | Preset group of transforms (`css`, `js`, `ios`, `android`) |
