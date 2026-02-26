---
title: Validate end-to-end type safety across API layers to eliminate runtime type errors
impact: HIGH
impactDescription: "Type gaps between API layers cause runtime errors that compile-time validation eliminates entirely"
tags: trpc, prisma, type-safety, end-to-end, pydantic, python, typescript
---

## End-to-End Type Safety Validation

**Incorrect -- type gaps between API layers:**
```typescript
// Manual type definitions that can drift from schema
interface User {
  id: string
  name: string
  // Missing 'email' field that database has
}

// No type connection between client and server
const response = await fetch('/api/users')
const users = await response.json() // type: any
```

**Correct -- tRPC end-to-end type safety:**
```typescript
import { initTRPC } from '@trpc/server'
import { z } from 'zod'

const t = initTRPC.create()

export const appRouter = t.router({
  getUser: t.procedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      return await db.user.findUnique({ where: { id: input.id } })
    }),

  createUser: t.procedure
    .input(z.object({ email: z.string().email(), name: z.string() }))
    .mutation(async ({ input }) => {
      return await db.user.create({ data: input })
    })
})

export type AppRouter = typeof appRouter
// Client gets full type inference from server without code generation
```

**Correct -- Python type safety with Pydantic and NewType:**
```python
from typing import NewType
from uuid import UUID
from pydantic import BaseModel, EmailStr

AnalysisID = NewType("AnalysisID", UUID)
ArtifactID = NewType("ArtifactID", UUID)

def delete_analysis(id: AnalysisID) -> None: ...
delete_analysis(artifact_id)  # Error with mypy/ty

class CreateUserRequest(BaseModel):
    email: EmailStr
    name: str = Field(min_length=2, max_length=100)

# Type-safe extraction from untyped dict
result = {"findings": {...}, "confidence_score": 0.85}
findings: dict[str, object] | None = (
    cast("dict[str, object]", result.get("findings"))
    if isinstance(result.get("findings"), dict) else None
)
```

**Testing type safety:**
```typescript
// Test that schema rejects invalid data
describe('UserSchema', () => {
  test('rejects invalid email', () => {
    const result = UserSchema.safeParse({ email: 'not-email', name: 'Test' })
    expect(result.success).toBe(false)
  })

  test('rejects missing required fields', () => {
    const result = UserSchema.safeParse({})
    expect(result.success).toBe(false)
    expect(result.error.issues).toHaveLength(2)
  })
})
```

Key decisions:
- Runtime validation: Zod (best DX, TypeScript inference)
- API layer: tRPC for end-to-end type safety without codegen
- Exhaustive checks: assertNever for compile-time union completeness
- Python: Pydantic v2 + NewType for branded IDs
- Always test validation schemas reject invalid data
