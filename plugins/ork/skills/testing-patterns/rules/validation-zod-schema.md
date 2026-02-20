---
title: Test Zod validation schemas to prevent invalid data from passing API boundaries
impact: HIGH
impactDescription: "Untested validation schemas allow invalid data to pass through API boundaries causing runtime failures"
tags: zod, validation, schema, typescript, type-safety, branded-types
---

## Zod Schema Validation Testing

**Incorrect -- no validation at API boundaries:**
```typescript
// Trusting external data without validation
app.post('/users', (req, res) => {
  const user = req.body  // No validation! Any shape accepted
  db.create(user)
})

// Using 'any' instead of validated types
const data: any = await fetch('/api').then(r => r.json())
```

**Correct -- Zod schema validation at boundaries:**
```typescript
import { z } from 'zod'

const UserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  age: z.number().int().positive().max(120),
  role: z.enum(['admin', 'user', 'guest']),
  createdAt: z.date().default(() => new Date())
})

type User = z.infer<typeof UserSchema>

// Always use safeParse for error handling
const result = UserSchema.safeParse(req.body)
if (!result.success) {
  return res.status(422).json({ errors: result.error.issues })
}
const user: User = result.data
```

**Correct -- branded types to prevent ID confusion:**
```typescript
const UserId = z.string().uuid().brand<'UserId'>()
const AnalysisId = z.string().uuid().brand<'AnalysisId'>()

type UserId = z.infer<typeof UserId>
type AnalysisId = z.infer<typeof AnalysisId>

function deleteAnalysis(id: AnalysisId): void { /* ... */ }
deleteAnalysis(userId) // Compile error: UserId not assignable to AnalysisId
```

**Correct -- exhaustive type checking:**
```typescript
function assertNever(x: never): never {
  throw new Error("Unexpected value: " + x)
}

type Status = 'pending' | 'running' | 'completed' | 'failed'

function getStatusColor(status: Status): string {
  switch (status) {
    case 'pending': return 'gray'
    case 'running': return 'blue'
    case 'completed': return 'green'
    case 'failed': return 'red'
    default: return assertNever(status) // Compile-time exhaustiveness!
  }
}
```

Key principles:
- Validate at ALL boundaries: API inputs, form submissions, external data
- Use `.safeParse()` for graceful error handling
- Branded types prevent ID type confusion
- `assertNever` in switch default for compile-time exhaustiveness
- Enable `strict: true` and `noUncheckedIndexedAccess` in tsconfig
- Reuse schemas (don't create inline in hot paths)
