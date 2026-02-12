---
title: "Mocking: MSW 2.x"
category: mocking
impact: HIGH
---

# MSW (Mock Service Worker) 2.x

## Quick Reference

```typescript
import { http, HttpResponse, graphql, ws, delay, passthrough } from 'msw';
import { setupServer } from 'msw/node';

// Basic handler
http.get('/api/users/:id', ({ params }) => {
  return HttpResponse.json({ id: params.id, name: 'User' });
});

// Error response
http.get('/api/fail', () => {
  return HttpResponse.json({ error: 'Not found' }, { status: 404 });
});

// Delay simulation
http.get('/api/slow', async () => {
  await delay(2000);
  return HttpResponse.json({ data: 'response' });
});
```

## Test Setup

```typescript
// vitest.setup.ts
import { server } from './src/mocks/server';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

## Runtime Override

```typescript
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

## Anti-Patterns (FORBIDDEN)

```typescript
// NEVER mock fetch directly
jest.spyOn(global, 'fetch').mockResolvedValue(...)

// NEVER mock axios module
jest.mock('axios')

// ALWAYS use MSW at network level
server.use(http.get('/api/...', () => HttpResponse.json({...})))
```

## Key Decisions

| Decision | Recommendation |
|----------|----------------|
| Handler location | `src/mocks/handlers.ts` |
| Default behavior | Return success |
| Override scope | Per-test with `server.use()` |
| Unhandled requests | Error (catch missing mocks) |
