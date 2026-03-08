# Storybook Addon Ecosystem (2026)

## Overview

Storybook 9/10 consolidates its addon ecosystem around first-party addons. The testing utilities previously spread across multiple packages are now unified under `@storybook/test` and dedicated addons.

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

## Deprecated / Removed in Storybook 9

| Removed | Replacement |
|---------|-------------|
| `@storybook/test-runner` | `@storybook/addon-vitest` |
| `@storybook/testing-library` | `@storybook/test` (unified) |
| `@storybook/addon-actions` | `fn()` from `@storybook/test` |
| `@storybook/addon-knobs` | `@storybook/addon-controls` (default) |
| `@storybook/addon-jest` | `@storybook/addon-vitest` |

---

## Version Compatibility

- Storybook 9: React 18+, Vue 3.4+, Angular 17+, Svelte 4+
- Storybook 10: React 19+, Vue 3.5+, Angular 18+, Svelte 5+
- Node.js: 20+ required (ESM-only packages)
- Bundler: Vite 6+ recommended, Webpack 5 supported
