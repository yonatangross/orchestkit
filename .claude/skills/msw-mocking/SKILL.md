---
name: msw-mocking
description: Mock Service Worker (MSW) for API mocking. Use when testing frontend components with network mocking, simulating API errors, or creating deterministic API responses in tests.
---

# MSW (Mock Service Worker)

Network-level API mocking for frontend tests.

## When to Use

- Frontend component testing
- Simulating API responses
- Error state testing
- Network delay simulation

## Setup

```typescript
// src/mocks/handlers.ts
import { http, HttpResponse } from 'msw';

export const handlers = [
  http.get('/api/users/:id', ({ params }) => {
    return HttpResponse.json({
      id: params.id,
      name: 'Test User',
      email: 'test@example.com',
    });
  }),

  http.post('/api/users', async ({ request }) => {
    const body = await request.json();
    return HttpResponse.json({ id: 'new-123', ...body }, { status: 201 });
  }),
];

// src/mocks/server.ts
import { setupServer } from 'msw/node';
import { handlers } from './handlers';

export const server = setupServer(...handlers);
```

## Test Setup

```typescript
// vitest.setup.ts
import { beforeAll, afterEach, afterAll } from 'vitest';
import { server } from './src/mocks/server';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

## Runtime Handler Override

```typescript
import { http, HttpResponse } from 'msw';
import { server } from '../mocks/server';

test('shows error on API failure', async () => {
  server.use(
    http.get('/api/users/:id', () => {
      return HttpResponse.json({ error: 'Not found' }, { status: 404 });
    })
  );

  render(<UserProfile id="123" />);

  expect(await screen.findByText(/not found/i)).toBeInTheDocument();
});
```

## Simulating Delays

```typescript
import { delay, http, HttpResponse } from 'msw';

test('shows loading state', async () => {
  server.use(
    http.get('/api/users/:id', async () => {
      await delay(100);
      return HttpResponse.json({ id: '123', name: 'Test' });
    })
  );

  render(<UserProfile id="123" />);

  expect(screen.getByTestId('skeleton')).toBeInTheDocument();
  expect(await screen.findByText('Test')).toBeInTheDocument();
});
```

## Form Submission Test

```typescript
test('submits form and shows success', async () => {
  const user = userEvent.setup();

  server.use(
    http.post('/api/analyze', async ({ request }) => {
      const body = await request.json();
      return HttpResponse.json({
        id: 'analysis-123',
        url: body.url,
        status: 'pending',
      });
    })
  );

  render(<AnalysisForm />);

  await user.type(screen.getByLabelText('URL'), 'https://example.com');
  await user.click(screen.getByRole('button', { name: /analyze/i }));

  expect(await screen.findByText(/analysis started/i)).toBeInTheDocument();
});
```

## Anti-Patterns

```typescript
// ❌ NEVER mock fetch directly
jest.spyOn(global, 'fetch').mockResolvedValue(...)

// ❌ NEVER mock axios module
jest.mock('axios')

// ❌ NEVER test implementation details
expect(fetch).toHaveBeenCalledWith('/api/...')

// ✅ ALWAYS use MSW
server.use(http.get('/api/...', () => HttpResponse.json({...})))

// ✅ ALWAYS test user-visible behavior
expect(await screen.findByText('Success')).toBeInTheDocument()
```

## Key Decisions

| Decision | Recommendation |
|----------|----------------|
| Handler location | `src/mocks/handlers.ts` |
| Default behavior | Return success |
| Override scope | Per-test with `server.use()` |
| Unhandled requests | Error (catch missing mocks) |

## Common Mistakes

- Mocking at implementation level (axios.mock)
- Forgetting `server.resetHandlers()` cleanup
- Not handling error cases
- Missing handlers (silent failures)

## Related Skills

- `unit-testing` - Component isolation
- `integration-testing` - Full integration tests
- `vcr-http-recording` - Python equivalent
