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
| `@storybook/addon-interactions` | Step-through play() in UI panel | Bundled in core |
| `@storybook/addon-coverage` | Code coverage for story tests | `npm i -D @storybook/addon-coverage` |

### UI & Design

| Addon | Purpose | Install |
|-------|---------|---------|
| `@storybook/addon-themes` | Theme switching (light/dark/custom) | `npm i -D @storybook/addon-themes` |
| `@storybook/addon-viewport` | Responsive viewport simulation | Bundled in core |
| `@storybook/addon-backgrounds` | Background color switching | Bundled in core |
| `@storybook/addon-measure` | Layout measurement overlay | Bundled in core |

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
  // Only addons that ship as separate packages belong here. Viewport, controls,
  // interactions, actions, backgrounds, and measure are bundled in core.
  addons: [
    '@storybook/addon-vitest',
    '@storybook/addon-a11y',
    '@storybook/addon-themes',
  ],
  framework: '@storybook/react-vite',
}

export default config
```

The `docs.autodocs` key was removed in Storybook 8. Autodocs is opt-in per story
file via the meta tag instead:

```ts
const meta = {
  component: Button,
  tags: ['autodocs'],
} satisfies Meta<typeof Button>
```

See `rules/storybook-autodocs.md` for the full pattern.

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
