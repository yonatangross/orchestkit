# MSW Setup Checklist

## Initial Setup

- [ ] Install MSW 2.x: `npm install msw@latest --save-dev`
- [ ] Initialize MSW: `npx msw init ./public --save`
- [ ] Create `src/mocks/` directory structure

## Directory Structure

```
src/mocks/
├── handlers/
│   ├── index.ts       # Export all handlers
│   ├── users.ts       # User-related handlers
│   ├── auth.ts        # Auth handlers
│   └── ...
├── handlers.ts        # Combined handlers
├── server.ts          # Node.js server (tests)
└── browser.ts         # Browser worker (dev/storybook)
```

## Test Configuration (Vitest)

- [ ] Create `src/mocks/server.ts`:

```typescript
import { setupServer } from 'msw/node';
import { handlers } from './handlers';

export const server = setupServer(...handlers);
```

- [ ] Update `vitest.setup.ts`:

```typescript
import { beforeAll, afterEach, afterAll } from 'vitest';
import { server } from './src/mocks/server';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

- [ ] Update `vitest.config.ts`:

```typescript
export default defineConfig({
  test: {
    setupFiles: ['./vitest.setup.ts'],
  },
});
```

## Handler Implementation Checklist

For each API endpoint:

- [ ] Implement success response with realistic data
- [ ] Handle path parameters (`/:id`)
- [ ] Handle query parameters (pagination, filters)
- [ ] Handle request body for POST/PUT/PATCH
- [ ] Implement error responses (400, 401, 403, 404, 422, 500)
- [ ] Add authentication checks where applicable
- [ ] Export handler from `handlers/index.ts`

## Test Writing Checklist

For each component:

- [ ] Test happy path (success response)
- [ ] Test loading state
- [ ] Test error state (API failure)
- [ ] Test empty state (no data)
- [ ] Test validation errors
- [ ] Test authentication errors
- [ ] Use `server.use()` for test-specific overrides
- [ ] Cleanup: `server.resetHandlers()` runs in afterEach

## Common Issues Checklist

- [ ] Verify `onUnhandledRequest: 'error'` catches missing handlers
- [ ] Check handler URL patterns match actual API calls
- [ ] Ensure async handlers use `await request.json()`
- [ ] Verify response status codes are correct
- [ ] Check Content-Type headers for non-JSON responses

## Storybook Integration (Optional)

- [ ] Create `src/mocks/browser.ts`:

```typescript
import { setupWorker } from 'msw/browser';
import { handlers } from './handlers';

export const worker = setupWorker(...handlers);
```

- [ ] Initialize in `.storybook/preview.ts`:

```typescript
import { initialize, mswLoader } from 'msw-storybook-addon';

initialize();

export const loaders = [mswLoader];
```

- [ ] Add `msw-storybook-addon` to dependencies

## Review Checklist

Before PR:

- [ ] All handlers return realistic mock data
- [ ] Error scenarios are covered
- [ ] No hardcoded tokens/secrets in handlers
- [ ] Handlers are organized by domain (users, auth, etc.)
- [ ] Tests use `server.use()` for overrides, not new handlers
- [ ] Loading states tested with `delay()`
