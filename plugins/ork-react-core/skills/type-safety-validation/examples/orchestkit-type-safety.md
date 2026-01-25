# OrchestKit Type Safety Implementation

How OrchestKit could leverage Zod and end-to-end type safety for the FastAPI backend and React frontend.

## Current State

**Backend (FastAPI + Pydantic):**
- ✅ Runtime validation with Pydantic models
- ✅ OpenAPI schema generation
- ✅ Type hints throughout Python code

**Frontend (React + TypeScript):**
- ✅ TypeScript for static typing
- ⚠️ Manual type definitions for API responses
- ❌ No runtime validation of API responses
- ❌ Type drift between backend and frontend

## Vision: End-to-End Type Safety

### Architecture

```
┌─────────────────────────────────────────────────────┐
│                   Backend (FastAPI)                  │
│                                                      │
│  ┌──────────────┐      ┌──────────────┐            │
│  │   Pydantic   │ ───▶ │  OpenAPI     │            │
│  │   Models     │      │  Schema      │            │
│  └──────────────┘      └──────────────┘            │
│                              │                       │
└──────────────────────────────┼───────────────────────┘
                               │
                        Generate Types
                               │
                               ▼
┌─────────────────────────────────────────────────────┐
│                Frontend (React + TS)                 │
│                                                      │
│  ┌──────────────┐      ┌──────────────┐            │
│  │ Generated TS │ ───▶ │     Zod      │            │
│  │    Types     │      │   Schemas    │            │
│  └──────────────┘      └──────────────┘            │
│                              │                       │
│                              ▼                       │
│                     Runtime Validation               │
└─────────────────────────────────────────────────────┘
```

## Implementation Strategies

### Strategy 1: OpenAPI → Zod Generation

Use `openapi-zod-client` to generate Zod schemas from OpenAPI spec:

```bash
# Install generator
npm install -D openapi-zod-client

# Generate Zod schemas from OpenAPI spec
npx openapi-zod-client http://localhost:8500/openapi.json -o src/api/generated.ts
```

**Generated output:**
```typescript
// src/api/generated.ts (auto-generated)
import { z } from 'zod'

export const AnalysisSchema = z.object({
  id: z.string().uuid(),
  url: z.string().url(),
  status: z.enum(['pending', 'processing', 'completed', 'failed']),
  created_at: z.string().datetime(),
  metadata: z.record(z.unknown()).optional(),
})

export type Analysis = z.infer<typeof AnalysisSchema>

export const AnalysisCreateSchema = z.object({
  url: z.string().url(),
  include_embeddings: z.boolean().default(true),
})

export type AnalysisCreate = z.infer<typeof AnalysisCreateSchema>
```

**Usage in React:**
```typescript
// src/features/analysis/hooks/useAnalysis.ts
import { AnalysisSchema } from '@/api/generated'

export function useAnalysis(id: string) {
  const { data, error } = useSWR(`/api/v1/analyses/${id}`, async (url) => {
    const response = await fetch(url)
    const json = await response.json()

    // Runtime validation!
    const result = AnalysisSchema.safeParse(json)

    if (!result.success) {
      console.error('Invalid API response:', result.error)
      throw new Error('API returned invalid data')
    }

    return result.data
  })

  return { data, error }
}
```

### Strategy 2: Pydantic ↔ Zod Pattern Mapping

Manual mapping between Pydantic and Zod patterns:

**Backend (Pydantic):**
```python
# backend/app/schemas/analysis.py
from pydantic import BaseModel, Field, HttpUrl
from datetime import datetime
from enum import Enum

class AnalysisStatus(str, Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"

class AnalysisCreate(BaseModel):
    url: HttpUrl
    include_embeddings: bool = True

class Analysis(BaseModel):
    id: str = Field(..., description="UUID")
    url: HttpUrl
    status: AnalysisStatus
    created_at: datetime
    metadata: dict[str, Any] | None = None

    class Config:
        from_attributes = True
```

**Frontend (Zod):**
```typescript
// frontend/src/schemas/analysis.ts
import { z } from 'zod'

export const AnalysisStatusSchema = z.enum([
  'pending',
  'processing',
  'completed',
  'failed'
])

export const AnalysisCreateSchema = z.object({
  url: z.string().url(),
  include_embeddings: z.boolean().default(true),
})

export const AnalysisSchema = z.object({
  id: z.string().uuid(),
  url: z.string().url(),
  status: AnalysisStatusSchema,
  created_at: z.string().datetime().transform(s => new Date(s)),
  metadata: z.record(z.unknown()).nullable(),
})

export type AnalysisStatus = z.infer<typeof AnalysisStatusSchema>
export type AnalysisCreate = z.infer<typeof AnalysisCreateSchema>
export type Analysis = z.infer<typeof AnalysisSchema>
```

### Strategy 3: Shared Type Definitions

Generate TypeScript types from Pydantic, then create Zod schemas:

```bash
# Generate TypeScript types from OpenAPI
npx openapi-typescript http://localhost:8500/openapi.json -o src/api/types.ts
```

**Then create Zod schemas that satisfy the generated types:**
```typescript
// src/api/schemas.ts
import { z } from 'zod'
import type { components } from './types' // Generated types

export const AnalysisSchema = z.object({
  id: z.string().uuid(),
  url: z.string().url(),
  status: z.enum(['pending', 'processing', 'completed', 'failed']),
  created_at: z.string().datetime(),
  metadata: z.record(z.unknown()).nullable(),
}) satisfies z.ZodType<components['schemas']['Analysis']>

// TypeScript ensures Zod schema matches OpenAPI type!
```

## Real-World Example: Analysis Submission

### Backend (FastAPI)
```python
# backend/app/api/v1/analyses.py
from fastapi import APIRouter, Depends
from app.schemas.analysis import AnalysisCreate, Analysis
from app.services.analysis_service import AnalysisService

router = APIRouter()

@router.post("/", response_model=Analysis, status_code=201)
async def create_analysis(
    data: AnalysisCreate,
    service: AnalysisService = Depends()
) -> Analysis:
    """Create new analysis with validation."""
    return await service.create(data)
```

### Frontend (React + Zod)
```typescript
// src/features/analysis/components/AnalysisForm.tsx
'use client'

import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { AnalysisCreateSchema, AnalysisSchema } from '@/schemas/analysis'

export function AnalysisForm() {
  const form = useForm<z.infer<typeof AnalysisCreateSchema>>({
    resolver: zodResolver(AnalysisCreateSchema),
    defaultValues: {
      include_embeddings: true,
    },
  })

  const onSubmit = async (data: z.infer<typeof AnalysisCreateSchema>) => {
    try {
      const response = await fetch('/api/v1/analyses/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      const json = await response.json()

      // Runtime validation of API response!
      const result = AnalysisSchema.safeParse(json)

      if (!result.success) {
        console.error('Invalid API response:', result.error)
        throw new Error('Server returned invalid data')
      }

      // result.data is fully typed!
      console.log('Created analysis:', result.data.id)

    } catch (error) {
      form.setError('root', {
        message: error instanceof Error ? error.message : 'Failed to create analysis'
      })
    }
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)}>
      <input {...form.register('url')} placeholder="Enter URL" />
      {form.formState.errors.url && (
        <span className="error">{form.formState.errors.url.message}</span>
      )}

      <label>
        <input type="checkbox" {...form.register('include_embeddings')} />
        Include embeddings
      </label>

      <button type="submit" disabled={form.formState.isSubmitting}>
        {form.formState.isSubmitting ? 'Creating...' : 'Create Analysis'}
      </button>
    </form>
  )
}
```

## SSE (Server-Sent Events) Validation

OrchestKit uses SSE for real-time progress updates. Validate event payloads:

**Backend:**
```python
# backend/app/schemas/events.py
from pydantic import BaseModel

class ProgressEvent(BaseModel):
    type: Literal["progress"]
    agent_id: str
    stage: str
    progress: float  # 0.0 to 1.0
    message: str

class ErrorEvent(BaseModel):
    type: Literal["error"]
    error: str
    details: dict[str, Any] | None = None
```

**Frontend:**
```typescript
// src/schemas/events.ts
import { z } from 'zod'

export const ProgressEventSchema = z.object({
  type: z.literal('progress'),
  agent_id: z.string(),
  stage: z.string(),
  progress: z.number().min(0).max(1),
  message: z.string(),
})

export const ErrorEventSchema = z.object({
  type: z.literal('error'),
  error: z.string(),
  details: z.record(z.unknown()).optional(),
})

export const EventSchema = z.discriminatedUnion('type', [
  ProgressEventSchema,
  ErrorEventSchema,
])

export type Event = z.infer<typeof EventSchema>

// src/hooks/useAnalysisProgress.ts
export function useAnalysisProgress(id: string) {
  const [events, setEvents] = useState<Event[]>([])

  useEffect(() => {
    const eventSource = new EventSource(`/api/v1/analyses/${id}/progress`)

    eventSource.onmessage = (event) => {
      const json = JSON.parse(event.data)

      // Runtime validation!
      const result = EventSchema.safeParse(json)

      if (result.success) {
        setEvents(prev => [...prev, result.data])
      } else {
        console.error('Invalid SSE event:', result.error)
      }
    }

    return () => eventSource.close()
  }, [id])

  return events
}
```

## Benefits for OrchestKit

1. **Type Safety Across Stack**
   - Backend: Pydantic validates inputs
   - Frontend: Zod validates API responses
   - No runtime surprises from mismatched data

2. **Single Source of Truth**
   - OpenAPI spec generated from Pydantic
   - TypeScript types + Zod schemas generated from OpenAPI
   - Changes to backend models automatically update frontend

3. **Better DX**
   - Autocomplete for API responses
   - Compile-time errors when API changes
   - Runtime validation catches issues early

4. **Form Validation**
   - Use same Zod schemas for form validation (react-hook-form)
   - Consistent validation rules
   - Better error messages

5. **Testing**
   - Mock data generators from Zod schemas
   - Type-safe test fixtures
   - Validate test data matches production

## Migration Path

### Phase 1: Add Zod to Frontend
```bash
npm install zod @hookform/resolvers
```

### Phase 2: Create Schemas for Critical Types
Start with most-used types (Analysis, Artifact, Chunk):
```typescript
// src/schemas/index.ts
export * from './analysis'
export * from './artifact'
export * from './chunk'
```

### Phase 3: Add Runtime Validation to API Calls
Wrap fetch calls with validation:
```typescript
// src/lib/api-client.ts
export async function apiRequest<T>(
  url: string,
  schema: z.ZodType<T>,
  options?: RequestInit
): Promise<T> {
  const response = await fetch(url, options)
  const json = await response.json()

  const result = schema.safeParse(json)

  if (!result.success) {
    console.error('API validation failed:', result.error)
    throw new Error('Invalid API response')
  }

  return result.data
}
```

### Phase 4: Automate Type Generation
Set up CI/CD to regenerate types on backend changes:
```yaml
# .github/workflows/generate-types.yml
name: Generate Frontend Types
on:
  push:
    paths:
      - 'backend/app/schemas/**'

jobs:
  generate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - run: npm run generate:types
      - uses: peter-evans/create-pull-request@v5
        with:
          title: "Update generated API types"
```

## Pydantic ↔ Zod Cheat Sheet

| Pydantic (Python) | Zod (TypeScript) |
|-------------------|------------------|
| `str` | `z.string()` |
| `int` | `z.number().int()` |
| `float` | `z.number()` |
| `bool` | `z.boolean()` |
| `datetime` | `z.date()` or `z.string().datetime()` |
| `HttpUrl` | `z.string().url()` |
| `EmailStr` | `z.string().email()` |
| `Field(..., min_length=1)` | `z.string().min(1)` |
| `Field(..., max_length=100)` | `z.string().max(100)` |
| `Field(..., ge=0, le=100)` | `z.number().min(0).max(100)` |
| `list[str]` | `z.array(z.string())` |
| `dict[str, Any]` | `z.record(z.unknown())` |
| `str \| None` | `z.string().optional()` or `.nullable()` |
| `Literal["active"]` | `z.literal("active")` |
| `Enum` | `z.enum([...])` or `z.nativeEnum(...)` |
| `@validator` | `.refine(...)` or `.transform(...)` |
| `BaseModel` | `z.object({...})` |

## Conclusion

Adding Zod to OrchestKit's frontend would provide:
- ✅ Runtime safety for API responses
- ✅ Form validation with same schemas
- ✅ Type inference for better DX
- ✅ Single source of truth via OpenAPI
- ✅ Gradual migration path

Start with critical types, then expand coverage over time.
