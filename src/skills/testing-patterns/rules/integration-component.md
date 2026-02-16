---
title: "Integration: Component Testing"
category: integration
impact: HIGH
impactDescription: "Tests React components with providers and user interactions for realistic integration coverage"
tags: react, component-testing, integration, user-event, testing-library
---

# React Component Integration Testing

```typescript
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClientProvider } from '@tanstack/react-query';

test('form submits and shows success', async () => {
  const user = userEvent.setup();

  render(
    <QueryClientProvider client={queryClient}>
      <UserForm />
    </QueryClientProvider>
  );

  await user.type(screen.getByLabelText('Email'), 'test@example.com');
  await user.click(screen.getByRole('button', { name: /submit/i }));

  expect(await screen.findByText(/success/i)).toBeInTheDocument();
});
```

## Key Patterns

- Wrap components in providers (QueryClient, Router, Theme)
- Use `userEvent.setup()` for realistic interactions
- Assert on user-visible outcomes, not implementation details
- Use `findBy*` for async assertions (auto-waits)
