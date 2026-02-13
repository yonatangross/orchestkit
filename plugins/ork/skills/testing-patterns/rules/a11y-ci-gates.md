---
title: "A11y: CI Gates"
category: a11y
impact: MEDIUM
---

# CI/CD Accessibility Gates

```yaml
# .github/workflows/accessibility.yml
name: Accessibility
on: [pull_request]

jobs:
  a11y:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20', cache: 'npm' }
      - run: npm ci
      - run: npm run test:a11y
      - run: npm run build
      - run: npx playwright install --with-deps chromium
      - run: npm start & npx wait-on http://localhost:3000
      - run: npx playwright test e2e/accessibility
```

## Anti-Patterns (FORBIDDEN)

```typescript
// BAD: Excluding too much
new AxeBuilder({ page })
  .exclude('body')  // Defeats the purpose
  .analyze();

// BAD: No CI enforcement
// Accessibility tests exist but don't block PRs

// BAD: Manual-only testing
// Relying solely on human review
```

## Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| CI gate | Block on violations | Prevent regression |
| Tags | wcag2a, wcag2aa, wcag22aa | Full WCAG 2.2 AA |
| Exclusions | Third-party widgets only | Minimize blind spots |
