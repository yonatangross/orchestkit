# Storybook Addon Ecosystem (2026)

## Overview

Storybook 10 consolidates its addon ecosystem around first-party addons. Essential addons (viewport, controls, interactions, actions) are now bundled in core — remove them as separate dependencies. Testing utilities are unified under `storybook/test`.

---

## Essential Addons

### Testing & Quality

| Addon | Purpose | Install |
|-------|---------|---------|
| `@storybook/addon-vitest` | Run stories as Vitest tests | `npm i -D @storybook/addon-vitest` |
| `@storybook/addon-a11y` | Accessibility audits via axe-core | `npm i -D @storybook/addon-a11y` |
| `@storybook/addon-interactions` | Step-through play() in UI panel | `npm i -D @storybook/addon-interactions` |
| `@storybook/addon-coverage` | Code coverage for story tests | `npm i -D @storybook/addon-coverage` |

### UI & Design

| Addon | Purpose | Install |
|-------|---------|---------|
| `@storybook/addon-themes` | Theme switching (light/dark/custom) | `npm i -D @storybook/addon-themes` |
| `@storybook/addon-viewport` | Responsive viewport simulation | `npm i -D @storybook/addon-viewport` |
| `@storybook/addon-backgrounds` | Background color switching | `npm i -D @storybook/addon-backgrounds` |
| `@storybook/addon-measure` | Layout measurement overlay | `npm i -D @storybook/addon-measure` |

### Documentation

| Addon | Purpose | Install |
|-------|---------|---------|
| `@storybook/addon-docs` | MDX docs and autodocs pages | Included by default |
| `@storybook/addon-controls` | Interactive arg editing in panel | Included by default |

### External Services

| Addon | Purpose | Install |
|-------|---------|---------|
| `chromatic` | Visual regression testing service | `npm i -D chromatic` |
| `@storybook/addon-designs` | Figma/Zeplin embed in panel | `npm i -D @storybook/addon-designs` |

---

## Recommended .storybook/main.ts Configuration

```ts
import type { StorybookConfig } from '@storybook/react-vite'

const config: StorybookConfig = {
  stories: ['../src/**/*.stories.@(ts|tsx)'],
  addons: [
    '@storybook/addon-vitest',
    '@storybook/addon-a11y',
    '@storybook/addon-interactions',
    '@storybook/addon-themes',
    '@storybook/addon-viewport',
  ],
  framework: '@storybook/react-vite',
  docs: {
    autodocs: 'tag',  // generate docs for stories with 'autodocs' tag
  },
}

export default config
```

---

## Deprecated / Removed

| Removed | Replacement | Since |
|---------|-------------|-------|
| `@storybook/test-runner` | `@storybook/addon-vitest` | SB 9 |
| `@storybook/testing-library` | `storybook/test` (unified) | SB 9 |
| `@storybook/addon-actions` | `fn()` from `storybook/test` | SB 9 |
| `@storybook/addon-knobs` | `@storybook/addon-controls` (default) | SB 7 |
| `@storybook/addon-jest` | `@storybook/addon-vitest` | SB 9 |
| `@storybook/addon-viewport` (separate) | Bundled in core | SB 10 |
| `@storybook/addon-controls` (separate) | Bundled in core | SB 10 |
| `@storybook/addon-interactions` (separate) | Bundled in core | SB 10 |
| `experimental-addon-test` | `@storybook/addon-vitest` | SB 10 |

---

## Version Compatibility

- Storybook 10: React 18+, Vue 3.5+, Angular 18+, Svelte 5+
- Node.js: 20.16+ / 22.19+ / 24+ required (ESM-only)
- Bundler: Vite 8 recommended, Webpack 5 supported
- Vitest: 4.1+ supported
