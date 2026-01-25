---
name: create-msw-handler
description: Create MSW handler with auto-detected existing handlers and endpoints. Use when creating API mocks.
user-invocable: true
argument-hint: [endpoint-path]
---

Create MSW handler for: $ARGUMENTS

## Handler Context (Auto-Detected)

- **MSW Version**: !`grep -r "msw" package.json 2>/dev/null | head -1 | grep -oE 'msw[^"]*' || echo "Not detected"`
- **Existing Handlers**: !`grep -r "rest\.get\|rest\.post" src/mocks tests/mocks 2>/dev/null | wc -l | tr -d ' ' || echo "0"`
- **API Base URL**: !`grep -r "API_URL\|VITE_API\|NEXT_PUBLIC_API" .env* 2>/dev/null | head -1 | cut -d'=' -f2 || echo "/api"`
- **Handlers Location**: !`find . -type d -name "mocks" -o -name "handlers" 2>/dev/null | head -1 || echo "src/mocks"`

## MSW Handler Template

```typescript
/**
 * MSW Handler: $ARGUMENTS
 * 
 * Generated: !`date +%Y-%m-%d`
 * Endpoint: $ARGUMENTS
 */

import { http, HttpResponse, delay } from 'msw';

export const handlers = [
  http.get('$ARGUMENTS', async () => {
    await delay(100); // Simulate network delay
    
    return HttpResponse.json({
      data: [],
      // Add your mock data here
    });
  }),

  http.post('$ARGUMENTS', async ({ request }) => {
    const body = await request.json();
    
    return HttpResponse.json({
      id: '123',
      ...body,
    }, { status: 201 });
  }),
];
```

## Usage

1. Review detected patterns above
2. Add to: `src/mocks/handlers.ts`
3. Register in MSW setup
