---
title: Enable unit-level accessibility testing with jest-axe for fast development feedback
category: a11y
impact: MEDIUM
impactDescription: "Enables fast accessibility feedback during development through unit-level component testing with jest-axe"
tags: accessibility, jest, axe, unit-testing, component
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
