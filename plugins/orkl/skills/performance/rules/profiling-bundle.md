---
title: Bundle Analysis
impact: MEDIUM
impactDescription: "Bundle analysis reveals bloated dependencies and missed tree-shaking opportunities that silently inflate load times"
tags: bundle, webpack, rollup, vite, tree-shaking, analyzer, budget, performance-budget
---

# Bundle Analysis

Analyze and optimize JavaScript bundle size with visualization tools and CI budgets.

## Webpack Bundle Analyzer

```javascript
// webpack.config.js
const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer');

module.exports = {
  plugins: [
    new BundleAnalyzerPlugin({
      analyzerMode: 'static',      // Generates HTML report
      openAnalyzer: false,
      reportFilename: 'bundle-report.html',
    }),
  ],
};
```

## Vite / Rollup Visualizer

```typescript
// vite.config.ts
import { visualizer } from 'rollup-plugin-visualizer';

export default defineConfig({
  plugins: [
    visualizer({
      filename: 'bundle-report.html',
      gzipSize: true,
      brotliSize: true,
    }),
  ],
});
```

## Performance Budgets in CI

```json
// bundlesize.config.json
{
  "files": [
    { "path": "dist/assets/index-*.js", "maxSize": "150 kB", "compression": "gzip" },
    { "path": "dist/assets/vendor-*.js", "maxSize": "80 kB", "compression": "gzip" },
    { "path": "dist/assets/*.css", "maxSize": "30 kB", "compression": "gzip" }
  ]
}
```

```yaml
# .github/workflows/bundle-check.yml
- name: Check bundle size
  run: npx bundlesize
  env:
    BUNDLESIZE_GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

## Import Cost Awareness

```typescript
// BAD: Imports entire library (70 kB)
import _ from 'lodash';
const sorted = _.sortBy(items, 'name');

// GOOD: Import single function (4 kB)
import sortBy from 'lodash/sortBy';
const sorted = sortBy(items, 'name');

// BEST: Use native (0 kB)
const sorted = items.toSorted((a, b) => a.name.localeCompare(b.name));
```

**Incorrect — Importing entire lodash adds 70 kB:**
```typescript
import _ from 'lodash';
const sorted = _.sortBy(items, 'name');
```

**Correct — Import single function or use native API:**
```typescript
// Option 1: Import only what you need (4 kB)
import sortBy from 'lodash/sortBy';
const sorted = sortBy(items, 'name');

// Option 2: Use native API (0 kB)
const sorted = items.toSorted((a, b) => a.name.localeCompare(b.name));
```

**Key rules:**
- **Run** bundle analysis on every release to catch regressions
- **Set** CI performance budgets (fail build if exceeded)
- **Import** only what you use from large libraries
- **Check** gzip/brotli sizes, not raw sizes
- **Replace** large dependencies with native APIs when possible
