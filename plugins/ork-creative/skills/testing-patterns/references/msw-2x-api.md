# MSW 2.x API Reference

## Core Imports

```typescript
import { http, HttpResponse, graphql, ws, delay, passthrough } from 'msw';
import { setupServer } from 'msw/node';
import { setupWorker } from 'msw/browser';
```

## HTTP Handlers

### Basic Methods

```typescript
// GET request
http.get('/api/users/:id', ({ params }) => {
  return HttpResponse.json({ id: params.id, name: 'User' });
});

// POST request
http.post('/api/users', async ({ request }) => {
  const body = await request.json();
  return HttpResponse.json({ id: 'new-123', ...body }, { status: 201 });
});

// PUT request
http.put('/api/users/:id', async ({ request, params }) => {
  const body = await request.json();
  return HttpResponse.json({ id: params.id, ...body });
});

// DELETE request
http.delete('/api/users/:id', ({ params }) => {
  return new HttpResponse(null, { status: 204 });
});

// PATCH request
http.patch('/api/users/:id', async ({ request, params }) => {
  const body = await request.json();
  return HttpResponse.json({ id: params.id, ...body });
});

// Catch-all handler (NEW in 2.x)
http.all('/api/*', () => {
  return HttpResponse.json({ error: 'Not implemented' }, { status: 501 });
});
```

### Response Types

```typescript
// JSON response
HttpResponse.json({ data: 'value' });
HttpResponse.json({ data: 'value' }, { status: 201 });

// Text response
HttpResponse.text('Hello World');

// HTML response
HttpResponse.html('<h1>Hello</h1>');

// XML response
HttpResponse.xml('<root><item>value</item></root>');

// ArrayBuffer response
HttpResponse.arrayBuffer(buffer);

// FormData response
HttpResponse.formData(formData);

// No content
new HttpResponse(null, { status: 204 });

// Error response
HttpResponse.error();
```

### Headers and Cookies

```typescript
http.get('/api/data', () => {
  return HttpResponse.json(
    { data: 'value' },
    {
      headers: {
        'X-Custom-Header': 'value',
        'Set-Cookie': 'session=abc123; HttpOnly',
      },
    }
  );
});
```

## Passthrough (NEW in 2.x)

Allow requests to pass through to the actual server:

```typescript
import { passthrough } from 'msw';

// Passthrough specific endpoints
http.get('/api/health', () => passthrough());

// Conditional passthrough
http.get('/api/data', ({ request }) => {
  if (request.headers.get('X-Bypass-Mock') === 'true') {
    return passthrough();
  }
  return HttpResponse.json({ mocked: true });
});
```

## Delay Simulation

```typescript
import { delay } from 'msw';

http.get('/api/slow', async () => {
  await delay(2000); // 2 second delay
  return HttpResponse.json({ data: 'slow response' });
});

// Realistic delay (random between min and max)
http.get('/api/realistic', async () => {
  await delay('real'); // 100-400ms random delay
  return HttpResponse.json({ data: 'response' });
});

// Infinite delay (useful for testing loading states)
http.get('/api/hang', async () => {
  await delay('infinite');
  return HttpResponse.json({ data: 'never reaches' });
});
```

## GraphQL Handlers

```typescript
import { graphql } from 'msw';

// Query
graphql.query('GetUser', ({ variables }) => {
  return HttpResponse.json({
    data: {
      user: {
        id: variables.id,
        name: 'Test User',
      },
    },
  });
});

// Mutation
graphql.mutation('CreateUser', ({ variables }) => {
  return HttpResponse.json({
    data: {
      createUser: {
        id: 'new-123',
        ...variables.input,
      },
    },
  });
});

// Error response
graphql.query('GetUser', () => {
  return HttpResponse.json({
    errors: [{ message: 'User not found' }],
  });
});

// Scoped to endpoint
const github = graphql.link('https://api.github.com/graphql');

github.query('GetRepository', ({ variables }) => {
  return HttpResponse.json({
    data: {
      repository: { name: variables.name },
    },
  });
});
```

## WebSocket Handlers (NEW in 2.x)

```typescript
import { ws } from 'msw';

const chat = ws.link('wss://api.example.com/chat');

export const wsHandlers = [
  chat.addEventListener('connection', ({ client }) => {
    // Send welcome message
    client.send(JSON.stringify({ type: 'welcome', message: 'Connected!' }));

    // Handle incoming messages
    client.addEventListener('message', (event) => {
      const data = JSON.parse(event.data.toString());
      
      if (data.type === 'ping') {
        client.send(JSON.stringify({ type: 'pong' }));
      }
    });

    // Handle close
    client.addEventListener('close', () => {
      console.log('Client disconnected');
    });
  }),
];
```

## Server Setup (Node.js/Vitest)

```typescript
// src/mocks/server.ts
import { setupServer } from 'msw/node';
import { handlers } from './handlers';

export const server = setupServer(...handlers);

// vitest.setup.ts
import { beforeAll, afterEach, afterAll } from 'vitest';
import { server } from './src/mocks/server';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

## Browser Setup (Storybook/Dev)

```typescript
// src/mocks/browser.ts
import { setupWorker } from 'msw/browser';
import { handlers } from './handlers';

export const worker = setupWorker(...handlers);

// Start in development
if (process.env.NODE_ENV === 'development') {
  worker.start({
    onUnhandledRequest: 'bypass',
  });
}
```

## Request Info Access

```typescript
http.post('/api/data', async ({ request, params, cookies }) => {
  // Request body
  const body = await request.json();
  
  // URL parameters
  const { id } = params;
  
  // Query parameters
  const url = new URL(request.url);
  const page = url.searchParams.get('page');
  
  // Headers
  const auth = request.headers.get('Authorization');
  
  // Cookies
  const session = cookies.session;
  
  return HttpResponse.json({ received: body });
});
```

## External Links

- [MSW Documentation](https://mswjs.io/docs/)
- [MSW 2.0 Migration Guide](https://mswjs.io/docs/migrations/1.x-to-2.x)
- [MSW Examples Repository](https://github.com/mswjs/examples)
