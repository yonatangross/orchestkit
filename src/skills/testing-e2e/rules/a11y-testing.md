---
title: Enforce accessibility testing in CI pipelines and enable unit-level component testing with jest-axe
category: a11y
impact: MEDIUM
impactDescription: "Enforces automated accessibility testing in CI/CD pipelines and enables fast feedback during development through jest-axe unit testing"
tags: accessibility, ci-cd, wcag, axe, automation, jest, unit-testing, component
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

**Incorrect — Accessibility tests exist but don't enforce in CI:**
```yaml
# .github/workflows/test.yml
- run: npm run test:a11y  # Runs but doesn't block on failures
- run: npm run test:unit
```

**Correct — CI blocks PRs on accessibility violations:**
```yaml
# .github/workflows/accessibility.yml
on: [pull_request]
jobs:
  a11y:
    runs-on: ubuntu-latest
    steps:
      - run: npm run test:a11y  # Exits with code 1 on violations
      - run: npx playwright test e2e/accessibility  # Blocks merge
```

---

# jest-axe Unit Testing

## Setup

```typescript
// jest.setup.ts
import { toHaveNoViolations } from 'jest-axe';
expect.extend(toHaveNoViolations);
```

## Component Testing

```typescript
import { render } from '@testing-library/react';
import { axe } from 'jest-axe';

it('has no a11y violations', async () => {
  const { container } = render(<Button>Click me</Button>);
  expect(await axe(container)).toHaveNoViolations();
});
```

## Anti-Patterns (FORBIDDEN)

```typescript
// BAD: Disabling rules globally
const results = await axe(container, {
  rules: { 'color-contrast': { enabled: false } }  // NEVER disable rules
});

// BAD: Only testing happy path
it('form is accessible', async () => {
  const { container } = render(<Form />);
  expect(await axe(container)).toHaveNoViolations();
  // Missing: error state, loading state, disabled state
});
```

## Key Patterns

- Test all component states (default, error, loading, disabled)
- Never disable axe rules globally
- Use for fast feedback in development

**Incorrect — Only testing the default state:**
```typescript
it('form is accessible', async () => {
  const { container } = render(<LoginForm />);
  expect(await axe(container)).toHaveNoViolations();
  // Missing: error, loading, disabled states
});
```

**Correct — Testing all component states:**
```typescript
it('form is accessible in all states', async () => {
  const { container, rerender } = render(<LoginForm />);
  expect(await axe(container)).toHaveNoViolations();

  rerender(<LoginForm error="Invalid email" />);
  expect(await axe(container)).toHaveNoViolations();

  rerender(<LoginForm loading={true} />);
  expect(await axe(container)).toHaveNoViolations();
});
```
